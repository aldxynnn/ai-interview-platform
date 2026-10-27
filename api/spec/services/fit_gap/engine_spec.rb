# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, assessment: assessment, tenant_id: organization.id) }
  let(:portfolio)    { create(:portfolio, session: session) }
  let(:vacancy)      { create(:vacancy, tenant_id: organization.id) }

  let(:mock_gemini)  { instance_double(Gemini::HttpClient) }

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  describe '#call' do
    let!(:skill_ruby) { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby', ai_level: 3) }
    let!(:skill_sys)  { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Architecture', ai_level: 2) }
    let!(:skill_db)   { create(:portfolio_skill, portfolio: portfolio, skill_label: 'PostgreSQL', ai_level: 4) }

    let!(:v_skill_ruby) { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Ruby', expected_level: 3) }
    let!(:v_skill_sys)  { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Architecture', expected_level: 4) }
    let!(:v_skill_db)   { create(:vacancy_skill, vacancy: vacancy, skill_label: 'PostgreSQL', expected_level: 2) }
    let!(:v_skill_k8s)  { create(:vacancy_skill, vacancy: vacancy, skill_label: 'Kubernetes', expected_level: 3) }

    it 'computes match, gap, exceed, and not_assessed accurately' do
      ai_response = {
        'culture' => 'Strong match for collaborative engineering culture.',
        'overall' => 'Well-rounded backend candidate with deep database knowledge.'
      }.to_json

      allow(mock_gemini).to receive(:generate_content).and_return(ai_response)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      comparisons = report.skill_comparisons

      ruby_comp = comparisons.find { |c| c['skill_label'] == 'Ruby' }
      expect(ruby_comp['result']).to eq('match')
      expect(ruby_comp['delta']).to eq(0)
      expect(ruby_comp['is_override']).to be false

      sys_comp = comparisons.find { |c| c['skill_label'] == 'Architecture' }
      expect(sys_comp['result']).to eq('gap')
      expect(sys_comp['delta']).to eq(-2)
      expect(sys_comp['candidate_level']).to eq(2)
      expect(sys_comp['required_level']).to eq(4)

      db_comp = comparisons.find { |c| c['skill_label'] == 'PostgreSQL' }
      expect(db_comp['result']).to eq('exceed')
      expect(db_comp['delta']).to eq(2)

      k8s_comp = comparisons.find { |c| c['skill_label'] == 'Kubernetes' }
      expect(k8s_comp['result']).to eq('not_assessed')
      expect(k8s_comp['candidate_level']).to be_nil

      expect(report.culture_narrative).to eq('Strong match for collaborative engineering culture.')
      expect(report.overall_narrative).to eq('Well-rounded backend candidate with deep database knowledge.')
    end

    it 'applies assessor overrides over AI level' do
      create(
        :assessor_override,
        portfolio_skill: skill_sys,
        override_level: 4,
        assessor_notes: 'Demonstrated extensive high-throughput system design experience.'
      )

      allow(mock_gemini).to receive(:generate_content).and_return({
        'culture' => 'Culturally sound.',
        'overall' => 'Solid candidate.'
      }.to_json)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call
      comparisons = report.skill_comparisons

      sys_comp = comparisons.find { |c| c['skill_label'] == 'Architecture' }
      expect(sys_comp['candidate_level']).to eq(4)
      expect(sys_comp['result']).to eq('match') # Was gap before override!
      expect(sys_comp['delta']).to eq(0)
      expect(sys_comp['is_override']).to be true
      expect(sys_comp['assessor_notes']).to include('high-throughput system design')
    end

    it 'gracefully falls back to structured narrative if Gemini returns markdown fences or malformed JSON' do
      fenced_response = <<~RESPONSE
        ```json
        {
          "culture": "Fenced culture analysis",
          "overall": "Fenced overall evaluation"
        }
        ```
      RESPONSE

      allow(mock_gemini).to receive(:generate_content).and_return(fenced_response)

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report.culture_narrative).to eq('Fenced culture analysis')
      expect(report.overall_narrative).to eq('Fenced overall evaluation')
    end

    it 'generates safe deterministic fallback narrative when Gemini client raises error' do
      allow(mock_gemini).to receive(:generate_content).and_raise(StandardError.new('Gemini timeout'))

      engine = described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: mock_gemini)
      report = engine.call

      expect(report).to be_persisted
      expect(report.culture_narrative).to include('Automated culture narrative unavailable')
      expect(report.overall_narrative).to include('Candidate matches')
    end
  end
end
