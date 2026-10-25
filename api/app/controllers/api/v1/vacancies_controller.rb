# frozen_string_literal: true

require "pdf/reader"

module Api
  module V1
    class VacanciesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_vacancy, only: %i[show update destroy]

      # GET /api/v1/vacancies
      def index
        vacancies = paginate(Vacancy.where(tenant_id: current_tenant_id).order(created_at: :desc))

        json_response(
          vacancies: vacancies.map(&method(:vacancy_json)),
          meta: pagination_meta(vacancies)
        )
      end

      # GET /api/v1/vacancies/:id
      def show
        json_response(vacancy: vacancy_with_skills_json(@vacancy))
      end

      # POST /api/v1/vacancies/import_pdf
      # Parses text-based PDFs in memory; the source file is not persisted.
      def import_pdf
        file = params[:file]
        return json_error("Choose a PDF job description to import.", :unprocessable_entity) unless file.respond_to?(:tempfile)
        return json_error("The file must be a PDF.", :unprocessable_entity) unless file.original_filename.to_s.downcase.end_with?(".pdf")
        return json_error("PDF must be 10 MB or smaller.", :payload_too_large) if file.size > 10.megabytes

        signature = file.tempfile.read(5)
        file.tempfile.rewind
        return json_error("The selected file is not a valid PDF.", :unprocessable_entity) unless signature == "%PDF-"

        pdf_text = begin
          reader = PDF::Reader.new(file.tempfile)
          return json_error("PDF must contain 50 pages or fewer.", :unprocessable_entity) if reader.page_count > 50
          reader.pages.map(&:text).join("\n").slice(0, 30_000)
        rescue StandardError => e
          Rails.logger.warn("[N14] PDF import parsing failed error_class=#{e.class.name}")
          return json_error("We couldn't read this PDF. Use an unencrypted PDF with selectable text.", :unprocessable_entity)
        ensure
          file.tempfile.rewind
        end

        return json_error("No selectable text was found. Upload a text-based PDF rather than a scanned image.", :unprocessable_entity) if pdf_text.blank?

        vacancy = Vacancies::PdfImporter.new(tenant_id: current_tenant_id, created_by: current_user.id, pdf_text: pdf_text).call
        json_response({ vacancy: vacancy_with_skills_json(vacancy) }, :created)
      rescue Vacancies::PdfImporter::InvalidResponse
        json_error("We couldn't identify a role and skill requirements from this PDF. Try a clearer job description or enter it manually.", :unprocessable_entity)
      rescue Gemini::HttpClient::ApiError, Faraday::Error, KeyError => e
        status = e.respond_to?(:status) ? e.status : nil
        Rails.logger.error("[N14] PDF import AI request failed error_class=#{e.class.name} provider_status=#{status || 'n/a'}")
        json_error("AI extraction is temporarily unavailable. Please retry or create the vacancy manually.", :service_unavailable)
      rescue ActiveRecord::RecordInvalid
        json_error("The extracted vacancy could not be saved. Please review the PDF and retry.", :unprocessable_entity)
      end

      # POST /api/v1/vacancies
      def create
        vacancy = Vacancy.new(vacancy_params.merge(tenant_id: current_tenant_id))
        vacancy.created_by = current_user.id

        if vacancy.save
          json_response({ vacancy: vacancy_with_skills_json(vacancy) }, :created)
        else
          json_error(vacancy.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/vacancies/:id
      def update
        if @vacancy.update(vacancy_params)
          json_response(vacancy: vacancy_with_skills_json(@vacancy))
        else
          json_error(@vacancy.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/vacancies/:id
      def destroy
        @vacancy.destroy
        json_response(message: "Vacancy deleted")
      end

      private

      def set_vacancy
        @vacancy = Vacancy.where(tenant_id: current_tenant_id).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Vacancy not found", :not_found)
      end

      def vacancy_params
        params.require(:vacancy).permit(
          :role_title,
          :culture_dimensions,
          :competency_expectations,
          vacancy_skills_attributes: %i[
            id skill_id skill_label expected_level _destroy
          ]
        )
      end

      def vacancy_json(vacancy)
        {
          id:                       vacancy.id,
          role_title:               vacancy.role_title,
          culture_dimensions:       vacancy.culture_dimensions,
          competency_expectations:  vacancy.competency_expectations,
          created_by:               vacancy.created_by,
          created_at:               vacancy.created_at,
          updated_at:               vacancy.updated_at
        }
      end

      def vacancy_with_skills_json(vacancy)
        skills = vacancy.vacancy_skills

        # Preload taxonomy anchors in one query to avoid N+1
        skill_ids    = skills.filter_map(&:skill_id).uniq
        taxonomy_map = SkillTaxonomy.where(skill_id: skill_ids).index_by(&:skill_id)

        vacancy_json(vacancy).merge(
          skills: skills.map { |s| vacancy_skill_json(s, taxonomy_map[s.skill_id]) }
        )
      end

      def vacancy_skill_json(skill, taxonomy)
        {
          id:             skill.id,
          skill_id:       skill.skill_id,
          skill_label:    skill.skill_label,
          expected_level: skill.expected_level,
          l1_anchor:      taxonomy&.l1_anchor,
          l2_anchor:      taxonomy&.l2_anchor,
          l3_anchor:      taxonomy&.l3_anchor,
          l4_anchor:      taxonomy&.l4_anchor,
          l5_anchor:      taxonomy&.l5_anchor
        }
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end
    end
  end
end
