# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  def build_comparison(candidate_level:, expected_level:, candidate_skill_id: "skill_js",
                       vacancy_skill_id: "skill_js", candidate_label: "JavaScript",
                       vacancy_label: "JavaScript", confidence: "high", override_level: nil)
    required_skill = double(
      "VacancySkill",
      id: 1,
      skill_label: vacancy_label,
      skill_id: vacancy_skill_id,
      expected_level: expected_level
    )
    required_scope = double("VacancySkillRelation")
    allow(required_scope).to receive(:order).with(:id).and_return([required_skill])
    vacancy = double("Vacancy", vacancy_skills: required_scope)

    assessed_skills = []
    if candidate_level
      override = override_level ? double("AssessorOverride", override_level: override_level) : nil
      assessed_skills << double(
        "PortfolioSkill",
        id: 10,
        skill_id: candidate_skill_id,
        skill_label: candidate_label,
        ai_level: candidate_level,
        ai_confidence: confidence,
        assessor_override: override
      )
    end
    assessed_scope = double("PortfolioSkillRelation")
    allow(assessed_scope).to receive(:includes).with(:assessor_override).and_return(assessed_skills)
    portfolio = double(
      "Portfolio",
      portfolio_skills: assessed_scope,
      session: double("Session", tenant_id: 7)
    )
    allow(vacancy).to receive(:tenant_id).and_return(7)

    engine = described_class.allocate
    engine.instance_variable_set(:@portfolio, portfolio)
    engine.instance_variable_set(:@vacancy, vacancy)
    engine.send(:build_skill_comparisons).first
  end

  it "uses expected_level from vacancy data and labels an equal level as a match" do
    comparison = build_comparison(candidate_level: 3, expected_level: 3)

    expect(comparison).to include(
      expected_level: 3,
      candidate_level: 3,
      result: "match",
      delta: 0,
      is_override: false
    )
  end

  it "reports a lower candidate level as a gap with a negative delta" do
    comparison = build_comparison(candidate_level: 2, expected_level: 4)

    expect(comparison).to include(result: "gap", delta: -2, candidate_level: 2, expected_level: 4)
  end

  it "reports a higher candidate level as exceeding the requirement" do
    comparison = build_comparison(candidate_level: 5, expected_level: 3)

    expect(comparison).to include(result: "exceed", delta: 2)
  end

  it "keeps a missing assessment distinct from a skill gap" do
    comparison = build_comparison(candidate_level: nil, expected_level: 3)

    expect(comparison).to include(
      candidate_level: nil,
      expected_level: 3,
      result: "not_assessed",
      delta: nil,
      confidence: nil,
      is_override: false
    )
  end

  it "uses an assessor override for comparison and flags the result as human-adjusted" do
    comparison = build_comparison(candidate_level: 2, expected_level: 3, override_level: 4)

    expect(comparison).to include(candidate_level: 4, result: "exceed", delta: 1, is_override: true)
  end

  it "prefers a stable skill ID but falls back to a case-insensitive label when IDs are missing" do
    comparison = build_comparison(
      candidate_level: 3,
      expected_level: 3,
      candidate_skill_id: nil,
      vacancy_skill_id: nil,
      candidate_label: "javascript",
      vacancy_label: "JavaScript"
    )

    expect(comparison).to include(result: "match", candidate_level: 3)
  end

  it "rejects a portfolio and vacancy from different tenants" do
    engine = described_class.allocate
    allow(engine).to receive(:portfolio).and_return(double(session: double(tenant_id: 7)))
    engine.instance_variable_set(:@portfolio, double(session: double(tenant_id: 7)))
    engine.instance_variable_set(:@vacancy, double(tenant_id: 9))

    expect { engine.send(:assert_same_tenant!) }.to raise_error(ArgumentError, /same tenant/)
  end

  it "uses a safe human-review fallback when the narrative model times out" do
    engine = described_class.allocate
    vacancy = double(
      "Vacancy",
      role_title: "Frontend Engineer",
      culture_dimensions: "Collaboration",
      competency_expectations: "Communicate clearly"
    )
    client = double("GeminiClient")
    allow(client).to receive(:generate_content).and_raise(Timeout::Error, "provider response with unsafe detail")
    engine.instance_variable_set(:@vacancy, vacancy)
    engine.instance_variable_set(:@gemini_client, client)

    narratives = engine.send(:generate_narratives, [
      { result: "gap", skill_label: "TypeScript", candidate_level: 2, expected_level: 4, delta: -2 }
    ])

    expect(narratives[:culture]).to include("does not independently validate")
    expect(narratives[:overall]).to include("human review")
    expect(narratives.to_s).not_to include("unsafe detail")
  end

  it "falls back to explicit human-review narrative when the model returns malformed fields" do
    engine = described_class.allocate
    vacancy = double(
      "Vacancy",
      role_title: "Frontend Engineer",
      culture_dimensions: nil,
      competency_expectations: nil
    )
    client = double("GeminiClient")
    allow(client).to receive(:generate_content).and_return(
      { "culture_narrative" => "", "overall_narrative" => nil }
    )
    engine.instance_variable_set(:@vacancy, vacancy)
    engine.instance_variable_set(:@gemini_client, client)

    narratives = engine.send(:generate_narratives, [
      { result: "not_assessed", skill_label: "Ruby", candidate_level: nil }
    ])

    expect(narratives[:culture]).to include("No culture or competency expectations")
    expect(narratives[:overall]).to include("not assessed skill(s)")
    expect(narratives[:overall]).to include("hiring decision")
  end
end
