# Workflow: plan → consent → implement → test → handoff

One task envelope, one plan, one consent, one branch. The caller (the main conversation or another
orchestrating agent) talks to the user; `ui-developer` never does. Several `ui-developer` runs may
work in parallel with different goals: each keeps its notes in its own output dir and touches only
the files its plan lists.

## 1. Plan

Read only what the plan needs, in this order:

1. The envelope: objective, type of work, product repo path, source of truth, design scope
   (platform, roles), language, constraints, output dir, return budget, consent state. `BRIEF.md`
   only when the envelope gives its path.
2. `stack-detect.mjs <repo>`: UI stack and version, styling mechanism, test runner, lint/format
   commands, package manager, `CLAUDE.md` / `AGENTS.md` and project skill names.
3. The repo's `CLAUDE.md` / `AGENTS.md` (plan run only): branch naming, base branch, commit format, TDD, checks that
   are already red, forbidden areas.
4. Only the project skills that cover the files you will touch (`.claude/skills/<name>/SKILL.md`).
5. The source of truth: the prototype screen (locate it in the showcase with `rg -n`; never read a
   showcase page whole), the design system or `tokens.css`, and the existing component nearest to
   what you build. Reuse beats new code.

Then copy `assets/plan-template.md` to `<output dir>/PLAN.md` and fill it:

| Plan field | Content |
|---|---|
| Branch | Name per convention (`feature/…`, `fix/…`, task id when the convention asks) and its base |
| Files | Every file to create or modify, with the change and the reason |
| Tokens | Which tokens the change uses and how they reach the code (see `token-mapping.md`) |
| Tests | Tests to add or adjust; RED first when the project declares TDD |
| Commands | The test, lint and format commands from `stack-detect`, exactly as the project runs them |
| Dependencies | None, or each one with version and why (needs its own consent) |
| Out of scope | What the change does not do |
| Questions | Questionnaire items that block part of the plan |

The base branch is the convention's, never a guess: unknown → questionnaire item with the
candidates found (`git branch -a`, read-only).

## 2. Consent

Return the plan and stop. The return is: plan path, branch, file list, commands, questions. The
caller asks the user and re-invokes with `consent: granted` and the plan path.

- Consent covers that plan only: those files, that branch, no new dependency.
- During implementation, a new file in the same component folder that the plan's change needs (a
  spec, a template, a style file) is inside the plan. Anything else — another feature's folder,
  shared configuration, build files, a dependency, a migration, a global stylesheet — stops the work:
  return the plan delta and wait for a new consent.
- Without consent, nothing is written in the product repo: no branch, no file, no stash, no
  formatting run.

## 3. Implement

- Start from `PLAN.md`: do not repeat the stack detection or the convention reads; re-read only the files you will edit.
- Create the branch from the agreed base. Work only in the product repo path from the envelope.
- Follow the project's patterns: the nearest existing component, its state management, its
  folder structure, its i18n mechanism. A new pattern is a question, not a choice.
- Apply tokens per `token-mapping.md` and the checklist in `checklist.md` (responsive,
  accessibility, loading / empty / error states, motion with reduced motion).
- Copy comes from the prototype or the brief. Missing copy → placeholder clearly marked in the note,
  and a question; never invented business text.
- Optional design skills, only when listed in the session and never required: `frontend-design`,
  `emil-design-eng`, `animate`, `mobile-native`, `break-ui`, `web-design-guidelines`. The project's
  conventions win any conflict.

## 4. Test

- TDD declared by the project (its `CLAUDE.md`, `AGENTS.md`, or the envelope): write the failing
  test, run it and record the RED result, implement, record GREEN, then refactor.
- No TDD declared: write or adjust tests with the change, matching the project's runner and style.
- Run the project's commands from the plan on the touched files: tests, lint, format. A formatter
  that rewrites files runs before the commit, never after.
- Report `<command>: <result>`. A failure that also happens on the base branch is pre-existing:
  name it (test or rule name), compare with the base, never fix it out of scope.
- What only a real device, a real printer or real data can validate is pending, never verified.

## 5. Commit

- Commit format, scope and body follow the project's convention (task id where it asks).
- Work-unit commits: each one leaves the branch working, with its tests.
- No AI attribution, no `Co-Authored-By` lines for agents. No push, no PR, no merge unless the
  envelope asks.

## 6. Handoff

Fill `assets/implementation-note-template.md` in the output dir and return, within the envelope's
budget:

1. Summary in two lines.
2. Branch and commits.
3. Changed files.
4. `<command>: <result>` per check.
5. The fidelity handoff request for `ux-analyst` (`implementation-fidelity`): states to measure
   (screen × role × sheet), implementation URL and login method, viewports and themes from the
   design scope, prototype path, `tokens.css` path.
6. Questions as questionnaire items and proposed changes to shared files (`BRIEF.md`, decision
   logs, the design system) as text.

The work is not "faithful" until `implementation-fidelity` measured it after the last fix. Its
corrections A–D come back as a new envelope, with its own plan and consent when they touch files
outside the first plan.
