# Contributing

Thanks for your interest in contributing!

## Getting started
- Node.js 20.x
- pnpm or npm
- Copy .env.example to .env and fill required values
- Install deps: `npm ci`
- Start dev server: `npm run dev`

## Development workflow
- Lint: `npm run lint`
- Format: `npm run format`
- Test: `npm run test`
- Commit: pre-commit hooks will run lint-staged (eslint + prettier)

## Branching and PRs
- Use conventional commits (e.g., `feat: ...`, `fix: ...`, `chore: ...`)
- Create feature branches off `main`
- Open PRs with clear description, screenshots for UI changes

## Code style
- TypeScript strictness preferred
- Keep components small and typed
- Prefer TanStack Query for server state, React Router for routing

## Security
- Do not include secrets in code or commits
- Report vulnerabilities via Security Advisories (see SECURITY.md)
