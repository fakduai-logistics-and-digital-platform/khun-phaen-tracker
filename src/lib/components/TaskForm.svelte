<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { browser } from "$app/environment";
  import { API_BASE_URL } from "$lib/apis";
  import {
    createTaskComment,
    deleteTaskComment,
    getAssigneeGroups,
    getCommentImages,
    getNextTaskNumber,
    getTaskComments,
    toggleTaskCommentReaction,
    updateTaskCommentText,
  } from "$lib/db";
  import { user } from "$lib/stores/auth";
  import {
    currentWorkspaceName,
    currentWorkspaceShortName,
  } from "$lib/stores/workspace";
  import { taskDefaults } from "$lib/stores/taskDefaults";
  import type {
    Assignee,
    AssigneeGroup,
    ChecklistItem,
    CommentImage,
    Project,
    Sprint,
    Task,
    TaskComment,
  } from "$lib/types";
  import { CATEGORIES } from "$lib/types";
  import { _, locale } from "svelte-i18n";
  import {
    Calendar,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Copy,
    Download,
    Edit2,
    ExternalLink,
    FileText,
    Folder,
    GitBranch,
    GitPullRequest,
    Image as ImageIcon,
    Link,
    Maximize,
    MessageCircle,
    RotateCcw,
    RotateCw,
    Send,
    Smile,
    Tag,
    Trash2,
    X,
    ZoomIn,
    ZoomOut,
  } from "lucide-svelte";
  import AssigneeSelector from "./AssigneeSelector.svelte";
  import BranchDialog from "./BranchDialog.svelte";
  import ChecklistManager from "./ChecklistManager.svelte";
  import CustomDatePicker from "./CustomDatePicker.svelte";
  import MarkdownEditor from "./MarkdownEditor.svelte";
  import Pagination from "./Pagination.svelte";
  import SearchableSelect from "./SearchableSelect.svelte";

  const dispatch = createEventDispatcher<{
    submit: Omit<Task, "id" | "created_at">;
    cancel: void;
    close: void;
    addAssignee: { name: string; color: string };
    checklistUpdate: { checklist: ChecklistItem[] };
  }>();

  export let show = false;
  export let editingTask: Task | null = null;
  export let assignees: Assignee[] = [];
  export let projects: Project[] = [];
  export let sprints: Sprint[] = [];
  export let isOwner = true;

  let title = "";
  let project = "";
  let date = new Date().toISOString().split("T")[0];
  let end_date = "";
  let status: Task["status"] = "todo";
  let category = "งานหลัก";
  let notes = "";
  let assignee_ids: (string | number)[] = [];
  let assignee_id_to_add: string | number | null = null;
  let assigneeGroups: AssigneeGroup[] = [];
  let sprint_id: string | number | null = null;
  let checklist: ChecklistItem[] = [];
  let dependencies: (string | number)[] = [];
  let showBranchDialog = false;
  let formInitKey = "closed";
  let copySuccess = false;
  let nextTaskNumber: number | null = null;

  let comments: TaskComment[] = [];
  let commentsLoading = false;
  let commentsError = "";
  let commentContent = "";
  let commentFiles: File[] = [];
  let commentFilePreviews: { key: string; file: File; url: string }[] = [];
  let commentDropActive = false;
  let commentComposerActive = false;
  let commentComposerEl: HTMLDivElement | null = null;
  let keepCommentComposerOpen = false;
  let commentSubmitting = false;
  let commentDeleting = false;
  let showDeleteCommentConfirm = false;
  let pendingDeleteComment: TaskComment | null = null;
  let commentsPage = 1;
  let commentsLimit = 10;
  let commentsTotal = 0;
  let editingCommentId: string | null = null;
  let editingCommentText = "";
  let commentUpdating = false;
  let lastCommentsKey = "";
  let imagePaginationByComment: Record<
    string,
    {
      page: number;
      limit: number;
      total: number;
      images: CommentImage[];
      loading: boolean;
      error: string;
    }
  > = {};
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
  let copyFeedback = "";
  let reactionPickerForCommentId: string | null = null;
  let reactionUpdatingByComment: Record<string, boolean> = {};
  const commentReactionEmojis = [
    "👍",
    "❤️",
    "🔥",
    "🎉",
    "😂",
    "😮",
    "😢",
    "👀",
    "✅",
    "🚀",
  ];

  $: activeSprint = sprints.find((s) => s.status === "active");
  $: workspaceBadgePrefix = (
    editingTask?.workspace_short_name ||
    editingTask?.workspace_name ||
    $currentWorkspaceShortName ||
    $currentWorkspaceName ||
    ""
  )
    .replace(/\s+/g, "")
    .slice(0, 4)
    .toUpperCase();
  $: displayTaskNumber = editingTask?.task_number ?? nextTaskNumber;
  $: taskNumberBadge =
    displayTaskNumber && workspaceBadgePrefix
      ? `${workspaceBadgePrefix}-${displayTaskNumber}`
      : "";
  const isSameId = (
    a: string | number | null | undefined,
    b: string | number | null | undefined,
  ) =>
    a !== null &&
    a !== undefined &&
    b !== null &&
    b !== undefined &&
    String(a) === String(b);
  $: currentProjectRepoUrl = (() => {
    if (!project) return "";
    const matched = projects.find((p) => p.name === project);
    return matched?.repo_url || "";
  })();

  function initializeFormState() {
    if (editingTask) {
      const hasExplicitStartDate = !!editingTask.start_date;
      const legacyDueDateOnly =
        !hasExplicitStartDate &&
        !!editingTask.end_date &&
        !!editingTask.date &&
        editingTask.end_date === editingTask.date;
      title = editingTask.title || "";
      project = editingTask.project || "";
      date = legacyDueDateOnly
        ? ""
        : editingTask.start_date ||
          editingTask.date ||
          new Date().toISOString().split("T")[0];
      end_date =
        editingTask.due_date ||
        editingTask.end_date ||
        (legacyDueDateOnly ? editingTask.date : "");
      status = editingTask.status || "todo";
      category = editingTask.category || "งานหลัก";
      notes = editingTask.notes || "";
      assignee_ids = (
        editingTask.assignee_ids ||
        (editingTask.assignee_id ? [editingTask.assignee_id] : [])
      ).filter(
        (id) => id !== null && id !== undefined && String(id).trim() !== "",
      );
      sprint_id = editingTask.sprint_id || null;
      checklist = editingTask.checklist ? [...editingTask.checklist] : [];
      dependencies = editingTask.dependencies
        ? [...editingTask.dependencies]
        : [];
    } else {
      title = "";
      project = $taskDefaults.project || "";
      date = new Date().toISOString().split("T")[0];
      end_date = "";
      status = "todo";
      category = $taskDefaults.category || "งานหลัก";
      notes = "";
      assignee_ids = $taskDefaults.assignee_id
        ? [String($taskDefaults.assignee_id)]
        : [];
      sprint_id = activeSprint?.id || null;
      checklist = [];
      dependencies = [];
      void loadNextTaskNumber();
    }

    nextTaskNumber = null;

    assignee_id_to_add = null;
    showBranchDialog = false;
    commentContent = "";
    setCommentFiles([]);
    comments = [];
    commentsError = "";
    commentsPage = 1;
    commentsTotal = 0;
    imagePaginationByComment = {};
    lastCommentsKey = "";
    void loadAssigneeGroups();
  }

  async function loadNextTaskNumber() {
    if (!show || editingTask) return;
    try {
      nextTaskNumber = await getNextTaskNumber();
    } catch (error) {
      console.error("Failed to fetch next task number:", error);
      nextTaskNumber = null;
    }
  }

  async function loadAssigneeGroups() {
    try {
      assigneeGroups = await getAssigneeGroups(true);
    } catch (error) {
      console.error("Failed to load assignee groups:", error);
      assigneeGroups = [];
    }
  }

  function getCommentImageUrl(fileKey: string): string {
    return `${API_BASE_URL.replace(/\/api$/, "")}/api/files/${fileKey}`;
  }

  async function loadCommentImages(comment: TaskComment) {
    if (!editingTask?.id || !comment.id) return;
    const key = String(comment.id);
    const current = imagePaginationByComment[key] || {
      page: 1,
      limit: 6,
      total: comment.images.length || 0,
      images: [],
      loading: false,
      error: "",
    };
    imagePaginationByComment[key] = { ...current, loading: true, error: "" };
    try {
      const response = await getCommentImages(editingTask.id, comment.id, {
        page: current.page,
        limit: current.limit,
      });
      imagePaginationByComment[key] = {
        ...current,
        images: response.images,
        page: response.page,
        limit: response.limit,
        total: response.total,
        loading: false,
        error: "",
      };
    } catch (error) {
      imagePaginationByComment[key] = {
        ...current,
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : $_("taskForm__comments_error_load_images"),
      };
    }
  }

  async function loadComments(page = commentsPage) {
    if (!editingTask?.id) return;
    commentsLoading = true;
    commentsError = "";
    try {
      const response = await getTaskComments(editingTask.id, {
        page,
        limit: commentsLimit,
      });
      comments = response.comments;
      commentsTotal = response.total;
      commentsPage = response.page;
      for (const comment of comments) {
        const key = String(comment.id || "");
        const prev = imagePaginationByComment[key];
        imagePaginationByComment[key] = {
          page: prev?.page || 1,
          limit: prev?.limit || 6,
          total: comment.images.length || 0,
          images: [],
          loading: false,
          error: "",
        };
        await loadCommentImages(comment);
      }
    } catch (error) {
      commentsError =
        error instanceof Error
          ? error.message
          : $_("taskForm__comments_error_load");
    } finally {
      commentsLoading = false;
    }
  }

  function prevCommentImagesPage(comment: TaskComment) {
    if (!comment.id) return;
    const key = String(comment.id);
    const state = imagePaginationByComment[key];
    if (!state || state.page <= 1) return;
    imagePaginationByComment[key] = { ...state, page: state.page - 1 };
    void loadCommentImages(comment);
  }

  function nextCommentImagesPage(comment: TaskComment) {
    if (!comment.id) return;
    const key = String(comment.id);
    const state = imagePaginationByComment[key];
    if (!state) return;
    const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
    if (state.page >= totalPages) return;
    imagePaginationByComment[key] = { ...state, page: state.page + 1 };
    void loadCommentImages(comment);
  }

  function makeFileKey(file: File): string {
    return `${file.name}:${file.size}:${file.lastModified}`;
  }

  function rebuildCommentFilePreviews() {
    const existing = new Map(
      commentFilePreviews.map((item) => [item.key, item]),
    );
    const nextPreviews: { key: string; file: File; url: string }[] = [];
    for (const file of commentFiles) {
      const key = makeFileKey(file);
      const prev = existing.get(key);
      if (prev) {
        nextPreviews.push(prev);
        existing.delete(key);
        continue;
      }
      nextPreviews.push({ key, file, url: URL.createObjectURL(file) });
    }
    for (const stale of existing.values()) {
      URL.revokeObjectURL(stale.url);
    }
    commentFilePreviews = nextPreviews;
  }

  function setCommentFiles(files: File[]) {
    commentFiles = files.slice(0, 10);
    rebuildCommentFilePreviews();
  }

  function appendCommentFiles(inputFiles: File[]) {
    const imageFiles = inputFiles.filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;
    const merged = [...commentFiles];
    const seen = new Set(merged.map(makeFileKey));
    for (const file of imageFiles) {
      const key = makeFileKey(file);
      if (seen.has(key)) continue;
      merged.push(file);
      seen.add(key);
      if (merged.length >= 10) break;
    }
    setCommentFiles(merged);
  }

  function handleCommentFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    commentComposerActive = true;
    appendCommentFiles(Array.from(input.files || []));
    input.value = "";
  }

  function removeCommentFile(index: number) {
    setCommentFiles(commentFiles.filter((_, i) => i !== index));
  }

  function handleCommentPaste(event: ClipboardEvent) {
    appendCommentFiles(Array.from(event.clipboardData?.files || []));
  }

  function handleCommentDragOver() {
    commentDropActive = true;
  }

  function handleCommentDragLeave() {
    commentDropActive = false;
  }

  function handleCommentDrop(event: DragEvent) {
    commentDropActive = false;
    appendCommentFiles(Array.from(event.dataTransfer?.files || []));
  }

  function handleCommentComposerFocusIn() {
    commentComposerActive = true;
  }

  function handleCommentComposerFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (commentComposerEl && next && commentComposerEl.contains(next)) return;
    requestAnimationFrame(() => {
      if (keepCommentComposerOpen) return;
      const active = document.activeElement;
      if (commentComposerEl && active && commentComposerEl.contains(active))
        return;
      if (!commentContent.trim() && commentFiles.length === 0) {
        commentComposerActive = false;
      }
    });
  }

  function holdCommentComposerOpen() {
    keepCommentComposerOpen = true;
  }

  function releaseCommentComposerOpen() {
    requestAnimationFrame(() => {
      keepCommentComposerOpen = false;
    });
  }

  function formatCommentAuthor(comment: TaskComment): string {
    const uid = $user?.id || $user?.user_id;
    if (uid && comment.created_by === uid) {
      const profile = $user?.profile;
      const fullName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      return (
        profile?.nickname ||
        fullName ||
        $user?.email?.split("@")[0] ||
        $_("taskForm__comments_unknown_author")
      );
    }
    return comment.created_by || $_("taskForm__comments_unknown_author");
  }

  function currentUserId(): string {
    return String($user?.id || $user?.user_id || "");
  }

  function getReactionGroups(
    comment: TaskComment,
  ): Array<{ emoji: string; count: number; reactedByMe: boolean }> {
    const me = currentUserId();
    const grouped = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const reaction of comment.reactions || []) {
      const current = grouped.get(reaction.emoji) || {
        count: 0,
        reactedByMe: false,
      };
      current.count += 1;
      if (me && reaction.user_id === me) current.reactedByMe = true;
      grouped.set(reaction.emoji, current);
    }
    return Array.from(grouped.entries()).map(([emoji, value]) => ({
      emoji,
      count: value.count,
      reactedByMe: value.reactedByMe,
    }));
  }

  function toggleReactionPicker(commentId: string | undefined) {
    const id = String(commentId || "");
    reactionPickerForCommentId = reactionPickerForCommentId === id ? null : id;
  }

  function buildOptimisticReactions(
    comment: TaskComment,
    emoji: string,
    userId: string,
  ) {
    const now = new Date().toISOString();
    const current = [...(comment.reactions || [])];
    const mineIdx = current.findIndex(
      (reaction) => reaction.user_id === userId,
    );
    if (mineIdx >= 0) {
      if (current[mineIdx].emoji === emoji) {
        current.splice(mineIdx, 1);
      } else {
        current[mineIdx] = { ...current[mineIdx], emoji, reacted_at: now };
      }
    } else {
      current.push({ emoji, user_id: userId, reacted_at: now });
    }
    return current;
  }

  async function handleCommentReaction(comment: TaskComment, emoji: string) {
    if (!editingTask?.id || !comment.id) return;
    const commentId = String(comment.id);
    const userId = currentUserId();
    if (!userId || reactionUpdatingByComment[commentId]) return;
    const previousReactions = [...(comment.reactions || [])];
    const optimisticReactions = buildOptimisticReactions(
      comment,
      emoji,
      userId,
    );
    reactionUpdatingByComment = {
      ...reactionUpdatingByComment,
      [commentId]: true,
    };
    commentsError = "";
    comments = comments.map((item) =>
      String(item.id || "") === commentId
        ? { ...item, reactions: optimisticReactions }
        : item,
    );
    reactionPickerForCommentId = null;

    try {
      await toggleTaskCommentReaction(editingTask.id, comment.id, emoji);
    } catch (error) {
      comments = comments.map((item) =>
        String(item.id || "") === commentId
          ? { ...item, reactions: previousReactions }
          : item,
      );
      commentsError =
        error instanceof Error
          ? error.message
          : $_("taskForm__comments_error_update");
    } finally {
      const { [commentId]: _, ...rest } = reactionUpdatingByComment;
      reactionUpdatingByComment = rest;
    }
  }

  function escapeHtml(input: string): string {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function extractCommentUrls(content?: string): string[] {
    if (!content) return [];
    const matches = content.match(/https?:\/\/[^\s<>"']+/g) || [];
    const normalized = matches
      .map((url) => {
        try {
          return new URL(url).toString();
        } catch {
          return "";
        }
      })
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  function linkifyCommentContent(content?: string): string {
    if (!content) return "";
    const escaped = escapeHtml(content);
    const withLinks = escaped.replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noreferrer noopener" class="text-primary underline underline-offset-2 break-all">$1</a>',
    );
    return withLinks.replaceAll("\n", "<br>");
  }

  function getUrlMetaPreview(url: string): {
    host: string;
    path: string;
    favicon: string;
  } {
    try {
      const parsed = new URL(url);
      const path = `${parsed.pathname || "/"}${parsed.search || ""}`;
      return {
        host: parsed.hostname,
        path: path.length > 72 ? `${path.slice(0, 72)}...` : path,
        favicon: `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`,
      };
    } catch {
      return {
        host: url,
        path: "",
        favicon: "",
      };
    }
  }

  function formatCommentTime(value?: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const formatLocale = $locale === "th" ? "th-TH" : "en-US";
    return new Intl.DateTimeFormat(formatLocale, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatCommentRelativeTime(value?: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return formatCommentTime(value);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 60) return $_("taskForm__comments_time_just_now");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60)
      return $_("taskForm__comments_time_min_ago").replace(
        "{count}",
        String(diffMin),
      );
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24)
      return $_("taskForm__comments_time_hour_ago").replace(
        "{count}",
        String(diffHr),
      );
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7)
      return $_("taskForm__comments_time_day_ago").replace(
        "{count}",
        String(diffDay),
      );
    return formatCommentTime(value);
  }

  function getAuthorInitials(comment: TaskComment): string {
    const name = formatCommentAuthor(comment).trim();
    if (!name) return $_("taskForm__comments_unknown_initial");
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function getImageState(commentId: string | undefined) {
    return imagePaginationByComment[String(commentId || "")];
  }

  function openCommentImageLightbox(comment: TaskComment, imageIndex: number) {
    const images = getImageState(comment.id)?.images || [];
    if (images.length === 0) return;
    lightboxImages = images.map((img) => ({
      src: getCommentImageUrl(img.file_key),
      alt: img.filename || $_("taskForm__comments_image_fallback_alt"),
    }));
    lightboxIndex = Math.min(
      Math.max(imageIndex, 0),
      lightboxImages.length - 1,
    );
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    lightboxZoom = 1;
    lightboxX = 0;
    lightboxY = 0;
    lightboxRotation = 0;
    copyFeedback = "";
    lightboxOpen = true;
  }

  function closeLightbox() {
    lightboxOpen = false;
    isLightboxDragging = false;
  }

  function zoomIn() {
    lightboxZoom = Math.min(lightboxZoom + 0.25, 5);
  }
  function zoomOut() {
    lightboxZoom = Math.max(lightboxZoom - 0.25, 0.25);
  }
  function resetView() {
    lightboxZoom = 1;
    lightboxX = 0;
    lightboxY = 0;
    lightboxRotation = 0;
  }
  function rotateRight() {
    lightboxRotation = (lightboxRotation + 90) % 360;
  }

  function fitToScreen() {
    lightboxX = 0;
    lightboxY = 0;
    const img = new window.Image();
    img.onload = () => {
      const scaleH = (window.innerHeight * 0.9) / img.naturalHeight;
      lightboxZoom = Math.min(scaleH, 5);
    };
    img.src = lightboxSrc;
  }

  function navigatePrev() {
    if (lightboxImages.length <= 1) return;
    lightboxIndex =
      (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    resetView();
  }

  function navigateNext() {
    if (lightboxImages.length <= 1) return;
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    lightboxSrc = lightboxImages[lightboxIndex].src;
    lightboxAlt = lightboxImages[lightboxIndex].alt;
    resetView();
  }

  function openInNewTab() {
    window.open(lightboxSrc, "_blank", "noopener,noreferrer");
  }

  async function copyToClipboard() {
    try {
      const res = await fetch(lightboxSrc);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      copyFeedback = $_("taskForm__comments_lightbox_copied");
      setTimeout(() => (copyFeedback = ""), 2000);
    } catch {
      copyFeedback = $_("taskForm__comments_lightbox_copy_failed");
      setTimeout(() => (copyFeedback = ""), 2000);
    }
  }

  async function downloadImage() {
    try {
      const a = document.createElement("a");
      const res = await fetch(lightboxSrc);
      const blob = await res.blob();
      a.href = URL.createObjectURL(blob);
      a.download =
        (lightboxAlt &&
        lightboxAlt !== $_("taskForm__comments_image_fallback_alt")
          ? lightboxAlt
          : $_("taskForm__comments_image_fallback_alt")) + ".png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed:", e);
    }
  }

  function handleLightboxWheel(event: WheelEvent) {
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
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

  function handleLightboxMouseUp() {
    isLightboxDragging = false;
  }

  function handleLightboxKeydown(event: KeyboardEvent) {
    if (!lightboxOpen) return;
    switch (event.key) {
      case "Escape":
        closeLightbox();
        break;
      case "+":
      case "=":
        zoomIn();
        break;
      case "-":
        zoomOut();
        break;
      case "0":
        resetView();
        break;
      case "r":
      case "R":
        rotateRight();
        break;
      case "f":
      case "F":
        fitToScreen();
        break;
      case "ArrowLeft":
        navigatePrev();
        break;
      case "ArrowRight":
        navigateNext();
        break;
      case "c":
      case "C":
        if (!event.metaKey && !event.ctrlKey) void copyToClipboard();
        break;
    }
  }

  async function handleCommentSubmit() {
    if (!editingTask?.id) return;
    if (!commentContent.trim() && commentFiles.length === 0) return;
    commentSubmitting = true;
    commentsError = "";
    try {
      await createTaskComment(editingTask.id, {
        content: commentContent,
        files: commentFiles,
      });
      commentContent = "";
      setCommentFiles([]);
      await loadComments(1);
    } catch (error) {
      commentsError =
        error instanceof Error
          ? error.message
          : $_("taskForm__comments_error_submit");
    } finally {
      commentSubmitting = false;
    }
  }

  function openDeleteCommentConfirm(comment: TaskComment) {
    pendingDeleteComment = comment;
    showDeleteCommentConfirm = true;
  }

  function closeDeleteCommentConfirm() {
    if (commentDeleting) return;
    showDeleteCommentConfirm = false;
    pendingDeleteComment = null;
  }

  function forceCloseDeleteCommentConfirm() {
    showDeleteCommentConfirm = false;
    pendingDeleteComment = null;
  }

  async function handleDeleteComment() {
    if (!editingTask?.id || !pendingDeleteComment?.id) return;
    commentsError = "";
    const taskId = editingTask.id;
    const commentId = pendingDeleteComment.id;
    commentDeleting = true;
    forceCloseDeleteCommentConfirm();
    try {
      await deleteTaskComment(taskId, commentId);
      const nextTotal = Math.max(0, commentsTotal - 1);
      const nextPages = Math.max(1, Math.ceil(nextTotal / commentsLimit));
      const nextPage = Math.min(commentsPage, nextPages);
      await loadComments(nextPage);
    } catch (error) {
      commentsError =
        error instanceof Error
          ? error.message
          : $_("taskForm__comments_error_delete");
    } finally {
      commentDeleting = false;
    }
  }

  function startEditComment(comment: TaskComment) {
    editingCommentId = String(comment.id || "");
    editingCommentText = comment.content || "";
  }

  function cancelEditComment() {
    editingCommentId = null;
    editingCommentText = "";
  }

  async function saveEditComment(comment: TaskComment) {
    if (!editingTask?.id || !comment.id) return;
    commentUpdating = true;
    commentsError = "";
    try {
      await updateTaskCommentText(
        editingTask.id,
        comment.id,
        editingCommentText,
      );
      cancelEditComment();
      await loadComments(commentsPage);
    } catch (error) {
      commentsError =
        error instanceof Error
          ? error.message
          : $_("taskForm__comments_error_update");
    } finally {
      commentUpdating = false;
    }
  }

  function copyShareLink() {
    if (!editingTask?.id) return;
    const url = new URL(window.location.href);
    url.searchParams.set("task", String(editingTask.id));
    navigator.clipboard.writeText(url.toString());
    copySuccess = true;
    setTimeout(() => {
      copySuccess = false;
    }, 2000);
  }

  function getPullRequestUrl(): string {
    if (!currentProjectRepoUrl) return "";
    const base = currentProjectRepoUrl
      .replace(/\/+$/, "")
      .replace(/\.git$/, "");
    if (base.includes("github.com")) return `${base}/compare?expand=1`;
    if (base.includes("gitlab.com") || base.includes("gitlab"))
      return `${base}/-/merge_requests/new`;
    if (base.includes("bitbucket.org") || base.includes("bitbucket"))
      return `${base}/pull-requests/new`;
    return base;
  }

  function openPullRequest() {
    const url = getPullRequestUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  $: {
    const nextFormInitKey = show
      ? `${editingTask?.id ?? "new"}:${editingTask?.created_at ?? ""}`
      : "closed";
    if (show && nextFormInitKey !== formInitKey) {
      initializeFormState();
    }
    formInitKey = nextFormInitKey;
  }

  $: if (show && editingTask?.id) {
    const key = `${editingTask.id}:${commentsPage}:${commentsLimit}`;
    if (key !== lastCommentsKey) {
      lastCommentsKey = key;
      void loadComments(commentsPage);
    }
  }

  function handleSubmit() {
    if (!title.trim()) return;
    if (!date) return;
    if (
      assignee_id_to_add !== null &&
      !assignee_ids.some((id) => isSameId(id, assignee_id_to_add))
    ) {
      assignee_ids = [...assignee_ids, assignee_id_to_add];
    }
    if (!editingTask) {
      const firstAssigneeAsNumber =
        assignee_ids.length > 0 ? Number(assignee_ids[0]) : null;
      taskDefaults.set({
        project: project.trim(),
        assignee_id:
          firstAssigneeAsNumber !== null && !Number.isNaN(firstAssigneeAsNumber)
            ? firstAssigneeAsNumber
            : null,
        category,
      });
    }

    dispatch("submit", {
      title: title.trim(),
      project: project.trim(),
      duration_minutes: 0,
      start_date: date,
      date,
      due_date: end_date || undefined,
      end_date: end_date || undefined,
      status,
      category,
      notes: notes.trim(),
      assignee_ids: assignee_ids.length > 0 ? assignee_ids : undefined,
      assignee_id: assignee_ids.length > 0 ? assignee_ids[0] : null,
      sprint_id,
      checklist: checklist.length > 0 ? checklist : undefined,
    });
    // Close immediately for optimistic UX; parent continues async save.
    dispatch("close");
  }

  function handleClose() {
    dispatch("close");
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function handleAddAssignee(
    event: CustomEvent<{ name: string; color: string }>,
  ) {
    dispatch("addAssignee", event.detail);
  }

  function handleChecklistUpdate(
    event: CustomEvent<{ checklist: ChecklistItem[] }>,
  ) {
    checklist = event.detail.checklist;
    if (editingTask) {
      dispatch("checklistUpdate", { checklist });
    }
  }


  function openBranchDialog() {
    showBranchDialog = true;
  }

  function closeBranchDialog() {
    showBranchDialog = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      if (lightboxOpen) {
        closeLightbox();
        return;
      }
      if (showBranchDialog) {
        closeBranchDialog();
        return;
      }
      handleClose();
    }
  }

  function handleGlobalPointerDown(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-comment-reaction-picker="true"]')) return;
    reactionPickerForCommentId = null;
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("mousedown", handleGlobalPointerDown);
  });

  onDestroy(() => {
    for (const preview of commentFilePreviews) {
      URL.revokeObjectURL(preview.url);
    }
    if (browser) {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("mousedown", handleGlobalPointerDown);
    }
  });
</script>

{#if show}
  <div
    class="fixed inset-0 bg-black/35 backdrop-blur-sm z-20000 pointer-events-none m-0!"
  ></div>
  <div
    class="fixed inset-0 z-20000 overflow-y-auto m-0!"
    on:click|self={handleClose}
    on:keydown|self={(e) => e.key === "Escape" && handleClose()}
    role="button"
    tabindex="-1"
  >
    <div class="flex min-h-full items-center justify-center p-4">
      <div
        class="bg-white dark:bg-[#1a263b] border border-white/10 dark:border-white/10 rounded-xl shadow-2xl {editingTask?.id
          ? 'max-w-6xl'
          : 'max-w-2xl'} w-full animate-modal-in relative max-h-[90vh] flex flex-col"
      >
        <div
          class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700"
        >
          <h2
            class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2"
          >
            <CheckCircle size={20} class="text-primary" />
            {editingTask
              ? $_("taskForm__edit_task_title")
              : $_("taskForm__add_task_title")}
            {#if taskNumberBadge}
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-primary/10 text-primary border border-primary/20 shrink-0"
              >
                {taskNumberBadge}
              </span>
            {/if}
          </h2>
          <div class="flex items-center gap-2">
            {#if editingTask?.id}
              <button
                type="button"
                on:click={copyShareLink}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium {copySuccess
                  ? 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
                  : 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10'} border rounded-lg transition-all"
                title={$_("taskForm__copy_share_link")}
              >
                {#if copySuccess}
                  <Check size={14} />
                  <span>{$_("taskForm__copied")}</span>
                {:else}
                  <Link size={14} />
                  <span>{$_("taskForm__share")}</span>
                {/if}
              </button>
            {/if}
            {#if currentProjectRepoUrl}
              <button
                type="button"
                on:click={openPullRequest}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                title={$_("taskForm__open_pull_request")}
              >
                <GitPullRequest size={14} />
                <span>{$_("taskForm__pull_request")}</span>
                <ExternalLink size={12} class="opacity-60" />
              </button>
            {/if}
            <button
              type="button"
              on:click={openBranchDialog}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={$_("taskForm__branch")}
            >
              <GitBranch size={14} />
              <span>{$_("taskForm__branch")}</span>
            </button>
            <button
              type="button"
              on:click={handleClose}
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form
          on:submit|preventDefault={handleSubmit}
          class="flex flex-col flex-1 min-h-0"
        >
          <div class="p-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            <div
              class={editingTask?.id
                ? "grid grid-cols-1 xl:grid-cols-5 gap-4"
                : "space-y-4"}
            >
              <div
                class={editingTask?.id
                  ? "xl:col-span-3 space-y-4"
                  : "space-y-4"}
              >
                <div>
                  <label
                    for="title"
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >{$_("taskForm__task_title_label")}
                    <span class="text-danger">*</span></label
                  >
                  <input
                    id="title"
                    type="text"
                    bind:value={title}
                    placeholder={$_("taskForm__task_title_placeholder")}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      for="project"
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      ><Folder size={14} />{$_(
                        "taskForm__project_label",
                      )}</label
                    >
                    <SearchableSelect
                      id="project"
                      bind:value={project}
                      options={[
                        {
                          value: "",
                          label: "-- " + $_("taskForm__unassigned") + " --",
                        },
                        ...projects.map((proj) => ({
                          value: proj.name,
                          label: proj.name,
                        })),
                      ]}
                      placeholder={$_("taskForm__project_placeholder")}
                    />
                  </div>
                  <div>
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      ><Tag size={14} />{$_("taskForm__category_label")}</label
                    >
                    <SearchableSelect
                      bind:value={category}
                      options={CATEGORIES.map((cat) => ({
                        value: cat,
                        label: cat,
                      }))}
                      placeholder={$_("taskForm__category_placeholder")}
                      showSearch={false}
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      ><Calendar size={14} />{$_(
                        "taskForm__start_date_label",
                      )}</label
                    >
                    <CustomDatePicker
                      bind:value={date}
                      placeholder={$_("taskForm__start_date_placeholder")}
                      on:select={(e) => (date = e.detail)}
                    />
                  </div>
                  <div>
                    <label
                      class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      ><Calendar size={14} />{$_(
                        "taskForm__due_date_label",
                      )}</label
                    >
                    <CustomDatePicker
                      bind:value={end_date}
                      placeholder={$_("taskForm__due_date_placeholder")}
                      on:select={(e) => (end_date = e.detail)}
                    />
                  </div>
                </div>

                <div>
                  <label
                    for="status"
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                    ><CheckCircle size={14} />{$_("taskForm__status_label")}</label
                  >
                  <SearchableSelect
                    id="status"
                    bind:value={status}
                    options={[
                      {
                        value: "pending",
                        label: $_("taskForm__status_pending"),
                      },
                      {
                        value: "todo",
                        label: $_("taskForm__status_todo"),
                      },
                      {
                        value: "in-progress",
                        label: $_("taskForm__status_in_progress"),
                      },
                      {
                        value: "in-test",
                        label: $_("taskForm__status_in_test"),
                      },
                      {
                        value: "done",
                        label: $_("taskForm__status_done"),
                      },
                    ]}
                    showSearch={false}
                  />
                </div>

                <AssigneeSelector
                  {assignees}
                  {assigneeGroups}
                  bind:assignee_ids
                  bind:assignee_id_to_add
                  readonly={!isOwner}
                  on:addAssignee={handleAddAssignee}
                />

                <ChecklistManager
                  bind:checklist
                  autoDispatch={!!editingTask}
                  on:update={handleChecklistUpdate}
                />

                <div>
                  <label
                    class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                    ><FileText size={14} />{$_("taskForm__notes_label")}</label
                  >
                  <MarkdownEditor
                    bind:value={notes}
                    placeholder={$_("taskForm__notes_placeholder")}
                    rows={4}
                  />
                </div>
              </div>

              {#if editingTask?.id}
                <div
                  class="xl:col-span-2 rounded-xl dark:bg-[#0f1b2d] p-4 space-y-3 h-full min-h-140 xl:max-h-[calc(90vh-11rem)] flex flex-col"
                >
                  <div
                    class="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"
                  >
                    <MessageCircle size={16} /><span
                      >{$_("taskForm__comments_title")}</span
                    >
                  </div>
                  <div
                    bind:this={commentComposerEl}
                    on:focusin={handleCommentComposerFocusIn}
                    on:focusout={handleCommentComposerFocusOut}
                    class="space-y-3"
                  >
                    <textarea
                      bind:value={commentContent}
                      placeholder={$_("taskForm__comments_placeholder")}
                      rows={commentComposerActive ||
                      commentContent.trim() ||
                      commentFiles.length > 0
                        ? 3
                        : 1}
                      on:paste={handleCommentPaste}
                      on:dragenter|preventDefault={handleCommentDragOver}
                      on:dragover|preventDefault={handleCommentDragOver}
                      on:dragleave|preventDefault={handleCommentDragLeave}
                      on:drop|preventDefault={handleCommentDrop}
                      class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-800 dark:text-white transition-colors {commentDropActive
                        ? 'border-primary bg-primary/8 dark:bg-primary/14'
                        : 'border-gray-300 dark:border-gray-600'}"
                    ></textarea>
                    {#if commentComposerActive || commentContent.trim() || commentFiles.length > 0}
                      <div class="flex items-center gap-3">
                        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                        <label
                          on:mousedown={holdCommentComposerOpen}
                          on:mouseup={releaseCommentComposerOpen}
                          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          ><ImageIcon size={14} /><span
                            >{$_("taskForm__comments_attach_images")}</span
                          ><input
                            type="file"
                            accept="image/*"
                            multiple
                            class="hidden"
                            on:change={handleCommentFileChange}
                          /></label
                        >
                        <button
                          type="button"
                          on:mousedown={holdCommentComposerOpen}
                          on:mouseup={releaseCommentComposerOpen}
                          on:click={handleCommentSubmit}
                          disabled={commentSubmitting ||
                            (!commentContent.trim() &&
                              commentFiles.length === 0)}
                          class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                          ><Send size={14} /><span
                            >{commentSubmitting
                              ? $_("taskForm__comments_saving")
                              : $_("taskForm__btn_save")}</span
                          ></button
                        >
                      </div>
                    {/if}
                  </div>

                  {#if commentFiles.length > 0}
                    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {#each commentFilePreviews as preview, idx (preview.key)}
                        <div
                          class="relative rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                        >
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            class="w-full h-16 object-cover"
                          />
                          <button
                            type="button"
                            on:click={() => removeCommentFile(idx)}
                            class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/65 text-white text-xs leading-none"
                            >×</button
                          >
                        </div>
                      {/each}
                    </div>
                  {/if}

                  {#if commentsError}<p class="text-sm text-red-500">
                      {commentsError}
                    </p>{/if}

                  <div
                    class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 custom-scrollbar"
                  >
                    {#if commentsLoading}
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {$_("taskForm__comments_loading")}
                      </p>
                    {:else if comments.length === 0}
                      <div
                        class="h-full min-h-50 flex items-center justify-center p-3"
                      >
                        <p class="text-sm text-gray-400 text-center">
                          {$_("taskForm__comments_empty")}
                        </p>
                      </div>
                    {:else}
                      <div class="space-y-3">
                        {#each comments as comment}
                          <div class="p-1 space-y-2">
                            <div class="flex items-center gap-2 text-xs">
                              <div
                                class="w-7 h-7 rounded-full bg-primary/15 dark:bg-primary/20 text-primary font-semibold flex items-center justify-center"
                              >
                                {getAuthorInitials(comment)}
                              </div>
                              <span
                                class="font-semibold text-gray-800 dark:text-gray-200"
                                >{formatCommentAuthor(comment)}</span
                              >
                              <span
                                class="text-primary underline underline-offset-2"
                                >{formatCommentRelativeTime(
                                  comment.created_at,
                                )}</span
                              >
                            </div>
                            {#if editingCommentId === String(comment.id || "")}
                              <div class="space-y-2">
                                <textarea
                                  bind:value={editingCommentText}
                                  rows="3"
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none dark:bg-gray-800 dark:text-white"
                                ></textarea>
                                <div class="flex items-center gap-2">
                                  <button
                                    type="button"
                                    on:click={() => saveEditComment(comment)}
                                    disabled={commentUpdating}
                                    class="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium disabled:opacity-50"
                                    >{commentUpdating
                                      ? $_("taskForm__comments_saving")
                                      : $_("taskForm__btn_save")}</button
                                  >
                                  <button
                                    type="button"
                                    on:click={cancelEditComment}
                                    disabled={commentUpdating}
                                    class="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs font-medium"
                                    >{$_("taskForm__btn_cancel")}</button
                                  >
                                </div>
                              </div>
                            {:else if comment.content}
                              <div class="space-y-2">
                                <p
                                  class="text-sm text-gray-800 dark:text-gray-200 rounded-lg bg-gray-50 dark:bg-gray-900/60 px-3 py-2 wrap-break-word"
                                >
                                  <span
                                    >{@html linkifyCommentContent(
                                      comment.content,
                                    )}</span
                                  >
                                </p>
                                {#if extractCommentUrls(comment.content).length > 0}
                                  <div class="space-y-1.5">
                                    {#each extractCommentUrls(comment.content) as url}
                                      {@const meta = getUrlMetaPreview(url)}
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        class="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/70 px-2.5 py-2 hover:border-primary/50 transition-colors"
                                      >
                                        <div class="flex items-center gap-2">
                                          {#if meta.favicon}
                                            <img
                                              src={meta.favicon}
                                              alt={meta.host}
                                              class="w-4 h-4 rounded-sm shrink-0"
                                              loading="lazy"
                                            />
                                          {/if}
                                          <div class="min-w-0">
                                            <p
                                              class="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate"
                                            >
                                              {meta.host}
                                            </p>
                                            <p
                                              class="text-[10px] text-gray-500 dark:text-gray-400 truncate"
                                            >
                                              {meta.path}
                                            </p>
                                          </div>
                                        </div>
                                      </a>
                                    {/each}
                                  </div>
                                {/if}
                              </div>
                            {/if}
                            {#if getImageState(comment.id)?.total > 0}
                              {#if getImageState(comment.id)?.loading}
                                <p class="text-xs text-gray-500">
                                  {$_("taskForm__comments_images_loading")}
                                </p>
                              {:else}
                                <div
                                  class="grid grid-cols-2 sm:grid-cols-3 gap-2"
                                >
                                  {#each getImageState(comment.id)?.images || [] as image, imageIndex}
                                    <a
                                      href={getCommentImageUrl(image.file_key)}
                                      target="_blank"
                                      rel="noreferrer"
                                      on:click|preventDefault={() =>
                                        openCommentImageLightbox(
                                          comment,
                                          imageIndex,
                                        )}
                                      class="block rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-1"
                                      ><img
                                        src={getCommentImageUrl(image.file_key)}
                                        alt={image.filename}
                                        class="mx-auto w-auto h-auto max-w-full max-h-72 object-contain"
                                        loading="lazy"
                                      /></a
                                    >
                                  {/each}
                                </div>
                                {#if (getImageState(comment.id)?.total || 0) > (getImageState(comment.id)?.limit || 1)}
                                  <div
                                    class="flex items-center justify-between text-xs text-gray-500 mt-2"
                                  >
                                    <button
                                      type="button"
                                      class="px-2 py-1 border rounded disabled:opacity-50"
                                      disabled={(getImageState(comment.id)
                                        ?.page || 1) <= 1}
                                      on:click={() =>
                                        prevCommentImagesPage(comment)}
                                      >{$_("taskForm__pagination_prev")}</button
                                    >
                                    <span
                                      >{$_("taskForm__pagination_page")
                                        .replace(
                                          "{page}",
                                          String(
                                            getImageState(comment.id)?.page ||
                                              1,
                                          ),
                                        )
                                        .replace(
                                          "{pages}",
                                          String(
                                            Math.max(
                                              1,
                                              Math.ceil(
                                                (getImageState(comment.id)
                                                  ?.total || 0) /
                                                  (getImageState(comment.id)
                                                    ?.limit || 1),
                                              ),
                                            ),
                                          ),
                                        )}</span
                                    >
                                    <button
                                      type="button"
                                      class="px-2 py-1 border rounded disabled:opacity-50"
                                      disabled={(getImageState(comment.id)
                                        ?.page || 1) >=
                                        Math.ceil(
                                          (getImageState(comment.id)?.total ||
                                            0) /
                                            (getImageState(comment.id)?.limit ||
                                              1),
                                        )}
                                      on:click={() =>
                                        nextCommentImagesPage(comment)}
                                      >{$_("taskForm__pagination_next")}</button
                                    >
                                  </div>
                                {/if}
                              {/if}
                            {/if}
                            {#if getReactionGroups(comment).length > 0}
                              <div class="flex flex-wrap items-center gap-1">
                                {#each getReactionGroups(comment) as reaction}
                                  <button
                                    type="button"
                                    on:click={() =>
                                      void handleCommentReaction(
                                        comment,
                                        reaction.emoji,
                                      )}
                                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors {reaction.reactedByMe
                                      ? 'border-primary/50 bg-primary/10 text-primary'
                                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary/40'}"
                                    disabled={reactionUpdatingByComment[
                                      String(comment.id || "")
                                    ]}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                  </button>
                                {/each}
                              </div>
                            {/if}
                            <div
                              class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
                            >
                              <div
                                class="relative"
                                data-comment-reaction-picker="true"
                              >
                                <button
                                  type="button"
                                  on:click={() =>
                                    toggleReactionPicker(comment.id)}
                                  class="inline-flex items-center gap-1 hover:text-primary"
                                  title="Add reaction"
                                >
                                  <Smile size={12} />
                                  <span>React</span>
                                </button>
                                {#if reactionPickerForCommentId === String(comment.id || "")}
                                  <div
                                    class="absolute left-0 bottom-full mb-2 z-20 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-2 w-57"
                                  >
                                    <div class="grid grid-cols-5 gap-1.5">
                                      {#each commentReactionEmojis as emoji}
                                        <button
                                          type="button"
                                          on:click={() =>
                                            void handleCommentReaction(
                                              comment,
                                              emoji,
                                            )}
                                          class="h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
                                          disabled={reactionUpdatingByComment[
                                            String(comment.id || "")
                                          ]}
                                        >
                                          {emoji}
                                        </button>
                                      {/each}
                                    </div>
                                  </div>
                                {/if}
                              </div>
                              <span>•</span>
                              <button
                                type="button"
                                on:click={() => startEditComment(comment)}
                                class="inline-flex items-center gap-1 hover:text-primary"
                                title={$_("taskForm__comments_edit_title")}
                              >
                                <Edit2 size={12} />
                                <span>{$_("taskForm__comments_edit")}</span>
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                on:click={() =>
                                  openDeleteCommentConfirm(comment)}
                                class="inline-flex items-center gap-1 text-danger hover:opacity-80"
                                title={$_("taskForm__comments_delete_title")}
                              >
                                <Trash2 size={12} />
                                <span>{$_("taskForm__comments_delete")}</span>
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>

                      {#if commentsTotal > commentsLimit}
                        <Pagination
                          totalItems={commentsTotal}
                          bind:pageSize={commentsLimit}
                          bind:currentPage={commentsPage}
                          pageSizeOptions={[10, 20, 50]}
                        />
                      {/if}
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <div
            class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0"
          >
            <button
              type="button"
              on:click={handleClose}
              class="min-w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >{$_("taskForm__btn_cancel")}</button
            >
            <button
              type="submit"
              class="min-w-24 bg-primary hover:bg-primary-dark text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >{editingTask
                ? $_("taskForm__btn_save")
                : $_("taskForm__btn_add")}</button
            >
          </div>
        </form>
      </div>
    </div>
  </div>

  <BranchDialog
    bind:show={showBranchDialog}
    {title}
    workspaceShortName={workspaceBadgePrefix}
    taskNumber={displayTaskNumber ?? null}
    on:close={closeBranchDialog}
  />

  {#if lightboxOpen}
    <div
      class="fixed inset-0 z-20020 bg-black/80 backdrop-blur-sm flex items-center justify-center m-0!"
      on:click|self={closeLightbox}
      on:wheel|preventDefault={handleLightboxWheel}
      on:keydown={handleLightboxKeydown}
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label={$_("taskForm__comments_lightbox_aria")}
    >
      <div class="absolute top-4 right-4 flex items-center gap-1.5 z-10">
        <span
          class="text-white/70 text-sm font-mono bg-black/40 px-2 py-1 rounded"
          >{Math.round(lightboxZoom * 100)}%</span
        >
        {#if lightboxRotation !== 0}
          <span
            class="text-white/70 text-sm font-mono bg-black/40 px-2 py-1 rounded"
            >{lightboxRotation}°</span
          >
        {/if}
        {#if lightboxImages.length > 1}
          <span class="text-white/70 text-sm bg-black/40 px-2 py-1 rounded"
            >{lightboxIndex + 1}/{lightboxImages.length}</span
          >
        {/if}
        <div class="w-px h-5 bg-white/20"></div>
        <button
          type="button"
          on:click={zoomIn}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_zoom_in")}
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          on:click={zoomOut}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_zoom_out")}
        >
          <ZoomOut size={18} />
        </button>
        <button
          type="button"
          on:click={fitToScreen}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_fit")}
        >
          <Maximize size={18} />
        </button>
        <button
          type="button"
          on:click={rotateRight}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_rotate")}
        >
          <RotateCw size={18} />
        </button>
        <button
          type="button"
          on:click={resetView}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_reset")}
        >
          <RotateCcw size={18} />
        </button>
        <div class="w-px h-5 bg-white/20"></div>
        <button
          type="button"
          on:click={() => void copyToClipboard()}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors relative"
          title={$_("taskForm__comments_lightbox_copy")}
        >
          <Copy size={18} />
          {#if copyFeedback}
            <span
              class="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs bg-green-500 text-white px-2 py-0.5 rounded whitespace-nowrap"
              >{copyFeedback}</span
            >
          {/if}
        </button>
        <button
          type="button"
          on:click={downloadImage}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_download")}
        >
          <Download size={18} />
        </button>
        <button
          type="button"
          on:click={openInNewTab}
          class="p-2 bg-black/40 hover:bg-black/60 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_open_new_tab")}
        >
          <ExternalLink size={18} />
        </button>
        <div class="w-px h-5 bg-white/20"></div>
        <button
          type="button"
          on:click={closeLightbox}
          class="p-2 bg-black/40 hover:bg-red-600/80 text-white rounded-lg transition-colors"
          title={$_("taskForm__comments_lightbox_close")}
        >
          <X size={18} />
        </button>
      </div>

      {#if lightboxImages.length > 1}
        <button
          type="button"
          on:click={navigatePrev}
          class="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
          title={$_("taskForm__comments_lightbox_prev")}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          type="button"
          on:click={navigateNext}
          class="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
          title={$_("taskForm__comments_lightbox_next")}
        >
          <ChevronRight size={24} />
        </button>
      {/if}

      <img
        src={lightboxSrc}
        alt={lightboxAlt}
        class="max-w-[90vw] max-h-[85vh] object-contain select-none {isLightboxDragging
          ? 'cursor-grabbing'
          : 'cursor-grab transition-transform duration-150'}"
        style="transform: scale({lightboxZoom}) translate({lightboxX /
          lightboxZoom}px, {lightboxY /
          lightboxZoom}px) rotate({lightboxRotation}deg);"
        on:mousedown={handleLightboxMouseDown}
        on:mousemove={handleLightboxMouseMove}
        on:mouseup={handleLightboxMouseUp}
        on:mouseleave={handleLightboxMouseUp}
        draggable="false"
        role="presentation"
      />

      {#if lightboxAlt && lightboxAlt !== $_("taskForm__comments_image_fallback_alt")}
        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white/80 text-sm px-4 py-1.5 rounded-full"
        >
          {lightboxAlt}
        </div>
      {/if}
    </div>
  {/if}

  {#if showDeleteCommentConfirm && pendingDeleteComment}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
      class="fixed inset-0 z-20010 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      on:click|self={closeDeleteCommentConfirm}
      role="button"
      tabindex="-1"
    >
      <div
        class="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-2xl"
      >
        <div
          class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 class="text-sm font-semibold">
            {$_("taskForm__comments_delete_confirm_title")}
          </h3>
          <button
            type="button"
            on:click={closeDeleteCommentConfirm}
            disabled={commentDeleting}
            class="w-7 h-7 inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
        <div class="px-4 py-3 space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {$_("taskForm__comments_delete_confirm_desc")}
          </p>
          <button
            type="button"
            on:click={handleDeleteComment}
            disabled={commentDeleting}
            class="w-full rounded-md bg-danger hover:opacity-90 text-white text-sm font-semibold py-2.5 disabled:opacity-50"
          >
            {commentDeleting
              ? $_("taskForm__comments_deleting")
              : $_("taskForm__comments_delete_confirm_btn")}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  @keyframes modal-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .animate-modal-in {
    animation: modal-in 0.2s ease-out;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 10px;
  }

  :global(.dark .custom-scrollbar::-webkit-scrollbar-thumb) {
    background: #4b5563;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>
