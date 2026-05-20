---
name: sync-protocol-validator
description: Ensures data model consistency across the full stack (IndexedDB, WebSocket messages, MongoDB) when adding or modifying fields. Use when changing task/project/member schemas, adding new collections, or modifying sync protocol messages.
---

# Sync Protocol Validator

This project stores data in three locations that must stay in sync:
1. **IndexedDB** on the frontend (`src/lib/db.ts`)
2. **WebSocket JSON messages** between frontend (`src/lib/stores/sync.ts`, `src/lib/stores/crdt-sync.ts`) and backend
3. **MongoDB** on the Rust backend (`backend-server/src/`)

When any data model changes, **all three layers must be updated together** or the system will silently lose data or break sync.

## When to Use This Skill

Trigger this skill when the task involves:
- Adding a new field to tasks, projects, members, or workspaces
- Creating a new collection or data model
- Changing the shape of WebSocket sync messages
- Modifying serialization/deserialization logic
- Database migrations or schema evolution

## Full-Stack Schema Change Checklist

When adding or modifying a data field, complete **every** step:

### 1. Frontend TypeScript Types
- [ ] Update the TypeScript interface in `src/lib/types.ts` or relevant type file
- [ ] Ensure the new field has a sensible default for existing records (backward compatibility)

### 2. IndexedDB Schema (`src/lib/db.ts`)
- [ ] Update the IndexedDB store schema if adding a new store or index
- [ ] Bump the database version number if schema changes require migration
- [ ] Add migration logic for existing data (handle records that lack the new field)
- [ ] Update unit tests in `src/lib/db.unit.test.ts`

### 3. WebSocket Sync Messages
- [ ] Update the sync message types in `src/lib/stores/sync.ts` or `src/lib/stores/crdt-sync.ts`
- [ ] Ensure the new field is included in outgoing sync payloads
- [ ] Ensure the new field is parsed from incoming sync payloads
- [ ] Handle backward compatibility: old clients that don't send the new field must not crash new servers, and vice versa

### 4. Rust Backend MongoDB Models
- [ ] Update the Rust struct with `#[serde]` derive in the relevant model file
- [ ] Use `Option<T>` for new fields to maintain backward compatibility with existing documents
- [ ] Update any MongoDB queries or aggregation pipelines that reference the model
- [ ] All IDs must use UUID (per repository rules)
- [ ] Run `cargo check` to verify compilation

### 5. Validation
- [ ] Run `npm run check` — frontend compiles cleanly
- [ ] Run `cargo check` — backend compiles cleanly
- [ ] Write or update tests covering the new field in both frontend and backend

## UUID Rule
Per repository rules: **"อะไรที่เกี่ยว id ให้ใช้ uuid เท่านั้น"**
- Frontend: `crypto.randomUUID()`
- Backend: `uuid::Uuid::new_v4()` or `uuid::Uuid::now_v7()`
- Never use MongoDB ObjectId or auto-increment integers for application-level IDs

## Anti-Patterns
* **Partial updates:** Never update only one layer. If you add a field to the TypeScript type but forget the Rust struct, sync will silently drop the field.
* **Unversioned schemas:** Always bump the IndexedDB version when adding stores or indexes. Failing to do so means existing users never get the migration.
* **Required fields on existing data:** New fields on existing collections must be `Option<T>` in Rust and optional (`?`) in TypeScript. Existing documents won't have them.
