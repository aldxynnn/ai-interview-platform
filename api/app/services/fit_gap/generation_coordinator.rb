# frozen_string_literal: true

module FitGap
  # Idempotently reserves report generation before enqueuing Sidekiq work.
  # The unique (portfolio_id, vacancy_id) index is the concurrency backstop.
  class GenerationCoordinator
    def self.request!(portfolio:, vacancy:, force: false)
      report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
      enqueue = false

      if report.nil?
        begin
          report = FitGapReport.create!(
            portfolio_id: portfolio.id,
            vacancy_id: vacancy.id,
            skill_comparisons: [],
            generation_status: "pending",
            generation_version: 1,
            generated_at: nil
          )
          enqueue = true
        rescue ActiveRecord::RecordNotUnique
          # Another request won the unique-index race. Only it should enqueue.
          report = FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
          enqueue = report.claim_generation!(force: force)
        end
      else
        enqueue = report.claim_generation!(force: force)
      end

      if enqueue
        version = report.generation_version
        begin
          jid = FitGapGeneratorWorker.perform_async(report.id, version)
          report.mark_generation_failed!(generation_version: version, exception_class: "QueueUnavailable") if jid.blank?
        rescue StandardError => e
          report.mark_generation_failed!(generation_version: version, exception_class: e.class.name)
          raise
        end
      end

      report.reload
    end
  end
end
