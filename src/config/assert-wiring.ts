import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { openApiSpec } from '../docs/swagger.js';
import { MOUNTS } from './mount.js';

/**
 * Wiring audit: every folder in src/modules must appear in the MOUNTS
 * registry and contribute documented endpoints. Because app.ts mounts
 * FROM the registry, "in the registry" and "actually mounted" are the
 * same fact — no internals inspection needed.
 */
const DOCS_EXEMPT = new Set<string>(['health']); // documents itself by hand in swagger.ts

export function assertWiring(): void {
  const modulesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'modules');
  const modules = readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const mountedModules = new Set(MOUNTS.map((m) => m.module));
  const unmounted = modules.filter((m) => !mountedModules.has(m));

  const documentedPaths = Object.keys(openApiSpec.paths as Record<string, unknown>);
  const undocumented = modules.filter((m) => {
    if (DOCS_EXEMPT.has(m)) return false;
    const mount = MOUNTS.find((entry) => entry.module === m);
    const prefix = mount ? mount.path : `/${m}`;
    return !documentedPaths.some((p) => p === prefix || p.startsWith(`${prefix}/`));
  });

  const problems: string[] = [];
  if (unmounted.length > 0)
    problems.push(`UNMOUNTED modules (add to src/config/mounts.ts): ${unmounted.join(', ')}`);
  if (undocumented.length > 0)
    problems.push(`UNDOCUMENTED modules (missing *.docs.ts or its swagger.ts import): ${undocumented.join(', ')}`);

  if (problems.length > 0) {
    console.error(`❌ Wiring assertion failed:\n   • ${problems.join('\n   • ')}`);
    process.exit(1);
  }
}