# Contributing

Thanks for your interest in contributing to jev-pii-checker!

## Development Setup

```bash
git clone https://github.com/coo-quack/jev-pii-checker.git
cd jev-pii-checker
bun install
```

Scanning needs a TypeSafe API key in `TYPESAFE_API_KEY`. Unit tests do not
call the API; the integration test does, and only when
`JEV_PII_INTEGRATION=1` is set.

## Commands

```bash
bun run dev -- file.txt   # Run the CLI from source
bun run test              # Unit tests (Vitest)
bun run typecheck         # Type check (TypeScript 7, native compiler)
bun run lint              # oxlint
bun run format            # oxfmt (write)
bun run format:check      # oxfmt (check only)
bun run knip              # Unused files, exports and dependencies
bun run ci                # lint + format:check + typecheck + test + knip
bun run build             # Bundle dist/cli.js for Node
bun run docs:dev          # VitePress dev server
```

`bun run ci` is exactly what the five required CI checks run.

## Branching Strategy

```
main
 ├── develop          ← integration branch
 │    └── <type>/*   ← everything that is not an urgent production fix
 └── hotfix/*        ← urgent production fixes
```

### Normal development

```
<type>/your-change  →  develop  →  main (release)
```

1. Branch from `develop`: `git checkout -b feat/your-change develop`
2. Open a PR targeting `develop`
3. After CI passes, merge into `develop`
4. When ready to release, open a PR from `develop` → `main`

### Hotfix

1. Branch from `main`: `git checkout -b hotfix/fix-description main`
2. Apply the fix and open a PR targeting `main`
3. After review and approval, merge into `main`
4. `backport.yml` opens the sync PR into `develop` automatically

If the sync PR has conflicts, resolve them manually before merging.

## Release Checklist

When bumping a version, open a PR from `develop` → `main` with:

1. Update `version` in `package.json`
2. Add a `## vX.Y.Z (YYYY-MM-DD)` section to `CHANGELOG.md`
   - `release.yml` extracts that section as the GitHub Release notes, so the
     heading must start with `## vX.Y.Z`
3. Review `README.md` and the pages under `docs/` for changed flags or behavior

After merging into `main`, `release.yml` automatically:

- Publishes `@coo-quack/jev-pii-checker` to npm with provenance
- Creates the git tag `vX.Y.Z`
- Creates a GitHub Release with the notes from `CHANGELOG.md`

`docs.yml` redeploys the documentation site on every merge to `main`.

## Pull Requests

- Feature PRs target `develop`, release/hotfix PRs target `main`
- Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`)
- `bun run ci` must pass
- Keep the CI job names (`audit`, `lint`, `typecheck`, `test`, `knip`) unchanged: they are required status checks managed in coo-quack/iac

## Code Style

Enforced by [oxlint](https://oxc.rs/docs/guide/usage/linter) and
[oxfmt](https://oxc.rs/docs/guide/usage/formatter). Run `bun run format`
before committing. Test fixtures contain synthetic PII only; never add real
names, addresses or numbers.
