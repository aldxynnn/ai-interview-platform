# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapReport do
  subject(:report) { described_class.allocate }

  before do
    allow(report).to receive(:with_lock) { |&block| block.call }
    allow(report).to receive(:reload).and_return(report)
    allow(report).to receive(:update!)
    allow(report).to receive(:generation_version).and_return(4)
    allow(report).to receive(:complete?).and_return(false)
    allow(report).to receive(:pending?).and_return(false)
    allow(report).to receive(:generating?).and_return(false)
  end

  it "does not enqueue a fresh generation for a recently pending report" do
    allow(report).to receive(:pending?).and_return(true)
    allow(report).to receive(:generation_started_at).and_return(Time.current)

    expect(report.claim_generation!).to be(false)
    expect(report).not_to have_received(:update!)
  end

  it "increments the version and clears stale output on a forced regeneration" do
    allow(report).to receive(:generation_version).and_return(4)

    expect(report.claim_generation!(force: true)).to be(true)
    expect(report).to have_received(:update!).with(
      generation_status: "pending",
      generation_error: nil,
      generated_at: nil,
      skill_comparisons: [],
      generation_version: 5
    )
  end

  it "ignores a worker holding an outdated generation version" do
    allow(report).to receive(:generation_version).and_return(5)

    expect(report.claim_execution!(generation_version: 4)).to be(false)
    expect(report).not_to have_received(:update!)
  end

  it "fences off a worker that is taking over an expired generation lease" do
    allow(report).to receive(:generation_version).and_return(5)
    allow(report).to receive(:generating?).and_return(true)
    allow(report).to receive(:generation_started_at).and_return(2.hours.ago)

    expect(report.claim_execution!(generation_version: 5)).to eq(6)
    expect(report).to have_received(:update!).with(
      generation_status: "generating",
      generation_error: nil,
      generation_started_at: anything,
      generation_version: 6
    )
  end

  it "does not let a stale worker mark a newer report version as failed" do
    allow(report).to receive(:generation_version).and_return(6)

    expect(report.mark_generation_failed!(generation_version: 5, exception_class: "Timeout::Error")).to be(false)
    expect(report).not_to have_received(:update!)
  end
end
