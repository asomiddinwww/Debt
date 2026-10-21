"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { dmy, money } from "@/lib/format";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, Pager, Stat, toast } from "@/components/ui";
import { AddStoreModal, StoreStatus, type StoreRow } from "@/components/adminParts";

type Plan = { id: number; name: string; tag: string; price: number; features: string[]; clientLimit: number | null };
type Log = { id: number; level: string; module: string; message: string; user_label: string; created_at: string };
type Resp = {
  stores: { total: number; newThisMonth: number; active: number; trial: number; blocked: number };
  users: { total: number; activeToday: number };
  revenueMonth: number;
  paidSubs: number;
  sms: { balance: number; capacity: number; low: boolean };
  list: StoreRow[];
  listTotal: number;
  page: number;
  pages: number;
  plans: Plan[];
  events: Log[];
};

const FILTERS = [
  ["all", "Barchasi"],
  ["active", "Faol"],
  ["trial", "Sinov"],
  ["blocked", "Bloklangan"],
] as const;

function when(at: string) {
  const d = new Date();
  const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const y = new Date(d.getTime() - 86400000);
  const yy = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (at.startsWith(t)) return `Bugun, ${at.slice(11, 16)}`;
  if (at.startsWith(yy)) return `Kecha, ${at.slice(11, 16)}`;
  return dmy(at);
}

