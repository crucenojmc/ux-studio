# Plugins de Claude Code de Mapplics

Marketplace de Claude Code con un único plugin: **`ux-studio`**, que reúne el trabajo de un diseñador gráfico, un diseñador UX y un desarrollador frontend: diseño gráfico, investigación y arquitectura UX, diseño UX y prototipos, implementación frontend, auditoría y medición (utilidad, accesibilidad y fidelidad) y presentación de un producto, con videos opcionales. Sus agentes se usan desde la conversación principal o desde otro agente, con un sobre de tarea. Incluye recetas: caminos ya armados de un pedido a un entregable (por ejemplo, app simulada, sistema UX completo o handoff a desarrollo) que conservan las plantillas que el equipo usaba en Claude Design.

## Requisitos

| Requisito | Detalle |
| --- | --- |
| Claude Code | Versión 2.1.265 o superior (comandos `/design` y `/slides`). |
| `git` | Instalado en la máquina. |
| Sesión | Iniciada con `/login` en una cuenta claude.ai Pro, Max, Team o Enterprise, necesaria para publicar artifacts. |

No hace falta una cuenta de GitHub: el repositorio es público.

## Instalación

```bash
claude plugin marketplace add crucenojmc/ux-studio
claude plugin install ux-studio@ux-studio
```

Dentro de una sesión los mismos comandos funcionan como `/plugin marketplace add crucenojmc/ux-studio` y `/plugin install ux-studio@ux-studio`. Después, reiniciar la sesión o ejecutar `/reload-plugins`.

### Sin clave SSH de GitHub

Definir `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` antes de iniciar Claude Code. Las instalaciones y actualizaciones hechas desde dentro de una sesión no vuelven a HTTPS por sí solas.

### Actualización

```bash
claude plugin marketplace update ux-studio
claude plugin update ux-studio@ux-studio
```

También puede activarse la actualización automática en `/plugin` → Marketplaces (viene desactivada). Cada usuario recibe una copia nueva solo cuando cambia `version` en `plugin.json`.

### Desinstalación

```bash
claude plugin uninstall ux-studio@ux-studio
```

### Dependencias de la máquina

El plugin no instala nada por sí mismo. El skill `ux-env-setup` (script `check-env`) informa qué falta en la máquina para cada funcionalidad; ver el README del plugin.

### Desarrollo local

Desde un clon del repositorio:

```bash
claude plugin marketplace add ./ux-studio
```

El plugin se carga en el lugar: los cambios se aplican con `/reload-plugins`, sin subir la versión.

### Para un equipo

Declarar el marketplace en el `.claude/settings.json` del proyecto con `extraKnownMarketplaces` y `enabledPlugins`. Cada integrante debe instalar el plugin igualmente, y la carpeta del proyecto debe estar marcada como de confianza (workspace trust).

## Validación

```bash
claude plugin validate .
claude plugin validate plugins/ux-studio
```

## Estructura del repositorio

```text
.claude-plugin/marketplace.json   Catálogo del marketplace
plugins/ux-studio/                Plugin (agentes, skills, README propio)
tests/                            Pruebas por skill
```

## Agregar un plugin nuevo

1. Crear la carpeta `plugins/<nombre>/` con su `.claude-plugin/plugin.json`.
2. Registrarlo en `.claude-plugin/marketplace.json` (`name`, `source: "./plugins/<nombre>"`, `description`).
3. Ejecutar `claude plugin validate .` y `claude plugin validate plugins/<nombre>`.

## Documentación del plugin

Ver [`plugins/ux-studio/README.md`](plugins/ux-studio/README.md).

## Licencia

[MIT](LICENSE).
