# BRIEF MÍNIMO — {tema del pedido}

> Fecha: {AAAA-MM-DD} · Estado: borrador | aprobado · Camino corto: todo tipo de trabajo distinto de la presentación de un producto

## 0. Tipo de trabajo

Se completa con la ronda de tipo de trabajo de `references/module-plan.md`; los tipos, sus skills y su agente están en `references/routing.md`.

- Tipo: {Diseño gráfico / Investigación y arquitectura UX / Diseño UX y prototipos / Implementación frontend / Auditoría y medición} → `type: 'grafico' | 'investigacion' | 'diseno-ux' | 'implementacion' | 'auditoria'`
- Por qué: {señal del pedido; «supuesto» si se aplicó la recomendación sin respuesta}
- Receta: {id y título de `ux-recipes/recipes/index.md`, o «sin receta»} ({recomendada / decisión del usuario tras la pregunta «Receta»})

## 1. Alcance

- Pedido: {una frase, p. ej. "haz los íconos del menú", "arma las personas", "audita este flujo", "implementa esta pantalla"}
- Alcance: {pantallas, flujos, piezas o URL incluidos y excluidos}

## 1b. Alcance del diseño

Se completa con la ronda «Alcance del diseño» de `references/module-plan.md`; se omite la pregunta que el pedido o el repositorio ya responden.

- Plataforma: {Web / Mobile / Web y mobile} → `platforms: ['web'] | ['phone'] | ['web', 'phone']`
- Roles: {Un solo rol / Varios roles, diseño completo para cada uno / Varios roles, uno en foco} → `roles: 'single' | 'all' | { focus: '<roleId>' }`
- Rol en foco: {nombre e id del rol / no aplica}
- Roles encontrados: {cada rol con su origen en el código: guard de ruta, permiso, enum / ninguno}
- Por qué: {señal del pedido o del repositorio; «supuesto» si se aplicó la recomendación sin respuesta}

## 2. Idioma y variante

- Idioma: {es} · Variante/región: {p. ej. es-AR}
- Tono: {tuteo / usted}
- Vocabulario del dominio a respetar: {términos reales de los usuarios}

## 3. Plan de módulos

Una fila por skill del tipo de trabajo, según `references/routing.md`; las preguntas del tipo (`assets/work-types/<tipo>.questions.json`) deciden cuáles se ejecutan y con qué variante. Nada se ejecuta fuera de este plan.

| Skill | Decisión | Variante | Por qué | Responsable | Salida |
|---|---|---|---|---|---|
| {skill del tipo} | {ejecutar / saltear (no pedido)} | {respuesta de las preguntas del tipo o "—"} | {motivo; «supuesto» si se aplicó la recomendación} | {ux-designer / ux-analyst / ui-developer} | {carpeta de salida `tmp/<tema>/<agente>-<slug>/`, artifact o rama del producto} |

## 3b. Formato de la presentación

Solo si se ejecuta el prototipo navegable (`prototype-showcase`); se completa con la ronda de formato de `references/module-plan.md`.

- Formato: {Solo la app simulada / App con recorridos guiados / Sistema UX completo} → `mode: 'app' | 'tour' | 'ux-system'`
- Secciones, en orden: {Definiciones y decisiones / Principios / Sistema / Inventario / ninguna / no aplica} → `sections: [...]`
- Por qué: {pedido; «supuesto» si se aplicó la recomendación sin respuesta}

## 4. Restricciones

- Entornos autorizados: {URL locales o de prueba; nunca producción con sesión}
- Datos y credenciales: {sesiones por rol aportadas por el usuario; nunca credenciales en el chat}
- Repositorio del producto (solo implementación): {ruta y rama nueva} · permiso para editarlo: {«Rama nueva, sin push» respondido por el usuario / sin permiso: solo parche}
- Otras restricciones: {lista o "ninguna"}

## 5. Pendientes

- [ ] {dato faltante, con responsable}
