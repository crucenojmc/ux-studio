# Plan de módulos

Nada corre por defecto salvo el brief y la verificación del entorno. Cada módulo se decide con el usuario y queda en `BRIEF.md`, sección "Plan de módulos". El plan se pregunta en la conversación principal con `AskUserQuestion`, en una sola ronda, y luego STOP.

Las rondas cerradas van en este orden, cada una seguida de STOP:

1. Tipo de trabajo, solo si el pedido es ambiguo (ver "Ronda de tipo de trabajo"). Decide el camino: completo para «Presentación de un producto», corto para los demás tipos.
2. «Alcance del diseño»: plataforma y roles. Vale para todos los módulos, en los dos caminos (ver "Ronda de alcance del diseño").
3. Camino completo: el plan de módulos (ver "Preguntas"). Camino corto: las preguntas del tipo (ver "Modo mínimo").
4. Camino completo, si los entregables incluyen la presentación del prototipo: la de formato (ver "Ronda de formato de la presentación").

## Ronda de tipo de trabajo

Fuente estructurada: `assets/work-type.questions.json`; tabla de tipos, señales y textos de cada opción en `references/routing.md`. El tipo se infiere del pedido y del repositorio; la pregunta se hace solo si coinciden dos o más tipos, o ninguno.

- Encabezado "Trabajo". "¿Qué tipo de trabajo necesitamos?" Selección única, 4 opciones como máximo: los 4 tipos más probables, el recomendado primero. La línea de contexto nombra los tipos que no se muestran; se eligen con «Otro».
- Sin señales: «Presentación de un producto» (Recomendado) · «Diseño UX y prototipos» · «Diseño gráfico» · «Auditoría y medición». «Investigación y arquitectura UX» e «Implementación frontend» quedan en «Otro».
- Se registra en `BRIEF.md`, sección "Tipo de trabajo", con su señal o rotulado como supuesto.

## Ronda de alcance del diseño

Fuente estructurada: `assets/design-scope.questions.json`. Dos preguntas de selección única. Se infiere primero del pedido y del repositorio; una pregunta que el pedido o el repositorio ya responden no se hace, y su respuesta se registra con su señal.

1. Encabezado "Plataforma". "¿Para qué plataforma diseñamos?" Opciones: «Web» · «Mobile» · «Web y mobile».
2. Encabezado "Roles". "¿Los flujos cambian según el rol del usuario?" Opciones: «Un solo rol» · «Varios roles, diseño completo para cada uno» · «Varios roles, uno en foco».

| Pregunta | Señal en el pedido o el repositorio | Recomendada |
|---|---|---|
| Plataforma | App web: Angular, React, Vue u otro framework web, sin un diseño propio para teléfono | Web |
| | App móvil: Flutter, Ionic, React Native o nativa (Swift, Kotlin) | Mobile |
| | El producto tiene app móvil y web, o es una web adaptable cuyo diseño en teléfono importa (breakpoints de teléfono, menú o navegación propios del teléfono) | Web y mobile |
| Roles | Sin guards de ruta, permisos ni enum de roles; o hay roles pero los flujos son los mismos para todos | Un solo rol |
| | Guards de ruta, permisos por rol o un enum de roles, y el pedido abarca el producto | Varios roles, diseño completo para cada uno |
| | Varios roles en el código y el pedido nombra uno (por ejemplo, "el flujo del supervisor") | Varios roles, uno en foco |

Si los flujos no cambian según el rol, «Un solo rol» lo cubre aunque el código declare varios.

Si se elige «Varios roles, uno en foco», la conversación principal hace una pregunta más, de selección única:

- Encabezado "Rol en foco". "¿En qué rol se centra el diseño?" Opciones: los roles encontrados en el código (guards, permisos, enum), hasta 4, el que nombra el pedido primero y con "(Recomendado)". Si no se encontraron roles, se pide el nombre en texto libre ("Otro").

Se registra en `BRIEF.md`, sección "Alcance del diseño", con el valor que lee la plantilla del showcase:

| Respuesta | Valor |
|---|---|
| Web | `platforms: ['web']` |
| Mobile | `platforms: ['phone']` |
| Web y mobile | `platforms: ['web', 'phone']` |
| Un solo rol | `roles: 'single'` |
| Varios roles, diseño completo para cada uno | `roles: 'all'` |
| Varios roles, uno en foco | `roles: { focus: '<roleId>' }`, con el rol en foco |

Es decir, `roles: 'single' | 'all' | { focus: '<roleId>' }`. Cada módulo lo lee:

- La plataforma fija los marcos del prototipo, los tamaños de pantalla de la auditoría y de la fidelidad, los anchos de captura del sistema de diseño y qué marcos se capturan para el video.
- Los roles fijan qué roles se diseñan, se auditan y se capturan. Con un rol en foco, los demás no aparecen en ningún entregable.

## Catálogo

