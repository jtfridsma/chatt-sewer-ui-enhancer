// build.mjs
import { build, context } from 'esbuild';

const sharedConfig = {
    entryPoints: ['src/scripts/main.js'],
    bundle: true,
    outfile: 'public/main.js',
    platform: 'browser',
    format: 'iife',
    target: ['chrome110'],
    minify: true,
};

async function run() {
    const watchEnabled = process.argv.includes('--watch');

    if (watchEnabled) {
        const ctx = await context(sharedConfig);
        await ctx.watch();
        console.log('[esbuild] Watching for changes...');
    } else {
        await build(sharedConfig);
        console.log('[esbuild] Build complete');
    }
}

run().catch((err) => {
    console.error('[esbuild] Fatal error:', err);
    process.exit(1);
});
