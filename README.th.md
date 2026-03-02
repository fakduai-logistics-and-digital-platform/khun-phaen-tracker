# ขุนแผน (Khun Phaen)

ระบบจัดการงานแบบ - ทำงานได้ทุกที่แม้ไม่มีอินเทอร์เน็ต

> **ขุนแผน** (Khun Phaen) - ตั้งชื่อตามตัวละครในวรรณคดีไทยที่เป็นยอดนักวางแผน สามารถบริหารจัดการภารกิจได้อย่างมีประสิทธิภาพ

## ✨ ฟีเจอร์

- ✅ **จัดการงาน** - เพิ่ม แก้ไข และลบงาน
- 👥 **จัดการทีม** - เพิ่มสมาชิกและมอบหมายงาน
- 📁 **จัดการโปรเจกต์** - แยกกลุ่มงานตามโปรเจกต์
- 📅 **มุมมองปฏิทิน** - ดูตารางงานในรูปแบบปฏิทิน
- 🎯 **คัมบังบอร์ด** - จัดการสถานะงานด้วยระบบ Drag & Drop
- 📊 **สถิติงาน** - ดูรายงานและสถิติต่างๆ
- 📤 **นำเข้า/ส่งออก** - รองรับ CSV และ PDF
- 🌙 **Dark Mode** - รองรับธีมมืด
- 🔄 **Real-time Sync** - ซิงค์ข้อมูลข้ามเครื่อง (เมื่อเปิด Sync Server)

## 🏗️ โครงสร้างโปรเจกต์

```
.
├── src/                    # SvelteKit Frontend
├── backend-server/            # Rust WebSocket Sync Server
├── wasm-compress/          # WASM: LZ4 Compression
├── wasm-crdt/              # WASM: CRDT สำหรับแก้ไขงานพร้อมกัน
├── wasm-search/            # WASM: ระบบค้นหาข้อความ
├── static/                 # Static assets
└── build/                  # ไฟล์สำหรับ Production
```

## 🚀 การเริ่มต้นใช้งาน

### สิ่งที่ต้องมี

