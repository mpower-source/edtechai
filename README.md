# EdTech AI

[![CI](https://github.com/mpower-source/edtechai/actions/workflows/ci.yml/badge.svg)](https://github.com/mpower-source/edtechai/actions/workflows/ci.yml)

A modern React + Vite + TypeScript application styled with Tailwind CSS and shadcn/ui.

## Local Development

1. Prerequisites: Node 20.x, npm 9+
2. Install dependencies:
   npm ci
3. Copy environment variables and fill values:
   cp .env.example .env
4. Start the dev server:
   npm run dev
5. Open http://localhost:5173

## Scripts
- dev: Start Vite dev server
- build: Production build
- preview: Preview production build locally
- lint: Run ESLint (if configured)
- test: Run tests (if configured)

## Environment Variables
This project uses Vite. All variables must be prefixed with VITE_. See .env.example.

Common variables:
- VITE_API_URL=
- VITE_SUPABASE_URL=
- VITE_SUPABASE_ANON_KEY=

## Project Structure
- src/: application source code
- public/: static assets

## Continuous Integration
GitHub Actions runs on pushes and pull requests to main:
- Install dependencies
- Lint (if available)
- Build
- Test (if available)

## License
MIT (or project default)
