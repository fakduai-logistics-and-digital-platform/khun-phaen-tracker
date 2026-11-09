import type { TestCase } from "./tc-types";

export const TEMPLATE_HEADERS = [
  "Project",
  "Suite",
  "Test Case No",
  "Test Name",
  "Status",
  "Assign Tester",
  "Assign Dev",
  "Precondition",
  "Input",
  "Expected Result",
  "Actual Result",
  "Test Step",
];

const TEMPLATE_ROWS = [
  [
    "",
    "Authentication",
    "1",
    "Sample Login",
    "draft",
    "unassigned",
    "unassigned",
    "User is on login page",
    "email@example.com, password123",
    "User redirected to dashboard",
    "User redirected to dashboard",
    "Enter email\nEnter password\nClick login",
  ],
];

export const EXPORT_HEADERS = [
  "Project",
  "Suite",
  "Test Case No",
  "Test Name",
  "Status",
  "Assign Tester",
  "Tester Position",
  "Assign Dev",
  "Dev Position",
  "Precondition",
  "Input",
  "Expected Result",
  "Actual Result",
  "Test Step",
];

export function toCsv(headers: string[], rows: string[][]) {
  let csv = headers.join(",") + "\n";
  rows.forEach((row) => {
    csv += row.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(",") + "\n";
  });
  return csv;
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadTemplate() {
  downloadCsv(toCsv(TEMPLATE_HEADERS, TEMPLATE_ROWS), "test_case_template.csv");
}

export function stepsToText(c: TestCase) {
  if (c.step_format === "gherkin") {
    return (c.gherkin_steps || []).map((s) => `${s.keyword} ${s.text}`).join("\n");
  }
  return (c.classic_steps || c.steps || []).map((s) => s.action).join("\n");
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\n" && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((field) => field.trim().length > 0));
}
