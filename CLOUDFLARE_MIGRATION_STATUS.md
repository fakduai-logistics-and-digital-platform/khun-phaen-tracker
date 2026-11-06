# สถานะย้าย Backend ไป Cloudflare Workers

อัปเดต: 6 พฤศจิกายน 2026

เอกสารนี้สรุปงานในข้อ 1–3 ที่ได้รับมอบหมาย โดยแยกสิ่งที่เขียนแล้วออกจากสิ่งที่ยืนยันผ่านการทดสอบได้ ข้อ 4 (นำข้อมูลจริงจาก MongoDB เข้า D1 และแปลง ObjectId เป็น UUID) ยังไม่เริ่ม และไม่มีการเชื่อมต่อหรือเปลี่ยนข้อมูล MongoDB

## เสร็จแล้วในระดับ implementation

- เพิ่ม backend Rust Workers พร้อม D1 migrations 0001–0004, bindings สำหรับ Durable Objects, local setup และคำสั่งตรวจสอบใน `package.json`
- เพิ่ม authentication, session ที่เพิกถอนได้, invite/setup, profile/admin users และตรวจสิทธิ์ workspace ฝั่ง backend
- เพิ่ม API สำหรับ workspaces, tasks และ metadata (projects, assignees, groups, sprints, milestones, checklist templates), My Tasks, filters, search, pagination และสถิติ
- เพิ่ม QA suites/cases/runs, public QA/report endpoints, comments, รูปใน comment, reactions และ attachments ผ่าน S3-compatible SigV4
- เพิ่ม AI settings/requests, storage admin, notification preferences/schedules, webhook retry jobs และ cleanup งานไฟล์ค้าง
- ย้าย notification delivery ให้ backend กำหนดผู้รับและส่ง event ผ่าน Durable Object รายผู้ใช้; frontend เลิกสร้างผู้รับหรือส่งผ่าน SSE
- ปรับ frontend ให้ backend เป็นแหล่งข้อมูลหลัก, IndexedDB เป็น read cache และถอด sync queue/CRDT/WebRTC ออกจาก runtime
- เพิ่ม local smoke/parity harness ใช้ D1/DO จำลองและ fake S3/AI/webhook ในเครื่อง โดยไม่เรียก RustFS จริง
- เพิ่ม frontend channel ที่ต่อใหม่และ refetch หลังกลับมา online; เพิ่มการดึง task หลายหน้าเมื่อผู้เรียกต้องการ array เต็ม

## ยังต้องทำหรือยืนยัน

### ต้องแก้ก่อนถือว่าข้อ 1–3 ผ่าน

- [x] ทำให้ `npm run worker:smoke` รันจบครบชุด: สาเหตุที่ Worker ไม่ขึ้นคือ `http::failure` ใน `src/http.rs` อ้าง `http::` ของตัวเองจน compile ไม่ผ่าน แก้แล้ว smoke และ parity ผ่านครบ 8 กลุ่ม
- [x] แก้กรณี upload ล้มเหลวได้ status ผิด: `s3_client` เคยสร้าง response 503 ขึ้นเองเมื่อไม่มี config แล้ว `uploads.rs`/`storage_admin.rs` ถือว่า 503 ทุกตัว (รวม 503 จาก RustFS จริง) คือ "Storage is not configured" ตอนนี้ไม่มี config คืน error ชนิดเฉพาะ (503) ส่วน RustFS ตอบ error คืน 502 และ compensation ผ่าน
- [x] ตรวจว่า route เดิมทุกตัวของ Axum (`backend-server/src/main.rs`) ถูก Worker รับ: เพิ่ม `backend-worker/tests/contract.mjs` ยิง 78 route+method ด้วย ID จริงใน `worker:smoke` ผ่านทั้งหมด status 400/405 ที่เหลือตรงกับ validation ของเดิม
- [ ] เทียบ response shape ทีละ route กับทุกจุดที่ frontend อ่าน (ตอนนี้ยืนยันเฉพาะ field ที่ parity test ตรวจ)
- [x] เทียบ permission ทีละ handler กับของเดิม พบและแก้ 2 จุดที่ Worker เข้มกว่าเดิมจนผู้ใช้ปกติใช้งานไม่ได้ (มี regression test ใน parity):
  - developer บันทึก dev note ของ test case ไม่ได้ (403) เมื่อ test note เดิมว่าง เพราะ frontend ส่ง `test_note: ""` มาด้วยเสมอ ตอนนี้ทำตามของเดิม: ไม่ใช่ QA ก็ยังบันทึก `dev_note` ได้ ส่วน `test_note` ถูกข้าม
  - สมาชิกที่ไม่ใช่ owner แก้ชื่อ/สีของ worker ที่ผูก user ไว้ไม่ได้ (403) เพราะฟอร์มส่ง `user_id` เดิมมาด้วย ตอนนี้บล็อกเฉพาะเมื่อ `user_id` เปลี่ยนจริง