export default function AdminOverview() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useApi<Resp>(`/admin/overview?status=${status}&q=${encodeURIComponent(q)}&page=${page}`);

  async function act(id: number, action: string) {
    if (action === "block" && !confirm("Do'kon bloklansinmi? Xodimlari tizimga kira olmaydi.")) return;
    try {
      await api(`/admin/stores/${id}`, { method: "PATCH", body: { action } });
      toast(action === "block" ? "Do'kon bloklandi" : "Do'kon blokdan chiqarildi");
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <PageHead title="Umumiy ko'rinish" sub="Platformadagi barcha do'konlar va foydalanuvchilar">
        <label htmlFor="a-search" className="search" style={{ width: 280, maxWidth: "100%" }}>
          <Icon name="search" size={18} color="var(--muted)" />
          <input id="a-search" placeholder="Do'kon, egasi yoki telefon…" value={q} onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }} />
        </label>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} color="#fff" sw={2.4} />
          Do&apos;kon qo&apos;shish
        </button>
      </PageHead>

      {error && <ErrorBox text={error} onRetry={reload} />}

      <section aria-label="Platforma ko'rsatkichlari" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Stat k="Do'konlar" v={<span style={{ fontSize: 26 }}>{data?.stores.total ?? "—"}</span>} s={<span style={{ color: "var(--green)", fontWeight: 700 }}>Bu oy +{data?.stores.newThisMonth ?? 0} yangi</span>} />
        <Stat k="Foydalanuvchilar" v={<span style={{ fontSize: 26 }}>{data?.users.total ?? "—"}</span>} s={`Bugun faol: ${data?.users.activeToday ?? 0}`} />
        <Stat
          hero
          k="Obuna daromadi (oy)"
          v={
            <span style={{ fontSize: 26 }}>
              {data ? money(data.revenueMonth) : "—"} <span style={{ fontSize: 14 }}>so&apos;m</span>
            </span>
          }
          s={`To'langan obunalar: ${data?.paidSubs ?? 0}`}
        />
        <Stat
          k="SMS balans"
          v={
            <span style={{ fontSize: 26 }}>
              {data ? money(data.sms.balance) : "—"} <span style={{ fontSize: 14 }}>ta</span>
            </span>
          }
          s={data?.sms.low ? <span style={{ color: "var(--orange)", fontWeight: 700 }}>Tez orada to&apos;ldirish kerak</span> : "Yetarli"}
        />
      </section>

      <div className="row-wrap">
        <section aria-label="Do'konlar ro'yxati" className="card" style={{ flex: "999 1 600px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-head">
            <h2 className="h2" style={{ marginRight: "auto" }}>
              Do&apos;konlar
            </h2>
            {FILTERS.map(([k, label]) => (
              <button key={k} className={`chip${status === k ? " on" : ""}`} onClick={() => {
                setStatus(k);
                setPage(1);
              }}>
                {label}
              </button>
            ))}
          </div>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 780 }}>
              <thead>
                <tr>
                  <th>Do&apos;kon</th>
                  <th>Egasi</th>
                  <th>Tarif</th>
                  <th className="r">Mijozlar</th>
                  <th>Obuna tugashi</th>
                  <th>Holat</th>
                  <th className="r">Amal</th>
                </tr>
              </thead>
              <tbody>
                {data?.list.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 700 }}>{s.name}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.city}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>{s.owner}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone}</span>
                      </div>
                    </td>
                    <td>
                      <span className="tag">{s.plan}</span>
                    </td>
                    <td className="r num" style={{ fontWeight: 700 }}>
                      {s.clients}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{dmy(s.until)}</td>
                    <td>
                      <StoreStatus s={s.status} />
                    </td>
                    <td className="r">
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Link href={`/admin/stores?id=${s.id}`} aria-label="Ko'rish" className="icon-btn icon-btn-sm">
                          <Icon name="eye" size={16} />
                        </Link>
                        <Link href={`/admin/stores?id=${s.id}`} aria-label="Tahrirlash" className="icon-btn icon-btn-sm">
                          <Icon name="edit" size={16} />
                        </Link>
                        <button
                          aria-label={s.status === "blocked" ? "Blokdan chiqarish" : "Bloklash"}
                          className="icon-btn icon-btn-sm"
                          style={{ borderColor: "var(--orange-line)" }}
                          onClick={() => act(s.id, s.status === "blocked" ? "unblock" : "block")}
                        >
                          <Icon name={s.status === "blocked" ? "check" : "ban"} size={16} color={s.status === "blocked" ? "var(--green)" : "var(--orange)"} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data && !error && (
              <div style={{ padding: 16 }}>
                <Loading h={300} />
              </div>
            )}
            {data?.list.length === 0 && <div className="empty">Do&apos;kon topilmadi</div>}
          </div>
          <div className="tbl-foot">
            <span>
              {data?.listTotal ?? 0} tadan {data?.listTotal ? `${(page - 1) * 7 + 1}–${Math.min(page * 7, data.listTotal)}` : 0} ko&apos;rsatilmoqda
            </span>
            <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
          </div>
        </section>

        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 18 }}>
          <section aria-label="Tariflar" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="h2">Tariflar</h2>
              <Link href="/admin/billing" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                Tahrirlash
              </Link>
            </div>
            {data?.plans.map((p, i) => {
              const hl = i === 1;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, borderRadius: 12, background: hl ? "var(--green-soft)" : "var(--field)", border: hl ? "1px solid var(--green-border)" : "1px solid transparent" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: hl ? "var(--green-deep)" : undefined }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: hl ? "var(--ink-2)" : "var(--muted)" }}>{p.features.slice(0, 2).join(", ")}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: hl ? "var(--green-deep)" : undefined, whiteSpace: "nowrap" }}>{p.price ? `${money(p.price)} / oy` : "Bepul"}</span>
                </div>
              );
            })}
          </section>

          <section aria-label="So'nggi hodisalar" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h2">So&apos;nggi hodisalar</h2>
            {data?.events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: e.level === "err" ? "var(--orange)" : e.level === "ok" ? "var(--green)" : "var(--gray-dot)", marginTop: 5, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.message}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {when(e.created_at)} · {e.user_label}
                  </span>
                </div>
              </div>
            ))}
            <Link href="/admin/logs" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              To&apos;liq jurnal
            </Link>
          </section>
        </div>
      </div>

      {adding && <AddStoreModal onClose={() => setAdding(false)} onSaved={reload} />}
    </>
  );
}
