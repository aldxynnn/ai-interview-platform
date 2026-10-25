# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/services/fit_gap/engine"

RSpec.describe FitGap::Engine do
  subject(:engine) do
    described_class.new(
      portfolio: portfolio,
      vacancy: vacancy,
      gemini_client: double("Gemini client")
    )
  end

  let(:session) { double("session", tenant_id: 11) }
  let(:portfolio) { double("portfolio", session: session, portfolio_skills: double("skills relation", includes: [])) }
  let(:vacancy) { double("vacancy", tenant_id: 11, vacancy_skills: []) }

  describe "#assert_same_tenant!" do
    it "allows a portfolio and vacancy from the same tenant" do
      expect { engine.send(:assert_same_tenant!) }.not_to raise_error
    end

    it "rejects a cross-tenant comparison" do
      allow(vacancy).to receive(:tenant_id).and_return(22)

      expect { engine.send(:assert_same_tenant!) }
        .to raise_error(ArgumentError, "Portfolio and vacancy must belong to the same tenant")
    end
  end

  describe "#build_skill_comparisons" do
    it "keeps an unassessed skill distinct from a gap" do
      required_skill = double("vacancy skill", skill_label: "Ruby", skill_id: "ruby", expected_level: 3)
      allow(vacancy).to receive(:vacancy_skills).and_return([required_skill])

      comparison = engine.send(:build_skill_comparisons).first

      expect(comparison).to include(result: "not_assessed", candidate_level: nil, expected_level: 3, required_level: 3, delta: nil)
    end

    it "does not crash when the expected level is missing" do
      required_skill = double("vacancy skill", skill_label: "Ruby", skill_id: "ruby", expected_level: nil)
      allow(vacancy).to receive(:vacancy_skills).and_return([required_skill])

      comparison = engine.send(:build_skill_comparisons).first

      expect(comparison).to include(result: "not_assessed", candidate_level: nil, expected_level: nil, required_level: nil, delta: nil)
    end
  end
end
