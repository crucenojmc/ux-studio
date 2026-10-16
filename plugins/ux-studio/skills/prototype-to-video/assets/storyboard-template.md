---
presentacion: "{nombre de la presentación}"
audiencia: "{público, uno solo}"
decision: "{la decisión que se le pide, como verbo: aprobar el piloto en dos sitios}"
formato: 1920x1080            # 1920x1080 · 1080x1920 · 1080x1080
duracion: 75s                 # estimada; la real la fija la voz
idioma: es-{variante}         # es-AR, es-MX, es-ES…
trato: usted                  # tú · vos · usted, el mismo del brief
mensaje: "{la única idea que tiene que llevarse}"
arco: Gancho → Problema → Solución → Prueba → Cierre
musica: none                  # o "{ánimo} · {fuente con licencia}"
captura: videos/_capture/web/storyboard.json
---

<!--
Plantilla del guion gráfico de un video. Una sección por escena, con los nombres de campo que lee
HyperFrames (scene, duration, voiceover) más los propios del recorrido (image, target, rect,
cursor, callout). image y rect salen de storyboard.json después de la captura.
Duración estimada de cada escena: palabras ÷ 2,5 + 0,5 a 1 s.
-->

# Guion gráfico — {audiencia}

## Frame 1 — Gancho (0–5 s)

- scene: {el resultado ya logrado en pantalla, p. ej. la confirmación final del flujo}
- duration: 4s
- image: {flujo}/{NN}-{paso}.png
- cursor: ninguno
- callout: "{resultado en 2–6 palabras}"
- voiceover: "{el resultado primero, en una frase}"

{Por qué esta imagen abre el video.}

## Frame 2 — Problema

- scene: {tarjeta de título o pantalla que muestra la situación actual}
- duration: 6s
- image: {tarjeta de título con tokens de marca | captura}
- cursor: ninguno
- callout: "{el costo de hoy, sin cifras inventadas}"
- voiceover: "{la situación actual y su costo, con datos reales o sin cifras}"

## Frame 3 — Solución · paso 1: {etiqueta del paso}

- scene: {qué hace el usuario en este paso}
- duration: 5s
- image: {flujo}/01-{paso}.png
- target: "{selector del paso}"
- rect: { x: 0, y: 0, width: 0, height: 0 }
- cursor: entra desde {borde} → centro del rect, clic con onda
- callout: "{lo que logra el paso}"
- voiceover: "{una idea, lo que se ve}"

## Frame 4 — Solución · paso 2: {etiqueta del paso}

- scene: {…}
- duration: 5s
- image: {flujo}/02-{paso}.png
- target: "{selector}"
- rect: { x: 0, y: 0, width: 0, height: 0 }
- cursor: desde el rect anterior → centro del rect, clic con onda
- callout: "{…}"
- voiceover: "{…}"

<!-- Repetir una escena por paso del flujo. -->

## Frame 5 — Prueba

- scene: {la pantalla que demuestra el resultado; si hay números, rótulo «Datos de demostración»}
- duration: 6s
- image: {flujo}/{NN}-{paso}.png
- cursor: ninguno · acercamiento suave al rect si hace falta (captura a escala 2)
- callout: "{la evidencia visible}"
- voiceover: "{qué prueba la pantalla, sin cifras que no se vean}"

## Frame 6 — Cierre

- scene: tarjeta final con tokens de marca y logo autorizado
- duration: 5s
- image: {tarjeta final}
- cursor: ninguno
- callout: "{la decisión que se pide | la llamada a la acción}"
- voiceover: "{la decisión pedida, dicha una vez}"

Texto chico de la tarjeta: «Prototipo: el aspecto no es el diseño final».

## Revisión antes de aprobar

- [ ] Un solo público y una sola decisión.
- [ ] El gancho muestra el resultado en los primeros 5 s.
- [ ] Cada paso tiene captura; cada cursor apunta a un rect real (o no hay cursor).
- [ ] Ninguna cifra que no se vea en pantalla; los datos de demostración están rotulados.
- [ ] La suma de duraciones cae dentro del largo del brief.
- [ ] Música según la política del brief (en capacitación, nunca bajo la voz).
