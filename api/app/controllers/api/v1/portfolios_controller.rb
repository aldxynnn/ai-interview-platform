# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session, only: %i[show regenerate]

      # GET /api/v1/sessions/:id/portfolio
      def show
        portfolio = @session.portfolio
        if portfolio.nil? || portfolio.generation_status.in?(%w[pending generating])
          return render json: {
            status: portfolio&.generation_status || "generating"
          }, status: :accepted
        end

        if portfolio.failed?
          return json_response(
            portfolio: portfolio_json(portfolio),
            error: "Portfolio generation failed. Retry generation or contact support."
          )
        end

        json_response(portfolio: portfolio_json(portfolio))
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio
        return json_error("No portfolio found for this session", :not_found) unless portfolio
        return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity) unless portfolio.failed?

        portfolio.update!(generation_status: "pending", generation_error: nil)
        jid = PortfolioGeneratorWorker.perform_async(@session.id)
        if jid.blank?
          portfolio.update!(generation_status: "failed", generation_error: "Portfolio generation could not be queued")
          return json_error("Portfolio generation could not be queued. Please retry.", :service_unavailable)
        end

        json_response(message: "Portfolio generation queued", portfolio: portfolio_json(portfolio))
      end

      # GET /api/v1/portfolios/:id/export
      def export
        portfolio = tenant_portfolio(params[:id])
        return json_error("Portfolio not found", :not_found) unless portfolio

        format = params.fetch(:format, "json")
        return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity) unless %w[pdf json].include?(format)
        return json_error("Portfolio is not ready for export", :unprocessable_entity) unless portfolio.complete?

        if format == "pdf"
          vacancy = scoped_vacancy(params[:vacancy_id]) if params[:vacancy_id].present?
          return json_error("Vacancy not found", :not_found) if params[:vacancy_id].present? && vacancy.nil?

          pdf_data = Exports::PdfGenerator.new(portfolio: portfolio, vacancy: vacancy).call
          return send_data pdf_data, filename: "portfolio-#{portfolio.id}.pdf",
                           type: "application/pdf", disposition: "attachment"
        end

        vacancy_id = params[:vacancy_id]
        if vacancy_id.present?
          report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy_id)
          return json_error("Fit/gap report not found", :not_found) unless report
          return json_error("Fit/gap report is not ready for export", :unprocessable_entity) unless report.complete?
        end
        export_data = build_export_json(portfolio, vacancy_id)
        send_data export_data.to_json, filename: "portfolio-#{portfolio.id}.json",
                  type: "application/json", disposition: "attachment"
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio = tenant_portfolio(params[:id])
        return json_error("Portfolio not found", :not_found) unless portfolio
        vacancy = scoped_vacancy(params[:vacancy_id])
        return json_error("Vacancy not found", :not_found) unless vacancy
        return json_error("Portfolio is not ready for fit/gap analysis", :unprocessable_entity) unless portfolio.complete?

        report = FitGap::GenerationCoordinator.request!(portfolio: portfolio, vacancy: vacancy, force: true)
        report.generation_status == "failed" ?
          json_response(report: fit_gap_json(report), error: "Could not queue generation. Please retry.") :
          render(json: { status: report.generation_status, report: fit_gap_json(report) },
                 status: report.complete? ? :ok : :accepted)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio = tenant_portfolio(params[:id])
        return json_error("Portfolio not found", :not_found) unless portfolio

        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]
        return json_error("vacancy_id is required", :unprocessable_entity) if vacancy_id.blank?

        vacancy = scoped_vacancy(vacancy_id)
        return json_error("Vacancy not found", :not_found) unless vacancy
        return json_error("Portfolio is not ready for fit/gap analysis", :unprocessable_entity) unless portfolio.complete?

        report = FitGap::GenerationCoordinator.request!(portfolio: portfolio, vacancy: vacancy)
        if report.complete?
          json_response(report: fit_gap_json(report))
        else
          render json: {
            status: report.generation_status,
            message: report.failed? ? "Fit/gap generation failed. Retry the report." : "Fit/gap report is being generated.",
            report: fit_gap_json(report)
          }, status: report.failed? ? :service_unavailable : :accepted
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio not found", :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = tenant_portfolio(params[:id])
        return json_error("Portfolio not found", :not_found) unless portfolio
        vacancy = scoped_vacancy(params[:vacancy_id])
        return json_error("Vacancy not found", :not_found) unless vacancy

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        return json_error("Fit/gap report not found", :not_found) unless report

        if report.failed?
          return json_response(report: fit_gap_json(report), error: "Fit/gap generation failed. Retry the report.")
        end
        if report.pending? || report.generating?
          return render json: { status: report.generation_status, report: fit_gap_json(report) }, status: :accepted
        end

        json_response(report: fit_gap_json(report))
      end

      private

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def tenant_portfolio(id)
        Portfolio.for_tenant(current_tenant_id).find_by(id: id)
      end

      def scoped_vacancy(id)
        Vacancy.find_by(id: id)
      end

      def portfolio_json(portfolio)
        {
          id: portfolio.id,
          session_id: portfolio.session_id,
          candidate_id: portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at: portfolio.generated_at,
          generation_error: portfolio.failed? ? "Portfolio generation failed" : nil,
          skills: portfolio.portfolio_skills.map(&method(:portfolio_skill_json)),
          overrides: portfolio.assessor_overrides.map(&method(:override_json))
        }
      end

      def portfolio_skill_json(skill)
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          is_discovered: skill.is_discovered,
          ai_level: skill.ai_level,
          ai_confidence: skill.ai_confidence,
          evidence: skill.evidence_quotes,
          competency_summary: skill.competency_summary
        }
      end

      def override_json(override)
        {
          id: override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level: override.ai_level,
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by: override.overridden_by,
          overridden_at: override.overridden_at
        }
      end

      def fit_gap_json(report)
        {
          id: report.id,
          portfolio_id: report.portfolio_id,
          vacancy_id: report.vacancy_id,
          generation_status: report.generation_status,
          generation_version: report.generation_version,
          generation_error: report.failed? ? "Fit/gap generation failed" : nil,
          skill_comparisons: report.skill_comparisons || [],
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at: report.generated_at
        }
      end

      def build_export_json(portfolio, vacancy_id = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio: portfolio_json(portfolio)
        }

        if vacancy_id.present?
          report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy_id)
          data[:fit_gap_report] = report ? fit_gap_json(report) : nil
        end

        data
      end
    end
  end
end
