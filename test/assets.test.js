// Checks the generated assets/ files: the library bundle, the dictionaries and the build info.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Load the scripts the same way the page does: plain scripts sharing one global scope
const sandbox = { atob, Uint8Array, Uint16Array, Uint32Array, DataView, ArrayBuffer, Map, Set, Math, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const file of ['build-info.js', 'thai-break.js', 'data-base.js', 'data-extra.js', 'data-extra-lines.js']) {
  vm.runInContext(fs.readFileSync(path.join(assets, file), 'utf8'), sandbox, { filename: file });
}
const { ThaiBreak: TB, ThaiBreakData: DATA, ThaiBreakBuild: BUILD } = sandbox;

const baseTrie = () => TB.ThaiTrie.fromBinary(Uint8Array.from(Buffer.from(DATA.baseDawg, 'base64')));
function addTsv(trie, tsv) {
  for (const line of tsv.split('\n')) {
    const [word, weight] = line.split('\t');
    if (word && !word.startsWith('#')) trie.add(word, Number(weight) || 1);
  }
  return trie;
}
const words = (trie, text) => new TB.Tokenizer(trie).tokenize(text).join('|');

test('the bundle exposes the library API', () => {
  for (const name of ['ThaiTrie', 'CompactDawg', 'Tokenizer', 'LineBreaker', 'BigramModel', 'thaiDisplayWidth', 'tccPosArray']) {
    assert.ok(TB[name], `missing ThaiBreak.${name}`);
  }
  assert.equal(TB.VERSION, BUILD.thaiBreak.version);
});

test('the base dictionary matches the build info', () => {
  assert.equal(baseTrie().size, BUILD.thaiBreak.baseWords);
  assert.ok(BUILD.thaiBreak.baseWords > 20000);
});

test('the dict-extra sets match the build info', () => {
  const count = (tsv) => tsv.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
  assert.equal(count(DATA.extra), BUILD.dictExtra.extraWords);
  assert.equal(count(DATA.extraLines), BUILD.dictExtra.extraLinesWords);
});

test('segments with the base dictionary', () => {
  assert.equal(words(baseTrie(), 'ฉันรักภาษาไทย'), 'ฉัน|รัก|ภาษา|ไทย');
  assert.equal(words(baseTrie(), 'เขากินข้าว.'), 'เขา|กิน|ข้าว|.');
});

test('dict-extra words take effect', () => {
  const text = 'ผู้เสียชีวิตถูกนำส่งโรงพยาบาลศิริราช';
  const base = words(baseTrie(), text);
  const extra = words(addTsv(baseTrie(), DATA.extra), text);
  assert.notEqual(extra, base);
  assert.match(extra, /เสียชีวิต/);
});

test('user words overlay the DAWG dictionary', () => {
  const trie = baseTrie();
  assert.equal(words(trie, 'ไอแพดโปรรุ่นใหม่').includes('ไอแพดโปร'), false);
  trie.add('ไอแพดโปร', 5);
  assert.match(words(trie, 'ไอแพดโปรรุ่นใหม่'), /^ไอแพดโปร\|/);
});

test('line breaking follows UAX #14', () => {
  const breaker = new TB.LineBreaker(new TB.Tokenizer(baseTrie()));
  assert.equal(breaker.insertLineBreaks('ISO/IEC 29110', '|', false), 'ISO/|IEC 29110');
  assert.equal(breaker.insertLineBreaks('ราคา100บาท', '|', false), 'ราคา100บาท');
  assert.equal(breaker.insertLineBreaks('ประเทศไทย(สยาม)เป็น', '|', false), 'ประเทศ|ไทย(สยาม)เป็น');
});
