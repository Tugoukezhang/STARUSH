import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import { createBundleAnalysisPlugins } from './tooling-plugins.mjs';

const root = fs.realpathSync(path.resolve(import.meta.dirname, '..'));
await build({ root, configFile: path.join(root, 'vite.config.js'), plugins: createBundleAnalysisPlugins(root, { enabled: true }) });
console.log(`Local bundle reports: ${path.join(root, 'output/tooling/bundle')}`);
