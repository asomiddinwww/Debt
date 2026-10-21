"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, downloadUrl, useApi } from "@/lib/api";
import { dmy, money } from "@/lib/format";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, Modal, Toggle, toast } from "@/components/ui";
import { AddStoreModal, StoreStatus, type StoreRow } from "@/components/adminParts";

type Resp = {
  stores: StoreRow[];
  counts: { total: number; active: number; trial: number; blocked: number };
  regions: string[];
  plans: { id: number; name: string }[];
};
type Detail = {
  store: StoreRow & { subUntil: string | null };
  staff: number;
  staffLimit: number | null;
  smsUsed: number;
  smsLimit: number;
};

function lastActive(at: string | null) {
  if (!at) return "—";
  const d = new Date();
  const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return at.startsWith(t) ? `Bugun, ${at.slice(11, 16)}` : dmy(at);
}

function StoresPage() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [picked, setSelected] = useState<number | null>(Number(params.get("id")) || null);
  const [adding, setAdding] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const qs = new URLSearchParams({ q, region, plan, status });
  const { data, error, reload } = useApi<Resp>(`/admin/stores?${qs}`);
  const selected = picked ?? data?.stores[0]?.id ?? null;
  const detail = useApi<Detail>(selected ? `/admin/stores/${selected}` : null);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected) return;
    if (action === "block" && !confirm("Do'kon bloklansinmi?")) return;
    try {
      await api(`/admin/stores/${selected}`, { method: "PATCH", body: { action, ...extra } });
      toast({ sms_on: "SMS yuborish yoqildi", sms_off: "SMS yuborish o'chirildi", block: "Do'kon bloklandi", unblock: "Blokdan chiqarildi", extend: "Obuna 30 kunga uzaytirildi", plan: "Tarif o'zgartirildi" }[action] || "Saqlandi");
      reload();
      detail.reload();
      setPlanOpen(false);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const c = data?.counts;
  const d = detail.data;

  return (
    <>
      <PageHead title="Do'konlar" sub={c ? `${c.total} ta do'kon · ${c.active} faol · ${c.trial} sinovda · ${c.blocked} bloklangan` : "Yuklanmoqda…"}>
        <a className="btn" href={downloadUrl("/admin/stores.csv")}>
          Eksport
        </a>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Do&apos;kon qo&apos;shish
        </button>
      </PageHead>

      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", borderRadius: 16, padding: "12px 14px" }}>
        <label htmlFor="as-search" className="search" style={{ height: 42, flex: "1 1 240px" }}>
          <Icon name="search" size={18} color="var(--muted)" />
          <input id="as-search" placeholder="Do'kon nomi, egasi yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor="as-region" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
            Hudud
          </label>
          <select id="as-region" className="select" style={{ minWidth: 150 }} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Barcha hududlar</option>
            {data?.regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor="as-plan" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
            Tarif
          </label>
          <select id="as-plan" className="select" style={{ minWidth: 150 }} value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="">Barcha tariflar</option>
            {data?.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gap: 4 }}>
          <label htmlFor="as-status" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
            Holat
          </label>
          <select id="as-status" className="select" style={{ minWidth: 150 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Barcha holatlar</option>
            <option value="active">Faol</option>
            <option value="trial">Sinov</option>
            <option value="blocked">Bloklangan</option>
          </select>
        </div>
      </div>

      {error && <ErrorBox text={error} onRetry={reload} />}

      <div className="row-wrap">
        <section aria-label="Do'konlar jadvali" className="card" style={{ flex: "999 1 640px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Do&apos;kon</th>
                  <th>Hudud</th>
                  <th>Tarif</th>
                  <th className="r">Mijozlar</th>
                  <th className="r">Qarz aylanmasi</th>
                  <th>Qo&apos;shilgan</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {data?.stores.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => setSelected(s.id)} style={{ background: s.id === selected ? "var(--green-softer)" : undefined }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="av" style={{ width: 36, height: 36, borderRadius: 11, fontSize: 12 }}>
                          {s.initials}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 700 }}>{s.name}</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.owner}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{s.region}</td>
                    <td>
                      <span className="tag">{s.plan}</span>
                    </td>
                    <td className="r num" style={{ fontWeight: 700 }}>
                      {s.clients}
                    </td>
                    <td className="r num">{money(s.turnover)}</td>
                    <td style={{ color: "var(--ink-2)" }}>{dmy(s.joined)}</td>
                    <td>
                      <StoreStatus s={s.status} />
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
            {data?.stores.length === 0 && <div className="empty">Do&apos;kon topilmadi</div>}
          </div>
        </section>

        <aside aria-label="Tanlangan do'kon" className="card" style={{ flex: "1 1 320px", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {!d && <Loading h={360} />}
          {d && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--green)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>{d.store.initials}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 800 }}>{d.store.name}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    ID: {d.store.code} · {d.store.region}
                  </span>
                </div>
                <StoreStatus s={d.store.status} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {[
                  ["Tarif", d.store.plan],
                  ["Obuna tugashi", dmy(d.store.until)],
                  ["Xodimlar", `${d.staff} / ${d.staffLimit ?? "∞"}`],
                  ["SMS (bu oy)", `${d.smsUsed} / ${d.smsLimit}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: 12, borderRadius: 12, background: "var(--soft)", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
                    <span style={{ fontSize: 14, fontWeight: 800 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                {[
                  ["Egasi", d.store.owner],
                  ["Telefon", d.store.phone],
                  ["Oxirgi faollik", lastActive(d.store.lastActive)],
                  ["Qo'shilgan", dmy(d.store.joined)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ color: "var(--muted)" }}>{k}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              <label className="toggle-row" style={{ paddingTop: 12 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>SMS yuborish</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{d.store.smsEnabled ? "Do'kon SMS yubora oladi" : "SMS tugmalari yashirilgan, eslatmalar ishlaydi"}</span>
                </span>
                <Toggle on={d.store.smsEnabled} onChange={(v) => act(v ? "sms_on" : "sms_off")} label="SMS yuborish" />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn btn-primary" onClick={() => act("extend", { days: 30 })}>
                  Obunani uzaytirish
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                  <button className="btn" style={{ height: 42, fontSize: 13, padding: "0 8px" }} onClick={() => setPlanOpen(true)}>
                    Tarifni o&apos;zgartirish
                  </button>
                  {d.store.status === "blocked" ? (
                    <button className="btn btn-outline" style={{ height: 42, fontSize: 13 }} onClick={() => act("unblock")}>
                      Blokdan chiqarish
                    </button>
                  ) : (
                    <button className="btn btn-danger" style={{ height: 42, fontSize: 13 }} onClick={() => act("block")}>
                      Bloklash
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {adding && <AddStoreModal onClose={() => setAdding(false)} onSaved={reload} />}
      {planOpen && d && (
        <Modal title="Tarifni o'zgartirish" onClose={() => setPlanOpen(false)}>
          {data?.plans.map((p) => (
            <button key={p.id} className={`btn${p.id === d.store.planId ? " btn-outline" : ""}`} style={{ justifyContent: "flex-start" }} onClick={() => act("plan", { planId: p.id })}>
              {p.name}
            </button>
          ))}
        </Modal>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading h={400} />}>
      <StoresPage />
    </Suspense>
  );
}
