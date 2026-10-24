# frozen_string_literal: true

module TestHelpers
  def create_test_org(id: 1, scheme: 'test-corp', name: 'Test Corp')
    org = Organization.find_by(scheme: scheme)
    return org if org

    ActiveRecord::Base.connection.execute(<<~SQL)
      INSERT INTO public.organizations (id, name, scheme, identifier, host, created_at, updated_at)
      VALUES (#{id}, '#{name}', '#{scheme}', '#{scheme}', 'localhost', NOW(), NOW())
      ON CONFLICT (scheme) DO UPDATE SET name = EXCLUDED.name
    SQL
    Organization.find_by(scheme: scheme)
  end

  def auth_headers_for(org, role: 'admin', user_id: 1)
    token = JsonWebToken.encode({ user_id: user_id, role: role, scheme: org.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  def with_tenant(tenant_id = 1, &block)
    Current.using(tenant_id: tenant_id, &block)
  end

  def create_assessment_with_skills(tenant_id: 1, name: 'Frontend Engineer')
    with_tenant(tenant_id) do
      Assessment.create!(
        name: name,
        time_limit_min: 30,
        language: 'en',
        created_by: 1,
        tenant_id: tenant_id,
        assessment_skills_attributes: [
          {
            skill_id: 'SK-ENG-001',
            skill_label: 'React / Frontend Development Core',
            expected_level: 3,
            l1_anchor: 'L1 anchor',
            l2_anchor: 'L2 anchor',
            l3_anchor: 'L3 anchor',
            l4_anchor: 'L4 anchor',
            l5_anchor: 'L5 anchor'
          }
        ]
      )
    end
  end

  def create_vacancy_with_skills(tenant_id: 1, role_title: 'Senior Frontend Dev')
    with_tenant(tenant_id) do
      Vacancy.create!(
        role_title: role_title,
        created_by: 1,
        tenant_id: tenant_id,
        vacancy_skills_attributes: [
          {
            skill_id: 'SK-ENG-001',
            skill_label: 'React / Frontend Development Core',
            expected_level: 3
          },
          {
            skill_id: 'SK-ENG-002',
            skill_label: 'Node.js / Backend Development',
            expected_level: 4
          }
        ]
      )
    end
  end

  def create_completed_portfolio(assessment)
    with_tenant(assessment.tenant_id) do
      session = assessment.sessions.create!(
        status: 'ended',
        duration_seconds: 1800,
        candidate_name: 'Budi Santoso'
      )

      portfolio = session.create_portfolio!(
        generation_status: 'complete',
        generated_at: Time.current
      )

      skill = portfolio.portfolio_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React / Frontend Development Core',
        ai_level: 2,
        ai_confidence: 'high',
        evidence: ['Uses hooks and basic state'],
        competency_summary: 'Solid foundational frontend knowledge'
      )

      { session: session, portfolio: portfolio, skill: skill }
    end
  end
end

RSpec.configure do |config|
  config.include TestHelpers
end
