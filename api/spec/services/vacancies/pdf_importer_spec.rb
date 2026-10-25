# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/services/vacancies/pdf_importer"

RSpec.describe Vacancies::PdfImporter do
  subject(:importer) { described_class.new(tenant_id: 4, created_by: 9, pdf_text: "Senior engineer role", gemini_client: Object.new) }
  let(:valid_response) do
    { role_title: "Senior Backend Engineer", culture_dimensions: "Collaborative",
      competency_expectations: "Own reliable backend services.",
      skills: [{ skill_label: "Ruby", expected_level: 4 }, { skill_label: "PostgreSQL", expected_level: 3 }] }
  end

  describe "#normalize_response" do
    it "accepts valid structured role and skills" do
      result = importer.send(:normalize_response, valid_response)
      expect(result[:role_title]).to eq("Senior Backend Engineer")
      expect(result[:skills].map { |skill| skill[:expected_level] }).to eq([4, 3])
    end
    it "rejects an empty skill list" do
      expect { importer.send(:normalize_response, valid_response.merge(skills: [])) }.to raise_error(described_class::InvalidResponse)
    end
    it "rejects out-of-range expected levels" do
      invalid = Marshal.load(Marshal.dump(valid_response))
      invalid[:skills][0][:expected_level] = 8
      expect { importer.send(:normalize_response, invalid) }.to raise_error(described_class::InvalidResponse)
    end
    it "rejects duplicate labels" do
      invalid = Marshal.load(Marshal.dump(valid_response))
      invalid[:skills][1][:skill_label] = " ruby "
      expect { importer.send(:normalize_response, invalid) }.to raise_error(described_class::InvalidResponse)
    end
    it "rejects malformed JSON" do
      expect { importer.send(:normalize_response, "{not json") }.to raise_error(described_class::InvalidResponse)
    end
  end
end
