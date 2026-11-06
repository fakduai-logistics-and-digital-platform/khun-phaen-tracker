# ขุนแผน (Khun Phaen)

ระบบจัดการงานสำหรับทีม: งาน สปรินต์ โปรเจกต์ ปฏิทิน คัมบัง Gantt เคสทดสอบ และการอัปเดตแบบเรียลไทม์

> **ขุนแผน** (Khun Phaen) - ตั้งชื่อตามตัวละครในวรรณคดีไทยที่เป็นยอดนักวางแผน สามารถบริหารจัดการภารกิจได้อย่างมีประสิทธิภาพ

- แอป: <https://fakduai-logistics-and-digital-platform.github.io/khun-phaen-tracker/>
- API: `https://api.khun-phaen.workers.dev` (`/api`, เรียลไทม์ที่ `/ws`, health ที่ `/health`)

## ฟีเจอร์

- **จัดการงาน** - เพิ่ม แก้ไข ลบ เช็กลิสต์ ความคิดเห็น ไฟล์แนบ
- **ทีมและโปรเจกต์** - สมาชิก กลุ่ม โปรเจกต์ สปรินต์ เป้าหมาย
- **มุมมองงาน** - รายการ ปฏิทิน คัมบัง ตาราง Gantt และภาระงาน
- **เคสทดสอบ** - Suite, Test run, หน้า public แบบอ่านอย่างเดียว, นำเข้า/ส่งออก CSV
- **นำเข้า/ส่งออก** - CSV, PDF, PNG, สไลด์
- **เรียลไทม์** - WebSocket ผ่าน Durable Objects
- **Dark mode และชุดสี** รองรับภาษาไทยและอังกฤษ
- **นำทางเร็ว** - เปลี่ยนหน้าทันทีและแสดง skeleton ระหว่างโหลดข้อมูล ข้อมูลที่เพิ่งอ่านจะถูกใช้ซ้ำเมื่อกดย้อนกลับ

## สถาปัตยกรรม

| ส่วน | เทคโนโลยี | โฟลเดอร์ |
| --- | --- | --- |
| Frontend | Next.js App Router บน vinext, React 19, TypeScript, shadcn/ui, Tailwind CSS 4, export เป็น static ขึ้น GitHub Pages | [web/](web/README.md) |
| API | Rust Cloudflare Worker ใช้ D1 และ Durable Objects | [backend-worker/](backend-worker/README.md) |
| ไฟล์แนบ | RustFS (S3-compatible) | ตั้งค่าใน `backend-worker/wrangler.jsonc` |
| เครื่องมือ | ตั้งค่า worker, smoke test, นำเข้า MongoDB → D1 | `scripts/`, `tests/` |

แอปเป็น static export จึงส่ง id ผ่าน query string (`?ws=<workspace>&id=<task>`) การเข้าสู่ระบบใช้ bearer session token และเปิด Cloudflare Turnstile ที่ฟอร์ม login ได้ตามต้องการ

## รันในเครื่อง

```sh
# Frontend (http://localhost:3100)
cd web
npm install
npm run dev

# Backend worker (จาก root ของ repo)
npm install
npm run worker:setup
npm run worker:dev
```

API ที่ deploy แล้วอนุญาต CORS เฉพาะ origin ของ GitHub Pages ดังนั้น `npm run dev` จึงเรียกผ่าน proxy ใน `web/next.config.ts`

## การตรวจสอบ

```sh
cd web && npm run typecheck && npm run lint   # ต้องสะอาด
npm test                                      # root: scripts/
npm run worker:check && npm run worker:test   # backend-worker
npm run worker:smoke                          # smoke test API ครบวงจร
```

## การตั้งค่า

| ชื่อ | อยู่ที่ | ใช้ทำอะไร |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_WS_URL` | repository variables (ตอน build Pages) | ชี้ frontend ไป API อื่น ค่าเริ่มต้นคือ `api.khun-phaen.workers.dev` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | repository variable (ตอน build Pages) | แสดง widget Turnstile ในฟอร์ม login |
| `TURNSTILE_SECRET_KEY` | Worker secret (`wrangler secret put`) | ตรวจ token Turnstile ตอน login ถ้าไม่ตั้งจะไม่ตรวจ |
| `CLOUDFLARE_API_TOKEN` | repository secret | ใช้โดย `deploy-backend.yml` |

คีย์ทดสอบของ Turnstile และ secret อื่นของ Worker ดูที่ [backend-worker/README.md](backend-worker/README.md)

## การ Deploy

- **Frontend:** push เข้า `main` ที่มีการแก้ใน `web/` จะรัน `.github/workflows/deploy.yml` ซึ่ง build เป็น static export (`npm run build:pages`) แล้วเผยแพร่ขึ้น GitHub Pages ในหน้า Settings ของ repo ให้ตั้ง **Pages → Source** เป็น *GitHub Actions*
- **Backend:** `.github/workflows/deploy-backend.yml` deploy Worker (environment `production`)

## License

โปรเจกต์นี้ใช้สัญญาอนุญาต [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - ใช้ แก้ไข และแชร์ได้เฉพาะวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์
