// ─── YAML parser/generator ──────────────────────
export function jsonToYaml(obj: any, indent: number): string {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return String(obj);
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (
      /[:\n#"']/.test(obj) ||
      obj === "" ||
      obj === "true" ||
      obj === "null" ||
      /^\d/.test(obj) ||
      obj.startsWith(" ")
    )
      return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj
      .map((item) => {
        const val = jsonToYaml(item, indent + 1);
        return typeof item === "object" && item !== null ? `${pad}- ${val.trimStart()}` : `${pad}- ${val}`;
      })
      .join("\n");
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  return entries
    .map(([key, val]) => {
      const yamlVal = jsonToYaml(val, indent + 1);
      if (
        typeof val === "object" &&
        val !== null &&
        ((Array.isArray(val) && val.length > 0) || (!Array.isArray(val) && Object.keys(val).length > 0))
      )
        return `${pad}${key}:\n${yamlVal}`;
      return `${pad}${key}: ${yamlVal}`;
    })
    .join("\n");
}

export function yamlToJson(yaml: string): any {
  return parseYaml(yaml.split("\n"), 0, 0).value;
}

function getIndent(line: string) {
  const m = line.match(/^( *)/);
  return m ? m[1].length : 0;
}

function parseYamlValue(v: string): any {
  const t = v.trim();
  if (t === "null" || t === "~" || t === "") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  if (t.startsWith('"') && t.endsWith('"'))
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  if (t === "[]") return [];
  if (t === "{}") return {};
  return t;
}

function parseYaml(lines: string[], si: number, bi: number): { value: any; nextIdx: number } {
  if (si >= lines.length) return { value: null, nextIdx: si };
  const fl = lines[si];
  if (fl.trim() === "" || fl.trim().startsWith("#")) return parseYaml(lines, si + 1, bi);

  if (fl.trim().startsWith("- ")) {
    const arr: any[] = [];
    let i = si;
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === "" || line.trim().startsWith("#")) {
        i++;
        continue;
      }
      const indent = getIndent(line);
      if (indent < bi) break;
      if (indent === bi && line.trim().startsWith("- ")) {
        const after = line.trim().slice(2);
        if (after.includes(": ")) {
          const obj: Record<string, any> = {};
          const ci = after.indexOf(": ");
          const key = after.slice(0, ci).trim(),
            val = after.slice(ci + 2).trim();
          if (val === "" || val === "|" || val === ">") {
            const n = parseYaml(lines, i + 1, indent + 2);
            obj[key] = n.value;
            i = n.nextIdx;
          } else {
            obj[key] = parseYamlValue(val);
            i++;
          }
          while (i < lines.length) {
            const nl = lines[i];
            if (nl.trim() === "" || nl.trim().startsWith("#")) {
              i++;
              continue;
            }
            if (getIndent(nl) <= indent) break;
            const n = parseYaml(lines, i, getIndent(nl));
            if (typeof n.value === "object" && n.value !== null && !Array.isArray(n.value)) Object.assign(obj, n.value);
            i = n.nextIdx;
          }
          arr.push(obj);
        } else {
          arr.push(parseYamlValue(after));
          i++;
        }
      } else break;
    }
    return { value: arr, nextIdx: i };
  }

  const obj: Record<string, any> = {};
  let i = si;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const indent = getIndent(line);
    if (indent < bi) break;
    if (indent > bi) {
      const n = parseYaml(lines, i, indent);
      i = n.nextIdx;
      continue;
    }
    const cm = line.match(/^ *([^:]+):\s*(.*)/);
    if (cm) {
      const key = cm[1].trim(),
        val = cm[2].trim();
      if (val === "" || val === "|" || val === ">") {
        const n = parseYaml(lines, i + 1, getIndent(line) + 2);
        obj[key] = n.value;
        i = n.nextIdx;
      } else {
        obj[key] = parseYamlValue(val);
        i++;
      }
    } else i++;
  }
  return { value: obj, nextIdx: i };
}

// ─── CSV helpers ────────────────────────────────
export function csvEscape(v: string) {
  return v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
}
export function csvParseLine(line: string): string[] {
  const r: string[] = [];
  let cur = "",
    inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        r.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  r.push(cur);
  return r;
}

