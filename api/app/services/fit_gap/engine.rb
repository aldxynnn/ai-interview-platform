# frozen_string_literal: true

module FitGap
  # Deterministic skill comparison; AI is used only for a cautious narrative.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'), timeout: 30
      )
    end

    def call
      comparisons = build_skill_comparisons
      narratives = generate_narratives(comparisons)
      report = FitGapReport.find_or_initialize_by(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
      report.update!(skill_comparisons: comparisons, culture_narrative: narratives[:culture],
                     overall_narrative: narratives[:overall], generated_at: Time.current)
      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def normalize_level(value)
      number = case value
               when Integer then value
               when String
                 match = value.strip.match(/\A(?:L)?([1-5])\z/i)
                 match && match[1].to_i
               end
      number if number && (1..5).cover?(number)
    end

    def build_skill_comparisons
      skills = @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        { skill_id: skill.skill_id, skill_label: skill.skill_label,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence: skill.ai_confidence, overridden: override.present? }
      end

      @vacancy.vacancy_skills.map do |required|
        label = required.skill_label.to_s
        skill = skills.find { |s| s[:skill_id] == required.skill_id && required.skill_id.present? } ||
                skills.find { |s| s[:skill_label].to_s.casecmp?(label) }
        candidate = normalize_level(skill&.dig(:effective_level))
        expected = normalize_level(required.expected_level)
        if candidate && expected
          delta = candidate - expected
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
        else
          delta = nil
          result = 'not_assessed'
        end
        { skill_label: label, skill_id: required.skill_id, candidate_level: candidate,
          expected_level: expected, result: result, delta: delta,
          confidence: skill&.dig(:confidence), is_override: !!skill&.dig(:overridden) }
      end
    end

    def generate_narratives(comparisons)
      groups = %w[gap match exceed not_assessed].to_h do |result|
        [result, comparisons.select { |c| c[:result] == result }]
      end
      begin
        response = @gemini_client.generate_content(build_narrative_prompt(groups), temperature: 0.4)
        data = response.is_a?(Hash) ? response : JSON.parse(response)
        culture = data['culture_narrative'].to_s.strip
        overall = data['overall_narrative'].to_s.strip
        { culture: culture.empty? ? nil : culture,
          overall: overall.empty? ? fallback_narrative(comparisons) : overall }
      rescue StandardError => e
        Rails.logger.error("[N13] Narrative generation failed: #{e.class}: #{e.message}")
        { culture: nil, overall: fallback_narrative(comparisons) }
      end
    end

    def build_narrative_prompt(groups)
      vacancy = @vacancy
      summary = groups.map do |name, entries|
        "- #{name}: #{entries.map { |c| "#{c[:skill_label]} (candidate L#{c[:candidate_level]}, required L#{c[:expected_level]})" }.join(', ')}"
      end.join("\n")
      <<~PROMPT
        Summarize evidence for this role. Deterministic comparisons are the source of truth.
        Do not infer unobserved ability or recommend hiring/rejection. Missing evidence is not lack of skill.
        ROLE: #{vacancy.role_title}
        CULTURE EXPECTATIONS: #{vacancy.culture_dimensions}
        COMPETENCY EXPECTATIONS: #{vacancy.competency_expectations}
        #{summary}
        Return JSON with culture_narrative and overall_narrative, each 2-3 concise evidence-bound sentences.
      PROMPT
    end

    def fallback_narrative(comparisons)
      counts = %w[match exceed gap not_assessed].to_h do |result|
        [result, comparisons.count { |c| c[:result] == result }]
      end
      "Evidence shows #{counts['match']} matches, #{counts['exceed']} above requirements, " \
        "#{counts['gap']} gaps, and #{counts['not_assessed']} requirements not assessed. " \
        "Review evidence and unassessed skills before making a decision."
    end
  end
end
