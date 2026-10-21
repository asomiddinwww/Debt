"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/api";
import { dm, initials, money } from "@/lib/format";
import type { Dashboard } from "@/lib/types";
import { useSession } from "@/components/session";
import { Icon } from "@/components/Icon";
import { Avatar, ErrorBox, GroupedBars, Legend, Loading, Logo } from "@/components/ui";
import { DebtModal } from "@/components/forms";
import { StoreBottomNav } from "@/components/StoreNav";

const NAV = [
  ["/dashboard", "Boshqaruv paneli"],
  ["/crm/clients", "Mijozlar"],
  ["/crm/debts", "Qarzlar"],
  ["/crm/payments", "To'lovlar"],
  ["/crm/reports", "Hisobotlar"],
] as const;

const PERIODS = [
  ["week", "Hafta"],
  ["month", "Oy"],
  ["year", "Yil"],
] as const;

export default function DesktopDashboard() {
  const { me } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState("month");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useApi<Dashboard>(`/dashboard?period=${period}`);

  const card = { background: "#fff", border: "1px solid var(--line)", borderRadius: 20, padding: 22, display: "flex", flexDirection: "column" as const, gap: 14 };
  const pct = data?.recoveryPct ?? 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
        <div className="desk-wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px 28px" }}>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--ink)" }}>
            <Logo />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>Qarz Daftar</span>
          </Link>
          <nav aria-label="Asosiy menyu" className="desk-only" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={href === "/dashboard" ? "page" : undefined}
                style={{
                  height: 40, padding: "0 14px", borderRadius: 10, textDecoration: "none", display: "flex", alignItems: "center", fontSize: 14,
                  background: href === "/dashboard" ? "var(--green-soft)" : "transparent",
                  color: href === "/dashboard" ? "var(--green)" : "var(--ink-2)",
                  fontWeight: href === "/dashboard" ? 700 : 600,
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="desk-only" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/crm/clients?q=${encodeURIComponent(q)}`);
              }}
            >
              <label htmlFor="d-search" className="search" style={{ height: 42, width: 240, maxWidth: "100%", background: "var(--field)" }}>
                <Icon name="search" size={18} color="var(--muted)" />
                <input id="d-search" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </form>
            <button className="btn btn-primary" style={{ height: 42, padding: "0 16px" }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} color="#fff" sw={2.4} />
              Yangi qarz
            </button>
            <Link href="/crm/settings" aria-label="Sozlamalar">
              <Avatar text={initials(me.user.name)} size={42} radius={12} fontSize={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="desk-main">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Boshqaruv paneli</h1>
            <span style={{ fontSize: 14, color: "var(--muted)" }}>
              {me.store?.name}
              {me.store?.branch ? ` · ${me.store.branch}` : ""}
            </span>
          </div>
          <div className="seg seg-white">
            {PERIODS.map(([k, label]) => (
              <button key={k} className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBox text={error} onRetry={reload} />}

        <section aria-label="Asosiy ko'rsatkichlar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            ["Jami berilgan", data?.totalGiven, "so'm · barcha vaqt", undefined, true],
            ["Undirildi", data?.totalCollected, `so'm · ${pct}% qaytdi`, "var(--green)", false],
            ["Qoldiq qarz", data?.owed, `so'm · ${data?.activeClients ?? 0} mijozda`, undefined, false],
            ["Muddati o'tgan", data?.overdueSum, `so'm · ${data?.overdueClients ?? 0} mijoz`, "var(--orange)", false],
          ].map(([k, v, s, color, hero]) => (
            <div key={k as string} style={{ background: hero ? "var(--green)" : "#fff", color: hero ? "#fff" : "var(--ink)", border: hero ? "none" : "1px solid var(--line)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13, color: hero ? "var(--mint)" : "var(--muted)", fontWeight: 600 }}>{k as string}</span>
              <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: (color as string) || undefined }}>{data ? money(v as number) : "—"}</span>
              <span style={{ fontSize: 12, color: hero ? "var(--mint)" : "var(--muted)" }}>{s as string}</span>
            </div>
          ))}
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <section aria-label="Dinamika" style={{ ...card, flex: "999 1 560px", minWidth: 0, gap: 18 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{period === "week" ? "Haftalik dinamika" : period === "year" ? "Yillik dinamika" : "Oylik dinamika"}</h2>
              <Legend items={[["var(--green)", "Berilgan"], ["var(--mint-bar)", "Undirilgan"]]} />
            </div>
            {data ? <GroupedBars data={data.chart} /> : <Loading h={240} />}
          </section>

          <section aria-label="Undirish darajasi" style={{ ...card, flex: "1 1 300px", gap: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Undirish darajasi</h2>
            <div style={{ alignSelf: "center", width: 180, height: 180, borderRadius: "50%", background: `conic-gradient(var(--green) 0 ${pct}%, var(--green-soft) ${pct}% 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 132, height: 132, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "var(--green)" }}>{pct}%</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>qaytarildi</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>O&apos;z vaqtida</span>
                <b>{data?.onTimeClients ?? 0} mijoz</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Kechikkan</span>
                <b style={{ color: "var(--orange)" }}>{data?.overdueClients ?? 0} mijoz</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Yopilgan</span>
                <b>{data?.closedClients ?? 0} mijoz</b>
              </div>
            </div>
          </section>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch" }}>
          <section aria-label="Yaqin muddatlar" style={{ ...card, flex: "1 1 380px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Yaqin muddatlar</h2>
              <Link href="/crm/clients" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Barchasi
              </Link>
            </div>
            {!data && [0, 1, 2, 3].map((i) => <Loading key={i} h={64} />)}
            {data?.debtors.length === 0 && <div className="empty">Ochiq qarz yo&apos;q</div>}
            {data?.debtors.slice(0, 4).map((c) => {
              const late = c.status === "late";
              return (
                <Link
                  key={c.id}
                  href={`/crm/clients?id=${c.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: late ? "var(--orange-bg)" : "var(--green-softer)", textDecoration: "none", color: "var(--ink)" }}
                >
                  <Avatar text={c.initials} size={40} radius={12} status={c.status} fontSize={13} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                    <span style={{ fontSize: 12, color: late ? "var(--orange)" : "var(--green)", fontWeight: 600 }}>{late ? c.dueLabel.replace("o'tdi", "kechikdi") : c.dueLabel}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{money(c.remaining)}</span>
                </Link>
              );
            })}
          </section>

          <section aria-label="Oxirgi amallar" style={{ ...card, flex: "999 1 560px", minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Oxirgi amallar</h2>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead>
                  <tr style={{ background: "transparent" }}>
                    <th style={{ padding: "10px 8px" }}>Sana</th>
                    <th style={{ padding: "10px 8px" }}>Mijoz</th>
                    <th style={{ padding: "10px 8px" }}>Turi</th>
                    <th style={{ padding: "10px 8px" }}>Usul</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent.map((r, i) => {
                    const pay = r.type === "payment";
                    return (
                      <tr key={i}>
                        <td style={{ padding: "12px 8px", color: "var(--muted)" }}>{dm(r.date)}</td>
                        <td style={{ padding: "12px 8px", fontWeight: 700 }}>{r.client}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <span className={`badge ${pay ? "b-ok" : r.type === "take" ? "b-blue" : "b-paid"}`} style={{ padding: "3px 10px" }}>
                            {r.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", color: "var(--muted)" }}>{r.method}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 800, color: pay ? "var(--green)" : undefined }}>
                          {pay ? "−" : "+"} {money(r.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data?.recent.length === 0 && <div className="empty">Hali amal yo&apos;q</div>}
            </div>
          </section>
        </div>
      </main>
      {adding && <DebtModal onClose={() => setAdding(false)} onSaved={reload} />}
      <StoreBottomNav />
    </div>
  );
}
