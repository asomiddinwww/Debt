"use client";

import { useState } from "react";
import { downloadUrl, useApi } from "@/lib/api";
import { money } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useSession } from "@/components/session";
import { MobileNav } from "@/components/MobileNav";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading } from "@/components/ui";

const PERIODS = [
  ["week", "Hafta"],
  ["month", "Oy"],
  ["year", "Yil"],
] as const;

export default function MobileReports() {
  const { can } = useSession();
  const [period, setPeriod] = useState<string>("month");
  const allowed = can("view_reports");
  const { data, error, reload } = useApi<Report>(allowed ? `/reports?period=${period}` : null);

  const max = Math.max(1, ...(data?.monthly || []).map((m) => m.collected));
  const totalStatus = (data?.status.onTime || 0) + (data?.status.late || 0) || 1;
  const onPct = data ? Math.round((data.status.onTime / totalStatus) * 100) : 0;

  return (
    <div className="m-shell">
      <div style={{ padding: "28px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>Hisobot</h1>
        {allowed && (
          <a href={downloadUrl("/reports/export")} aria-label="Hisobotni yuklab olish" className="icon-btn">
            <Icon name="download" size={20} />
          </a>
        )}
      </div>

      {!allowed && (
        <div className="m-pad" style={{ marginTop: 18 }}>
          <div className="m-card empty">Hisobotlarni ko&apos;rish uchun ruxsatingiz yo&apos;q. Do&apos;kon egasiga murojaat qiling.</div>
        </div>
      )}

      {allowed && (
        <>
          <div style={{ margin: "14px 20px 0", padding: 4, borderRadius: 14, background: "var(--soft-2)", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
            {PERIODS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                style={{
                  height: 38, borderRadius: 11, border: "none", background: period === k ? "#fff" : "transparent", color: period === k ? "var(--green)" : "var(--ink-2)",
                  fontSize: 13, fontWeight: period === k ? 800 : 600, boxShadow: period === k ? "0 1px 3px rgba(19,32,26,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div className="m-pad" style={{ marginTop: 14 }}>
              <ErrorBox text={error} onRetry={reload} />
            </div>
          )}
          {!data && !error && (
            <div className="m-pad" style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
              <Loading h={140} />
              <Loading h={180} />
            </div>
          )}

          {data && (
            <>
              <div style={{ margin: "14px 20px 0", padding: 18, borderRadius: 22, background: "var(--green)", color: "#fff", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 13, color: "var(--mint)", fontWeight: 600 }}>{data.label} undirildi</span>
                  <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>
                    {money(data.collected)} <span style={{ fontSize: 16 }}>so&apos;m</span>
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div style={{ background: "var(--green-dark)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--mint)" }}>Berildi</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{money(data.given)}</span>
                  </div>
                  <div style={{ background: "var(--green-dark)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--mint)" }}>Undirish darajasi</span>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{data.rate}%</span>
                  </div>
                </div>
              </div>

              <section aria-label="Oylik undirish" className="m-card" style={{ margin: "14px 20px 0", padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Undirish, mln so&apos;m</h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>So&apos;nggi 6 oy</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10, alignItems: "end", height: 120 }}>
                  {data.monthly.map((b, i) => (
                    <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-2)" }}>{+(b.collected / 1e6).toFixed(2)}</span>
                      <div style={{ width: "100%", height: Math.max(2, Math.round((b.collected / max) * 76)), borderRadius: "8px 8px 4px 4px", background: i === data.monthly.length - 1 ? "var(--green)" : "var(--mint-bar-2)" }} />
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-label="Qarz holati" className="m-card" style={{ margin: "14px 20px 0", padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Qarz holati</h2>
                <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", gap: 2, background: "var(--line-2)" }}>
                  <div style={{ width: `${onPct}%`, background: "var(--green)" }} />
                  <div style={{ width: `${100 - onPct}%`, background: "var(--amber)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8, flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--green)" }} />
                    Vaqtida · <b>{money(data.status.onTime)}</b>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--amber)" }} />
                    Kechikkan · <b>{money(data.status.late)}</b>
                  </span>
                </div>
              </section>
            </>
          )}
        </>
      )}
      <MobileNav />
    </div>
  );
}
