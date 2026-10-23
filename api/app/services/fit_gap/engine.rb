# frozen_string_literal: true

module FitGap
  # N13: Produces a deterministic skill comparison and an explicitly advisory
  # AI narrative. Numeric levels and result categories never depend on the LLM.
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil, report: nil, generation_version: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @report = report
      @generation_version = generation_version
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch("GEMINI_FLASH_MODEL", "gemini-2.0-flash-001"),
        timeout: 30
      )
    end

    def call
      assert_same_tenant!
      comparisons = build_skill_comparisons
      narratives = generate_narratives(comparisons)

      persist_result!(comparisons, narratives)
      @report || FitGapReport.find_by!(portfolio_id: @portfolio.id, vacancy_id: @vacancy.id)
    end

    private

    def assert_same_tenant!
      unless @portfolio.session.tenant_id == @vacancy.tenant_id
        raise ArgumentError, "Portfolio and vacancy must belong to the same tenant"
      end
    end

    def build_skill_comparisons
      portfolio_skills = effective_portfolio_skills

      @vacancy.vacancy_skills.order(:id).map do |vacancy_skill|
        portfolio_skill = find_portfolio_skill(
          portfolio_skills,
          vacancy_skill.skill_label,
          vacancy_skill.skill_id
        )
        candidate_level = portfolio_skill && portfolio_skill[:effective_level]
        expected_level = vacancy_skill.expected_level
        delta = candidate_level.nil? ? nil : candidate_level - expected_level
        result = if candidate_level.nil?
                   "not_assessed"
                 elsif delta.zero?
                   "match"
                 elsif delta.positive?
                   "exceed"
                 else
                   "gap"
                 end

        {
          skill_label: vacancy_skill.skill_label,
          skill_id: vacancy_skill.skill_id,
          candidate_level: candidate_level,
          expected_level: expected_level,
          result: result,
          delta: delta,
          confidence: portfolio_skill&.dig(:confidence),
          is_override: portfolio_skill ? portfolio_skill[:overridden] : false
        }
      end
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

    def find_portfolio_skill(skills, label, skill_id)
      # Prefer stable taxonomy IDs. If either record has no ID, fall back to a
      # case-insensitive label match; a blank label is never a valid match.
      return skills.find { |skill| skill[:skill_id] == skill_id } if skill_id.present? &&
        (match = skills.find { |skill| skill[:skill_id] == skill_id })

      return nil if label.blank?

      skills.find { |skill| skill[:skill_label].to_s.casecmp?(label.to_s) }
    end

    def generate_narratives(comparisons)
      counts = comparisons.each_with_object(Hash.new(0)) do |comparison, result|
        result[comparison[:result]] += 1
      end
      prompt = build_narrative_prompt(comparisons, counts)

      begin
        response = @gemini_client.generate_content(prompt, temperature: 0.2)
        data = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
        data = data.with_indifferent_access if data.respond_to?(:with_indifferent_access)
        culture = data && data[:culture_narrative]
        overall = data && data[:overall_narrative]

        unless culture.is_a?(String) && overall.is_a?(String) &&
               culture.present? && overall.present?
          raise ArgumentError, "Narrative response is missing required text fields"
        end

        {
          culture: sanitize_narrative(culture),
          overall: sanitize_narrative(overall)
        }
      rescue StandardError => e
        # Do not log model responses, prompt content, exception text, or candidate data.
        Rails.logger.warn("[N13] Narrative fallback used (error_class=#{e.class.name})")
        {
          culture: fallback_culture_narrative(counts),
          overall: fallback_overall_narrative(counts)
        }
      end
    end

    def build_narrative_prompt(comparisons, counts)
      # Keep the AI input to role requirements and derived skill outcomes.
      # Candidate names, invite tokens, transcripts, and raw evidence are excluded.
      role = @vacancy.role_title.to_s.truncate(200)
      culture = @vacancy.culture_dimensions.to_s.truncate(2_000)
      competency = @vacancy.competency_expectations.to_s.truncate(2_000)
      rows = comparisons.map do |comparison|
        candidate = comparison[:candidate_level].nil? ? "not assessed" : "L#{comparison[:candidate_level]}"
        expected = "L#{comparison[:expected_level]}"
        "#{comparison[:skill_label].to_s.truncate(100)}: candidate #{candidate}; expected #{expected}; result #{comparison[:result]}"
      end

      <<~PROMPT
        You are assisting a hiring assessor. Your text is advisory context, never a hiring decision.
        Do not infer personality, protected traits, or facts not present in the structured data.
        Explicitly distinguish not-assessed skills from gaps. State that humans must review evidence
        and make the final decision. Do not recommend automatic rejection or acceptance.

        ROLE: #{role}
        CULTURE EXPECTATIONS: #{culture.presence || "Not provided"}
        COMPETENCY EXPECTATIONS: #{competency.presence || "Not provided"}

        DETERMINISTIC SKILL RESULTS:
        #{rows.join("\n")}

        Counts: match=#{counts["match"]}, gap=#{counts["gap"]}, exceeds=#{counts["exceed"]}, not_assessed=#{counts["not_assessed"]}.

        Return JSON only with two concise fields:
        {
          "culture_narrative": "2-3 sentences on the supplied culture/competency expectations only",
          "overall_narrative": "2-3 sentences summarizing skills while explicitly preserving human review"
        }
      PROMPT
    end

    def sanitize_narrative(text)
      text.to_s.strip.truncate(2_000)
    end

    def fallback_culture_narrative(counts)
      if @vacancy.culture_dimensions.blank? && @vacancy.competency_expectations.blank?
        "No culture or competency expectations were supplied for this role. Review the evidence and assessment context before drawing conclusions."
      else
        "Culture and competency expectations are provided as context, but this report does not independently validate them. A human assessor should review relevant evidence before making a decision."
      end
    end

    def fallback_overall_narrative(counts)
      "The comparison contains #{counts["match"]} match(es), #{counts["gap"]} gap(s), #{counts["exceed"]} skill(s) above the stated level, and #{counts["not_assessed"]} not-assessed skill(s). Not assessed does not mean unqualified; review evidence and context before any hiring decision."
    end

    def persist_result!(comparisons, narratives)
      # Optimistic version check prevents a slow/stale worker from overwriting
      # a newer report triggered after assessor changes.
      if @report && @generation_version
        @report.with_lock do
          @report.reload
          return if @report.generation_version != @generation_version.to_i

          @report.update!(
            skill_comparisons: comparisons,
            culture_narrative: narratives[:culture],
            overall_narrative: narratives[:overall],
            generated_at: Time.current,
            generation_status: "complete",
            generation_error: nil
          )
        end
      else
        report = FitGapReport.find_or_initialize_by(
          portfolio_id: @portfolio.id,
          vacancy_id: @vacancy.id
        )
        report.update!(
          skill_comparisons: comparisons,
          culture_narrative: narratives[:culture],
          overall_narrative: narratives[:overall],
          generated_at: Time.current,
          generation_status: "complete",
          generation_error: nil
        )
        @report = report
      end
    end
  end
end