// ─── Model generators ───────────────────────────
function inferType(val: any): string {
  if (val === null || val === undefined) return "String?";
  if (typeof val === "boolean") return "Bool";
  if (typeof val === "number") return Number.isInteger(val) ? "Int" : "Double";
  if (typeof val === "string") return /^\d{4}-\d{2}-\d{2}/.test(val) ? "Date" : "String";
  if (Array.isArray(val)) return "[Any]";
  return "Object";
}

export function genSwift(obj: Record<string, any>, name: string): string {
  const lines = [`struct ${name}: Codable {`];
  for (const [k, v] of Object.entries(obj)) {
    const t = inferType(v);
    lines.push(`    let ${k}: ${t}${t.endsWith("?") ? "" : "?"}`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function genKotlin(obj: Record<string, any>, name: string): string {
  const lines = [`data class ${name}(`];
  const entries = Object.entries(obj);
  entries.forEach(([k, v], i) => {
    let t = inferType(v)
      .replace("Bool", "Boolean")
      .replace("Date", "String")
      .replace("[Any]", "List<Any>")
      .replace("Object", "Any");
    if (!t.endsWith("?") && v === null) t += "?";
    lines.push(`    val ${k}: ${t}${i < entries.length - 1 ? "," : ""}`);
  });
  lines.push(")");
  return lines.join("\n");
}

export function genDart(obj: Record<string, any>, name: string): string {
  const lines = [`class ${name} {`];
  for (const [k, v] of Object.entries(obj)) {
    let t = inferType(v)
      .replace("Bool", "bool")
      .replace("Int", "int")
      .replace("Double", "double")
      .replace("Date", "DateTime")
      .replace("[Any]", "List<dynamic>")
      .replace("Object", "Map<String, dynamic>");
    if (v === null && !t.endsWith("?")) t += "?";
    lines.push(`  final ${t} ${k};`);
  }
  lines.push("", `  ${name}({`);
  for (const k of Object.keys(obj)) lines.push(`    required this.${k},`);
  lines.push("  });", "", `  factory ${name}.fromJson(Map<String, dynamic> json) => ${name}(`);
  for (const [k, v] of Object.entries(obj)) {
    lines.push(inferType(v) === "Date" ? `    ${k}: DateTime.parse(json['${k}']),` : `    ${k}: json['${k}'],`);
  }
  lines.push("  );", "}");
  return lines.join("\n");
}

export function genGo(obj: Record<string, any>, name: string): string {
  const lines = [`type ${name} struct {`];
  for (const [k, v] of Object.entries(obj)) {
    let t = inferType(v);
    if (t === "String?" || t === "String") t = "string";
    else if (t === "Int") t = "int";
    else if (t === "Double") t = "float64";
    else if (t === "Bool") t = "bool";
    else if (t === "Date") t = "time.Time";
    else if (t === "[Any]") t = "[]any";
    else if (t === "Object") t = "map[string]any";
    else t = "any";
    const tag = k.slice(0, 1).toUpperCase() + k.slice(1);
    lines.push(`\t${tag} ${t} \`json:"${k}"\``);
  }
  lines.push("}");
  return lines.join("\n");
}

export function genRust(obj: Record<string, any>, name: string): string {
  const lines = [
    "use serde::{Serialize, Deserialize};",
    "",
    `#[derive(Serialize, Deserialize, Debug)]`,
    `pub struct ${name} {`,
  ];
  for (const [k, v] of Object.entries(obj)) {
    let t = inferType(v);
    if (t === "String?" || t === "String") t = v === null ? "Option<String>" : "String";
    else if (t === "Int") t = v === null ? "Option<i64>" : "i64";
    else if (t === "Double") t = v === null ? "Option<f64>" : "f64";
    else if (t === "Bool") t = v === null ? "Option<bool>" : "bool";
    else if (t === "Date") t = "String";
    else if (t === "[Any]") t = "Vec<serde_json::Value>";
    else if (t === "Object") t = "serde_json::Map<String, serde_json::Value>";
    else t = "serde_json::Value";
    lines.push(`    pub ${k}: ${t},`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function genTypeScript(obj: Record<string, any>, name: string): string {
  const lines = [`export interface ${name} {`];
  for (const [k, v] of Object.entries(obj)) {
    let t = inferType(v);
    if (t === "String?" || t === "String") t = "string";
    else if (t === "Int" || t === "Double") t = "number";
    else if (t === "Bool") t = "boolean";
    else if (t === "Date") t = "string";
    else if (t === "[Any]") t = "any[]";
    else if (t === "Object") t = "Record<string, any>";
    else t = "any";
    const opt = v === null ? "?" : "";
    lines.push(`  ${k}${opt}: ${t};`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function genPython(obj: Record<string, any>, name: string): string {
  const lines = [
    "from dataclasses import dataclass",
    "from typing import Any, Optional",
    "",
    `@dataclass`,
    `class ${name}:`,
  ];
  for (const [k, v] of Object.entries(obj)) {
    let t = inferType(v);
    if (t === "String?" || t === "String") t = "str";
    else if (t === "Int") t = "int";
    else if (t === "Double") t = "float";
    else if (t === "Bool") t = "bool";
    else if (t === "Date") t = "str";
    else if (t === "[Any]") t = "list[Any]";
    else if (t === "Object") t = "dict[str, Any]";
    else t = "Any";
    const def = v === null ? " = None" : "";
    lines.push(`    ${k}: ${t}${def}`);
  }
  return lines.join("\n");
}

export function genLua(obj: Record<string, any>, name: string): string {
  const lines = [
    `local ${name} = {}`,
    `${name}.__index = ${name}`,
    "",
    `function ${name}.new(data)`,
    `    local self = setmetatable({}, ${name})`,
  ];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) lines.push(`    self.${k} = data.${k} or nil`);
    else if (typeof v === "string") lines.push(`    self.${k} = data.${k} or ""`);
    else if (typeof v === "number") lines.push(`    self.${k} = data.${k} or 0`);
    else if (typeof v === "boolean") lines.push(`    self.${k} = data.${k} or false`);
    else lines.push(`    self.${k} = data.${k} or {}`);
  }
  lines.push("    return self", "end", "", `return ${name}`);
  return lines.join("\n");
}

export type ModelLang = "swift" | "kotlin" | "dart" | "go" | "rust" | "typescript" | "python" | "lua";

export const MODEL_LANGS: { l: ModelLang; n: string }[] = [
  { l: "swift", n: "Swift" },
  { l: "kotlin", n: "Kotlin" },
  { l: "dart", n: "Dart" },
  { l: "go", n: "Go" },
  { l: "rust", n: "Rust" },
  { l: "typescript", n: "TypeScript" },
  { l: "python", n: "Python" },
  { l: "lua", n: "Lua" },
];

export type ConvertResult = { output: string; error: string };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function convertJsonYaml(input: string, from: "json" | "yaml", to: "json" | "yaml"): ConvertResult {
  try {
    if (!input.trim()) return { output: "", error: "" };
    if (from === "json" && to === "yaml") return { output: jsonToYaml(JSON.parse(input), 0), error: "" };
    if (from === "yaml" && to === "json") return { output: JSON.stringify(yamlToJson(input), null, 2), error: "" };
    if (from === "json" && to === "json") return { output: JSON.stringify(JSON.parse(input), null, 2), error: "" };
    return { output: input, error: "" };
  } catch (e) {
    return { output: "", error: messageOf(e) };
  }
}

export function convertJsonCsv(input: string, from: "json" | "csv", to: "json" | "csv"): ConvertResult {
  try {
    if (!input.trim()) return { output: "", error: "" };
    if (from === "json" && to === "csv") {
      const parsed = JSON.parse(input);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length === 0) return { output: "", error: "" };
      const keys = [...new Set(arr.flatMap((o: Record<string, unknown> | null) => Object.keys(o || {})))];
      const header = keys.join(",");
      const rows = arr.map((o: Record<string, unknown> | null) =>
        keys.map((k) => csvEscape(String(o?.[k] ?? ""))).join(","),
      );
      return { output: [header, ...rows].join("\n"), error: "" };
    }
    if (from === "csv" && to === "json") {
      const lines = input.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return { output: "[]", error: "" };
      const headers = csvParseLine(lines[0]);
      const rows = lines.slice(1).map((line) => {
        const vals = csvParseLine(line);
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => (obj[h] = vals[i] || ""));
        return obj;
      });
      return { output: JSON.stringify(rows, null, 2), error: "" };
    }
    return { output: input, error: "" };
  } catch (e) {
    return { output: "", error: messageOf(e) };
  }
}

export function generateModel(input: string, lang: ModelLang, className: string): string {
  if (!input.trim()) return "";
  try {
    const parsed = JSON.parse(input);
    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!obj || typeof obj !== "object") return "";
    if (lang === "swift") return genSwift(obj, className);
    if (lang === "kotlin") return genKotlin(obj, className);
    if (lang === "dart") return genDart(obj, className);
    if (lang === "go") return genGo(obj, className);
    if (lang === "rust") return genRust(obj, className);
    if (lang === "typescript") return genTypeScript(obj, className);
    if (lang === "python") return genPython(obj, className);
    return genLua(obj, className);
  } catch {
    return "// Invalid JSON";
  }
}

export function hexToRgb(hex: string) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function colorFormats(hex: string): { label: string; value: string }[] {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const f = (n: number) => (n / 255).toFixed(3);
  return [
    { label: "HEX", value: hex.toUpperCase() },
    { label: "RGB", value: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { label: "RGBA", value: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.0)` },
    { label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
    { label: "Swift UIColor", value: `UIColor(red: ${f(rgb.r)}, green: ${f(rgb.g)}, blue: ${f(rgb.b)}, alpha: 1.0)` },
    { label: "SwiftUI Color", value: `Color(red: ${f(rgb.r)}, green: ${f(rgb.g)}, blue: ${f(rgb.b)})` },
    { label: "Kotlin Color", value: `Color(${rgb.r}, ${rgb.g}, ${rgb.b})` },
    { label: "Flutter Color", value: `Color(0xFF${hex.slice(1).toUpperCase()})` },
  ];
}

function relativeTime(date: Date, locale: string): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 2_592_000_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return rtf.format(Math.round(diff / 2_592_000_000), "month");
}

export function parseTimestamp(input: string, locale = "en") {
  const raw = input.trim();
  if (!raw) return null;
  let date: Date | null = null;
  if (/^\d{10}$/.test(raw)) date = new Date(Number(raw) * 1000);
  else if (/^\d{13}$/.test(raw)) date = new Date(Number(raw));
  else if (/^\d{16}$/.test(raw)) date = new Date(Number(raw) / 1000);
  else {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) date = d;
  }
  if (!date) return null;
  return {
    iso: date.toISOString(),
    isoLocal: date.toLocaleString("sv-SE", { dateStyle: "long", timeStyle: "medium" }),
    epochSec: Math.floor(date.getTime() / 1000),
    epochMs: date.getTime(),
    relative: relativeTime(date, locale),
    utc: date.toUTCString(),
    rfc2822: date.toUTCString().replace("GMT", "+0000"),
    dayOfWeek: date.toLocaleDateString(locale, { weekday: "long" }),
    dateOnly: date.toISOString().slice(0, 10),
    timeOnly: date.toISOString().slice(11, 19),
    unixCmd: `date -d @${Math.floor(date.getTime() / 1000)}`,
  };
}

export type NumberBase = 2 | 8 | 10 | 16;

export function parseNumberBase(input: string, base: NumberBase) {
  const raw = input.trim();
  if (!raw) return null;
  const dec = parseInt(raw, base);
  if (isNaN(dec)) return null;
  const hex = dec.toString(16).toUpperCase();
  const oct = dec.toString(8);
  const bin = dec.toString(2);
  return {
    hex,
    hexPrefixed: `0x${hex}`,
    dec: dec.toString(10),
    oct,
    octPrefixed: `0o${oct}`,
    bin,
    binPrefixed: `0b${bin}`,
    char:
      dec >= 32 && dec <= 126
        ? `'${String.fromCharCode(dec)}'`
        : dec >= 0 && dec <= 0x10ffff
          ? `U+${hex.padStart(4, "0")}`
          : "",
    bits: bin.length,
    byteHex: dec >= 0 && dec <= 255 ? `0x${hex.padStart(2, "0")}` : "",
  };
}
