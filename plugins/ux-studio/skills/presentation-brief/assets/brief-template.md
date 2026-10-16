# BRIEF — {nombre del producto}

> Fecha: {AAAA-MM-DD} · Versión: {n} · Estado: borrador | aprobado
>
> Camino completo, solo para «Presentación de un producto». Los demás tipos de trabajo usan `mini-brief-template.md` (camino corto): tipo de trabajo, idioma, alcance, alcance del diseño, los skills del tipo y restricciones.

## 0. Tipo de trabajo

- Tipo: Presentación de un producto → `type: 'presentacion'`
- Por qué: {señal del pedido; «supuesto» si se aplicó la recomendación sin respuesta}
- Receta: {id y título de `ux-recipes/recipes/index.md`, o «sin receta»} ({recomendada / decisión del usuario tras la pregunta «Receta»})

## 1. Producto y problema

- Producto: {qué es, en una frase}
- Problema que resuelve: {situación actual y su costo}
- Resultado esperado: {cambio medible para el usuario}

## 2. Públicos

| Público | Qué decide | Presupuesto de atención | Formato | Duración | Debe incluir | Evitar |
|---|---|---|---|---|---|---|
| {p. ej. patrocinador} | {decisión concreta} | {minutos disponibles} | {formato} | {duración} | {contenido} | {contenido} |

Un público por fila. No usar "todos los interesados".

## 3. Mensaje central por público

| Público | Una idea que debe llevarse | Decisión que se le pide |
|---|---|---|
| {público} | {mensaje en una frase} | {decisión} |

## 4. Marca

- Camino del sistema de diseño (los tres primeros se combinan; desde cero va solo): [ ] reutilizar existente · [ ] desde código · [ ] desde web existente (con auditoría MANTENER/CAMBIAR/AGREGAR/QUITAR) · [ ] desde cero
- Marca: [ ] del cliente (con activos entregados y aprobación: {referencia}) · [ ] neutral de la consultora. Motivo: {por qué}
- Tokens: {color, tipografía, espaciado, o referencia al sistema}
- Logo: {archivo y permiso de uso, o "ninguno"}
- Voz y tono: {palabras clave; tuteo/voseo/usted}
- Movimiento: {3 palabras de marca; curvas y duraciones base; respetar movimiento reducido}
- Identidad sonora: sonido de marca {sí/no} · voz {tipo} · música {ánimo} · volumen {objetivo}
- Aviso: el aspecto del prototipo no es el diseño final.

## 5. Idioma y variante

- Idioma: {es} · Variante/región: {p. ej. es-AR, es-ES, es-MX}
- Vocabulario del dominio a respetar: {términos reales de los usuarios}
- Formato de fechas, números y moneda: {convención}

## 6. Accesibilidad

- Subtítulos en todo video (WCAG 1.2.2); máx. 42 caracteres por línea, 2 líneas, 5/6 s a 7 s por evento.
- Audiodescripción o alternativa en texto cuando la imagen lleve información (WCAG 1.2.3/1.2.5).
- Contraste de texto mínimo 4.5:1; respetar movimiento reducido.
- Requisitos adicionales: {lista}

## 7. Entregables

| Público | Formato | Agente responsable | Duración / tamaño | Estado |
|---|---|---|---|---|
| {público} | {showcase / video 16:9 / video 9:16 / slides / one-pager / clips} | ux-designer \| ux-analyst \| video-producer | {valor} | pendiente |

## 7a. Alcance del diseño

Se completa con la ronda «Alcance del diseño» de `references/module-plan.md`, antes del plan de módulos: vale para todos los módulos. La plataforma fija marcos, tamaños de pantalla y anchos de captura; los roles fijan qué roles se diseñan, se auditan y se capturan.

- Plataforma: {Web / Mobile / Web y mobile} → `platforms: ['web'] | ['phone'] | ['web', 'phone']`
- Roles: {Un solo rol / Varios roles, diseño completo para cada uno / Varios roles, uno en foco} → `roles: 'single' | 'all' | { focus: '<roleId>' }`
- Rol en foco: {nombre e id del rol / no aplica}
- Roles encontrados: {cada rol con su origen en el código: guard de ruta, permiso, enum / ninguno}
- Por qué: {señal del pedido o del repositorio; «supuesto» si se aplicó la recomendación sin respuesta}

## 7b. Plan de módulos

Se completa con el cuestionario de `references/module-plan.md`. Nada se ejecuta fuera de este plan.

| Módulo | Decisión (ejecutar / saltear / más adelante) | Variante | Por qué | Responsable |
|---|---|---|---|---|
| Sistema de diseño | {decisión} | {reutilizar / desde el código / auditar una web / desde cero / —} | {motivo} | conversación principal \| ux-designer |
| Auditoría de utilidad | {decisión} | {papel / prototipo / app / —} | {motivo} | ux-analyst |
| Entregables | {decisión} | {showcase / diapositivas / lienzo / video} | {motivo} | ux-designer \| video-producer |
| Fidelidad de la implementación | {decisión} | {ahora / —} | {motivo} | ux-analyst |

### Orden de ejecución

1. {primer módulo, según dependencias}
2. {siguiente}

Dependencias: sin sistema de diseño el showcase usa los tokens de la plantilla (se avisa una sola vez); el video y la auditoría sobre el prototipo requieren el showcase; la fidelidad requiere la implementación y el prototipo.

## 7c. Formato de la presentación

Solo si los entregables incluyen la presentación del prototipo. Se completa con la ronda de formato de `references/module-plan.md`. La presentación muestra solo lo elegido; sin esta sección no se construye.

- Formato: {Solo la app simulada / App con recorridos guiados / Sistema UX completo} → `mode: 'app' | 'tour' | 'ux-system'`
- Secciones, en orden: {Definiciones y decisiones / Principios / Sistema / Inventario / ninguna / no aplica} → `sections: ['definiciones', 'principios', 'sistema', 'inventario']`
- Por qué: {audiencias que lo justifican; «supuesto» si se aplicó la recomendación sin respuesta}
- Referencia: {ninguna / ejemplo (solo orienta) / replicar (pedido explícito)}

## 8. Fuentes de verdad

- Flujos (pasos + textos + datos de demostración): {ubicación de FLOWS en el showcase}
- Datos de demostración: etiquetados como tales; origen: {sintético / anonimizado}
- Sistema de diseño: {enlace o ruta}

## 9. Cómo sabremos que funcionó

| Público | Decisión esperada | Cómo se verifica | Objeciones abiertas |
|---|---|---|---|
| {público} | {decisión} | {p. ej. 3 preguntas de comprensión tras el video; formulario "qué cambiarías" y "qué no se entiende"} | {registrar} |

## 10. Pendientes

- [ ] {pregunta o dato faltante, con responsable}
