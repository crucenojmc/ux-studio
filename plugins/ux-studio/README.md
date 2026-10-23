# UX Studio

Plugin de Claude Code que reúne el trabajo de un diseñador gráfico, un diseñador UX y un desarrollador frontend: cualquier pieza de diseño, investigación, prototipo, sistema de diseño, implementación, auditoría o presentación de producto que un equipo pediría a esos profesionales.

## Qué resuelve

Seis tipos de trabajo, cada uno con su camino, su skill y su agente:

| Tipo de trabajo | Qué entrega | Agente |
| --- | --- | --- |
| Diseño gráfico | Íconos, ilustraciones, piezas gráficas, diapositivas y lienzos de diseño | `ux-designer` |
| Investigación y arquitectura UX | Plan de investigación, personas, mapa del sitio y wireframes | `ux-designer` |
| Diseño UX y prototipos | Prototipo funcional publicado como artifact en el formato elegido, sistema de diseño (desde cero, desde el código o auditando un sitio) y textos de la interfaz | `ux-designer` |
| Implementación frontend | Pantallas y componentes reales en el repositorio del producto, en una rama nueva y solo con el permiso explícito del usuario | `ui-developer` |
| Auditoría y medición | Utilidad de los flujos, accesibilidad y fidelidad de la implementación contra el prototipo, medidas con números y con cuestionarios de decisión de opciones cerradas | `ux-analyst` |
| Presentación de un producto | Brief completo por audiencia: prototipo presentable, diapositivas y, solo si suma valor, videos con voz y subtítulos | `ux-designer`, `ux-analyst`, `video-producer` |

Dentro de cada tipo, las **recetas** son caminos ya armados de un pedido a un entregable, como «App simulada» o «Handoff a desarrollo» (ver «Recetas»).

## Instalación

Requisitos: Claude Code y `git`. No hace falta una cuenta de GitHub, porque el repositorio es público.

```bash
claude plugin marketplace add crucenojmc/ux-studio
claude plugin install ux-studio@ux-studio
```

Dentro de una sesión funcionan igual como `/plugin marketplace add …` y `/plugin install …`.

- **Sin clave SSH de GitHub:** definir `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`. Las instalaciones y actualizaciones desde una sesión no vuelven a HTTPS por sí solas.
- **Actualizar:** `claude plugin marketplace update ux-studio` y luego `claude plugin update ux-studio@ux-studio`, o activar la actualización automática en `/plugin` → Marketplaces (viene desactivada). Se recibe una copia nueva solo cuando cambia `version` en `plugin.json`.
- **Desinstalar:** `claude plugin uninstall ux-studio@ux-studio`.
- **Desarrollo local:** `claude plugin marketplace add ./ux-studio` desde un clon. Se carga en el lugar: los cambios se aplican con `/reload-plugins`, sin subir la versión.
- **Dependencias de la máquina:** el skill `ux-env-setup` (script `check-env`) informa qué falta; ver «Recorrido».

## Recorrido

Por defecto solo corren dos cosas: el brief y la verificación del entorno (`ux-env-setup`, antes de cualquier fase que use scripts o navegador). Todo lo demás se decide en el brief.

El brief (`presentation-brief`) es la puerta de entrada cuando el usuario pide el trabajo en la conversación principal. Primero clasifica el pedido por **tipo de trabajo** con la tabla de `skills/presentation-brief/references/routing.md` (tipo → skill → agente → dónde queda el resultado). Lo infiere del pedido y del repositorio y pregunta solo si es ambiguo: como `AskUserQuestion` admite 4 opciones, muestra los 4 tipos más probables y nombra los demás, que se eligen con «Otro». Con el tipo definido, recomienda la receta que corresponde y, antes de empezar, muestra qué se obtiene, qué no incluye y para qué es ideal (ver «Recetas»).

- **Camino completo**, solo para la presentación de un producto: tipo de trabajo → alcance del diseño → plan de módulos → formato de la presentación. Brief con audiencias, decisión por audiencia, formatos, marca, idioma y éxito.
- **Camino corto**, para los demás tipos: brief mínimo, alcance del diseño y 2 o 3 preguntas propias del tipo, en una sola ronda. Diseño gráfico: qué piezas y de dónde sale el estilo. Investigación: qué entregables y con qué evidencia sobre los usuarios. Diseño UX: qué entregables y, según lo elegido, cómo se resuelve el sistema de diseño y el formato del prototipo. Implementación: desde qué diseño y cómo se entregan los cambios; sin respuesta no hay permiso para editar el producto. Auditoría: qué se mide y sobre qué.

