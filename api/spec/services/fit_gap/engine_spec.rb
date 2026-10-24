# frozen_string_literal: true

require 'spec_helper'

RSpec.describe FitGap::Engine do
  def build_requirement(label:, id: nil, expected_level: 3)
    double('VacancySkill', skill_label: label, skill_id: id, expected_level: expected_level)
  end

  def build_assessed_skill(label:, id: nil, level:, confidence: 'high', overridden: false)
    {
      skill_label: label,
      skill_id: id,
      effective_level: level,
      confidence: confidence,
      overridden: overridden
    }
  end

  def comparisons(requirements, assessed_skills)
    engine = described_class.allocate
    engine.instance_variable_set(:@vacancy, double(vacancy_skills: requirements))
    allow(engine).to receive(:effective_portfolio_skills).and_return(assessed_skills)
    engine.send(:build_skill_comparisons)
  end

  describe '#build_skill_comparisons' do
    it 'distinguishes match, gap, exceed, and not assessed' do
      requirements = [
        build_requirement(label: 'Ruby', id: 'ruby', expected_level: 3),
        build_requirement(label: 'Rails', id: 'rails', expected_level: 4),
        build_requirement(label: 'SQL', id: 'sql', expected_level: 2),
        build_requirement(label: 'Go', id: 'go', expected_level: 2)
      ]
      skills = [
        build_assessed_skill(label: 'Ruby', id: 'ruby', level: 3),
        build_assessed_skill(label: 'Rails', id: 'rails', level: 2),
        build_assessed_skill(label: 'SQL', id: 'sql', level: 5)
      ]

      result = comparisons(requirements, skills)

      expect(result.map { |item| item[:result] }).to eq(%w[match gap exceed not_assessed])
      expect(result.last).to include(candidate_level: nil, delta: nil)
    end

    it 'matches labels case-insensitively after trimming when an ID is unavailable' do
      result = comparisons(
        [build_requirement(label: '  Ruby On Rails  ', expected_level: 3)],
        [build_assessed_skill(label: 'ruby on rails', level: 3)]
      )

      expect(result.first[:result]).to eq('match')
    end

    it 'does not classify missing or invalid levels as a skill match or gap' do
      requirements = [
        build_requirement(label: 'Missing level', id: 'a', expected_level: 3),
        build_requirement(label: 'String level', id: 'b', expected_level: 3),
        build_requirement(label: 'Invalid requirement', id: 'c', expected_level: '3')
      ]
      skills = [
        build_assessed_skill(label: 'Missing level', id: 'a', level: nil),
        build_assessed_skill(label: 'String level', id: 'b', level: '4'),
        build_assessed_skill(label: 'Invalid requirement', id: 'c', level: 4)
      ]

      result = comparisons(requirements, skills)

      expect(result.map { |item| item[:result] }).to all(eq('not_assessed'))
      expect(result.map { |item| item[:candidate_level] }).to all(be_nil)
      expect(result.map { |item| item[:delta] }).to all(be_nil)
    end

    it 'uses the effective assessor override level and marks it in the result' do
      result = comparisons(
        [build_requirement(label: 'Ruby', id: 'ruby', expected_level: 3)],
        [build_assessed_skill(label: 'Ruby', id: 'ruby', level: 4, overridden: true)]
      )

      expect(result.first).to include(candidate_level: 4, result: 'exceed', is_override: true)
    end
  end

  describe '#generate_narratives' do
    let(:engine) { described_class.allocate }

    before do
      engine.instance_variable_set(
        :@vacancy,
        double(role_title: 'Engineer', culture_dimensions: nil, competency_expectations: nil)
      )
      allow(engine).to receive(:build_narrative_prompt).and_return('prompt')
    end

    it 'uses deterministic fallback text when valid JSON contains blank fields' do
      engine.instance_variable_set(
        :@gemini_client,
        double(generate_content: { 'culture_narrative' => ' ', 'overall_narrative' => nil })
      )

      result = engine.send(:generate_narratives, [{ result: 'not_assessed' }, { result: 'gap' }])

      expect(result[:culture]).to include('not been assessed')
      expect(result[:overall]).to include('1 not assessed')
      expect(result[:overall]).to include('1 gap')
    end

    it 'falls back when the AI response is malformed JSON' do
      engine.instance_variable_set(:@gemini_client, double(generate_content: 'not-json'))

      result = engine.send(:generate_narratives, [{ result: 'not_assessed' }])

      expect(result[:culture]).to include('not been assessed')
      expect(result[:overall]).to include('1 not assessed')
    end

    it 'does not log an exception message that could contain candidate information' do
      engine.instance_variable_set(
        :@gemini_client,
        double.tap do |client|
          allow(client).to receive(:generate_content).and_raise(StandardError, 'sensitive candidate text')
        end
      )
      logger = double
      allow(logger).to receive(:error)
      allow(Rails).to receive(:logger).and_return(logger)

      engine.send(:generate_narratives, [{ result: 'match' }])

      expect(logger).to have_received(:error).with('[N13] Narrative generation failed (StandardError)')
      expect(logger).not_to have_received(:error).with(include('sensitive candidate text'))
    end
  end
end
