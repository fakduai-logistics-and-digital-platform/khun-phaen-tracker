# Khun Phaen Sync Server

Rust-based WebSocket sync server for Khun Phaen Task Tracker

## Features

- 🏠 **Host Mode**: รัน server เองแล้วให้คนอื่นเชื่อมต่อ
- 🔄 **Real-time Sync**: WebSocket สำหรับ sync แบบ real-time
- 📱 **Cross-device**: คนละเครื่องก็ sync ได้
- 🔒 **No central server**: Host ควบคุมข้อมูลเอง

## Quick Start

### 1. Build & Run

```bash
cd sync-server
cargo run --release
```

Server จะรันที่ `http://0.0.0.0:3001`

### 2. หรือ Build Binary

```bash
cargo build --release
# Binary จะอยู่ที่ target/release/sync-server
./target/release/sync-server
```

### 3. ตั้งค่า Port

```bash
PORT=8080 cargo run
```

## API Endpoints

### Create Room
```bash
POST /api/rooms

Response:
{
  "success": true,
  "room_code": "BQ95B8",
  "room_id": "...",
  "host_id": "host_...",
  "websocket_url": "ws://localhost:3001/ws"
}
```

### Get Room Info
```bash
GET /api/rooms/:room_code

Response:
{
  "success": true,
  "room_code": "BQ95B8",
  "host_id": "host_...",
  "peers": [...],
  "peer_count": 2
}
```

### WebSocket
```
WS /ws
```

## WebSocket Protocol

### Client → Server

```json
// Join room
{
  "action": "join",
  "room_code": "BQ95B8",
  "peer_id": "peer_xxx",
  "is_host": false,
  "metadata": {"name": "John"}
}

// Broadcast data
{
  "action": "broadcast",
  "data": "..."
}

// Sync document (host only)
{
  "action": "sync_document",
  "document": "..."
}

// Request sync
{
  "action": "request_sync"
}

// Leave room
{
  "action": "leave"
}

// Ping
{
  "action": "ping"
}
```

### Server → Client

```json
// Connected
{
  "type": "connected",
  "peer_id": "peer_xxx",
  "room_code": "BQ95B8"
}

// Room info
{
  "type": "room_info",
  "room_code": "BQ95B8",
  "host_id": "host_...",
  "peers": [...]
}

// Peer joined
{
  "type": "peer_joined",
  "peer": {"id": "...", "is_host": false, ...}
}

// Peer left
{
  "type": "peer_left",
  "peer_id": "peer_xxx"
}

// Document sync
{
  "type": "document_sync",
  "document": "..."
}

// Data from peer
{
  "type": "data",
  "from": "peer_xxx",
  "data": "..."
}

// Error
{
  "type": "error",
  "message": "Room not found"
}

// Pong
{
  "type": "pong"
}
```

## Docker Deployment

### 1. Using Docker Compose (Recommended)

คุณสามารถรัน Backend พร้อม MongoDB และระบบสร้าง Admin เริ่มต้นให้อัตโนมัติได้ง่ายๆ ผ่าน Docker Compose:

```bash
cd backend-server
docker compose up -d
```

**🔥 คำสั่งอัปเดตเวอร์ชั่นใหม่บรรทัดเดียว (One-liner Update):**
หาคุณต้องการดึง Image ตัวล่าสุดจาก GitHub และสั่งรันทับตัวเก่าทันที (ทำงานใน Background) ให้ใช้คำสั่งนี้ (เปลี่ยนคำว่า `docker` เป็น `podman` ได้เลยถ้าใช้ Podman):

```bash
docker pull ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/backend:latest && docker compose -f docker-compose.atlas.yml up -d --force-recreate
```

*(หมายเหตุ: หากคุณไม่ได้อยู่ในโฟลเดอร์ `backend-server/` ให้ระบุ path แบบนี้: `docker compose -f backend-server/docker-compose.atlas.yml up -d --force-recreate`)*
### 2. Configuration (.env)

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend-server/` เพื่อตั้งค่าระบบ:

```env
# Database Settings
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password123
DB_NAME=tracker-db

# App Secrets
JWT_SECRET=your_super_secret_key_here

# Initial Admin Setup (สร้างให้อัตโนมัติเมื่อรันครั้งแรก)
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=change_this_password
INITIAL_ADMIN_NICKNAME=Admin

