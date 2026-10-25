# frozen_string_literal: true

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true, unless: -> { generation_status == "generating" }
  validates :generation_status, inclusion: { in: %w[pending generating complete failed] }
  validates :generation_version, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
