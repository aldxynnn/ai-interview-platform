# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(report_id, generation_version)
    report = FitGapReport.find_by(id: report_id)
    return unless report

    # Duplicate jobs with the same version become no-ops once another worker
    # owns the report or has completed it. A stale lease gets a new fencing version.
    claimed_version = report.claim_execution!(generation_version: generation_version)
    return unless claimed_version

    portfolio = Portfolio.find(report.portfolio_id)
    vacancy = Vacancy.unscoped.find(report.vacancy_id)

    unless portfolio.session.tenant_id == vacancy.tenant_id
      raise ArgumentError, "Portfolio and vacancy must belong to the same tenant"
    end

    FitGap::Engine.new(
      portfolio: portfolio,
      vacancy: vacancy,
      report: report,
      generation_version: claimed_version
    ).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] FitGapGeneratorWorker record not found")
  rescue StandardError => e
    report&.mark_generation_failed!(generation_version: claimed_version || generation_version, exception_class: e.class.name)
    Rails.logger.error(
      "[N13] FitGapGeneratorWorker failed for report=#{report_id} "       "version=#{generation_version} error_class=#{e.class.name}"
    )
    raise
  end
end
