# frozen_string_literal: true

require 'spec_helper'
require 'active_support/all'
require 'ostruct'
require 'json'

# Mock Rails.logger if Rails is not loaded
module Rails
  def self.logger
    @logger ||= Class.new {
      def info(*); end
      def error(*); end
      def warn(*); end
      def debug(*); end
    }.new
  end

  def self.env
    Class.new { def production?; false; end }.new
  end
end

# Load HttpClient and Engine directly
require_relative '../../../app/clients/gemini/http_client'
require_relative '../../../app/services/fit_gap/engine'

RSpec.describe FitGap::Engine do
  let(:vacancy_skill_1) do
    OpenStruct.new(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      expected_level: 3
    )
  end

  let(:vacancy_skill_2) do
    OpenStruct.new(
      skill_id: 'SK-ENG-004',
      skill_label: 'Database Design & SQL',
      expected_level: 4
    )
  end

  let(:vacancy) do
    OpenStruct.new(
      id: 1,
      role_title: 'Senior Frontend Developer',
      culture_dimensions: 'Async and ownership',
      competency_expectations: 'High rigor',
      vacancy_skills: [vacancy_skill_1, vacancy_skill_2]
    )
  end

  let(:override) do
    OpenStruct.new(
      id: 10,
      override_level: 4,
      assessor_notes: 'Demonstrated senior architectural capacity'
    )
  end

  let(:portfolio_skill_1) do
    OpenStruct.new(
      id: 101,
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      ai_level: 2,
      ai_confidence: 'high',
      assessor_override: override
    )
  end

  let(:portfolio) do
    portfolio_skills_relation = [portfolio_skill_1]
    def portfolio_skills_relation.includes(*)
      self
    end

    session = OpenStruct.new(
      id: 55,
      assessment: OpenStruct.new(name: 'Frontend Assessment')
    )

    OpenStruct.new(
      id: 42,
      session: session,
      portfolio_skills: portfolio_skills_relation
    )
  end

  let(:gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Strong culture match.',
        'overall_narrative' => 'Recommended.'
      }
    )
  end

  subject(:engine) do
    described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: gemini_client
    )
  end

  describe '#build_skill_comparisons' do
    it 'includes expected_level, candidate_level, delta, result, and is_override' do
      comparisons = engine.send(:build_skill_comparisons)

      react = comparisons.find { |c| c[:skill_id] == 'SK-ENG-001' }
      expect(react).not_to be_nil
      expect(react[:expected_level]).to eq(3)
      expect(react[:candidate_level]).to eq(4)
      expect(react[:delta]).to eq(1)
      expect(react[:result]).to eq('exceed')
      # We expect is_override to be present and true because override is present!
      expect(react[:is_override]).to eq(true)
      expect(react[:required_level]).to eq(3)

      db = comparisons.find { |c| c[:skill_id] == 'SK-ENG-004' }
      expect(db).not_to be_nil
      expect(db[:expected_level]).to eq(4)
      expect(db[:required_level]).to eq(4)
      expect(db[:candidate_level]).to be_nil
      expect(db[:result]).to eq('not_assessed')
      expect(db[:is_override]).to eq(false)
    end
  end

  describe '#generate_narratives' do
    it 'returns parsed culture and overall narratives from Gemini response' do
      comparisons = engine.send(:build_skill_comparisons)
      narratives = engine.send(:generate_narratives, comparisons)

      expect(narratives[:culture]).to eq('Strong culture match.')
      expect(narratives[:overall]).to eq('Recommended.')
    end

    context 'when Gemini client raises an error' do
      before do
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError.new('API timeout'))
      end

      it 'falls back gracefully to rule-based summary without raising' do
        comparisons = engine.send(:build_skill_comparisons)
        narratives = engine.send(:generate_narratives, comparisons)

        expect(narratives[:culture]).to be_nil
        expect(narratives[:overall]).to include('Candidate shows')
      end
    end
  end
end
