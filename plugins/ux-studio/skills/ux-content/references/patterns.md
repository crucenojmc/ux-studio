# Copy patterns

Conventions, not laws: report any deviation in the spec notes.

## Empty states

Title (what is missing) + one line (why or what it is for) + one action. Distinguish the first-use empty state ("Todavía no hay órdenes") from the filtered empty state ("No hay órdenes con estos filtros", action: clear filters).

## Errors: what happened, why, what to do

- Network: "No pudimos cargar X. Revisa la conexión e inténtalo de nuevo." Action: retry.
- Permission: say what is restricted and who can grant it, only if the product states it; otherwise ask.
- Validation: next to the field, say the rule and the fix ("Usa entre 3 y 40 caracteres"), never only "Inválido".
- Not found: say what could not be found and offer the way back.
- Never expose codes or stack traces; keep the technical id for support only if the product already shows it.

## Confirmations and success

State the result in past tense with the object ("Orden cerrada"). Add an undo or a next step when one exists. Transient toast for reversible actions; persistent message when the user must act.

## Destructive actions

Title names the action and the object ("Eliminar la orden 1042"). Body says what is lost and whether it is reversible. Confirm button repeats the verb ("Eliminar orden"), cancel is neutral ("Conservar" or "Cancelar"). Never "Aceptar/Sí/No".

## Buttons and links

Verb + object, sentence case, one verb per action ("Crear orden", "Descargar informe"). No "Click aquí". Primary action describes the outcome, not the mechanism.

## Loading and partial data

Loading names what is loading when it takes more than ~1 s. Partial data says what is missing and offers a retry for that part only.

## Offline (mobile)

Say what works offline and what is waiting to sync; show the pending count only when the product tracks it.

## Numbers, dates and units

- Format by locale (es: decimal comma and dot thousands in es-ES/es-AR; check the brief). Never mix.
- Always show the unit next to the number, with a non-breaking space ("12,5 kg").
- Dates: unambiguous long form in text ("15 de octubre de 2026"), compact in tables; say the time zone only when it matters.
- Relative times ("hace 3 min") only when the exact time is available on hover or detail.
- Currency: symbol or ISO code as the brief states; never invent one.
