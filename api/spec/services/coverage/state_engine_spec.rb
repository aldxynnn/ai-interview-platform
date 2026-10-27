# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::StateEngine do
  describe '.valid_transition?' do
    context 'when transitioning from not_yet' do
      it 'allows transition to initiated regardless of probe_count' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 0)).to be true
        expect(described_class.valid_transition?(from: 'not_yet', to: 'initiated', probe_count: 1)).to be true
      end

      it 'disallows direct skip from not_yet to partial or covered' do
        expect(described_class.valid_transition?(from: 'not_yet', to: 'partial', probe_count: 3)).to be false
        expect(described_class.valid_transition?(from: 'not_yet', to: 'covered', probe_count: 5)).to be false
      end
    end

    context 'when transitioning from initiated' do
      it 'allows transition to partial if probe_count is at least 2' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 2)).to be true
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 4)).to be true
      end

      it 'blocks transition to partial if probe_count is less than 2' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 1)).to be false
        expect(described_class.valid_transition?(from: 'initiated', to: 'partial', probe_count: 0)).to be false
      end

      it 'disallows direct skip to covered' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'covered', probe_count: 4)).to be false
      end

      it 'disallows backwards transition to not_yet' do
        expect(described_class.valid_transition?(from: 'initiated', to: 'not_yet', probe_count: 2)).to be false
      end
    end

    context 'when transitioning from partial' do
      it 'allows transition to covered if probe_count is at least 2' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 2)).to be true
      end

      it 'blocks transition to covered if probe_count is less than 2' do
        expect(described_class.valid_transition?(from: 'partial', to: 'covered', probe_count: 1)).to be false
      end

      it 'disallows backwards transition to initiated or not_yet' do
        expect(described_class.valid_transition?(from: 'partial', to: 'initiated', probe_count: 3)).to be false
        expect(described_class.valid_transition?(from: 'partial', to: 'not_yet', probe_count: 3)).to be false
      end
    end

    context 'when already covered' do
      it 'disallows any further transition' do
        expect(described_class.valid_transition?(from: 'covered', to: 'partial', probe_count: 5)).to be false
        expect(described_class.valid_transition?(from: 'covered', to: 'not_yet', probe_count: 5)).to be false
      end
    end
  end

  describe '.resolve_state' do
    it 'returns current state if proposed state is the same' do
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'partial', probe_count: 3)).to eq('partial')
    end

    it 'returns current state if proposed state is backwards (monotonic forward invariant)' do
      expect(described_class.resolve_state(current_state: 'covered', proposed_state: 'initiated', probe_count: 5)).to eq('covered')
      expect(described_class.resolve_state(current_state: 'partial', proposed_state: 'not_yet', probe_count: 2)).to eq('partial')
    end

    it 'returns current state if proposed state is unknown' do
      expect(described_class.resolve_state(current_state: 'initiated', proposed_state: 'mastered', probe_count: 3)).to eq('initiated')
    end

    it 'steps forward sequentially from not_yet to covered when probe_count >= 2' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'covered',
        probe_count: 3
      )
      expect(resolved).to eq('covered')
    end

    it 'stops at initiated when probe_count < 2 even if Gemini proposed covered' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'covered',
        probe_count: 1
      )
      expect(resolved).to eq('initiated')
    end

    it 'cannot advance past initiated if probe_count is 0' do
      resolved = described_class.resolve_state(
        current_state: 'not_yet',
        proposed_state: 'partial',
        probe_count: 0
      )
      expect(resolved).to eq('initiated')
    end
  end
end
