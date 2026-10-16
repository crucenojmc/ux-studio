<!--
Esqueleto del manual de marca: es `project/README.md` del artifact Design System.
Escribir en el idioma del brief. Reemplazar cada {{...}}, borrar las secciones que no apliquen
y este comentario. Cada regla de uso nombra tokens reales de `tokens.json`.
-->

# {{Nombre del sistema}}

{{Una oración: qué marca es, para quién, y cómo se siente. Ej.: «Ladera es el sistema de una
plataforma de pedidos para depósitos: sereno, preciso y cercano.»}}

## Fundamentos de contenido

### Voz y tono

| Principio | Decimos | No decimos |
| --- | --- | --- |
| {{Directo}} | {{«Confirmar pedido»}} | {{«¡Haga clic aquí para confirmar su pedido!»}} |
| {{…}} | {{…}} | {{…}} |

### Reglas de escritura

- Botones: verbo en infinitivo o imperativo, una o dos palabras.
- Errores: qué pasó y qué hacer, sin culpar a la persona.
- Números, fechas y monedas: {{formato}}.

## Fundamentos visuales

### Color

Dos temas, `light` (principal) y `dark`. Ningún color se usa solo para transmitir un estado.

| Rol | Tokens | Uso |
| --- | --- | --- |
| Superficies | `surface-page`, `surface-raised`, `surface-overlay`, `surface-sunken` | {{…}} |
| Texto | `text-primary`, `text-secondary`, `text-tertiary` | `text-tertiary` solo para marcadores y deshabilitados. |
| Bordes | `border-subtle`, `border-strong` | `border-strong` es el borde de todo control. |
| Acción | `accent`, `accent-hover`, `on-accent`, `focus-ring` | Un solo botón primario por vista. |
| Estados | `status-ok`, `status-warn`, `status-danger`, `status-info` y sus `-bg` | Siempre con ícono o palabra. |
| Gráficos | `series-1` … `series-5` | En ese orden; difieren en luminosidad además de tono. |

### Tipografía

Familias: `sans` {{familia}}, `display` {{familia}}, `mono` {{familia}}.

| Estilo | Tamaño / interlineado | Peso | Uso |
| --- | --- | --- | --- |
| `display` | {{48/52}} | {{400}} | {{…}} |
| `title` | {{…}} | {{…}} | {{…}} |
| `heading` | {{…}} | {{…}} | {{…}} |
| `body` | {{…}} | {{…}} | {{…}} |
| `label` | {{…}} | {{…}} | {{…}} |
| `caption` | {{…}} | {{…}} | {{…}} |

### Espaciado, radios y elevación

- Grilla de 4 px: `space-1` (4) … `space-8` (64). {{Reglas: relleno de tarjeta `space-4`, entre secciones `space-6`.}}
- Radios: `radius-sm` {{…}}, `radius-md` {{…}}, `radius-lg` {{…}}, `radius-pill` solo para {{…}}.
- Elevación: `shadow-raised` para {{…}}; `shadow-overlay` para menús, avisos y paneles.

### Movimiento

{{Dos o tres principios: qué se mueve, para qué y a qué velocidad.}}

| Variable | Valor | Uso |
| --- | --- | --- |
| `--duration-fast` | 120ms | hover, presión, cambios de color |
| `--duration-base` | 200ms | aparición de menús y avisos |
| `--duration-slow` | 320ms | paneles y hojas que entran desde un borde |
| `--ease-out` | cubic-bezier(.22,1,.36,1) | entradas |
| `--ease-in-out` | cubic-bezier(.65,0,.35,1) | cambios de posición en pantalla |
| `--ease-sheet` | cubic-bezier(.32,.72,0,1) | hojas y cajones |

Con `prefers-reduced-motion: reduce`, las transiciones de posición se reemplazan por un fundido o
se omiten.

## Iconografía

- Set: {{nombre del set, licencia abierta}}; trazo {{1,5 px}}; tamaños 16, 20 y 24 px.
- El ícono toma el color de texto de su contexto (`text-primary`, `text-secondary`, `on-accent`).
- Un ícono nunca indica un estado por sí solo.

## Logo

{{Archivos en `assets/Logos/` y cómo usarlos. Sin archivo de logo: «Se usa el nombre de la marca
en `display`; no hay marca gráfica en este sistema.»}}

## Componentes

{{Lista breve con el resumen de cada componente; el detalle está en `components/<Comp>/README.md`.}}

## Decisiones

<!-- Solo en el camino «desde un sitio existente». -->

| Decisión | Qué | Por qué |
| --- | --- | --- |
| KEEP (se mantiene) | {{…}} | {{…}} |
| CHANGE (cambia) | {{valor anterior → token nuevo}} | {{…}} |
| ADD (se agrega) | {{…}} | {{…}} |
| DROP (se elimina) | {{…}} | {{…}} |

## Accesibilidad

- Texto: contraste mínimo 4,5:1 (3:1 desde 24 px) en ambos temas.
- Bordes de controles, anillo de foco e íconos: mínimo 3:1.
- Los colores que deben distinguirse difieren en luminosidad, no solo en tono.

## Cómo consumirlo

- En claude.ai: marcarlo como sistema de diseño predeterminado; los artifacts de Design y Slides lo usan.
- En Claude Code: leer `project/README.md` y `project/tokens.json` del artifact y generar
  `tokens.css` con `tokens-to-css.mjs` del skill `ux-studio:design-system-builder`.
