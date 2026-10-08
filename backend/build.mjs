import esbuild from 'esbuild';
import { rmSync } from 'node:fs';

async function build() {
  // Remove saídas antigas do tsc: um dist/app.js com require("express") externo é
  // reconhecido pela Vercel como entrada do Express e ofusca o bundle autocontido.
  rmSync('dist', { recursive: true, force: true });

  await esbuild.build({
    entryPoints: ['src/app.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: 'app.js',
    target: 'node18',
    sourcemap: false,
    footer: {
      js: 'module.exports = app_default; module.exports.default = app_default; module.exports.app = app_default;',
    },
  });
  console.log('✅ Flow-Zap backend bundled into backend/app.js (CJS) successfully!');
}

build().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});
