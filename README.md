## Local Development

Prerequisites:
- Node.js 20.x and npm 10+
- Git

Setup:
1. Clone the repo
   git clone https://github.com/mpower-source/edtechai.git
   cd edtechai
2. Install dependencies
   npm ci
3. Configure environment
   cp .env.example .env
   # Fill in values for your environment (see Environment Variables below)
4. Start the dev server
   npm run dev
5. Open http://localhost:5173

Common scripts:
- npm run dev: Start Vite dev server
- npm run build: Production build
- npm run preview: Preview production build
- npm run lint: Lint the codebase (if configured)

## Environment Variables

Vite exposes only variables prefixed with VITE_. Place them in a .env file at the project root.

Required/optional variables:
- VITE_API_URL: Base URL of your API (optional if not using a backend yet)
- VITE_SUPABASE_URL: Your Supabase project URL (required if using Supabase)
- VITE_SUPABASE_ANON_KEY: Your Supabase anon key (required if using Supabase)

Notes:
- Never commit real secrets. Use .env locally and deployment-specific secret managers in CI/CD.
- You can create other variables as needed, but they must start with VITE_.

---