| Módulo | Skill | Variantes | Responsable |
|---|---|---|---|
| 1. Sistema de diseño | `design-system-builder` | Reutilizar el existente · Desde el código · Auditar una web (URL o capturas) · Desde cero · Saltear (la presentación usa los tokens de la plantilla) | `ux-designer` |
| 2. Auditoría de utilidad | `ux-flow-audit` | Sobre el papel (brief y requisitos) · Sobre el prototipo · Sobre la app existente · Saltear | `ux-analyst` |
| 3. Entregables | `prototype-showcase`, `/slides`, `/design`, `prototype-to-video` | Presentación del prototipo (showcase) · Diapositivas · Lienzo de diseño · Video (opcional) | `ux-designer`; el video, `video-producer` |
| 4. Fidelidad | `implementation-fidelity` | Más adelante, cuando exista la implementación (por defecto) · Ahora · No aplica | `ux-analyst` |

La auditoría de utilidad se propone SIEMPRE; nunca se omite en silencio. Saltearla es una decisión registrada.

## Reglas de recomendación

La opción recomendada va primera y termina en "(Recomendado)". Se deriva de señales del pedido y del repositorio.

| Módulo | Señal | Recomendada |
|---|---|---|
| Diseño | Existe sistema de diseño o artifact de la marca | Reutilizar el existente |
| | Existe sistema de diseño y además hay estilos reales en el repo | Reutilizar el existente + Desde el código (las dos recomendadas) |
| | Hay estilos o componentes reales en el repo | Desde el código |
| | Solo hay una web pública o capturas | Auditar una web |
| | Nada de lo anterior | Desde cero |
| | El pedido no usa marca (p. ej. solo medir) | Saltear |
| Utilidad | Flujo nuevo, sin showcase | Sobre el papel |
| | Existe o se planifica el showcase | Sobre el prototipo |
| | Solo hay app implementada | Sobre la app existente |
| Entregables | Pedido de prototipo o demo | Presentación del prototipo |
| | Pedido de deck o de lienzo | Diapositivas / Lienzo de diseño |
| Fidelidad | No hay implementación | Más adelante |
| | Hay implementación y prototipo | Ahora |

Cada pregunta admite 4 opciones como máximo. Diseño tiene 5 variantes: se muestran Saltear, la recomendada y las dos más aplicables; las demás quedan disponibles en "Otro". Ejemplo: sin código, sin web y sin sistema, se muestra "Desde cero (Recomendado)" en lugar de "Desde el código".

Diseño es de selección múltiple (`multiSelect`):

- «Reutilizar el existente», «Desde el código» y «Auditar una web» se combinan. Las recomendadas van primero, cada una con "(Recomendado)".
- «Saltear» y «Desde cero» son exclusivas (`exclusive: true`): no se combinan con otra. Si llegan junto a otra opción, la pregunta se repite.
- Una combinación corre en este orden: el sistema existente es la base; el código completa lo que le falta; la web, lo que ninguno de los dos cubre. Un valor que difiere entre fuentes es una pregunta del cuestionario, nunca se elige en silencio.

Video: se propone solo cuando una audiencia claramente se beneficia (una línea con el motivo). Nunca es la opción recomendada ni se preselecciona, salvo que el usuario lo haya pedido.

## Dependencias y orden

- Showcase sin sistema de diseño: usa los tokens de la plantilla; se dice una vez y no se vuelve a ofrecer.
- El sistema de diseño puede correr solo para que el prototipo se vea como el producto: sus tokens se usan siempre, pero mostrarlos en la presentación es la sección «Sistema», que se elige aparte en la ronda de formato.
- Video requiere el showcase.
- Auditoría sobre el prototipo requiere el showcase.
- Fidelidad requiere la implementación y el prototipo.
- Auditoría sobre el papel necesita solo el brief o los requisitos.
- "Auditar una web" nunca toca una APP de producción con sesión: solo páginas públicas y con autorización.

Orden por defecto: entorno (si hay scripts) → sistema de diseño → auditoría sobre el papel → showcase → auditoría sobre el prototipo → diapositivas / lienzo → video → fidelidad. Se omiten los módulos salteados o "más adelante". El primero de la lista es el siguiente paso.

## Preguntas (texto exacto)

Fuente estructurada: `assets/module-plan.questions.json`. Cada opción lleva su descripción como en el archivo.

1. Encabezado "Diseño" (`multiSelect`; «Saltear» exclusiva). "¿Cómo resolvemos el sistema de diseño?" Opciones: Reutilizar el existente · Desde el código · Auditar una web · Saltear (más "Desde cero" según las reglas de arriba).
2. Encabezado "Utilidad". "¿Auditamos la utilidad de los flujos?" Opciones: Sobre el papel · Sobre el prototipo · Sobre la app existente · Saltear.
3. Encabezado "Entregables" (`multiSelect`). "¿Qué entregables necesitamos?" Opciones: Presentación del prototipo · Diapositivas · Lienzo de diseño · Video (opcional).
4. Encabezado "Fidelidad". "¿Cuándo medimos la fidelidad de la implementación?" Opciones: Más adelante · Ahora · No aplica.

