# Domain glossary

## Build it from evidence

1. Collect candidate terms from, in order: the caller's documents and requirements, UI labels in routes and templates, i18n files, enum and status names, API field names, database column names.
2. For each term record: term, where it was seen, the sentence or label around it, and the synonyms found for the same thing.
3. Pick the preferred term only when a source states it (a document, a screen already in production, an answer). Otherwise it is an open question.
4. Record "No usar" synonyms only when a source or an answer confirms they are wrong.

## Unknown terms are asked, never invented

- A code name, status value, acronym or field whose business meaning is not written anywhere becomes a `data-meaning` or `business-rule` question; these have no default.
- Do not translate or expand an acronym by guess. Do not coin names for data states.
- Show observed values as they are.

## Format

| Término | Definición | No usar | Fuente | Estado |
|---|---|---|---|---|

Estado: `confirmado` (source or answer) · `pendiente` (question open). Only `confirmado` terms are used in copy; pending terms appear in the spec as «pendiente».
