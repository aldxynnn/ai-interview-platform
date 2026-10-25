# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::ReportScheduler do
  def create_inputs
    organization = Organization.create!(name: "scheduler-spec", scheme: "scheduler-spec",
                                        identifier: "scheduler-spec", host: "scheduler-spec.example.test",
                                        alias_hosts: [], config: {})
    assessment = Assessment.create!(tenant_id: organization.id, created_by: 9002,
                                    name: "Synthetic assessment", time_limit_min: 30, language: "en")
    session = Session.create!(tenant_id: organization.id, assessment: assessment, status: "ended")
    portfolio = Portfolio.create!(session: session, generation_status: "complete")
    vacancy = Vacancy.create!(tenant_id: organization.id, created_by: 9002, role_title: "Synthetic role")
    [portfolio, vacancy]
  end

  before { Current.clear }

  it "enqueues at most one job while the report is queued" do
    portfolio, vacancy = create_inputs
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")

    first = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    second = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(first.generation_status).to eq("queued")
    expect(second.generation_status).to eq("queued")
    expect(FitGapGeneratorWorker).to have_received(:perform_async).once
  end

  it "preserves the previous comparison payload when a regeneration is queued" do
    portfolio, vacancy = create_inputs
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")
    report = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    report.update!(generation_status: "complete", skill_comparisons: [{ "result" => "match" }])

    described_class.enqueue(portfolio: portfolio, vacancy: vacancy, force: true)

    expect(report.reload.generation_status).to eq("queued")
    expect(report.skill_comparisons).to eq([{ "result" => "match" }])
    expect(report.generated_at).to be_nil
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end
end
