"use client";

import Link from "next/link";
import { api, useApi } from "@/lib/api";
import { Icon, type IconName } from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/ui";

type Item = { id: number; type: "pay" | "late" | "due" | "sms"; title: string; text: string; time: string; unread: boolean };
type Resp = { groups: { title: string; items: Item[] }[]; unread: number };

const TYPES: Record<Item["type"], [string, string, IconName]> = {
  pay: ["var(--green-soft)", "var(--green)", "check"],
  late: ["var(--orange-soft)", "var(--orange)", "alert"],
  due: ["var(--blue-soft)", "var(--blue)", "clock"],
  sms: ["var(--gray-soft)", "var(--ink-2)", "msg"],
};

export default function Notifications() {
  const { data, error, reload } = useApi<Resp>("/notifications");

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    reload();
  }

  return (
    <div className="m-shell no-nav">
      <div style={{ padding: "28px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/m" aria-label="Orqaga" className="icon-btn">
          <Icon name="back" size={22} />
        </Link>
        <h1 style={{ margin: 0, flex: 1, fontSize: 20, fontWeight: 800 }}>Bildirishnomalar</h1>
        <button onClick={readAll} disabled={!data?.unread} style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "var(--green)", height: 44, padding: 0 }}>
          Hammasini o&apos;qish
        </button>
      </div>

      {error && (
        <div className="m-pad" style={{ marginTop: 18 }}>
          <ErrorBox text={error} onRetry={reload} />
        </div>
      )}
      {!data && !error && (
        <div className="m-pad" style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Loading key={i} h={70} />
          ))}
        </div>
      )}
      {data?.groups.length === 0 && (
        <div className="m-pad" style={{ marginTop: 18 }}>
          <div className="m-card empty">Hozircha bildirishnoma yo&apos;q</div>
        </div>
      )}

      {data?.groups.map((g) => (
        <div key={g.title} style={{ margin: "18px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="m-section-title">{g.title}</span>
          {g.items.map((n) => {
            const [bg, fg, icon] = TYPES[n.type] || TYPES.sms;
            return (
              <div key={n.id} style={{ display: "flex", gap: 12, padding: 12, borderRadius: 16, background: n.unread ? "#fff" : "var(--bg)", border: "1px solid var(--line)" }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={icon} size={18} color={fg} />
                </span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{n.time}</span>
                  </div>
                  <span style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>{n.text}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
