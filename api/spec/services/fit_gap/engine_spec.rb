# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let!(:org) { create_test_org(id: 1, scheme: 'test-corp') }
  let(:assessment) { create_assessment_with_skills(tenant_id: 1) }
  let(:vacancy) { create_vacancy_with_skills(tenant_id: 1) }
  let(:portfolio_data) { create_completed_portfolio(assessment) }
  let(:portfolio) { portfolio_data[:portfolio] }
  let(:mock_gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(mock_gemini).to receive(:generate_content).and_return({
      'culture_narrative' => 'Strong culture match with proactive mindset.',
      'overall_narrative' => 'Recommended for technical round.'
    })
  end

  describe '#call' do
    it 'produces a harmonized comparison payload with required_level and expected_level' do
      engine = described_service = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini
      )

      report = engine.call
      expect(report).to be_persisted

      comparisons = report.skill_comparisons
      react_comparison = comparisons.find { |c| c['skill_label'] == 'React / Frontend Development Core' }

      expect(react_comparison).not_to be_nil
      expect(react_comparison['expected_level']).to eq(3)
      expect(react_comparison['required_level']).to eq(3)
      expect(react_comparison['candidate_level']).to eq(2)
      expect(react_comparison['result']).to eq('gap')
      expect(react_comparison['delta']).to eq(-1)
      expect(react_comparison['is_override']).to be(false)
    end

    it 'correctly marks unassessed vacancy skills without penalizing the candidate' do
      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini
      )

      report = engine.call
      comparisons = report.skill_comparisons
      node_comparison = comparisons.find { |c| c['skill_label'] == 'Node.js / Backend Development' }

      expect(node_comparison).not_to be_nil
      expect(node_comparison['required_level']).to eq(4)
      expect(node_comparison['expected_level']).to eq(4)
      expect(node_comparison['candidate_level']).to be_nil
      expect(node_comparison['delta']).to be_nil
      expect(node_comparison['result']).to eq('not_assessed')
      expect(node_comparison['is_override']).to be(false)
    end

    it 'reflects human assessor overrides and recalculates delta accordingly' do
      skill = portfolio_data[:skill]
      skill.create_assessor_override!(
        ai_level: 2,
        override_level: 4,
        assessor_notes: 'Demonstrated advanced SSR patterns in discussion',
        overridden_by: 1
      )

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini
      )

      report = engine.call
      react_comparison = report.skill_comparisons.find { |c| c['skill_label'] == 'React / Frontend Development Core' }

      expect(react_comparison['candidate_level']).to eq(4)
      expect(react_comparison['required_level']).to eq(3)
      expect(react_comparison['delta']).to eq(1)
      expect(react_comparison['result']).to eq('exceed')
      expect(react_comparison['is_override']).to be(true)
      expect(react_comparison['ai_level']).to eq(2)
      expect(react_comparison['assessor_notes']).to eq('Demonstrated advanced SSR patterns in discussion')
    end

    it 'generates a deterministic fallback narrative when Gemini client fails' do
      allow(mock_gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError.new('Rate limited', status: 429))

      engine = described_class.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: mock_gemini
      )

      report = engine.call
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to include('gap')
      expect(report.overall_narrative).to include('unassessed')
    end
  end
end
