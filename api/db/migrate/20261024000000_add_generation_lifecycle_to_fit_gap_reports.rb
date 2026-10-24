# frozen_string_literal: true

class AddGenerationLifecycleToFitGapReports < ActiveRecord::Migration[7.0]
  def change
    # Existing rows are completed reports; keep them readable after deployment.
    add_column :fit_gap_reports, :generation_status, :string, null: false, default: "complete"
    add_column :fit_gap_reports, :generation_error, :text
    add_column :fit_gap_reports, :generation_version, :integer, null: false, default: 0
    add_column :fit_gap_reports, :generation_started_at, :datetime

    add_check_constraint :fit_gap_reports,
                         "generation_status IN ('pending', 'generating', 'complete', 'failed')",
                         name: "chk_fit_gap_reports_generation_status"
    add_check_constraint :fit_gap_reports,
                         "generation_version >= 0",
                         name: "chk_fit_gap_reports_generation_version"
  end
end
