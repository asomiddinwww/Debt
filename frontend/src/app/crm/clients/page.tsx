"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, downloadUrl, useApi } from "@/lib/api";
import { dmy, money, statusBadge, statusText } from "@/lib/format";
import type { Client, Dashboard, Debt, HistoryItem } from "@/lib/types";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { Avatar, ErrorBox, Loading, Pager, Stat, Sum, toast } from "@/components/ui";
import { ClientModal, DebtModal, PaymentModal } from "@/components/forms";
import { openSms } from "@/components/sms";

type Resp = { clients: Client[]; total: number; counts: { all: number; active: number; late: number; paid: number } };
type Detail = { client: Client; debts: Debt[]; history: HistoryItem[] };

const FILTERS = [
  ["all", "Barchasi"],
  ["active", "Faol"],
  ["late", "Muddati o'tgan"],
  ["paid", "Yopilgan"],
] as const;
const PER_PAGE = 7;

function ClientsPage() {
  const params = useSearchParams();
  const { can, sms } = useSession();
  const [q, setQuery] = useState(params.get("q") || "");
  const [filter, setFilt] = useState("all");
  const [page, setPage] = useState(1);
  const [picked, setSelected] = useState<number | null>(Number(params.get("id")) || null);
  const setQ = (v: string) => {
    setQuery(v);
    setPage(1);
  };
  const setFilter = (v: string) => {
    setFilt(v);
    setPage(1);
  };
  const [modal, setModal] = useState<null | "debt" | "pay" | "client" | "edit">(null);
  const list = useApi<Resp>(`/clients?filter=${filter}&q=${encodeURIComponent(q)}`);
  const kpi = useApi<Dashboard>("/dashboard");
  const selected = picked ?? list.data?.clients[0]?.id ?? null;
  const detail = useApi<Detail>(selected ? `/clients/${selected}` : null);

  const rows = list.data?.clients || [];
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const reloadAll = () => {
    list.reload();
    kpi.reload();
    detail.reload();
  };

  async function remind(id: number) {
    try {
      const r = await api<{ phone: string; text: string }>(`/clients/${id}/remind`, { method: "POST" });
      openSms({ phone: r.phone, text: r.text, name: detail.data?.client.name });
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const c = detail.data?.client;
  const pct = c && c.given ? Math.min(100, (c.paid / c.given) * 100) : 0;

  return (
    <>
      <PageHead title="Mijozlar" sub="Barcha qarzdorlar va ularning holati">
        <label htmlFor="crm-search" className="search" style={{ width: 280, maxWidth: "100%" }}>
          <Icon name="search" size={18} color="var(--muted)" />
          <input id="crm-search" placeholder="Ism yoki telefon raqam…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <a className="btn" href={downloadUrl("/export/clients.csv")}>
          <Icon name="download" size={18} />
          Eksport
        </a>
        <button className="btn" onClick={() => setModal("client")}>
          <Icon name="userPlus" size={18} />
          Mijoz
        </button>
        {can("add_debt") && (
          <button className="btn btn-primary" onClick={() => setModal("debt")}>
            <Icon name="plus" size={18} color="#fff" sw={2.4} />
            Yangi qarz
          </button>
        )}
      </PageHead>

      <section aria-label="Ko'rsatkichlar" className="grid-stats">
        <Stat hero k="Jami qarzdorlik" v={kpi.data ? <Sum n={kpi.data.owed} /> : "—"} />
        <Stat k="Faol mijozlar" v={kpi.data?.activeClients ?? "—"} />
        <Stat k="Muddati o'tgan" v={kpi.data ? <Sum n={kpi.data.overdueSum} /> : "—"} color="var(--orange)" />
        <Stat k="Bu oy undirildi" v={kpi.data ? <Sum n={kpi.data.collectedMonth} /> : "—"} color="var(--green)" />
      </section>

      <div className="row-wrap" style={{ gap: 20 }}>
        <section aria-label="Mijozlar ro'yxati" className="card" style={{ flex: "999 1 560px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-head">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
          {list.error && (
            <div style={{ padding: 16 }}>
              <ErrorBox text={list.error} onRetry={list.reload} />
            </div>
          )}
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th className="r">Berilgan</th>
                  <th className="r">To&apos;langan</th>
                  <th className="r">Qoldiq</th>
                  <th>Muddat</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setSelected(r.id)} style={{ background: r.id === selected ? "var(--green-softer)" : undefined }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar text={r.initials} size={36} radius={11} status={r.status} fontSize={13} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 700 }}>{r.name}</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="r num">{money(r.given)}</td>
                    <td className="r num" style={{ color: "var(--muted)" }}>
                      {money(r.paid)}
                    </td>
                    <td className="r num" style={{ fontWeight: 800 }}>
                      {money(r.remaining)}
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{r.remaining > 0 ? dmy(r.nextDue) : "—"}</td>
                    <td>
                      <span className={`badge ${statusBadge(r.status)}`}>{statusText(r.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data && !list.error && (
              <div style={{ padding: 16 }}>
                <Loading h={240} />
              </div>
            )}
            {list.data && rows.length === 0 && <div className="empty">Mijoz topilmadi</div>}
          </div>
          <div className="tbl-foot">
            <span>
              {rows.length} tadan {rows.length ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, rows.length)}` : 0} ko&apos;rsatilmoqda
            </span>
            <Pager page={page} pages={pages} onPage={setPage} />
          </div>
        </section>

        <aside aria-label="Tanlangan mijoz" className="card" style={{ flex: "1 1 300px", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {!c && <Loading h={300} />}
          {c && detail.data && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar text={c.initials} size={52} radius={16} status={c.status} fontSize={18} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{c.name}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{c.phone}</span>
                </div>
                <button className="icon-btn icon-btn-sm" aria-label="Tahrirlash" onClick={() => setModal("edit")}>
                  <Icon name="edit" size={16} />
                </button>
              </div>
              <div style={{ padding: 16, borderRadius: 14, background: "var(--soft)", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Qolgan qarz</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: c.status === "late" ? "var(--orange)" : "var(--green)" }}>{money(c.remaining)} so&apos;m</span>
                <div style={{ height: 8, borderRadius: 999, background: "#DCE9E1", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "var(--green)", borderRadius: 999 }} />
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {money(c.given)} dan {money(c.paid)} to&apos;landi{c.nextDue ? ` · muddat ${dmy(c.nextDue)}` : ""}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: sms ? "repeat(2, minmax(0, 1fr))" : "1fr", gap: 8 }}>
                <button className="btn btn-primary" style={{ height: 42, fontSize: 13, padding: 0 }} disabled={c.remaining <= 0 || !can("take_payment")} onClick={() => setModal("pay")}>
                  To&apos;lov qabul
                </button>
                {sms && (
                  <button className="btn" style={{ height: 42, fontSize: 13, padding: 0 }} disabled={c.remaining <= 0 || !can("send_sms")} onClick={() => remind(c.id)}>
                    SMS eslatma
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>Oxirgi amallar</span>
                {detail.data.history.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>Hali amal yo&apos;q</span>}
                {detail.data.history.slice(0, 5).map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: h.kind === "payment" ? "var(--green)" : "var(--gray-dot)", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {h.title} · {money(h.amount)}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        {dmy(h.date)} · {h.method}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {modal === "debt" && <DebtModal onClose={() => setModal(null)} onSaved={reloadAll} clientId={selected ?? undefined} />}
      {modal === "pay" && c && <PaymentModal clientId={c.id} onClose={() => setModal(null)} onSaved={reloadAll} />}
      {modal === "client" && <ClientModal onClose={() => setModal(null)} onSaved={reloadAll} />}
      {modal === "edit" && c && <ClientModal client={c} onClose={() => setModal(null)} onSaved={reloadAll} />}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading h={400} />}>
      <ClientsPage />
    </Suspense>
  );
}
