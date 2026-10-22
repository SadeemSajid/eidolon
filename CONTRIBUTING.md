# Contributing

Start with README.md and AGENTS.md. Check the roadmap before taking on a major feature, and discuss architecture changes in an issue. Contributions to Eidolon are under MIT; third-party code retains its license.

Use Bun and the committed lockfile. Keep changes focused, explain the user-visible behavior and limitations, and run the relevant checks in docs/DEVELOPMENT.md. Include steps to reproduce UI changes. Add tests for meaningful domain rules and runtime behavior as those systems land.

Do not include proprietary guest images, credentials, build artifacts, or unrelated generated files. Keep upstream QEMU changes explicit and separately reviewed. Follow upstream licensing and contribution rules when modifying its source.

AI assistance is welcome. Contributors remain responsible for reviewing generated code, preserving provenance, and accurately reporting validation. AGENTS.md supplies shared context; do not commit private prompts or local session history.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for every new commit and PR title: `feat(boards): add peripheral coverage`, `fix(memory-map): preserve aliases`, or `chore: update development tooling`. Allowed types are feat, fix, docs, style, refactor, perf, test, build, ci, chore and revert. Scope is optional; append `!` before `:` for breaking changes.

Run `bun run setup:hooks` after cloning to enable the local commit-msg check. CI validates new commit subjects and PR titles; the two existing historical commits are not rewritten. Maintainers should require the Commit conventions check in branch protection. Repository files cannot force branch protection or prevent someone from bypassing a local hook.
