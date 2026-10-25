# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  # Sidekiq hook triggered when all retries are exhausted (job fails terminally)
  sidekiq_retries_exhausted do |msg, exception|
    portfolio_id = msg['args'][0]
    vacancy_id   = msg['args'][1]
    lock_token   = msg['args'][2]
    lock_key     = "fitgap_generating:#{portfolio_id}:#{vacancy_id}"

    if lock_token
      current_token = Rails.cache.read(lock_key)
      Rails.cache.delete(lock_key) if current_token == lock_token
    else
      Rails.cache.delete(lock_key)
    end

    Rails.logger.error("[N13] FitGapGeneratorWorker retries exhausted for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{exception.message}")
  end

  def perform(portfolio_id, vacancy_id, lock_token = nil)
    portfolio = Portfolio.find(portfolio_id)
    vacancy   = Vacancy.unscoped.find(vacancy_id)

    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).call

    # Success: release lock only if it still belongs to this worker's token
    release_lock(portfolio_id, vacancy_id, lock_token)
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn("[N13] Record not found: #{e.message}")
    # Terminal error: records don't exist, will never succeed, release lock
    release_lock(portfolio_id, vacancy_id, lock_token)
  rescue StandardError => e
    Rails.logger.error("[N13] FitGapGeneratorWorker failed for portfolio=#{portfolio_id} vacancy=#{vacancy_id}: #{e.class}: #{e.message}")
    # IMPORTANT: Do NOT release lock here!
    # Sidekiq will retry this job (up to retry: 2). The lock must remain active
    # during the retry backoff so polling / duplicate user clicks do NOT enqueue
    # concurrent duplicate workers.
    # If all retries fail, sidekiq_retries_exhausted will release the lock.
    raise
  end

  private

  def release_lock(portfolio_id, vacancy_id, lock_token = nil)
    lock_key = "fitgap_generating:#{portfolio_id}:#{vacancy_id}"
    if lock_token
      current_token = Rails.cache.read(lock_key)
      # Safe release: only delete if the lock still belongs to this worker/request
      Rails.cache.delete(lock_key) if current_token == lock_token
    else
      Rails.cache.delete(lock_key)
    end
  end
end
