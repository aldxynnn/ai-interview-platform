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
    rescue => e
      portfolio&.update!(generation_status: 'failed', generation_error: e.message)
      Rails.logger.error("[N10] Portfolio generation failed for session #{@session.id}: #{e.class} #{e.message}")
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

    def save_skills(portfolio, response)
      data = validated_response(response)
      desired_rows = data.fetch("configured_skills") + data.fetch("discovered_skills")
      existing = portfolio.portfolio_skills.includes(:assessor_override).to_a

      # Only commit a complete, validated AI response. A failed insert/update rolls
      # the whole replacement back and keeps the previous portfolio available.
      PortfolioSkill.transaction do
        retained_ids = []

        desired_rows.each do |attributes|
          current = existing.find { |skill| same_skill?(skill, attributes) }
          if current
            current.update!(attributes)
            # Preserve the assessor's chosen level and notes while keeping the
            # baseline AI score in sync with the newly generated assessment.
            current.assessor_override&.update!(ai_level: current.ai_level)
            retained_ids << current.id
          else
            created = portfolio.portfolio_skills.create!(attributes)
            retained_ids << created.id
          end
        end

        existing.each do |skill|
          next if retained_ids.include?(skill.id)
          # Never cascade-delete a recorded human override during regeneration.
          next if skill.assessor_override.present?

          skill.destroy!
        end
      end
    end

    def validated_response(response)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      unless data.is_a?(Hash) && data["configured_skills"].is_a?(Array) && data["discovered_skills"].is_a?(Array)
        raise JSON::ParserError, "Expected configured_skills and discovered_skills arrays"
      end

      configured_definitions = @session.assessment.assessment_skills.order(:display_order).to_a
      candidate_turns = @session.transcript_turns.where(speaker: "candidate").pluck(:text)
      configured = validate_skill_rows(data["configured_skills"], discovered: false, configured_definitions:, candidate_turns:)
      discovered = validate_skill_rows(data["discovered_skills"], discovered: true, configured_definitions:, candidate_turns:)

      keys = (configured + discovered).map do |row|
        [row[:is_discovered], row[:skill_id], row[:skill_label].downcase]
      end
      raise JSON::ParserError, "Duplicate skill rows returned by the model" unless keys.uniq.length == keys.length

      missing = configured_definitions.reject do |definition|
        configured.any? do |row|
          if definition.skill_id.present?
            row[:skill_id] == definition.skill_id
          else
            row[:skill_label].casecmp?(definition.skill_label)
          end
        end
      end
      raise JSON::ParserError, "Model response omitted configured assessment skills" if missing.any?

      { "configured_skills" => configured, "discovered_skills" => discovered }
    end

    def validate_skill_rows(rows, discovered:, configured_definitions:, candidate_turns:)
      rows.map do |raw|
        raise JSON::ParserError, "Skill row must be an object" unless raw.is_a?(Hash)

        label = raw["skill_label"]
        level = raw["level"]
        confidence = raw["confidence"]
        evidence = raw["evidence"]
        summary = raw["competency_summary"]

        raise JSON::ParserError, "Skill label missing" unless label.is_a?(String) && label.strip.present?
        raise JSON::ParserError, "Skill level must be an integer from 1 to 5" unless level.is_a?(Integer) && level.between?(1, 5)
        raise JSON::ParserError, "Invalid skill confidence" unless PortfolioSkill::CONFIDENCE_LEVELS.include?(confidence)
        raise JSON::ParserError, "Evidence must be an array of strings" unless evidence.is_a?(Array) && evidence.all? { |quote| quote.is_a?(String) }
        raise JSON::ParserError, "Competency summary missing" unless summary.is_a?(String) && summary.strip.present?

        skill_id = nil
        if discovered
          raise JSON::ParserError, "Discovered skill duplicates a configured skill" if configured_definitions.any? { |definition| definition.skill_label.casecmp?(label.strip) }
        else
          raw_id = raw["skill_id"]
          raise JSON::ParserError, "Skill ID must be a string or null" if raw_id.present? && !raw_id.is_a?(String)
          definition = if raw_id.present?
                         configured_definitions.find { |item| item.skill_id == raw_id }
                       else
                         configured_definitions.find { |item| item.skill_id.blank? && item.skill_label.casecmp?(label.strip) }
                       end
          raise JSON::ParserError, "Model returned an unknown configured skill" unless definition
          skill_id = definition.skill_id
          label = definition.skill_label
        end

        supported_evidence = evidence.map(&:strip).reject(&:blank?).uniq.select do |quote|
          normalized_quote = normalize_quote(quote)
          normalized_quote.present? && candidate_turns.any? do |turn|
            normalize_quote(turn).include?(normalized_quote)
          end
        end.first(3)

        {
          skill_id: skill_id,
          skill_label: label.strip,
          is_discovered: discovered,
          ai_level: level,
          ai_confidence: confidence,
          evidence: supported_evidence,
          competency_summary: summary.strip
        }
      end
    end

    def normalize_quote(value)
      value.to_s.downcase.gsub(/\s+/, " ").strip
    end

    def same_skill?(existing, attributes)
      return false unless existing.is_discovered == attributes[:is_discovered]

      if attributes[:skill_id].present?
        existing.skill_id == attributes[:skill_id]
      else
        existing.skill_label.casecmp?(attributes[:skill_label])
      end
    end
  end
end
