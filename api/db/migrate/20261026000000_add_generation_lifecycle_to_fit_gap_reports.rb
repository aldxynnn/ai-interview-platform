# frozen_string_literal: true

class AddGenerationLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    # Existing rows are persisted reports, so they begin as complete.
    add_column :fit_gap_reports, :generation_status, :string, null: false, default: "complete"
    add_column :fit_gap_reports, :generation_error, :text
    # Also serves as a lease timestamp while queued/generating, allowing a later
    # request to recover a job whose worker died without executing its rescue path.
    add_column :fit_gap_reports, :generation_started_at, :datetime
  end
end