- [x] จุดที่ Worker ตั้งใจเข้มกว่าของเดิม (ของเดิมเป็นช่องโหว่): milestones ของเดิมไม่ตรวจ auth, test runs ไม่ตรวจ workspace, `fixed`/`convert-to-task`/test case list ไม่ตรวจ workspace, สมาชิกทั่วไปผูก user เข้า workspace ได้, ลบ user ที่เป็น owner แล้ว workspace ค้าง
- [x] cascade: ลบ workspace ลบข้อมูลย่อยผ่าน foreign key; ลบ project/sprint/assignee/test case ล้าง reference ในงาน (parity)
- [ ] ตัดสินใจ: ของเดิมและ Worker ให้สมาชิกทุกคนแก้/ลบ comment ของคนอื่นได้ (ไม่ตรวจผู้เขียน) ยังคงไว้ตามของเดิม ถ้าต้องการจำกัดเฉพาะผู้เขียน/owner ต้องสั่งเพิ่ม
- [x] filters, archive, task numbering, concurrent edits, notification dedupe และ reconnect ผ่านใน parity; การเปลี่ยนบัญชีผู้ใช้ฝั่ง frontend มี test ใน `notifications.test.ts` และ `realtime.test.ts` (bulk action ของ frontend เรียก update ทีละงาน ไม่มี bulk endpoint ในของเดิม)
- [x] เพิ่ม test helper ดึง task หลายหน้า (`src/lib/task-pagination.test.ts`, 5 tests) และ lifecycle ของ notification (`src/lib/stores/notifications.test.ts`, 7 tests) test เจอ bug: `destroyNotifications()` ไม่ reset `activeUserKey` ทำให้ init ใหม่ด้วย user เดิมไม่ต่อ channel อีก แก้แล้ว
- [x] ลบโค้ดคำนวณผู้รับ notification ฝั่ง client ที่ไม่มีใครเรียกแล้ว (`shouldCreateNotification`, `resolveRecipientUserIds`, `getAssignmentIds`, `setCurrentUserAssigneeIds`, `getUserDisplayName`, `api.userNotifications.create`)
- [x] รัน `worker:check`, `worker:test`, `worker:smoke`, `check`, `build` ผ่าน (ดูผลด้านล่าง)
- [x] เขียน `src/lib/db.unit.test.ts` ใหม่ให้ทดสอบ `db.ts` ที่เรียก API (13 tests) และลบ `tests/today-filter.test.ts` ที่จำลอง SQLite (ย้ายกรณี `status=today` ไปไว้ใน parity บน D1 จริง)
- [ ] `TableView.test.ts`/`TaskForm.test.ts` (3 tests) fail จากเรื่องภาษาของ UI ไม่เกี่ยวกับ backend ยังไม่แก้ตามที่ตกลง
- [x] อัปเดต `backend-worker/README.md` ให้ตรงกับผลทดสอบจริง

### ต้องทำก่อน production แต่ไม่ใช่ข้อ 4

