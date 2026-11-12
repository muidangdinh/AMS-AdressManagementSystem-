import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const variants = JSON.parse(readFileSync(join(root, 'variants.json'), 'utf8'));
const arg = process.argv[2];
const names = !arg || arg === 'all' ? Object.keys(variants) : [arg];
const isWin = process.platform === 'win32';
const gradlew = join(root, 'android', isWin ? 'gradlew.bat' : 'gradlew');
const cap = (s) => s[0].toUpperCase() + s.slice(1);

for (const name of names) {
  if (!variants[name]) {
    console.error(`Không có flavor "${name}". Có: ${Object.keys(variants).join(', ')}`);
    process.exit(1);
  }
}

const run = (cmd, args, cwd) =>
  spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: isWin ? cmd.endsWith('.bat') : false }).status ?? 1;

let exitCode = 0;
try {
  for (const name of names) {
    const cfg = variants[name];
    console.log(`\n=== ${cfg.appName} (${name}) ===`);

    if (run('node', [join(root, 'scripts/generate-variant.mjs'), name], root) !== 0) {
      exitCode = 1;
      break;
    }

    const buildStatus = run(
      gradlew,
      [`assemble${cap(name)}Release`, '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a'],
      join(root, 'android'),
    );
    if (buildStatus !== 0) {
      exitCode = buildStatus;
      break;
    }

    const metaPath = join(root, 'android', 'app', 'build', 'outputs', 'apk', name, 'release', 'output-metadata.json');
    if (!existsSync(metaPath)) {
      console.error(`Không thấy ${metaPath}`);
      exitCode = 1;
      break;
    }

    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const outDir = join(root, 'dist', name);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    for (const el of meta.elements) {
      const abi = el.filters?.find((f) => f.filterType === 'ABI')?.value ?? 'universal';
      const src = join(dirname(metaPath), el.outputFile);
      const dest = join(outDir, `${cfg.appName}-v${el.versionName}-${abi}.apk`);
      cpSync(src, dest);
      console.log(`  -> ${dest}`);
    }
  }
} finally {
  run('node', [join(root, 'scripts/generate-variant.mjs'), '--default'], root);
}

process.exit(exitCode);
