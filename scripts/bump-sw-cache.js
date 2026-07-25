#!/usr/bin/env node
// Recalcula la version de cache del service worker (sw.js) a partir de un
// hash del contenido real de los archivos que cachea, en vez de un numero
// que hay que recordar subir a mano en cada deploy. Se ejecuta solo (via
// el hook .githooks/pre-commit) antes de cada commit.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW_PATH = path.join(ROOT, 'sw.js');

const sw = fs.readFileSync(SW_PATH, 'utf8');
const assetsMatch = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
if (!assetsMatch) {
  console.error('bump-sw-cache: no se encontro el arreglo ASSETS en sw.js');
  process.exit(1);
}

const assets = [...assetsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const hash = crypto.createHash('sha256');
for (const rel of assets) {
  const file = path.join(ROOT, rel.replace(/^\.\//, ''));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) hash.update(fs.readFileSync(file));
}
const version = hash.digest('hex').slice(0, 10);
const newCacheLine = `const CACHE = 'nutriruta-${version}';`;

const newSw = sw.replace(/const CACHE = '[^']*';/, newCacheLine);
if (newSw !== sw) {
  fs.writeFileSync(SW_PATH, newSw);
  console.log(`bump-sw-cache: version actualizada -> nutriruta-${version}`);
} else {
  console.log('bump-sw-cache: sin cambios en los archivos cacheados, version igual');
}
