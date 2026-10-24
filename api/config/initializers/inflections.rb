# frozen_string_literal: true

# Preserve the WebSocket acronym when Zeitwerk camelizes middleware filenames.
ActiveSupport::Inflector.inflections(:en) do |inflect|
  inflect.acronym 'WebSocket'
end
