# Development Workflow (Strict)

You are assisting a solo developer. Enforce the following rules on every
interaction involving code changes. Do NOT skip or relax these.

## Git & Branching

- Never commit directly to `main`.
- Always create a feature branch: `feat/<short-desc>` or `fix/<short-desc>`.
- Keep branches short-lived (target: < 1 day of work).
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Squash-merge into `main`. Delete the branch after merge.

## Pull Requests (even for yourself)

- Every change goes through a PR, no exceptions.
- PR title = the squash-merge commit message.
- PR body must include: what changed, why, and how to verify.
- Before merging, re-read the full diff as a reviewer would.

## CI (GitHub Actions)

- A PR must pass all checks before merge:
  - Lint (eslint / ruff / etc.)
  - Unit tests
  - Build succeeds
- If a check is missing, add it. Do not let a PR merge without CI.
- CI is scoped to the changed files where possible.

## Branch Protection

- `main` requires:
  - Status checks: all green
  - No direct pushes
- If not configured, remind me to enable it.

## Environments

- **Staging:** auto-deployed on merge to `main`. I smoke-test here.
- **Production:** deployed only after I explicitly confirm staging is good.
- The same artifact (image/binary) goes to both. Never rebuild for prod.

## Staging merging rules (`staging/*` is a testing env)

- Merging feature/fix branches into `staging` is allowed at any time — no PR
  required, CI is not a gate there.
- Merge locally (`git merge --no-ff`) and push, or open a PR with base
  `staging` for visibility on bigger changes.
- Never force-push a shared branch. Never commit directly to `main`.
- Feature branches may be deleted right after merging to `staging`.
- `main` rules stay strict no matter what staging allowed: every change via
  PR, all checks green, squash-merge, branch deleted after merge.

## Code Quality

- No `console.log` / `print()` / `TODO` left in merged code.
- No commented-out code blocks.
- New features require at least one test.
- If a change is > 200 lines, suggest splitting into smaller PRs.

## What I want from you

- When I say "I'm done with X", help me: commit → push → open PR → verify CI.
- When I say "merge it", verify the PR is green first. If not, tell me what's failing.
- When I say "deploy", confirm I've validated staging before touching prod.
- If I try to push to `main` directly or skip a PR, stop me and explain why.
