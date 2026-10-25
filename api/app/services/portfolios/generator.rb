# frozen_string_literal: true

module Portfolios
  # N10: Generates a structured skill portfolio from the full transcript
  # and final coverage map using Gemini Pro.
  # Runs post-session as a background job.
  class Generator
    def initialize(session:, gemini_client: nil)
      @session = session
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model:   ENV.fetch('GEMINI_PRO_MODEL', 'gemini-2.0-pro-001'),
        timeout: 180  # up to 3 minutes for large transcripts
      )
    end

    # Returns the Portfolio record with skills populated.
    def call
      portfolio = @session.portfolio || @session.create_portfolio!(
        candidate_id:      @session.candidate_id,
        generation_status: 'pending'
      )

      portfolio.update!(generation_status: 'generating')

      prompt   = build_prompt
      response = @gemini_client.generate_content(prompt, temperature: 0.2)

      save_skills(portfolio, response)
      portfolio.update!(generation_status: 'complete', generated_at: Time.current)

      Rails.logger.info("[N10] Portfolio generated for session #{@session.id}")
      portfolio
    rescue StandardError => e
      portfolio&.update!(generation_status: 'failed', generation_error: 'Portfolio generation failed. Please retry or contact support.')
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id} error_class=#{e.class.name}")
      raise
    end

    private

    def build_prompt
      assessment       = @session.assessment
      configured_skills = assessment.assessment_skills.order(:display_order)
      coverage_maps     = @session.coverage_maps.order(:id)
      turns             = @session.transcript_turns.ordered

      skills_text = configured_skills.map { |s| skill_definition_block(s) }.join("\n\n")

      coverage_json = {
        skills:     coverage_maps.reject(&:is_discovered).map { |m| coverage_json(m) },
        discovered: coverage_maps.select(&:is_discovered).map { |m| coverage_json(m) }
      }.to_json

      transcript_text = turns.map { |t| "[#{t.speaker.upcase}]: #{t.text}" }.join("\n")

      <<~PROMPT
        You are evaluating a completed skills assessment interview to produce a structured skill portfolio.

        ROLE BEING ASSESSED: #{assessment.name}

        SKILL DEFINITIONS AND BEHAVIORAL ANCHORS:
        #{skills_text}

        UNIVERSAL L1-L5 ANCHORS (use for discovered skills):
        L1 — Executes with explicit guidance and close review. Understands conceptually but cannot apply independently.
        L2 — Executes independently on routine scope. Uses known patterns. Handles common cases but not edge cases.
        L3 — Executes complex, ambiguous scope. Makes tradeoffs. Handles edge cases. Can teach L1-L2.
        L4 — Defines standards and creates reusable systems. Resolves systemic problems. Cross-team impact.
        L5 — Org-level authority. Shapes how the skill is practiced. Rare.

        FINAL COVERAGE MAP:
        #{coverage_json}

        FULL INTERVIEW TRANSCRIPT:
        #{transcript_text}

        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        TASK
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        For EACH skill in the coverage map (both configured and discovered):

        1. FIND THE EVIDENCE
           Read all transcript turns where this skill was discussed.
           Identify the 2-3 most revealing quotes from the CANDIDATE (not the AI).
           A quote is revealing if it shows HOW they think, not just WHAT they know.

        2. ASSIGN A LEVEL
           Compare the candidate's actual behavior to the L1-L5 anchors.
           Assign the highest level where you see CONSISTENT evidence, not just one strong moment.
           If evidence is mixed (mostly L2 with one L3 moment), assign L2.

        3. WRITE THE COMPETENCY SUMMARY
           2-3 sentences. Focus on patterns, not individual answers.
           What does this person reliably do at this skill? What's the ceiling? What's missing?

        4. ASSIGN CONFIDENCE
           high — probe_count >= 3 AND state = covered
           medium — probe_count = 2 OR state = partial
           low — probe_count <= 1 OR state = initiated

        OUTPUT (JSON only, no prose):
        {
          "configured_skills": [
            {
              "skill_id": "sk-eng-001",
              "skill_label": "React / Frontend Development",
              "level": 3,
              "confidence": "high",
              "evidence": ["quote 1", "quote 2", "quote 3"],
              "competency_summary": "2-3 sentence summary"
            }
          ],
          "discovered_skills": [
            {
              "skill_label": "Micro-frontend Architecture",
              "level": 2,
              "confidence": "low",
              "evidence": ["quote 1"],
              "competency_summary": "2-3 sentence summary"
            }
          ]
        }
      PROMPT
    end

    def skill_definition_block(skill)
      lines = ["━━━━━━━━━━━━━━━"]
      lines << "SKILL: #{skill.skill_label} (#{skill.skill_id || 'custom'})"
      lines << "SCOPE: #{skill.scope_include}" if skill.scope_include.present?
      lines << ""
      lines << "L1 — #{skill.l1_anchor}"
      lines << "L2 — #{skill.l2_anchor}"
      lines << "L3 — #{skill.l3_anchor}"
      lines << "L4 — #{skill.l4_anchor}"
      lines << "L5 — #{skill.l5_anchor}"
      lines.join("\n")
    end

    def coverage_json(map)
      {
        id:          map.skill_id || map.skill_label.downcase.gsub(/\s+/, '-'),
        label:       map.skill_label,
        state:       map.state,
        probe_count: map.probe_count,
        is_discovered: map.is_discovered
      }
    end

    class InvalidResponse < StandardError; end

    def save_skills(portfolio, response)
      data = normalize_response(response)
      configured = data.fetch(:configured_skills)
      discovered = data.fetch(:discovered_skills)

      overrides = portfolio.portfolio_skills.includes(:assessor_override).filter_map do |skill|
        override = skill.assessor_override
        next unless override

        key = skill_identity(skill_id: skill.skill_id, skill_label: skill.skill_label, discovered: skill.is_discovered)
        [key, {
          override_level: override.override_level,
          assessor_notes: override.assessor_notes,
          overridden_by: override.overridden_by,
          overridden_at: override.overridden_at
        }]
      end.to_h

      output_keys = configured.map { |skill| skill_identity(skill_id: skill[:skill_id], skill_label: skill[:skill_label], discovered: false) } +
                    discovered.map { |skill| skill_identity(skill_id: nil, skill_label: skill[:skill_label], discovered: true) }
      raise InvalidResponse, "Generated portfolio contains duplicate skills" unless output_keys.uniq.length == output_keys.length

      missing_overrides = overrides.keys - output_keys
      if missing_overrides.any?
        raise InvalidResponse, "Generated portfolio omitted a skill with an assessor override"
      end

      coverage_maps = @session.coverage_maps.order(:id).to_a
      expected_configured = coverage_maps.reject(&:is_discovered).map do |map|
        skill_identity(skill_id: map.skill_id, skill_label: map.skill_label, discovered: false)
      end
      expected_discovered = coverage_maps.select(&:is_discovered).map do |map|
        skill_identity(skill_id: nil, skill_label: map.skill_label, discovered: true)
      end

      unless configured.map { |skill| skill_identity(skill_id: skill[:skill_id], skill_label: skill[:skill_label], discovered: false) }.sort == expected_configured.sort &&
             discovered.map { |skill| skill_identity(skill_id: nil, skill_label: skill[:skill_label], discovered: true) }.sort == expected_discovered.sort
        raise InvalidResponse, "Generated portfolio does not match the session coverage map"
      end

      PortfolioSkill.transaction do
        # If any insert or override recreation fails, rollback restores the old portfolio.
        portfolio.portfolio_skills.destroy_all
        configured.each { |skill| persist_skill!(portfolio, skill, discovered: false, overrides: overrides) }
        discovered.each { |skill| persist_skill!(portfolio, skill, discovered: true, overrides: overrides) }
      end
    rescue JSON::ParserError
      raise InvalidResponse, "Generated portfolio was not valid JSON"
    end

    def normalize_response(response)
      parsed = response.is_a?(Hash) ? response : JSON.parse(response.to_s)
      raise InvalidResponse, "Generated portfolio must be a JSON object" unless parsed.is_a?(Hash)

      data = parsed.with_indifferent_access
      unless data[:configured_skills].is_a?(Array) && data[:discovered_skills].is_a?(Array)
        raise InvalidResponse, "Generated portfolio must contain configured_skills and discovered_skills arrays"
      end

      {
        configured_skills: data[:configured_skills].map { |item| normalize_skill(item, discovered: false) },
        discovered_skills: data[:discovered_skills].map { |item| normalize_skill(item, discovered: true) }
      }
    end

    def normalize_skill(item, discovered:)
      raise InvalidResponse, "Generated skill must be a JSON object" unless item.is_a?(Hash)

      skill = item.with_indifferent_access
      label = skill[:skill_label].to_s.strip
      level = skill[:level].to_s
      confidence = skill[:confidence].to_s.downcase
      evidence = skill[:evidence]
      summary = skill[:competency_summary].to_s.strip

      raise InvalidResponse, "Generated skill needs a label and level from 1 to 5" unless label.present? && level.match?(/\A[1-5]\z/)
      raise InvalidResponse, "Generated skill has an invalid confidence level" unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
      raise InvalidResponse, "Generated skill evidence must be an array of strings" unless evidence.is_a?(Array) && evidence.all? { |quote| quote.is_a?(String) }
      raise InvalidResponse, "Generated skill needs a competency summary" if summary.blank?

      {
        skill_id: discovered ? nil : skill[:skill_id].presence,
        skill_label: label,
        level: level.to_i,
        confidence: confidence,
        evidence: evidence.map(&:strip).reject(&:blank?).first(3),
        competency_summary: summary
      }
    end

    def skill_identity(skill_id:, skill_label:, discovered:)
      normalized_label = skill_label.to_s.strip.downcase.gsub(/\s+/, " ")
      return "discovered:#{normalized_label}" if discovered

      skill_id.present? ? "configured:id:#{skill_id.to_s.strip}" : "configured:label:#{normalized_label}"
    end

    def persist_skill!(portfolio, skill_data, discovered:, overrides:)
      skill = portfolio.portfolio_skills.create!(
        skill_id: skill_data[:skill_id],
        skill_label: skill_data[:skill_label],
        is_discovered: discovered,
        ai_level: skill_data[:level],
        ai_confidence: skill_data[:confidence],
        evidence: skill_data[:evidence],
        competency_summary: skill_data[:competency_summary]
      )

      key = skill_identity(skill_id: skill.skill_id, skill_label: skill.skill_label, discovered: discovered)
      override_attributes = overrides.delete(key)
      return unless override_attributes

      skill.create_assessor_override!(override_attributes.merge(ai_level: skill.ai_level))
    end
  end
end