La ronda **Alcance del diseño** se hace en los dos caminos, porque vale para todo el trabajo:

- **Plataforma**: web, mobile o web y mobile. Se infiere del repositorio: Angular, React o Vue, web; Flutter, Ionic, React Native o nativa, mobile; un producto con las dos, o una web adaptable cuyo diseño en teléfono importa, web y mobile.
- **Roles**: un solo rol (también cuando los flujos no cambian según el rol), varios roles con el diseño completo para cada uno, o varios roles con uno en foco; en ese caso se pregunta cuál. Se infiere de los guards de ruta, los permisos y los enums de roles.

Una pregunta que el pedido o el repositorio ya responden no se hace. La plataforma fija los marcos, los tamaños de pantalla y los anchos de captura de cada módulo; los roles, qué roles se diseñan, se auditan y se capturan.

En el camino completo, el plan de módulos es un cuestionario cerrado de cuatro preguntas, hecho en la conversación principal en una sola ronda y registrado en `BRIEF.md`:

1. **Sistema de diseño**: reutilizar el existente, desde el código y auditar una web (se combinan entre sí), desde cero o saltear (la presentación usa los tokens de la plantilla). Desde cero y saltear van solas.
2. **Auditoría de utilidad**: sobre el papel, sobre el prototipo, sobre la app existente o saltear. Siempre se propone.
3. **Entregables**: presentación del prototipo, diapositivas, lienzo de diseño y, solo si una audiencia lo justifica, video.
4. **Fidelidad de la implementación**: más adelante (por defecto), ahora o no aplica.

La opción recomendada va primera y se deriva del pedido y del repositorio. Las dependencias se respetan en el orden de ejecución: el video y la auditoría sobre el prototipo requieren el showcase; la fidelidad requiere la implementación y el prototipo.

Si los entregables incluyen la presentación del prototipo, sigue una segunda ronda, la del **formato de la presentación**:

- **Formato**: solo la app simulada (a pantalla completa, sin portada ni secciones), la app con recorridos guiados (la app y el reproductor de recorridos) o el **sistema UX completo**, que sigue la receta `ux-system` (ver «Recetas»).
- **Secciones** (varias): Principios, Sistema, Inventario, Definiciones y decisiones.

La recomendación sale de las audiencias. Por ejemplo: usuarios finales, app con recorridos; dueño funcional, app con recorridos y Definiciones y decisiones; traspaso a desarrollo, app con recorridos e Inventario; revisión de UX o de diseño, sistema UX completo con Principios, Sistema e Inventario. La presentación muestra solo lo elegido.

El sistema de diseño puede correr solo para que el prototipo se parezca al producto: sus tokens se usan siempre, pero mostrarlos es la sección **Sistema**, que se muestra únicamente si se elige.

| Módulo | Skill | Quién lo ejecuta | Resultado | Cuándo corre |
| --- | --- | --- | --- | --- |
| Brief | `presentation-brief` | Conversación principal | `BRIEF.md` con tipo de trabajo, alcance del diseño, plan de módulos y formato de la presentación | Primero, en el camino completo o el corto |
| Sistema de diseño | `design-system-builder` | `ux-designer` | Sistema de diseño y `tokens.css` | Según el plan de módulos |
| Auditoría de utilidad | `ux-flow-audit` | `ux-analyst` | Informe y cuestionario de decisiones | Según el plan de módulos |
| Presentación | `prototype-showcase` | `ux-designer` | Artifact con el prototipo, en el formato elegido | Según el plan de módulos |
| Video (opcional) | `prototype-to-video` | `video-producer` | Videos con subtítulos | Según el plan de módulos, solo si se pide o se acepta la propuesta |
| Fidelidad | `implementation-fidelity` | `ux-analyst` | Mediciones y correcciones priorizadas | Según el plan de módulos, cuando existe la implementación |

Esa tabla es la del camino completo; en el camino corto, el plan lista solo los skills del tipo de trabajo, según `routing.md`.

