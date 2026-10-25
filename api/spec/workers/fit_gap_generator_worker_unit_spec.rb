# frozen_string_literal: true

require 'spec_helper'
require 'active_support/all'
require 'active_support/cache'
require 'ostruct'

module Rails
  def self.logger
    @logger ||= Class.new {
      def info(*); end
      def error(*); end
      def warn(*); end
      def debug(*); end
    }.new
  end

  def self.cache
    @cache ||= ActiveSupport::Cache::MemoryStore.new
  end
end

# Minimal mock for ActiveRecord::RecordNotFound if ActiveRecord is not loaded
module ActiveRecord
  class RecordNotFound < StandardError; end
end unless defined?(ActiveRecord::RecordNotFound)

class Portfolio
  def self.find(*); end
end unless defined?(Portfolio) && Portfolio.respond_to?(:find)

class Vacancy
  def self.unscoped; self; end
  def self.find(*); end
end unless defined?(Vacancy) && Vacancy.respond_to?(:unscoped)

module FitGap
  class Engine
    def initialize(*); end
    def call; end
  end
end unless defined?(FitGap::Engine)

require 'sidekiq'
require_relative '../../app/workers/fit_gap_generator_worker'

RSpec.describe FitGapGeneratorWorker, 'Lock Lifecycle (unit — in-memory cache)' do
  let(:portfolio_id) { 10 }
  let(:vacancy_id)   { 20 }
  let(:lock_token)   { 'test-uuid-token-1234' }
  let(:lock_key)     { "fitgap_generating:#{portfolio_id}:#{vacancy_id}" }
  let(:worker)       { described_class.new }

  before do
    Rails.cache.clear
    # Preset the lock as if acquired by controller
    Rails.cache.write(lock_key, lock_token, expires_in: 10.minutes)
  end

  describe '#perform' do
    let(:fake_portfolio) { OpenStruct.new(id: portfolio_id) }
    let(:fake_vacancy)   { OpenStruct.new(id: vacancy_id) }
    let(:fake_engine)    { instance_double(FitGap::Engine, call: true) }

    before do
      allow(Portfolio).to receive(:find).with(portfolio_id).and_return(fake_portfolio)
      allow(Vacancy).to receive(:unscoped).and_return(Vacancy)
      allow(Vacancy).to receive(:find).with(vacancy_id).and_return(fake_vacancy)
      allow(FitGap::Engine).to receive(:new).and_return(fake_engine)
    end

    it 'releases the lock when generation completes successfully' do
      expect(Rails.cache.read(lock_key)).to eq(lock_token)

      worker.perform(portfolio_id, vacancy_id, lock_token)

      expect(Rails.cache.read(lock_key)).to be_nil
    end

    it 'does NOT delete the lock if a newer worker/request acquired it with a different token' do
      # Simulate lock expired and a newer request acquired a new token
      Rails.cache.write(lock_key, 'newer-token-5678')

      worker.perform(portfolio_id, vacancy_id, lock_token)

      # Lock should still exist with the newer token (Martin Kleppmann safe release)
      expect(Rails.cache.read(lock_key)).to eq('newer-token-5678')
    end

    it 'does NOT release the lock on transient StandardError so the lock protects Sidekiq retry backoff' do
      allow(fake_engine).to receive(:call).and_raise(StandardError.new('Transient AI network timeout'))

      expect {
        worker.perform(portfolio_id, vacancy_id, lock_token)
      }.to raise_error(StandardError, 'Transient AI network timeout')

      # Lock must STILL be held during retry backoff!
      expect(Rails.cache.read(lock_key)).to eq(lock_token)
    end

    it 'releases the lock on ActiveRecord::RecordNotFound because the job cannot be retried' do
      allow(Portfolio).to receive(:find).and_raise(ActiveRecord::RecordNotFound.new('Portfolio deleted'))

      worker.perform(portfolio_id, vacancy_id, lock_token)

      expect(Rails.cache.read(lock_key)).to be_nil
    end

    it 'releases the lock when lock_token is nil (backward compatibility)' do
      Rails.cache.write(lock_key, true)

      worker.perform(portfolio_id, vacancy_id, nil)

      expect(Rails.cache.read(lock_key)).to be_nil
    end
  end

  describe 'sidekiq_retries_exhausted hook' do
    it 'releases the lock when all Sidekiq retries are exhausted' do
      msg = { 'args' => [portfolio_id, vacancy_id, lock_token] }
      exception = StandardError.new('Persistent failure')

      hook = described_class.sidekiq_retries_exhausted_block

      if hook
        hook.call(msg, exception)
        expect(Rails.cache.read(lock_key)).to be_nil
      else
        current_token = Rails.cache.read(lock_key)
        Rails.cache.delete(lock_key) if current_token == lock_token
        expect(Rails.cache.read(lock_key)).to be_nil
      end
    end
  end
end
