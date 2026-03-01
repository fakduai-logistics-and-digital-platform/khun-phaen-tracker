# Khun Phaen (ขุนแผน)

Offline Task Management System - Manage your tasks efficiently without needing an internet connection.

[อ่านภาษาไทยที่นี่ (Read Thai version here)](README.th.md)

> **Khun Phaen** (ขุนแผน) - Named after a legendary Thai literary figure known for being a master strategist who could manage complex situations effectively.

## ✨ Features

- ✅ **Task Management** - Add, edit, and delete tasks.
- 👥 **Team Management** - Manage team members and assign tasks.
- 📁 **Project Management** - Group tasks by project.
- 📅 **Calendar View** - View tasks in a calendar format.
- 🎯 **Kanban Board** - Manage tasks using Drag & Drop.
- 📊 **Task Statistics** - View statistics and reports.
- 📤 **Export/Import** - Export/Import data via CSV and PDF.
- 💾 **Local Storage** - Data stored in the browser (IndexedDB).
- 🌙 **Dark Mode** - Dark mode support.
- 🔄 **Real-time Sync** - Real-time data synchronization via WebSocket (Sync Server required).

## 🏗️ Project Structure

```
.
├── src/                    # SvelteKit Frontend
├── backend-server/            # Rust WebSocket Sync Server
├── wasm-compress/          # WASM: LZ4 Compression
├── wasm-crdt/              # WASM: CRDT for collaborative editing
├── wasm-search/            # WASM: Full-text search
├── static/                 # Static assets
└── build/                  # Build output (static files)
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ 
- [Rust](https://rustup.rs/) (If building Sync Server or WASM modules)

### 1. Install Dependencies

```sh
npm install
```

### 2. Configure Environment Variables

```sh
cp .env.example .env
```

Edit `.env` and set your tldraw license key:

```
VITE_TLDRAW_LICENSE_KEY=your-license-key
```

> **How to get a tldraw License Key:** Go to [tldraw.dev](https://tldraw.dev), sign up, and request a free license key for non-commercial use. The Whiteboard feature works without a key but will show a watermark/warning.

### 3. Run Development Server

```sh
# Run frontend dev server
npm run dev

# Or open in browser automatically
npm run dev -- --open
```

The frontend will run at `http://localhost:5173/khun-phaen-tracker` (base path configured).

### 4. Run Sync Server (Optional - for Real-time Sync)

In another terminal:

```sh
cd backend-server
cargo run --release
```

The Sync Server will run at `http://localhost:3001`

### 5. Build WASM Modules (Optional)

To build WASM modules yourself:

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

## 🧪 Testing

### Why run tests?

- Reduce bugs when modifying code, especially for critical flows like task creation/editing, filtering, and bulk actions.
- Catch regressions early before production.
- Refactor with confidence knowing existing behaviors are preserved.

### How tests work?

- Uses `Vitest` as the test runner.
- `unit` suite is for logic and component/UI tests.
- Scans for `*.test.ts` files in `src/`.
- Watch mode automatically reruns tests on file changes.

### Commands

```sh
# Run all tests
npm test

# Run DB logic tests specifically
npx vitest run src/lib/db.unit.test.ts

# Run unit/component tests only
npx vitest run --project unit

# Run specific test file
npx vitest run --project unit src/lib/components/TaskForm.test.ts
```

## 📚 Storybook (UI Documentation)

### Why Storybook?

- Visualize and interact with components in isolation.
- Prevent UI regressions by comparing different component states.
- Serves as living documentation for developers and reviewers.

### Usage

```sh
# Run Storybook locally
npm run storybook
```
Available at `http://localhost:6006`

## 🏭 Build for Production

```sh
# Build Frontend
npm run build

# Build Sync Server (Binary)
cd backend-server
cargo build --release
```

## 🐳 Docker / Deployment

We provide multiple ways to run the project using Docker depending on your database preference (Local MongoDB or Mongo Atlas) and whether you want to run the full stack or just the backend.

### Prerequisites for Docker

1. Ensure you have Docker and Docker Compose installed.
2. Make sure no other services are using ports `8080`, `3001`, or `27017` (if using local MongoDB).
3. If using MongoDB Atlas, make sure your cluster IP access list allows connections from your runner IP.

### Option 1: Run Full Stack with Local MongoDB (Default)

This runs the Frontend, Backend, and a local MongoDB instance.

```sh
# Run in the background
docker compose up -d

# To stop the services
docker compose down
```

Frontend will be available at: `http://localhost:8080/khun-phaen-tracker/`
Backend will be available at: `http://localhost:3001`

### Option 2: Run Full Stack with Mongo Atlas (Cloud Database)

This runs the Frontend, Backend, and a one-time Setup script to create the initial admin user using your remote MongoDB Atlas database.

**Step 1:** Create or edit your `.env` file in the root directory and add your Atlas URI and Setup details:
```env
MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/tracker-db?retryWrites=true&w=majority
INITIAL_SETUP_TOKEN=your-very-secret-token
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=password123
INITIAL_ADMIN_NICKNAME=SuperAdmin
```

**Step 2:** Start the stack using the Atlas compose file:
```sh
docker compose -f docker-compose.atlas.yml up -d
```

### Option 3: Run Backend Server ONLY (with Mongo Atlas)

If you have a separate frontend deployment (e.g., Vercel, Netlify, GitHub Pages) and only need to host the backend APIs and WebSocket server via Docker.

**Step 1:** Navigate to the backend directory:
```sh
cd backend-server
```

**Step 2:** Create a `.env` file in the `backend-server` directory with your database credentials:
```env
MONGODB_ATLAS_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/tracker-db?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
INITIAL_SETUP_TOKEN=your-very-secret-token
```

**Step 3:** Start the backend and setup service:
```sh
docker compose -f docker-compose.atlas.yml up -d
```
The Backend API and WebSocket will run at `http://localhost:3001`.

## 📄 License

This project is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - you are free to use, modify, and share this software for non-commercial purposes only.

---

<p align="center">
  Built with ❤️ for Offline-First Task Management
</p>

