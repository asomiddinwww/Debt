"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { dayMonth, initials, money } from "@/lib/format";
import type { Dashboard } from "@/lib/types";
import { useSession } from "@/components/session";
import { MobileNav } from "@/components/MobileNav";
import { Icon, type IconName } from "@/components/Icon";
import { Avatar, ErrorBox, Loading } from "@/components/ui";
import { PaymentModal } from "@/components/forms";

type Filter = "all" | "overdue" | "week";

export default function MobileHome() {
  const { me } = useSession();
  const { data, error, reload } = useApi<Dashboard>("/dashboard");
  const [filter, setFilter] = useState<Filter>("all");
  const [payOpen, setPayOpen] = useState(false);

  const first = me.user.name.split(" ")[0];
  const debtors = (data?.debtors || []).filter((c) =>
    filter === "overdue" ? c.status === "late" : filter === "week" ? c.status === "ok" && c.daysLeft !== null && c.daysLeft <= 7 : true,
  );

  const action = (label: string, icon: IconName, href?: string, onClick?: () => void) => {
    const inner = (
      <>
        <span style={{ width: 52, height: 52, borderRadius: 16, background: "#fff", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={22} color="var(--green)" />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      </>
    );
    const style = { textDecoration: "none", color: "var(--ink)", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 8, background: "none", border: "none", padding: 0 };
    return href ? (
      <Link href={href} style={style}>
        {inner}
      </Link>
    ) : (
      <button onClick={onClick} style={style}>
        {inner}
      </button>
    );
  };

  return (
    <div className="m-shell">
      <div style={{ padding: "28px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar text={initials(me.user.name)} size={44} radius={14} fontSize={16} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Assalomu alaykum,</span>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{first}</span>
          </div>
        </div>
        <Link href="/m/notifications" aria-label="Bildirishnomalar" className="icon-btn">
          <Icon name="bell" size={22} sw={1.8} />
          {!!data?.unread && (
            <span style={{ position: "absolute", top: 10, right: 11, width: 8, height: 8, borderRadius: "50%", background: "#D9480F", border: "2px solid #fff" }} />
          )}
        </Link>
      </div>

      <div style={{ margin: "20px 20px 0", padding: 20, borderRadius: 24, background: "var(--green)", color: "#fff", display: "flex", flexDirection: "column", gap: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160, borderRadius: "50%", border: "28px solid var(--green-ring)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
          <span style={{ fontSize: 13, color: "var(--mint)", fontWeight: 500 }}>Sizga qarzdorlar</span>
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>
            {data ? money(data.owed) : "—"} <span style={{ fontSize: 18, fontWeight: 600 }}>so&apos;m</span>
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, position: "relative" }}>
          <div style={{ background: "var(--green-dark)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--mint)" }}>Mening qarzim</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{data ? money(data.myDebt) : "—"} so&apos;m</span>
          </div>
          <div style={{ background: "var(--green-dark)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, color: "var(--mint)" }}>Bu oy undirildi</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{data ? money(data.collectedMonth) : "—"} so&apos;m</span>
          </div>
        </div>
      </div>

      <div style={{ margin: "18px 20px 0", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        {action("Qarz berdim", "give", "/m/add?dir=give")}
        {action("Qarz oldim", "take", "/m/add?dir=take")}
        {action("To'lov", "cash", undefined, () => setPayOpen(true))}
        {action("Hisobot", "chart", "/m/reports")}
      </div>

      <div style={{ margin: "22px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Qarzdorlar</h2>
        <Link href="/m/clients" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          Barchasi
        </Link>
      </div>

      <div className="hscroll" style={{ margin: "12px 20px 0" }}>
        <button className={`chip chip-lg${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>
          Barchasi · {data?.counts.all ?? 0}
        </button>
        <button className={`chip chip-lg${filter === "overdue" ? " on" : ""}`} onClick={() => setFilter("overdue")}>
          Muddati o&apos;tgan · {data?.counts.overdue ?? 0}
        </button>
        <button className={`chip chip-lg${filter === "week" ? " on" : ""}`} onClick={() => setFilter("week")}>
          Bu hafta
        </button>
      </div>

      <div style={{ margin: "12px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        {error && <ErrorBox text={error} onRetry={reload} />}
        {!data && !error && [0, 1, 2].map((i) => <Loading key={i} h={72} />)}
        {data && debtors.length === 0 && <div className="m-card empty">Bu bo&apos;limda qarzdor yo&apos;q</div>}
        {debtors.map((c) => (
          <Link key={c.id} href={`/m/client?id=${c.id}`} className="m-list-item">
            <Avatar text={c.initials} size={42} radius={13} status={c.status} fontSize={14} />
            <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{c.name}</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Muddat: {dayMonth(c.nextDue)}</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{money(c.remaining)}</span>
              <span className={`badge ${c.status === "late" ? "b-late" : "b-ok"}`} style={{ fontSize: 11, padding: "3px 8px" }}>
                {c.dueLabel}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <MobileNav />
      {payOpen && <PaymentModal onClose={() => setPayOpen(false)} onSaved={reload} />}
    </div>
  );
}
