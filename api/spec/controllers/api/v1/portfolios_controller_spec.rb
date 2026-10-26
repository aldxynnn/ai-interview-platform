# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::PortfoliosController, type: :controller do
  describe "#export" do
    let(:portfolio) do
      instance_double(Portfolio, id: 123, complete?: true, generation_status: "complete")
    end

    before do
      controller.instance_variable_set(:@portfolio, portfolio)
      allow(controller).to receive(:params).and_return(
        ActionController::Parameters.new(format: "json", vacancy_id: "999")
      )
      allow(Vacancy).to receive(:find_by).with(id: "999").and_return(nil)
    end

    it "returns not found when the requested vacancy does not exist" do
      expect(controller).to receive(:json_error)
        .with("Vacancy not found", :not_found)
        .and_return(:not_found_response)

      expect(controller.export).to eq(:not_found_response)
    end
  end
end
