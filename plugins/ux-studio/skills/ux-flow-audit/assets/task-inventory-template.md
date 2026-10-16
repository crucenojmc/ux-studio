# Inventario de tareas — {{proyecto}}

Etapa auditada: {{brief | prototipo | implementación}} · Fecha: {{AAAA-MM-DD}} · Fuentes: {{BRIEF.md, requerimientos, entrevistas, registros}}

> Regla: ninguna frecuencia, volumen o criticidad se inventa. Lo que no se sabe queda como **pendiente** y
> genera una pregunta del cuestionario (columna «Pregunta»).

## Roles

| Rol | Pantalla de inicio | Dispositivos reales | Personas que lo cumplen | Fuente |
|---|---|---|--:|---|
| {{técnico}} | {{inicio}} | {{pendiente → Q-xx}} | {{pendiente}} | {{entrevista}} |

## Tareas

Criticidad: **alta** = bloquea la operación, dinero, seguridad u obligación legal · **media** = demora el
trabajo · **baja** = comodidad. Nivel de ubicación (ver `references/metrics.md`): **A** a 1 interacción y
visible sin desplazarse · **B** a 2 · **C** hasta 3.

| Id | Rol | Tarea (objetivo del usuario) | Frecuencia | Fuente de la frecuencia | Criticidad | Volumen por ejecución | Nivel | Ruta actual | Interacciones hoy | Ruta propuesta | Pregunta |
|---|---|---|---|---|---|---|---|---|--:|---|---|
| T-01 | técnico | Cerrar una orden de trabajo | 12 / día | entrevista (2 técnicos) | alta | 1 orden, 3–8 repuestos | A | Inicio › Órdenes › Orden › Cerrar | 3 | Inicio › Cerrar orden | — |
| T-02 | técnico | Consultar historial del vehículo | pendiente | — | media | — | ? | Inicio › Vehículos › Buscar › Historial | 3 | — | Q-01 |
| T-03 | supervisor | Asignar órdenes del día | 1 / día | brief | alta | 20–40 órdenes | A | Inicio › Órdenes › (por fila) Asignar | 2 + 1 por orden | Asignación masiva | Q-04 |

## Entrada para `flow-cost.mjs`

Cada ruta se modela como pasos. Un mismo `field` repetido, `derivable` o `knownBySystem` marca entrada
redundante. Variante `proposed` con el mismo `id` para comparar.

```json
{
  "calendar": { "hoursPerDay": 8, "daysPerWeek": 5 },
  "tasks": [
    {
      "id": "T-01", "role": "técnico", "title": "Cerrar una orden de trabajo",
      "frequency": { "count": 12, "per": "day" },
      "steps": [
        { "op": "navigate", "label": "Órdenes" },
        { "op": "click", "label": "Orden" },
        { "op": "type", "field": "patente", "chars": 7, "knownBySystem": true },
        { "op": "confirm", "label": "¿Cerrar la orden?" },
        { "op": "wait", "seconds": 2 }
      ]
    },
    {
      "id": "T-01", "variant": "proposed", "role": "técnico",
      "frequency": { "count": 12, "per": "day" },
      "steps": [{ "op": "click", "label": "Cerrar orden" }, { "op": "wait", "seconds": 2 }]
    }
  ]
}
```

El calendario (horas por día, días por semana) también es un dato del cliente: si no se conoce, el script
usa 8 h y 5 días y lo informa como supuesto.
