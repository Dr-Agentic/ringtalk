# Contributing to RingTalk

## Pre-push checklist

Run these before every commit:

```bash
npm run lint      # ESLint — no new violations
npm run typecheck # TypeScript — no new errors
npm test -- --run # Vitest — all tests pass
npm run dev:docker # Docker — image builds successfully
```

If any step fails, fix it before pushing.

## Why this matters

- `lint` / `typecheck` / `test` run in the CI **lint job** — failures block the PR
- `dev:docker` catches Dockerfile-layer bugs that `npm run build` alone won't (the build uses your local Docker daemon, not the CI runner)
- Catching failures locally means faster feedback and cleaner CI history

## Adding a new agent adapter

1. Create `src/agents/<name>.ts` implementing `AgentAdapter`
2. Add tests in `src/agents/<name>.test.ts`
3. Register in `src/gateway/registry.ts → buildRegistry()`
4. Update `SPEC.md` with the new agent's capabilities
5. Run the full pre-push checklist

## Adding a new dependency

If the new package brings a CLI binary (e.g. `tsc`, `esbuild`, `tsx`), add it to `dependencies` (not `devDependencies`) so it's available inside the Docker image. Then run `npm run dev:docker` to confirm the image still builds.
