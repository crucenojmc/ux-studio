// Contract tests for implement-ui/assets/stack-detect.mjs against fictional fixture repositories.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SCRIPT = path.join(REPO, 'plugins/ux-studio/skills/implement-ui/assets/stack-detect.mjs');
const FIXTURES = path.join(HERE, 'fixtures');

function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function detect(name) {
  const res = run(path.join(FIXTURES, name));
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

const names = (list) => list.map((item) => item.name);
const byName = (list, name) => list.find((item) => item.name === name);

/** Fresh output folder under the repo's git-ignored test-results/, never /tmp. */
function outputDir(name) {
  const dir = path.join(REPO, 'test-results', 'implement-ui', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** path → size and mtime of every file under dir. */
function snapshot(dir) {
  const out = {};
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) Object.assign(out, snapshot(p));
    else out[p] = `${st.size}:${st.mtimeMs}`;
  }
  return out;
}

describe('stack-detect CLI', () => {
  test('--help prints usage with the exit codes and exits 0', () => {
    const res = run('--help');
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage:/);
    assert.match(res.stdout, /64/);
  });

  test('-h wins over a path', () => {
    const res = run(path.join(FIXTURES, 'no-ui'), '-h');
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage:/);
  });

  test('no path is a usage error (64)', () => {
    const res = run();
    assert.equal(res.status, 64);
    assert.match(res.stderr, /repo path/i);
  });

  test('an unknown option is a usage error (64)', () => {
    const res = run('--deep', path.join(FIXTURES, 'no-ui'));
    assert.equal(res.status, 64);
    assert.match(res.stderr, /--deep/);
  });

  test('two paths are a usage error (64)', () => {
    const res = run(path.join(FIXTURES, 'no-ui'), path.join(FIXTURES, 'plain-html'));
    assert.equal(res.status, 64);
  });

  test('a path that is not a directory is a usage error (64)', () => {
    assert.equal(run(path.join(FIXTURES, 'missing-repo')).status, 64);
    assert.equal(run(path.join(FIXTURES, 'no-ui', 'README.md')).status, 64);
  });

  test('prints one JSON report with the absolute root', () => {
    const report = detect('no-ui');
    assert.equal(report.root, path.join(FIXTURES, 'no-ui'));
    for (const key of ['packageManager', 'ui', 'styling', 'tests', 'lintFormat', 'agentConfig', 'warnings']) {
      assert.ok(key in report, key);
    }
  });

  test('never writes into the repository it inspects', () => {
    const before = snapshot(FIXTURES);
    for (const name of readdirSync(FIXTURES)) run(path.join(FIXTURES, name));
    assert.deepEqual(snapshot(FIXTURES), before);
  });

  test('uses node built-ins only', () => {
    const source = readFileSync(SCRIPT, 'utf8');
    const specifiers = [...source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    assert.ok(specifiers.length > 0);
    for (const spec of specifiers) assert.match(spec, /^node:/, spec);
    assert.doesNotMatch(source, /\brequire\(|\bimport\(/);
  });

  test('a malformed package.json is a warning, not a crash', () => {
    const dir = outputDir('malformed');
    writeFileSync(path.join(dir, 'package.json'), '{ "name": ');
    const res = run(dir);
    assert.equal(res.status, 0, res.stderr);
    const report = JSON.parse(res.stdout);
    assert.deepEqual(report.ui, []);
    assert.ok(report.warnings.some((w) => /package\.json/.test(w)), report.warnings.join('\n'));
  });
});

describe('stack-detect on fixture repositories', () => {
  test('Angular 11 with Material, Fuse, SCSS, karma/jasmine and TSLint', () => {
    const r = detect('angular-fuse');
    assert.deepEqual(r.ui, [{ name: 'angular', version: '~11.2.14', major: 11, source: 'package.json' }]);
    assert.equal(r.packageManager, 'npm');
    assert.deepEqual(names(r.styling), ['scss', 'angular-material', 'fuse']);
    assert.equal(byName(r.styling, 'angular-material').version, '11.2.13');
    assert.deepEqual(byName(r.styling, 'fuse').evidence, ['src/@fuse']);
    assert.deepEqual(byName(r.styling, 'scss').evidence, ['src/@fuse/styles/_vars.scss', 'src/app/app.component.scss', 'src/styles.scss']);
    assert.equal(byName(r.styling, 'scss').variables, true);
    assert.deepEqual(names(r.tests.runners), ['karma', 'jasmine']);
    assert.equal(byName(r.tests.runners, 'karma').version, '~6.3.4');
    assert.deepEqual(r.tests.commands, [{ name: 'test', command: 'ng test', source: 'package.json#scripts' }]);
    assert.deepEqual(r.lintFormat.commands, [{ name: 'lint', command: 'ng lint', source: 'package.json#scripts' }]);
    assert.deepEqual(r.lintFormat.configs, ['tslint.json']);
    assert.deepEqual(r.agentConfig, { files: ['CLAUDE.md'], skills: ['angular-patterns', 'store-state'] });
    assert.deepEqual(r.warnings, []);
  });

  test('a .claude/skills folder without SKILL.md is not a skill', () => {
    const r = detect('angular-fuse');
    assert.ok(!r.agentConfig.skills.includes('_archive'), r.agentConfig.skills.join(', '));
  });

  test('Angular 16 with a Tailwind config, custom properties, karma and Playwright', () => {
    const r = detect('angular-tailwind');
    assert.deepEqual(names(r.ui), ['angular']);
    assert.equal(r.ui[0].major, 16);
    assert.equal(r.packageManager, 'yarn');
    assert.deepEqual(names(r.styling), ['tailwind', 'css-custom-properties']);
    assert.deepEqual(byName(r.styling, 'tailwind'), {
      name: 'tailwind', version: '^3.3.0', evidence: ['tailwind.config.js'],
    });
    assert.deepEqual(byName(r.styling, 'css-custom-properties').evidence, ['src/styles.css']);
    assert.deepEqual(names(r.tests.runners), ['karma', 'jasmine', 'playwright']);
    assert.deepEqual(names(r.tests.commands), ['test', 'playwright:test']);
    assert.deepEqual(names(r.lintFormat.commands), ['lint', 'format']);
    assert.deepEqual(r.lintFormat.configs, ['.prettierrc']);
    assert.deepEqual(r.agentConfig, { files: ['AGENTS.md'], skills: [] });
  });

  test('React with CSS modules, styled-components, vitest and ESLint', () => {
    const r = detect('react-vite');
    assert.deepEqual(r.ui, [{ name: 'react', version: '^18.2.0', major: 18, source: 'package.json' }]);
    assert.equal(r.packageManager, 'pnpm');
    assert.deepEqual(names(r.styling), ['css-modules', 'styled-components']);
    assert.deepEqual(byName(r.styling, 'css-modules').evidence, ['src/Card.module.css']);
    assert.deepEqual(names(r.tests.runners), ['vitest']);
    assert.deepEqual(r.tests.commands, [{ name: 'test', command: 'vitest run', source: 'package.json#scripts' }]);
    assert.deepEqual(names(r.lintFormat.commands), ['lint', 'fmt']);
    assert.deepEqual(r.lintFormat.configs, ['eslint.config.js']);
    assert.deepEqual(r.agentConfig, { files: ['.claude/CLAUDE.md'], skills: [] });
  });

  test('Vue with SCSS variables, jest and Stylelint; manager from packageManager', () => {
    const r = detect('vue-jest');
    assert.deepEqual(names(r.ui), ['vue']);
    assert.equal(r.ui[0].major, 3);
    assert.equal(r.packageManager, 'pnpm');
    assert.deepEqual(byName(r.styling, 'scss'), {
      name: 'scss', version: '^1.70.0', evidence: ['src/theme.scss'], variables: true,
    });
    assert.deepEqual(names(r.tests.runners), ['jest']);
    assert.deepEqual(r.lintFormat.commands, [
      { name: 'lint:style', command: 'stylelint "src/**/*.scss"', source: 'package.json#scripts' },
    ]);
  });

  test('Svelte with Tailwind 4 (no config file), vitest and Playwright', () => {
    const r = detect('svelte-tailwind4');
    assert.deepEqual(names(r.ui), ['svelte']);
    assert.equal(r.packageManager, null);
    assert.deepEqual(byName(r.styling, 'tailwind'), {
      name: 'tailwind', version: '^4.0.0', evidence: ['src/app.css'],
    });
    assert.deepEqual(names(r.tests.runners), ['vitest', 'playwright']);
    assert.deepEqual(names(r.tests.commands), ['test', 'test:e2e']);
    assert.deepEqual(r.lintFormat, { commands: [], configs: [] });
    assert.deepEqual(r.agentConfig, { files: [], skills: [] });
  });

  test('Ionic on Angular 8 reports both, with SCSS and custom properties', () => {
    const r = detect('ionic-angular');
    assert.deepEqual(r.ui, [
      { name: 'angular', version: '~8.2.14', major: 8, source: 'package.json' },
      { name: 'ionic', version: '^4.7.1', major: 4, source: 'package.json' },
    ]);
    assert.deepEqual(names(r.styling), ['scss', 'css-custom-properties']);
    assert.equal(byName(r.styling, 'scss').variables, false);
    assert.deepEqual(byName(r.styling, 'css-custom-properties').evidence, ['src/theme/variables.scss']);
  });

  test('Flutter from pubspec.yaml: SDK, flutter test, pubspec scripts, analysis options', () => {
    const r = detect('flutter-app');
    assert.deepEqual(r.ui, [
      { name: 'flutter', version: '>=3.10.0', major: 3, sdk: '>=3.0.3 <4.0.0', source: 'pubspec.yaml' },
    ]);
    assert.equal(r.packageManager, 'pub');
    assert.deepEqual(r.styling, [
      { name: 'flutter-material', evidence: ['pubspec.yaml#flutter.uses-material-design'] },
    ]);
    assert.deepEqual(r.tests.runners, [{ name: 'flutter-test', version: null, source: 'pubspec.yaml#dev_dependencies' }]);
    assert.deepEqual(r.tests.commands, [{ name: 'flutter test', command: 'flutter test', source: 'pubspec.yaml#dev_dependencies' }]);
    assert.deepEqual(r.lintFormat.commands, [
      { name: 'lint', command: 'flutter analyze --fatal-infos', source: 'pubspec.yaml#scripts' },
      { name: 'format', command: 'dart format --set-exit-if-changed lib test', source: 'pubspec.yaml#scripts' },
    ]);
    assert.deepEqual(r.lintFormat.configs, ['analysis_options.yaml']);
    assert.deepEqual(r.agentConfig, { files: ['AGENTS.md'], skills: ['flutter-widgets'] });
  });

  test('Flutter without pubspec scripts gets the SDK analyze and format commands', () => {
    const dir = outputDir('flutter-bare');
    writeFileSync(path.join(dir, 'pubspec.yaml'), 'name: bare_demo\n\ndependencies:\n  flutter:\n    sdk: flutter\n');
    const res = run(dir);
    assert.equal(res.status, 0, res.stderr);
    const r = JSON.parse(res.stdout);
    assert.deepEqual(r.ui, [{ name: 'flutter', version: null, major: null, sdk: null, source: 'pubspec.yaml' }]);
    assert.deepEqual(r.tests, { runners: [], commands: [] });
    assert.deepEqual(r.lintFormat.commands, [
      { name: 'analyze', command: 'flutter analyze', source: 'flutter sdk' },
      { name: 'format', command: 'dart format .', source: 'flutter sdk' },
    ]);
  });

  test('plain HTML with custom properties and no manifest', () => {
    const r = detect('plain-html');
    assert.deepEqual(r.ui, [{ name: 'html', source: 'index.html' }]);
    assert.equal(r.packageManager, null);
    assert.deepEqual(r.styling, [{ name: 'css-custom-properties', evidence: ['styles.css'] }]);
    assert.deepEqual(r.tests, { runners: [], commands: [] });
  });

  test('a folder without UI reports nothing and says so', () => {
    const r = detect('no-ui');
    assert.deepEqual(r.ui, []);
    assert.deepEqual(r.styling, []);
    assert.ok(r.warnings.some((w) => /no ui stack/i.test(w)), r.warnings.join('\n'));
  });
});
