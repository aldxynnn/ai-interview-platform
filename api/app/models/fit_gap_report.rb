# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  # Empty comparisons are a valid state only while queued/running/failed.
  # A completed report must always contain its deterministic result set.
  validates :skill_comparisons, presence: true, if: :complete?
  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :generation_version, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :ready, -> { where(generation_status: "complete") }

  def pending?    = generation_status == "pending"
  def generating? = generation_status == "generating"
  def complete?   = generation_status == "complete"
  def failed?     = generation_status == "failed"

  # Atomically reserve a new generation request. The monotonically increasing
  # version makes an older in-flight job unable to overwrite newer assessor input.
  def claim_generation!(force: false, stale_after: 15.minutes)
    with_lock do
      reload

      return false if complete? && !force
      return false if pending? && updated_at > stale_after.ago && !force
      return false if generating? && updated_at > stale_after.ago && !force

      update!(
        generation_status: "pending",
        generation_error: nil,
        generated_at: nil,
        skill_comparisons: [],
        generation_version: generation_version + 1
      )
      true
    end
  end

  # Only one job may own a generation. Returns the version the caller now owns,
  # or false when another current worker has already claimed/completed it.
  # Taking over a stale lease increments the version so the old worker cannot
  # overwrite the new worker's result if it eventually finishes.
  def claim_execution!(generation_version:, stale_after: 15.minutes)
    with_lock do
      reload
      return false unless self.generation_version == generation_version.to_i
      return false if complete?
      return false if generating? && updated_at > stale_after.ago

      claimed_version = generating? ? self.generation_version + 1 : self.generation_version
      update!(
        generation_status: "generating",
        generation_error: nil,
        generation_version: claimed_version
      )
      claimed_version
    end
  end

  def mark_generation_failed!(generation_version:, exception_class:)
    with_lock do
      reload
      return false unless self.generation_version == generation_version.to_i

      update!(
        generation_status: "failed",
        generation_error: "Fit/gap generation failed (#{exception_class})"
      )
      true
    end
  end
end
