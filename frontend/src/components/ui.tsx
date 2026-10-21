"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { money, type Status, statusClass } from "@/lib/format";

export function Toggle({ on, onChange, label }: { on: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <span className={`toggle${on ? " on" : ""}`}>
      <input type="checkbox" checked={on} aria-label={label} onChange={(e) => onChange?.(e.target.checked)} />
      <span className="knob" />
    </span>
  );
}

export function Avatar({
  text,
  size = 40,
  radius,
  status,
  fontSize,
  style,
}: {
  text: string;
  size?: number;
  radius?: number | string;
  status?: Status;
  fontSize?: number;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`av ${status ? statusClass(status) : ""}`}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), fontSize: fontSize ?? Math.round(size * 0.33), ...style }}
    >
      {text}
    </span>
  );
}

export function Logo({ size = 36, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.31),
        background: inverted ? "#fff" : "var(--green)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name="book" size={Math.round(size * 0.55)} color={inverted ? "var(--green)" : "#fff"} />
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2>{title}</h2>
          <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Yopish">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

let toastSetter: ((s: string | null) => void) | null = null;
export function toast(message: string) {
  toastSetter?.(message);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => pages <= 5 || n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <div className="pager">
      <button aria-label="Oldingi sahifa" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {nums.map((n) => (
        <button key={n} className={n === page ? "on" : ""} onClick={() => onPage(n)}>
          {n}
        </button>
      ))}
      <button aria-label="Keyingi sahifa" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}

export function Stat({ k, v, s, hero, color }: { k: string; v: ReactNode; s?: ReactNode; hero?: boolean; color?: string }) {
  return (
    <div className={`stat${hero ? " hero" : ""}`}>
      <span className="k">{k}</span>
      <span className="v" style={color ? { color } : undefined}>
        {v}
      </span>
      {s !== undefined && <span className="s">{s}</span>}
    </div>
  );
}

export function Sum({ n, unit = "so'm", unitSize = 14 }: { n: number; unit?: string; unitSize?: number }) {
  return (
    <>
      {money(n)} <span style={{ fontSize: unitSize }}>{unit}</span>
    </>
  );
}

export function Field({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Loading({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h }} aria-label="Yuklanmoqda" />;
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="err" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span>{text}</span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  );
}

/** Ikki ustunli oylik diagramma (Berilgan / Undirilgan) */
export function GroupedBars({
  data,
  height = 220,
  axis = true,
  values = false,
}: {
  data: { label: string; given: number; collected: number }[];
  height?: number;
  axis?: boolean;
  values?: boolean;
}) {
  const maxRaw = Math.max(1, ...data.flatMap((d) => [d.given, d.collected]));
  const step = maxRaw > 8_000_000 ? 4_000_000 : maxRaw > 4_000_000 ? 2_000_000 : maxRaw > 2_000_000 ? 1_000_000 : 500_000;
  const max = Math.ceil(maxRaw / step / 4) * step * 4 || step * 4;
  const ticks = [4, 3, 2, 1, 0].map((i) => (max / 4) * i);
  const mln = (n: number) => (n === 0 ? "0" : `${+(n / 1_000_000).toFixed(1)} mln`);
  const barArea = values ? height - 22 : height;
  const cols = `repeat(${data.length}, minmax(0, 1fr))`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {axis && (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height, fontSize: 11, color: "var(--muted)", textAlign: "right", width: 40, flexShrink: 0 }}>
            {ticks.map((t) => (
              <span key={t}>{mln(t)}</span>
            ))}
          </div>
        )}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "end", borderBottom: "1px solid var(--line)", height, minWidth: 0 }}>
          {data.map((m) => (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6, height: "100%" }}>
              {values && (
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
                  {+(m.given / 1e6).toFixed(1)} / {+(m.collected / 1e6).toFixed(2)}
                </span>
              )}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <div title={`${m.label}: berilgan ${money(m.given)}`} style={{ width: 22, height: Math.round((m.given / max) * barArea), borderRadius: "6px 6px 0 0", background: "var(--green)" }} />
                <div title={`${m.label}: undirilgan ${money(m.collected)}`} style={{ width: 22, height: Math.round((m.collected / max) * barArea), borderRadius: "6px 6px 0 0", background: "var(--mint-bar)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, marginLeft: axis ? 52 : 0, fontSize: 12, color: "var(--muted)", textAlign: "center", fontWeight: 600 }}>
        {data.map((m) => (
          <span key={m.label}>{m.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ink-2)", flexWrap: "wrap" }}>
      {items.map(([color, label]) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
