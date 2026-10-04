# ThaiBreak Live Demo

หน้าเว็บทดลองตัดคำและตัดแบ่งบรรทัดภาษาไทยด้วย [ThaiBreak](https://github.com/kamthorn/thai-break) ในเบราว์เซอร์ ใช้แกนประมวลผลเดียวกับแพ็กเกจ npm [`thai-break`](https://www.npmjs.com/package/thai-break) พร้อมพจนานุกรมเสริมจาก [thai-break-dict-extra](https://github.com/kamthorn/thai-break-dict-extra) และอัปโหลดพจนานุกรมของคุณเองเพื่อทดสอบก่อนนำไปใช้จริงได้

**เปิดใช้งาน:** https://kamthorn.github.io/thai-break-demo/

ทุกอย่างทำงานในเบราว์เซอร์ ข้อความและพจนานุกรมที่อัปโหลดไม่ถูกส่งออกนอกเครื่อง

## ความสามารถ

- **ตัดคำ (Word segmentation)** ด้วย Viterbi + Thai Character Cluster และ **หาจุดตัดบรรทัด (Line breaking)** ตาม Unicode UAX #14
- **พจนานุกรม 3 ชั้น**
  - พื้นฐาน: `data/words.dawg` ของ thai-break (25,402 คำ, Compact DAWG)
  - เสริม: `words-extra.tsv` (สำหรับตัดคำ) หรือ `words-extra-lines.tsv` (สำหรับตัดบรรทัด ไม่รวมชื่อเฉพาะและคำประสมยาว) จาก thai-break-dict-extra — โหมด "อัตโนมัติ" เลือกให้ตามรูปแบบการตัด
  - ของคุณ: อัปโหลดหรือลากไฟล์ `.txt` (คำละบรรทัด) หรือ `.tsv`/`.csv` (`คำ<TAB>น้ำหนัก`) หรือพิมพ์ในกล่อง กำหนดน้ำหนักเริ่มต้นได้ และเลือกให้จำไว้ในเบราว์เซอร์ได้
- **ระบายสีตามพจนานุกรมที่พบคำ** (พื้นฐาน / dict-extra / ของคุณ / ไม่มีในพจนานุกรม) และ **เทียบกับพจนานุกรมพื้นฐาน** โดยขีดเส้นใต้คำที่ตัดต่างกัน
- **จำลองการขึ้นบรรทัด** ที่ความกว้างต่างๆ เทียบกับการตัดของเบราว์เซอร์เอง
- **ส่งออก** แบบคั่น `|`, `·`, `U+200B` หรือ JSON และ **ตัวอย่างโค้ด** JavaScript/PHP ที่ตั้งค่าแบบเดียวกับหน้าเว็บ (รวมคำของคุณ)

## โครงสร้าง

```text
index.html               หน้าเว็บ
assets/
  app.js, style.css      ส่วนติดต่อผู้ใช้
  thai-break.js          ไลบรารี (สร้างจาก thai-break/typescript/dist)          ┐
  data-base.js           พจนานุกรมพื้นฐาน (DAWG, base64)                         │ สร้างด้วย
  data-extra.js          dict-extra ชุดตัดคำ (โหลดเมื่อใช้)                       │ npm run build
  data-extra-lines.js    dict-extra ชุดตัดบรรทัด (โหลดเมื่อใช้)                   │ ห้ามแก้ด้วยมือ
  build-info.js          เวอร์ชันและ commit ของต้นทาง                            ┘
scripts/build.js         สคริปต์สร้างไฟล์ใน assets/
server.js                เซิร์ฟเวอร์สำหรับทดสอบในเครื่อง (ไม่มี dependency)
test/                    ทดสอบ assets (Node) และทดสอบหน้าเว็บจริงใน Chromium
```

## ใช้งานในเครื่อง

```bash
npm start            # http://localhost:3000
```

หรือเปิดไฟล์ `index.html` ในเบราว์เซอร์โดยตรงก็ได้ ไฟล์ใน `assets/` ถูก commit ไว้แล้วจึงไม่ต้อง build

## อัปเดตไลบรารีและพจนานุกรม

วาง repository ต้นทางไว้ข้างกัน แล้ว build แต่ละโปรเจกต์ก่อน:

```text
code/
├── thai-break/              cd typescript && npm ci && npm run build
├── thai-break-dict-extra/   python3 scripts/build.py
└── thai-break-demo/         npm run build
```

`npm run build` อ่าน `thai-break/typescript/dist`, `thai-break/data/words.dawg` และ `thai-break-dict-extra/dist/*.tsv` แล้วเขียนไฟล์ใน `assets/` พร้อมบันทึก commit ของต้นทางลง `build-info.js` (แสดงที่ท้ายหน้าเว็บ) ใช้ `--thai-break <dir>` / `--dict-extra <dir>` หรือตัวแปร `THAI_BREAK_DIR` / `DICT_EXTRA_DIR` หากวางไว้ที่อื่น

## ทดสอบ

```bash
npm test             # ตรวจไลบรารีและพจนานุกรมใน assets/
npm run test:e2e     # เปิดหน้าเว็บจริงใน Chromium (CHROME_PATH=/usr/bin/chromium) และบันทึกภาพหน้าจอใน test-results/
```

## เผยแพร่ผ่าน GitHub Pages

workflow `.github/workflows/pages.yml` รันการทดสอบทั้งสองชุด แล้ว deploy เฉพาะ `index.html`, `assets/` และ `LICENSE` เมื่อ push เข้า `main`

ตั้งค่าครั้งแรก: **Settings → Pages → Build and deployment → Source: GitHub Actions**

## โครงการที่เกี่ยวข้อง

- [thai-break](https://github.com/kamthorn/thai-break) — แกนตัดคำและตัดบรรทัด (PHP/Laravel, Go, TypeScript, Rust, Python, C, WebAssembly)
- [thai-break-dict-extra](https://github.com/kamthorn/thai-break-dict-extra) — พจนานุกรมเสริมแยกหมวด (CC0-1.0)
- [opensearch-analysis-thaibreak](https://github.com/kamthorn/opensearch-analysis-thaibreak) — ปลั๊กอินวิเคราะห์ภาษาไทยสำหรับ OpenSearch
- [opensearch-thai-best-practices](https://github.com/kamthorn/opensearch-thai-best-practices) — แนวทางตั้งค่าภาษาไทยใน OpenSearch

## สัญญาอนุญาต

โค้ดของเดโมเผยแพร่ภายใต้ [Apache-2.0](LICENSE) ข้อมูลที่รวมอยู่ใน `assets/`:

- พจนานุกรมพื้นฐานและไลบรารีจาก [thai-break](https://github.com/kamthorn/thai-break) — Apache-2.0
- พจนานุกรมเสริมจาก [thai-break-dict-extra](https://github.com/kamthorn/thai-break-dict-extra) — CC0-1.0
