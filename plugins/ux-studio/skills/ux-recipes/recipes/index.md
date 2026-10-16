# Recetas

One row per recipe. Pick by the signals in «cuándo»; then read only the chosen recipe file, `recipes/<id>.md`. «Qué obtienes» is the phrase shown to the user next to the title; «medio» is the recipe's medium and, after the arrow, its fallback when the type is not listed.

| id | título | cuándo | qué obtienes | medio | agente |
|---|---|---|---|---|---|
| `app-prototype` | App simulada | Una pantalla o un flujo para recorrer como la app real; demo en vivo o prueba con usuarios | La app navegable a pantalla completa, con datos de demostración | `html` | `ux-designer` |
| `ux-system` | Sistema UX completo | Revisión de UX o de diseño del producto entero: principios, sistema e inventario junto a la app | Portada con controles, maquetas navegables, recorridos reproducibles y secciones, con anexo | `html` | `ux-designer` |
| `variants` | Exploración de variantes | La dirección está abierta: comparar 2 a 4 alternativas antes de construir | Alternativas lado a lado y una pregunta para elegir una | `design` → `html` | `ux-designer` |
| `redesign` | Rediseño de pantalla existente | Una pantalla que ya existe funciona mal y hay que rehacerla con evidencia | Auditoría, variantes, prototipo elegido, plan de implementación y fidelidad, paso a paso | `html` | `ux-designer` |
| `dev-handoff` | Handoff a desarrollo | Un diseño decidido pasa al equipo de desarrollo | Prototipo con inventario de estados, tokens publicados y plan con archivos y rama | `design-system` → `html` | `ux-designer` |
| `ux-audit` | Auditoría UX y de accesibilidad | Medir la utilidad y la accesibilidad sin cambiar nada | Informe con hallazgos priorizados y cuestionario de decisiones | `docs` → `markdown` | `ux-analyst` |
| `data-story` | Datos explicados | Gráficos que explican un fenómeno con datos estadísticos o matemáticos; no para gráficos decorativos | Gráficos elegidos con fundamento y, junto a cada uno, su ficha con fuente y matemática | `dashboard` → `html` | `ux-designer` |
| `ui-mockups` | Mockups de interfaz (web o mobile) | Ver las pantallas terminadas, con la estética final, en web o en teléfono | Pantallas en alta fidelidad con el sistema de diseño | `design` → `html` | `ux-designer` |
| `wireframe` | Wireframes | Acordar la estructura y el contenido antes de diseñar | Pantallas en grises con la jerarquía y el contenido | `design` → `html` | `ux-designer` |
| `animation` | Animación de interfaz | Definir cómo se mueve un elemento o una transición | Página con la animación y controles para reproducirla | `html` | `ux-designer` |
| `object-3d` | Objeto 3D | Mostrar un objeto desde todos los ángulos | Visor 3D con luz de estudio | `html` | `ux-designer` |
| `html-email` | Email HTML | Un correo transaccional o de marketing | Correo de 600 px compatible con los clientes de correo | `html` | `ux-designer` |
| `color-type-pairing` | Paleta y tipografía | Decidir la base visual de una marca o un producto | 2 o 3 propuestas con el contraste verificado | `design-system` → `html` | `ux-designer` |
| `diagram` | Diagrama | Explicar cómo se conectan pasos, pantallas o sistemas | Diagrama Mermaid con los tokens | `html` | `ux-designer` |
| `print-piece` | Pieza gráfica (flyer, afiche, redes) | Una pieza para publicar o imprimir | La pieza y sus PNG por tamaño | `design` → `html` | `ux-designer` |
| `deck` | Presentación en diapositivas | Exponer frente a una audiencia | Deck en Slides con notas del orador | `slides` → `html` | `ux-designer` |
| `document` | Documento o informe | Un texto para leer y comentar: especificación, plan o informe | Documento en Docs, con el resumen primero | `docs` → `markdown` | `ux-designer` |
