import { mkdir, copyFile, readFile } from 'node:fs/promises';
const packageRoot = new URL('../node_modules/maplibre-gl/', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'));
if (!/^[0-9][\w.-]*$/.test(version)) throw new Error('Invalid MapLibre asset version');
const destination = new URL(`../public/maplibre/${version}/`, import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(new URL('dist/maplibre-gl-worker.mjs', packageRoot), new URL('maplibre-gl-worker.mjs', destination));
await copyFile(new URL('LICENSE.txt', packageRoot), new URL('LICENSE.txt', destination));
