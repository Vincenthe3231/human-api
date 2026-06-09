// Dev launcher: load .env.local into process.env, then start `vercel dev`.
//
// Why this exists: this is a framework-less, cloud-linked Vercel project. When you
// run `vercel dev`, it injects environment variables ONLY from the linked project's
// cloud "Development" environment — it does NOT read `.env.local` itself (there is no
// framework loader to do so). So hand-edited `.env.local` values never reach the
// serverless functions. This launcher loads `.env.local` into the parent process env;
// `vercel dev` and its function children then inherit them.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
try {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Don't override anything already set in the real shell environment.
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch (e) {
  console.warn(`[dev] could not read ${envPath}: ${e.message}`);
}

const port = process.env.PORT ?? '3002';
const child = spawn('pnpm', ['exec', 'vercel', 'dev', '--listen', port], {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
