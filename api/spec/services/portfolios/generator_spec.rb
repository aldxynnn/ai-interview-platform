# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, assessment: assessment, tenant_id: organization.id) }
  let(:mock_gemini)  { instance_double(Gemini::HttpClient) }

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  describe '#call' do
    let(:valid_gemini_json) do
      {
        'configured_skills' => [
          {
            'skill_id' => 'sk-eng-001',
            'skill_label' => 'Ruby Architecture',
            'level' => 4,
            'confidence' => 'HIGH', # case-insensitive normalization
            'evidence' => ['Explained multi-tenant schema isolation using Postgres schemas'],
            'competency_summary' => 'Deep architectural knowledge with production hardening experience.'
          }
        ],
        'discovered_skills' => [
          {
            'skill_label' => 'Kafka Streaming',
            'level' => 3,
            'confidence' => 'medium',
            'evidence' => ['Configured consumer groups for event stream processing'],
            'competency_summary' => 'Solid understanding of offset management and consumer partitions.'
          }
        ]
      }.to_json
    end

    it 'successfully creates portfolio and populates configured and discovered skills' do
      allow(mock_gemini).to receive(:generate_content).and_return(valid_gemini_json)

      generator = described_class.new(session: session, gemini_client: mock_gemini)
      portfolio = generator.call

      expect(portfolio).to be_persisted
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(2)

      conf_skill = portfolio.portfolio_skills.find_by(is_discovered: false)
      expect(conf_skill.skill_label).to eq('Ruby Architecture')
      expect(conf_skill.ai_level).to eq(4)
      expect(conf_skill.ai_confidence).to eq('high')
      expect(conf_skill.evidence).to include(/multi-tenant schema isolation/)

      disc_skill = portfolio.portfolio_skills.find_by(is_discovered: true)
      expect(disc_skill.skill_label).to eq('Kafka Streaming')
      expect(disc_skill.ai_level).to eq(3)
      expect(disc_skill.ai_confidence).to eq('medium')
    end

    it 'cleans markdown code fences and safely falls back on unknown confidence and invalid level' do
      fenced_payload = <<~JSON
        ```json
        {
          "configured_skills": [
            {
              "skill_label": "System Design",
              "level": 99,
              "confidence": "INVALID_CONFIDENCE",
              "evidence": ["Drew microservices topology"],
              "competency_summary": "Extensive architectural experience"
            }
          ]
        }
        ```
      JSON

      allow(mock_gemini).to receive(:generate_content).and_return(fenced_payload)

      generator = described_class.new(session: session, gemini_client: mock_gemini)
      portfolio = generator.call

      skill = portfolio.portfolio_skills.first
      expect(skill.skill_label).to eq('System Design')
      # Level 99 should be safely clamped to 1
      expect(skill.ai_level).to eq(1)
      # Invalid confidence should safely default to conservative 'low'
      expect(skill.ai_confidence).to eq('low')
    end

    it 'marks generation_status as failed when Gemini raises an exception' do
      allow(mock_gemini).to receive(:generate_content).and_raise(Net::ReadTimeout.new('Model timeout'))

      generator = described_class.new(session: session, gemini_client: mock_gemini)

      expect {
        generator.call
      }.to raise_error(Net::ReadTimeout)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to include('Model timeout')
    end
  end
end
