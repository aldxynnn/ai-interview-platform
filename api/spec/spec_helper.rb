# frozen_string_literal: true

require "logger"
require "active_support/all"

class PortfolioSkill
  CONFIDENCE_LEVELS = %w[high medium low].freeze unless const_defined?(:CONFIDENCE_LEVELS)
end unless defined?(PortfolioSkill)

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    expectations.syntax = :expect
  end

  config.mock_with :rspec do |mocks|
    mocks.syntax = :expect
  end

  config.disable_monkey_patching!
  config.order = :random
  Kernel.srand config.seed
end
