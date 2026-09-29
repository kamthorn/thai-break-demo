import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Find PHPThaiNLP or local data
const candidates = [
  path.resolve(projectRoot, '../PHPThaiNLP'),
  path.resolve(projectRoot, 'node_modules/thai-break'),
];

let phpThaiNlpDir = candidates.find(p => fs.existsSync(p));
if (!phpThaiNlpDir) {
  throw new Error('Cannot find PHPThaiNLP repository directory');
}

const distDir = path.join(phpThaiNlpDir, 'typescript/dist');
const wordsFile = path.join(phpThaiNlpDir, 'data/words.txt');
const pkgJson = JSON.parse(fs.readFileSync(path.join(phpThaiNlpDir, 'typescript/package.json'), 'utf8'));
const version = pkgJson.version || '1.0.1';

console.log(`Building thai-break bundle v${version} from ${distDir}...`);

const wordsData = fs.readFileSync(wordsFile, 'utf8').trim();

// Strip import/export statements from compiled typescript dist files
function cleanModule(code) {
  return code
    .replace(/^import\s+.*?;?\s*$/gm, '')
    .replace(/^export\s+(const|let|function|class|default)\s+/gm, '$1 ');
}

const tccCode = cleanModule(fs.readFileSync(path.join(distDir, 'tcc.js'), 'utf8'));
const trieCode = cleanModule(fs.readFileSync(path.join(distDir, 'trie.js'), 'utf8'));
const bigramCode = cleanModule(fs.readFileSync(path.join(distDir, 'bigram.js'), 'utf8'));
const tokenizerCode = cleanModule(fs.readFileSync(path.join(distDir, 'tokenizer.js'), 'utf8'));
const linebreakerCode = cleanModule(fs.readFileSync(path.join(distDir, 'linebreaker.js'), 'utf8'));

const bundle = `/**
 * ThaiBreak - Standalone Browser & Node.js Bundle
 * Version: ${version}
 * High-Performance Thai Word Tokenizer & Typographic Line Breaker
 * Complies with Unicode UAX #14 (LB13, LB23) & W3C Thai Text Layout Requirements
 * Based on https://github.com/kamthorn/thai-break
 * Licensed under Apache-2.0
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();
    root.ThaiBreak = exports;
    if (typeof globalThis !== 'undefined') {
      globalThis.ThaiBreak = exports;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = ${JSON.stringify(version)};

  // --- Embedded Dictionary (Royal Institute Dictionary 25,907 words) ---
  const EMBEDDED_DICT = ${JSON.stringify(wordsData)};

  // --- TCC Grammar ---
  ${tccCode}

  // --- Flat Prefix Trie ---
  ${trieCode}

  // --- Bigram Model ---
  ${bigramCode}

  // --- DAG + Viterbi Forward DP Tokenizer ---
  ${tokenizerCode}

  // --- W3C / Unicode UAX #14 Typographic Line Breaker ---
  ${linebreakerCode}

  // --- High-level API ---
  let defaultTokenizer = null;
  let defaultLineBreaker = null;

  function initDefault() {
    if (defaultTokenizer) return;
    const trie = ThaiTrie.fromTsv(EMBEDDED_DICT);
    defaultTokenizer = new Tokenizer(trie);
    defaultLineBreaker = new LineBreaker(defaultTokenizer);
  }

  function getTokenizer() {
    if (!defaultTokenizer) initDefault();
    return defaultTokenizer;
  }

  function getBreaker() {
    if (!defaultLineBreaker) initDefault();
    return defaultLineBreaker;
  }

  const ThaiBreak = {
    VERSION: VERSION,
    DEFAULT_BREAK_MARKER: DEFAULT_BREAK_MARKER,
    ThaiTrie: ThaiTrie,
    BigramModel: BigramModel,
    Tokenizer: Tokenizer,
    LineBreaker: LineBreaker,
    getTCCPattern: getTCCPattern,
    tccPosArray: tccPosArray,
    canBreakBetween: canBreakBetween,
    thaiDisplayWidth: thaiDisplayWidth,

    init: function (options) {
      options = options || {};
      if (options.tokenizer) {
        defaultTokenizer = options.tokenizer;
        defaultLineBreaker = new LineBreaker(defaultTokenizer);
        return;
      }
      let trie = new ThaiTrie();
      let bigrams = undefined;

      if (options.dictTsv) {
        trie = ThaiTrie.fromTsv(options.dictTsv);
      } else {
        trie = ThaiTrie.fromTsv(EMBEDDED_DICT);
      }

      if (options.bigramsTsv) {
        bigrams = BigramModel.fromTsv(options.bigramsTsv);
      }

      defaultTokenizer = new Tokenizer(trie, bigrams);
      defaultLineBreaker = new LineBreaker(defaultTokenizer);
    },

    getTokenizer: getTokenizer,
    getBreaker: getBreaker,

    words: function (text, keepWhitespace) {
      if (keepWhitespace === undefined) keepWhitespace = false;
      return getTokenizer().tokenize(text, keepWhitespace);
    },

    lines: function (text, isHtml, marker) {
      if (isHtml === undefined) isHtml = false;
      if (marker === undefined) marker = DEFAULT_BREAK_MARKER;
      return getBreaker().insertLineBreaks(text, marker, isHtml);
    },

    wrap: function (text, width, isHtml) {
      if (isHtml === undefined) isHtml = false;
      return getBreaker().wrap(text, width, isHtml);
    },

    displayWidth: function (text) {
      return thaiDisplayWidth(text);
    },

    join: function (text, glue) {
      if (glue === undefined) glue = '|';
      return ThaiBreak.words(text, false).join(glue);
    }
  };

  return ThaiBreak;
});
`;

const targetFile = path.join(projectRoot, 'thai-break.js');
fs.writeFileSync(targetFile, bundle);
console.log(`Successfully generated ${targetFile} (v${version}), size: ${bundle.length} bytes`);