# Security Token (สำคัญ: ต้องใช้สำหรับสร้าง User คนแรก)
INITIAL_SETUP_TOKEN=random_secret_token_here
```

### 3. Security Mechanism (X-Setup-Token)

เพื่อความปลอดภัยสูงสุด ระบบถูกออกแบบมาให้ป้องกันการยึดเครื่อง (Admin Takeover) จากบุคคลภายนอก:
- **First User Only**: ระบบจะยอมให้สร้าง User โดยไม่ต้อง Login เฉพาะเมื่อไม่มี User ในฐานข้อมูลเลยเท่านั้น
- **Setup Token Validation**: ในการสร้าง User คนแรก ระบบบังคับให้ต้องส่ง Header `X-Setup-Token` ที่ตรงกับ `INITIAL_SETUP_TOKEN` ใน Environment เท่านั้น
- **Docker Integration**: Service `setup` ใน `docker-compose.yml` จะทำหน้าที่ส่ง Token นี้ให้โดยอัตโนมัติภายในเครือข่าย Docker ทำให้คนภายนอกที่รู้ URL ไม่สามารถสมัครเองได้

### 4. GitHub Actions CI/CD

Backend นี้ถูกตั้งค่าให้ Build อัตโนมัติผ่าน GitHub Actions:
- **Registry**: `ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/backend:latest`
- **Context**: เมื่อมีการ Push ไปที่ branch `main` ระบบจะทำการ Build และ Push image ใหม่ให้ทันที

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | พอร์ตที่ Server ให้บริการ |
| `MONGODB_URI` | `mongodb://localhost:27017` | Connection string ของ MongoDB |
| `DB_NAME` | `tracker-db` | ชื่อฐานข้อมูล |
| `JWT_SECRET` | - | คีย์สำหรับถอดรหัส Token (ห้ามลืมตั้งค่า) |
| `INITIAL_SETUP_TOKEN` | - | Token ลับสำหรับสร้าง Admin คนแรก |
| `RUST_LOG` | `info` | ระดับการแสดง Log |
| `ROOM_IDLE_TIMEOUT_SECONDS` | `3600` | เวลาที่ห้องจะค้างอยู่ใน Memory เมื่อไม่มีคนอยู่ (0 = ตลอดไป) |

## Development

หากต้องการรันเพื่อพัฒนา (Local Development):
1. ตรวจสอบให้แน่ใจว่าได้ปิด Server ตัวอื่นๆ แล้ว
2. รัน MongoDB local (หรือใช้ Docker)
3. ใช้คำสั่ง:
   ```bash
   cargo run
   ```

## License

MIT

## Deployment

### Using Pre-built Docker Image

ดึงและรัน image จาก GitHub Container Registry (แนะนำ):

```bash
# Pull image
podman pull ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/sync-server:latest

# Run container (limit memory 100MB, background mode)
podman run -d \
  --name khu-phaen-sync \
  --memory=100m \
  -p 3002:3001 \
  ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/sync-server:latest

# View logs
podman logs -f khu-phaen-sync
```

หรือใช้ Docker:

```bash
# Pull image
docker pull ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/sync-server:latest

# Run container (limit memory 100MB, background mode)
docker run -d \
  --name khu-phaen-sync \
  --memory=100m \
  -p 3002:3001 \
  ghcr.io/fakduai-logistics-and-digital-platform/khun-phaen-tracker/sync-server:latest

# View logs
docker logs -f khu-phaen-sync
```

ดู tags ทั้งหมดได้ที่: [GitHub Packages](https://github.com/watchakorn-18k?tab=packages)

หลังรันเสร็จจะเข้าได้ที่:

- REST API: `http://localhost:3002`
- WebSocket: `ws://localhost:3002/ws`

### Deploy on Render (HTTPS)

สำหรับ Render ให้ใช้ image เดียวกันและใช้ public URL แบบ `https`:

```txt
https://<your-service>.onrender.com
```

หมายเหตุสำคัญ:

1. Render จะส่งค่า `PORT` ให้ container อัตโนมัติ (แอปรองรับอยู่แล้ว)
2. ตอนเชื่อมต่อจาก frontend ให้ใส่ URL แบบ `https://...`
3. frontend จะเปลี่ยนเป็น `wss://.../ws` อัตโนมัติเมื่อเปิด WebSocket

### Build Docker Image Manually

```bash
cd sync-server
podman build -t khu-phaen-sync .
podman run -d -p 3002:3001 --name khu-phaen-sync khu-phaen-sync
```

### With systemd

Create `/etc/systemd/system/khu-phaen-sync.service`:

```ini
[Unit]
Description=Khun Phaen Sync Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/khu-phaen-sync
ExecStart=/opt/khu-phaen-sync/sync-server
Restart=on-failure
Environment="PORT=3001"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable khu-phaen-sync
sudo systemctl start khu-phaen-sync
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `RUST_LOG` | `info` | Log level |
| `ROOM_IDLE_TIMEOUT_SECONDS` | `3600` | Room retention when empty (0 = forever) |

## License

MIT
