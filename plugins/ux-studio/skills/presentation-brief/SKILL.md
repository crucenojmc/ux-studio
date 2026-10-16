---
name: presentation-brief
description: "Trigger: presentation brief, BRIEF.md, audiences, module plan, plan de módulos, type of work, tipo de trabajo, design request, graphic, UX, prototype, implement UI, audit. Front door for any ux-studio request: classifies the type of work, then builds BRIEF.md with the design scope and a full module plan (presentations) or a mini brief (every other type). Interactive: main conversation only."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

The front door for direct use: runs first for any ux-studio request the user makes in the main conversation. It classifies the type of work (`${CLAUDE_SKILL_DIR}/references/routing.md`): «Presentación de un producto» takes the full path (full brief); every other type takes the short path (mini brief). If a `BRIEF.md` exists, read it and ask only about what changed or is missing.

A caller agent does not run this skill: it picks the agent and skill from the routing table and invokes the agent with a task envelope (`${CLAUDE_SKILL_DIR}/references/task-envelope.md`); BRIEF.md is then optional.

Location: `BRIEF.md` at the project root by default. When the root is not the product (a monorepo or superproject that holds several products), write it to the git-ignored workspace `tmp/<topic>/BRIEF.md`. Pass that path to every agent.

Run it in the main conversation, the only place with `AskUserQuestion`; never delegate it. Agents (`ux-designer`, `ux-analyst`, `video-producer`, `ui-developer`) only consume the BRIEF or an envelope, at the path the parent gives them; they return closed questions, and this skill asks them.

## Hard Rules

- Full path: one takeaway and one decision per audience. Never write "all stakeholders" as a single audience; split it.
- Experience first; methodology only in an appendix.
- Demo data is always labelled as demo data.
- Client brand only with assets the client supplied AND approval; otherwise a neutral consultancy brand. Never imply a prototype's look is final.
- Never reproduce third-party proprietary marks.
- Reuse an existing design system before creating one.
- Video is optional, never a default step: propose it only when an audience clearly benefits (say why, in one line); add a video row only if the user asks for it or accepts the proposal.
- Never name real clients, brands or projects in shared skill output unless the user supplies them for this brief.

## Decision Gates

- Type of work: infer it from the request and the repo (signals in `routing.md`). Ask the router question only when two or more types match, or none: at most 4 options, the 4 most likely types, recommended first; the context line names the types not shown, picked with «Otro».
- Recipe: once the type is known, recommend the recipe whose «cuándo» matches (`${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/recipes/index.md`; «Recipes» in `routing.md`): show its title and its Expect bullets (Obtienes, No incluye, Ideal si) before starting, in one closed question «Receta», recommended first. The pick goes through the `ux-recipes` fit check; a kept choice is recorded as the user's decision, never refused. On the short path its questions replace the type questions. None matches → no recipe.
- Full vs short: «Presentación de un producto» → full, with `${CLAUDE_SKILL_DIR}/assets/brief-template.md`. Every other type → short path, with `${CLAUDE_SKILL_DIR}/assets/mini-brief-template.md` and no audience matrix.
- Infer first: read README, manifests, design system, prior BRIEF.md. Ask ONE question at a time, only for what cannot be inferred; then STOP.
- Closed rounds are the exception, each followed by STOP, in this order: type of work (when ambiguous), «Alcance del diseño» (platform and roles), then, on the full path, the module plan (up to 4 questions) and, when the showcase is a deliverable, the presentation format; on the short path, the type questions (at most 3).
- Skip a scope question the request or the repo already answers; record the answer with its signal.
- A reference page is an example of format, not the format: replicate it only when the user asks for that.
- Confirm the BRIEF.md with the user before handing off.

## Execution Steps

