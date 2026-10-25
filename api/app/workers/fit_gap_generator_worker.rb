# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |message, _exception|
    portfolio_id, vacancy_id = message["args"]
    report = FitGapReport.find_by(portfolio_id: portfolio_id, vacancy_id: vacancy_id)
    report&.update(generation_status: "failed",
                   generation_error: "Report generation failed after retry attempts",
                   generation_started_at: nil)
    Rails.logger.error("[N13] Fit/gap generation exhausted retries")
  end

  def perform(portfolio_id, vacancy_id)
    report = nil
    claim_time = nil
    portfolio = Portfolio.find(portfolio_id)
    vacancy = Vacancy.unscoped.find(vacancy_id)
    report = FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)

    unless portfolio.session.tenant_id == vacancy.tenant_id
      report.update!(generation_status: "failed", generation_error: "Report generation failed", generation_started_at: nil)
      Rails.logger.warn("[N13] Refused cross-tenant report generation")
      return
    end

    claimed = false
    report.with_lock do
      if report.generation_status == "queued"
        claim_time = Time.current
        report.update!(generation_status: "generating", generation_error: nil, generation_started_at: claim_time)
        claimed = true
      end
    end
    return unless claimed

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, generation_started_at: claim_time).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] Fit/gap job skipped because an input record was unavailable")
  rescue StandardError => e
    report&.reload
    if report&.generation_status == "generating" && report.generation_started_at == claim_time
      report.update!(generation_status: "queued", generation_error: nil, generation_started_at: Time.current)
    end
    Rails.logger.error("[N13] Fit/gap generation failed: #{e.class}")
    raise
  end
end
