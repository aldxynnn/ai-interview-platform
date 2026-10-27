# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    sequence(:name) { |n| "Org #{n}" }
    sequence(:scheme) { |n| "org-#{n}" }
    sequence(:identifier) { |n| "org-#{n}" }
    sequence(:host) { |n| "org-#{n}.example.com" }
    alias_hosts { [] }
    config { {} }
  end

  factory :assessment do
    sequence(:created_by) { |n| n }
    name { "Senior Backend Engineer Assessment" }
    time_limit_min { 45 }
    language { "en" }
    tenant_id { 1 }
  end

  factory :assessment_skill do
    assessment
    sequence(:skill_label) { |n| "Skill #{n}" }
    sequence(:display_order) { |n| n }
    l1_anchor { "Foundational understanding" }
    l2_anchor { "Functional application" }
    l3_anchor { "Proficient execution" }
    l4_anchor { "Advanced mastery" }
    l5_anchor { "Expert architectural leadership" }
  end

  factory :session do
    assessment
    candidate_name { "Budi Santoso" }
    status { "pending" }
    tenant_id { assessment.tenant_id }
  end

  factory :portfolio do
    session
    generation_status { "complete" }
  end

  factory :portfolio_skill do
    portfolio
    sequence(:skill_label) { |n| "Skill #{n}" }
    ai_level { 3 }
    ai_confidence { "high" }
    evidence { ["Demonstrated solid architecture fundamentals in interview"] }
    competency_summary { "Competent software engineering knowledge" }
    is_discovered { false }
  end

  factory :assessor_override do
    portfolio_skill
    override_level { 4 }
    ai_level { portfolio_skill.ai_level }
    overridden_by { 1 }
    overridden_at { Time.current }
    assessor_notes { "Assessor observed excellent problem-solving ability" }
  end

  factory :vacancy do
    sequence(:created_by) { |n| n }
    role_title { "Staff Software Engineer" }
    culture_dimensions { "High autonomy, distributed systems, proactive communication" }
    competency_expectations { "Deep backend and architecture proficiency" }
    tenant_id { 1 }
  end

  factory :vacancy_skill do
    vacancy
    sequence(:skill_label) { |n| "Skill #{n}" }
    expected_level { 3 }
  end
end
