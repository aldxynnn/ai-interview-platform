# frozen_string_literal: true

# Configure sensitive parameters which will be filtered from the log file.
# Protects candidate personal information in compliance with UU PDP (UU No. 27/2022).
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
  :candidate_name, :invite_token, :password, :password_confirmation
]
