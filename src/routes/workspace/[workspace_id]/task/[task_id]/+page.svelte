<script lang="ts">
  import { onMount, tick, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";
  import { goto, afterNavigate } from "$app/navigation";
  import { base } from "$app/paths";
  import { _ } from "svelte-i18n";
  import { marked } from "marked";
  import {
    getTaskById,
    getTaskComments,
    createTaskComment,
    deleteTaskComment,
    updateTask,
    getProjectsList,
    getAssignees,
    getSprints,
    deleteTask,
  } from "$lib/db";
  import { api, API_BASE_URL } from "$lib/apis";
  import type {
    Task,
    TaskComment,
    Assignee,
    Project,
    Sprint,
    ChecklistItem,
  } from "$lib/types";
  import { TASK_TYPES, type TaskType } from "$lib/utils/branch-name";
  import { get } from "svelte/store";
  import { isImage, processFilesForPreview, revokePreview } from "$lib/utils/file";
  import { user } from "$lib/stores/auth";
  import {
    currentWorkspaceName,
    currentWorkspaceShortName,
    setWorkspaceId,
    currentWorkspaceId,
    MY_TASKS_WORKSPACE_ID,
  } from "$lib/stores/workspace";
  import { modals } from "$lib/stores/uiActions";
  import { connectRealtime } from "$lib/stores/realtime";
  import {
    MoreHorizontal,
    PanelRight,
    CircleCheck,
    Pin,
    PinOff,
    Calendar,
    Clock,
    User,
    Folder,
    Tag,
    MessageCircle,
    Send,
    Plus,
    ChevronDown,
    ChevronRight,
    ArrowLeft,
    CheckCircle2,
    Layout,
    Circle,
    CircleDashed,
    CircleDot,
    XCircle,
    SignalHigh,
    SignalMedium,
    SignalLow,
    Ban,
    GitBranch,
    Bot,
    Bug,
    Sparkles,
    ScanSearch,
    Layers,
    Wrench,
    Zap,
    FlaskConical,
    BookOpen,
    Copy,
    Check,
    Trash2,
    AlertTriangle,
    FileText,
    Image as ImageIcon,
    ZoomIn,
    ZoomOut,
    Maximize2,
    RotateCw,
    RotateCcw,
    Download,
    ExternalLink,
    X,
    ChevronLeft,
    FileCheck,
  } from "lucide-svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import BranchDialog from "$lib/components/BranchDialog.svelte";
  import PriorityBadge from "$lib/components/PriorityBadge.svelte";
  import RichTextEditor from "$lib/components/editor/RichTextEditor.svelte";
  import TitleEditor from "$lib/components/editor/TitleEditor.svelte";
  import ChecklistManager from "$lib/components/ChecklistManager.svelte";
  import LinkPreview from "$lib/components/LinkPreview.svelte";
  import SearchableSelect from "$lib/components/SearchableSelect.svelte";
  import PrioritySelector from "$lib/components/PrioritySelector.svelte";
  import CustomDatePicker from "$lib/components/CustomDatePicker.svelte";
  import { showMessage } from "$lib/stores/uiActions";

  let taskId = "";
  let workspaceId = "";
  let task: Task | null = null;
  let loading = true;
  let error = "";

  let comments: TaskComment[] = [];
  let commentsLoading = false;
  let commentContent = "";
  let replyContent: Record<string, string> = {};
  let collapsedComments: Record<string, boolean> = {};
  let openCommentMenuId = "";
  let commentTextareaRef: HTMLTextAreaElement | undefined;
  let commentFileInputRef: HTMLInputElement | undefined;
  let commentRows = 3;
  let attachedFiles: { file: File, preview?: string }[] = [];

  let lightboxImages: { src: string; alt: string }[] = [];
  let lightboxSrc = "";
  let lightboxAlt = "";
  let lightboxOpen = false;
  let lightboxZoom = 1;
  let lightboxX = 0;
  let lightboxY = 0;
  let lightboxRotation = 0;
  let lightboxIndex = 0;
  let isLightboxDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartOffsetX = 0;
  let dragStartOffsetY = 0;
  let lightboxCopyFeedback = "";

  let sidebarOpen = true;
  let isEditingTitle = false;
  let editedTitle = "";
  let titleInputRef: any;
  
  onDestroy(() => {
    attachedFiles.forEach(af => revokePreview(af.preview));
  });

  let projects: Project[] = [];
  let assignees: Assignee[] = [];
  let sprints: Sprint[] = [];

  let editedDescription = "";
  let isEditingDescription = false;
  $: currentProject = projects.find(p => p.name === task?.project);
  $: projectShortName = currentProject?.short_name || "";

  let isBranchDialogOpen = false;

  function openBranchDialog() {
    isBranchDialogOpen = true;
  }

  function closeBranchDialog() {
    isBranchDialogOpen = false;
  }

  let isMoreMenuOpen = false;
  let isDeleteConfirm = false;
  let isChatGPTMenuOpen = false;
  let isChatGPTModalOpen = false;
  let isProviderMenuOpen = false;
  let chatGPTPromptDraft = "";
  let chatGPTPromptLabel = "";
  let chatGPTLang: "th" | "en" = "th";
  let chatGPTSelectedMode = "";
  let isCopied = false;

  async function copyPrompt() {
    await navigator.clipboard.writeText(chatGPTPromptDraft);
    isCopied = true;
    setTimeout(() => (isCopied = false), 2000);
  }

  const aiProviders = [
    { id: "chatgpt",   name: "ChatGPT",    supportsQuery: true,  buildUrl: (p: string) => `https://chatgpt.com/?q=${p}` },
    { id: "claude",    name: "Claude",     supportsQuery: true,  buildUrl: (p: string) => `https://claude.ai/new?q=${p}` },
    { id: "perplexity",name: "Perplexity", supportsQuery: true,  buildUrl: (p: string) => `https://www.perplexity.ai/search?q=${p}` },
    { id: "grok",      name: "Grok",       supportsQuery: true,  buildUrl: (p: string) => `https://grok.com/?q=${p}` },
    { id: "duckduckgo",name: "Duck.ai",    supportsQuery: true,  buildUrl: (p: string) => `https://duckduckgo.com/?q=${p}&ia=chat` },
    { id: "zai",       name: "Z.ai",       supportsQuery: true,  buildUrl: (p: string) => `https://chat.z.ai/?q=${p}` },
    { id: "blackbox",  name: "Blackbox",   supportsQuery: true,  buildUrl: (p: string) => `https://app.blackbox.ai/?q=${p}` },
    { id: "copilot",   name: "Copilot",    supportsQuery: false, buildUrl: () => `https://copilot.microsoft.com/` },
    { id: "kimi",      name: "Kimi",       supportsQuery: false, buildUrl: () => `https://www.kimi.com/` },
    { id: "metaai",    name: "Meta AI",    supportsQuery: false, buildUrl: () => `https://www.meta.ai/` },
    { id: "gemini",    name: "Gemini",     supportsQuery: false, buildUrl: () => `https://gemini.google.com/app` },
    { id: "deepseek",  name: "DeepSeek",   supportsQuery: false, buildUrl: () => `https://chat.deepseek.com/` },
    { id: "qwen",      name: "Qwen",       supportsQuery: false, buildUrl: () => `https://chat.qwen.ai/` },
    { id: "pi",        name: "Pi",         supportsQuery: false, buildUrl: () => `https://pi.ai/talk` },
  ];

  const PROVIDER_STORAGE_KEY = "preferred-ai-chat";

  function loadPreferredProvider() {
    if (!browser) return aiProviders[0];
    const saved = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return aiProviders.find(p => p.id === saved) ?? aiProviders[0];
  }

  let selectedProvider = loadPreferredProvider();

  function selectProvider(provider: typeof aiProviders[number]) {
    selectedProvider = provider;
    isProviderMenuOpen = false;
    if (browser) localStorage.setItem(PROVIDER_STORAGE_KEY, provider.id);
  }

  const chatGPTModes = [
    { id: "bug",      icon: Bug,          label: "แก้บั๊ค",           desc: "วิเคราะห์และหาแนวทางแก้ไขบั๊ค" },
    { id: "feature",  icon: Sparkles,     label: "เพิ่มฟีเจอร์ใหม่",   desc: "ออกแบบและวางแผนการพัฒนาฟีเจอร์" },
    { id: "analyze",  icon: ScanSearch,   label: "วิเคราะห์",           desc: "วิเคราะห์ปัญหาและความต้องการเชิงลึก" },
    { id: "design",   icon: Layers,       label: "ออกแบบระบบ",          desc: "ออกแบบ architecture และ flow" },
    { id: "refactor", icon: Wrench,       label: "Refactor โค้ด",       desc: "ปรับโครงสร้างโค้ดให้ดีขึ้น" },
    { id: "optimize", icon: Zap,          label: "ปรับประสิทธิภาพ",     desc: "หาจุดที่ช้าและแนวทางแก้ไข" },
    { id: "test",     icon: FlaskConical, label: "เขียน Unit Test",     desc: "วางแผนและสร้าง test cases" },
    { id: "docs",     icon: BookOpen,     label: "เขียน Documentation", desc: "สร้างเอกสารอธิบายการทำงาน" },
  ];
  let mounted = false;
  let loadedTaskKey = "";
  let workspaceShortNameFallback = "";

  $: taskId = $page.params.task_id || "";
  $: workspaceId = $page.params.workspace_id || "";
  $: routeTaskKey = workspaceId && taskId ? `${workspaceId}:${taskId}` : "";

  function toggleMoreMenu() {
    isMoreMenuOpen = !isMoreMenuOpen;
    if (!isMoreMenuOpen) isDeleteConfirm = false;
  }

  function handleMoreMenuClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Don't close anything if clicking inside the confirmation modal
    if (target.closest(".confirm-modal-content")) return;

    if (!target.closest(".more-menu-container")) {
      isMoreMenuOpen = false;
      // Only reset isDeleteConfirm if we are NOT clicking the backdrop of the modal
      // (The backdrop is the parent of .confirm-modal-content)
      const isBackdrop = target.classList.contains("bg-slate-950/50") || target.classList.contains("bg-slate-950/80");
      if (!isBackdrop) {
        isDeleteConfirm = false;
      }
    }
    if (!target.closest(".chatgpt-menu-container")) {
      isChatGPTMenuOpen = false;
    }
    if (!target.closest(".provider-menu-container")) {
      isProviderMenuOpen = false;
    }
  }

  async function handleDeleteTask() {
    if (!task) return;
    const tid = task.id;
    if (tid == null) return;
    try {
      await deleteTask(tid);
      goBack();
    } catch (e) {
      console.error("Delete task failed", e);
    }
  }

  $: workspaceRoom = $page.url.searchParams.get("room");

  let isPinned = false;

  afterNavigate(() => {
    if (workspaceId && get(currentWorkspaceId) !== workspaceId) {
      currentWorkspaceId.set(workspaceId);
    }
    if (routeTaskKey && routeTaskKey !== loadedTaskKey) {
      loadedTaskKey = routeTaskKey;
      void loadRouteTask(routeTaskKey, taskId);
    }
  });

  onMount(() => {
    const roomCode =
      $page.url.searchParams.get("room") ||
      (browser ? localStorage.getItem("sync-room-code") : null);
    if (roomCode && workspaceId !== MY_TASKS_WORKSPACE_ID) {
      connectRealtime(roomCode, (payload) => {
        if (
          payload.entity === "task" &&
          String(payload.id || payload.data?.id || "") === String(taskId)
        ) {
          void loadRouteTask(routeTaskKey, taskId, workspaceId);
        }
      });
    }

    // Hard refresh fallback — afterNavigate may not fire if the page was loaded fresh
    const tid = $page.params.task_id || "";
    const wid = $page.params.workspace_id || "";
    const key = wid && tid ? `${wid}:${tid}` : "";
    if (key && key !== loadedTaskKey) {
      loadedTaskKey = key;
      void loadRouteTask(key, tid, wid);
    }
  });

  function syncWorkspaceFromTask(sourceTask: Task) {
    if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID) return;

    setWorkspaceId(
      workspaceId,
      sourceTask.workspace_name || undefined,
      undefined,
      sourceTask.workspace_color,
      sourceTask.workspace_icon,
      sourceTask.workspace_short_name,
    );
  }

  async function handleKeydown(e: KeyboardEvent) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement).isContentEditable
    ) {
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      await goto(`${base}/workspace/${workspaceId}`);
      modals.update((m) => ({ ...m, commandPalette: true }));
    } else if (e.key.toLowerCase() === "n") {
      if (workspaceId === MY_TASKS_WORKSPACE_ID) return;
      e.preventDefault();
      await goto(`${base}/workspace/${workspaceId}`);
      modals.update((m) => ({ ...m, form: true }));
    }
  }

  function updatePinnedState() {
    if (!browser) return;
    try {
      const pinnedTasks = JSON.parse(
        localStorage.getItem("pinned-tasks") || "[]",
      );
      isPinned = !!pinnedTasks.find(
        (t: any) => t === taskId || t.id === taskId,
      );
    } catch {
      isPinned = false;
    }
  }

  async function loadRouteTask(
    routeKey: string,
    id: string,
    wsIdOverride?: string,
  ) {
    updatePinnedState();
    Promise.all([
      loadTaskData(routeKey, id, wsIdOverride),
      loadMetadata(),
    ]).catch(console.error);
  }

  async function resolveWorkspaceShortName(sourceTask: Task) {
    const existingShortName =
      sourceTask.workspace_short_name ||
      currentProject?.short_name ||
      get(currentWorkspaceShortName) ||
      workspaceShortNameFallback;
    if (existingShortName) return existingShortName;
    if (!workspaceId || workspaceId === MY_TASKS_WORKSPACE_ID) return "";

    try {
      const res = await api.workspaces.getList();
      if (!res.ok) return "";
      const data = await res.json();
      const workspace = (data.workspaces || []).find(
        (ws: any) => String(ws.id) === String(workspaceId),
      );
      workspaceShortNameFallback = workspace?.short_name || "";
      return workspaceShortNameFallback;
    } catch {
      return "";
    }
  }

  function buildPinnedTaskMeta(sourceTask: Task, workspaceShortName = "") {
    return {
      id: String(sourceTask.id || taskId),
      title: sourceTask.title || "",
      short_name:
        workspaceShortName ||
        sourceTask.workspace_short_name ||
        get(currentWorkspaceShortName) ||
        workspaceShortNameFallback ||
        "",
      task_number: sourceTask.task_number || "",
      workspace_id: workspaceId || sourceTask.workspace_id || "",
    };
  }

  async function syncPinnedTaskMeta(sourceTask: Task) {
    if (!browser || !sourceTask.id) return;
    const sourceTaskId = String(sourceTask.id);
    let pinnedTasks: any[] = JSON.parse(
      localStorage.getItem("pinned-tasks") || "[]",
    );
    const existingIndex = pinnedTasks.findIndex(
      (t: any) => String(t?.id || t) === sourceTaskId,
    );
    if (existingIndex === -1) return;
    const workspaceShortName = await resolveWorkspaceShortName(sourceTask);

    pinnedTasks[existingIndex] = {
      ...(typeof pinnedTasks[existingIndex] === "object"
        ? pinnedTasks[existingIndex]
        : {}),
      ...buildPinnedTaskMeta(sourceTask, workspaceShortName),
    };
    localStorage.setItem("pinned-tasks", JSON.stringify(pinnedTasks));
    window.dispatchEvent(new CustomEvent("pinnedTasksChanged"));
  }

  async function togglePin() {
    if (!task || String(task.id || "") !== String(taskId)) return;

    isPinned = !isPinned;
    let pinnedTasks: any[] = JSON.parse(
      localStorage.getItem("pinned-tasks") || "[]",
    );
    const workspaceShortName = await resolveWorkspaceShortName(task);
    const pinnedTaskMeta = buildPinnedTaskMeta(task, workspaceShortName);

    if (isPinned) {
      const existingIndex = pinnedTasks.findIndex(
        (t: any) => String(t?.id || t) === String(pinnedTaskMeta.id),
      );
      if (existingIndex === -1) {
        // Add to the top
        pinnedTasks.unshift(pinnedTaskMeta);
        // Limit to 5
        if (pinnedTasks.length > 5) {
          pinnedTasks = pinnedTasks.slice(0, 5);
        }
      } else {
        pinnedTasks[existingIndex] = {
          ...(typeof pinnedTasks[existingIndex] === "object"
            ? pinnedTasks[existingIndex]
            : {}),
          ...pinnedTaskMeta,
        };
      }
    } else {
      pinnedTasks = pinnedTasks.filter(
        (t: any) => String(t?.id || t) !== String(pinnedTaskMeta.id),
      );
    }
    localStorage.setItem("pinned-tasks", JSON.stringify(pinnedTasks));
    window.dispatchEvent(new CustomEvent("pinnedTasksChanged"));
  }

  async function loadTaskData(
    routeKey = routeTaskKey,
    id = taskId,
    wsIdOverride?: string,
  ) {
    loading = true;
    error = "";
    task = null;
    comments = [];
    try {
      if (!id) return;
      const result = await getTaskById(id, wsIdOverride || workspaceId);
      if (routeKey !== routeTaskKey) return;
      if (result) {
        task = result;
        syncWorkspaceFromTask(result);
        editedTitle = task.title;
        editedDescription = task.notes || "";
        await resolveWorkspaceShortName(result);
        await syncPinnedTaskMeta(result);
        await loadComments(result.id, routeKey);
      } else {
        error = $_("taskList__no_tasks");
      }
    } catch (e) {
      error = $_("page__load_data_error");
    } finally {
      if (routeKey === routeTaskKey) {
        loading = false;
      }
    }
  }

  async function loadMetadata() {
    try {
      const [projList, assList, sprintList] = await Promise.all([
        getProjectsList(),
        getAssignees(true),
        getSprints(),
      ]);
      projects = projList;
      assignees = assList;
      sprints = sprintList;
    } catch (e) {
      console.error("Failed to load metadata:", e);
    }
  }

  async function loadComments(
    commentTaskId = task?.id,
    routeKey = routeTaskKey,
  ) {
    if (!commentTaskId) return;
    commentsLoading = true;
    try {
      const response = await getTaskComments(commentTaskId, {
        page: 1,
        limit: 50,
      });
      if (routeKey === routeTaskKey) {
        comments = response.comments;
      }
    } catch (e) {
      console.error("Failed to load comments:", e);
    } finally {
      if (routeKey === routeTaskKey) {
        commentsLoading = false;
      }
    }
  }

  async function handleUpdateTask(updates: Partial<Task>) {
    if (!task?.id) return;
    try {
      // Explicitly include workspace_id to ensure correct API routing
      const updated = await updateTask(task.id, {
        workspace_id: task.workspace_id || workspaceId,
        ...updates,
      });

      if (updated) {
        task = { ...task, ...updated };
        showMessage($_("page__update_task_success"), "success");
      }
    } catch (e) {
      console.error("Failed to update task:", e);
      showMessage($_("page__error"), "error");
    }
  }

  async function saveTitle() {
    if (!task || !editedTitle.trim() || editedTitle === task.title) {
      isEditingTitle = false;
      editedTitle = task?.title || "";
      return;
    }
    await handleUpdateTask({ title: editedTitle.trim() });
    isEditingTitle = false;
  }

  function getCommentImageUrl(fileKey: string): string {
    return `${API_BASE_URL.replace(/\/api$/, "")}/api/files/${fileKey}`;
  }

  async function handleCommentSubmit() {
    if (!task?.id || (!commentContent.trim() && attachedFiles.length === 0)) return;
    try {
      const files = attachedFiles.map(af => af.file);
      await createTaskComment(task.id, { 
        content: commentContent.trim(),
        files
      });
      
      // Cleanup previews
      attachedFiles.forEach(af => revokePreview(af.preview));
      
      commentContent = "";
      attachedFiles = [];
      await loadComments();
    } catch (e) {
      showMessage($_("taskForm__comments_error_submit"), "error");
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      const newFiles = processFilesForPreview(files);
      attachedFiles = [...attachedFiles, ...newFiles];
    }
  }

  async function handleDeleteComment(commentId: string) {
    const tid = task?.id;
    if (!tid || !commentId) return;
    try {
      await deleteTaskComment(tid, commentId);
      comments = comments.filter(c => c.id !== commentId);
      openCommentMenuId = "";
    } catch (e) {
      showMessage($_("page__error"), "error");
    }
  }

  function openLightbox(images: { file_key: string; filename?: string }[], index: number) {
    lightboxImages = images.map(img => ({
      src: getCommentImageUrl(img.file_key),
      alt: img.filename || "Image",
    }));
    lightboxIndex = Math.min(Math.max(index, 0), lightboxImages.length - 1);
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    lightboxZoom = 1;
    lightboxX = 0;
    lightboxY = 0;
    lightboxRotation = 0;
    lightboxCopyFeedback = "";
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
    isLightboxDragging = false;
  }

  function lbZoomIn() { lightboxZoom = Math.min(lightboxZoom + 0.25, 5); }
  function lbZoomOut() { lightboxZoom = Math.max(lightboxZoom - 0.25, 0.25); }
  function lbResetView() { lightboxZoom = 1; lightboxX = 0; lightboxY = 0; lightboxRotation = 0; }
  function lbRotateRight() { lightboxRotation = (lightboxRotation + 90) % 360; }

  function lbFitToScreen() {
    lightboxX = 0;
    lightboxY = 0;
    const img = new window.Image();
    img.onload = () => { lightboxZoom = Math.min((window.innerHeight * 0.9) / img.naturalHeight, 5); };
    img.src = lightboxSrc;
  }

  function lbNavigatePrev() {
    if (lightboxImages.length <= 1) return;
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    lbResetView();
  }

  function lbNavigateNext() {
    if (lightboxImages.length <= 1) return;
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    lbResetView();
  }

  function lbOpenInNewTab() { window.open(lightboxSrc, "_blank", "noopener,noreferrer"); }

  async function lbCopyToClipboard() {
    try {
      const res = await fetch(lightboxSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      lightboxCopyFeedback = "Copied!";
      setTimeout(() => (lightboxCopyFeedback = ""), 2000);
    } catch {
      lightboxCopyFeedback = "Failed";
      setTimeout(() => (lightboxCopyFeedback = ""), 2000);
    }
  }

  async function lbDownload() {
    try {
      const a = document.createElement("a");
      const res = await fetch(lightboxSrc);
      const blob = await res.blob();
      a.href = URL.createObjectURL(blob);
      a.download = (lightboxAlt && lightboxAlt !== "Image" ? lightboxAlt : "image") + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {}
  }

  function handleLightboxWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.deltaY < 0) lbZoomIn(); else lbZoomOut();
  }

  function handleLightboxMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;
    isLightboxDragging = true;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartOffsetX = lightboxX;
    dragStartOffsetY = lightboxY;
  }

  function handleLightboxMouseMove(event: MouseEvent) {
    if (!isLightboxDragging) return;
    lightboxX = dragStartOffsetX + (event.clientX - dragStartX);
    lightboxY = dragStartOffsetY + (event.clientY - dragStartY);
  }

  function handleLightboxMouseUp() { isLightboxDragging = false; }

  function handleLightboxKeydown(event: KeyboardEvent) {
    if (!lightboxOpen) return;
    switch (event.key) {
      case "Escape": closeLightbox(); break;
      case "+": case "=": lbZoomIn(); break;
      case "-": lbZoomOut(); break;
      case "0": lbResetView(); break;
      case "r": case "R": lbRotateRight(); break;
      case "f": case "F": lbFitToScreen(); break;
      case "ArrowLeft": lbNavigatePrev(); break;
      case "ArrowRight": lbNavigateNext(); break;
      case "c": case "C":
        if (!event.metaKey && !event.ctrlKey) void lbCopyToClipboard();
        break;
    }
  }

  function formatCommentAuthor(comment: TaskComment): string {
    if (comment.created_by_name) return comment.created_by_name;
    const uid = $user?.id || $user?.user_id;
    if (uid && comment.created_by === uid) {
      const profile = $user?.profile;
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
      return profile?.nickname || fullName || $user?.email?.split("@")[0] || "Unknown";
    }
    const matched = assignees.find(a => a.user_id && a.user_id === comment.created_by);
    if (matched) return matched.name;
    return comment.created_by || "Unknown";
  }

  function formatRelativeTime(dateStr?: string) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return $_("taskForm__comments_time_just_now");
    if (diffMin < 60)
      return $_("taskForm__comments_time_min_ago", {
        values: { count: diffMin },
      });
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
      return $_("taskForm__comments_time_hour_ago", {
        values: { count: diffHr },
      });
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)
      return $_("taskForm__comments_time_day_ago", {
        values: { count: diffDay },
      });
    return date.toLocaleDateString();
  }

  function goBack() {
    const roomParam = workspaceRoom ? `?room=${workspaceRoom}` : "";
    goto(`${base}/workspace/${workspaceId}${roomParam}`);
  }

  const statusOptions = [
    {
      value: "pending",
      label: $_("taskForm__status_pending"),
      icon: CircleDashed,
      iconClass: "text-gray-500",
    },
    {
      value: "todo",
      label: $_("taskForm__status_todo"),
      icon: Circle,
      iconClass: "text-gray-400",
    },
    {
      value: "in-progress",
      label: $_("taskForm__status_in_progress"),
      icon: CircleDot,
      iconClass: "text-yellow-500",
    },
    {
      value: "in-test",
      label: $_("taskForm__status_in_test"),
      icon: CircleDot,
      iconClass: "text-green-500",
    },
    {
      value: "done",
      label: $_("taskForm__status_done"),
      icon: CheckCircle2,
      iconClass: "text-blue-500",
    },
  ];

  function getStatusLabel(status: string) {
    return statusOptions.find((o) => o.value === status)?.label || status;
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "pending":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      case "todo":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "in-progress":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "in-test":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "done":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  }

  function handleChecklistUpdate(
    event: CustomEvent<{ checklist: ChecklistItem[] }>,
  ) {
    void handleUpdateTask({ checklist: event.detail.checklist });
  }

  let newLinkInput = "";

  function linkifyComment(text: string): string {
    const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(urlRegex, (url) => {
        const display = url.length > 60 ? url.slice(0, 57) + "…" : url;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:opacity-80 break-all">${display}</a>`;
      });
  }

  function addLink() {
    const url = newLinkInput.trim();
    if (!url || !task) return;
    const updated = [...(task.links || []), url];
    newLinkInput = "";
    void handleUpdateTask({ links: updated });
  }

  function removeLink(url: string) {
    if (!task) return;
    const updated = (task.links || []).filter((l) => l !== url);
    void handleUpdateTask({ links: updated });
  }

  function handleDescriptionChange(value: string) {
    editedDescription = value;
  }

  async function saveDescription() {
    if (!task) return;
    await handleUpdateTask({ notes: editedDescription });
    isEditingDescription = false;
  }

  function cancelDescription() {
    if (task) {
      editedDescription = task.notes || "";
    }
    isEditingDescription = false;
  }

  function startEditingDescription() {
    isEditingDescription = true;
  }

  function renderMarkdown(markdown: string): string {
    if (!markdown) return "";
    try {
      return marked.parse(markdown, { breaks: true, gfm: true }) as string;
    } catch {
      return markdown;
    }
  }

  function buildChatGPTPrompt(mode: string, lang: "th" | "en"): string {
    if (!task) return "";
    const title = task.title || "";
    const description = task.notes
      ? task.notes.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
      : "";

    const th: Record<string, string> = {
      bug:      `ฉันมีบั๊คที่ต้องการแก้ไข กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์สาเหตุที่เป็นไปได้ของบั๊ค\n2. เสนอแนวทางแก้ไขพร้อมข้อดีข้อเสียของแต่ละแนวทาง\n3. สร้าง prompt สำหรับ AI coding agent (เช่น Claude, Cursor) เพื่อให้ agent แก้บั๊คนี้ได้เลย โดยระบุบริบท, สิ่งที่คาดหวัง และขั้นตอนให้ครบถ้วน`,
      feature:  `ฉันต้องการเพิ่มฟีเจอร์ใหม่ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ความต้องการและช่วยออกแบบฟีเจอร์นี้ เช่น UI/UX flow, โครงสร้างข้อมูล, edge cases\n2. แนะนำแนวทาง implementation ที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent พัฒนาฟีเจอร์นี้ได้เลย`,
      analyze:  `ฉันต้องการวิเคราะห์งานนี้อย่างละเอียด กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ปัญหาและความต้องการเชิงลึก ระบุ assumptions, constraints และ risks\n2. เสนอแนวทางแก้ไขพร้อมเปรียบเทียบตัวเลือกต่างๆ\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent ดำเนินการต่อได้อย่างถูกต้อง`,
      design:   `ฉันต้องการออกแบบระบบสำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. ออกแบบ architecture, data flow และโครงสร้างระบบที่เหมาะสม\n2. แนะนำ technology stack และ patterns ที่ควรใช้\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent implement ตาม design นี้ได้เลย`,
      refactor: `ฉันต้องการ refactor โค้ดสำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ปัญหาของโค้ดเดิม เช่น code smell, ความซับซ้อน หรือ maintainability\n2. เสนอแนวทาง refactor พร้อมหลักการที่ใช้\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent refactor โค้ดนี้ได้อย่างปลอดภัย`,
      optimize: `ฉันต้องการปรับปรุงประสิทธิภาพของงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์จุดที่น่าจะเป็น bottleneck และแนวทางแก้ไข\n2. เสนอ optimization strategies พร้อม trade-offs\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent ทำ optimization นี้ได้เลย`,
      test:     `ฉันต้องการเขียน unit test สำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์และระบุ test cases สำคัญ ทั้ง happy path, edge cases และ error cases\n2. แนะนำ testing strategy และ tools ที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent เขียน test ได้ครอบคลุม`,
      docs:     `ฉันต้องการเขียน documentation สำหรับงานนี้ กรุณาทำสิ่งต่อไปนี้:\n1. วิเคราะห์ว่าควรมีเอกสารส่วนไหนบ้าง เช่น README, API docs, usage examples\n2. เสนอโครงสร้างและเนื้อหาของเอกสารที่เหมาะสม\n3. สร้าง prompt สำหรับ AI coding agent เพื่อให้ agent เขียน documentation ได้ครบถ้วน`,
    };

    const en: Record<string, string> = {
      bug:      `I have a bug that needs to be fixed. Please do the following:\n1. Analyze possible root causes of the bug\n2. Propose solutions with pros and cons for each approach\n3. Create a prompt for an AI coding agent (e.g. Claude, Cursor) to fix this bug directly, including context, expected outcome, and step-by-step instructions`,
      feature:  `I need to implement a new feature. Please do the following:\n1. Analyze the requirements and help design the feature — UI/UX flow, data structure, edge cases\n2. Recommend a suitable implementation approach\n3. Create a prompt for an AI coding agent to develop this feature directly`,
      analyze:  `I need a deep analysis of this task. Please do the following:\n1. Analyze the problem and requirements in depth — identify assumptions, constraints, and risks\n2. Propose solutions and compare the available options\n3. Create a prompt for an AI coding agent to proceed correctly`,
      design:   `I need to design a system for this task. Please do the following:\n1. Design the architecture, data flow, and system structure\n2. Recommend a suitable technology stack and patterns\n3. Create a prompt for an AI coding agent to implement according to this design`,
      refactor: `I need to refactor code for this task. Please do the following:\n1. Analyze issues in the existing code — code smells, complexity, maintainability\n2. Propose a refactoring approach with the principles used\n3. Create a prompt for an AI coding agent to safely refactor this code`,
      optimize: `I need to improve the performance of this task. Please do the following:\n1. Identify likely bottlenecks and how to address them\n2. Propose optimization strategies with trade-offs\n3. Create a prompt for an AI coding agent to perform this optimization`,
      test:     `I need to write unit tests for this task. Please do the following:\n1. Identify important test cases — happy path, edge cases, and error cases\n2. Recommend a testing strategy and suitable tools\n3. Create a prompt for an AI coding agent to write comprehensive tests`,
      docs:     `I need to write documentation for this task. Please do the following:\n1. Identify what documentation is needed — README, API docs, usage examples\n2. Propose a structure and content outline\n3. Create a prompt for an AI coding agent to write complete documentation`,
    };

    const map = lang === "en" ? en : th;
    const intro = map[mode] ?? map.analyze;
    const taskSection = lang === "en"
      ? (description ? `Task: ${title}\nDescription: ${description}` : `Task: ${title}`)
      : (description ? `ชื่องาน: ${title}\nรายละเอียด: ${description}` : `ชื่องาน: ${title}`);
    const closing = lang === "en" ? "Start now." : "เริ่มได้เลย";
    return `${intro}\n\n${taskSection}\n\n${closing}`;
  }

  function openInChatGPT(mode: string) {
    if (!task) return;
    isChatGPTMenuOpen = false;
    chatGPTSelectedMode = mode;
    chatGPTPromptLabel = chatGPTModes.find(m => m.id === mode)?.label ?? "";
    chatGPTPromptDraft = buildChatGPTPrompt(mode, chatGPTLang);
    isChatGPTModalOpen = true;
  }

  function switchLang(lang: "th" | "en") {
    chatGPTLang = lang;
    chatGPTPromptDraft = buildChatGPTPrompt(chatGPTSelectedMode, lang);
  }

  async function sendToChatGPT() {
    if (!selectedProvider.supportsQuery) {
      await navigator.clipboard.writeText(chatGPTPromptDraft);
      showMessage(`คัดลอก prompt แล้ว กำลังเปิด ${selectedProvider.name}...`, "success");
    }
    const url = selectedProvider.buildUrl(encodeURIComponent(chatGPTPromptDraft));
    window.open(url, "_blank", "noopener,noreferrer");
    isChatGPTModalOpen = false;
  }