El brief corre en la conversación principal porque es el único lugar con `AskUserQuestion`. Los agentes trabajan con el brief o con un sobre de tarea (ver «Uso desde otro agente»): nunca agregan un módulo salteado o marcado "más adelante", ni una sección que el formato no eligió. Si falta algo crítico, devuelven un cuestionario para que quien los invocó lo pregunte.

## Agentes

| Agente | Para qué | Skills | Modelo | Esfuerzo |
| --- | --- | --- | --- | --- |
| `ux-designer` | Todo trabajo de diseño gráfico, UX y de sistemas de diseño: íconos, ilustraciones, textos, investigación, wireframes, sistemas de diseño, prototipos y gráficos de datos. Nunca edita código del producto | `graphic-assets`, `ux-research`, `ux-content`, `design-system-builder`, `prototype-showcase`, `data-viz`, `ux-recipes` (la mayoría de las recetas) | opus | high |
| `ux-analyst` | Utilidad del producto, accesibilidad (variante «Accesibilidad» de `ux-flow-audit`) y fidelidad de la implementación | `ux-flow-audit`, `implementation-fidelity`, `data-viz` (gráficos de los informes), `ux-recipes` (receta `ux-audit`) | sonnet | medium |
| `video-producer` | Videos narrados y subtitulados con HyperFrames | `prototype-to-video` | sonnet | high |
| `ui-developer` | Implementación frontend: el único agente que edita el repositorio de un producto. Primero devuelve el plan (archivos y rama) y edita solo cuando el usuario lo aprueba | `implement-ui` | sonnet | high |

Cada agente es corto (700 palabras como máximo) y carga sus skills a demanda: lee el `SKILL.md` de un skill solo cuando la tarea lo necesita, y las referencias, plantillas y scripts solo cuando un paso los pide.

## Calibración de modelos y esfuerzo

Precios oficiales al 2026-10-06, por millón de tokens (entrada/salida): Opus 5.5 USD 4/20, Sonnet 5.5 USD 2/10, Haiku 5.5 USD 0,10/0,50.

| Fase | Naturaleza del trabajo | Modelo | Esfuerzo | Por qué |
| --- | --- | --- | --- | --- |
| `ux-env-setup` | Verificación mecánica | haiku | low | Definido en el frontmatter del skill; no requiere criterio de diseño. |
| `presentation-brief` | Conversación con el usuario | Modelo de la sesión | el de la sesión | Debe correr en la conversación principal. |
| Diseño gráfico, UX y prototipo (`ux-designer`) | Criterio visual y decisiones de arquitectura | opus | high | Es donde el error más cuesta. |
| Implementación (`ui-developer`) | Código del producto | sonnet | high | Implementa un prototipo ya fijado y la medición de fidelidad lo verifica después; sigue las convenciones de cada proyecto. |
| Auditoría y fidelidad (`ux-analyst`) | Mediciones con scripts e informes | sonnet | medium | Los números los dan los scripts. |
| Videos (`video-producer`) | Orquestación con varias aprobaciones | sonnet | high | Muchas herramientas encadenadas. |

Economía de contexto:

- La plantilla del showcase (≈52k tokens) se **copia**, no se lee.
- Los scripts (13–36k tokens) se **ejecutan**, no se leen.
- Las referencias se consultan **a demanda**.

Para cambiar la calibración: editar `model` y `effort` en el frontmatter del agente, o definir la variable de entorno `CLAUDE_CODE_SUBAGENT_MODEL` (tiene menor precedencia que el frontmatter).

## Skills

