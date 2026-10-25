# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:portfolio) { double("Portfolio", id: 10, session: double("Session", tenant_id: 1), portfolio_skills: association) }
  let(:vacancy) do
    double("Vacancy", id: 20, tenant_id: 1, vacancy_skills: requirements, role_title: "Engineer",
           culture_dimensions: nil, competency_expectations: nil)
  end
  let(:association) { double("PortfolioSkillsAssociation") }
  let(:portfolio_rows) { [] }
  let(:requirements) { [] }

  def portfolio_skill(id:, label:, level:, evidence: ["candidate evidence"], confidence: "high", override: nil)
    double("PortfolioSkill", id: id, skill_id: id, skill_label: label, ai_level: level,
           ai_confidence: confidence, evidence_quotes: evidence, assessor_override: override)
  end

  def vacancy_skill(id:, label:, level:)
    double("VacancySkill", skill_id: id, skill_label: label, expected_level: level)
  end

  before do
    allow(association).to receive(:includes).with(:assessor_override).and_return(portfolio_rows)
  end

  describe "#build_skill_comparisons" do
    it "matches skill IDs rather than collapsing distinct requirements with the same label" do
      allow(association).to receive(:includes).with(:assessor_override).and_return([
        portfolio_skill(id: "sk-a", label: "Shared skill", level: 4),
        portfolio_skill(id: "sk-b", label: "Shared skill", level: 2)
      ])
      allow(vacancy).to receive(:vacancy_skills).and_return([
        vacancy_skill(id: "sk-a", label: "Shared skill", level: 3),
        vacancy_skill(id: "sk-b", label: "Shared skill", level: 4)
      ])

      comparisons = described_class.new(portfolio: portfolio, vacancy: vacancy).send(:build_skill_comparisons)

      expect(comparisons.map { |item| item[:result] }).to eq(%w[exceed gap])
      expect(comparisons.map { |item| item[:required_level] }).to eq([3, 4])
    end

    it "does not match a different skill ID just because its label is the same" do
      allow(association).to receive(:includes).with(:assessor_override).and_return([
        portfolio_skill(id: "sk-a", label: "Shared skill", level: 5)
      ])
      allow(vacancy).to receive(:vacancy_skills).and_return([
        vacancy_skill(id: "sk-b", label: "Shared skill", level: 3)
      ])

      comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).send(:build_skill_comparisons).first

      expect(comparison[:result]).to eq("not_assessed")
      expect(comparison[:candidate_level]).to be_nil
      expect(comparison[:delta]).to be_nil
    end

    it "treats a skill without candidate evidence as not assessed" do
      allow(association).to receive(:includes).with(:assessor_override).and_return([
        portfolio_skill(id: "sk-a", label: "Ruby", level: 4, evidence: [])
      ])
      allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill(id: "sk-a", label: "Ruby", level: 2)])

      comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).send(:build_skill_comparisons).first

      expect(comparison[:result]).to eq("not_assessed")
      expect(comparison[:candidate_level]).to be_nil
    end

    it "uses an assessor override in the comparison and exposes the override marker" do
      override = double("AssessorOverride", override_level: 2)
      allow(association).to receive(:includes).with(:assessor_override).and_return([
        portfolio_skill(id: "sk-a", label: "Ruby", level: 5, override: override)
      ])
      allow(vacancy).to receive(:vacancy_skills).and_return([vacancy_skill(id: "sk-a", label: "Ruby", level: 3)])

      comparison = described_class.new(portfolio: portfolio, vacancy: vacancy).send(:build_skill_comparisons).first

      expect(comparison[:candidate_level]).to eq(2)
      expect(comparison[:result]).to eq("gap")
      expect(comparison[:is_override]).to be(true)
    end
  end

  describe "#call" do
    it "refuses to build a report from portfolio and vacancy belonging to different tenants" do
      allow(vacancy).to receive(:tenant_id).and_return(2)

      expect { described_class.new(portfolio: portfolio, vacancy: vacancy).call }
        .to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