- [Node.js](https://nodejs.org/) 18+ 
- [Rust](https://rustup.rs/) (สำหรับ build backend-server หรือ WASM)

### 1. ติดตั้ง Dependencies

```sh
npm install
```

### 2. ตั้งค่า Environment Variables

```sh
cp .env.example .env
```

แก้ไขไฟล์ `.env` แล้วใส่ tldraw license key:

```
VITE_TLDRAW_LICENSE_KEY=your-license-key
```

สำหรับ Backend `.env` ให้เพิ่มการตั้งค่าของ **ระบบที่เก็บไฟล์ (RustFS/S3)** ดังนี้ (ถ้าไม่ใช้ไฟล์แนบ สามารถละเว้นได้):
```
STORAGE_URL="http://127.0.0.1:9000"
RUSTFS_ACCESS_KEY="rustfsadmin"
RUSTFS_SECRET_KEY="rustfsadmin"
STORAGE_BUCKET="khunphaen-assets"
```
**ข้อควรระวัง:** ระบบแบคเอนด์จะพยายามสร้าง Bucket ให้คุณโดยอัตโนมัติเมื่อเริ่มทำงาน แต่ถ้าคุณใช้ IP ของเซิร์ฟเวอร์แยกต่างหาก (เช่นใส่ `STORAGE_URL="http://45.xxx.xxx:9000"`) ระบบอาจจะโดนปฏิเสธการเข้าถึง (AccessDenied) ในกรณีนี้คุณต้องเข้าไปที่หน้า Console ของ RustFS เพื่อสร้าง Bucket ชื่อ `khunphaen-assets` (หรือตามที่คุณตั้งค่าไว้) ล่วงหน้าด้วยตนเองครับ

> **วิธีขอ tldraw License Key:** ไปที่ [tldraw.dev](https://tldraw.dev) สมัครสมาชิก แล้วขอ license key ฟรีสำหรับการใช้งานแบบ non-commercial ฟีเจอร์ Whiteboard ใช้งานได้โดยไม่มี key แต่จะแสดง watermark/คำเตือน

### 3. รัน Development Server

```sh
# รัน frontend
npm run dev

# รันและเปิดเบราว์เซอร์อัตโนมัติ
npm run dev -- --open
```

หน้าเว็บจะอยู่ที่ `http://localhost:5173/khun-phaen-tracker`

### 4. รัน Sync Server (เสริม - สำหรับ Real-time Sync)

ใน terminal ใหม่:

```sh
cd backend-server
cargo run --release
```

Server จะรันอยู่ที่ `http://localhost:3001`

## 🧪 การทดสอบ (Testing)

โปรเจกต์นี้ใช้ `Vitest` ในการรันชุดทดสอบ

```sh
# รันเทสทั้งหมด
npm test

# รันเฉพาะเทสจำลองฐานข้อมูล
npx vitest run src/lib/db.unit.test.ts
```

## 📚 Storybook (เอกสาร UI)

ดูคอมโพเนนต์ต่างๆ ในรูปแบบแยกส่วน

```sh
npm run storybook
```
เปิดที่ `http://localhost:6006`

## 🏭 การ Build สำหรับ Production

```sh
# Build Frontend
npm run build

# Build Sync Server (Binary)
cd backend-server
cargo build --release
```

## 🐳 Docker / Deployment

คุณสามารถเลือกรันโปรเจกต์ผ่าน Docker ได้หลายวิธี ขึ้นอยู่กับฐานข้อมูลที่ต้องการใช้ (Local MongoDB หรือ Mongo Atlas) และรูปแบบที่คุณต้องการใช้งาน (รันทั้งหมด หรือเฉพาะส่วนหลังบ้าน)

### ข้อกำหนดพื้นฐานก่อนใช้งาน Docker

1. ต้องติดตั้ง Docker และ Docker Compose ในเครื่องเรียบร้อยแล้ว
2. ตรวจสอบให้แน่ใจว่าไม่มีบริการอื่นรันค้างอยู่ในพอร์ต `8080`, `3001` และ `27017` (ถ้าใช้ Local MongoDB)
3. หากใช้ MongoDB Atlas, กรุณาตรวจสอบให้แน่ใจว่าได้เพิ่ม IP ของเครื่องที่จะรันไว้ใน Network Access List บน Atlas แล้ว

### วิธีที่ 1: รันทั้งหมด + ฐานข้อมูลแบบ Local (ค่าเริ่มต้น)

วิธีนี้จะทำการรันทั้ง Frontend, Backend และ MongoDB Server แบบจำลองขึ้นมาในเครื่อง

```sh
# สั่งรันแบบ background
docker compose up -d

# ปิดการทำงาน
docker compose down
```

หน้าเว็บจะสามารถเข้าถึงได้ที่: `http://localhost:8080/khun-phaen-tracker/`
ระบบหลังบ้าน (API/WebSocket) จะอยู่ที่: `http://localhost:3001`
ระบบเก็บไฟล์ (RustFS API) จะอยู่ที่พอร์ต: `9000`
ระบบจัดการไฟล์ผ่านหน้าเว็บ (RustFS Console) จะอยู่ที่: `http://localhost:9001` (User/Pass พื้นฐาน: `rustfsadmin` / `rustfsadmin`)

### วิธีที่ 2: รันทั้งหมด + ใช้ Mongo Atlas (ฐานข้อมูลคลาวด์)

วิธีนี้จะรัน Frontend, Backend และระบบ Setup พิเศษที่จะเชื่อมตัวหลังบ้านเข้ากับ MongoDB Atlas เพื่อสร้างบัญชีแอดมินคนแรกให้อัตโนมัติ

**ขั้นตอนที่ 1:** สร้างหรือแก้ไขไฟล์ `.env` ที่ root folder และเพิ่มการตั้งค่าสำหรับ Atlas/Setup Token ดังนี้:
```env
MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/tracker-db?retryWrites=true&w=majority
INITIAL_SETUP_TOKEN=your-very-secret-token
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=password123
INITIAL_ADMIN_NICKNAME=SuperAdmin
```

**ขั้นตอนที่ 2:** รันโปรเจกต์โดยระบุไฟล์สำหรับระบบ Atlas:
```sh
docker compose -f docker-compose.atlas.yml up -d
```

### วิธีที่ 3: รันแค่ Backend Server (ใช้ควบคู่ Mongo Atlas)

เหมาะสำหรับการที่คุณฝาก Frontend ไว้บนโฮสต์อื่นๆ (เช่น Vercel, Github Pages ฯลฯ) แล้วต้องการรันหน้า API กับ WebSocket แยกลงบนเซิร์ฟเวอร์ด้วย Docker อย่างเดียว

**ขั้นตอนที่ 1:** ย้ายเข้าไปในโฟลเดอร์รัน Backend โดยเฉพาะ:
```sh
cd backend-server
```

**ขั้นตอนที่ 2:** สร้างไฟล์ `.env` ไว้ในโฟลเดอร์ `backend-server`:
```env
MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/tracker-db?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
INITIAL_SETUP_TOKEN=your-very-secret-token
```

**ขั้นตอนที่ 3:** เริ่มการทำงานของบริการหลังบ้านและชุดเชื่อมต่อ Atlas:
```sh
docker compose -f docker-compose.atlas.yml up -d
```
จากนั้นตัว API และ WebSocket จะรันพร้อมรับการเชื่อมต่ออยู่ที่ `http://localhost:3001`

## 📄 License

โปรเจกต์นี้ใช้สัญญาอนุญาต [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - สามารถใช้งาน แก้ไข และแชร์ได้อย่างอิสระ แต่ห้ามนำไปใช้เชิงพาณิชย์

---