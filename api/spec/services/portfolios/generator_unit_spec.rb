# frozen_string_literal: true

require 'spec_helper'
require 'active_support/all'
require 'ostruct'
require 'json'

# Mock Rails.logger if Rails is not loaded
module Rails
  def self.logger
    @logger ||= Class.new {
      def info(*); end
      def error(*); end
      def warn(*); end
      def debug(*); end
    }.new
  end
end

# Minimal ActiveModel::Dirty stub so update! works on OpenStruct
# (In production this is a real AR model — here we test the logic branch only)
class MockPortfolioSkillsCollection
  include Enumerable

  attr_reader :skills

  def initialize(skills = [])
    @skills = skills
  end

  def each(&block)
    @skills.each(&block)
  end

  def to_a
    @skills.dup
  end

  def create!(attrs)
    skill = OpenStruct.new(attrs.merge(id: rand(1000..9999), assessor_override: nil))
    @skills << skill
    skill
  end
end

require_relative '../../../app/clients/gemini/http_client'
require_relative '../../../app/services/portfolios/generator'

RSpec.describe Portfolios::Generator do
  describe '#save_skills (unit — no DB)' do
    let(:existing_override) do
      OpenStruct.new(
        id:             99,
        ai_level:       2,
        override_level: 4,
        assessor_notes: 'Demonstrated deep production React knowledge',
        overridden_by:  1,
        overridden_at:  Time.now
      )
    end

    let(:existing_skill) do
      OpenStruct.new(
        id:                101,
        skill_id:          'SK-ENG-001',
        skill_label:       'React / Frontend Development',
        ai_level:          2,
        ai_confidence:     'medium',
        evidence:          ['old quote'],
        competency_summary: 'old summary',
        is_discovered:     false,
        assessor_override: existing_override
      )
    end

    let(:portfolio_skills_collection) do
      MockPortfolioSkillsCollection.new([existing_skill])
    end

    let(:portfolio) do
      OpenStruct.new(id: 1, portfolio_skills: portfolio_skills_collection)
    end

    let(:response) do
      {
        'configured_skills' => [
          {
            'skill_id'           => 'SK-ENG-001',
            'skill_label'        => 'React / Frontend Development',
            'level'              => 3,
            'confidence'         => 'high',
            'evidence'           => ['new quote 1', 'new quote 2'],
            'competency_summary' => 'Refined summary after re-evaluating transcript.'
          }
        ],
        'discovered_skills' => []
      }
    end

    let(:generator) { described_class.allocate }

    it 'updates the existing skill record in-place rather than destroying it' do
      destroyed = false
      existing_skill.define_singleton_method(:destroy) { destroyed = true }
      existing_skill.define_singleton_method(:update!) do |attrs|
        attrs.each { |k, v| send(:"#{k}=", v) }
      end

      generator.send(:save_skills, portfolio, response)

      expect(destroyed).to be(false),
        'Expected existing skill NOT to be destroyed (would cascade-destroy assessor_override)'
    end

    it 'reflects the new AI level after update' do
      existing_skill.define_singleton_method(:destroy) { raise 'destroy must not be called' }
      existing_skill.define_singleton_method(:update!) do |attrs|
        attrs.each { |k, v| send(:"#{k}=", v) }
      end

      generator.send(:save_skills, portfolio, response)

      expect(existing_skill.ai_level).to eq(3)
      expect(existing_skill.ai_confidence).to eq('high')
      expect(existing_skill.evidence).to eq(['new quote 1', 'new quote 2'])
    end

    it 'preserves the assessor_override reference on the existing skill' do
      existing_skill.define_singleton_method(:destroy) { raise 'destroy must not be called' }
      existing_skill.define_singleton_method(:update!) do |attrs|
        attrs.each { |k, v| send(:"#{k}=", v) }
      end

      generator.send(:save_skills, portfolio, response)

      # assessor_override is NOT touched by save_skills — it stays linked
      expect(existing_skill.assessor_override).to eq(existing_override)
      expect(existing_skill.assessor_override.override_level).to eq(4)
    end

    it 'creates a new skill record for skills not previously present' do
      existing_skill.define_singleton_method(:destroy) { raise 'destroy must not be called' }
      existing_skill.define_singleton_method(:update!) { |attrs| }

      new_response = response.merge(
        'discovered_skills' => [
          {
            'skill_label'        => 'Docker / Containerisation',
            'level'              => 2,
            'confidence'         => 'medium',
            'evidence'           => ['I use Docker for local dev'],
            'competency_summary' => 'Uses Docker for local environments.'
          }
        ]
      )

      expect {
        generator.send(:save_skills, portfolio, new_response)
      }.to change { portfolio_skills_collection.skills.size }.by(1)

      new_skill = portfolio_skills_collection.skills.find { |s| s.skill_label == 'Docker / Containerisation' }
      expect(new_skill).not_to be_nil
      expect(new_skill.is_discovered).to be(true)
    end

    it 'does not call destroy on a skill that matches by normalised label' do
      # skill_id nil, match only by label (case-insensitive)
      label_only_skill = OpenStruct.new(
        id:                 200,
        skill_id:           nil,
        skill_label:        'python scripting',
        ai_level:           1,
        ai_confidence:      'low',
        evidence:           [],
        competency_summary: 'Basic',
        is_discovered:      true,
        assessor_override:  nil
      )

      destroyed = false
      label_only_skill.define_singleton_method(:destroy) { destroyed = true }
      label_only_skill.define_singleton_method(:update!) do |attrs|
        attrs.each { |k, v| send(:"#{k}=", v) }
      end

      collection = MockPortfolioSkillsCollection.new([label_only_skill])
      p = OpenStruct.new(id: 2, portfolio_skills: collection)

      resp = {
        'configured_skills' => [],
        'discovered_skills' => [
          {
            'skill_label'        => 'Python Scripting',   # different casing
            'level'              => 2,
            'confidence'         => 'medium',
            'evidence'           => ['I automate with Python'],
            'competency_summary' => 'Uses Python for scripting tasks.'
          }
        ]
      }

      generator.send(:save_skills, p, resp)

      expect(destroyed).to be(false)
      expect(label_only_skill.ai_level).to eq(2)
    end

    it 'NEVER destroys a skill that has an assessor override even if the AI response completely omits it' do
      # AI response drops this skill entirely (omission / hallucination)
      empty_ai_response = {
        'configured_skills' => [],
        'discovered_skills' => []
      }

      destroyed = false
      existing_skill.define_singleton_method(:destroy) { destroyed = true }

      generator.send(:save_skills, portfolio, empty_ai_response)

      expect(destroyed).to be(false),
        'Assessor override must NEVER be destroyed when AI omits the skill from response'
    end
  end
end
