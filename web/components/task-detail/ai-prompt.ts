import { BookOpen, Bug, FlaskConical, Layers, ScanSearch, Sparkles, Wrench, Zap, type LucideIcon } from "lucide-react";

export type PromptLang = "th" | "en";

export interface AiProvider {
  id: string;
  name: string;
  supportsQuery: boolean;
  buildUrl: (encodedPrompt: string) => string;
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: "chatgpt", name: "ChatGPT", supportsQuery: true, buildUrl: (p) => `https://chatgpt.com/?q=${p}` },
  { id: "claude", name: "Claude", supportsQuery: true, buildUrl: (p) => `https://claude.ai/new?q=${p}` },
  {
    id: "perplexity",
    name: "Perplexity",
    supportsQuery: true,
    buildUrl: (p) => `https://www.perplexity.ai/search?q=${p}`,
  },
  { id: "grok", name: "Grok", supportsQuery: true, buildUrl: (p) => `https://grok.com/?q=${p}` },
  { id: "duckduckgo", name: "Duck.ai", supportsQuery: true, buildUrl: (p) => `https://duckduckgo.com/?q=${p}&ia=chat` },
  { id: "zai", name: "Z.ai", supportsQuery: true, buildUrl: (p) => `https://chat.z.ai/?q=${p}` },
  { id: "blackbox", name: "Blackbox", supportsQuery: true, buildUrl: (p) => `https://app.blackbox.ai/?q=${p}` },
  { id: "copilot", name: "Copilot", supportsQuery: false, buildUrl: () => "https://copilot.microsoft.com/" },
  { id: "kimi", name: "Kimi", supportsQuery: false, buildUrl: () => "https://www.kimi.com/" },
  { id: "metaai", name: "Meta AI", supportsQuery: false, buildUrl: () => "https://www.meta.ai/" },
  { id: "gemini", name: "Gemini", supportsQuery: false, buildUrl: () => "https://gemini.google.com/app" },
  { id: "deepseek", name: "DeepSeek", supportsQuery: false, buildUrl: () => "https://chat.deepseek.com/" },
  { id: "qwen", name: "Qwen", supportsQuery: false, buildUrl: () => "https://chat.qwen.ai/" },
  { id: "pi", name: "Pi", supportsQuery: false, buildUrl: () => "https://pi.ai/talk" },
];

const PROVIDER_STORAGE_KEY = "preferred-ai-chat";

export function loadPreferredProvider(): AiProvider {
  if (typeof window === "undefined") return AI_PROVIDERS[0];
  const saved = localStorage.getItem(PROVIDER_STORAGE_KEY);
  return AI_PROVIDERS.find((p) => p.id === saved) ?? AI_PROVIDERS[0];
}

export function savePreferredProvider(id: string) {
  localStorage.setItem(PROVIDER_STORAGE_KEY, id);
}

export interface AiMode {
  id: string;
  icon: LucideIcon;
  label: string;
  desc: string;
}

export const AI_MODES: AiMode[] = [
  { id: "bug", icon: Bug, label: "แก้บั๊ค", desc: "วิเคราะห์และหาแนวทางแก้ไขบั๊ค" },
  { id: "feature", icon: Sparkles, label: "เพิ่มฟีเจอร์ใหม่", desc: "ออกแบบและวางแผนการพัฒนาฟีเจอร์" },
  { id: "analyze", icon: ScanSearch, label: "วิเคราะห์", desc: "วิเคราะห์ปัญหาและความต้องการเชิงลึก" },
  { id: "design", icon: Layers, label: "ออกแบบระบบ", desc: "ออกแบบ architecture และ flow" },
  { id: "refactor", icon: Wrench, label: "Refactor โค้ด", desc: "ปรับโครงสร้างโค้ดให้ดีขึ้น" },
  { id: "optimize", icon: Zap, label: "ปรับประสิทธิภาพ", desc: "หาจุดที่ช้าและแนวทางแก้ไข" },
  { id: "test", icon: FlaskConical, label: "เขียน Unit Test", desc: "วางแผนและสร้าง test cases" },
  { id: "docs", icon: BookOpen, label: "เขียน Documentation", desc: "สร้างเอกสารอธิบายการทำงาน" },
];