| Skill | Qué produce | Scripts principales | Prueba |
| --- | --- | --- | --- |
| `ux-env-setup` | Diagnóstico del entorno por funcionalidad | `check-env.sh`, `check-env.ps1` | `bash tests/ux-env-setup/test-check-env.sh` |
| `presentation-brief` | Clasificación por tipo de trabajo y `BRIEF.md` con alcance del diseño, plan de módulos y formato de la presentación (camino completo o corto); tabla de ruteo y sobre de tarea para quien invoca a los agentes | Plantillas del brief y cuestionarios | `cd tests/presentation-brief && npm test` |
| `ux-recipes` | Elige la receta (por el sobre o por señales), verifica que encaje con lo pedido y la ejecuta paso a paso | `recipes/index.md` y un archivo por receta | `cd tests/ux-recipes && npm test` |
| `graphic-assets` | Sets de íconos (SVG, sprite, hoja de contacto), PNG por tamaño y densidad, favicon, íconos de app y piezas para redes | `icon-set.mjs`, `export.mjs` | `cd tests/graphic-assets && npm test` |
| `ux-research` | Plan de investigación, guía de entrevista, encuesta, prueba de usabilidad, proto-personas, mapa de recorrido, mapa del sitio y wireframes de baja fidelidad | `sitemap.mjs` | `cd tests/ux-research && npm test` |
| `ux-content` | Inventario de estados por pantalla (vacío, carga, error, éxito, parcial, sin conexión), textos de interfaz, glosario y especificación de contenido | `states-inventory.mjs` | `cd tests/ux-content && npm test` |
| `data-viz` | Gráficos de datos elegidos por la pregunta y el tipo de dato, revisados con reglas de lectura y con su ficha junto a cada uno: pregunta, por qué ese gráfico, alternativas descartadas, fuente de los datos, matemática y limitaciones | `chart-check.mjs`, `chart-card.html` | `cd tests/data-viz && npm test` |
| `implement-ui` | Plan con archivos y rama, cambios en el repositorio del producto y pedido de medición de fidelidad | `stack-detect.mjs` | `cd tests/implement-ui && npm test` |
| `design-system-builder` | Sistema de diseño y artifact reutilizable | `extract-styles.mjs`, `tokens-to-css.mjs` | `cd tests/design-system-builder && npm test` |
| `ux-flow-audit` | Costo de flujos, alcance por rol, uso del espacio, cuestionario; variante «Accesibilidad» | `flow-cost.mjs`, `nav-graph.mjs`, `space-audit.mjs` | `cd tests/ux-flow-audit && npm test` |
| `prototype-showcase` | Artifact con el prototipo en el formato del brief, con solo las secciones, plataformas y roles elegidos | `showcase-template.html`, `preview.mjs` | `cd tests/prototype-showcase && npm test` |
| `prototype-to-video` | Videos por audiencia, SRT y VTT | `capture-flows.mjs`, `srt-from-script.mjs` | `cd tests/prototype-to-video && npm test` |
| `implementation-fidelity` | Mediciones pareadas (ΔE2000, px, % de píxeles) y log de decisiones | `capture-states.mjs`, `compare.mjs`, `delta-e.mjs` | `cd tests/implementation-fidelity && npm test` |

### Opciones útiles de los scripts

- `implementation-fidelity`: `--help` muestra todas las opciones; un argumento incorrecto imprime una línea y termina con código 64 (`--debug` agrega el detalle).
- `implementation-fidelity`: `--save-auth --wait-for <selector>` guarda la sesión sin terminal; `implementation.routes` responde las llamadas a la API con los datos del prototipo; un estado con `pending: true` y `reason` se informa como pendiente, no verificado; `tokensCss` mide cada lado contra el valor declarado del token.
- `design-system-builder`: la referencia `from-code.md` explica cómo extraer tokens de un repositorio local, sin GitHub ni publicación; el `tokens.css` generado declara `color-scheme`; ante un nombre repetido entre familias, `--check` indica ambas y propone el prefijo de familia.

## Skills de diseño opcionales

El plugin no las requiere ni las instala; `ux-env-setup` las detecta. Un agente usa una solo si está instalada, como acelerador: el skill del plugin define el contrato de salida y gana ante cualquier conflicto.

| Skill | Qué trabajo acelera | Quién la usa |
| --- | --- | --- |
| `frontend-design` | Dirección visual de prototipos, pantallas y piezas | `ux-designer`, `ui-developer` |
| `web-design-guidelines` | Revisión de la interfaz contra las guías web, accesibilidad incluida | `ux-analyst`, `ux-designer` |
| `ui-ux-pro-max` | Paletas, tipografías y reglas UX para sistemas de diseño y piezas | `ux-designer` |
| `emil-design-eng` | Pulido de componentes y detalles de la interfaz | `ux-designer`, `ui-developer` |
| `animate` | Construir una animación nueva, en el prototipo o en la implementación | `ux-designer`, `ui-developer` |
| `review-animations` | Crítica del movimiento existente | `ux-analyst` |
| `improve-animations` | Auditoría del movimiento de todo un código | `ux-analyst` |
| `animation-vocabulary` | Nombrar un efecto de movimiento para pedirlo o describirlo | `ux-designer` |
| `break-ui` | Probar pantallas con datos extremos | `ux-analyst`, `ux-designer` |
| `apple-design` | Gestos, resortes, materiales y tipografía al estilo de Apple | `ux-designer` |
| `pick-ui-library` | Elegir la librería de componentes de una implementación | `ui-developer` |
| `mobile-native` | Que una web se sienta nativa en el teléfono | `ux-designer`, `ui-developer` |
| `huashu-design` | Direcciones visuales y prototipos HTML de alta fidelidad antes de elegir uno | `ux-designer` |
| `prototype` | Variantes rápidas antes del prototipo definitivo | `ux-designer` |

