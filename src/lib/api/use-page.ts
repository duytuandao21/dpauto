"use client";
import { useEffect, useState } from "react";
import { request } from "./client";
export function useApiPage<T>(path: string, reload: number) {
  const [cursor, setCursor] = useState(""),
    [previous, setPrevious] = useState<string[]>([]),
    [data, setData] = useState<T[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    setCursor("");
    setPrevious([]);
  }, [path]);
  useEffect(() => {
    const a = new AbortController();
    setLoading(true);
    setData([]);
    setError("");
    const q =
      path +
      (path.includes("?") ? "&" : "?") +
      "limit=20" +
      (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    request<T[]>(q, { signal: a.signal })
      .then((r) => {
        if (!a.signal.aborted) {
          setData(r.data);
          setNext(r.page?.nextCursor || null);
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!a.signal.aborted) setLoading(false);
      });
    return () => a.abort();
  }, [path, cursor, reload]);
  return {
    data,
    pageNumber: previous.length + 1,
    loading,
    error,
    canPrevious: !!previous.length,
    canNext: !!next && !error,
    back: () => {
      setCursor(previous.at(-1) || "");
      setPrevious(previous.slice(0, -1));
    },
    forward: () => {
      if (next) {
        setPrevious([...previous, cursor]);
        setCursor(next);
      }
    },
  };
}
