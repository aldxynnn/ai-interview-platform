# frozen_string_literal: true

module FitGap
  # The database report row suppresses duplicate enqueues. A lease timestamp
  # allows recovery if a Sidekiq worker is killed after claiming the report.
  class ReportScheduler
    LEASE_TIMEOUT = 15.minutes

    def self.enqueue(portfolio:, vacancy:, force: false)
      report = nil
      should_enqueue = false
      now = Time.current

      FitGapReport.transaction do
        report = FitGapReport.create_or_find_by!(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id
        ) do |record|
          record.skill_comparisons = []
          record.generation_status = "queued"
          record.generation_error = nil
          record.generation_started_at = now
          record.generated_at = nil
        end

        # Do not set a local flag inside the create_or_find_by block: Rails can
        # execute that block before a unique-index conflict resolves to an
        # existing row. previously_new_record? distinguishes the row that this
        # call actually inserted from a concurrent request's existing row.
        should_enqueue = report.previously_new_record?

        report.with_lock do
          if should_enqueue
            # The row was inserted by this call; its initial status is queued.
          elsif report.generating?
            lease_expired = report.generation_started_at.nil? || report.generation_started_at < LEASE_TIMEOUT.ago
            if lease_expired
              report.update!(
                generation_status: "queued",
                generation_error: nil,
                generation_started_at: now
              )
              should_enqueue = true
            end
          elsif report.failed? || report.generation_status == "stale" || (force && report.complete?)
            report.update!(
              generation_status: "queued",
              generation_error: nil,
              generation_started_at: now,
              generated_at: nil
            )
            should_enqueue = true
          end
        end
      end

      if should_enqueue
        jid = FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id)
        unless jid
          report.update!(
            generation_status: "failed",
            generation_error: "Unable to queue report generation",
            generation_started_at: nil
          )
          return report.reload
        end
      end

      report.reload
    rescue StandardError => e
      if report
        report.update_columns(
          generation_status: "failed",
          generation_error: "Unable to queue report generation",
          generation_started_at: nil
        )
      end
      Rails.logger.error("[N13] Report scheduling failed: #{e.class}")
      report
    end
  end
end
