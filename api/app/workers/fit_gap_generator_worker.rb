# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  sidekiq_retries_exhausted do |message, _exception|
    portfolio_id, vacancy_id, generation_version = message.fetch("args")
    if generation_version
      FitGapReport.where(
        portfolio_id: portfolio_id,
        vacancy_id: vacancy_id,
        generation_version: generation_version,
        generation_status: "generating"
      ).update_all(
        generation_status: "failed",
        generation_error: "Report generation failed after retries. The previous report, if any, remains available.",
        updated_at: Time.current
      )
    end
    Rails.logger.warn("[N13] Fit/gap job exhausted retries")
  end

  def perform(portfolio_id, vacancy_id, generation_version = nil)
    portfolio = Portfolio.joins(:session).find_by(id: portfolio_id)
    vacancy = Vacancy.unscoped.find_by(id: vacancy_id)
    unless portfolio && vacancy
      Rails.logger.warn("[N13] Fit/gap generation skipped because a source record is missing")
      return
    end

    unless portfolio.session.tenant_id == vacancy.tenant_id
      Rails.logger.warn("[N13] Fit/gap generation skipped because tenant ownership did not match")
      return
    end

    report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
    if generation_version && (!report || report.generation_version != generation_version || report.generation_status != "generating")
      Rails.logger.info("[N13] Stale fit/gap job skipped")
      return
    end

    FitGap::Engine.new(
      portfolio: portfolio,
      vacancy: vacancy,
      report: report,
      generation_version: generation_version
    ).call
  rescue StandardError => e
    Rails.logger.error("[N13] Fit/gap generation failed error_class=#{e.class.name}")
    raise
  end
end
