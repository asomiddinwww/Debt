"use client";

import { useCallback, useEffect, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type Scope = "store" | "admin";
const KEYS: Record<Scope, string> = { store: "qd_token", admin: "qd_admin_token" };

export function getToken(scope: Scope = "store") {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEYS[scope]);
  } catch {
    return null;
  }
}

export function setToken(token: string | null, scope: Scope = "store") {
  try {
    if (token) localStorage.setItem(KEYS[scope], token);
    else localStorage.removeItem(KEYS[scope]);
  } catch {
    /* brauzer xotirasi yopiq bo'lsa ham ilova ishlashda davom etadi */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const scopeOf = (path: string): Scope => (path.startsWith("/admin") ? "admin" : "store");

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const scope = scopeOf(path);
  const token = getToken(scope);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method || (options.body ? "POST" : "GET"),
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Server bilan aloqa yo'q. Backend ishga tushirilganini tekshiring");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) {
      setToken(null, scope);
      if (typeof window !== "undefined") {
        window.location.href = scope === "admin" ? "/admin/login" : "/login";
      }
    }
    throw new ApiError(res.status, (data as { error?: string }).error || "Xatolik yuz berdi");
  }
  return data as T;
}

/** Fayl yuklab olish havolasi (CSV) */
export function downloadUrl(path: string) {
  const token = getToken(scopeOf(path));
  return `${API_URL}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token || "")}`;
}

const DATA_EVENT = "qd:data-changed";
/** Ochiq sahifadagi barcha useApi so'rovlarini yangilash */
export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_EVENT));
}

export function useApi<T>(path: string | null) {
  const [tick, setTick] = useState(0);
  const key = `${path}#${tick}`;
  // Oldingi ma'lumot yangi so'rov tugaguncha ko'rinib turadi
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!path) return;
    let alive = true;
    api<T>(path)
      .then((d) => alive && setState({ key, data: d, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ key, data: s.data, error: e.message })));
    return () => {
      alive = false;
    };
  }, [path, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  // Boshqa joyda ma'lumot o'zgarganda (masalan, pastki paneldagi "+" orqali qarz qo'shilganda) qayta yuklash
  useEffect(() => {
    window.addEventListener(DATA_EVENT, reload);
    return () => window.removeEventListener(DATA_EVENT, reload);
  }, [reload]);
  return { data: state.data, error: state.error, loading: !!path && state.key !== key, reload };
}
