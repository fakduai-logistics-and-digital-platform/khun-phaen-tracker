"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { initDB } from "@/lib/db";
import { useStore } from "@/lib/store";
import { destroyNotifications, initNotifications } from "@/lib/stores/notifications";
import { createUIActions, modals, type ModalName } from "@/lib/stores/uiActions";
import { ApiTester } from "./api-tester";
import { BookmarkManager } from "./bookmark-manager";
import { CsvJsonViewer } from "./csv-json-viewer";
import { DiffChecker } from "./diff-checker";
import { EncoderDecoder } from "./encoder-decoder";
import { HtmlPreview } from "./html-preview";
import { JsonYamlConverter } from "./json-yaml-converter";
import { QuickNotes } from "./quick-notes";
import { RegexTester } from "./regex-tester";
import { WhiteboardModal } from "./whiteboard-modal";

const ui = createUIActions();

const UTILITY_EVENT_TARGETS: Record<string, ModalName> = {
  bookmark: "bookmarkManager",
  whiteboard: "whiteboard",
  "quick-notes": "quickNotes",
};

/**
 * Mounts the developer-tool modals (opened through the shared `modals` store), initialises the local
 * database and notifications, and listens for `open-utility-modal` events. Render it once, inside the
 * authenticated layout.
 */
export function DevToolsHost() {
  const open = useStore(modals);

  useEffect(() => {
    let cancelled = false;
    initDB()
      .then(() => {
        if (!cancelled) initNotifications();
      })
      .catch((error) => console.error("Failed to initialise local database:", error));

    const onOpenUtility = (event: Event) => {
      const kind = (event as CustomEvent<{ kind?: string }>).detail?.kind;
      const target = kind ? UTILITY_EVENT_TARGETS[kind] : undefined;
      if (target) ui.openModal(target);
    };
    document.addEventListener("open-utility-modal", onOpenUtility);

    return () => {
      cancelled = true;
      destroyNotifications();
      document.removeEventListener("open-utility-modal", onOpenUtility);
    };
  }, []);

  const close = (name: ModalName) => () => ui.closeModal(name);

  return (
    <>
      {open.bookmarkManager && <BookmarkManager onClose={close("bookmarkManager")} />}
      {open.quickNotes && <QuickNotes onClose={close("quickNotes")} />}
      {open.htmlPreview && <HtmlPreview onClose={close("htmlPreview")} />}
      {open.regexTester && <RegexTester onClose={close("regexTester")} />}
      {open.jsonYamlConverter && <JsonYamlConverter onClose={close("jsonYamlConverter")} />}
      {open.apiTester && <ApiTester onClose={close("apiTester")} />}
      {open.diffChecker && <DiffChecker onClose={close("diffChecker")} />}
      {open.csvJsonViewer && <CsvJsonViewer onClose={close("csvJsonViewer")} />}
      {open.encoderDecoder && <EncoderDecoder onClose={close("encoderDecoder")} />}
      {open.whiteboard && (
        <WhiteboardModal
          onClose={close("whiteboard")}
          onNotify={({ message, type }) => (type === "error" ? toast.error(message) : toast.success(message))}
        />
      )}
    </>
  );
}
