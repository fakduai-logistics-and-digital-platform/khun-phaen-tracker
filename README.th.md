# ขุนแผน (Khun Phaen)

ระบบจัดการงานสำหรับทีม: งาน สปรินต์ โปรเจกต์ ปฏิทิน คัมบัง Gantt เคสทดสอบ และการอัปเดตแบบเรียลไทม์

> **ขุนแผน** (Khun Phaen) - ตั้งชื่อตามตัวละครในวรรณคดีไทยที่เป็นยอดนักวางแผน สามารถบริหารจัดการภารกิจได้อย่างมีประสิทธิภาพ

## ✨ ฟีเจอร์

- ✅ **จัดการงาน** - เพิ่ม แก้ไข ลบ เช็กลิสต์ ความคิดเห็น ไฟล์แนบ
- 👥 **ทีมและโปรเจกต์** - สมาชิก กลุ่ม โปรเจกต์ สปรินต์ เป้าหมาย
- 📅 **มุมมองงาน** - รายการ ปฏิทิน คัมบัง ตาราง Gantt และภาระงาน
- 🧪 **เคสทดสอบ** - Suite, Test run, หน้า public แบบอ่านอย่างเดียว, นำเข้า/ส่งออก CSV
- 📤 **นำเข้า/ส่งออก** - CSV, PDF, PNG, สไลด์
- 🔄 **เรียลไทม์** - WebSocket ผ่าน Durable Objects
- 🌙 **Dark mode และชุดสี** รองรับภาษาไทยและอังกฤษ

## 🏗️ โครงสร้างโปรเจกต์

```
.
├── web/             # Frontend: Next.js (vinext) + shadcn/ui, export เป็น static ขึ้น GitHub Pages
├── backend-worker/  # API: Rust Cloudflare Worker (D1 + Durable Objects), ไฟล์แนบผ่าน RustFS/S3
├── scripts/         # ตั้งค่า worker, smoke test, นำเข้า MongoDB → D1
└── tests/           # เทสต์ของ scripts/ (Vitest)
```

- รายละเอียด frontend: [web/README.md](web/README.md)
- การตั้งค่าและตรวจสอบ backend: [backend-worker/README.md](backend-worker/README.md)
- API ที่ deploy แล้ว: `https://api.khun-phaen.workers.dev` (`/api`, เรียลไทม์ที่ `/ws`, ตรวจสถานะที่ `/health`)

## 🛠️ รันในเครื่อง

```sh
# Frontend (http://localhost:3100)
cd web
npm install
npm run dev

# Backend worker (ที่รากของ repo)
npm install
npm run worker:setup
npm run worker:dev
```

API ที่ deploy แล้วอนุญาต CORS เฉพาะ origin ของ GitHub Pages ดังนั้น `npm run dev` จึงเรียก API ผ่าน proxy ที่ตั้งไว้ใน `web/next.config.ts`

## ✅ การตรวจสอบ

```sh
cd web && npm run typecheck && npm run lint   # ต้องไม่มี warning
npm test                                      # ที่ราก: scripts/
npm run worker:check && npm run worker:test   # backend-worker
```

## 🚀 การ Deploy

เมื่อ push เข้า `main` workflow `.github/workflows/deploy.yml` จะ build `web/` เป็นไฟล์ static (`npm run build:pages`) แล้วเผยแพร่ขึ้น GitHub Pages ในการตั้งค่า repo ให้เลือก **Pages → Source** เป็น *GitHub Actions* และตั้ง repository variables ได้ตามต้องการ: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_WS_URL`

## 📄 License

โปรเจกต์นี้อยู่ภายใต้ [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - ใช้ แก้ไข และแจกจ่ายได้เฉพาะวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์
