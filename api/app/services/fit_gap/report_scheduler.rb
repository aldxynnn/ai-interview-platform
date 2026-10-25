# frozen_string_literal: true

module FitGap
  class ReportScheduler
    LEASE_TIMEOUT = 15.minutes

    def self.enqueue(portfolio:, vacancy:, force: false)
      return nil unless portfolio.session.tenant_id == vacancy.tenant_id

      report = nil
      should_enqueue = false
      now = Time.current

      FitGapReport.transaction do
        report = FitGapReport.create_or_find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id) do |record|
          record.skill_comparisons = []
          record.generation_status = "queued"
          record.generation_error = nil
          record.generation_started_at = now
          record.generated_at = nil
        end
        # A local flag set in the create_or_find_by block is unsafe under a
        # unique-index race. Query the returned record's persisted history.
        should_enqueue = report.previously_new_record?

        report.with_lock do
          if should_enqueue
            # A newly inserted row is already queued.
          elsif report.generating?
            expired = report.generation_started_at.nil? || report.generation_started_at < LEASE_TIMEOUT.ago
            if expired
              report.update!(generation_status: "queued", generation_error: nil, generation_started_at: now)
              should_enqueue = true
            end
          elsif report.failed? || report.generation_status == "stale" || (force && report.complete?)
            report.update!(generation_status: "queued", generation_error: nil, generation_started_at: now)
            should_enqueue = true
          end
        end
      end

      if should_enqueue
        jid = FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        unless jid
          report.update!(generation_status: "failed", generation_error: "Unable to queue report generation", generation_started_at: nil)
          return report.reload
        end
      end

      report.reload
    rescue StandardError => e
      if report
        report.update_columns(generation_status: "failed", generation_error: "Unable to queue report generation", generation_started_at: nil)
      end
      Rails.logger.error("[N13] Report scheduling failed: #{e.class}")
      report
    end
  end
end
