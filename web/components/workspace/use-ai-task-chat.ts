"use client";

import { withBase } from "@/lib/base-path";
import { taskPath } from "@/lib/routes";
import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api/apis";
import type { Task } from "@/lib/types";

export type ChatMode = "search" | "generate";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  results?: Array<{ task: Task; score: number }>;
  generatedTask?: any;
  showAssignPrompt?: boolean;
  createdTaskUrl?: string;
  createdTask?: any;
  aiResponse?: string;
}

interface Options {
  workspaceId: string | undefined;
  myAssigneeId: string | number | undefined;
  onTaskCreated: () => void | Promise<void>;
}

export function useAiTaskChat({ workspaceId, myAssigneeId, onTaskCreated }: Options) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<ChatMode>("search");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);

  const pushUserMessage = useCallback((message: string) => {
    history.current = [...history.current, message];
    historyIndex.current = -1;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setError("");
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || !workspaceId || loading) return;
    pushUserMessage(message);
    setLoading(true);

    try {
      const res = await api.data.ai.chatTasks(workspaceId, { message, limit: 5, task_limit: 100 });
      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!res.ok) throw new Error(data.error || `AI chat failed (${res.status})`);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer || "เจอ task ที่เกี่ยวข้อง", results: data.results || [] },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI chat failed");
    } finally {
      setLoading(false);
    }
  }, [input, workspaceId, loading, pushUserMessage]);

  const generate = useCallback(async () => {
    const message = input.trim();
    if (!message || !workspaceId || generating) return;
    pushUserMessage(message);
    setGenerating(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "กำลังวิเคราะห์และสร้าง task..." }]);

    try {
      const res = await api.data.ai.generateTask(workspaceId, { prompt: message });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Task generation failed (${res.status})`);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "ฉันสร้าง task ให้แล้ว ต้องการ assign ให้คุณด้วยไหม?",
          generatedTask: data.task,
          showAssignPrompt: true,
          aiResponse: data.ai_response || data.raw_response || "",
        },
      ]);
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      setError(e instanceof Error ? e.message : "Task generation failed");
    } finally {
      setGenerating(false);
    }
  }, [input, workspaceId, generating, pushUserMessage]);

  const createTask = useCallback(
    async (generatedTask: any, assignToMe: boolean) => {
      if (!workspaceId) return;

      const today = new Date().toISOString().split("T")[0];
      const due = new Date();
      due.setDate(due.getDate() + 7);

      try {
        const taskData: any = {
          title: generatedTask.title || "",
          category: generatedTask.category || "feature",
          priority: generatedTask.priority || "medium",
          notes: generatedTask.notes || "",
          project: generatedTask.project || "",
          date: today,
          due_date: due.toISOString().split("T")[0],
          duration_minutes: 60,
          status: "todo",
        };

        if (Array.isArray(generatedTask.checklist)) {
          taskData.checklist = generatedTask.checklist.map((text: string, index: number) => ({
            id: `${Date.now()}-${index}`,
            text,
            completed: false,
          }));
        }
        if (assignToMe && myAssigneeId) taskData.assignee_ids = [myAssigneeId];

        const res = await api.data.tasks.create(workspaceId, taskData);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create task");

        const task = data.task || data;
        let taskId = task.id || task._id;
        if (typeof taskId === "object" && taskId !== null) taskId = taskId.$oid || String(taskId);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "สร้าง task สำเร็จแล้ว!",
            createdTaskUrl: `${window.location.origin}${withBase(taskPath(workspaceId, taskId))}`,
            createdTask: task,
          },
        ]);
        await onTaskCreated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create task");
      }
    },
    [workspaceId, myAssigneeId, onTaskCreated],
  );

  const cancelCreation = useCallback(() => {
    setMessages((prev) => [...prev, { role: "assistant", content: "ยกเลิกการสร้าง task แล้ว" }]);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void (mode === "search" ? send() : generate());
        return;
      }

      const items = history.current;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length === 0) return;
        if (historyIndex.current === -1) historyIndex.current = items.length - 1;
        else if (historyIndex.current > 0) historyIndex.current--;
        setInput(items[historyIndex.current] || "");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex.current === -1) return;
        if (historyIndex.current < items.length - 1) {
          historyIndex.current++;
          setInput(items[historyIndex.current] || "");
        } else {
          historyIndex.current = -1;
          setInput("");
        }
      }
    },
    [mode, send, generate],
  );

  return {
    input,
    setInput,
    loading,
    generating,
    error,
    mode,
    setMode,
    messages,
    send,
    generate,
    createTask,
    cancelCreation,
    handleKeyDown,
  };
}
