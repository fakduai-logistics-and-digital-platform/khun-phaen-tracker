"use client";

import { useEffect, useRef, useState } from "react";
import { autoUpdate, computePosition, flip, hide, offset, shift } from "@floating-ui/dom";
import { posToDOMRect, type Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Type,
  Unlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type BubbleMenuProps = {
  editor: Editor;
};

type Format = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  blockquote: boolean;
  bulletList: boolean;
  orderedList: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
};

const EMPTY_FORMAT: Format = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  link: false,
  blockquote: false,
  bulletList: false,
  orderedList: false,
  h1: false,
  h2: false,
  h3: false,
};

const PANEL =
  "rounded-lg border border-white/10 bg-[#1c1c1c] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.5),0_4px_6px_-2px_rgba(0,0,0,0.2)]";
const TOOLBAR_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-white/10 hover:text-white";
const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-zinc-400 transition-all hover:bg-white/10 hover:text-white";
const ICON_BUTTON =
  "flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-all hover:bg-white/10 hover:text-white";

function shouldShow(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const { selection } = editor.state;
  if (selection.empty) return false;
  const { from, to } = selection;
  if (!editor.state.doc.textBetween(from, to).trim().length) return false;
  if (selection instanceof NodeSelection) return false;
  return editor.state.doc.resolve(from).parent.type.name !== "codeBlock";
}

function readFormat(editor: Editor): Format {
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    link: editor.isActive("link"),
    blockquote: editor.isActive("blockquote"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    h1: editor.isActive("heading", { level: 1 }),
    h2: editor.isActive("heading", { level: 2 }),
    h3: editor.isActive("heading", { level: 3 }),
  };
}

