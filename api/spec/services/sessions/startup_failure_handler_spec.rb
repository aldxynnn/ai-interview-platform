# frozen_string_literal: true

RSpec.describe Sessions::StartupFailureHandler do
  class FakeTranscriptRelation
    def initialize(has_transcript: false)
      @has_transcript = has_transcript
    end

    def exists?
      @has_transcript
    end
  end

  class FakeSession
    attr_reader :attributes, :transcript_turns, :portfolio

    def initialize(status: 'active', has_transcript: false, portfolio: nil)
      @attributes = {
        status: status,
        started_at: Time.utc(2026, 1, 1),
        ended_at: nil,
        duration_seconds: nil,
        end_reason: 'error'
      }
      @transcript_turns = FakeTranscriptRelation.new(has_transcript: has_transcript)
      @portfolio = portfolio
    end

    def status
      @attributes[:status]
    end

    def with_lock
      yield
    end

    def update!(changes)
      @attributes.merge!(changes)
    end
  end

  it 'returns retryable and resets lifecycle fields before any transcript exists' do
    session = FakeSession.new
    result = described_class.new(session).call

    expect(result).to eq(described_class::RETRYABLE)
    expect(session.attributes).to include(
      status: 'pending',
      started_at: nil,
      ended_at: nil,
      duration_seconds: nil,
      end_reason: nil
    )
  end

  it 'does not reset a session that already has transcript evidence' do
    session = FakeSession.new(has_transcript: true)

    expect(described_class.new(session).call).to eq(described_class::FAILED)
    expect(session.attributes[:status]).to eq('active')
  end

  it 'does not reset a session after a portfolio has been created' do
    session = FakeSession.new(portfolio: Object.new)

    expect(described_class.new(session).call).to eq(described_class::FAILED)
    expect(session.attributes[:status]).to eq('active')
  end

  it 'does not reopen a session that is already terminal' do
    session = FakeSession.new(status: 'ended')

    expect(described_class.new(session).call).to eq(described_class::FAILED)
    expect(session.attributes[:status]).to eq('ended')
  end
end
