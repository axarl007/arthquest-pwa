# Project skills

Claude Code skills available in every future session of this repo (`.claude/skills/` is discovered automatically — nothing to install). These are vendored, editable copies, not a live subscription: pull updates by hand from the source when wanted, not automatically.

## Included

- **`grill-me`** (user-invoked) — relentless one-question-at-a-time interview to sharpen a plan or design before implementation. Delegates to `grilling`.
- **`grilling`** (model-invoked) — the reusable interview primitive `grill-me` runs. Works the "design tree" in rounds, one frontier of questions at a time.
- **`to-tickets`** (user-invoked) — break a plan/spec/conversation into tracer-bullet tickets with explicit blocking edges, published to this repo's issue tracker (GitHub Issues, per `CLAUDE.md`) or as local files.
- **`implement`** (user-invoked) — implement a spec or set of tickets, using `/tdd` at pre-agreed seams where available and `/code-review` before committing.

## Source

Copied from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT licensed — see `LICENSE` in that repo). To pull updates, re-copy the relevant `skills/<category>/<name>/SKILL.md` files from that repo and re-review against this project's own conventions in `CLAUDE.md`.
