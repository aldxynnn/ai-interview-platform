# frozen_string_literal: true

# Zeitwerk derives constants from file names. The WebSocket acronym is
# registered so audio_websocket_middleware.rb maps to AudioWebSocketMiddleware.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym "WebSocket"
end
