"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { money } from "@/lib/format";
import type { Client } from "@/lib/types";
import { MobileNav } from "@/components/MobileNav";
import { Icon } from "@/components/Icon";
import { Avatar, ErrorBox, Loading } from "@/components/ui";
import { ClientModal } from "@/components/forms";

type Resp = { clients: Client[]; total: number; totalRemaining: number };

const FILTERS = [
  ["all", "Barchasi"],
  ["debtors", "Qarzdorlar"],
  ["late", "Kechikkan"],
  ["paid", "Yopilgan"],
] as const;

const SORTS = [
  ["amount", "Qarz miqdori bo'yicha"],
  ["due", "Muddat bo'yicha"],
  ["name", "Ism bo'yicha"],
] as const;

export default function MobileClients() {
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState(0);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useApi<Resp>(`/clients?filter=${filter}&sort=${SORTS[sort][0]}&q=${encodeURIComponent(q)}`);

  const noteColor = (c: Client) => (c.status === "late" ? "var(--orange)" : c.status === "paid" || c.status === "new" ? "var(--muted)" : "var(--green)");

  return (
    <div className="m-shell">
      <div style={{ padding: "28px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>Mijozlar</h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {data ? `${data.total} ta mijoz · ${money(data.totalRemaining)} so'm` : "Yuklanmoqda…"}
          </span>
        </div>
        <button aria-label="Mijoz qo'shish" onClick={() => setAdding(true)} className="icon-btn" style={{ border: "none", background: "var(--green)" }}>
          <Icon name="userPlus" size={22} color="#fff" />
        </button>
      </div>

      <label htmlFor="m-search" className="search" style={{ margin: "16px 20px 0", height: 48, borderRadius: 16, padding: "0 14px", gap: 10 }}>
        <Icon name="search" size={18} color="var(--muted)" />
        <input id="m-search" placeholder="Ism yoki telefon raqam" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: 15 }} />
      </label>

      <div className="hscroll" style={{ margin: "12px 20px 0" }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`chip chip-lg${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ margin: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>Saralash:</span>
        <button
          onClick={() => setSort((s) => (s + 1) % SORTS.length)}
          style={{ border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "var(--green)", display: "flex", alignItems: "center", gap: 4, padding: 0, height: 44 }}
        >
          {SORTS[sort][1]}
          <Icon name="chevronDown" size={16} color="var(--green)" sw={2.2} />
        </button>
      </div>

      <div style={{ margin: "0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {error && <ErrorBox text={error} onRetry={reload} />}
        {!data && !error && [0, 1, 2, 3].map((i) => <Loading key={i} h={62} />)}
        {data?.clients.length === 0 && <div className="m-card empty">Mijoz topilmadi</div>}
        {data?.clients.map((c) => (
          <Link key={c.id} href={`/m/client?id=${c.id}`} className="m-list-item" style={{ borderRadius: 16, padding: "10px 12px" }}>
            <Avatar text={c.initials} size={40} radius={12} status={c.status} fontSize={13} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.phone || "Telefon kiritilmagan"}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{money(c.remaining)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: noteColor(c) }}>{c.dueLabel}</span>
            </span>
          </Link>
        ))}
      </div>

      <MobileNav />
      {adding && <ClientModal onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  );
}
