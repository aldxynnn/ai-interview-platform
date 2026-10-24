# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let!(:org1) { create_test_org(id: 1, scheme: 'tenant-one', name: 'Tenant One') }
  let!(:org2) { create_test_org(id: 2, scheme: 'tenant-two', name: 'Tenant Two') }

  let(:headers_org1) { auth_headers_for(org1, role: 'admin') }
  let(:headers_org2) { auth_headers_for(org2, role: 'admin') }

  let(:assessment1) { create_assessment_with_skills(tenant_id: org1.id) }
  let(:vacancy1) { create_vacancy_with_skills(tenant_id: org1.id) }
  let(:portfolio_data1) { create_completed_portfolio(assessment1) }
  let(:portfolio1) { portfolio_data1[:portfolio] }
  let(:skill1) { portfolio_data1[:skill] }

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:override_params) do
      {
        override: {
          override_level: 4,
          assessor_notes: 'Demonstrated superior depth in real production incident review.'
        }
      }
    end

    it 'creates an override and enqueues regeneration without destroying existing reports' do
      report = FitGapReport.create!(
        portfolio: portfolio1,
        vacancy: vacancy1,
        skill_comparisons: [{ skill_label: 'React', required_level: 3, candidate_level: 2, result: 'gap' }],
        overall_narrative: 'Existing report'
      )

      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio1.id, vacancy1.id)

      post "/api/v1/portfolio_skills/#{skill1.id}/override",
           params: override_params.to_json,
           headers: headers_org1.merge('CONTENT_TYPE' => 'application/json')

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['override']['override_level']).to eq(4)
      expect(json['override']['assessor_notes']).to include('Demonstrated superior depth')

      # Proving non-destructive: existing report row remains intact until worker finishes
      expect(FitGapReport.exists?(report.id)).to be(true)
    end

    it 'blocks cross-tenant overrides with 404 under UU PDP' do
      post "/api/v1/portfolio_skills/#{skill1.id}/override",
           params: override_params.to_json,
           headers: headers_org2.merge('CONTENT_TYPE' => 'application/json')

      expect(response).to have_http_status(:not_found)
    end
  end
end
