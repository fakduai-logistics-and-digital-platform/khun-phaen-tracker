"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { translate } from "@/lib/i18n";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type KeyValue = { key: string; value: string; enabled: boolean };
export type AuthType = "none" | "bearer" | "basic" | "apikey";
export type BodyType = "none" | "json" | "form" | "raw";
export type WsState = "disconnected" | "connecting" | "connected" | "error";
export type WsMessage = { direction: "sent" | "received"; content: string; time: number };

const STORAGE_KEY = "api-tester";
const DEFAULT_HEADERS: KeyValue[] = [{ key: "Content-Type", value: "application/json", enabled: true }];

/** Secrets (tokens, passwords, API key values) are kept in memory only, never written to localStorage. */
type Persisted = {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
  authType: AuthType;
  basicUser: string;
  apiKeyHeader: string;
};

export function useApiTester() {
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<KeyValue[]>(DEFAULT_HEADERS);
  const [queryParams, setQueryParams] = useState<KeyValue[]>([]);
  const [bodyType, setBodyType] = useState<BodyType>("json");
  const [bodyContent, setBodyContent] = useState("{\n  \n}");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [bearerToken, setBearerToken] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [basicPass, setBasicPass] = useState("");
  const [apiKeyHeader, setApiKeyHeader] = useState("");
  const [apiKeyValue, setApiKeyValue] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ code: 0, text: "" });
  const [time, setTime] = useState(0);
  const [size, setSize] = useState(0);
  const [responseHeaders, setResponseHeaders] = useState<{ key: string; value: string }[]>([]);
  const [responseBody, setResponseBody] = useState("");
  const [error, setError] = useState("");

  const [wsUrl, setWsUrl] = useState("");
  const [wsState, setWsState] = useState<WsState>("disconnected");
  const [wsMessages, setWsMessages] = useState<WsMessage[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved) as Partial<Persisted>;
        setMethod(d.method || "GET");
        setUrl(d.url || "");
        setHeaders(d.headers || DEFAULT_HEADERS);
        setQueryParams(d.queryParams || []);
        setBodyType(d.bodyType || "json");
        setBodyContent(d.bodyContent || "{\n  \n}");
        setAuthType(d.authType || "none");
        setBasicUser(d.basicUser || "");
        setApiKeyHeader(d.apiKeyHeader || "");
      }
    } catch {
      /* Ignore malformed saved state. */
    }
    hydrated.current = true;
    return () => socket.current?.close();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const state: Persisted = {
      method,
      url,
      headers,
      queryParams,
      bodyType,
      bodyContent,
      authType,
      basicUser,
      apiKeyHeader,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [method, url, headers, queryParams, bodyType, bodyContent, authType, basicUser, apiKeyHeader]);

  const fullUrl = useCallback(() => {
    if (!url) return "";
    const params = queryParams.filter((p) => p.enabled && p.key);
    if (params.length === 0) return url;
    const qs = params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join("&");
    return url + (url.includes("?") ? "&" : "?") + qs;
  }, [url, queryParams]);

  const send = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    setResponseBody("");
    setResponseHeaders([]);
    setStatus({ code: 0, text: "" });
    const started = performance.now();

    try {
      const requestHeaders: Record<string, string> = {};
      for (const h of headers) if (h.enabled && h.key.trim()) requestHeaders[h.key.trim()] = h.value;
      if (authType === "bearer" && bearerToken) requestHeaders.Authorization = `Bearer ${bearerToken}`;
      else if (authType === "basic" && basicUser)
        requestHeaders.Authorization = `Basic ${btoa(`${basicUser}:${basicPass}`)}`;
      else if (authType === "apikey" && apiKeyHeader) requestHeaders[apiKeyHeader] = apiKeyValue;

      const options: RequestInit = { method, headers: requestHeaders };
      if (!["GET", "HEAD"].includes(method) && bodyType !== "none") {
        if (bodyType === "json") {
          options.body = bodyContent;
          if (!requestHeaders["Content-Type"]) requestHeaders["Content-Type"] = "application/json";
        } else if (bodyType === "form") {
          const form = new FormData();
          try {
            const parsed = JSON.parse(bodyContent);
            if (typeof parsed === "object" && parsed !== null) {
              for (const [k, v] of Object.entries(parsed)) form.append(k, String(v));
            }
          } catch {
            form.append("data", bodyContent);
          }
          options.body = form;
        } else {
          options.body = bodyContent;
        }
      }

      const response = await fetch(fullUrl(), options);
      setTime(Math.round(performance.now() - started));
      setStatus({ code: response.status, text: response.statusText });
      const list: { key: string; value: string }[] = [];
      response.headers.forEach((value, key) => list.push({ key, value }));
      setResponseHeaders(list);
      const text = await response.text();
      setResponseBody(text);
      setSize(new Blob([text]).size);
    } catch (e) {
      setError(e instanceof Error ? e.message : translate("apiTester__request_failed"));
    } finally {
      setLoading(false);
    }
  }, [
    url,
    headers,
    authType,
    bearerToken,
    basicUser,
    basicPass,
    apiKeyHeader,
    apiKeyValue,
    method,
    bodyType,
    bodyContent,
    fullUrl,
  ]);

  const connectWs = useCallback(() => {
    if (!wsUrl.trim()) return;
    setWsState("connecting");
    try {
      const ws = new WebSocket(wsUrl);
      socket.current = ws;
      ws.onopen = () => setWsState("connected");
      ws.onmessage = (event) =>
        setWsMessages((prev) => [...prev, { direction: "received", content: String(event.data), time: Date.now() }]);
      ws.onerror = () => setWsState("error");
      ws.onclose = () => {
        setWsState("disconnected");
        socket.current = null;
      };
    } catch {
      setWsState("error");
    }
  }, [wsUrl]);

  const disconnectWs = useCallback(() => {
    socket.current?.close();
    socket.current = null;
    setWsState("disconnected");
  }, []);

  const sendWs = useCallback((message: string) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !message.trim()) return false;
    ws.send(message);
    setWsMessages((prev) => [...prev, { direction: "sent", content: message, time: Date.now() }]);
    return true;
  }, []);

  return {
    request: {
      method,
      setMethod,
      url,
      setUrl,
      headers,
      setHeaders,
      queryParams,
      setQueryParams,
      bodyType,
      setBodyType,
      bodyContent,
      setBodyContent,
      authType,
      setAuthType,
      bearerToken,
      setBearerToken,
      basicUser,
      setBasicUser,
      basicPass,
      setBasicPass,
      apiKeyHeader,
      setApiKeyHeader,
      apiKeyValue,
      setApiKeyValue,
    },
    response: { loading, status, time, size, headers: responseHeaders, body: responseBody, error },
    send,
    ws: {
      url: wsUrl,
      setUrl: setWsUrl,
      state: wsState,
      messages: wsMessages,
      clear: () => setWsMessages([]),
      connect: connectWs,
      disconnect: disconnectWs,
      send: sendWs,
    },
  };
}
