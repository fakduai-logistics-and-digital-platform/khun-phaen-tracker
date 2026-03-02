# Khun Phaen Tracker (ขุนแผน)

Task Management System - Manage your tasks efficiently with local-first data and optional real-time synchronization.

[อ่านภาษาไทยที่นี่ (Read Thai version here)](README.th.md)

> **Khun Phaen** (ขุนแผน) - Named after a legendary Thai literary figure known for being a master strategist who could manage complex situations effectively.

## ✨ Features

- ✅ **Task Management** - Add, edit, and delete tasks.
- 👥 **Team Management** - Manage team members and assign tasks.
- 📁 **Project Management** - Group tasks by project.
- 📅 **Calendar View** - View tasks in a calendar format.
- 🎯 **Kanban Board** - Manage tasks using Drag & Drop.
- 📊 **Task Statistics** - View statistics and reports.
- 📤 **Export/Import** - Export/Import data via JSON/CSV.
- 💾 **Local Storage** - Data stored in the browser (IndexedDB).
- 🌙 **Dark Mode** - Dark mode support.
- 🔄 **Real-time Sync** - Real-time data synchronization via WebSocket (**Backend Server** required).

## 🏗️ Project Structure

```
.
├── src/                    # SvelteKit Frontend
├── backend-server/          # Rust WebSocket Sync Server (API + WS)
├── wasm-compress/          # WASM: LZ4 Compression
├── wasm-crdt/              # WASM: CRDT for collaborative editing
├── wasm-search/            # WASM: Full-text search
├── static/                 # Static assets
└── build/                  # Build output (static files)
```

## 🐳 Docker / Podman Deployment

We provide a seamless way to run the entire stack locally using Docker or Podman. This includes the Frontend, Backend, and a local MongoDB instance.

### Prerequisites

1. Ensure you have **Docker** or **Podman** installed.
2. (For Mac ARM/M1/M2/M3) We recommend using `--build` to ensure architecture compatibility.

### 🚀 Running the Stack

```sh
# Start all services (Frontend, Backend, MongoDB)
podman-compose up -d --build

# To check container status
podman ps

# To stop the services
podman-compose down
```

- **Frontend**: [http://localhost:8080/](http://localhost:8080/)
- **Backend API**: [http://localhost:3001/api](http://localhost:3001/api)
- **MongoDB**: Runs internally on port `27017`
- **RustFS (Storage API)**: Runs mapped to port `9000`
- **RustFS (Console)**: [http://localhost:9001/](http://localhost:9001/) (Credentials: `rustfsadmin` / `rustfsadmin` by default)

---

## 🔑 Initial Setup (First Login)

When running the system for the first time, there are no users in the database. You need to perform a one-time initialization to create your first **Admin** account.

### 1. Configure the Setup Token
Ensure your `backend-server/.env` (or env for `backend-server` in `docker-compose.yml`) has a secret token:
```env
INITIAL_SETUP_TOKEN=your-very-secret-setup-token
```

### 2. Create the First Admin User
Run the following `curl` command (pointing to your running backend):

```sh
curl -X POST http://localhost:3001/api/auth/invite \
  -H "Content-Type: application/json" \
  -H "X-Setup-Token: your-very-secret-setup-token" \
  -d '{
    "email": "admin@example.com",
    "role": "admin",
    "nickname": "Master Strategist"
  }'
```

The server will respond with a **setup link**:
```json
{
  "success": true,
  "message": "Invitation created successfully",
  "setup_link": "/setup-password?token=some-unique-token"
}
```

### 3. Set Your Password
1.  Copy the `setup_link` from the response.
2.  Open your browser and visit: `http://localhost:8080/khun-phaen-tracker/setup-password?token=some-unique-token`
3.  Set your desired password.
4.  **Done!** You can now log in at `http://localhost:8080/` with your email and password.

---

## 🛠️ Local Development (Manual)

### 1. Install Dependencies
```sh
npm install
```

### 2. Configure Environment
```sh
# Root .env
cp .env.example .env

# Backend .env
cd backend-server && cp .env.example .env && cd ..
```

### 3. File Storage Setup (RustFS / S3 Compatible)
By default, the backend expects an S3-compatible service (like RustFS) to handle task attachments.
Ensure you have the following mapped in your `backend-server/.env`:
```env
STORAGE_URL="http://127.0.0.1:9000"
RUSTFS_ACCESS_KEY="rustfsadmin"
RUSTFS_SECRET_KEY="rustfsadmin"
STORAGE_BUCKET="khunphaen-assets"
```
**Important:** The system will attempt to automatically create the specified bucket upon backend startup. However, if using an external IP/Server for `STORAGE_URL`, you may first need to manually log in to the RustFS Admin Console and verify or create the bucket to avoid Access Denied errors.

### 4. Run Development Server
```sh
# Run frontend
npm run dev

# Run RustFS storage service (optional but recommended for attachments)
# Create data and logs directories
mkdir -p data logs

# Change the owner of these directories
chown -R 10001:10001 data logs
sudo podman run -d -p 9000:9000 -p 9001:9001 -v $(pwd)/data:/data -v $(pwd)/logs:/logs -e RUSTFS_ACCESS_KEY=khunphaen -e RUSTFS_SECRET_KEY=khunphaen rustfs/rustfs:latest 

# Create Bucket name khunphaen-assets

# In another terminal, run backend
cd backend-server
cargo run --release
```

## 📄 License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - you are free to use, modify, and share this software for non-commercial purposes only.

---