## Primeros pasos

1. Verificar el entorno. Dentro de Claude Code basta pedir el skill `ux-studio:ux-env-setup`. También puede ejecutarse el script directamente (solo lectura):

   ```bash
   bash "<ruta del plugin>/skills/ux-env-setup/assets/check-env.sh"
   ```

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File "<ruta del plugin>\skills\ux-env-setup\assets\check-env.ps1"
   ```

2. Pedir el trabajo en lenguaje natural. El brief clasifica el pedido por tipo de trabajo y hace solo las preguntas de ese tipo:

   | Tipo de trabajo | Ejemplos |
   | --- | --- |
   | Diseño gráfico | "Diseña los íconos del menú lateral con el estilo del sistema de diseño." · "Prepara tres diapositivas con el avance del proyecto." |
   | Investigación y arquitectura UX | "Arma las personas y el mapa del sitio del portal de proveedores." · "Propón un plan de investigación para el alta de pedidos." |
   | Diseño UX y prototipos | "Construye el prototipo navegable del alta de pedidos." · "Construye el sistema de diseño a partir de esta web: <url>." · "Escribe los mensajes de error del formulario de alta." |
   | Implementación frontend | "Implementa la pantalla de pedidos según el prototipo, en una rama nueva." |
   | Auditoría y medición | "Audita la utilidad y la accesibilidad de este prototipo." · "Mide la fidelidad de la implementación contra el prototipo." · "Explica con gráficos por qué subieron las demoras de entrega en marzo, con la fuente y el cálculo de cada uno." |
   | Presentación de un producto | "Arma el brief para presentar el prototipo de X al cliente y a los operarios." · "Genera un video de 60 segundos para el sponsor." |

## Uso desde otro agente

Lo habitual es que a los agentes los invoque otro agente principal, no el usuario. Ese agente elige el agente y el skill con la tabla de `skills/presentation-brief/references/routing.md` (sección "For callers") y le pasa un **sobre de tarea** (`skills/presentation-brief/references/task-envelope.md`): objetivo, tipo de trabajo, skills, insumos, alcance del diseño (plataforma, roles, rol en foco), idioma y tono, restricciones, carpeta de salida única y presupuesto de respuesta en palabras. `BRIEF.md` es opcional: si el sobre trae lo necesario, el agente trabaja sin él.

- Si falta algo crítico, el agente devuelve enseguida un cuestionario de opciones cerradas, antes de leer a fondo. Los agentes nunca llaman a `AskUserQuestion`: quien los invoca pregunta y vuelve a invocar con las respuestas en `answers`.
- Cada invocación escribe solo en su carpeta de salida (por defecto `tmp/<tema>/<agente>-<slug>/`, ignorada por git) y nunca edita archivos compartidos (`BRIEF.md`, logs de decisiones, el `fidelity.config.json` de otra corrida): devuelve `proposed-changes.md` y quien invoca lo aplica. Por eso se pueden invocar varios agentes en paralelo, cada uno con su objetivo, cuando ninguno necesita el resultado de otro.
- La respuesta es compacta: resumen, rutas de los artefactos y preguntas, dentro del presupuesto de palabras.
- Cada invocación hace una unidad de trabajo acotada: a las 80 llamadas aproximadas escribe `HANDOFF.md` en la carpeta de salida y devuelve `status: partial`; la invocación siguiente retoma desde ese archivo sin repetir las lecturas. `ui-developer` deja su plan en `PLAN.md` y la segunda invocación (con `consent: granted`) parte de él.

Un ejemplo por agente (`subagent_type` en el comentario):

```yaml
# ux-studio:ux-designer
ux-task:
  objective: Set de íconos del menú lateral del portal de proveedores
  type: grafico
  skills: [graphic-assets]
  inputs: [apps/portal/src/app/layout/menu.component.html]
  scope: { platforms: [web], roles: single }
  language: es-AR, usted
  outputDir: tmp/portal/ux-designer-iconos-menu/
  returnBudget: 150
