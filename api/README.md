# API local setup

The API uses Ruby 3.3.2, Rails 7, PostgreSQL, Redis/Sidekiq, and the Gemini API. Run commands from the api directory.

## Prerequisites

- Ruby 3.3.2 (see .ruby-version)
- Node.js and npm for the frontend
- PostgreSQL and Redis
- A Gemini API key for live AI generation

## Configure environment

Copy config/application.yml.sample to config/application.yml and fill in the required local values. Do not commit this file. Configure SECRET_KEY_BASE, database connection values, GEMINI_API_KEY, Gemini model names, REDIS_URL, ALLOWED_ORIGINS, and APP_BASE_URL.

## Install and start the API

    bundle install
    bundle exec rails db:prepare
    docker run --rm -p 6379:6379 --name rakamin-redis redis:alpine

In separate terminals, from api:

    bundle exec sidekiq -r ./config/environment.rb -C config/sidekiq.yml
    bundle exec rails server

Puma listens on port 3001 by default.

## Start the frontend

From the repository root:

    cd web
    npm install
    cp .env.example .env
    npm run dev

The Vite app is available at http://localhost:5173. The example environment file points REST and WebSocket traffic to the API default port 3001. Replace the development token and tenant values with credentials for your local environment.

## Verification

From api:

    bundle exec rspec

From web:

    npm test
    npm run build

AI-backed workflows require valid local Gemini credentials. Focused tests should use synthetic data and mocked AI responses and must not require a live provider key.
