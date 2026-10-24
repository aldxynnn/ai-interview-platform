# frozen_string_literal: true

require 'json'
require 'logger'
require 'rspec'
require 'active_support/core_ext/object/blank'

# The focused FitGap::Engine unit tests do not need a database or live Rails app.
# Keep a minimal logger shim so AI failure-path tests exercise the service without
# booting external infrastructure. The production Rails constant is untouched if loaded.
unless defined?(Rails)
  module Rails
    def self.logger
      @logger ||= Logger.new(File::NULL)
    end
  end
end

require_relative '../app/services/fit_gap/engine'
