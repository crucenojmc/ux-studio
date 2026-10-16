# Fit check: the «Receta» question

Read this only when the fit check finds a better recipe. The question explains what each choice gives, recommends the better recipe and never blocks the user's own choice.

## When another recipe fits better

Compare the intent with the chosen recipe's `## When` (its "Not for" line names the usual alternatives) and `## Expect` («Ideal si»). Propose another recipe only on a concrete mismatch the request states, never on taste. Common ones:

| The intent says | Chosen | Better |
|---|---|---|
| Several alternatives to choose from | `app-prototype` | `variants` |
| One screen or flow to click through | `ux-system` | `app-prototype` |
| The screen exists and works badly | `app-prototype`, `variants` | `redesign` |
| Measure only, change nothing | `redesign` | `ux-audit` |
| Developers must build it | `app-prototype` | `dev-handoff` |
| The whole UX for a design review | `app-prototype` | `ux-system` |
| Static screens, no navigation | `app-prototype` | `ui-mockups` |
| Slides for executives | `ux-system` | `deck` |

## The item

One questionnaire item, valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`. Option ids are the recipe ids; the second option keeps the chosen recipe, and so does the default: the user's choice stands unless the user changes it.

```json
{
  "id": "Q-90",
  "topic": "scope",
  "priority": "high",
  "header": "Receta",
  "question": "¿Con qué receta seguimos?",
  "why": "Se pidieron varias alternativas para elegir una; «App simulada» construye una sola dirección.",
  "options": [
    {
      "id": "variants",
      "label": "Exploración de variantes (Recomendado)",
      "description": "Obtienes: de 2 a 4 alternativas lado a lado en un lienzo y una pregunta para elegir una.",
      "consequence": "La app simulada se construye después, con la variante elegida."
    },
    {
      "id": "app-prototype",
      "label": "Seguir con App simulada",
      "description": "Obtienes: la app simulada a pantalla completa, navegable de punta a punta.",
      "consequence": "Falta la comparación: se construye una sola dirección, sin alternativas para elegir."
    }
  ],
  "unblocks": ["F-90"],
  "defaultIfUnanswered": {
    "option": "app-prototype",
    "note": "Sin respuesta se sigue con la receta elegida: es decisión del usuario."
  },
  "updates": [],
  "rerun": [],
  "answer": { "status": "pending", "option": null, "text": null }
}
```

## After the answer

- `answers: { Q-90: <chosen id> }` → run the chosen recipe; the return says «Receta: <id>, decisión del usuario». No second fit check in that invocation.
- `answers: { Q-90: <better id> }` → run the better recipe; its own fit check is already satisfied.
