# Fishers: notes for Claude

On any resume or new session, read PROGRESS.md first and continue from "Next action." Never redo completed steps. Never deploy with failing tests.

- Resume routine: `git status`, `git log -5`, read PROGRESS.md, re-run the check for the last completed step, then continue.
- Before any long-running step, write the next action to PROGRESS.md first.
- Update PROGRESS.md and commit after every completed sub-step.
- Never publish anything from the reference game (its scripts, results, screenshots, videos or notes). They are gitignored; keep it that way.
- Content rules: answers must be named in the 66-book Protestant canon at a cited verse; quote WEB (KJV for famous phrasings); never invent verses. Run `node tools/verify.js` and `node tools/validate.js` after any content change.
