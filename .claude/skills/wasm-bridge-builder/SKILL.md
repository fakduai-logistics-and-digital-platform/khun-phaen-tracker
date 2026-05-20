---
name: wasm-bridge-builder
description: Guides compilation, deployment, and TypeScript binding of Rust WebAssembly modules (wasm-crdt, wasm-compress, wasm-search). Use when editing WASM Rust source, updating bindings, or debugging WASM integration issues.
---

# WebAssembly Bridge Builder

This project uses three Rust-to-WebAssembly modules that power offline-first capabilities. This skill ensures safe compilation, deployment, and TypeScript binding updates whenever WASM source code changes.

## WASM Modules

| Module | Path | Purpose | Frontend Package |
|:---|:---|:---|:---|
| **wasm-crdt** | `wasm-crdt/` | Deterministic CRDT merges for collaborative editing | `src/lib/wasm-crdt-pkg/` |
| **wasm-compress** | `wasm-compress/` | LZ4 compression for WebSocket payload transport | Loaded at runtime |
| **wasm-search** | `wasm-search/` | Client-side full-text search index | Loaded at runtime |

## Build Workflow

When editing any Rust source inside `wasm-crdt/`, `wasm-compress/`, or `wasm-search/`:

### 1. Compile with `wasm-pack`
```bash
# Example for wasm-crdt
cd wasm-crdt
wasm-pack build --target web --release
```

### 2. Deploy to Frontend
After a successful build, copy the generated package to the correct frontend location:
```bash
# For wasm-crdt — copy pkg/ output to the frontend binding directory
cp -r wasm-crdt/pkg/* src/lib/wasm-crdt-pkg/
```

### 3. Verify TypeScript Bindings
* Ensure the generated `.d.ts` type definition files match the exported Rust functions.
* If you add or rename a `#[wasm_bindgen]` export, verify the corresponding TypeScript import compiles cleanly.
* Run `npm run check` to validate there are no type errors from the updated bindings.

### 4. Validate Rust Source
Before building WASM, always run `cargo check` inside the module directory to catch compilation errors early:
```bash
cd wasm-crdt && cargo check
```

## Safety Rules

* **Never commit stale bindings.** If you change a Rust function signature, you must rebuild and redeploy the WASM package before committing.
* **Test CRDT convergence.** After any change to `wasm-crdt`, write or update tests that simulate concurrent edits merged in different orders and assert identical final state.
* **Memory cleanup.** If the WASM module allocates memory (e.g., returns a struct), ensure the JS caller calls `.free()` when done. Leaked WASM memory is invisible to the browser GC.
* **Keep `Cargo.toml` minimal.** WASM modules must stay small. Avoid pulling in heavy crates that bloat the `.wasm` binary.

## Verification Checklist
- [ ] Ran `cargo check` in the modified WASM module directory
- [ ] Ran `wasm-pack build --target web --release` successfully
- [ ] Copied output to the correct frontend package directory
- [ ] Ran `npm run check` — no TypeScript errors from WASM bindings
- [ ] Updated or added tests for changed WASM exports
