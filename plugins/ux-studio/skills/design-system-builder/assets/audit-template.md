<!--
Plantilla de auditoría del sistema visual de un sitio existente.
Completar en el idioma del brief. Reemplazar cada {{...}}. Borrar este comentario.
Decisiones: KEEP (se mantiene) · CHANGE (cambia) · ADD (se agrega) · DROP (se elimina).
Todo valor tomado de una captura de pantalla (sin estilos calculados) lleva la marca «aproximado».
-->

# Auditoría visual — {{Marca}}

| Dato | Valor |
| --- | --- |
| Sitio | {{URL o «capturas provistas»}} |
| Páginas relevadas | {{inicio, listado, detalle, formulario}} |
| Anchos | 1440 px y 390 px |
| Fecha de captura | {{AAAA-MM-DD}} |
| Definición de marca usada | {{manual de marca, logo, palabras de marca, colores y tipografías oficiales}} |
| Archivos de captura | `design-system/{{slug}}/audit/{{página}}/` (`styles.json`, `screenshot-1440.png`, `screenshot-390.png`) |

## Resumen

- **Se mantiene:** {{n}} elementos — {{lo que ya expresa bien la marca}}.
- **Cambia:** {{n}} elementos — {{los desvíos principales}}.
- **Se agrega:** {{n}} elementos — {{lo que falta para un sistema completo}}.
- **Se elimina:** {{n}} elementos — {{variantes sueltas o sin uso}}.

## Color

| # | Elemento | Valor actual | Frecuencia | Dónde aparece | Contraste | Evidencia | Decisión | Reemplazo (token) | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | Texto principal | `#1f2933` | 48 | `p`, `li`, `td` | 13,3:1 sobre `#f7f3ea` | selector `main p` | KEEP | `text-primary` | Legible y alineado a la marca. |
| C2 | Grises de texto secundario | `#5f6b76`, `#626e78`, `#66717b` | 31 | `.meta`, `.hint`, `small` | 4,5–4,9:1 | recorte `c2.png` | CHANGE | `#5c6670` → `text-secondary` | Tres grises casi iguales, uno en el límite: se unifican en uno de 5,3:1. |
| C3 | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} |

## Tipografía

| # | Elemento | Valor actual | Frecuencia | Dónde aparece | Evidencia | Decisión | Reemplazo (token) | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Familia de texto | {{pila de fuentes}} | {{n}} | {{…}} | {{…}} | {{…}} | `type.families.sans` | {{…}} |
| T2 | Tamaños | {{13, 14, 15, 16, 17 px}} | {{…}} | {{…}} | {{…}} | {{…}} | `caption` … `display` | {{…}} |

## Espaciado, radios y sombras

| # | Elemento | Valores actuales | Frecuencia | Dónde aparece | Evidencia | Decisión | Reemplazo (token) | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | Espaciado | {{4, 8, 13, 16, 22, 24 px}} | {{…}} | {{…}} | {{…}} | {{…}} | `space-1` … `space-8` | {{fuera de la grilla de 4 px}} |
| R1 | Radios | {{3, 4, 5, 10 px}} | {{…}} | {{…}} | {{…}} | {{…}} | `radius-sm` … `radius-pill` | {{…}} |
| S1 | Sombras | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | `shadow-raised`, `shadow-overlay` | {{…}} |

## Componentes

| # | Patrón | Variantes encontradas | Frecuencia | Dónde aparece | Evidencia | Decisión | Componente del sistema | Motivo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Botón primario | {{2 alturas, 3 radios}} | {{…}} | {{…}} | {{recorte}} | {{…}} | `Button` | {{…}} |
| K2 | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} | {{…}} |

## Faltantes (ADD)

| # | Qué falta | Por qué hace falta | Se agrega como |
| --- | --- | --- | --- |
| A1 | Tema oscuro | {{…}} | valores `dark` en cada token de color |
| A2 | Anillo de foco visible | navegación con teclado | `focus-ring` |
| A3 | Estados semánticos (éxito, advertencia, error, información) | {{…}} | `status-*` y `status-*-bg` |
| A4 | Movimiento | {{…}} | sección «Movimiento» del README |

## Preguntas abiertas para el equipo

1. {{Pregunta de producto o de marca que decide el equipo, una por línea.}}
