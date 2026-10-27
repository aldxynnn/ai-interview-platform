# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let!(:skill_1)     { create(:assessment_skill, assessment: assessment, skill_label: 'Database Design', display_order: 1) }
  let!(:skill_2)     { create(:assessment_skill, assessment: assessment, skill_label: 'API Architecture', display_order: 2) }
  let(:session)      { create(:session, assessment: assessment, tenant_id: organization.id, status: 'pending') }

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
    # Mock Redis publishing to isolate unit test
    allow(Sidekiq).to receive(:redis).and_yield(double(publish: true))
  end

  describe '#call' do
    it 'activates a pending session and initializes coverage maps' do
      handler = described_class.new(session)
      result = handler.call

      expect(result.status).to eq('active')
      expect(result.started_at).to be_present

      coverage_skills = session.coverage_maps.pluck(:skill_label)
      expect(coverage_skills).to contain_exactly('Database Design', 'API Architecture')
      expect(session.coverage_maps.pluck(:state).uniq).to eq(['not_yet'])
    end

    it 'is idempotent if session is already active' do
      session.update!(status: 'active', started_at: 10.minutes.ago)
      original_time = session.started_at

      handler = described_class.new(session)
      result = handler.call

      expect(result.started_at.to_i).to eq(original_time.to_i)
    end

    it 'hard guards against re-activating ended sessions' do
      session.update!(status: 'ended', end_reason: 'manual_assessor', ended_at: Time.current)

      handler = described_class.new(session)
      result = handler.call

      expect(result.status).to eq('ended')
      expect(session.reload.status).to eq('ended')
    end

    it 'hard guards against re-activating failed sessions' do
      session.update!(status: 'failed')

      handler = described_class.new(session)
      result = handler.call

      expect(result.status).to eq('failed')
      expect(session.reload.status).to eq('failed')
    end
  end
end
