# frozen_string_literal: true

require "rails_helper"

RSpec.describe Gemini::HttpClient do
  subject(:client) { described_class.new(model: "gemini-test", api_key: "test-key") }

  it "does not log or attach raw provider response bodies for HTTP errors" do
    response = double("response", success?: false, status: 500, body: "private provider response body")
    expect(Rails.logger).to receive(:error).with("[Gemini::HttpClient] API error 500")

    expect { client.send(:parse_response, response) }
      .to raise_error(Gemini::HttpClient::ApiError) { |error|
        expect(error.message).to eq("API returned 500")
        expect(error.body).to be_nil
      }
  end

  it "does not retain raw provider response bodies on rate-limit errors" do
    response = double("response", success?: false, status: 429, body: "private rate-limit response body")

    expect { client.send(:parse_response, response) }
      .to raise_error(Gemini::HttpClient::RateLimitError) { |error|
        expect(error.message).to eq("Rate limited")
        expect(error.body).to be_nil
      }
  end
end
