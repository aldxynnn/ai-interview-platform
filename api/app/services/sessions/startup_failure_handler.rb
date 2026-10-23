# frozen_string_literal: true

module Sessions
  # Makes startup failures retryable only when the session contains no transcript
  # and no portfolio has been created. Once any interview evidence exists, keep
  # the session terminal so evidence is not silently discarded.
  class StartupFailureHandler
    RETRYABLE = :retryable
    FAILED = :failed

    def initialize(session)
      @session = session
    end

    def call
      outcome = FAILED

      @session.with_lock do
        next unless %w[pending active].include?(@session.status)
        next if @session.transcript_turns.exists?
        next if @session.portfolio

        @session.update!(
          status: 'pending',
          started_at: nil,
          ended_at: nil,
          duration_seconds: nil,
          end_reason: nil
        )
        outcome = RETRYABLE
      end

      outcome
    end
  end
end
