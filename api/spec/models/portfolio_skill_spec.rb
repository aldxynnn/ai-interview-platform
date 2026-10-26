# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioSkill, type: :model do
  subject(:skill) do
    described_class.new(
      portfolio: Portfolio.new,
      skill_label: "Problem solving",
      ai_level: level,
      ai_confidence: confidence,
      evidence: evidence,
      competency_summary: "The candidate explained a concrete trade-off."
    )
  end

  let(:level) { 3 }
  let(:confidence) { "medium" }
  let(:evidence) { ["I compared two approaches before choosing one."] }

  it "accepts a rating within the defined 1–5 scale" do
    expect(skill).to be_valid
  end

  context "when the rating is below the supported scale" do
    let(:level) { 0 }

    it "rejects the rating rather than storing an invalid assessment" do
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).not_to be_empty
    end
  end

  context "when the rating is above the supported scale" do
    let(:level) { 6 }

    it "rejects the rating rather than storing an invalid assessment" do
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_level]).not_to be_empty
    end
  end

  context "when confidence is not a supported value" do
    let(:confidence) { "certain" }

    it "rejects an unknown confidence category" do
      expect(skill).not_to be_valid
      expect(skill.errors[:ai_confidence]).not_to be_empty
    end
  end

  describe "#evidence_quotes" do
    it "normalizes missing evidence to an empty list" do
      skill.evidence = nil

      expect(skill.evidence_quotes).to eq([])
    end

    it "normalizes a single evidence string to a list" do
      skill.evidence = "A single quote"

      expect(skill.evidence_quotes).to eq(["A single quote"])
    end
  end
end
