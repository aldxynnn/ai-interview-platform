# frozen_string_literal: true

require "spec_helper"
require "faraday"
require_relative "../../../app/clients/gemini/http_client"

RSpec.describe Gemini::HttpClient do
  it "maps retired Gemini text model identifiers to a current supported model" do
    client = described_class.new(model: "gemini-2.0-pro-001", api_key: "test-key")
    expect(client.send(:generate_url)).to eq(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"
    )
  end

  it "uses the v1beta GenerateContent endpoint" do
    client = described_class.new(model: "gemini-3.8-flash", api_key: "test-key")
    expect(client.send(:generate_url)).to include("/v1beta/models/gemini-3.8-flash:generateContent")
  end
end