Reordena las opciones según las señales y vuelve a escribir "(Recomendado)" en la primera (en una pregunta múltiple, en cada recomendada). Si una pregunta ya está respondida por el pedido, no se hace.

## Ronda de formato de la presentación

La presentación del prototipo no tiene un formato fijo: una referencia es un ejemplo, salvo que se pida replicarla. El formato y sus secciones se eligen en una ronda propia, después del plan de módulos (esa ronda ya usa las 4 preguntas). Solo se hace si los entregables incluyen «Presentación del prototipo».

Fuente estructurada: `assets/presentation-format.questions.json`.

1. Encabezado "Formato" (selección única). "¿Con qué formato presentamos el prototipo?"
   - «Solo la app simulada»: la app a pantalla completa, sin portada ni secciones.
   - «App con recorridos guiados»: la app con su índice de pantallas y el reproductor de recorridos.
   - «Sistema UX completo»: lo define la receta `ux-system` (`skills/ux-recipes/recipes/ux-system.md`), con sus secciones y su anexo de método.
2. Encabezado "Secciones" (`multiSelect`). "¿Qué secciones acompañan a la app?" Opciones: «Principios» · «Sistema» · «Inventario» · «Definiciones y decisiones». Se muestran en el orden elegido.

### Recomendación según las audiencias

| Audiencia del brief | Formato recomendado | Secciones recomendadas |
|---|---|---|
| Usuarios finales u operativos, capacitadores | App con recorridos guiados | ninguna |
| Dueño funcional (decide reglas, alcance y definiciones) | App con recorridos guiados | Definiciones y decisiones |
| Desarrollo (traspaso) | App con recorridos guiados | Inventario |
| Patrocinador o ejecutivos | App con recorridos guiados | Principios |
| Ventas o clientes | App con recorridos guiados | ninguna |
| Revisión de UX o de diseño | Sistema UX completo | Principios, Sistema, Inventario |
| Demostración en vivo o prueba con usuarios (alguien navega sin guion) | Solo la app simulada | — |

- Varias audiencias: el formato más completo que alguna necesite (Sistema UX completo, luego App con recorridos guiados, luego Solo la app simulada) y la unión de sus secciones.
- «Sistema» se recomienda solo para una revisión de UX o de diseño. En cualquier otro caso se muestra solo si el usuario lo elige.
- La pregunta de secciones se hace en la misma ronda solo si el formato recomendado lleva secciones y al menos una está recomendada. Si no, se registra "ninguna" con su motivo y la línea de contexto avisa que se pueden sumar después.
- Si el usuario elige «Solo la app simulada», las secciones se registran como "no aplica".
- Sin respuesta: se aplica la recomendación y se rotula como supuesto.

Se registra en `BRIEF.md`, sección "Formato de la presentación", con el valor que lee la plantilla: formato `app`, `tour` o `ux-system`; secciones `principios`, `sistema`, `inventario`, `definiciones`.

## Modo mínimo

El camino corto, para todo tipo de trabajo distinto de «Presentación de un producto» ("haz los íconos del menú", "arma las personas", "audita este flujo", "mide la fidelidad", "implementa esta pantalla", "arma el sistema de diseño de esta web"):

- Plantilla: `assets/mini-brief-template.md`. Solo tipo de trabajo, idioma, alcance, alcance del diseño (plataforma y roles), los skills del tipo con su variante y restricciones.
- La ronda «Alcance del diseño» se hace también aquí, salvo las preguntas que el pedido o el repositorio ya responden.
- En lugar del plan de módulos, las preguntas del tipo: `assets/work-types/<tipo>.questions.json` más las reutilizadas que lista `references/routing.md` («Diseño» y «Formato» para Diseño UX y prototipos), 3 como máximo, en una sola ronda.
- Sin matriz de audiencias ni preguntas más allá de lo que el tipo necesita.
- El plan de módulos lista los skills del tipo según `references/routing.md`: los elegidos figuran como "ejecutar"; los demás, "saltear (no pedido)".
- Implementación frontend: sin respuesta no hay permiso para editar el repositorio del producto; se entrega un parche.

## Del cuestionario a la tabla

| Respuesta | Fila de `BRIEF.md` |
|---|---|
| Variante elegida | Decisión "ejecutar"; la variante en su columna |
| Saltear / No aplica | "saltear" con el motivo |
| Más adelante | "más adelante"; se retoma cuando se cumpla la dependencia |
| Respuesta por defecto | Se rotula como supuesto en "Por qué" |
| Entregables marcados | Una fila por entregable; responsable según el catálogo |
| Diseño combinado | Una sola fila "ejecutar"; las variantes, en el orden de combinación |
| Tipo de trabajo | Sección "Tipo de trabajo", no una fila del plan |
| Preguntas del tipo (camino corto) | Una fila por skill del tipo, según `references/routing.md` |
| Plataforma, roles y rol en foco | Sección "Alcance del diseño", no una fila del plan |
| Formato y secciones | Sección "Formato de la presentación", no una fila del plan |

Registra además el orden de ejecución derivado de las dependencias.
