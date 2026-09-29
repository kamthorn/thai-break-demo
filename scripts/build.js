#!/usr/bin/env node
/**
 * Build the browser assets of the demo from the sibling source projects.
 *
 *   node scripts/build.js [--thai-break ../thai-break] [--dict-extra ../thai-break-dict-extra]
 *
 * Environment variables THAI_BREAK_DIR and DICT_EXTRA_DIR work too.
 *
 * Inputs
 *   thai-break/typescript/dist/*.js      compiled TypeScript (run `npm run build` there first)
 *   thai-break/data/words.dawg           base dictionary (Compact DAWG)
 *   thai-break-dict-extra/dist/*.tsv     supplementary dictionaries (word<TAB>weight)
 *
 * Outputs (assets/)
 *   thai-break.js         the library as one browser script (window.ThaiBreak)
 *   data-base.js          base dictionary, base64 DAWG
 *   data-extra.js         dict-extra word-segmentation set   (loaded on demand)
 *   data-extra-lines.js   dict-extra line-breaking set       (loaded on demand)
 *   build-info.js         versions, source commits and word counts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = path.join(root, 'assets');

function option(flag, envName, fallback) {
  const i = process.argv.indexOf(flag);
  if (i !== -1 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  if (process.env[envName]) return path.resolve(process.env[envName]);
  return path.resolve(root, fallback);
}

const thaiBreakDir = option('--thai-break', 'THAI_BREAK_DIR', '../thai-break');
const dictExtraDir = option('--dict-extra', 'DICT_EXTRA_DIR', '../thai-break-dict-extra');

function need(file, hint) {
  if (!fs.existsSync(file)) {
    console.error(`Missing ${file}\n${hint}`);
    process.exit(1);
  }
  return file;
}

// Modules of thai-break/typescript/src in dependency order (index.ts is Node-only and not bundled)
const MODULES = ['linebreak-data', 'uax14', 'tcc', 'trie', 'bigram', 'tokenizer', 'linebreaker'];
const distDir = path.join(thaiBreakDir, 'typescript', 'dist');

/**
 * Turn one compiled ES module into a function scope that returns its exports.
 * tsc emits only `import { a, b } from './x.js'` and `export class|const|function name`,
 * so anything else is rejected instead of being silently mangled.
 */
function wrapModule(name, code) {
  const exported = [];
  code = code
    .replace(/^\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+)\.js';?\s*$/gm, (_, names, dep) => {
      if (!MODULES.slice(0, MODULES.indexOf(name)).includes(dep)) {
        throw new Error(`${name} imports ${dep}, which is not bundled before it`);
      }
      return `const {${names.replace(/\s+as\s+/g, ': ')}} = __modules['${dep}'];`;
    })
    .replace(/^export\s+(class|const|let|function\*?)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, id) => {
      exported.push(id);
      return `${kind} ${id}`;
    });
  const leftover = code.match(/^\s*(import|export)\b.*$/m);
  if (leftover) throw new Error(`Unsupported statement in ${name}.js: ${leftover[0]}`);
  return `  __modules['${name}'] = (function () {\n${code.trim()}\n    return { ${exported.join(', ')} };\n  })();`;
}

function gitInfo(dir) {
  try {
    const out = (args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
    return { commit: out(['rev-parse', '--short', 'HEAD']), date: out(['log', '-1', '--format=%cs']) };
  } catch {
    return { commit: 'unknown', date: '' };
  }
}

function countWords(tsv) {
  return tsv.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
}

function writeAsset(name, content) {
  fs.writeFileSync(path.join(assetsDir, name), content);
  console.log(`  assets/${name}  ${(Buffer.byteLength(content) / 1024).toFixed(0)} KB`);
}

// --- Library bundle -------------------------------------------------------
need(path.join(distDir, 'tokenizer.js'), `Build the TypeScript port first:\n  (cd ${path.join(thaiBreakDir, 'typescript')} && npm ci && npm run build)`);
const tbPackage = JSON.parse(fs.readFileSync(path.join(thaiBreakDir, 'typescript', 'package.json'), 'utf8'));
const tbGit = gitInfo(thaiBreakDir);
const extraGit = gitInfo(dictExtraDir);

const modules = MODULES.map((m) => wrapModule(m, fs.readFileSync(need(path.join(distDir, `${m}.js`), ''), 'utf8')));

const libraryBundle = `/**
 * ThaiBreak ${tbPackage.version} — browser bundle for the demo
 * https://github.com/kamthorn/thai-break (Apache-2.0)
 * Built from thai-break@${tbGit.commit} by scripts/build.js. Do not edit.
 */
(function (root) {
  'use strict';
  const __modules = {};

${modules.join('\n\n')}

  const api = { VERSION: ${JSON.stringify(tbPackage.version)} };
  for (const name of ${JSON.stringify(MODULES)}) Object.assign(api, __modules[name]);
  root.ThaiBreak = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
`;

// --- Dictionaries ---------------------------------------------------------
const dawg = fs.readFileSync(need(path.join(thaiBreakDir, 'data', 'words.dawg'), 'Base dictionary not found'));
const baseWords = dawg.readUInt32LE(8);

const extraFiles = {
  extra: 'words-extra.tsv',
  extraLines: 'words-extra-lines.tsv',
};
const extras = {};
for (const [key, file] of Object.entries(extraFiles)) {
  const tsv = fs.readFileSync(need(path.join(dictExtraDir, 'dist', file), `Build dict-extra first:\n  (cd ${dictExtraDir} && python3 scripts/build.py)`), 'utf8').trim();
  extras[key] = { tsv, words: countWords(tsv) };
}

const dataHeader = (what, source) => `/* ${what} — ${source}. Generated by scripts/build.js. Do not edit. */\nwindow.ThaiBreakData = window.ThaiBreakData || {};\n`;

const buildInfo = {
  builtAt: new Date().toISOString().slice(0, 10),
  thaiBreak: { version: tbPackage.version, ...tbGit, baseWords },
  dictExtra: { ...extraGit, extraWords: extras.extra.words, extraLinesWords: extras.extraLines.words },
};

fs.mkdirSync(assetsDir, { recursive: true });
console.log(`Building from thai-break ${tbPackage.version} (${tbGit.commit}) and thai-break-dict-extra (${extraGit.commit}):`);
writeAsset('thai-break.js', libraryBundle);
writeAsset('data-base.js', dataHeader(`Base dictionary, ${baseWords} words (Compact DAWG, base64)`, `thai-break@${tbGit.commit} data/words.dawg, Apache-2.0`) +
  `window.ThaiBreakData.baseDawg = ${JSON.stringify(dawg.toString('base64'))};\n`);
writeAsset('data-extra.js', dataHeader(`dict-extra word-segmentation set, ${extras.extra.words} words`, `thai-break-dict-extra@${extraGit.commit} dist/words-extra.tsv, CC0-1.0`) +
  `window.ThaiBreakData.extra = ${JSON.stringify(extras.extra.tsv)};\n`);
writeAsset('data-extra-lines.js', dataHeader(`dict-extra line-breaking set, ${extras.extraLines.words} words`, `thai-break-dict-extra@${extraGit.commit} dist/words-extra-lines.tsv, CC0-1.0`) +
  `window.ThaiBreakData.extraLines = ${JSON.stringify(extras.extraLines.tsv)};\n`);
writeAsset('build-info.js', `/* Generated by scripts/build.js. Do not edit. */\nwindow.ThaiBreakBuild = ${JSON.stringify(buildInfo, null, 2)};\n`);
