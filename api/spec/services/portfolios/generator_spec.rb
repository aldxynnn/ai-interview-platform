# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  describe "#validated_response" do
    let(:skill) { double("AssessmentSkill", skill_id: "sk-react", skill_label: "React") }
    let(:assessment) { double("Assessment", assessment_skills: [skill]) }
    let(:candidate_turns) do
      double("CandidateTranscriptTurns").tap do |turns|
        allow(turns).to receive(:pluck).with(:text).and_return([
          "During the interview, I built a React component to summarize applications."
        ])
      end
    end
    let(:transcript_relation) do
      double("TranscriptTurns").tap do |turns|
        allow(turns).to receive(:where).with(speaker: "candidate").and_return(candidate_turns)
      end
    end
    let(:session) do
      double("Session", assessment: assessment, transcript_turns: transcript_relation)
    end
    let(:generator) { described_class.new(session: session, gemini_client: double("GeminiClient")) }

    it "keeps only evidence quotes present in candidate transcript turns" do
      response = {
        "configured_skills" => [
          {
            "skill_id" => "sk-react",
            "skill_label" => "React",
            "level" => 4,
            "confidence" => "medium",
            "evidence" => [
              "I built a React component to summarize applications.",
              "I led a team of fifty engineers across five countries."
            ],
            "competency_summary" => "The candidate describes a practical React implementation."
          }
        ],
        "discovered_skills" => []
      }

      result = generator.send(:validated_response, response)
      evidence = result.fetch("configured_skills").first.fetch(:evidence)

      expect(evidence).to eq(["I built a React component to summarize applications."])
      expect(result.fetch("configured_skills").first.fetch(:skill_label)).to eq("React")
    end

    it "rejects configured skills that are not present in the assessment rubric" do
      response = {
        "configured_skills" => [
          {
            "skill_id" => "invented-skill",
            "skill_label" => "Invented skill",
            "level" => 3,
            "confidence" => "low",
            "evidence" => [],
            "competency_summary" => "No evidence."
          }
        ],
        "discovered_skills" => []
      }

      expect { generator.send(:validated_response, response) }.to raise_error(JSON::ParserError)
    end
  end
end
