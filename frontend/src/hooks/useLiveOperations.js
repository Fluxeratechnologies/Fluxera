import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, dashboardGet, dashboardHeaders } from "../api";

export function useLiveOperations(session) {
  const [operations, setOperations] = useState(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [eventPulse, setEventPulse] = useState(null);
  const lastEventId = useRef(0);
  const enabled = Boolean(session?.dashboardToken && session?.workspaceId);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await dashboardGet("/api/operations", session);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Live operations are unavailable");
      setOperations(payload); setError("");
      return payload;
    } catch (err) { setError(err.message || "Live operations are unavailable"); }
  }, [enabled, session]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    const poll = setInterval(refresh, 15000);
    return () => clearInterval(poll);
  }, [enabled, refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController(); let reconnect; let attempt = 0;
    const connect = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/live?after=${lastEventId.current}`, { headers: { ...dashboardHeaders(session), "Last-Event-ID": String(lastEventId.current) }, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error("Live stream unavailable");
        setConnected(true); attempt = 0;
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
        while (!controller.signal.aborted) {
          const chunk = await reader.read(); if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let latestEvent = null;
          while (buffer.includes("\n\n")) {
            const event = buffer.slice(0, buffer.indexOf("\n\n")); buffer = buffer.slice(buffer.indexOf("\n\n") + 2);
            const id = event.match(/^id:\s*(\d+)/m)?.[1];
            if (id) lastEventId.current = Number(id);
            const type = event.match(/^event:\s*(.+)$/m)?.[1]?.trim();
            if (type && type !== "heartbeat") {
              let data = {};
              try { data = JSON.parse(event.match(/^data:\s*(.+)$/m)?.[1] || "{}"); } catch { data = {}; }
              latestEvent = { id: Number(id || Date.now()), type, data };
            }
          }
          // A reconnect can deliver many queued events in one chunk. Refresh the
          // source of truth once, then acknowledge only the latest confirmed change.
          if (latestEvent) {
            await refresh();
            setEventPulse(latestEvent);
          }
        }
      } catch { if (!controller.signal.aborted) setError("Live stream paused — retrying."); }
      finally {
        setConnected(false);
        if (!controller.signal.aborted) {
          attempt += 1;
          reconnect = setTimeout(connect, Math.min(15000, 1000 * (2 ** attempt)));
        }
      }
    };
    connect();
    return () => { controller.abort(); clearTimeout(reconnect); };
  }, [enabled, refresh, session]);

  return { operations, error, connected, refresh, enabled, eventPulse };
}
