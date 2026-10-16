# Voice and tone

## Defaults (when the brief says nothing)

- Spanish, neutral register: "tú" forms or impersonal phrasing (infinitives for buttons); never voseo (no "tenés", "hacé"). A brief that sets a variant (for example es-AR) overrides this.
- Short, active, concrete. One idea per sentence. Say what the user can do, not what the system did to them.
- Sentence case for titles, buttons and labels. No exclamation marks except real success; no humour in errors.
- Never blame the user ("Ingresaste mal el dato"); describe the rule ("El código tiene 6 dígitos").

## Applying the brief's tone

1. Read language, variant and tone from the envelope or `BRIEF.md`. If both are missing, ask.
2. Turn the tone into 3 observable rules and write them at the top of the content spec. Example: "formal" means no contractions or colloquialisms, "close" means second-person singular and plain words.
3. Check every text against those rules; the rules, not taste, decide.
4. Tone moves with the moment: calm in errors, brief in confirmations, neutral in destructive actions.

## Consistency rules

- One term per concept, taken from the glossary; never alternate "orden/pedido/solicitud" for the same thing.
- Same action, same verb everywhere (a "Guardar" never becomes "Grabar").
- Same structure for the same state across screens (every empty state: title, one line, one action).
- Keep keys stable and hierarchical: `<screen>.<state>.<element>`.
- Respect character limits per platform; a limit from the design wins, otherwise mark «supuesto».