```

```yaml
# ux-studio:ux-analyst
ux-task:
  objective: Barreras de accesibilidad del alta de pedidos
  type: auditoria
  skills: [ux-flow-audit]   # variante «Accesibilidad»
  inputs: [http://localhost:4200/pedidos/nuevo, tmp/auth/supervisor.json]
  scope: { platforms: [web, phone], roles: { focus: supervisor } }
  constraints: [solo el entorno local]
  outputDir: tmp/pedidos/ux-analyst-accesibilidad/
  returnBudget: 200
```

```yaml
# ux-studio:video-producer
ux-task:
  objective: Video de 60 segundos del alta de pedidos para el patrocinador
  type: presentacion
  skills: [prototype-to-video]
  inputs: [<URL del showcase>]
  brief: tmp/pedidos/BRIEF.md
  outputDir: tmp/pedidos/video-producer-sponsor/
  returnBudget: 200
```

```yaml
# ux-studio:ui-developer (primera invocación: devuelve el plan y se detiene)
ux-task:
  objective: Implementar la pantalla de pedidos según el prototipo
  type: implementacion
  skills: [implement-ui]
  inputs: [apps/web, <URL del prototipo>]
  scope: { platforms: [web], roles: all }
  constraints: [rama nueva sin push]
  outputDir: tmp/pedidos/ui-developer-pantalla/
  returnBudget: 200
  consent: pending   # tras aprobar el plan, se vuelve a invocar con consent: granted
```

## Recetas

Una receta es un punto de partida con foco: un camino conocido de un pedido a un entregable, con sus preguntas, su medio, su estructura, sus pasos y sus verificaciones ya elegidos. Conservan los caminos que el equipo usaba como plantillas de Claude Design y suman los escenarios que salieron del trabajo propio. Las ejecuta el skill `ux-recipes`: el índice está en `skills/ux-recipes/recipes/index.md` y cada receta en su propio archivo, que el agente lee solo cuando la elige.

- **Desde la conversación principal**, el brief clasifica el tipo de trabajo, recomienda la receta y, antes de empezar, muestra qué se obtiene, qué no incluye y para qué es ideal.
- **Desde otro agente**, el sobre de tarea nombra la receta en `recipe`.
- **Si la receta elegida no es la que mejor sirve a lo pedido**, el agente no empieza: devuelve una pregunta cerrada «Receta» con la receta recomendada y la opción «Seguir con <la elegida>», que dice qué faltaría. Si se mantiene la elección, sigue por ese camino y lo registra como decisión del usuario; nunca la rechaza.
- **El medio** (diseño, sistema de diseño, diapositivas, documento o tablero) se verifica al ejecutar, porque los tipos de artifact cambian según la cuenta; si el tipo no está, la receta usa su alternativa: una página HTML o los archivos de la carpeta de salida.

| Receta | Título | Tipo de trabajo |
| --- | --- | --- |
| `app-prototype` | App simulada | Diseño UX y prototipos |
| `ux-system` | Sistema UX completo | Diseño UX y prototipos; Presentación de un producto |
| `variants` | Exploración de variantes | Diseño UX y prototipos |
| `redesign` | Rediseño de pantalla existente | Implementación frontend; Auditoría y medición |
| `dev-handoff` | Handoff a desarrollo | Implementación frontend |
| `ux-audit` | Auditoría UX y de accesibilidad | Auditoría y medición |
| `ui-mockups` | Mockups de interfaz (web o mobile) | Diseño UX y prototipos |
| `wireframe` | Wireframes | Investigación y arquitectura UX |
| `animation` | Animación de interfaz | Diseño UX y prototipos |
| `object-3d` | Objeto 3D | Diseño gráfico |
| `html-email` | Email HTML | Diseño gráfico |
| `color-type-pairing` | Paleta y tipografía | Diseño gráfico; Diseño UX y prototipos |
| `diagram` | Diagrama | Diseño gráfico; Investigación y arquitectura UX |
| `print-piece` | Pieza gráfica (flyer, afiche, redes) | Diseño gráfico |
| `deck` | Presentación en diapositivas | Diseño gráfico; Presentación de un producto |
| `document` | Documento o informe | Diseño gráfico |
| `data-story` | Datos explicados | Auditoría y medición; Presentación de un producto; Diseño UX y prototipos; Investigación y arquitectura UX |

Un sobre con receta (`subagent_type: "ux-studio:ux-designer"`):

```yaml
ux-task:
  objective: Simular el alta de pedidos para probarla con supervisores
  type: diseno-ux
  recipe: app-prototype
  inputs: [apps/web/src/app/pedidos]
  scope: { platforms: [web], roles: { focus: supervisor } }
  language: es-AR, usted
  outputDir: tmp/pedidos/ux-designer-app-simulada/
  returnBudget: 150
```

Si el objetivo pidiera comparar varias alternativas, el agente devolvería primero la pregunta «Receta» con «Exploración de variantes (Recomendado)» y «Seguir con App simulada»; quien invoca la hace y vuelve a invocar con la respuesta en `answers`.

## Contratos compartidos

Mantenerlos permite que un prototipo propio siga siendo compatible con las auditorías y los videos.

| Contrato | Contenido |
| --- | --- |
| Sobre de tarea | `ux-task` con `objective`, `type`, `recipe` opcional, `skills`, `inputs`, `scope`, `language`, `constraints`, `outputDir`, `returnBudget` y `brief` opcional; respuesta compacta. Detalle en `skills/presentation-brief/references/task-envelope.md`. |
| Presupuesto | Sección `## Budget` de `skills/presentation-brief/references/task-envelope.md`, que obedecen los cuatro agentes: corridas acotadas (a unas 80 llamadas se escribe `HANDOFF.md` y se devuelve `status: partial`), capturas reducidas a 1000 px de ancho como máximo y vistas solo si una medición las marcó, ningún archivo de más de 50 KB leído entero y la verificación completa una sola vez, al final. |
| Tokens base | Colores (`surface-*`, `text-*`, `border-*`, `accent*`, `status-*`, `series-1..5`), `space-1..8`, `radius-*`, familias tipográficas y estilos de texto. Se valida con `tokens-to-css.mjs --check`. |
| Formato y alcance del diseño | `LAYOUT = { mode: 'app' \| 'tour' \| 'ux-system', sections: [...], platforms: ['web'] \| ['phone'] \| ['web', 'phone'], roles: 'single' \| 'all' \| { focus: '<roleId>' }, webMinWidth }` en la plantilla, copiado del brief; `webMinWidth` sale del breakpoint de escritorio más ancho del producto. |
| `window.SHOWCASE` | `{version: "1", screens(), roles(), flows(), open(to, opts), targetRect(selector, frame)}`. Captura determinista con `?capture=web\|phone`, solo para una plataforma declarada; otra reemplaza la página por el motivo. `roles()`, `screens()` y `flows()` devuelven solo lo que la página muestra. Igual en los tres formatos. |
| Marcado de navegación | Pantallas: `data-go="<id>"` (más `data-arg` opcional). Hojas: `data-act="sheet"` + `data-arg="<id>"`. |
| Cuestionario | JSON validado por `questionnaire.schema.json`, el mismo para todas las fases: opciones cerradas, la recomendada primero y terminada en "(Recomendado)" (en una pregunta múltiple, todas las recomendadas primero), `why` y `defaultIfUnanswered`. Las preguntas de regla de negocio y de significado de datos no tienen valor por defecto; las de regla de negocio dicen, por opción, qué cambia en la API, la web o los datos, a quién afecta, el costo y el riesgo. |

Detalle en `skills/prototype-showcase/references/capture-contract.md` y `skills/design-system-builder/references/tokens-contract.md`.

## Extras opcionales

Archivos que nunca se cargan solos: viven en `extras/`, fuera de `agents/` y de `hooks/`, y cada usuario decide si los instala.

| Extra | Qué hace | Documentación |
| --- | --- | --- |
| Compuerta de navegador del hilo principal | Un hook `PreToolUse` y el subagente `browser-qa` (sonnet) mantienen fuera del hilo principal las capturas y los volcados de las herramientas de navegador (Claude in Chrome, Chrome DevTools, Browser Use). El hilo principal acumula su contexto y lo reenvía en cada turno; un subagente lo descarta y devuelve solo un veredicto. Se instala a nivel de usuario. | [`extras/main-thread-browser-gate/README.md`](extras/main-thread-browser-gate/README.md) |

## Reglas que vienen de la experiencia

- Una referencia es un ejemplo: el formato se elige en el brief. Cuando se pide replicarla, leer su código fuente y replicarla, sin descartar partes por cuenta propia.
- Mostrar solo las secciones, las plataformas y los roles elegidos; el sistema de diseño se muestra únicamente si se pide.
- Antes de preguntar, revisar si el código o la documentación ya lo responden. Las premisas sobre la app salen de su código, nunca de un prototipo anterior.
- Solo `ui-developer` edita el repositorio de un producto, y solo con el OK explícito del usuario; los demás agentes proponen cambios.
- Los agentes no preguntan: devuelven cuestionarios cerrados a quien los invocó.
- Verificar la herramienta Artifact antes de construir.
- Un archivo, un DOM; sin iframes.
- Una sola dirección dentro del showcase; las alternativas se exploran antes.
- Primero la experiencia; la metodología solo en un anexo.
- Todo gráfico de datos justifica su tipo y muestra fuente y matemática junto al gráfico.
- Los artefactos de medición nunca van al repositorio del producto: se trabaja en `tmp/<tema>/` ignorado por git.
- No rastrear (crawl) aplicaciones de producción.
- Instalar solo con consentimiento explícito.
- Solo música con licencia conocida (MusicGen es no comercial).

## Dónde quedan los resultados

| Resultado | Ubicación |
| --- | --- |
| Brief | `BRIEF.md` en la raíz del proyecto; si la raíz no es el producto (un monorepo), `tmp/<tema>/BRIEF.md`, ignorado por git. Los agentes reciben la ruta; nunca la suponen. |
| Trabajo de cada agente: piezas, investigación, auditorías, mediciones, cuestionarios y cambios propuestos | Su carpeta de salida, `tmp/<tema>/<agente>-<slug>/` por defecto, ignorada por git |
| Implementación | Una rama nueva en el repositorio del producto, sin push, después del OK explícito; sin él, un parche en la carpeta de salida |
| `playwright-core`, `pixelmatch`, `pngjs` | en el `tmp/` del proyecto (por proyecto) o una sola instalación global (`npm i -g`) para todos; nunca en el `package.json` del producto |
| Videos, subtítulos y `CREDITS.md` | `videos/` dentro de la carpeta de salida de `video-producer` |
| Sistema de diseño y showcase | Artifacts en claude.ai |

Solo los informes finales y los cuestionarios respondidos se guardan donde el equipo documenta.

## Limitaciones conocidas / sin verificar

- El script de PowerShell no se probó en Windows.
- HyperFrames en Windows nativo no está documentado oficialmente; alternativa: WSL 2.
- Calidad de la voz en español de Kokoro desconocida: escuchar una muestra antes.
- Las fuentes reales no están cubiertas por las pruebas.
- La publicación en claude.ai no se ejerce en las pruebas automáticas; se probó a mano en un piloto.
- La detección de navegador en macOS y Windows no se probó.
- El rastreador no se probó con SPA reales con sesiones de varios roles.
- La medición de fidelidad no se ejecutó todavía contra una SPA real con sesión guardada.
- Receta `object-3d`: no se probó si el almacén de archivos de un artifact acepta modelos `.glb`; mientras tanto, usar primitivas o un modelo pequeño embebido.
- Receta `animation`: el paso a video todavía no usa `window.ANIMATION`; `capture-flows.mjs` solo lee `window.SHOWCASE`.
- Las recetas que usan tipos de artifact (Design, Design System, Slides, Docs) se ejercieron solo en las pruebas de formato; su publicación real se valida en el primer uso.

## Desarrollo

```bash
# Por skill (cada carpeta tiene su package.json)
cd tests/<skill> && npm install && npm test   # o: node --test

# Entorno
bash tests/ux-env-setup/test-check-env.sh

# Validación del plugin (desde la raíz del repositorio)
claude plugin validate plugins/ux-studio
```

Las pruebas no descargan navegadores: usan un Chromium existente; si no se detecta, indicarlo con `CHROME_PATH`.

## Licencia

[MIT](../../LICENSE).
