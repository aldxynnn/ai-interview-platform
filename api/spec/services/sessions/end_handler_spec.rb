# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session) do
    create(
      :session,
      assessment: assessment,
      tenant_id: organization.id,
      status: 'active',
      started_at: 20.minutes.ago
    )
  end

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
    allow(Sidekiq).to receive(:redis).and_yield(double(publish: true))
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  describe '#call' do
    it 'terminates the session, calculates duration, creates portfolio, and enqueues generation' do
      handler = described_class.new(session)
      result = handler.call(reason: 'all_covered')

      expect(result.status).to eq('ended')
      expect(result.end_reason).to eq('all_covered')
      expect(result.ended_at).to be_present
      expect(result.duration_seconds).to be >= 1190

      portfolio = session.portfolio
      expect(portfolio).to be_present
      expect(portfolio.generation_status).to eq('pending')

      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end

    it 'normalizes unknown reasons to manual_assessor' do
      handler = described_class.new(session)
      result = handler.call(reason: 'unexpected_random_reason')

      expect(result.status).to eq('ended')
      expect(result.end_reason).to eq('manual_assessor')
    end

    it 'allows upgrading error end_reason to clean manual termination' do
      session.update!(status: 'ended', end_reason: 'error', ended_at: Time.current)

      handler = described_class.new(session)
      handler.call(reason: 'manual_candidate')

      expect(session.reload.end_reason).to eq('manual_candidate')
    end
  end
end
