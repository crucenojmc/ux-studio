# Fidelidad de la implementación contra el prototipo

Medición del {{fecha}}. Solo mide: no cambia código del producto.

- Prototipo: `{{prototipo}}`
- Implementación: `{{implementacion}}`
- Navegador: {{navegador}} (el mismo para los dos lados)

**Puntaje de fidelidad: {{puntaje}}** ({{medidas}} propiedades medidas dentro de la tolerancia).

El puntaje es el porcentaje de propiedades medidas que están dentro de la tolerancia. La diferencia
de píxeles se informa aparte: señala dónde mirar, no decide por sí sola.

## Cómo se midió

- Los dos lados se capturaron en el mismo estado: misma ventana, densidad de píxeles, tema, reloj
  congelado, datos de demostración, movimiento reducido, transiciones y animaciones desactivadas y
  fuentes cargadas.
- Estilos: `getComputedStyle` de cada elemento del mapa (prototipo ↔ implementación). Colores
  normalizados a sRGB y comparados con ΔE2000; medidas en píxeles CSS.
- Píxeles: comparación de las capturas con las zonas dinámicas tapadas en los dos lados.
- Tolerancias: {{tolerancias}}.

## Límites

<!-- Completar: datos distintos entre lados, estados que no se pudieron capturar, propiedades que
     no se midieron y por qué. Si no hay, escribir «Ninguno». -->

## Resumen por estado

{{resumen}}

## Estados pendientes

{{pendientes}}

## Hallazgos

{{hallazgos}}

## Correcciones por prioridad

Cada corrección dice qué valor tiene hoy la implementación y el valor del prototipo a alcanzar.
Las cifras y reglas de negocio no cambian.

{{correcciones}}

## Imágenes

{{imagenes}}

## Cambios contra la medición anterior

{{delta}}

## Avisos de la medición

{{avisos}}

## Desvíos que no se corrigen

<!-- Completar desde el registro de decisiones de fidelidad: cada desvío clasificado como
     restricción técnica o mejora, con la decisión tomada, quién la tomó y la fecha. Ningún
     desvío se acepta aquí sin una entrada en ese registro. -->
