// build.mjs
import { build, context } from 'esbuild';

const production = !process.argv.includes('--watch');

const sharedConfig = {
    entryPoints: {
        main: 'src/scripts/main.js',
        'csui-modern-bridge': 'src/scripts/modern/bridge/page-bridge.js',
    },
    bundle: true,
    outdir: 'public',
    entryNames: '[name]',
    platform: 'browser',
    format: 'iife',
    target: ['chrome110'],
    minify: production,
    sourcemap: production ? false : 'inline',
};

const chartConfig = {
    entryPoints: {
        'csui-consumption-chart': 'src/scripts/modern/components/consumption-chart.js',
    },
    bundle: true,
    outdir: 'public',
    entryNames: '[name]',
    platform: 'browser',
    format: 'esm',
    target: ['chrome110'],
    minify: production,
    sourcemap: production ? false : 'inline',
};

async function run() {
    const watchEnabled = process.argv.includes('--watch');

    if (watchEnabled) {
        const contexts = await Promise.all([context(sharedConfig), context(chartConfig)]);
        await Promise.all(contexts.map((ctx) => ctx.watch()));
        console.log('[esbuild] Watching for changes...');
    } else {
        await Promise.all([build(sharedConfig), build(chartConfig)]);
        console.log('[esbuild] Build complete');
    }
}

run().catch((err) => {
    console.error('[esbuild] Fatal error:', err);
    process.exit(1);
});
