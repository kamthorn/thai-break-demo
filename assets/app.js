/**
 * ThaiBreak Live Demo — UI logic.
 * Everything runs in the browser; text and dictionaries never leave the page.
 */
(() => {
  'use strict';

  const TB = window.ThaiBreak;
  const BUILD = window.ThaiBreakBuild || {};
  const DATA = (window.ThaiBreakData = window.ThaiBreakData || {});

  const STORAGE_SETTINGS = 'thai-break-demo:settings';
  const STORAGE_USER = 'thai-break-demo:user-dict';
  const MARK = ''; // private-use marker for line-break opportunities
  const THAI = /[฀-๿]/;
  const WHITESPACE = /^\s+$/;
  const MAX_USER_FILE = 5 * 1024 * 1024;
  const MAX_WORD_LENGTH = 60;

  const EXTRA_SETS = {
    extra: { label: 'ชุดตัดคำ (words-extra)', script: 'assets/data-extra.js', file: 'words-extra.tsv', words: BUILD.dictExtra?.extraWords },
    extraLines: { label: 'ชุดตัดบรรทัด (words-extra-lines)', script: 'assets/data-extra-lines.js', file: 'words-extra-lines.tsv', words: BUILD.dictExtra?.extraLinesWords },
  };

  const PRESETS = {
    basic: 'สวัสดีครับ ยินดีต้อนรับสู่ระบบตัดคำภาษาไทย ฉันรักภาษาไทยเพราะเป็นภาษาที่มีเอกลักษณ์และสวยงาม',
    ambiguous: 'ฉันนั่งตากลมที่ชายหาด ส่วนเขาไปหามเหสีที่วัง การประชุมสามัญประจำปีจัดขึ้นที่กรุงเทพมหานคร คนขับรถบอกว่าอึดอัดใจ',
    extra: 'นายกรัฐมนตรีเดินทางไปจังหวัดเชียงใหม่ เจ้าหน้าที่ตำรวจรับแจ้งเหตุว่ามีผู้เสียชีวิตและนำส่งโรงพยาบาลศิริราช ส่วนบริษัทสตาร์ทอัพพัฒนาแอปพลิเคชันปัญญาประดิษฐ์ด้วยการเรียนรู้เชิงลึก',
    punct: 'ราคา 1,500 บาท (ลด 20%) ติดต่อ user@example.com โทร 02-123-4567 วันที่ 1/2/2567 เวลา 10:30 น. เด็กๆ เล่นกัน ฯลฯ ตั้งแต่ พ.ศ.2567 ที่ รพ.ศิริราช',
    uax14: 'มาตรฐาน ISO/IEC 29110 และเอกสาร WP01 “ภาษาไทย”(สยาม) เป็นแบบ state-of-the-art ดูที่ https://example.com/a-b?x=1 ภาษาไทย–อังกฤษ เด็ก ๆ วิ่งเล่น',
    long: `ภาษาไทยเป็นภาษาที่เขียนติดต่อกันโดยไม่เว้นวรรคระหว่างคำ ซึ่งแตกต่างจากภาษาตะวันตกส่วนใหญ่ที่ใช้การเว้นวรรคเป็นตัวแบ่งคำ การประมวลผลข้อความภาษาไทยด้วยคอมพิวเตอร์จึงต้องมีขั้นตอนการตัดคำ เพื่อแบ่งสายอักขระที่ต่อเนื่องกันออกเป็นคำตามพจนานุกรมและหลักภาษา

ความท้าทายหลักของการตัดคำภาษาไทยคือความกำกวม เช่น "ตากลม" ที่อ่านได้ทั้ง "ตาก-ลม" และ "ตา-กลม" รวมทั้งกลุ่มอักขระไทย (Thai Character Cluster) ที่ประกอบด้วยพยัญชนะ สระ วรรณยุกต์ และตัวการันต์ ซึ่งแยกออกจากกันไม่ได้ หากตัดผิดจะทำให้คำเสียความหมายหรือแสดงผลผิดเพี้ยน

การตัดแบ่งบรรทัดสำหรับเว็บไซต์และเอกสาร PDF ยังต้องเป็นไปตาม Unicode Standard Annex #14 และ W3C Requirements for Thai Text Layout เช่น ห้ามขึ้นบรรทัดใหม่หลังวงเล็บเปิด ห้ามเริ่มบรรทัดด้วยเครื่องหมายปิด ไม้ยมก หรือไปยาลน้อย และไม่ตัดกลางตัวเลข คำย่อ หรืออีเมล

พจนานุกรมมีผลต่อความแม่นยำมากที่สุด คำเฉพาะทาง ชื่อคน ชื่อสถานที่ และคำทับศัพท์ใหม่ๆ มักไม่มีในพจนานุกรมพื้นฐาน การเพิ่มพจนานุกรมเสริมหรือพจนานุกรมของหน่วยงานเองจึงช่วยให้ตัดคำได้ถูกต้องขึ้นมาก`,
  };

  // ---------------------------------------------------------------- DOM
  const $ = (id) => document.getElementById(id);
  const el = {
    input: $('input-text'), counter: $('char-counter'), run: $('btn-run'), clear: $('btn-clear'),
    extraSelect: $('extra-select'), extraMeta: $('extra-meta'), baseCount: $('base-count'),
    dropzone: $('dropzone'), userFile: $('user-file'), userWords: $('user-words'), userWeight: $('user-weight'),
    userStatus: $('user-status'), userRemember: $('user-remember'), userDownload: $('user-download'), userClear: $('user-clear'),
    weightHelpToggle: $('weight-help-toggle'), weightHelp: $('weight-help'),
    optColors: $('opt-colors'), optCompare: $('opt-compare'), optLive: $('opt-live'),
    stats: $('stats'), legend: $('legend'), output: $('output'),
    compare: $('compare'), compareOutput: $('compare-output'), compareSummary: $('compare-summary'),
    wrapWidth: $('wrap-width'), wrapWidthValue: $('wrap-width-value'), wrapThaiBreak: $('wrap-thaibreak'), wrapBrowser: $('wrap-browser'),
    exportPreview: $('export-preview'), codeSample: $('code-sample'), copyCode: $('copy-code'), toast: $('toast'),
    buildInfo: $('build-info'),
  };

  // ---------------------------------------------------------------- state
  const state = {
    mode: 'word',
    extraChoice: 'auto',
    user: new Map(), // word -> weight
    userVersion: 0,
    codeLang: 'js',
    runId: 0,
    last: null, // { units: string[], mode }
  };

  // ---------------------------------------------------------------- helpers
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (n) => Number(n).toLocaleString('th-TH');
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.toast.classList.remove('show'), 1800);
  }

  async function copy(text, message) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(message);
  }

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src, async: true });
      s.onload = resolve;
      s.onerror = () => reject(new Error(`โหลด ${src} ไม่สำเร็จ`));
      document.head.appendChild(s);
    });
  }

  function decodeBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  /** Spelling variants the tokenizer normalizes before matching (เเ → แ, ํา → ำ). */
  const lookupForm = (w) => w.replace(/เเ/g, 'แ').replace(/ํ([่-๋]?)า/g, '$1ำ');

  // ---------------------------------------------------------------- dictionaries
  const baseBytes = decodeBase64(DATA.baseDawg);
  const baseDawg = new TB.CompactDawg(baseBytes);
  const extraMaps = {};
  const engines = new Map();

  function baseHas(word) {
    const chars = Array.from(word);
    return baseDawg.prefixesFromChars(chars, 0, chars.length).some((m) => m.end === chars.length);
  }

  /** Parse "word" or "word<TAB|,>weight" lines. */
  function parseWordList(text, defaultWeight) {
    const entries = new Map();
    const invalid = [];
    text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.replace(/[​-‍⁠]/g, '').trim();
      if (!line || line.startsWith('#')) return;
      const [word, weightText] = line.split(/\t|,/).map((s) => s.trim());
      if (!word || /\s/.test(word) || Array.from(word).length > MAX_WORD_LENGTH) {
        invalid.push(i + 1);
        return;
      }
      const weight = weightText === undefined || weightText === '' ? defaultWeight : Number(weightText);
      if (!(weight > 0) || !Number.isFinite(weight)) {
        invalid.push(i + 1);
        return;
      }
      entries.set(word, Math.max(weight, entries.get(word) || 0));
    });
    return { entries, invalid };
  }

  async function extraMap(key) {
    if (!key) return null;
    if (!extraMaps[key]) {
      if (DATA[key] === undefined) {
        el.extraMeta.textContent = 'กำลังโหลดพจนานุกรมเสริม…';
        await loadScript(EXTRA_SETS[key].script);
      }
      extraMaps[key] = parseWordList(DATA[key], 1).entries;
    }
    return extraMaps[key];
  }

  const effectiveExtra = () => (state.extraChoice === 'auto' ? (state.mode === 'word' ? 'extra' : 'extraLines') : state.extraChoice === 'none' ? null : state.extraChoice);

  /** Tokenizer + line breaker for a dictionary setup, cached until the user dictionary changes. */
  function engine(extraKey, withUser) {
    const key = `${extraKey || 'none'}|${withUser ? state.userVersion : 'base'}`;
    if (!engines.has(key)) {
      const trie = TB.ThaiTrie.fromBinary(baseBytes);
      if (extraKey) for (const [w, weight] of extraMaps[extraKey]) trie.add(w, weight);
      if (withUser) for (const [w, weight] of state.user) trie.add(w, weight);
      const tokenizer = new TB.Tokenizer(trie);
      engines.set(key, { tokenizer, breaker: new TB.LineBreaker(tokenizer), words: uniqueWords(extraKey, withUser) });
    }
    return engines.get(key);
  }

  /** Number of distinct words: base plus added words that the base dictionary lacks. */
  function uniqueWords(extraKey, withUser) {
    const added = new Set();
    if (extraKey) for (const w of extraMaps[extraKey].keys()) added.add(w);
    if (withUser) for (const w of state.user.keys()) added.add(w);
    let count = baseDawg.numWords;
    for (const w of added) if (!baseHas(w)) count++;
    return count;
  }

  function classify(token, extra) {
    if (!THAI.test(token)) return 'other';
    const w = lookupForm(token);
    if (state.user.has(token) || state.user.has(w)) return 'user';
    if (baseHas(w)) return 'base';
    if (extra && extra.has(w)) return 'extra';
    if (w.includes('.')) return 'abbr';
    return 'oov';
  }

  const SOURCE_LABEL = { base: 'พจนานุกรมพื้นฐาน', extra: 'dict-extra', user: 'พจนานุกรมของคุณ', abbr: 'คำย่อ (ตามรูปแบบ)', oov: 'ไม่มีในพจนานุกรม', other: '' };

  // ---------------------------------------------------------------- segmentation
  /**
   * Units of the text with whitespace kept: tokens in word mode; in line mode the
   * segments between line-break opportunities, also split at spaces (which are
   * break opportunities too). `breaks` holds the break positions in line mode.
   */
  function segment(eng, text, mode) {
    if (mode === 'word') return { units: eng.tokenizer.tokenize(text, true), breaks: null };
    const units = [];
    const breaks = new Set();
    let pos = 0;
    for (const piece of eng.breaker.insertLineBreaks(text, MARK, false).split(MARK)) {
      for (const part of piece.split(/(\s+)/)) if (part) units.push(part);
      pos += piece.length;
      breaks.add(pos);
    }
    return { units, breaks };
  }

  /** Spans [start, end) of the non-whitespace units. */
  function spans(units) {
    const set = new Set();
    let pos = 0;
    for (const u of units) {
      if (!WHITESPACE.test(u)) set.add(`${pos}:${pos + u.length}`);
      pos += u.length;
    }
    return set;
  }

  function renderUnits(units, { extra, colored, changedAgainst, mode, breaks }) {
    if (!units.length) return '<span class="placeholder">ยังไม่มีผลลัพธ์</span>';
    const html = [];
    let pos = 0;
    let index = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const start = pos;
      pos += u.length;
      if (WHITESPACE.test(u)) {
        html.push(u.includes('\n') ? '<br>'.repeat((u.match(/\n/g) || []).length) : escapeHtml(u));
        continue;
      }
      index++;
      const src = mode === 'word' ? classify(u, extra) : null;
      const changed = changedAgainst && !changedAgainst.has(`${start}:${pos}`);
      const classes = ['tok'];
      if (src && src !== 'other') classes.push(`src-${src === 'abbr' ? 'base' : src}`);
      if (changed) classes.push('changed');
      const title = [`${mode === 'word' ? 'คำ' : 'ส่วน'}ที่ ${index}`, src && SOURCE_LABEL[src], changed && 'ต่างจากพจนานุกรมพื้นฐาน'].filter(Boolean).join(' · ');
      html.push(`<span class="${classes.join(' ')}" title="${escapeHtml(title)}">${escapeHtml(u)}</span>`);
      const next = units[i + 1];
      const breakHere = mode === 'word' ? true : breaks.has(pos);
      if (next !== undefined && !WHITESPACE.test(next) && breakHere) html.push('<span class="sep" aria-hidden="true"></span>');
    }
    return `<div class="${colored ? 'colored' : ''}">${html.join('')}</div>`;
  }

  /** Join units back to text with a separator at every break opportunity. */
  function joinUnits(units, sep, mode, breaks) {
    let out = '';
    let pos = 0;
    units.forEach((u, i) => {
      out += u;
      pos += u.length;
      const next = units[i + 1];
      if (next !== undefined && !WHITESPACE.test(u) && !WHITESPACE.test(next) && (mode === 'word' || breaks.has(pos))) out += sep;
    });
    return out;
  }

  // ---------------------------------------------------------------- run
  async function run() {
    const id = ++state.runId;
    const text = el.input.value;
    updateCounter();
    if (!text.trim()) {
      state.last = null;
      el.output.innerHTML = '<span class="placeholder">พิมพ์ข้อความหรือเลือกข้อความตัวอย่างด้านบน</span>';
      el.stats.innerHTML = '';
      el.compare.hidden = true;
      renderWrap();
      renderExport();
      return;
    }

    const extraKey = effectiveExtra();
    let extra;
    try {
      extra = await extraMap(extraKey);
    } catch (err) {
      toast(err.message);
      return;
    }
    if (id !== state.runId) return; // a newer run started while loading
    updateExtraMeta();

    const mode = state.mode;
    const eng = engine(extraKey, true);
    const t0 = performance.now();
    const { units, breaks } = segment(eng, text, mode);
    const ms = Math.max(performance.now() - t0, 0.001);

    const customized = Boolean(extraKey) || state.user.size > 0;
    let baseUnits = null;
    let baseBreaks = null;
    if (el.optCompare.checked && customized) {
      ({ units: baseUnits, breaks: baseBreaks } = segment(engine(null, false), text, mode));
    }

    const unitSpans = spans(units);
    const baseSpans = baseUnits && spans(baseUnits);
    const count = unitSpans.size;
    const colored = el.optColors.checked && mode === 'word';
    el.legend.classList.toggle('hidden-colors', !colored);
    el.legend.hidden = !colored && !baseUnits;
    el.output.innerHTML = renderUnits(units, { extra, colored, changedAgainst: baseSpans, mode, breaks });

    if (baseUnits) {
      const changed = [...unitSpans].filter((s) => !baseSpans.has(s)).length;
      el.compare.hidden = false;
      el.compareSummary.textContent = changed ? `ต่างกัน ${fmt(changed)} ${mode === 'word' ? 'คำ' : 'ส่วน'} (ขีดเส้นใต้)` : 'ผลเหมือนกัน';
      el.compareOutput.innerHTML = renderUnits(baseUnits, { extra: null, colored: false, changedAgainst: unitSpans, mode, breaks: baseBreaks });
    } else {
      el.compare.hidden = true;
    }

    el.stats.innerHTML = [
      `<span class="stat">${mode === 'word' ? 'คำ' : 'ส่วน'} <strong>${fmt(count)}</strong></span>`,
      `<span class="stat">ตัวอักษร <strong>${fmt(text.length)}</strong></span>`,
      `<span class="stat">เวลา <strong>${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)} ms</strong></span>`,
      `<span class="stat">พจนานุกรม <strong>${fmt(eng.words)}</strong> คำ</span>`,
    ].join('');

    state.last = { units, mode, breaks };
    renderWrap();
    renderExport();
  }

  const runLive = debounce(() => { if (el.optLive.checked) run(); }, 180);

  // ---------------------------------------------------------------- wrap preview
  function renderWrap() {
    const text = el.input.value;
    if (!text.trim()) {
      el.wrapThaiBreak.textContent = '';
      el.wrapBrowser.textContent = '';
      return;
    }
    // The preview always uses line-break opportunities, whatever the output mode.
    // run() has loaded the extra dictionary before calling this.
    const extraKey = effectiveExtra();
    const eng = engine(extraKey && extraMaps[extraKey] ? extraKey : null, true);
    const html = [];
    const pieces = eng.breaker.insertLineBreaks(text, MARK, false).split(MARK);
    pieces.forEach((piece, i) => {
      for (const part of piece.split(/(\s+)/)) {
        if (!part) continue;
        if (WHITESPACE.test(part)) html.push(part.includes('\n') ? '<br>'.repeat((part.match(/\n/g) || []).length) : ' ');
        else html.push(`<span class="seg">${escapeHtml(part)}</span>`);
      }
      if (i < pieces.length - 1) html.push('<wbr>');
    });
    el.wrapThaiBreak.innerHTML = html.join('');
    el.wrapBrowser.textContent = text;
  }

  function setWrapWidth(px) {
    el.wrapWidthValue.textContent = `${px}px`;
    el.wrapThaiBreak.style.width = `${px}px`;
    el.wrapBrowser.style.width = `${px}px`;
  }

  // ---------------------------------------------------------------- export
  function exportText(kind) {
    if (!state.last) return '';
    const { units, mode, breaks } = state.last;
    const words = units.filter((u) => !WHITESPACE.test(u));
    switch (kind) {
      case 'pipe': return joinUnits(units, '|', mode, breaks);
      case 'dot': return joinUnits(units, '·', mode, breaks);
      case 'zwsp': return joinUnits(units, '​', mode, breaks);
      case 'json': return JSON.stringify(mode === 'word' ? words : segmentsOf(units, breaks), null, 2);
      default: return '';
    }
  }

  function segmentsOf(units, breaks) {
    return joinUnits(units, MARK, 'line', breaks).split(MARK).map((s) => s.trim()).filter(Boolean);
  }

  function renderExport() {
    const text = exportText('pipe');
    el.exportPreview.textContent = text ? (text.length > 3000 ? `${text.slice(0, 3000)}…` : text) : 'ยังไม่มีผลลัพธ์';
    renderCode();
  }

  // ---------------------------------------------------------------- code sample
  function renderCode() {
    const extraKey = effectiveExtra();
    const extraFile = extraKey && EXTRA_SETS[extraKey].file;
    const users = [...state.user];
    const shown = users.slice(0, 5);
    const more = users.length - shown.length;
    const sampleText = (el.input.value.trim().split('\n')[0] || 'ข้อความภาษาไทย').slice(0, 60).replace(/'/g, "\\'");
    const fn = state.mode === 'word' ? 'tokenize' : 'insertLineBreaks';

    let code;
    if (state.codeLang === 'js') {
      code = [
        "import fs from 'node:fs';",
        "import { ThaiTrie, Tokenizer, LineBreaker } from 'thai-break'; // npm install thai-break",
        '',
        '// พจนานุกรมพื้นฐาน (Compact DAWG) ที่มากับแพ็กเกจ',
        "const trie = ThaiTrie.fromBinary(fs.readFileSync('node_modules/thai-break/dist/data/words.dawg'));",
      ];
      if (extraFile) {
        code.push('', `// พจนานุกรมเสริม: ${extraFile} จาก github.com/kamthorn/thai-break-dict-extra (dist/)`,
          `for (const line of fs.readFileSync('${extraFile}', 'utf8').split('\\n')) {`,
          "  const [word, weight] = line.split('\\t');",
          '  if (word && !word.startsWith(\'#\')) trie.add(word, Number(weight) || 1);',
          '}');
      }
      if (users.length) {
        code.push('', '// พจนานุกรมของคุณ: คำ, น้ำหนัก');
        for (const [w, weight] of shown) code.push(`trie.add('${w.replace(/'/g, "\\'")}', ${weight});`);
        if (more > 0) code.push(`// …และอีก ${fmt(more)} คำ (โหลดจากไฟล์ .tsv แบบเดียวกับพจนานุกรมเสริมได้)`);
      }
      code.push('', 'const tokenizer = new Tokenizer(trie);');
      if (state.mode === 'word') {
        code.push(`console.log(tokenizer.tokenize('${sampleText}').join('|'));`);
      } else {
        code.push('const breaker = new LineBreaker(tokenizer);', `console.log(breaker.${fn}('${sampleText}')); // แทรก U+200B ที่จุดตัดบรรทัด`);
      }
    } else {
      code = [
        '<?php',
        '// composer require kamthorn/thai-break',
        'use ThaiBreak\\ThaiTokenizer;',
        '',
        '$tokenizer = ThaiTokenizer::withDefaultDict();',
      ];
      if (extraFile) {
        code.push('', `// พจนานุกรมเสริม: ${extraFile} จาก github.com/kamthorn/thai-break-dict-extra (dist/)`,
          '$extra = [];',
          `foreach (file('${extraFile}', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {`,
          '    [$word, $weight] = explode("\\t", $line) + [1 => 1];',
          '    $extra[$word] = (float) $weight;',
          '}',
          '$tokenizer->addCustomWords($extra);');
      }
      if (users.length) {
        code.push('', '// พจนานุกรมของคุณ: คำ => น้ำหนัก', '$tokenizer->addCustomWords([');
        for (const [w, weight] of shown) code.push(`    '${w.replace(/'/g, "\\'")}' => ${Number.isInteger(weight) ? `${weight}.0` : weight},`);
        if (more > 0) code.push(`    // …และอีก ${fmt(more)} คำ`);
        code.push(']);');
      }
      code.push('', state.mode === 'word'
        ? `echo implode('|', $tokenizer->tokenize('${sampleText}'));`
        : `echo $tokenizer->insertLineBreaks('${sampleText}'); // แทรก U+200B ที่จุดตัดบรรทัด`);
    }
    el.codeSample.textContent = code.join('\n');
  }

  // ---------------------------------------------------------------- user dictionary
  function applyUserWords({ quiet = false } = {}) {
    const defaultWeight = Number(el.userWeight.value) > 0 ? Number(el.userWeight.value) : 5;
    const { entries, invalid } = parseWordList(el.userWords.value, defaultWeight);
    state.user = entries;
    state.userVersion++;
    for (const key of [...engines.keys()]) if (!key.endsWith('|base')) engines.delete(key);

    el.userStatus.className = 'user-status';
    if (!entries.size && !invalid.length) {
      el.userStatus.textContent = 'ยังไม่มีคำของคุณ';
    } else {
      el.userStatus.classList.add(invalid.length ? 'warn' : 'ok');
      el.userStatus.textContent = `ใช้งาน ${fmt(entries.size)} คำ` +
        (invalid.length ? ` · ข้าม ${fmt(invalid.length)} บรรทัดที่อ่านไม่ได้ (บรรทัด ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? ', …' : ''})` : '');
    }
    el.userDownload.disabled = !entries.size;
    el.userClear.disabled = !el.userWords.value;
    saveUser();
    if (!quiet) run();
  }
  const applyUserWordsLive = debounce(applyUserWords, 350);

  function readUserFile(file) {
    if (!file) return;
    if (file.size > MAX_USER_FILE) {
      toast('ไฟล์ใหญ่เกิน 5 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      el.userWords.value = String(reader.result);
      applyUserWords();
      toast(`โหลด ${file.name} แล้ว`);
    };
    reader.onerror = () => toast('อ่านไฟล์ไม่สำเร็จ');
    reader.readAsText(file, 'utf-8');
  }

  function saveUser() {
    try {
      if (el.userRemember.checked) {
        localStorage.setItem(STORAGE_USER, JSON.stringify({ text: el.userWords.value, weight: el.userWeight.value }));
      } else {
        localStorage.removeItem(STORAGE_USER);
      }
    } catch { /* storage unavailable (private mode) */ }
  }

  // ---------------------------------------------------------------- settings
  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
        mode: state.mode, extra: state.extraChoice,
        colors: el.optColors.checked, compare: el.optCompare.checked, live: el.optLive.checked,
      }));
    } catch { /* ignore */ }
  }

  function restore() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || 'null');
      if (s) {
        if (s.mode === 'line' || s.mode === 'word') state.mode = s.mode;
        if (['auto', 'extra', 'extraLines', 'none'].includes(s.extra)) state.extraChoice = s.extra;
        el.optColors.checked = s.colors !== false;
        el.optCompare.checked = s.compare !== false;
        el.optLive.checked = s.live !== false;
      }
      const u = JSON.parse(localStorage.getItem(STORAGE_USER) || 'null');
      if (u) {
        el.userRemember.checked = true;
        el.userWords.value = u.text || '';
        if (u.weight) el.userWeight.value = u.weight;
      }
    } catch { /* ignore */ }
    document.querySelector(`input[name="mode"][value="${state.mode}"]`).checked = true;
    el.extraSelect.value = state.extraChoice;
  }

  function updateCounter() {
    el.counter.textContent = `${fmt(el.input.value.length)} ตัวอักษร`;
  }

  function updateExtraMeta() {
    const key = effectiveExtra();
    if (!key) {
      el.extraMeta.textContent = 'ไม่ใช้พจนานุกรมเสริม';
      return;
    }
    const set = EXTRA_SETS[key];
    const auto = state.extraChoice === 'auto' ? 'ใช้ ' : '';
    el.extraMeta.textContent = `${auto}${set.label} · ${set.words ? fmt(set.words) : '–'} คำ`;
  }

  function updateHeaderFacts() {
    const tb = BUILD.thaiBreak || {};
    $('fact-version').textContent = `thai-break v${TB.VERSION}`;
    $('fact-base').textContent = fmt(baseDawg.numWords);
    el.baseCount.textContent = fmt(baseDawg.numWords);
    $('fact-extra').textContent = BUILD.dictExtra ? `+${fmt(BUILD.dictExtra.extraWords)}` : '–';
    if (BUILD.builtAt) {
      el.buildInfo.innerHTML = `สร้างเมื่อ ${escapeHtml(BUILD.builtAt)} จาก ` +
        `<a href="https://github.com/kamthorn/thai-break/commit/${escapeHtml(tb.commit || '')}" target="_blank" rel="noopener">thai-break@${escapeHtml(tb.commit || '?')}</a> (v${escapeHtml(tb.version || TB.VERSION)}) และ ` +
        `<a href="https://github.com/kamthorn/thai-break-dict-extra/commit/${escapeHtml(BUILD.dictExtra?.commit || '')}" target="_blank" rel="noopener">thai-break-dict-extra@${escapeHtml(BUILD.dictExtra?.commit || '?')}</a>`;
    }
  }

  // ---------------------------------------------------------------- tabs
  function setupTabs() {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      for (const t of tabs) {
        const selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
        $(t.getAttribute('aria-controls')).hidden = !selected;
      }
      tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) {
          e.preventDefault();
          select(tabs[(i + d + tabs.length) % tabs.length]);
        }
      });
    });
  }

  // ---------------------------------------------------------------- events
  function bind() {
    el.input.addEventListener('input', () => { updateCounter(); runLive(); });
    el.input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    });
    el.run.addEventListener('click', run);
    el.clear.addEventListener('click', () => { el.input.value = ''; run(); el.input.focus(); });

    document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener('change', () => {
      state.mode = r.value;
      el.run.firstChild.textContent = state.mode === 'word' ? 'ตัดคำ ' : 'หาจุดตัดบรรทัด ';
      saveSettings();
      run();
    }));
    el.extraSelect.addEventListener('change', () => { state.extraChoice = el.extraSelect.value; saveSettings(); run(); });
    for (const opt of [el.optColors, el.optCompare, el.optLive]) opt.addEventListener('change', () => { saveSettings(); run(); });

    document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      el.input.value = PRESETS[b.dataset.preset];
      run();
    }));

    // User dictionary
    el.dropzone.addEventListener('click', () => el.userFile.click());
    el.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.userFile.click();
      }
    });
    el.userFile.addEventListener('change', () => { readUserFile(el.userFile.files[0]); el.userFile.value = ''; });
    for (const type of ['dragenter', 'dragover']) {
      el.dropzone.addEventListener(type, (e) => { e.preventDefault(); el.dropzone.classList.add('dragover'); });
    }
    for (const type of ['dragleave', 'drop']) {
      el.dropzone.addEventListener(type, () => el.dropzone.classList.remove('dragover'));
    }
    el.dropzone.addEventListener('drop', (e) => { e.preventDefault(); readUserFile(e.dataTransfer.files[0]); });
    el.userWords.addEventListener('input', () => applyUserWordsLive());
    el.userWeight.addEventListener('change', () => applyUserWords());
    el.userRemember.addEventListener('change', saveUser);
    el.userClear.addEventListener('click', () => { el.userWords.value = ''; applyUserWords(); });
    el.userDownload.addEventListener('click', () => {
      const tsv = [...state.user].map(([w, weight]) => `${w}\t${weight}`).join('\n') + '\n';
      download('user-dict.tsv', tsv, 'text/tab-separated-values;charset=utf-8');
    });
    el.weightHelpToggle.addEventListener('click', () => {
      const open = el.weightHelp.hidden;
      el.weightHelp.hidden = !open;
      el.weightHelpToggle.setAttribute('aria-expanded', String(open));
    });

    // Wrap preview
    el.wrapWidth.addEventListener('input', () => setWrapWidth(el.wrapWidth.value));

    // Export
    const copyLabels = { pipe: 'คัดลอกแบบคั่น | แล้ว', dot: 'คัดลอกแบบคั่น · แล้ว', zwsp: 'คัดลอกพร้อม U+200B แล้ว', json: 'คัดลอก JSON แล้ว' };
    document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(exportText(b.dataset.copy), copyLabels[b.dataset.copy])));
    document.querySelectorAll('[data-download]').forEach((b) => b.addEventListener('click', () => {
      if (!state.last) return;
      if (b.dataset.download === 'json') download('thai-break-result.json', exportText('json'), 'application/json');
      else download('thai-break-result.txt', exportText('pipe'), 'text/plain;charset=utf-8');
    }));

    // Code sample
    document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
      state.codeLang = b.dataset.lang;
      document.querySelectorAll('[data-lang]').forEach((x) => x.classList.toggle('active', x === b));
      renderCode();
    }));
    el.copyCode.addEventListener('click', () => copy(el.codeSample.textContent, 'คัดลอกโค้ดแล้ว'));
  }

  // ---------------------------------------------------------------- start
  restore();
  updateHeaderFacts();
  setupTabs();
  bind();
  setWrapWidth(el.wrapWidth.value);
  el.run.firstChild.textContent = state.mode === 'word' ? 'ตัดคำ ' : 'หาจุดตัดบรรทัด ';
  applyUserWords({ quiet: true });
  el.input.value = PRESETS.basic;
  run();
})();