1. Classify the request by type of work with `${CLAUDE_SKILL_DIR}/references/routing.md`; ask `${CLAUDE_SKILL_DIR}/assets/work-type.questions.json` only when ambiguous; then recommend the recipe (Decision Gates). Record both in "Tipo de trabajo".
2. Scan the repo and conversation for product, problem, users, brand and design system.
3. Full path: fill `${CLAUDE_SKILL_DIR}/assets/brief-template.md` in order: product and problem; audiences; decision per audience; formats; brand; language; accessibility; success. Use `references/audience-matrix.md`, `references/formats-catalog.md`, `references/brand-and-voice.md`.
4. Alcance del diseño, before the module plan because it applies to every module, in both paths: ask `${CLAUDE_SKILL_DIR}/assets/design-scope.questions.json` with the recommendation inferred from the repo per "Ronda de alcance del diseño" in `module-plan.md` (web frameworks → Web; Flutter, Ionic, React Native or native → Mobile; both, or a responsive web whose phone layout matters → Web y mobile; roles from route guards, permissions and role enums). «Varios roles, uno en foco» → one follow-up question for the role, with the roles found or free text. Record platform, roles and the role in focus in "Alcance del diseño".
5. Full path, Plan de módulos: ask the questionnaire in `${CLAUDE_SKILL_DIR}/references/module-plan.md` (recommendations from the request and repo; the usefulness audit is always proposed; design paths combine, «Saltear» is exclusive) and record the answers and execution order in BRIEF.md.
6. Full path, showcase among the deliverables: ask the format round (`${CLAUDE_SKILL_DIR}/assets/presentation-format.questions.json`), recommendations derived from the audiences per "Ronda de formato de la presentación" in `module-plan.md`; record format and sections in "Formato de la presentación". «Sistema» is shown only when chosen.
7. Short path: ask the type questions, `${CLAUDE_SKILL_DIR}/assets/work-types/<type>.questions.json` plus the reused ones `routing.md` lists, in one round; fill the mini brief's "Plan de módulos" with the type's skills. `implementacion`: no answer means no permission to edit the product.
8. Full path: name the source of truth, the showcase FLOWS definition feeding tour, storyboard, slides and clips.
9. Write BRIEF.md, list open items under Pendientes, get approval.

## Output Contract

- `BRIEF.md` at the chosen location, in the language of the deliverables (templates are neutral Spanish), including "Tipo de trabajo", "Alcance del diseño", "Plan de módulos", the execution order and, with the showcase, "Formato de la presentación".
- Full path: every audience row has decision, attention budget, format, length, must include, avoid; deliverables with owner agent; success check per audience.
- Short path: type of work, language, scope, design scope (platform, roles, role in focus), the type's skills with their variants and owner agent, constraints (for `implementacion`, the product repository and the permission to edit it).
- Next step: the first row of the plan, delegated to its agent per `routing.md` (with `recipe` in the envelope when one was chosen), not a fixed sequence.

## References

- `${CLAUDE_SKILL_DIR}/references/routing.md`: type of work → skill → agent → output, for the user and for callers
- `${CLAUDE_SKILL_DIR}/references/task-envelope.md`: how a caller invokes an agent
- `${CLAUDE_SKILL_DIR}/assets/brief-template.md`
- `${CLAUDE_SKILL_DIR}/assets/mini-brief-template.md`
- `${CLAUDE_SKILL_DIR}/assets/work-type.questions.json`, `${CLAUDE_SKILL_DIR}/assets/work-types/<type>.questions.json`
- `${CLAUDE_SKILL_DIR}/assets/design-scope.questions.json`, `${CLAUDE_SKILL_DIR}/assets/module-plan.questions.json`, `${CLAUDE_SKILL_DIR}/assets/presentation-format.questions.json`
- `${CLAUDE_SKILL_DIR}/references/module-plan.md`
- `${CLAUDE_SKILL_DIR}/references/audience-matrix.md`
- `${CLAUDE_SKILL_DIR}/references/brand-and-voice.md`
- `${CLAUDE_SKILL_DIR}/references/formats-catalog.md`
