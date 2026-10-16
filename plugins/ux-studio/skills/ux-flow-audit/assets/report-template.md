# Auditoría de flujos y uso — {{proyecto}}

Etapa: {{brief | prototipo | implementación}} · Fecha: {{AAAA-MM-DD}} · Versión auditada: {{URL, commit o archivo}}

## Resumen

{{Tres líneas: qué se auditó, los dos o tres hallazgos de mayor impacto y cuántas decisiones esperan respuesta.}}

## Alcance y fuentes

| Fuente | Qué aportó | Fecha o versión |
|---|---|---|
| BRIEF.md | roles, objetivos | {{…}} |
| Inventario de tareas | frecuencias, criticidad, rutas | {{…}} |
| `flow-cost.json`, `nav-graph.json`, `space-audit.json` | mediciones | {{…}} |

Lo que no se pudo auditar y por qué: {{p. ej. controles no accionados por seguridad, pantallas que requieren datos}}.

## Hallazgos

Impacto = frecuencia × costo (segundos por ejecución × ejecuciones por semana × personas). Prioridad y
esfuerzo según `references/metrics.md`.

| Id | Tipo | Evidencia | Impacto | Cambio propuesto | Esfuerzo | Prioridad | Estado |
|---|---|---|---|---|---|---|---|
| F-01 | frecuencia | «Cerrar orden» a 3 interacciones; tarea nivel A (12 / día) | 41 s × 60 / semana = 41 min por técnico | Acción principal en el inicio | M | P1 | abierto |
| F-02 | redundancia | patente escrita 2 veces (pasos 3 y 7) | 4 s × 60 = 4 min por técnico | Precargar desde la orden | S | P2 | decidido (Q-02) |
| F-03 | alcanzabilidad | «Repuestos» sin enlace para supervisor: solo por URL | bloqueante | Entrada en el menú | S | P1 | espera Q-03 |
| F-04 | espacio | acción «Asignar» 560 px bajo el pliegue en 1440×900 | {{…}} | 5 columnas clave | S | P2 | supuesto (Q-04) |
| F-05 | heurística | #9: el error de validación borra lo ingresado | {{…}} | Conservar lo ingresado | S | P2 | abierto |

Tipos: `frecuencia`, `redundancia`, `alcanzabilidad`, `espacio`, `heurística`. Ejemplos de demostración.

## Costo de flujo: actual vs propuesto

| Tarea | Rol | Actual (s) | Propuesto (s) | Ahorro (s por ejecución) | Ahorro semanal por persona (min) |
|---|---|--:|--:|--:|--:|
| {{T-01}} | {{técnico}} | {{…}} | {{…}} | {{…}} | {{…}} |

Modelo: KLM (Card, Moran y Newell), operadores en el anexo. Usuario experto sin errores; las esperas son
medidas, no supuestas.

## Matriz de alcanzabilidad por rol

Celda: interacciones desde el inicio del rol (ruta) o el motivo por el que no se llega.

| Funcionalidad | {{rol 1}} | {{rol 2}} | Estado |
|---|---|---|---|
| {{Cerrar orden}} | 1 (Inicio › Cerrar orden) | n/a | OK |
| {{Repuestos}} | n/a | ✗ solo por URL | Solo por URL |

Pantallas huérfanas: {{…}} · Pantallas sin salida: {{…}} · Pasos de flujo sin enlace: {{…}}

## Espacio por pantalla

| Pantalla | Viewport | Contenido % | Cromo % | Sin uso % | Acción principal visible | Desborde | Señales |
|---|---|--:|--:|--:|---|---|---|
| {{Órdenes}} | 1440×900 | {{…}} | {{…}} | {{…}} | {{sí/no (scroll px)}} | {{…}} | {{…}} |
| {{Órdenes}} | 390×844 | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} |

Estados vacíos revisados: {{pantalla: explica por qué está vacío y ofrece el siguiente paso, sí/no}}.

## Heurísticas (Nielsen)

| # | Heurística | Resultado | Evidencia |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | {{cumple / hallazgo F-xx / n/a}} | {{…}} |
| 2 | Relación entre el sistema y el mundo real | | |
| 3 | Control y libertad del usuario | | |
| 4 | Consistencia y estándares | | |
| 5 | Prevención de errores | | |
| 6 | Reconocer antes que recordar | | |
| 7 | Flexibilidad y eficiencia de uso | | |
| 8 | Diseño estético y minimalista | | |
| 9 | Ayudar a reconocer, diagnosticar y recuperarse de errores | | |
| 10 | Ayuda y documentación | | |

## Cuestionario de decisiones

{{N}} preguntas: {{a}} respondidas, {{b}} con valor por defecto aplicado, {{c}} pendientes. Archivo:
`questionnaire.json` (y `questionnaire.md`). Próxima ronda: {{Q-xx, Q-yy}}.

## Supuestos

{{Cada valor por defecto aplicado y cada supuesto de cálculo (calendario, perfil de tipeo), con la pregunta que lo resuelve.}}

## Pendiente de verificar

{{Lo que solo se valida con el cliente, en el dispositivo real o con datos reales; nunca se informa como verificado.}}
