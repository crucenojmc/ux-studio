// Shared readers for the ux-recipes tests: recipe frontmatter, sections and the index table.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const PLUGIN = path.join(REPO, 'plugins/ux-studio');
export const SKILLS = path.join(PLUGIN, 'skills');
export const SKILL = path.join(SKILLS, 'ux-recipes');
export const RECIPES = path.join(SKILL, 'recipes');

export const read = (...p) => readFileSync(path.join(...p), 'utf8');
export const words = (text) => text.split(/\s+/).filter(Boolean).length;
export const skillExists = (name) => existsSync(path.join(SKILLS, name, 'SKILL.md'));

export const KEYS = ['id', 'title', 'source', 'medium', 'fallback', 'agent', 'skills'];
export const SECTIONS = ['When', 'Expect', 'Questions', 'Medium', 'Structure', 'Steps', 'Checks', 'Return'];
export const EXPECT_LABELS = ['Obtienes:', 'No incluye:', 'Ideal si:'];
export const SOURCES = ['own', 'claude-design'];
export const MEDIA = ['design', 'design-system', 'slides', 'docs', 'dashboard', 'html'];
export const FALLBACKS = ['html', 'markdown', 'none'];
export const AGENTS = ['ux-designer', 'ux-analyst', 'ui-developer', 'video-producer'];
export const INDEX_COLUMNS = ['id', 'título', 'cuándo', 'qué obtienes', 'medio', 'agente'];
export const TYPES = ['grafico', 'investigacion', 'diseno-ux', 'implementacion', 'auditoria', 'presentacion'];

// This writer's own recipes; the other ten arrive from a parallel writer at integration.
export const OWN = ['ux-system', 'app-prototype', 'variants', 'redesign', 'dev-handoff', 'ux-audit'];

// Every recipe the plugin ships, id → title (the README and the router list all of them).
export const TITLES = {
  'ux-system': 'Sistema UX completo',
  'app-prototype': 'App simulada',
  variants: 'Exploración de variantes',
  redesign: 'Rediseño de pantalla existente',
  'dev-handoff': 'Handoff a desarrollo',
  'ux-audit': 'Auditoría UX y de accesibilidad',
  'ui-mockups': 'Mockups de interfaz (web o mobile)',
  wireframe: 'Wireframes',
  animation: 'Animación de interfaz',
  'object-3d': 'Objeto 3D',
  'html-email': 'Email HTML',
  'color-type-pairing': 'Paleta y tipografía',
  diagram: 'Diagrama',
  'print-piece': 'Pieza gráfica (flyer, afiche, redes)',
  deck: 'Presentación en diapositivas',
  document: 'Documento o informe',
  'data-story': 'Datos explicados',
};

export const recipeFiles = () => (existsSync(RECIPES) ? readdirSync(RECIPES) : []).filter((f) => f.endsWith('.md') && f !== 'index.md').sort();

const unquote = (v) => v.trim().replace(/^["']|["']$/g, '');

export function parseRecipe(file) {
  const text = read(RECIPES, file);
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { text, keys: [], front: {}, body: '' };
  const keys = [];
  const front = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-z]+):\s*(.*)$/);
    if (!kv) continue;
    keys.push(kv[1]);
    const raw = kv[2].trim();
    front[kv[1]] = raw.startsWith('[') ? raw.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean) : unquote(raw);
  }
  return { text, keys, front, body: match[2] };
}

export const headings = (body) => [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

export function section(text, name) {
  const at = text.search(new RegExp(`^##+ ${name}`, 'm'));
  if (at < 0) return '';
  const level = text.slice(at).match(/^#+/)[0];
  const from = text.indexOf('\n', at) + 1 || text.length;
  const end = text.slice(from).search(new RegExp(`^#{1,${level.length}} `, 'm'));
  return text.slice(at, end < 0 ? undefined : from + end);
}

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function indexTable() {
  const file = path.join(RECIPES, 'index.md');
  const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n').filter((l) => l.trim().startsWith('|'));
  const header = lines.length ? cells(lines[0]).map((c) => c.toLowerCase()) : [];
  const rows = lines.filter((l) => /^\| `[a-z0-9-]+` \|/.test(l.trim())).map((l) => {
    const c = cells(l);
    return Object.fromEntries(header.map((h, i) => [h, c[i] ?? '']));
  });
  return { header, rows };
}

export const tableIds = (text) => [...text.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);
