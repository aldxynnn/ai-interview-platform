# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let!(:org1) { create_test_org(id: 1, scheme: 'tenant-one', name: 'Tenant One') }
  let!(:org2) { create_test_org(id: 2, scheme: 'tenant-two', name: 'Tenant Two') }

  let(:headers_org1) { auth_headers_for(org1, role: 'admin') }
  let(:headers_org2) { auth_headers_for(org2, role: 'admin') }

  let(:assessment1) { create_assessment_with_skills(tenant_id: org1.id) }
  let(:vacancy1) { create_vacancy_with_skills(tenant_id: org1.id) }
  let(:portfolio_data1) { create_completed_portfolio(assessment1) }
  let(:session1) { portfolio_data1[:session] }
  let(:portfolio1) { portfolio_data1[:portfolio] }

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'returns portfolio details for authorized tenant' do
      get "/api/v1/sessions/#{session1.id}/portfolio", headers: headers_org1
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json['portfolio']['id']).to eq(portfolio1.id)
    end

    it 'blocks cross-tenant access with 404 under UU PDP isolation' do
      get "/api/v1/sessions/#{session1.id}/portfolio", headers: headers_org2
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'returns 202 accepted when report is not yet generated' do
      get "/api/v1/portfolios/#{portfolio1.id}/fitgap/#{vacancy1.id}", headers: headers_org1
      expect(response).to have_http_status(:accepted)

      json = JSON.parse(response.body)
      expect(json['status']).to eq('generating')
    end

    it 'returns 200 ok when report exists' do
      FitGapReport.create!(
        portfolio: portfolio1,
        vacancy: vacancy1,
        skill_comparisons: [{ skill_label: 'React', required_level: 3, expected_level: 3, candidate_level: 3, result: 'match', delta: 0 }],
        culture_narrative: 'Good fit',
        overall_narrative: 'Recommended'
      )

      get "/api/v1/portfolios/#{portfolio1.id}/fitgap/#{vacancy1.id}", headers: headers_org1
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json['report']).not_to be_nil
      expect(json['report']['skill_comparisons'].first['required_level']).to eq(3)
    end

    it 'blocks cross-tenant access with 404' do
      get "/api/v1/portfolios/#{portfolio1.id}/fitgap/#{vacancy1.id}", headers: headers_org2
      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'exports JSON successfully for authorized tenant' do
      get "/api/v1/portfolios/#{portfolio1.id}/export?format=json", headers: headers_org1
      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include('application/json')
    end

    it 'exports PDF successfully for authorized tenant' do
      get "/api/v1/portfolios/#{portfolio1.id}/export?format=pdf", headers: headers_org1
      expect(response).to have_http_status(:ok)
      expect(response.content_type).to include('application/pdf')
    end

    it 'blocks cross-tenant export with 404' do
      get "/api/v1/portfolios/#{portfolio1.id}/export?format=json", headers: headers_org2
      expect(response).to have_http_status(:not_found)
    end
  end
end