- [x] ทดสอบ RustFS จริงที่ `https://rust-fs.wk18k.qzz.io` (bucket `khunphaen-assets`) ผ่าน Worker ในเครื่อง: TLS ถูกต้อง, HTTP redirect ไป HTTPS, upload หลายไฟล์และดาวน์โหลดกลับได้ตรงทุก byte, คนนอก workspace ได้ 403, ไม่ login ได้ 401, ลบแล้วไฟล์หายจาก bucket จริง, upload ที่ไฟล์ที่สองใหญ่เกินได้ 413 และไฟล์แรกถูกลบคืน, ลบไฟล์ทดสอบหมดแล้ว (เหลือ 0)
- [ ] ไฟล์ของระบบเดิมไม่อยู่บน RustFS นี้: ระบบเดิมมีรูปใน comment 2 ไฟล์ (1 ไฟล์เป็นของ comment ที่ task ถูกลบแล้ว) ไม่พบทั้งใน `khunphaen-assets` และ `free-upload` ต้องคัดลอกจาก storage เดิมด้วย key เดิม หรือยอมรับว่ารูป 1 รูปจะเปิดไม่ได้
- [x] สร้าง D1 `khun-phaen` (APAC, id `0c1d7cc0-38fa-4370-8973-97e4f0b71cc4`) บนบัญชี `khun-phane` และ apply migrations 0001–0004 แบบ remote
- [x] Deploy Worker ที่ `https://api.khun-phaen.workers.dev` (subdomain `khun-phaen`, Worker ชื่อ `api`): startup 5 ms, ขนาด 517 KB gzip
- [x] ตั้ง secrets 4 ตัว (`CONFIG_ENCRYPTION_KEY` และ `INITIAL_SETUP_TOKEN` สร้างใหม่สำหรับ production, RustFS keys) โดยไม่ผ่านแชท
- [x] `wrangler.jsonc` เป็นค่า production (`ALLOWED_ORIGIN` = GitHub Pages, `STORAGE_URL` = RustFS HTTPS, `COOKIE_SECURE=true`) ค่าสำหรับเครื่องย้ายไป `.dev.vars`
- [x] ทดสอบ Worker จริง: health, CORS เฉพาะ origin ของ GitHub Pages, origin อื่นได้ 403, ไม่ login ได้ 401, SSE เดิมได้ 410, WebSocket ไม่มี ticket ถูกปฏิเสธ
- [x] Import export วันที่ 6 พ.ย. เข้า D1 จริง: 1,718 คำสั่ง, เขียน 11,740 แถว (ประมาณ 12% ของโควตาต่อวัน) integrity เป็น 0 ทุกข้อ จำนวนตรงกับในเครื่อง
- [x] อ่านข้อมูลจริงผ่าน Worker จริงด้วย session ชั่วคราว (ลบแล้ว): 9 endpoint ได้ 200 ใช้เวลา 80–240 ms, realtime ticket และ WebSocket ผ่าน Durable Object ทำงาน
- [ ] วัด CPU ต่อ request จาก analytics (ครั้งแรกโดน rate limit ของ GraphQL API) และดูการใช้งานจริงหลังสลับ
- [ ] ก่อนสลับ: export MongoDB ใหม่ ล้าง D1 แล้ว import ใหม่ (id คงเดิม) เพื่อให้ได้ข้อมูลล่าสุด
- [ ] สลับ frontend: ตั้ง GitHub secrets `VITE_API_URL=https://api.khun-phaen.workers.dev/api` และ `VITE_WS_URL=wss://api.khun-phaen.workers.dev/ws` แล้ว deploy GitHub Pages ใหม่
- [ ] หลังสลับ: ตั้งค่า AI ใหม่ในหน้า Settings, ปิด backend Axum เดิม, ลบ `db_mongo/` กับ `.migration/`
- [ ] ตัดสินใจเรื่อง LINE Notify: บริการเดิมยุติแล้ว; backend ปฏิเสธ token เดิมและรองรับ Discord webhook

## ข้อ 4 — ย้ายข้อมูล MongoDB → D1 (ทดสอบในเครื่องแล้ว)

