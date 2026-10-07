import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['src/app.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: 'app.js',
    target: 'node18',
    sourcemap: false,
  });
  console.log('✅ Flow-Zap backend bundled into backend/app.js successfully!');
}

build().catch((err) => {
  console.error('Build error:', err);
  process.exit(1);
});
