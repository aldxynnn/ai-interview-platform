# frozen_string_literal: true

require_relative 'boot'

require 'rails'
require 'active_model/railtie'
require 'active_record/railtie'
require 'action_controller/railtie'

require_relative '../app/middlewares/application_middleware'
require_relative '../app/middlewares/tenant_resolver_middleware'

Bundler.require(*Rails.groups)

module AiInterview
  class Application < Rails::Application
    config.load_defaults 7.0

    # API-only mode
    config.api_only = true

    # Keep custom app directories in the autoload path without mutating Rails'
    # potentially frozen default array (Ruby 3.3 / Rails 7.0).
    config.autoload_paths = config.autoload_paths + %W[
      #{'#{config.root}'}/app/auth
      #{'#{config.root}'}/app/lib
      #{'#{config.root}'}/app/middlewares
      #{'#{config.root}'}/app/services
      #{'#{config.root}'}/app/channels
      #{'#{config.root}'}/app/clients
      #{'#{config.root}'}/app/workers
    ]

    config.generators do |g|
      g.orm :active_record, primary_key_type: :uuid
    end

    config.middleware.use Rack::Attack
    config.middleware.use TenantResolverMiddleware
  end
end