const TH_INTROS: Record<string, string> = {
  bug: "ฉันมีบั๊คที่ต้องการแก้ไข กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์สาเหตุที่เป็นไปได้ของบั๊ค\n2. เสนอแนวทางแก้ไขพร้อมข้อดีข้อเสียของแต่ละแนวทาง\n3. สร้าง prompt สำหรับ AI coding agent (เช่น Claude, Cursor) เพื่อให้ agent แก้บั๊คนี้ได้เลย โดยระบุบริบท, สิ่งที่คาดหวัง และขั้นตอนให้ครบถ้วน",
  feature:
    "ฉันต้องการเพิ่มฟีเจอร์ใหม่ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ความต้องการและช่วยออกแบบฟีเจอร์นี้ เช่น UI/UX flow, โครงสร้างข้อมูล, edge cases\n2. แนะนำแนวทาง implementation ที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent พัฒนาฟีเจอร์นี้ได้เลย",
  analyze:
    "ฉันต้องการวิเคราะห์งานนี้อย่างละเอียด กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ปัญหาและความต้องการเชิงลึก ระบุ assumptions, constraints และ risks\n2. เสนอแนวทางแก้ไขพร้อมเปรียบเทียบตัวเลือกต่างๆ\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent ดำเนินการต่อได้อย่างถูกต้อง",
  design:
    "ฉันต้องการออกแบบระบบสำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. ออกแบบ architecture, data flow และโครงสร้างระบบที่เหมาะสม\n2. แนะนำ technology stack และ patterns ที่ควรใช้\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent implement ตาม design นี้ได้เลย",
  refactor:
    "ฉันต้องการ refactor โค้ดสำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ปัญหาของโค้ดเดิม เช่น code smell, ความซับซ้อน หรือ maintainability\n2. เสนอแนวทาง refactor พร้อมหลักการที่ใช้\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent refactor โค้ดนี้ได้อย่างปลอดภัย",
  optimize:
    "ฉันต้องการปรับปรุงประสิทธิภาพของงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์จุดที่น่าจะเป็น bottleneck และแนวทางแก้ไข\n2. เสนอ optimization strategies พร้อม trade-offs\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent ทำ optimization นี้ได้เลย",
  test: "ฉันต้องการเขียน unit test สำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์และระบุ test cases สำคัญ ทั้ง happy path, edge cases และ error cases\n2. แนะนำ testing strategy และ tools ที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent เขียน test ได้ครอบคลุม",
  docs: "ฉันต้องการเขียน documentation สำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ว่าควรมีเอกสารส่วนไหนบ้าง เช่น README, API docs, usage examples\n2. เสนอโครงสร้างและเนื้อหาของเอกสารที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent เขียน documentation ได้ครบถ้วน",
};

const EN_INTROS: Record<string, string> = {
  bug: "I have a bug that needs to be fixed. Please do the following:\n1. Analyze possible root causes of the bug\n2. Propose solutions with pros and cons for each approach\n3. Create a prompt for an AI coding agent (e.g. Claude, Cursor) to fix this bug directly, including context, expected outcome, and step-by-step instructions",
  feature:
    "I need to implement a new feature. Please do the following:\n1. Analyze the requirements and help design the feature — UI/UX flow, data structure, edge cases\n2. Recommend a suitable implementation approach\n3. Create a prompt for an AI coding agent to develop this feature directly",
  analyze:
    "I need a deep analysis of this task. Please do the following:\n1. Analyze the problem and requirements in depth — identify assumptions, constraints, and risks\n2. Propose solutions and compare the available options\n3. Create a prompt for an AI coding agent to proceed correctly",
  design:
    "I need to design a system for this task. Please do the following:\n1. Design the architecture, data flow, and system structure\n2. Recommend a suitable technology stack and patterns\n3. Create a prompt for an AI coding agent to implement according to this design",
  refactor:
    "I need to refactor code for this task. Please do the following:\n1. Analyze issues in the existing code — code smells, complexity, maintainability\n2. Propose a refactoring approach with the principles used\n3. Create a prompt for an AI coding agent to safely refactor this code",
  optimize:
    "I need to improve the performance of this task. Please do the following:\n1. Identify likely bottlenecks and how to address them\n2. Propose optimization strategies with trade-offs\n3. Create a prompt for an AI coding agent to perform this optimization",
  test: "I need to write unit tests for this task. Please do the following:\n1. Identify important test cases — happy path, edge cases, and error cases\n2. Recommend a testing strategy and suitable tools\n3. Create a prompt for an AI coding agent to write comprehensive tests",
  docs: "I need to write documentation for this task. Please do the following:\n1. Identify what documentation is needed — README, API docs, usage examples\n2. Propose a structure and content outline\n3. Create a prompt for an AI coding agent to write complete documentation",
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function buildAiPrompt(task: { title?: string; notes?: string }, mode: string, lang: PromptLang): string {
  const title = task.title || "";
  const description = task.notes ? stripHtml(task.notes) : "";
  const intros = lang === "en" ? EN_INTROS : TH_INTROS;
  const intro = intros[mode] ?? intros.analyze;
  const taskSection =
    lang === "en"
      ? description
        ? `Task: ${title}\nDescription: ${description}`
        : `Task: ${title}`
      : description
        ? `ชื่องาน: ${title}\nรายละเอียด: ${description}`
        : `ชื่องาน: ${title}`;
  const closing = lang === "en" ? "Start now." : "เริ่มได้เลย";
  return `${intro}\n\n${taskSection}\n\n${closing}`;
}
