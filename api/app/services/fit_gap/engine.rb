# frozen_string_literal: true

module FitGap
  # N13: Generates a fit/gap report comparing a portfolio against a vacancy.
  # Rule-based skill comparison is authoritative; Gemini supplies optional narrative only.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'),
        timeout: 30
      )
    end

    def call
      comparisons = build_skill_comparisons
      narratives = generate_narratives(comparisons)
      report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      report.update!(
        skill_comparisons: comparisons,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at: Time.current
      )
      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills
      @vacancy.vacancy_skills.map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id)
        expected_level = vacancy_skill.expected_level

        if portfolio_skill && valid_level?(portfolio_skill[:effective_level]) && valid_level?(expected_level)
          candidate_level = portfolio_skill[:effective_level]
          delta = candidate_level - expected_level
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
        else
          candidate_level = nil
          delta = nil
          result = 'not_assessed'
        end

        {
          skill_label: vacancy_skill.skill_label,
          skill_id: vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level: expected_level,
          result: result,
          delta: delta,
          confidence: portfolio_skill&.dig(:confidence),
          is_override: portfolio_skill&.dig(:overridden) || false
        }
      end
    end

    def valid_level?(level)
      level.is_a?(Integer) && level.between?(1, 5)
    end

    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          ai_level: skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence: skill.ai_confidence,
          overridden: override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      match_by_id = portfolio_skills.find { |skill| skill_id.present? && skill[:skill_id] == skill_id }
      return match_by_id if match_by_id
      normalized_label = label.to_s.strip.downcase
      return nil if normalized_label.empty?
      portfolio_skills.find { |skill| skill[:skill_label].to_s.strip.downcase == normalized_label }
    end

    def generate_narratives(comparisons)
      gaps = comparisons.select { |c| c[:result] == 'gap' }
      matches = comparisons.select { |c| c[:result] == 'match' }
      exceeds = comparisons.select { |c| c[:result] == 'exceed' }
      not_assessed = comparisons.select { |c| c[:result] == 'not_assessed' }
      prompt = build_narrative_prompt(gaps, matches, exceeds, not_assessed)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        culture = non_blank_string(data['culture_narrative'])
        overall = non_blank_string(data['overall_narrative'])
        {
          culture: culture || fallback_culture_narrative(comparisons),
          overall: overall || generate_fallback_narrative(comparisons)
        }
      rescue StandardError => e
        # Exception messages can contain request data; log the class only.
        Rails.logger.error("[N13] Narrative generation failed (#{e.class})")
        { culture: fallback_culture_narrative(comparisons), overall: generate_fallback_narrative(comparisons) }
      end
    end

    def non_blank_string(value)
      value.strip if value.is_a?(String) && value.strip.present?
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      vacancy = @vacancy
      <<~PROMPT
        You are writing an evidence-conscious fit/gap analysis narrative for a candidate evaluation.
        Do not invent candidate traits beyond comparison results. Do not make a final hiring decision.
        Explicitly distinguish skills that are not assessed from demonstrated gaps.
        ROLE: #{vacancy.role_title}
        #{vacancy.culture_dimensions.present? ? "CULTURE EXPECTATIONS:\n#{vacancy.culture_dimensions}\n" : ""}
        #{vacancy.competency_expectations.present? ? "COMPETENCY EXPECTATIONS:\n#{vacancy.competency_expectations}\n" : ""}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c[:skill_label]} (L#{c[:candidate_level]})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]}" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c[:skill_label]}: candidate L#{c[:candidate_level]} vs expected L#{c[:expected_level]}" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c[:skill_label] }.join(', ')}

        Return JSON only with two concise strings: culture_narrative and overall_narrative.
        Not assessed is not evidence of low ability or a skill gap.
      PROMPT
    end

    def fallback_culture_narrative(comparisons)
      unassessed = comparisons.count { |c| c[:result] == 'not_assessed' }
      return 'Culture and competency fit cannot be inferred from an empty skill comparison.' if comparisons.empty?
      if unassessed.positive?
        "#{unassessed} required skill(s) have not been assessed. Review additional interview evidence; unassessed skills are not proof of a gap."
      else
        'Review culture and competency fit alongside the skill comparison and supporting interview evidence.'
      end
    end

    def generate_fallback_narrative(comparisons)
      gaps = comparisons.count { |c| c[:result] == 'gap' }
      matches = comparisons.count { |c| c[:result] == 'match' }
      exceeds = comparisons.count { |c| c[:result] == 'exceed' }
      unassessed = comparisons.count { |c| c[:result] == 'not_assessed' }
      "Skill comparison: #{matches} match(es), #{exceeds} above requirement, #{gaps} gap(s), and #{unassessed} not assessed. " \
        'Use the comparison and supporting evidence as decision support, not as an automatic hiring decision.'
    end
  end
end
