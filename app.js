/**
 * ThaiBreak Demo - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const inputText = document.getElementById('input-text');
  const charCounter = document.getElementById('char-counter');
  const btnClear = document.getElementById('btn-clear');
  const btnProcess = document.getElementById('btn-process');
  const modeRadios = document.querySelectorAll('input[name="break-mode"]');
  const outputDisplay = document.getElementById('output-display');
  const statMode = document.getElementById('stat-mode');
  const statTime = document.getElementById('stat-time');
  const statWords = document.getElementById('stat-words');
  const statChars = document.getElementById('stat-chars');
  const statSpeed = document.getElementById('stat-speed');
  const presetButtons = document.querySelectorAll('.btn-preset');

  // Copy Buttons & Toast
  const btnCopyDots = document.getElementById('btn-copy-dots');
  const btnCopyPipe = document.getElementById('btn-copy-pipe');
  const btnCopyZwsp = document.getElementById('btn-copy-zwsp');
  const btnCopyJson = document.getElementById('btn-copy-json');
  const copyToast = document.getElementById('copy-toast');

  // Line Wrap Simulation Elements
  const simWidthSlider = document.getElementById('sim-width-slider');
  const simWidthVal = document.getElementById('sim-width-val');
  const simBox = document.getElementById('sim-box');

  // Current state
  let currentMode = 'word'; // 'word' or 'line'
  let lastResultTokens = [];
  let lastResultTextWithDots = '';
  let lastResultTextWithPipe = '';
  let lastResultTextWithZwsp = '';

  // Preset Sample Texts
  const PRESETS = {
    basic: 'สวัสดีครับคุณลูกค้า ยินดีต้อนรับสู่ระบบตัดคำภาษาไทยที่พัฒนาขึ้นเพื่อการประมวลผลข้อความความเร็วสูง',
    v101: 'ทดสอบกฎใหม่ใน ThaiBreak v1.0.1 (ตาม Unicode UAX #14):\n1. กฎ LB23 ตัวอักษรติดกับตัวเลขไม่แยกกัน: มาตรฐาน ISO29110, งาน WP01, ลำดับที่ 3rd\n2. กฎ LB13 เครื่องหมายทับ (Solidus /) ไม่ตัดก่อนหน้า: มาตรฐาน ISO/IEC 29110, เอกสาร วท./01, อัตราส่วน 10/20',
    punct: 'ข้อความทดสอบ (เช่น "ตัวอย่างประโยค") ดีมากๆ 100% และอื่นๆ ฯลฯ ติดต่อ info@example.com หรือโทร 02-123-4567',
    paragraph: `โครงการ ThaiBreak ได้รับการออกแบบสถาปัตยกรรมแบบ Monorepo เพื่อรองรับการใช้งานในทุก Stack โดยใช้คลังคำศัพท์มาตรฐานพจนานุกรมฉบับราชบัณฑิตยสถาน 25,907 คำ เป็น Single Source of Truth มีความแม่นยำทางภาษาศาสตร์ระดับ 96.03% F1-Score บนชุดทดสอบมาตรฐาน LST20 Benchmark และปลอดภัยสำหรับการนำไปใช้งานในเชิงพาณิชย์ 100% ภายใต้สัญญาอนุญาต Apache-2.0`,
    long: `ภาษาไทยเป็นภาษาที่มีการเขียนติดต่อกันเป็นแถวแนวนอนโดยไม่มีการเว้นวรรคระหว่างคำ ซึ่งแตกต่างจากภาษาตะวันตกส่วนใหญ่ที่ใช้การเว้นวรรคเป็นตัวแบ่งคำอย่างชัดเจน การประมวลผลข้อความภาษาไทยในระบบคอมพิวเตอร์จึงจำเป็นต้องมีขั้นตอนการตัดคำ (Word Segmentation) เพื่อแบ่งสายอักขระที่ต่อเนื่องกันให้ออกเป็นคำที่มีความหมายตามพจนานุกรมและหลักไวยากรณ์

ความท้าทายหลักของการตัดคำภาษาไทยคือความกำกวมของภาษา เช่น คำว่า "ตากลม" ที่สามารถแบ่งเป็น "ตาก-ลม" (ผึ่งลม) หรือ "ตา-กลม" (ดวงตากลมโต) รวมทั้งการมีกลุ่มอักขระไทย (Thai Character Cluster หรือ TCC) ซึ่งประกอบด้วยพยัญชนะ สระ วรรณยุกต์ และตัวการันต์ที่ไม่สามารถตัดแยกออกจากกันได้ หากตัดผิดจะทำให้คำเสียความหมายหรือแสดงผลผิดเพี้ยนไปอย่างสิ้นเชิง

นอกจากนี้ การตัดแบ่งบรรทัด (Typographic Line Breaking) ยังมีข้อกำหนดที่เข้มงวดตามมาตรฐานสากล W3C และ Unicode Standard Annex #14 โดยไม่เพียงแต่ต้องตัดที่ขอบเขตของคำเท่านั้น แต่ยังต้องรักษาความถูกต้องตามหลักการจัดพิมพ์ เช่น ห้ามตัดบรรทัดหลังเครื่องหมายเปิด ห้ามตัดบรรทัดหน้าเครื่องหมายปิดหรือเครื่องหมายวรรคตอนอย่างไม้ยมกและไปยาลน้อย รวมถึงห้ามแทรกจุดตัดบรรทัดติดกับช่องว่าง

ด้วยเหตุนี้ โครงการ ThaiBreak จึงพัฒนาขึ้นเพื่อแก้ไขปัญหาดังกล่าวอย่างเบ็ดเสร็จ ด้วยการผสานโครงสร้างข้อมูล Trie ที่ค้นหาคำนำหน้าได้อย่างรวดเร็ว อัลกอริทึม Dynamic Programming แบบ Viterbi Forward/Backward และกฎการแบ่งบรรทัดที่ครอบคลุม ทำให้ได้ผลลัพธ์ที่แม่นยำระดับ 96% และมีความเร็วในการประมวลผลสูงกว่า 1.5 ล้านตัวอักษรต่อวินาที`,
    stress: (() => {
      const p1 = `ภาษาไทยเป็นภาษาที่มีการเขียนติดต่อกันเป็นแถวแนวนอนโดยไม่มีการเว้นวรรคระหว่างคำ การประมวลผลข้อความภาษาไทยในระบบคอมพิวเตอร์จึงจำเป็นต้องมีขั้นตอนการตัดคำ (Word Segmentation) เพื่อแบ่งสายอักขระที่ต่อเนื่องกันให้ออกเป็นคำที่มีความหมายตามพจนานุกรมและหลักไวยากรณ์ ความท้าทายหลักของการตัดคำภาษาไทยคือความกำกวมของภาษา และการมีกลุ่มอักขระไทย (Thai Character Cluster) ซึ่งประกอบด้วยพยัญชนะ สระ วรรณยุกต์ ที่ไม่สามารถแยกออกจากกันได้ `;
      const p2 = `โครงการ ThaiBreak ได้รับการออกแบบสถาปัตยกรรมแบบ Monorepo เพื่อรองรับการใช้งานในทุก Stack โดยใช้คลังคำศัพท์มาตรฐานพจนานุกรมฉบับราชบัณฑิตยสถาน 25,907 คำ เป็น Single Source of Truth ผ่านการประเมินความแม่นยำบน LST20 Benchmark Dataset ได้คะแนน F1-Score สูงถึง 96.03% ด้วยความเร็วระดับไมโครวินาที `;
      const p3 = `การตัดแบ่งบรรทัดสำหรับสื่อสิ่งพิมพ์ เว็บไซต์ และเอกสารดิจิทัล จำเป็นต้องปฏิบัติตามมาตรฐานสากล เช่น W3C Requirements for Thai Text Layout และ Unicode UAX #14 โดยการแทรกเครื่องหมาย Zero-Width Space (U+200B) ในตำแหน่งที่ถูกต้องตามหลักภาษาศาสตร์และอักขรวิธี `;
      let combined = (p1 + '\n\n' + p2 + '\n\n' + p3 + '\n\n').repeat(6);
      return combined.slice(0, 5000).trim();
    })()
  };

  // Character counter & limit checker
  function updateCharCount() {
    const len = inputText.value.length;
    charCounter.textContent = `${len.toLocaleString()} / 5,000 ตัวอักษร`;
    if (len > 5000) {
      charCounter.classList.add('warning');
    } else {
      charCounter.classList.remove('warning');
    }
  }

  inputText.addEventListener('input', updateCharCount);

  // Preset button click handlers
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const presetKey = btn.dataset.preset;
      if (PRESETS[presetKey]) {
        inputText.value = PRESETS[presetKey];
        updateCharCount();
        processSegmentation();
      }
    });
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    inputText.value = '';
    updateCharCount();
    clearOutput();
    inputText.focus();
  });

  // Mode radio change
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      currentMode = e.target.value;
      if (inputText.value.trim().length > 0) {
        processSegmentation();
      }
    });
  });

  // Process button click
  btnProcess.addEventListener('click', () => {
    processSegmentation();
  });

  // Shortcut: Ctrl+Enter or Cmd+Enter to process
  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      processSegmentation();
    }
  });

  // Slider change for Line Wrap Simulation
  if (simWidthSlider) {
    simWidthSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      simWidthVal.textContent = `${val}px`;
      if (simBox) {
        simBox.style.width = `${val}px`;
      }
    });
  }

  // Clear output view
  function clearOutput() {
    outputDisplay.innerHTML = '<span style="color: #94a3b8; font-style: italic;">กดปุ่ม "ตัดคำ" เพื่อดูผลการตัดคำที่นี่</span>';
    statTime.innerHTML = '⚡ เวลา: <strong>0.00 ms</strong>';
    statWords.innerHTML = '📝 คำ/ส่วน: <strong>0</strong>';
    statChars.innerHTML = '📏 ตัวอักษร: <strong>0</strong>';
    statSpeed.innerHTML = '🚀 ความเร็ว: <strong>-</strong>';
    lastResultTokens = [];
    lastResultTextWithDots = '';
    lastResultTextWithPipe = '';
    lastResultTextWithZwsp = '';
    if (simBox) simBox.innerHTML = '';
  }

  // Core Processing Function
  function processSegmentation() {
    const text = inputText.value;
    if (!text || text.trim().length === 0) {
      clearOutput();
      return;
    }

    const tStart = performance.now();
    let displayHtml = '';
    let tokensForExport = [];
    let textWithDots = '';
    let textWithPipe = '';
    let textWithZwsp = '';
    let unitCount = 0;

    const verStr = ThaiBreak.VERSION ? ` (v${ThaiBreak.VERSION})` : '';

    if (currentMode === 'word') {
      statMode.innerHTML = `โหมด: <strong>ตัดแบบ Word</strong>${verStr}`;

      // Use ThaiBreak.words with keepWhitespace: true to retain newlines and spaces
      const rawTokens = ThaiBreak.words(text, true);
      const n = rawTokens.length;

      let htmlParts = [];
      let dotParts = [];
      let pipeParts = [];
      let zwspParts = [];

      for (let i = 0; i < n; i++) {
        const tok = rawTokens[i];
        const isWhitespace = /^\s+$/.test(tok);

        if (isWhitespace) {
          // Preserve spaces / newlines
          if (tok.includes('\n')) {
            htmlParts.push('<br>'.repeat((tok.match(/\n/g) || []).length));
          } else {
            htmlParts.push(escapeHtml(tok));
          }
          dotParts.push(tok);
          pipeParts.push(tok);
          zwspParts.push(tok);
        } else {
          unitCount++;
          tokensForExport.push(tok);

          htmlParts.push(`<span class="tb-word" title="คำที่ ${unitCount}: ${escapeHtml(tok)}">${escapeHtml(tok)}</span>`);
          dotParts.push(tok);
          pipeParts.push(tok);
          zwspParts.push(tok);

          // Check if we should insert dot between this token and the next
          if (i + 1 < n) {
            const nextTok = rawTokens[i + 1];
            const nextIsWhitespace = /^\s+$/.test(nextTok);

            // Put gray-dot between consecutive non-whitespace tokens
            if (!nextIsWhitespace) {
              htmlParts.push('<span class="tb-dot" title="จุดตัดคำ"></span>');
              dotParts.push('·');
              pipeParts.push('|');
              zwspParts.push('\u200B');
            }
          }
        }
      }

      displayHtml = htmlParts.join('');
      textWithDots = dotParts.join('');
      textWithPipe = pipeParts.join('');
      textWithZwsp = zwspParts.join('');

    } else {
      // Line mode (Typographic line breaking)
      statMode.innerHTML = `โหมด: <strong>ตัดแบบ Line</strong>${verStr}`;

      // Insert dedicated internal marker
      const MARKER = '\uE001';
      const broken = ThaiBreak.lines(text, false, MARKER);
      const chunks = broken.split(MARKER);
      unitCount = chunks.length;
      tokensForExport = chunks;

      let htmlParts = [];
      let dotParts = [];
      let pipeParts = [];
      let zwspParts = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Escape and handle newlines inside chunk
        const escapedChunk = escapeHtml(chunk).replace(/\n/g, '<br>');
        htmlParts.push(`<span class="tb-word" title="ส่วนจัดพิมพ์ที่ ${i + 1}">${escapedChunk}</span>`);
        
        dotParts.push(chunk);
        pipeParts.push(chunk);
        zwspParts.push(chunk);

        if (i + 1 < chunks.length) {
          // Insert gray-dot separator
          htmlParts.push('<span class="tb-dot" title="จุดตัดบรรทัด (Line Break)"></span>');
          dotParts.push('·');
          pipeParts.push('|');
          zwspParts.push('\u200B');
        }
      }

      displayHtml = htmlParts.join('');
      textWithDots = dotParts.join('');
      textWithPipe = pipeParts.join('');
      textWithZwsp = zwspParts.join('');
    }

    const tEnd = performance.now();
    const durationMs = Math.max(0.01, tEnd - tStart);

    // Save for export
    lastResultTokens = tokensForExport;
    lastResultTextWithDots = textWithDots;
    lastResultTextWithPipe = textWithPipe;
    lastResultTextWithZwsp = textWithZwsp;

    // Render HTML in display box
    outputDisplay.innerHTML = displayHtml;

    // Update Stats
    statTime.innerHTML = `⚡ เวลา: <strong>${durationMs < 1 ? durationMs.toFixed(3) : durationMs.toFixed(2)} ms</strong>`;
    statWords.innerHTML = `📝 คำ/ส่วน: <strong>${unitCount.toLocaleString()}</strong>`;
    statChars.innerHTML = `📏 ตัวอักษร: <strong>${text.length.toLocaleString()}</strong>`;

    const throughput = Math.round((text.length / (durationMs / 1000)));
    statSpeed.innerHTML = `🚀 ความเร็ว: <strong>~${(throughput / 1000000).toFixed(2)}M chars/s</strong>`;

    // Update Line Wrap simulation box
    if (simBox) {
      // In simulation box, we use the ZWSP version or words with <wbr>
      simBox.innerText = textWithZwsp;
    }
  }

  // Helper: HTML Escaper
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Helper: Copy to Clipboard
  function copyTextToClipboard(text, message) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(message || 'คัดลอกสำเร็จ!');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(message || 'คัดลอกสำเร็จ!');
    });
  }

  function showToast(msg) {
    if (!copyToast) return;
    copyToast.textContent = `✓ ${msg}`;
    copyToast.classList.add('show');
    setTimeout(() => {
      copyToast.classList.remove('show');
    }, 2000);
  }

  // Copy Handlers
  if (btnCopyDots) {
    btnCopyDots.addEventListener('click', () => {
      copyTextToClipboard(lastResultTextWithDots, 'คัดลอกพร้อมจุด (·) แล้ว');
    });
  }

  if (btnCopyPipe) {
    btnCopyPipe.addEventListener('click', () => {
      copyTextToClipboard(lastResultTextWithPipe, 'คัดลอกแบบ Pipe (|) แล้ว');
    });
  }

  if (btnCopyZwsp) {
    btnCopyZwsp.addEventListener('click', () => {
      copyTextToClipboard(lastResultTextWithZwsp, 'คัดลอกแบบ ZWSP (Zero-Width Space) แล้ว');
    });
  }

  if (btnCopyJson) {
    btnCopyJson.addEventListener('click', () => {
      copyTextToClipboard(JSON.stringify(lastResultTokens, null, 2), 'คัดลอก JSON Array แล้ว');
    });
  }

  // Run on initial load with basic preset
  inputText.value = PRESETS.basic;
  updateCharCount();
  processSegmentation();
});
