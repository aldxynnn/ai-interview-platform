# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills
  has_many :fit_gap_reports, dependent: :destroy

  # Portfolio rows do not store tenant_id themselves; ownership is inherited
  # from the session that produced the portfolio. Never query by portfolio ID
  # alone from an authenticated request.
  scope :for_tenant, lambda { |tenant_id|
    joins(:session).where(sessions: { tenant_id: tenant_id })
  }

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'
end