- [x] ตรวจโครงสร้างทั้ง 17 collection ผ่าน dbx MCP โดยดูเฉพาะชื่อ field, ชนิด, จำนวน และรูปแบบ ID ไม่ได้ดึงค่าจริง
- [x] `scripts/mongo-to-d1.mjs` (`npm run worker:import-mongo`) แปลง export (EJSON หรือ CSV จาก DBX) เป็น `import.sql` + `report.json`: ObjectId → UUIDv5 แบบคงที่ คง bcrypt hash และ `file_key` ของ RustFS เดิม
- [x] ใช้ export จริงใน `backend-worker/db_mongo/` (gitignore แล้ว): import เข้า D1 ในเครื่องที่ `backend-worker/.migration/d1` ได้ 1,718 คำสั่ง ตรวจ integrity ได้ 0 ทุกข้อ (foreign key, assignee/user/suite/sprint/comment reference, counter, ผู้ใช้ที่ login ไม่ได้)
- [x] รัน Worker บนข้อมูลที่ import แล้ว: อ่าน workspace/task/filter/test case/suite/comment ได้ แก้ task และ notes ของ test case ได้ เลข task ใหม่ต่อจากเลขเดิมถูกต้อง
- [x] test: `tests/mongo-to-d1.test.ts` (9 tests ด้วยข้อมูลสมมติ)
- ข้อมูลที่ข้ามหรือแก้ (นับใน `report.json`): ข้าม 2 workspace ที่ owner ไม่มีแล้ว (ว่างเปล่า), ข้าม 4 comment ของ task ที่ถูกลบ (มีรูปค้างบน RustFS 1 ไฟล์ ไม่ได้ลบ), ข้าม 186 notification ของ user ที่ถูกลบ, ตัด assignee ที่ไม่มีแล้วออกจาก task 182 จุด, ยกเลิกการผูก user 14 assignee, test case 15 รายการกลายเป็น `unassigned`, test run 16 ตัวไม่มีผู้สร้าง/assignee เริ่มต้น
- [ ] ตั้งค่า AI ใหม่ในหน้า Settings หลัง import (ไม่ย้ายเพราะ Worker เข้ารหัสค่าตั้งด้วย `CONFIG_ENCRYPTION_KEY`)
- [ ] ข้อ 6: export ใหม่ใกล้วันสลับระบบ แล้วรันสคริปต์เดิมและ import เข้า D1 จริง (`--remote`) ลบ `db_mongo/` กับ `.migration/` เมื่อยืนยันเสร็จ

## ผลตรวจล่าสุดที่ยืนยันได้

- `npm run worker:check`: ผ่าน ไม่มี warning
- `npm run worker:test`: 6 tests ผ่าน
- `npm run worker:smoke`: smoke + parity ผ่านครบ 8 กลุ่ม และ contract 78 routes ผ่าน (auth, profile/admin, metadata/filters/paging/archive/numbering/concurrency, notifications, QA, multipart/SigV4/compensation รวม 502, AI, scheduled jobs/cascades)
- `npm run check`: 0 errors, 0 warnings; `npm run build`: ผ่าน
- unit tests ทั้งหมด: ผ่าน 91 fail 24 ที่ fail อยู่ใน `db.unit.test.ts`, `today-filter.test.ts` (ยังเขียนตาม local DB เดิม) และ `TableView.test.ts`, `TaskForm.test.ts` (ไม่ได้แก้ไฟล์เหล่านี้ในรอบนี้) ไม่เกี่ยวกับการแก้ในรอบนี้
- ไม่ได้ยิง request เข้าระบบ RustFS จริงและไม่ได้ deploy Cloudflare

## เริ่มทดสอบในเครื่อง

ดูคำสั่ง setup และค่าที่ต้องตั้งใน [backend-worker/README.md](backend-worker/README.md) จากนั้นรัน `npm run worker:setup`, `npm run worker:migrate:local`, `npm run worker:dev` ส่วน integration harness ใช้ `npm run worker:smoke` และสร้างข้อมูลชั่วคราวในเครื่อง