</script>

<svelte:head>
  <title>{$_("meta__task_title", { values: { title: task ? task.title : "Task" } })}</title>
  <meta name="description" content={task ? $_("meta__task_desc", { values: { title: task.title + (task.notes ? " · " + task.notes.replace(/<[^>]*>/g, "").slice(0, 100) : "") } }) : $_("meta__task_desc", { values: { title: "Task" } })} />
</svelte:head>

<svelte:window
  on:click={handleMoreMenuClickOutside}
  on:keydown={(e) => { handleKeydown(e); handleLightboxKeydown(e); }}
/>

<div
  class="flex flex-col h-full bg-white dark:bg-[#0b1120] text-slate-900 dark:text-slate-100"
>
  <!-- Header -->
  <header
    class="flex items-center justify-between px-4 h-14 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white/80 dark:bg-[#0b1120]/80 backdrop-blur-md sticky top-0 z-10"
  >
    <div class="flex items-center gap-3 overflow-hidden">
      <button
        on:click={goBack}
        class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
        title={$_("sidebar__back")}
      >
        <ArrowLeft size={18} />
      </button>
      <div
        class="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 truncate"
      >
        <span
          class="truncate hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-1"
          on:click={goBack}
          on:keydown={(e) => e.key === "Enter" && goBack()}
          role="link"
          tabindex="0"
        >
          <Layout size={14} />
          {$currentWorkspaceName || "Workspace"}
        </span>
        <ChevronRight size={14} class="shrink-0" />
        {#if task}
          <span class="font-medium text-slate-900 dark:text-white truncate">
            {task.title}
          </span>
        {/if}
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      {#if task?.status !== 'done'}
        <button
          class="p-2 rounded-lg transition-all duration-200 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10"
          on:click={() =>
            task &&
            handleUpdateTask({ status: "done" })}
          title="Mark as done"
        >
          <CheckCircle2 size={18} />
        </button>
      {/if}
      <button
        on:click={openBranchDialog}
        class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
        title={$_("taskForm__branch")}
      >
        <GitBranch size={18} />
      </button>
      {#if task}
        <div class="relative chatgpt-menu-container">
          <button
            on:click={() => (isChatGPTMenuOpen = !isChatGPTMenuOpen)}
            class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors {isChatGPTMenuOpen ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-500 dark:text-slate-400'}"
            title="ถาม ChatGPT"
          >
            <Bot size={18} />
          </button>
          {#if isChatGPTMenuOpen}
            <div class="absolute right-0 top-full mt-1 w-56 bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl z-99999 overflow-hidden animate-dropdown-in py-1">
              <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">ถาม AI เกี่ยวกับ...</div>
              {#each chatGPTModes as mode}
                <button
                  type="button"
                  on:click={() => openInChatGPT(mode.id)}
                  class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/6 transition-colors group"
                >
                  <span class="text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                    <svelte:component this={mode.icon} size={14} />
                  </span>
                  <span class="flex flex-col min-w-0">
                    <span class="text-[13px] text-slate-200">{mode.label}</span>
                    <span class="text-[11px] text-slate-500 mt-0.5">{mode.desc}</span>
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <button
        on:click={togglePin}
        class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors {isPinned
          ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
          : 'text-slate-500 dark:text-slate-400'}"
        title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
      >
        {#if isPinned}
          <PinOff size={18} />
        {:else}
          <Pin size={18} />
        {/if}
      </button>
      <div class="relative more-menu-container">
        <button
          on:click={toggleMoreMenu}
          class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors {isMoreMenuOpen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white'
            : 'text-slate-500 dark:text-slate-400'}"
        >
          <MoreHorizontal size={18} />
        </button>

        {#if isMoreMenuOpen}
          <div
            class="absolute right-0 top-full mt-1 w-52 bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl z-[99999] overflow-hidden animate-dropdown-in py-1"
          >
            <button
              type="button"
              on:click|stopPropagation={() => {
                isDeleteConfirm = true;
                isMoreMenuOpen = false;
              }}
              class="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <Trash2 size={14} />
              <span>{$_("taskDetail__delete_task")}</span>
            </button>
          </div>
        {/if}
      </div>
      <div class="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1"></div>
      <button
        on:click={() => (sidebarOpen = !sidebarOpen)}
        class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors {sidebarOpen
          ? 'text-primary dark:text-indigo-400 bg-slate-100 dark:bg-slate-800'
          : 'text-slate-500 dark:text-slate-400'}"
      >
        <PanelRight size={18} />
      </button>
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden relative">
    <!-- Mobile Sidebar Backdrop -->
    {#if sidebarOpen}
      <div
        class="lg:hidden absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-20"
        on:click={() => (sidebarOpen = false)}
        on:keydown={(e) => e.key === "Escape" && (sidebarOpen = false)}
        role="button"
        tabindex="0"
        aria-label="Close sidebar"
      ></div>
    {/if}

    <!-- Main Content -->
    <div
      class="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-[#0b1120]"
    >
      {#if loading}
        <div class="max-w-4xl mx-auto p-8 space-y-6 animate-pulse">
          <div
            class="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4"
          ></div>
          <div class="space-y-3">
            <div
              class="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"
            ></div>
            <div class="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6"></div>
            <div class="h-4 bg-slate-100 dark:bg-slate-800 rounded w-4/6"></div>
          </div>
          <div class="pt-8 space-y-4">
            <div class="h-px bg-slate-100 dark:bg-slate-800"></div>
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800"
              ></div>
              <div class="flex-1 space-y-2">
                <div
                  class="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/4"
                ></div>
                <div
                  class="h-16 bg-slate-100 dark:bg-slate-800 rounded w-full"
                ></div>
              </div>
            </div>
          </div>
        </div>
      {:else if error}
        <div
          class="flex flex-col items-center justify-center h-full text-slate-500 p-8"
        >
          <Folder size={48} class="mb-4 opacity-20" />
          <p>{error}</p>
          <button on:click={goBack} class="mt-4 text-primary hover:underline">
            {$_("sidebar__back")}
          </button>
        </div>
      {:else if task}
        <div class="max-w-4xl mx-auto w-full px-4 sm:px-8 py-8 space-y-10">
          <!-- Title Section -->
          <div class="space-y-4">
            {#if isEditingTitle}
              <TitleEditor
                bind:this={titleInputRef}
                bind:value={editedTitle}
                onblur={saveTitle}
                className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight"
              />
            {:else}
              <div class="flex items-center gap-2 mb-1">
                {#if task.priority && task.priority !== 'none'}
                  <PriorityBadge priority={task.priority} />
                {/if}
                {#if task.task_number}
                  {@const displayShortName =
                    projectShortName ||
                    task.workspace_short_name ||
                    $currentWorkspaceShortName ||
                    workspaceShortNameFallback}
                  <span
                    class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tracking-wide"
                  >
                    {displayShortName || "TASK"}-{task.task_number}
                  </span>
                {/if}
              </div>
              <div
                role="button"
                tabindex="0"
                on:click={() => {
                  isEditingTitle = true;
                  setTimeout(() => titleInputRef?.focus(), 0);
                }}
                on:keydown={(e) => e.key === "Enter" && (isEditingTitle = true)}
                class="text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight cursor-text hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors -ml-2 px-2 py-1 outline-none"
              >
                {task.title}
              </div>
            {/if}

            {#if task.project}
              <div
                class="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
              >
                <span class="font-medium">{$_("taskDetail__sub_issue_of")}</span
                >
                <Folder size={14} />
                <span
                  class="hover:text-primary dark:hover:text-indigo-400 cursor-pointer transition-colors"
                >
                  {task.project}
                </span>
              </div>
            {/if}
          </div>

          <!-- Description Section -->
          <div class="space-y-4">
            {#if isEditingDescription}
              <RichTextEditor
                value={editedDescription}
                onchange={handleDescriptionChange}
                placeholder={$_("taskDetail__no_description")}
              />

              <div
                class="flex items-center justify-end gap-2 mt-2 animate-fade-in"
              >
                <button
                  on:click={cancelDescription}
                  class="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  {$_("page__cancel")}
                </button>
                <button
                  on:click={saveDescription}
                  class="px-4 py-1.5 text-xs font-bold bg-primary hover:bg-primary-dark text-white rounded-lg shadow-lg shadow-primary/20 transition-all"
                >
                  {$_("page__save")}
                </button>
              </div>
            {:else}
              <div
                role="button"
                tabindex="0"
                on:click={startEditingDescription}
                on:keydown={(e) => e.key === "Enter" && startEditingDescription()}
                class="min-h-[100px] cursor-text hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-lg transition-colors px-3 py-3 outline-none"
              >
                {#if editedDescription}
                  <div class="prose prose-sm dark:prose-invert max-w-none">
                    {@html renderMarkdown(editedDescription)}
                  </div>
                {:else}
                  <p class="text-slate-400 dark:text-slate-500 italic">{$_("taskDetail__no_description")}</p>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Checklist Section -->
          <div class="space-y-4">
            <ChecklistManager
              checklist={task.checklist || []}
              on:update={handleChecklistUpdate}
            />
          </div>

          <!-- Links Section -->
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <ExternalLink size={15} />
              <span>Links</span>
            </div>

            {#if task.links && task.links.length > 0}
              <div class="space-y-2">
                {#each task.links as link}
                  <LinkPreview url={link} readonly={false} onRemove={() => removeLink(link)} />
                {/each}
              </div>
            {/if}

            <!-- Add link input -->
            <div class="flex gap-2">
              <input
                type="url"
                bind:value={newLinkInput}
                placeholder="วาง URL ที่นี่..."
                on:keydown={(e) => e.key === 'Enter' && addLink()}
                class="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                on:click={addLink}
                disabled={!newLinkInput.trim()}
                class="px-3 py-2 rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <!-- Related Test Case Section -->
          {#if task.testcase_id}
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <FileCheck size={15} />
                <span>Related Test Case</span>
              </div>
              <a
                href="{base}/workspace/{workspaceId}/test-cases?testcase_id={task.testcase_id}{workspaceRoom ? `&room=${workspaceRoom}` : ''}"
                class="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group"
              >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileCheck size={16} class="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      View Test Case
                    </span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 truncate">
                      ID: {task.testcase_id}
                    </span>
                  </div>
                </div>
                <ExternalLink size={14} class="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              </a>
            </div>
          {/if}

          <hr class="border-slate-100 dark:border-slate-800" />

          <!-- Activity / Comments Section -->
          <div class="space-y-6 pb-20">
            <div class="flex items-center gap-2 font-semibold">
              <MessageCircle size={18} />
              <span>{$_("taskDetail__activity")}</span>
            </div>

            <!-- Comments List (above input) -->
            <div class="space-y-3">
              {#if commentsLoading && comments.length === 0}
                <p
                  class="text-sm text-slate-500 dark:text-slate-500 animate-pulse"
                >
                  Loading activity...
                </p>
              {:else if comments.length === 0}
                <p class="text-sm text-slate-400 dark:text-slate-500 italic">
                  {$_("taskForm__comments_empty") || "No activity yet."}
                </p>
              {:else}
                {#each comments as comment (comment.id)}
                  {@const authorName = formatCommentAuthor(comment)}
                  {@const displayName = authorName.length > 24 ? authorName.slice(0, 24) + "…" : authorName}
                  {@const initials = (authorName[0] ?? "?").toUpperCase()}
                  {@const cid = comment.id ?? ""}
                  <div
                    class="rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.04]"
                  >
                    <!-- Header -->
                    <div class="flex items-center gap-2.5 px-4 py-2.5">
                      <button
                        type="button"
                        aria-label="Toggle Comment"
                        class="text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 transition-colors shrink-0"
                        on:click={() =>
                          (collapsedComments[cid] = !collapsedComments[cid])}
                      >
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          class="transition-transform duration-150 {collapsedComments[cid] ? '-rotate-90' : ''}"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <div
                        class="w-6 h-6 rounded-full bg-indigo-500/80 flex items-center justify-center text-white text-[11px] font-bold shrink-0 select-none"
                      >
                        {initials}
                      </div>
                      <span
                        class="text-sm font-semibold text-slate-700 dark:text-slate-200"
                        >{displayName}</span
                      >
                      <span class="text-xs text-slate-400 dark:text-slate-500"
                        >{formatRelativeTime(comment.created_at)}</span
                      >
                      <div class="ml-auto relative">
                        <button
                          type="button"
                          class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                          title="More"
                          on:click={() => openCommentMenuId = openCommentMenuId === cid ? "" : cid}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                        </button>
                        {#if openCommentMenuId === cid}
                          <div class="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1c1f2e] border border-slate-200 dark:border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden py-1">
                            <button
                              type="button"
                              class="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              on:click={() => handleDeleteComment(cid)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                              <span>Delete comment</span>
                            </button>
                          </div>
                        {/if}
                      </div>
                    </div>
                    <!-- Body -->
                    {#if !collapsedComments[cid]}
                      <div
                        class="px-4 pb-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-3"
                      >
                        {#if comment.content}
                          <p class="whitespace-pre-wrap">{@html linkifyComment(comment.content)}</p>
                        {/if}
                        {#if comment.images && comment.images.length > 0}
                          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                            {#each comment.images as img, imgIdx}
                              <button
                                type="button"
                                on:click={() => openLightbox(comment.images!, imgIdx)}
                                class="aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 hover:opacity-90 transition-opacity"
                              >
                                <img
                                  src={getCommentImageUrl(img.file_key)}
                                  alt={img.filename}
                                  class="w-full h-full object-cover"
                                />
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>

            <!-- Comment Input (at bottom) -->
            <div class="flex gap-3 pt-2">
              <div class="shrink-0">
                <div
                  class="w-8 h-8 rounded-full bg-indigo-500/80 flex items-center justify-center text-white text-sm font-bold select-none"
                >
                  {(
                    $user?.profile?.first_name?.[0] ||
                    $user?.email?.[0] ||
                    "?"
                  ).toUpperCase()}
                </div>
              </div>
              <div class="flex-1">
                <div
                  class="relative rounded-xl border border-slate-200 dark:border-white/10 bg-transparent focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all overflow-hidden"
                >
                  <!-- Hidden file input -->
                  <input
                    bind:this={commentFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    class="hidden"
                    on:change={(e) => {
                      const files = Array.from((e.currentTarget as HTMLInputElement).files || []);
                      if (files.length) {
                        const newFiles = processFilesForPreview(files);
                        attachedFiles = [...attachedFiles, ...newFiles];
                        if (commentFileInputRef) commentFileInputRef.value = "";
                      }
                    }}
                  />
                  {#if attachedFiles.length > 0}
                    <div class="px-4 pt-3 flex flex-wrap gap-2">
                      {#each attachedFiles as af, i}
                        <div class="group relative flex items-center gap-2 p-1 bg-slate-100 dark:bg-white/[0.05] rounded-lg border border-slate-200 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400">
                          {#if af.preview}
                            <img src={af.preview} alt="preview" class="w-8 h-8 rounded object-cover border border-white/10 shadow-sm" />
                          {:else}
                            <div class="w-8 h-8 rounded bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-400">
                              <FileText size={12} />
                            </div>
                          {/if}
                          <span class="truncate max-w-[100px] px-1">{af.file.name}</span>
                          <button 
                            type="button"
                            on:click={() => {
                              revokePreview(af.preview);
                              attachedFiles = attachedFiles.filter((_, idx) => idx !== i);
                            }}
                            class="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            aria-label="Remove file"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                  <textarea
                    bind:this={commentTextareaRef}
                    bind:value={commentContent}
                    placeholder={$_("taskForm__comments_placeholder")}
                    rows={commentRows}
                    class="w-full !bg-transparent px-4 pt-3 pb-10 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none"
                    on:paste={handlePaste}
                    on:keydown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleCommentSubmit();
                      }
                    }}
                  ></textarea>
                  <div
                    class="absolute bottom-2 right-2 flex items-center gap-1"
                  >
                    <button
                      type="button"
                      class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors"
                      title="Expand"
                      on:click={() => { commentRows = commentRows < 8 ? 8 : 3; commentTextareaRef?.focus(); }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><polyline points="15 3 21 3 21 9" /><polyline
                          points="9 21 3 21 3 15"
                        /><line x1="21" y1="3" x2="14" y2="10" /><line
                          x1="3"
                          y1="21"
                          x2="10"
                          y2="14"
                        /></svg
                      >
                    </button>
                    <button
                      type="button"
                      class="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors"
                      title="Attach file"
                      on:click={() => commentFileInputRef?.click()}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><path
                          d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                        /></svg
                      >
                    </button>
                    <button
                      on:click={handleCommentSubmit}
                      disabled={!commentContent.trim() && attachedFiles.length === 0}
                      class="p-1.5 rounded-lg transition-colors {(commentContent.trim() || attachedFiles.length > 0)
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                        : 'text-slate-300 dark:text-slate-700 cursor-not-allowed'}"
                      title="Send (⌘+Enter)"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><line x1="22" y1="2" x2="11" y2="13" /><polygon
                          points="22 2 15 22 11 13 2 9 22 2"
                        /></svg
                      >
                    </button>
                  </div>
                </div>
                <p
                  class="mt-1 text-[11px] text-slate-400 dark:text-slate-600 pl-1"
                >
                  ⌘+Enter to send
                </p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right Sidebar -->
    {#if sidebarOpen}
      <aside
        class="fixed lg:relative inset-y-0 right-0 w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] lg:bg-slate-50/50 lg:dark:bg-[#0b1120]/50 backdrop-blur-sm overflow-y-auto custom-scrollbar p-6 space-y-8 shrink-0 z-30 lg:z-auto transition-transform duration-300 {sidebarOpen
          ? 'translate-x-0'
          : 'translate-x-full lg:hidden'}"
      >
        {#if loading}
          <!-- Sidebar Skeleton -->
          <div class="space-y-8 animate-pulse">
            <div class="space-y-4">
              <div
                class="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3"
              ></div>
              <div class="space-y-4">
                {#each Array(5) as _}
                  <div class="space-y-2">
                    <div
                      class="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/4"
                    ></div>
                    <div
                      class="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg w-full"
                    ></div>
                  </div>
                {/each}
              </div>
            </div>
            <hr class="border-slate-100 dark:border-slate-800" />
            <div class="space-y-4">
              <div
                class="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/3"
              ></div>
              <div class="space-y-3">
                {#each Array(2) as _}
                  <div class="space-y-2">
                    <div
                      class="h-2 bg-slate-100 dark:bg-slate-800 rounded w-1/4"
                    ></div>
                    <div
                      class="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2"
                    ></div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {:else if task}
          <!-- Properties Section -->
          <div class="space-y-6">
            <div
              class="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400 dark:text-slate-500/70"
            >
              <span>{$_("taskDetail__properties")}</span>
              <ChevronDown size={12} class="opacity-50" />
            </div>

            <div class="grid grid-cols-[80px_1fr] gap-y-1">
              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <Clock
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__status_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <SearchableSelect
                    value={task.status}
                    options={statusOptions}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({ status: e.detail })}
                    showSearch={false}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <Tag
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__task_type_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <SearchableSelect
                    value={task.task_type || "feature"}
                    options={TASK_TYPES.map((t) => ({
                      value: t,
                      label: $_(`taskForm__task_type_${t}`),
                    }))}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({
                        task_type: e.detail as TaskType,
                      })}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <AlertTriangle
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>Priority</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <PrioritySelector
                    value={task.priority || "none"}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({
                        priority: e.detail as Task["priority"],
                      })}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <User
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__assignee_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <SearchableSelect
                    value={task.assignee_id || task.assignee_ids?.[0] || "all"}
                    options={[
                      { value: "all", label: "Unassigned" },
                      ...assignees.map((a) => ({
                        value: a.id || "",
                        label: a.name,
                      })),
                    ]}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({
                        assignee_ids: e.detail === "all" ? [] : [e.detail],
                      })}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <Folder
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__project_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <SearchableSelect
                    value={task.project || ""}
                    options={[
                      { value: "", label: "No Project" },
                      ...projects.map((p) => ({
                        value: p.name,
                        label: p.name,
                      })),
                    ]}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({ project: e.detail })}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <Tag
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__sprint_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <SearchableSelect
                    value={task.sprint_id || "all"}
                    options={[
                      { value: "all", label: "No Sprint" },
                      ...sprints.map((s) => ({
                        value: s.id || "",
                        label: s.name,
                      })),
                    ]}
                    on:select={(e: CustomEvent<any>) =>
                      handleUpdateTask({
                        sprint_id: e.detail === "all" ? null : e.detail,
                      })}
                  />
                </div>
              </div>

              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md hover:bg-slate-500/5 transition-colors group"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <Calendar
                    size={14}
                    class="opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span>{$_("taskForm__due_date_label")}</span>
                </div>
                <div
                  class="flex items-center justify-start min-w-0 property-select"
                >
                  <CustomDatePicker
                    value={task.due_date || task.end_date || ""}
                    placeholder={$_("taskForm__due_date_placeholder")}
                    on:select={(e: CustomEvent<string>) =>
                      handleUpdateTask({ due_date: e.detail })}
                    minimal={true}
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="h-px bg-slate-200 dark:bg-slate-800/50 mx-2"></div>

          <!-- Details Section -->
          <div class="space-y-6">
            <div
              class="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400 dark:text-slate-500/70"
            >
              <span>{$_("taskDetail__details")}</span>
              <ChevronDown size={12} class="opacity-50" />
            </div>

            <div class="grid grid-cols-[80px_1fr] gap-y-1">
              <div
                class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md group transition-colors"
              >
                <div
                  class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  <div class="w-3.5" aria-hidden="true"></div>
                  <span>{$_("taskDetail__created_at")}</span>
                </div>
                <span
                  class="text-[13px] text-slate-600 dark:text-slate-400 px-2"
                  >{task.created_at
                    ? new Date(task.created_at).toLocaleDateString()
                    : "-"}</span
                >
              </div>

              {#if task.updated_at}
                <div
                  class="col-span-2 grid grid-cols-subgrid items-center min-h-[32px] -mx-2 px-2 rounded-md group transition-colors"
                >
                  <div
                    class="flex items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400"
                  >
                    <div class="w-3.5" aria-hidden="true"></div>
                    <span>{$_("taskDetail__updated_at")}</span>
                  </div>
                  <span
                    class="text-[13px] text-slate-600 dark:text-slate-400 px-2"
                    >{new Date(task.updated_at).toLocaleDateString()}</span
                  >
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </aside>
    {/if}
  </div>

  {#if isBranchDialogOpen && task}
    <BranchDialog
      show={isBranchDialogOpen}
      title={task.title}
      workspaceShortName={task.workspace_short_name || projectShortName || $currentWorkspaceShortName || ""}
      taskNumber={task.task_number || null}
      taskType={task.task_type}
      on:close={closeBranchDialog}
    />
  {/if}

  <ConfirmModal
    show={isDeleteConfirm}
    title={$_("taskDetail__delete_task")}
    message={$_("taskDetail__delete_confirm")}
    confirmText={$_("taskDetail__delete_confirm_yes")}
    cancelText={$_("page__cancel")}
    type="danger"
    onConfirm={handleDeleteTask}
    onClose={() => (isDeleteConfirm = false)}
  />
</div>

{#if isChatGPTModalOpen}
  <div
    class="fixed inset-0 z-99999 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
  >
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      on:click={() => (isChatGPTModalOpen = false)}
      on:keydown={(e) => e.key === "Escape" && (isChatGPTModalOpen = false)}
      role="button"
      tabindex="-1"
      aria-label="Close"
    ></div>

    <div class="relative w-full max-w-2xl bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-2">
          <Bot size={14} class="text-slate-400" />
          <span class="text-[13px] font-semibold text-slate-200">ถาม AI — {chatGPTPromptLabel}</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            on:click={copyPrompt}
            class="p-1.5 rounded-lg transition-colors {isCopied ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/6'}"
            aria-label="คัดลอก prompt"
            title="คัดลอก prompt"
          >
            {#if isCopied}
              <Check size={13} />
            {:else}
              <Copy size={13} />
            {/if}
          </button>
          <button
            on:click={() => (isChatGPTModalOpen = false)}
            class="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors"
            aria-label="ปิด"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex flex-col gap-1.5 px-3 py-3 flex-1 overflow-hidden">
        <div class="flex items-center justify-between">
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">แก้ไข prompt ก่อนส่งได้เลย</p>
          <div class="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              type="button"
              on:click={() => switchLang("th")}
              class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors {chatGPTLang === 'th' ? 'bg-white/15 text-slate-200' : 'text-slate-500 hover:text-slate-300'}"
            >TH</button>
            <button
              type="button"
              on:click={() => switchLang("en")}
              class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors {chatGPTLang === 'en' ? 'bg-white/15 text-slate-200' : 'text-slate-500 hover:text-slate-300'}"
            >EN</button>
          </div>
        </div>
        <textarea
          bind:value={chatGPTPromptDraft}
          class="flex-1 min-h-70 w-full !bg-transparent border border-slate-700 rounded-lg px-3 py-2.5 text-[13px] text-slate-300 placeholder:text-slate-600 outline-none resize-none focus:border-slate-500 transition-all custom-scrollbar"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-3 py-2.5 border-t border-white/10 shrink-0">
        <!-- Provider selector -->
        <div class="relative provider-menu-container">
          <button
            type="button"
            on:click={() => (isProviderMenuOpen = !isProviderMenuOpen)}
            class="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <Bot size={12} />
            <span>{selectedProvider.name}</span>
            <ChevronDown size={11} class="opacity-60" />
          </button>
          {#if isProviderMenuOpen}
            <div class="absolute left-0 bottom-full mb-1 w-44 bg-[#1c1c1c] border border-white/10 rounded-xl shadow-2xl z-99999 overflow-hidden py-1">
              <div class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">เลือก AI</div>
              {#each aiProviders as provider, i}
                {#if i > 0 && !aiProviders[i - 1].supportsQuery === false && !provider.supportsQuery}
                  <div class="mx-3 my-1 border-t border-white/10"></div>
                  <div class="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">auto-copy</div>
                {/if}
                <button
                  type="button"
                  on:click={() => selectProvider(provider)}
                  class="w-full flex items-center justify-between px-3 py-2 text-[13px] hover:bg-white/6 transition-colors {selectedProvider.id === provider.id ? 'text-slate-200' : 'text-slate-400'}"
                >
                  <span>{provider.name}</span>
                  {#if selectedProvider.id === provider.id}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          <button
            on:click={() => (isChatGPTModalOpen = false)}
            class="px-3 py-1.5 text-[13px] text-slate-400 hover:text-slate-200 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            on:click={sendToChatGPT}
            class="flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg transition-colors border border-white/10"
          >
            <Bot size={13} />
            เปิด {selectedProvider.name}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if lightboxOpen}
  <div
    class="fixed inset-0 z-20020 bg-black/80 backdrop-blur-sm flex items-center justify-center"
    on:click|self={closeLightbox}
    on:keydown={(e) => e.key === 'Escape' && closeLightbox()}
    on:wheel|preventDefault={handleLightboxWheel}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="absolute top-4 right-4 flex items-center gap-1.5 z-10">
      <span class="text-white/70 text-sm font-mono bg-black/40 px-2 py-1 rounded">{Math.round(lightboxZoom * 100)}%</span>
      {#if lightboxRotation !== 0}
        <span class="text-white/70 text-sm font-mono bg-black/40 px-2 py-1 rounded">{lightboxRotation}°</span>
      {/if}
      {#if lightboxImages.length > 1}
        <span class="text-white/70 text-sm bg-black/40 px-2 py-1 rounded">{lightboxIndex + 1}/{lightboxImages.length}</span>
      {/if}
      <div class="w-px h-5 bg-white/20"></div>
      <button type="button" on:click={lbZoomIn} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Zoom in"><ZoomIn size={18} /></button>
      <button type="button" on:click={lbZoomOut} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Zoom out"><ZoomOut size={18} /></button>
      <button type="button" on:click={lbFitToScreen} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Fit to screen"><Maximize2 size={18} /></button>
      <button type="button" on:click={lbRotateRight} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Rotate"><RotateCw size={18} /></button>
      <button type="button" on:click={lbResetView} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Reset"><RotateCcw size={18} /></button>
      <div class="w-px h-5 bg-white/20"></div>
      <button type="button" on:click={() => void lbCopyToClipboard()} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors relative" title="Copy">
        <Copy size={18} />
        {#if lightboxCopyFeedback}
          <span class="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs bg-green-500 text-white px-2 py-0.5 rounded whitespace-nowrap">{lightboxCopyFeedback}</span>
        {/if}
      </button>
      <button type="button" on:click={() => void lbDownload()} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Download"><Download size={18} /></button>
      <button type="button" on:click={lbOpenInNewTab} class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors" title="Open in new tab"><ExternalLink size={18} /></button>
      <div class="w-px h-5 bg-white/20"></div>
      <button type="button" on:click={closeLightbox} class="p-2 bg-black/40 hover:bg-red-600/80 text-white rounded-lg transition-colors" title="Close"><X size={18} /></button>
    </div>

    {#if lightboxImages.length > 1}
      <button type="button" on:click={lbNavigatePrev} class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10" title="Previous">
        <ChevronLeft size={24} />
      </button>
      <button type="button" on:click={lbNavigateNext} class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10" title="Next">
        <ChevronRight size={24} />
      </button>
    {/if}

    <img
      src={lightboxSrc}
      alt={lightboxAlt}
      class="max-w-[90vw] max-h-[85vh] object-contain select-none {isLightboxDragging ? 'cursor-grabbing' : 'cursor-grab transition-transform duration-150'}"
      style="transform: scale({lightboxZoom}) translate({lightboxX / lightboxZoom}px, {lightboxY / lightboxZoom}px) rotate({lightboxRotation}deg);"
      on:mousedown={handleLightboxMouseDown}
      on:mousemove={handleLightboxMouseMove}
      on:mouseup={handleLightboxMouseUp}
      on:mouseleave={handleLightboxMouseUp}
      draggable="false"
      role="presentation"
    />

    {#if lightboxAlt && lightboxAlt !== "Image"}
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 text-sm px-4 py-1.5 rounded-full">
        {lightboxAlt}
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(.property-select .property-trigger-btn) {
    background-color: transparent !important;
    border-width: 1px !important;
    border-style: solid !important;
    border-color: rgba(255, 255, 255, 0.1) !important;
    color: #9ca3af !important;
    border-radius: 9999px !important;
    height: 2rem !important;
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
    font-size: 13px !important;
    box-shadow: none !important;
    transition: all 0.2s !important;
  }

  :global(.property-select .property-trigger-btn:hover) {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
  }

  :global(.property-select .property-trigger-btn span) {
    color: #d1d5db !important;
    font-size: 13px !important;
  }

  :global(.property-select .property-trigger-btn svg) {
    color: #94a3b8 !important;
  }

  :global(.custom-scrollbar::-webkit-scrollbar) {
    width: 6px;
  }
  :global(.custom-scrollbar::-webkit-scrollbar-track) {
    background: transparent;
  }
  :global(.custom-scrollbar::-webkit-scrollbar-thumb) {
    background: rgba(148, 163, 184, 0.1);
    border-radius: 10px;
  }
  :global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
    background: rgba(148, 163, 184, 0.2);
  }

  textarea {
    scrollbar-width: none;
  }
  textarea::-webkit-scrollbar {
    display: none;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
  }
</style>
