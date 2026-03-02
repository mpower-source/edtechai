# EdTech App

## Local development

1. npm ci
2. Create .env from .env.example and fill:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
3. npm run dev

## Authentication (Supabase)
- Visit /auth to sign in via magic link
- Ensure http://localhost:5173 is an allowed redirect in Supabase Auth settings

## Dark mode
- Uses next-themes with class strategy
- Toggle available (bottom-right floating button)

## Testing
- Vitest + React Testing Library
- npm run test, npm run test:watch, npm run test:coverage

## CI
- GitHub Actions runs lint + tests with coverage on pushes/PRs to main
