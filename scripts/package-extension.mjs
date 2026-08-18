import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { unzipSync, zipSync } from 'fflate';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(projectRoot, 'manifest.json');
const packagePath = path.join(projectRoot, 'package.json');

await packageExtension().catch((error) => {
    console.error(`[package] ${error.message}`);
    process.exitCode = 1;
});

async function packageExtension() {
    const [manifest, packageJson] = await Promise.all([
        readJson(manifestPath),
        readJson(packagePath),
    ]);
    validateVersions(manifest, packageJson);

    const archiveBase = `${packageJson.name}-v${packageJson.version}`;
    const stagingDir = path.join(distDir, archiveBase);
    const archivePath = path.join(distDir, `${archiveBase}.zip`);

    await rm(distDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });

    const resourcePatterns = collectManifestResourcePatterns(manifest);
    const projectFiles = await listFiles(path.join(projectRoot, 'public'));
    const resourceFiles = resolveResourcePatterns(resourcePatterns, projectFiles);
    const packagedFiles = ['manifest.json', ...resourceFiles].sort();

    for (const relativePath of packagedFiles) {
        const sourcePath = path.join(projectRoot, relativePath);
        await assertRegularFile(sourcePath, `Manifest resource does not exist: ${relativePath}`);
        const destinationPath = path.join(stagingDir, relativePath);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await cp(sourcePath, destinationPath);
    }

    validatePackagedResources(resourcePatterns, packagedFiles);

    const archiveEntries = {};
    for (const relativePath of packagedFiles) {
        archiveEntries[relativePath] = new Uint8Array(
            await readFile(path.join(stagingDir, relativePath))
        );
    }

    const archive = zipSync(archiveEntries, { level: 9 });
    await writeFile(archivePath, archive);
    validateArchive(archive, packagedFiles);

    console.log(`[package] Created ${path.relative(projectRoot, archivePath)}`);
    console.log(`[package] Validated ${packagedFiles.length} packaged files`);
}

function collectManifestResourcePatterns(manifest) {
    const patterns = new Set();
    const add = (value) => {
        if (typeof value === 'string' && value.trim()) patterns.add(normalizeResourcePath(value));
    };
    const addIcons = (icons) => Object.values(icons || {}).forEach(add);

    addIcons(manifest.icons);
    (manifest.content_scripts || []).forEach((entry) => {
        (entry.js || []).forEach(add);
        (entry.css || []).forEach(add);
    });
    (manifest.web_accessible_resources || []).forEach((entry) => {
        (entry.resources || []).forEach(add);
    });
    add(manifest.background?.service_worker);
    (manifest.background?.scripts || []).forEach(add);
    addIcons(manifest.action?.default_icon);
    add(manifest.action?.default_popup);
    add(manifest.options_ui?.page);
    add(manifest.options_page);
    add(manifest.side_panel?.default_path);
    add(manifest.devtools_page);
    Object.values(manifest.chrome_url_overrides || {}).forEach(add);
    (manifest.sandbox?.pages || []).forEach(add);

    if (!patterns.size) throw new Error('Manifest does not declare any package resources.');
    return [...patterns].sort();
}

function resolveResourcePatterns(patterns, projectFiles) {
    const matched = new Set();

    patterns.forEach((pattern) => {
        if (!pattern.startsWith('public/')) {
            throw new Error(`Manifest resource must be under public/: ${pattern}`);
        }

        const matches = hasGlob(pattern)
            ? projectFiles.filter((file) => globToRegExp(pattern).test(file))
            : projectFiles.filter((file) => file === pattern);
        if (!matches.length) throw new Error(`Manifest resource does not exist: ${pattern}`);
        matches.forEach((file) => matched.add(file));
    });

    return [...matched].sort();
}

function validatePackagedResources(patterns, packagedFiles) {
    patterns.forEach((pattern) => {
        const matched = packagedFiles.some((file) =>
            hasGlob(pattern) ? globToRegExp(pattern).test(file) : file === pattern
        );
        if (!matched) throw new Error(`Packaged resource is missing: ${pattern}`);
    });
}

function validateVersions(manifest, packageJson) {
    if (manifest.version !== packageJson.version) {
        throw new Error(
            `Version mismatch: manifest.json is ${manifest.version}, package.json is ${packageJson.version}`
        );
    }

    const parts = String(manifest.version || '').split('.');
    const validChromeVersion =
        parts.length >= 1 &&
        parts.length <= 4 &&
        parts.every((part) => /^\d+$/.test(part) && Number(part) <= 65535);
    if (!validChromeVersion) {
        throw new Error(`Invalid Chrome extension version: ${manifest.version}`);
    }
}

function validateArchive(archive, packagedFiles) {
    const archiveFiles = Object.keys(unzipSync(archive)).sort();
    if (JSON.stringify(archiveFiles) !== JSON.stringify(packagedFiles)) {
        throw new Error('ZIP contents do not match the validated staging files.');
    }
}

function normalizeResourcePath(value) {
    const normalized = path.posix.normalize(String(value).replaceAll('\\', '/'));
    if (normalized.startsWith('../') || normalized.startsWith('/') || normalized === '..') {
        throw new Error(`Unsafe manifest resource path: ${value}`);
    }
    return normalized;
}

function hasGlob(value) {
    return /[*?]/.test(value);
}

function globToRegExp(pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const source = escaped
        .replaceAll('**', '::DOUBLE_STAR::')
        .replaceAll('*', '[^/]*')
        .replaceAll('::DOUBLE_STAR::', '.*')
        .replaceAll('?', '[^/]');
    return new RegExp(`^${source}$`);
}

async function listFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await listFiles(absolutePath)));
        else if (entry.isFile()) {
            files.push(path.relative(projectRoot, absolutePath).split(path.sep).join('/'));
        }
    }

    return files;
}

async function assertRegularFile(filePath, message) {
    try {
        if ((await stat(filePath)).isFile()) return;
    } catch {
        // Use the consistent validation error below.
    }
    throw new Error(message);
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}
