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

  it "preserves the previous comparison payload when regeneration is queued" do
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

  it "recovers a report whose generation lease has expired" do
    portfolio, vacancy = create_inputs
    allow(FitGapGeneratorWorker).to receive(:perform_async).and_return("synthetic-job-id")
    report = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)
    report.update!(generation_status: "generating", generation_started_at: 16.minutes.ago)

    recovered = described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(recovered.generation_status).to eq("queued")
    expect(recovered.generation_started_at).to be > 15.minutes.ago
    expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
  end

  it "refuses to schedule a report from different tenants" do
    portfolio, vacancy = create_inputs
    other_assessment = Assessment.create!(tenant_id: vacancy.tenant_id + 100, created_by: 9003,
                                          name: "Other tenant", time_limit_min: 30, language: "en")
    other_session = Session.create!(tenant_id: vacancy.tenant_id + 100, assessment: other_assessment, status: "ended")
    other_portfolio = Portfolio.create!(session: other_session, generation_status: "complete")
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    expect(described_class.enqueue(portfolio: other_portfolio, vacancy: vacancy)).to be_nil
    expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
  end

  it "does not enqueue again when a concurrent insert resolves to an existing queued row" do
    portfolio, vacancy = create_inputs
    existing_report = instance_double(
      FitGapReport,
      previously_new_record?: false,
      generating?: true,
      generation_started_at: Time.current,
      generation_status: "queued",
      failed?: false
    )
    allow(existing_report).to receive(:with_lock) { |&block| block.call }
    allow(existing_report).to receive(:reload).and_return(existing_report)
    allow(FitGapReport).to receive(:create_or_find_by!)
      .with(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
      .and_return(existing_report)
    allow(FitGapGeneratorWorker).to receive(:perform_async)

    described_class.enqueue(portfolio: portfolio, vacancy: vacancy)

    expect(FitGapGeneratorWorker).not_to have_received(:perform_async)
  end
end
