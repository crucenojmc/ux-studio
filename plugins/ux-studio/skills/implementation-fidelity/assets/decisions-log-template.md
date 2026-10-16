# Registro de decisiones de fidelidad

- Producto: <nombre del producto>
- Prototipo: <ruta o URL y versión>
- Sistema de diseño: <ruta o URL y versión de `tokens.css`>
- Umbral acordado: <por ejemplo, puntaje ≥ 95 % y diferencia de píxeles ≤ 2 % en cada estado>

Una fila por desvío que **no** se corrige como defecto. Un desvío sin fila en este registro no está
aceptado: vuelve a la lista de correcciones. Las decisiones que cambian el comportamiento del
producto las toma el responsable de producto; el agente propone opciones, no decide.

## Decisiones

| # | Fecha | Estado (pantalla · viewport · tema) | Desvío: qué y cuánto | Clase | Causa verificada | Opciones evaluadas (costo / impacto) | Opción elegida | Decidió (nombre y rol) | Actualiza el sistema de diseño | Hallazgos |
|---|---|---|---|---|---|---|---|---|---|---|
| D1 | AAAA-MM-DD | | | Restricción técnica · Mejora | | 1. Adaptar prototipo y sistema · 2. Aceptar y documentar · 3. Solución a medida | | | Sí: `<token o componente>` · No | F… |

## Cómo completar cada columna

- **Desvío**: valor del prototipo, valor de la implementación y la diferencia medida (ΔE2000, px,
  % de píxeles). Nunca «se ve distinto» sin la cifra.
- **Clase**:
  - *Restricción técnica*: la biblioteca o el framework no lo permite, cuesta rendimiento, empeora la
    accesibilidad o los datos reales no tienen la forma del prototipo.
  - *Mejora*: algo que se descubrió al implementar y funciona mejor que lo prototipado.
  - Los *defectos* no van aquí: se corrigen y se vuelven a medir.
- **Causa verificada**: la evidencia (documentación de la biblioteca, medición de rendimiento,
  resultado de accesibilidad, muestra de datos reales). Sin evidencia, la clase queda «por confirmar».
- **Opciones evaluadas**: cada opción con su costo (horas, riesgo) y su impacto (qué ve el usuario,
  qué otras pantallas toca).
- **Actualiza el sistema de diseño**: si el desvío pasa a ser el nuevo estándar, se cambia el token o
  el componente en el sistema de diseño y en el prototipo, y se anota cuál. El sistema de diseño
  sigue siendo la única fuente de verdad.

## Cierre del ciclo

- [ ] Cada fila tiene «Decidió» y «Fecha».
- [ ] Cada fila con «Sí» en sistema de diseño tiene el cambio hecho y el prototipo regenerado.
- [ ] La última medición (`fidelity.md`) se hizo después de las correcciones y no muestra hallazgos
      fuera de este registro.
