import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const variants = JSON.parse(readFileSync(resolve(root, 'variants.json'), 'utf8'));
const args = process.argv.slice(2);
const isDefault = args[0] === '--default';
const name = !args[0] || isDefault ? 'thanhhoa' : args[0];
const cfg = variants[name];

if (!cfg) {
  console.error(`Không có flavor "${name}". Có: ${Object.keys(variants).join(', ')}`);
  process.exit(1);
}

const apiUrl = isDefault ? cfg.apiUrl : args[1] ?? cfg.apiUrl;
if (!/^https?:\/\//.test(apiUrl)) {
  console.error(`API URL phải bắt đầu bằng http:// hoặc https:// — nhận: ${apiUrl}`);
  process.exit(1);
}

const content = `// AUTO-GENERATED bởi scripts/generate-variant.mjs — KHÔNG sửa tay.
// Nguồn: apps/mobile/variants.json (đổi xã thì chạy: node scripts/generate-variant.mjs <flavor>).

export const APP_VARIANT = '${name}';
export const API_URL = '${apiUrl}';
export const MAP_CENTER: [number, number] = [${cfg.mapCenter[0]}, ${cfg.mapCenter[1]}];
`;

writeFileSync(resolve(root, 'src/lib/appVariant.ts'), content);
console.log(`appVariant.ts -> ${name} (${apiUrl})`);