export function BubbleMenu({ editor }: BubbleMenuProps) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"toolbar" | "link-edit">("toolbar");
  const [url, setUrl] = useState("");
  const [fmt, setFmt] = useState<Format>(EMPTY_FORMAT);
  const [position, setPosition] = useState<{ x: number; y: number; hidden: boolean } | null>(null);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const floatingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onTransaction = () => {
      setVisible(shouldShow(editor));
      setFmt(readFormat(editor));
    };
    const onSelectionUpdate = () => setMode("toolbar");
    const onBlur = () => {
      setTimeout(() => {
        if (editor.isDestroyed) return;
        if (floatingRef.current?.contains(document.activeElement)) return;
        if (editor.view.hasFocus()) return;
        setVisible(false);
      }, 0);
    };

    editor.on("transaction", onTransaction);
    editor.on("selectionUpdate", onSelectionUpdate);
    editor.on("blur", onBlur);
    return () => {
      editor.off("transaction", onTransaction);
      editor.off("selectionUpdate", onSelectionUpdate);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  useEffect(() => {
    const floatingEl = floatingRef.current;
    if (!visible || !floatingEl) {
      setPosition(null);
      return;
    }

    const virtualRef = {
      getBoundingClientRect: () => {
        if (editor.isDestroyed) return new DOMRect();
        const { from, to } = editor.state.selection;
        return posToDOMRect(editor.view, from, to);
      },
      contextElement: editor.view.dom,
    };

    const updatePosition = () => {
      computePosition(virtualRef, floatingEl, {
        strategy: "fixed",
        placement: "top",
        middleware: [offset(8), flip(), shift({ padding: 8 }), hide()],
      }).then(({ x, y, middlewareData }) => {
        setPosition({ x, y, hidden: !!middlewareData.hide?.referenceHidden });
      });
    };

    return autoUpdate(virtualRef, floatingEl, updatePosition);
  }, [visible, editor]);

  function setHeading(level: 1 | 2 | 3 | null) {
    if (level === null) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level }).run();
    }
    setShowHeadingMenu(false);
  }

  function openLinkEdit() {
    setUrl(editor.getAttributes("link").href || "");
    setMode("link-edit");
  }

  function applyLink() {
    let href = url.trim();
    if (href) {
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(href) && !href.startsWith("mailto:")) {
        href = "https://" + href;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setMode("toolbar");
    editor.commands.focus();
  }

  function removeLink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setMode("toolbar");
    editor.commands.focus();
  }

  function cancelLink() {
    setMode("toolbar");
    editor.commands.focus();
  }

  function handleLinkKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      applyLink();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelLink();
    }
  }

  const toolbarButton = (active: boolean) => cn(TOOLBAR_BUTTON, active && "bg-white/15 text-white");
  const menuItem = (active: boolean) => cn(MENU_ITEM, active && "bg-white/5 text-white");
  const headingActive = fmt.h1 || fmt.h2 || fmt.h3;

  return (
    <div
      ref={floatingRef}
      role="toolbar"
      aria-label="Text formatting"
      tabIndex={-1}
      className="fixed z-[1000] w-max"
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: visible && position && !position.hidden ? "visible" : "hidden",
      }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      {mode === "link-edit" ? (
        <div className={cn(PANEL, "flex min-w-60 items-center gap-1 px-2 py-1")}>
          <input
            type="text"

            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="https://..."
            aria-label="Link URL"
            className="h-7 flex-1 border-none bg-transparent text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={applyLink}
            className={cn(ICON_BUTTON, "hover:text-green-500")}
            aria-label="Apply link"
          >
            <Check size={14} />
          </button>
          {fmt.link && (
            <button
              type="button"
              onClick={removeLink}
              className={cn(ICON_BUTTON, "hover:text-red-500")}
              aria-label="Remove link"
            >
              <Unlink size={14} />
            </button>
          )}
          <button type="button" onClick={cancelLink} className={ICON_BUTTON} aria-label="Cancel">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className={cn(PANEL, "flex items-center gap-0.5 p-1")}>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={toolbarButton(fmt.bold)}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={toolbarButton(fmt.italic)}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={toolbarButton(fmt.strike)}
            title="Strikethrough"
            aria-label="Strikethrough"
          >
            <Strikethrough size={14} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={toolbarButton(fmt.code)}
            title="Code (Ctrl+E)"
            aria-label="Code"
          >
            <Code size={14} />
          </button>

          <div className="mx-1 h-4 w-px bg-white/10" />

          <button
            type="button"
            onClick={openLinkEdit}
            className={toolbarButton(fmt.link)}
            title="Link"
            aria-label="Link"
          >
            <Link2 size={14} />
          </button>

          <div className="mx-1 h-4 w-px bg-white/10" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              aria-expanded={showHeadingMenu}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-zinc-400 transition-all hover:bg-white/10 hover:text-white",
                headingActive && "text-white",
              )}
            >
              <span className="text-[11px] font-bold">{fmt.h1 ? "H1" : fmt.h2 ? "H2" : fmt.h3 ? "H3" : "Text"}</span>
              <ChevronDown size={10} />
            </button>
            {showHeadingMenu && (
              <div className={cn(PANEL, "absolute top-[calc(100%+8px)] left-0 min-w-35 p-1")}>
                <button type="button" onClick={() => setHeading(null)} className={menuItem(!headingActive)}>
                  <Type size={14} /> Normal Text
                </button>
                <button type="button" onClick={() => setHeading(1)} className={menuItem(fmt.h1)}>
                  <Heading1 size={14} /> Heading 1
                </button>
                <button type="button" onClick={() => setHeading(2)} className={menuItem(fmt.h2)}>
                  <Heading2 size={14} /> Heading 2
                </button>
                <button type="button" onClick={() => setHeading(3)} className={menuItem(fmt.h3)}>
                  <Heading3 size={14} /> Heading 3
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowListMenu(!showListMenu)}
              aria-expanded={showListMenu}
              aria-label="List"
              className={toolbarButton(fmt.bulletList || fmt.orderedList)}
            >
              <List size={14} />
              <ChevronDown size={10} />
            </button>
            {showListMenu && (
              <div className={cn(PANEL, "absolute top-[calc(100%+8px)] left-0 min-w-35 p-1")}>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().toggleBulletList().run();
                    setShowListMenu(false);
                  }}
                  className={menuItem(fmt.bulletList)}
                >
                  <List size={14} /> Bullet List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().toggleOrderedList().run();
                    setShowListMenu(false);
                  }}
                  className={menuItem(fmt.orderedList)}
                >
                  <ListOrdered size={14} /> Ordered List
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={toolbarButton(fmt.blockquote)}
            title="Quote"
            aria-label="Quote"
          >
            <Quote size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
