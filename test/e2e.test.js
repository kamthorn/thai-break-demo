// End-to-end test of the page in Chromium. Uses the browser at CHROME_PATH
// (default /usr/bin/chromium, or /usr/bin/google-chrome on GitHub runners).
// Screenshots go to test-results/.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test-results');
const executablePath = process.env.CHROME_PATH
  || ['/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));

let server;
let browser;
let baseUrl;

before(async () => {
  fs.mkdirSync(shots, { recursive: true });
  server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: '0' } });
  baseUrl = await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => {
      const m = String(d).match(/http:\/\/localhost:(\d+)/);
      if (m) resolve(`http://127.0.0.1:${m[1]}/`);
    });
    server.on('exit', (code) => reject(new Error(`server exited with ${code}`)));
  });
  browser = await chromium.launch({ executablePath });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

async function openPage(options = {}) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Keep the test offline: web fonts are optional, serve an empty stylesheet instead
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(baseUrl);
  await page.waitForSelector('#output .tok');
  return { page, errors };
}

const tokens = (page, selector = '#output .tok') => page.$$eval(selector, (els) => els.map((e) => e.textContent));
const setText = async (page, text) => {
  await page.fill('#input-text', text);
  await page.click('#btn-run');
  await page.waitForTimeout(100);
};

test('loads, segments the default text and shows the build info', async () => {
  const { page, errors } = await openPage({ viewport: { width: 1280, height: 900 } });
  assert.deepEqual((await tokens(page)).slice(0, 3), ['สวัสดี', 'ครับ', 'ยินดี']);
  assert.match(await page.textContent('#fact-base'), /25,907/);
  assert.match(await page.textContent('#build-info'), /thai-break@\w+/);
  await page.click('[data-preset="extra"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'desktop.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
});

test('dict-extra words are colored and compared with the base dictionary', async () => {
  const { page, errors } = await openPage();
  await setText(page, 'ผู้เสียชีวิตถูกนำส่งโรงพยาบาลศิริราช');
  await page.waitForSelector('#output .tok.src-extra');
  assert.deepEqual(await tokens(page, '#output .tok.src-extra'), ['ผู้เสียชีวิต']); // ศิริราช is also in the base dictionary
  assert.equal(await page.isVisible('#compare'), true);
  assert.ok((await page.$$('#output .tok.changed')).length > 0);

  await page.selectOption('#extra-select', 'none');
  await page.waitForTimeout(150);
  assert.equal((await page.$$('#output .tok.src-extra')).length, 0);
  assert.equal(await page.isVisible('#compare'), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('an uploaded user dictionary changes the segmentation', async () => {
  const { page, errors } = await openPage();
  await page.selectOption('#extra-select', 'none');
  await setText(page, 'ไอแพดโปรรุ่นใหม่ขายดี');
  assert.equal((await tokens(page)).includes('ไอแพดโปร'), false);

  await page.setInputFiles('#user-file', {
    name: 'my-words.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('# my words\nไอแพดโปร\t6\nคำ ที่ผิด\n', 'utf8'),
  });
  await page.waitForFunction(() => document.querySelector('#user-status').textContent.includes('1'));
  await page.waitForTimeout(150);
  assert.match(await page.textContent('#user-status'), /ใช้งาน 1 คำ.*ข้าม 1 บรรทัด/);
  assert.deepEqual(await tokens(page, '#output .tok.src-user'), ['ไอแพดโปร']);

  // The code sample includes the user word
  await page.click('#tab-code');
  assert.match(await page.textContent('#code-sample'), /trie\.add\('ไอแพดโปร', 6\)/);

  // Remembered across reloads only when requested
  await page.check('#user-remember');
  await page.reload();
  await page.waitForSelector('#output .tok');
  assert.match(await page.inputValue('#user-words'), /ไอแพดโปร/);
  await page.click('#user-clear');
  assert.equal(await page.inputValue('#user-words'), '');
  assert.deepEqual(errors, []);
  await page.close();
});

test('line mode, wrap preview and export', async () => {
  const { page, errors } = await openPage({ viewport: { width: 1280, height: 900 } });
  await page.click('label[for="mode-line"]');
  await setText(page, 'ราคา100บาท ISO/IEC 29110');
  assert.deepEqual(await tokens(page), ['ราคา100บาท', 'ISO/', 'IEC', '29110']);

  await page.click('#tab-export');
  assert.equal(await page.textContent('#export-preview'), 'ราคา100บาท ISO/|IEC 29110');

  await page.click('#tab-wrap');
  assert.equal(await page.$$eval('#wrap-thaibreak .seg', (els) => els.length), 4);
  await page.click('[data-preset="long"]');
  await page.fill('#wrap-width', '240');
  await page.dispatchEvent('#wrap-width', 'input');
  await page.screenshot({ path: path.join(shots, 'wrap.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
});

test('mobile layout in dark mode', async () => {
  const { page, errors } = await openPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows horizontally by ${overflow}px`);
  await page.screenshot({ path: path.join(shots, 'mobile-dark.png'), fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
});
