class RepairFitGapReportsSchema < ActiveRecord::Migration[7.0]
  def up
    unless column_exists?(:fit_gap_reports, :input_fingerprint)
      add_column :fit_gap_reports, :input_fingerprint, :string, limit: 64
    end

    execute <<~SQL
      ALTER TABLE ai_interview.fit_gap_reports
      DROP CONSTRAINT IF EXISTS chk_fit_gap_reports_generation_status;
    SQL

    add_check_constraint :fit_gap_reports,
      "generation_status IN ('queued', 'generating', 'complete', 'failed', 'stale')",
      name: "chk_fit_gap_reports_generation_status"
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
      "Schema repair is intentionally not reversed to protect existing reports."
  end
end