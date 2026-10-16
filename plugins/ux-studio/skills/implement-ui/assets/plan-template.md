# Plan de implementación: <pantalla o componente>

Pedido de consentimiento. Hasta recibir `consent: granted` no se escribe nada en el repositorio del
producto: ni rama, ni archivos, ni formateo.

- Objetivo: <qué se construye o corrige, en una línea>
- Repositorio: <ruta del repositorio del producto>
- Fuente de verdad: <pantalla del prototipo, sistema de diseño, `tokens.css`>
- Alcance del diseño: <plataforma (Web · Mobile · Web y mobile) y roles>
- Stack detectado: <framework y versión, estilos, ejecutor de pruebas> (salida de `stack-detect.mjs`)
- Convenciones leídas: <`CLAUDE.md`, `AGENTS.md`, skills del proyecto>

## Rama

| Nombre | Base | Convención aplicada |
|---|---|---|
| <`feature/…`> | <rama base> | <regla del proyecto que la define> |

## Archivos

| Archivo | Acción (crear · modificar) | Cambio | Motivo |
|---|---|---|---|
| | | | |

## Tokens

| Token | Uso | Cómo llega al código (variable CSS, tema de Tailwind, variable SCSS, tema de Flutter) |
|---|---|---|
| | | |

## Pruebas

- Modo: <TDD declarado por el proyecto (prueba en rojo primero) · pruebas junto con el cambio>
- Pruebas a agregar o ajustar: <archivo y caso>

## Verificación

Comandos del proyecto, tal como los ejecuta su equipo:

| Comando | Para qué |
|---|---|
| | Pruebas |
| | Lint |
| | Formato |

Fallas que ya existen en la rama base: <nombre de la prueba o regla, o «ninguna conocida»>.

## Dependencias

<Ninguna> · <paquete y versión, motivo: requiere un consentimiento propio>

## Fuera de alcance

- <lo que este cambio no hace>

## Preguntas

<Ninguna> · <ruta del cuestionario y las preguntas que bloquean parte del plan>

## Para continuar

Quien invoca obtiene la aprobación del usuario y vuelve a invocar con `consent: granted` y la ruta de
este plan. El consentimiento cubre solo estos archivos y esta rama; cualquier archivo fuera del
plan, dependencia, cambio de configuración o migración requiere un plan nuevo.
