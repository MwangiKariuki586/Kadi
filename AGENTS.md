# Development Workflow (Strict)

You are assisting a solo developer. Enforce the following rules on every
interaction involving code changes. Do NOT skip or relax these.

## Git & Branching

- Never commit directly to `main`.
- Always create a branch named for the change type:
  `feat/<short-desc>`, `fix/<short-desc>`, `docs/<short-desc>`,
  `chore/<short-desc>`, `refactor/<short-desc>`, or `test/<short-desc>`.
- Keep branches short-lived (target: < 1 day of work).
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `chore:`,
  `docs:`, `refactor:`, `test:`.
- Squash-merge the `staging/integration-*` → `main` PR into `main`. Delete the
  integration branch after merge.

## Commit timing (verification first)

- Implement and stop. "Proceed" means implement only, not commit.
- Do not commit until I explicitly confirm the changes work.
- After my confirmation, commit locally on the change branch.
- Never push unless I explicitly say "push".

## Pushing (explicit permission only)

- Never push to any remote unless I explicitly say "push" (or an equivalent
  direct instruction such as "push it" / "push this branch").
- A request to commit, finish, review, or open a PR is **not** permission to
  push. Stop and ask first.
- This applies to every branch, including feature branches and `staging/*`.
- Never force-push.

## Pull Requests (`staging/integration-*` → `main` only)

- The only PR is `staging/integration-*` → `main`.
- Change branches merge into `staging/integration-*` locally; they do not get
  PRs.
- PR title = the squash-merge commit message.
- PR body must include: what changed, why, and how to verify.
- Before merging, re-read the full diff as a reviewer would.

## CI (GitHub Actions)

- The `staging/integration-*` → `main` PR must pass all checks before merge:
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

- **Staging:** the environment sourced from `staging/integration-*`. Pushing
  that branch (only on my explicit command) deploys it; I test changes here
  before they go to `main`.
- **Production:** deployed only after I explicitly confirm staging is good.
- The same artifact (image/binary) goes to both. Never rebuild for prod.

## Staging merging rules (`staging/integration-*` is the staging environment)

- `staging/integration-*` is the integration branch and the source of the
  staging environment. Staging exists to keep `main` safe.
- After I confirm the implementation works on the feature/fix branch, merge
  that branch into `staging/integration-*` locally with `git merge --no-ff`.
- No PR and no CI gate for feature/fix → staging merges.
- Stop after the local merge; push only on my explicit command. Pushing
  `staging/integration-*` deploys staging for me to test.
- Never force-push a shared branch. Never commit directly to `main`.
- Change branches may be deleted right after merging into staging.
- `staging/integration-*` → `main` requires a PR. Open it only after I confirm
  staging works. I approve the PR only when all checks are green; squash-merge
  and delete the integration branch after merge.

## Code Quality

- No `console.log` / `print()` / `TODO` left in merged code.
- No commented-out code blocks.
- New features require at least one test.
- If a change is > 200 lines, suggest splitting it into smaller branches/PRs.

## What I want from you

- When I say "I'm done with X" or confirm the changes work, commit locally on
  the change branch. Do not commit before that.
- Stop and ask before pushing. Only after I explicitly say "push" do you push.
- When I say "merge it" for a change branch, merge locally into
  `staging/integration-*` with `git merge --no-ff`; no PR or CI gate. Stop
  there; pushing staging deploys it and needs my explicit "push".
- When I say "merge it" for the staging → `main` PR, verify the PR and all
  checks are green first; I approve the PR. If not, tell me what's failing.
- When I say "deploy", confirm I've validated staging before touching prod.
- If I try to push to `main` directly or skip the staging → `main` PR, stop me
  and explain why.
