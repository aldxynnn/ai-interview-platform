# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org) do
    Organization.find_or_create_by!(scheme: 'test-org') do |o|
      o.name = 'Test Org'
      o.identifier = 'test-org'
      o.host = 'localhost'
    end
  end

  let(:assessment) do
    Assessment.create!(
      name: 'Frontend Lead',
      time_limit_min: 45,
      tenant_id: org.id,
      created_by: 1
    )
  end

  let(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: org.id,
      candidate_id: 101,
      candidate_name: 'Budi Santoso',
      invite_token: SecureRandom.hex(16),
      status: 'ended'
    )
  end

  let(:portfolio) do
    Portfolio.create!(
      session: session,
      candidate_id: 101,
      generation_status: 'complete'
    )
  end

  let(:vacancy) do
    Vacancy.create!(
      role_title: 'Senior Frontend Developer',
      tenant_id: org.id,
      created_by: 1
    )
  end

  let!(:vacancy_skill_1) do
    vacancy.vacancy_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      expected_level: 3
    )
  end

  let!(:vacancy_skill_2) do
    vacancy.vacancy_skills.create!(
      skill_id: 'SK-ENG-004',
      skill_label: 'Database Design & SQL',
      expected_level: 4
    )
  end

  let!(:portfolio_skill_1) do
    portfolio.portfolio_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      is_discovered: false,
      ai_level: 2,
      ai_confidence: 'high',
      evidence: ['Demonstrated React component lifecycle'],
      competency_summary: 'Understands basic React patterns'
    )
  end

  let(:fake_gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Strong cultural alignment with autonomy.',
        'overall_narrative' => 'Recommended for technical review.'
      }
    )
  end

  subject(:engine) do
    described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: fake_gemini_client
    )
  end

  describe '#call' do
    context 'without human override' do
      it 'computes comparison with expected_level, delta, candidate_level, and is_override: false' do
        report = engine.call

        react_comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }
        expect(react_comparison).to be_present
        expect(react_comparison['candidate_level']).to eq(2)
        expect(react_comparison['expected_level']).to eq(3)
        expect(react_comparison['delta']).to eq(-1)
        expect(react_comparison['result']).to eq('gap')
        # Expect is_override to be present and false
        expect(react_comparison['is_override']).to eq(false)

        db_comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-004' }
        expect(db_comparison).to be_present
        expect(db_comparison['candidate_level']).to be_nil
        expect(db_comparison['expected_level']).to eq(4)
        expect(db_comparison['result']).to eq('not_assessed')
        expect(db_comparison['is_override']).to eq(false)
      end
    end

    context 'with assessor human override applied' do
      before do
        portfolio_skill_1.create_assessor_override!(
          ai_level: 2,
          override_level: 4,
          assessor_notes: 'Candidate showed advanced architectural knowledge during system design discussion.',
          overridden_by: 1
        )
      end

      it 'uses the override level as candidate_level, recalculates delta to exceed, and marks is_override: true' do
        report = engine.call

        react_comparison = report.skill_comparisons.find { |c| c['skill_id'] == 'SK-ENG-001' }
        expect(react_comparison).to be_present
        expect(react_comparison['candidate_level']).to eq(4)
        expect(react_comparison['expected_level']).to eq(3)
        expect(react_comparison['delta']).to eq(1)
        expect(react_comparison['result']).to eq('exceed')
        expect(react_comparison['is_override']).to eq(true)
      end
    end

    context 'when gemini client raises an error' do
      let(:fake_gemini_client) do
        client = instance_double(Gemini::HttpClient)
        allow(client).to receive(:generate_content).and_raise(StandardError.new('Gemini API 503 Unavailable'))
        client
      end

      it 'gracefully falls back without raising an exception' do
        report = nil
        expect { report = engine.call }.not_to raise_error
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to include('Candidate shows')
      end
    end
  end
end
