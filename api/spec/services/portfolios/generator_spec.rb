# frozen_string_literal: true

require "rails_helper"

RSpec.describe Portfolios::Generator do
  subject(:generator) { described_class.new(session: Object.new, gemini_client: Object.new) }

  let(:valid_response) do
    {
      configured_skills: [
        {
          skill_id: "sk-eng-001",
          skill_label: "React",
          level: 3,
          confidence: "medium",
          evidence: ["Candidate explained a trade-off."],
          competency_summary: "Explains trade-offs and implementation choices."
        }
      ],
      discovered_skills: []
    }
  end

  describe "#normalize_response" do
    it "normalizes valid output without coercing invalid levels into range" do
      result = generator.send(:normalize_response, valid_response)

      expect(result.fetch(:configured_skills).first).to include(
        skill_id: "sk-eng-001",
        skill_label: "React",
        level: 3,
        confidence: "medium"
      )
      expect(result.fetch(:discovered_skills)).to eq([])
    end

    it "rejects a level outside the supported 1..5 range" do
      invalid = Marshal.load(Marshal.dump(valid_response))
      invalid[:configured_skills].first[:level] = 9

      expect { generator.send(:normalize_response, invalid) }
        .to raise_error(Portfolios::Generator::InvalidResponse, /level from 1 to 5/)
    end

    it "rejects missing output arrays instead of silently treating them as empty" do
      expect { generator.send(:normalize_response, { configured_skills: [] }) }
        .to raise_error(Portfolios::Generator::InvalidResponse, /configured_skills and discovered_skills/)
    end

    it "rejects non-string evidence rather than persisting malformed data" do
      invalid = Marshal.load(Marshal.dump(valid_response))
      invalid[:configured_skills].first[:evidence] = [123]

      expect { generator.send(:normalize_response, invalid) }
        .to raise_error(Portfolios::Generator::InvalidResponse, /array of strings/)
    end
  end
end
