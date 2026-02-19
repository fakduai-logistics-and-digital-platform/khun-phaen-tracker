import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const targets = [
  "node_modules/svelte-dnd-action/dist/index.mjs",
  "node_modules/svelte-dnd-action/dist/index.js",
  "node_modules/svelte-dnd-action/src/pointerAction.js",
];

const keepOriginalGuardPattern =
  /function keepOriginalElementInDom\(\)\s*\{\s*\n([ \t]*)if\s*\(!originalDragTarget(?:\s*\|\|\s*!originalDragTarget\.parentElement|\.parentElement)\)\s*\{/g;
const keepOriginalGuardReplacement =
  "function keepOriginalElementInDom() {\n$1if (!originalDragTarget) {\n$1    return;\n$1}\n$1if (!originalDragTarget.parentElement) {";

let patchedCount = 0;
let checkedCount = 0;

for (const relativeTarget of targets) {
  const targetPath = path.resolve(process.cwd(), relativeTarget);
  if (!existsSync(targetPath)) {
    continue;
  }

  checkedCount += 1;
  const source = readFileSync(targetPath, "utf8");

  if (!source.includes("originalDragTarget.parentElement")) {
    continue;
  }

  const patched = source.replace(
    keepOriginalGuardPattern,
    keepOriginalGuardReplacement,
  );
  if (patched !== source) {
    writeFileSync(targetPath, patched, "utf8");
    patchedCount += 1;
  }
}

console.log(
  `[patch-svelte-dnd-action] checked ${checkedCount} file(s), patched ${patchedCount} file(s).`,
);
