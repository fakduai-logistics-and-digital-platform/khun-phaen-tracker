"use client";

import { withBase } from "@/lib/base-path";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/apis";
import { getTasks } from "@/lib/db";
import { useRouteIds } from "@/lib/use-route-ids";
import { useI18n } from "@/lib/i18n";
import type { Task } from "@/lib/types";

const WEBHOOK_STORAGE_KEY = "discordWebhookUrl";
const STATUS_ICONS: Record<string, string> = {
  done: "✅",
  todo: "📝",
  "in-progress": "🔄",
  "in-test": "🧪",
  tested: "🧫",
};
const OTHER_CATEGORIES = ["อื่นๆ", "Other", "อื่นๆ (Other)"];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function useDailyReflect(show: boolean) {
  const { t } = useI18n();
  const { workspaceId: wsId } = useRouteIds();

  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [doneTodayTasks, setDoneTodayTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [generatedText, setGeneratedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    setWebhookUrl(localStorage.getItem(WEBHOOK_STORAGE_KEY) || "");
  }, []);

  const formatTaskLine = useCallback(
    (task: Task) => {
      const icon = STATUS_ICONS[task.status] || "📌";
      let line = `${icon} ${task.title}`;
      if (task.assignees && task.assignees.length > 0) {
        line += ` ${t("dailyReflect__assignee_prefix")} ${task.assignees.map((a) => a.name).join(", ")}`;
      }
      if (task.category && !OTHER_CATEGORIES.includes(task.category)) {
        line += ` - ${task.category}`;
      }
      if (task.status === "done" && task.updated_at) {
        const date = new Date(task.updated_at.includes("T") ? task.updated_at : `${task.updated_at}Z`);
        const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        line += ` [${timeStr}]`;
      }
      return line;
    },
    [t],
  );

  const generate = useCallback(
    (all: Task[], done: Task[], pending: Task[]) => {
      if (all.length === 0) {
        setGeneratedText("");
        return;
      }
      const lines = [`📊 ${t("dailyReflect__title")} - ${new Date().toLocaleDateString()}`];
      if (done.length > 0) {
        lines.push("", `🎯 ${t("dailyReflect__completed_today_section")} (${done.length})`);
        done.forEach((task) => lines.push(`• ${formatTaskLine(task)}`));
      }
      if (pending.length > 0) {
        lines.push("", `⏳ ${t("dailyReflect__pending_section")} (${pending.length})`);
        pending.forEach((task) => lines.push(`• ${formatTaskLine(task)}`));
      }
      setGeneratedText(lines.join("\n"));
    },
    [t, formatTaskLine],
  );

  const applyTasks = useCallback(
    (pending: Task[], done: Task[]) => {
      const all = [...pending, ...done];
      setPendingTasks(pending);
      setDoneTodayTasks(done);
      setTodayTasks(all);
      generate(all, done, pending);
    },
    [generate],
  );

  const loadTodayData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (wsId && wsId !== "offline") {
        const res = await api.data.tasks.getDailyReport(wsId);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.tasks) {
            const tasks: Task[] = data.tasks;
            setTodayTasks(tasks);
            applyTasks(
              tasks.filter((task) => task.status !== "done"),
              tasks.filter((task) => task.status === "done"),
            );
            return;
          }
        }
      }

      const allTasks = await getTasks({});
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      applyTasks(
        allTasks.filter((task) => task.status !== "done"),
        allTasks.filter((task) => {
          if (task.status !== "done" || !task.updated_at) return false;
          const updatedDate = task.updated_at.includes("T")
            ? task.updated_at.split("T")[0]
            : task.updated_at.split(" ")[0];
          return updatedDate === todayStr;
        }),
      );
    } catch (error) {
      console.error("Failed to load today data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [wsId, applyTasks]);

  const fetchAutoConfig = useCallback(async () => {
    if (!wsId || wsId === "offline") return;
    try {
      const res = await api.workspaces.getNotificationConfig(wsId);
      if (!res.ok) return;
      const data = await res.json();
      const url = data.success && data.config?.discord_webhook_url;
      if (url) {
        setWebhookUrl(url);
        localStorage.setItem(WEBHOOK_STORAGE_KEY, url);
      }
    } catch (err) {
      console.error("Failed to fetch auto config:", err);
    }
  }, [wsId]);

  useEffect(() => {
    if (!show) return;
    void loadTodayData();
    void fetchAutoConfig();
  }, [show, loadTodayData, fetchAutoConfig]);

  function refresh() {
    generate(todayTasks, doneTodayTasks, pendingTasks);
  }

  function copyToClipboard() {
    if (!generatedText) return;
    void navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveWebhookSettings() {
    localStorage.setItem(WEBHOOK_STORAGE_KEY, webhookUrl);
  }

  async function sendToDiscord() {
    if (!generatedText || !webhookUrl) return;
    setIsSending(true);
    setSendError("");
    try {
      const discordFormattedText = generatedText.replace(
        /\(?(\d{1,2})\/(\d{1,2})\/(\d{4})\)?/g,
        (_match, month, day, year) => {
          const unix = Math.floor(new Date(Number(year), Number(month) - 1, Number(day)).getTime() / 1000);
          return `<t:${unix}:D>`;
        },
      );

      let discordText = discordFormattedText;
      for (const task of todayTasks) {
        const discordIds = task.assignees?.filter((a) => a.discord_id).map((a) => a.discord_id) || [];
        if (discordIds.length > 0 && task.title) {
          const icon = STATUS_ICONS[task.status] || "📌";
          const taskLineRegex = new RegExp(`(${escapeRegExp(icon)}\\s*${escapeRegExp(task.title)}[^\\n]*)`);
          const mentions = discordIds.map((id) => `<@${id}>`).join(" ");
          discordText = discordText.replace(taskLineRegex, `$1 ${mentions}`);
        }
      }

      const embed = {
        author: { name: t("dailyReflect__title"), icon_url: "attachment://logo.png" },
        description: discordText,
        color: parseInt("8B5CF6", 16),
        fields: [
          {
            name: "📊 Statistics",
            value: `✅ ${t("dailyReflect__completed_today_section")}: **${doneTodayTasks.length}**\n⏳ ${t("dailyReflect__pending_section")}: **${pendingTasks.length}**`,
            inline: true,
          },
          { name: "🕒 Report Time", value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
          { name: "📍 Source", value: "`Khun Phaen Tracker`", inline: true },
        ],
        footer: { text: "Khun Phaen Task Tracker ✨", icon_url: "attachment://logo.png" },
        timestamp: new Date().toISOString(),
      };

      const logoResponse = await fetch(withBase("/logo.png"));
      if (!logoResponse.ok) throw new Error("Failed to load logo asset");
      const logoBlob = await logoResponse.blob();

      const formData = new FormData();
      formData.append("payload_json", JSON.stringify({ embeds: [embed] }));
      formData.append("files[0]", logoBlob, "logo.png");

      const response = await fetch(webhookUrl, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to send");

      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 3000);
    } catch (err) {
      console.error("Discord Webhook Error:", err);
      setSendError(t("dailyReflect__send_error"));
    } finally {
      setIsSending(false);
    }
  }

  return {
    todayTasks,
    doneTodayTasks,
    pendingTasks,
    generatedText,
    isLoading,
    copied,
    webhookUrl,
    setWebhookUrl,
    isSending,
    sendSuccess,
    sendError,
    refresh,
    copyToClipboard,
    saveWebhookSettings,
    sendToDiscord,
  };
}
