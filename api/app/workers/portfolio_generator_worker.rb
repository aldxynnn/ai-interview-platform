# frozen_string_literal: true

class PortfolioGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :portfolio, retry: 3

  sidekiq_retries_exhausted do |message, _exception|
    session_id = message["args"].first
    session = Session.find_by(id: session_id)
    session&.portfolio&.update(
      generation_status: "failed",
      generation_error: "Portfolio generation failed after retry attempts. Please retry."
    )
    Rails.logger.error("[N10] Portfolio generation exhausted retries")
  end

  def perform(session_id)
    session = Session.find(session_id)
    Portfolios::Generator.new(session: session).call
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N10] Portfolio job skipped because the session was unavailable")
  end
end
