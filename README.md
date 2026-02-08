# Khu Phaen (ขุนแผน)

Offline Task Management System - ระบบจัดการงานแบบ Offline ที่ไม่ต้องพึ่ง internet ก็ใช้ได้

> **Khu Phaen** (ขุนแผน) - ตั้งชื่อตามวรรณคดีไทย หมายถึงผู้วางแผนเชี่ยวชาญ สามารถบริหารจัดการงานต่างๆ ได้อย่างมีประสิทธิภาพ

## ✨ Features

- ✅ **Task Management** - เพิ่ม แก้ไข ลบงาน
- 👥 **Team Management** - จัดการสมาชิกทีมและมอบหมายงาน
- 📁 **Project Management** - จัดกลุ่มงานตามโปรเจค
- 📅 **Calendar View** - ดูงานในรูปแบบปฏิทิน
- 🎯 **Kanban Board** - จัดการงานแบบลาก-วาง (Drag & Drop)
- 📊 **Task Statistics** - สถิติและรายงาน
- 📤 **Export/Import** - ส่งออก/นำเข้า CSV และ PDF
- 💾 **Local Storage** - เก็บข้อมูลใน browser (IndexedDB)
- 🌙 **Dark Mode** - โหมดกลางคืน
- 🔄 **Real-time Sync** - ซิงค์ข้อมูล real-time ผ่าน WebSocket (ต้องรัน Sync Server)

## 🏗️ Project Structure

```
.
├── src/                    # SvelteKit Frontend
├── sync-server/            # Rust WebSocket Sync Server
├── wasm-compress/          # WASM: LZ4 Compression
├── wasm-crdt/              # WASM: CRDT for collaborative editing
├── wasm-search/            # WASM: Full-text search
├── static/                 # Static assets
└── build/                  # Build output (static files)
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- [Rust](https://rustup.rs/) (ถ้าต้องการ build sync-server หรือ WASM)

### 1. Install Dependencies

```sh
npm install
```

### 2. Run Development Server

```sh
# Run frontend dev server
npm run dev

# หรือเปิด browser อัตโนมัติ
npm run dev -- --open
```

Frontend จะรันที่ `http://localhost:5173`

### 3. Run Sync Server (Optional - สำหรับ Real-time Sync)

ใน terminal อีกอัน:

```sh
cd sync-server
cargo run --release
```

Sync Server จะรันที่ `http://localhost:3001`

### 4. Build WASM Modules (Optional)

ถ้าต้องการ build WASM เอง:

```sh
# Build wasm-compress
cd wasm-compress
cargo build --release --target wasm32-unknown-unknown

# Build wasm-crdt
cd ../wasm-crdt
cargo build --release --target wasm32-unknown-unknown

# Build wasm-search
cd ../wasm-search
cargo build --release --target wasm32-unknown-unknown
```

## 🏭 Build for Production

### Build Frontend

```sh
npm run build
```

ไฟล์ static จะอยู่ในโฟลเดอร์ `build/`

### Build Sync Server Binary

```sh
cd sync-server
cargo build --release
# Binary จะอยู่ที่ target/release/sync-server
```

## 🐳 Docker Deployment (Sync Server Only)

> **Frontend** ใช้ Static Files จาก `npm run build` แล้วนำไป host บน nginx/apache ได้เลย
> 
> **Sync Server** รันผ่าน Docker ตามด้านล่าง

### Option 1: Docker Compose (แนะนำ)

```yaml
version: '3.8'

services:
  sync-server:
    build:
      context: ./sync-server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - RUST_LOG=info
    restart: unless-stopped
```

รันด้วย:

```sh
docker-compose up -d
```

Sync Server จะรันที่ `ws://YOUR_PUBLIC_IP:3001`

### Option 2: Docker Build เอง

```sh
cd sync-server

# Build image
docker build -t khu-phaen-sync .

# Run
docker run -p 3001:3001 -e PORT=3001 khu-phaen-sync
```

## 🌐 Public IP / Server Deployment

### 1. Build Frontend

```sh
npm run build
```

นำโฟลเดอร์ `build/` ไปวางบน Web Server (nginx, Apache, etc.)

### 2. รัน Sync Server บน Server

```sh
cd sync-server
docker build -t khu-phaen-sync .
docker run -d -p 3001:3001 --name sync-server khu-phaen-sync
```

หรือใช้ docker-compose:

```sh
docker-compose up -d
```

### 3. แก้ไข Sync Server URL ใน Frontend

แก้ไขไฟล์ที่ใช้เชื่อมต่อ WebSocket (มักอยู่ใน `src/lib/stores/server-sync.ts`):

```typescript
// แก้จาก localhost เป็น Public IP หรือ Domain ของคุณ
const WS_URL = 'ws://YOUR_SERVER_IP:3001';  // HTTP
// หรือ
const WS_URL = 'wss://your-domain.com';      // HTTPS (ผ่าน reverse proxy)
```

แล้ว build ใหม่

## ⚙️ Configuration

### Environment Variables

#### Frontend (Build Time)

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_SYNC_SERVER_URL` | `ws://localhost:3001` | URL ของ Sync Server |

#### Sync Server (Runtime)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port ที่ server จะรัน |
| `RUST_LOG` | `info` | Log level (error, warn, info, debug, trace) |

## 📡 Sync Server API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Server info |
| GET | `/health` | Health check |
| POST | `/api/rooms` | สร้างห้องใหม่ |
| GET | `/api/rooms/:room_code` | ดูข้อมูลห้อง |

### WebSocket Endpoint

```
WS /ws
```

ดูรายละเอียดเพิ่มเติมได้ที่ [sync-server/README.md](sync-server/README.md)

## 📁 Project Details

### Tech Stack

- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS 4
- **State Management**: Svelte Stores
- **Database**: IndexedDB (via idb library)
- **Sync Server**: Rust + Axum + WebSocket
- **WASM**: Rust (compression, CRDT, search)
- **Calendar**: FullCalendar
- **PDF Export**: jsPDF
- **Icons**: Lucide Svelte

### Build Targets

- **Frontend**: Static files (adapter-static)
- **Base Path**: `/khun-phaen-tracker-offline` (สำหรับ GitHub Pages)

## 📄 License

MIT

---

<p align="center">
  สร้างด้วย ❤️ สำหรับการจัดการงานแบบ Offline-First
</p>
