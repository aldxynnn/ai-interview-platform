# frozen_string_literal: true

RSpec.configure do |config|
  config.order = :random
  config.disable_monkey_patching!
  config.expect_with(:rspec) { |expectations| expectations.include_chain_clauses_in_custom_matcher_descriptions = true }
end

require_relative '../app/services/sessions/startup_failure_handler'
