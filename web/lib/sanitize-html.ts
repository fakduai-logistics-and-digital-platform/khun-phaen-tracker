const BLOCKED_TAGS = "script,style,iframe,object,embed,link,meta,base,form";
const URL_ATTRS = new Set(["href", "src", "xlink:href", "action", "formaction"]);

/** Strips scripts, embeds, inline handlers and javascript: URLs from rendered markdown/HTML. Browser only. */
export function sanitizeHtml(html: string): string {
  // No DOM during server rendering: emit nothing and let the client render the real content.
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(BLOCKED_TAGS).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.replace(/\s+/g, "").toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || (URL_ATTRS.has(name) && value.startsWith("javascript:"))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return doc.body.innerHTML;
}
