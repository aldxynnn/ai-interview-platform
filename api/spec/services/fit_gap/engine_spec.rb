# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: double) }

  let(:portfolio) { double(:portfolio, id: 7) }
  let(:vacancy) { double(:vacancy, id: 9, vacancy_skills: [required_skill]) }
  let(:required_skill) { double(:vacancy_skill, skill_label: 'Ruby', skill_id: 1, expected_level: 3) }
  let(:portfolio_skill) do
    double(:portfolio_skill, skill_id: 1, skill_label: 'Ruby', ai_level: 'L4',
           ai_confidence: 'high', assessor_override: override)
  end
  let(:override) { nil }

  before do
    relation = double(:portfolio_skills_relation)
    allow(portfolio).to receive(:portfolio_skills).and_return(relation)
    allow(relation).to receive(:includes).with(:assessor_override).and_return([portfolio_skill])
  end

  describe '#normalize_level' do
    it 'normalizes AI labels and integer overrides' do
      expect(engine.send(:normalize_level, 'L4')).to eq(4)
      expect(engine.send(:normalize_level, 2)).to eq(2)
      expect(engine.send(:normalize_level, 'l5')).to eq(5)
    end

    it 'rejects missing, malformed, and out-of-range values' do
      [nil, '', 'L9', 0, 6, 'level 3', 3.5].each do |value|
        expect(engine.send(:normalize_level, value)).to be_nil
      end
    end
  end

  describe '#build_skill_comparisons' do
    it 'compares a string AI level with the required numeric level' do
      comparison = engine.send(:build_skill_comparisons).first
      expect(comparison).to include(candidate_level: 4, expected_level: 3, delta: 1, result: 'exceed')
    end

    context 'when a human override exists' do
      let(:override) { double(:override, override_level: 2, present?: true) }

      it 'uses the override and marks its provenance' do
        comparison = engine.send(:build_skill_comparisons).first
        expect(comparison).to include(candidate_level: 2, delta: -1, result: 'gap', is_override: true)
      end
    end

    context 'when candidate level is invalid' do
      let(:portfolio_skill) do
        double(:portfolio_skill, skill_id: 1, skill_label: 'Ruby', ai_level: 'unknown',
               ai_confidence: 'low', assessor_override: nil)
      end

      it 'marks the skill not assessed rather than inventing a gap' do
        comparison = engine.send(:build_skill_comparisons).first
        expect(comparison).to include(candidate_level: nil, delta: nil, result: 'not_assessed')
      end
    end
  end
end
