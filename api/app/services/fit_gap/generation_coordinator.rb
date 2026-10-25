# frozen_string_literal: true

module FitGap
  # Keeps the last successful report visible while a replacement is generated.
  # The monotonically increasing version makes duplicate/late jobs harmless.
  class GenerationCoordinator
    class EnqueueFailed < StandardError; end

    def self.request!(portfolio:, vacancy:, force: false)
      unless portfolio.session.tenant_id == vacancy.tenant_id
        raise ArgumentError, "Portfolio and vacancy must belong to the same tenant"
      end

      report = nil
      version = nil

      FitGapReport.transaction do
        report = FitGapReport.lock.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if report&.generation_status == "generating" && !force
          next
        end
        if report&.generation_status == "complete" && !force
          next
        end

        report ||= FitGapReport.new(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id,
          skill_comparisons: []
        )
        version = report.generation_version.to_i + 1
        report.update!(
          generation_status: "generating",
          generation_error: nil,
          generation_version: version,
          generation_started_at: Time.current
        )
      end

      return report if version.nil?

      job_id = FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id, version)
      if job_id.blank?
        FitGapReport.where(id: report.id, generation_version: version).update_all(
          generation_status: "failed",
          generation_error: "Report generation could not be queued. Please retry.",
          updated_at: Time.current
        )
        raise EnqueueFailed, "Fit/gap generation job was not queued"
      end

      report
    rescue StandardError
      if report&.persisted? && version.present?
        FitGapReport.where(id: report.id, generation_version: version, generation_status: "generating").update_all(
          generation_status: "failed",
          generation_error: "Report generation could not be queued. Please retry.",
          updated_at: Time.current
        )
      end
      raise
    end
  end
end
