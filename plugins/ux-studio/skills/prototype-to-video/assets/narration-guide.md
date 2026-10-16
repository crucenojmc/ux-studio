# Guía de narración

La narración dice lo que se ve. Todo lo que no está en pantalla, o no está en el brief con su
fuente, no se dice.

## Reglas

- Idioma, variante y trato del brief (tú, vos o usted), iguales en voz, subtítulos y tarjetas.
- Unas 2,5 palabras por segundo en español; en capacitación, un poco más lento.
- Una idea por oración. Oraciones de 6 a 14 palabras.
- Presente y voz activa: «La bandeja ordena los pedidos», no «Los pedidos son ordenados».
- El vocabulario real de quienes usan el sistema, no el del equipo de desarrollo.
- Cero cifras inventadas. Solo se nombran números que están en pantalla, y se aclara que son de
  demostración.
- El resultado primero: el gancho dice qué se logra antes de explicar cómo.
- Nada de nombres internos de código, pantallas o campos que el público no ve.

## Formato de `narration.md`

```markdown
## Frame 3 — Abrir la bandeja
texto: "La bandeja ordena los pedidos por urgencia."
spoken: ""            # solo si la voz pronuncia mal: «ca-pe-i» en lugar de «KPI»
palabras: 7 · estimado: 2,8 s
```

`texto` va a los subtítulos tal cual; `spoken`, si existe, va solo a la voz. Con los tiempos reales
se escribe `narration.json` para los subtítulos externos:

```json
[{ "text": "La bandeja ordena los pedidos por urgencia.", "start": 12.4, "end": 15.1 }]
```

## Ejemplos por público

### Patrocinador ejecutivo (60–90 s, trato usted)

- Gancho: «Un pedido aprobado en tres toques, sin llamadas.»
- Problema: «Hoy, cada aprobación pasa por correo y por teléfono.»
- Solución: «La bandeja ordena los pedidos por urgencia.» · «El detalle reúne lo necesario para decidir.»
- Prueba: «Todo el circuito ocurre en una sola pantalla.»
- Cierre: «Le proponemos aprobar el piloto en dos sitios.»

### Usuarios operativos y capacitación (30–120 s por tarea, trato del brief)

- Objetivo: «Vamos a aprobar un pedido pendiente.»
- Paso: «Abra la bandeja de pedidos.» · «Toque el primer pedido de la lista.» · «Revise el detalle y toque Aprobar.»
- Resultado: «El pedido pasa a la lista de aprobados.»
- Recuperación (solo si el prototipo lo muestra): «Si se equivocó, toque Deshacer antes de salir.»

### Ventas y marketing (30–60 s, trato del brief)

- Gancho: «Aprobar un pedido ya no necesita una llamada.»
- Caso: «El supervisor ve primero lo que vence hoy.»
- Cierre: «Pida una demostración con sus propios circuitos.»

### Pares de producto y UX (2–4 min, tono de conversación)

- Fundamento: «Ordenamos por urgencia porque el supervisor decide por vencimiento, no por fecha de llegada.»
- Alternativa: «Probamos una vista por sucursal; obligaba a abrir cada una para encontrar lo urgente.»
- Pregunta abierta: «Falta definir qué pasa cuando dos supervisores abren el mismo pedido.»

## Qué no decir

| No | Sí |
|---|---|
| «Esto reduce los tiempos un 40 %.» (cifra sin fuente) | «Todo el circuito ocurre en una sola pantalla.» |
| «Este mes se vendieron 1.250.000.» | «Con datos de demostración, la tabla muestra el total del mes.» |
| «Abra la bandeja, filtre por urgencia y apruebe los tres primeros.» (tres ideas) | Tres oraciones, una por paso. |
| «El componente OrderList hace un fetch.» | «La lista se actualiza sola.» |
| «Este es el diseño final.» | «Así se verá el circuito; el aspecto todavía es de prototipo.» |
