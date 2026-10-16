# Especificación de contenido — {{proyecto}}

Idioma: {{es | es-AR | …}} · Tono: {{del brief}} · Fecha: {{AAAA-MM-DD}} · Fuentes: {{pantallas, glosario, BRIEF.md}}

> Regla: ningún significado de negocio, límite o término se inventa. Lo que no se sabe queda como
> **pendiente** con su pregunta (Q-xx). Un límite de caracteres que no define el diseño se marca «supuesto».

## Textos

| Clave | Pantalla | Estado | Texto | Variantes | Límite | Notas |
|---|---|---|---|---|--:|---|
| `ordenes.vacio.titulo` | Órdenes | Vacío | Todavía no hay órdenes | Con filtros: «No hay órdenes con estos filtros» | 40 | Va con un botón que invita a crear |
| `ordenes.vacio.accion` | Órdenes | Vacío | Crear orden | — | 20 | Verbo + objeto |
| `ordenes.error.red` | Órdenes | Error de red | No pudimos cargar las órdenes. Revisa la conexión e inténtalo de nuevo. | — | 90 | Qué pasó, por qué, qué hacer |
| `ordenes.error.permiso` | Órdenes | Error de permiso | pendiente | — | — | Q-01 |

Estados: vacío · cargando · error de red · error de permiso · error de validación · no encontrado ·
éxito/confirmación · datos parciales · sin conexión.

## Glosario usado

| Término | Definición | No usar | Fuente |
|---|---|---|---|
| orden | {{definición confirmada}} | pedido, ticket | {{documento o respuesta}} |

## Pendientes

| Pregunta | Qué bloquea |
|---|---|
| Q-01 | `ordenes.error.permiso` |
