"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { dm, dmy, money, moneyInput, parseMoney } from "@/lib/format";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Field, Loading, Modal, toast } from "@/components/ui";

type Plan = { id: number; name: string; tag: string; price: number; clientLimit: number | null; staffLimit: number | null; smsLimit: number; features: string[]; subscribers: number };
type Invoice = { id: number; code: string; date: string; store: string; plan: string; from: string; to: string; gateway: string; amount: number; status: "ok" | "wait" | "fail" };

const ST = { ok: ["To'langan", "b-ok"], wait: ["Kutilmoqda", "b-blue"], fail: ["Muvaffaqiyatsiz", "b-late"] } as const;

export default function BillingPage() {
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<Plan | "new" | null>(null);
  const plans = useApi<{ plans: Plan[] }>("/admin/plans");
  const inv = useApi<{ invoices: Invoice[]; monthRevenue: number }>(`/admin/invoices?status=${status}`);
  const monthName = new Date().toLocaleString("uz-UZ", { month: "long" });

  return (
    <>
      <PageHead title="Tariflar va to'lovlar" sub="Obuna rejalari va do'konlardan tushgan to'lovlar">
        <button className="btn btn-primary" onClick={() => setEdit("new")}>
          + Yangi tarif
        </button>
      </PageHead>

      {plans.error && <ErrorBox text={plans.error} onRetry={plans.reload} />}
      <section aria-label="Tarif rejalari" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {!plans.data && [0, 1, 2].map((i) => <Loading key={i} h={260} />)}
        {plans.data?.plans.map((p, i) => (
          <div key={p.id} style={{ background: "#fff", border: i === 1 ? "2px solid var(--green)" : "1px solid var(--line)", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{p.name}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{p.subscribers} ta obunachi</span>
              </div>
              {p.tag && <span className="badge b-ok" style={{ fontSize: 11, fontWeight: 800 }}>{p.tag}</span>}
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>
              {money(p.price)} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>so&apos;m / oy</span>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
              {p.features.map((f) => (
                <span key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon name="check" size={16} color="var(--green)" sw={2.4} />
                  {f}
                </span>
              ))}
            </div>
            <button className="btn" style={{ height: 40, fontSize: 13, fontWeight: 700, marginTop: "auto" }} onClick={() => setEdit(p)}>
              Tahrirlash
            </button>
          </div>
        ))}
      </section>

      <section aria-label="To'lovlar tarixi" className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-head">
          <h2 className="h2" style={{ marginRight: "auto" }}>
            Obuna to&apos;lovlari
          </h2>
          <span style={{ fontSize: 13, color: "var(--muted)", marginRight: 8 }}>
            {monthName[0]?.toUpperCase() + monthName.slice(1)}: <b style={{ color: "var(--green)" }}>{money(inv.data?.monthRevenue)} so&apos;m</b>
          </span>
          {[
            ["all", "Barchasi"],
            ["wait", "Kutilmoqda"],
            ["fail", "Muvaffaqiyatsiz"],
          ].map(([k, label]) => (
            <button key={k} className={`chip${status === k ? " on" : ""}`} onClick={() => setStatus(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>Hisob</th>
                <th>Do&apos;kon</th>
                <th>Tarif</th>
                <th>Davr</th>
                <th>To&apos;lov tizimi</th>
                <th className="r">Summa</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {inv.data?.invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{i.code}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{dmy(i.date)}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{i.store}</td>
                  <td style={{ color: "var(--ink-2)" }}>{i.plan}</td>
                  <td style={{ color: "var(--ink-2)" }}>
                    {dm(i.from)} – {dm(i.to)}
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{i.gateway}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>
                    {money(i.amount)}
                  </td>
                  <td>
                    <span className={`badge ${ST[i.status][1]}`}>{ST[i.status][0]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!inv.data && (
            <div style={{ padding: 16 }}>
              <Loading h={240} />
            </div>
          )}
          {inv.data?.invoices.length === 0 && <div className="empty">To&apos;lov yo&apos;q</div>}
        </div>
      </section>

      {edit && <PlanModal plan={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={plans.reload} />}
    </>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: plan?.name || "",
    tag: plan?.tag || "",
    price: plan ? money(plan.price) : "",
    clientLimit: plan?.clientLimit?.toString() ?? "",
    staffLimit: plan?.staffLimit?.toString() ?? "",
    smsLimit: plan?.smsLimit?.toString() ?? "0",
    features: plan?.features.join("\n") || "",
  });
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    try {
      const body = { ...f, price: parseMoney(f.price), features: f.features };
      if (plan) await api(`/admin/plans/${plan.id}`, { method: "PUT", body });
      else await api("/admin/plans", { body });
      toast("Tarif saqlandi");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const input = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} id={`pl-${k}`}>
      <input id={`pl-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: k === "price" ? moneyInput(e.target.value) : e.target.value })} {...props} />
    </Field>
  );

  return (
    <Modal title={plan ? `${plan.name} — tahrirlash` : "Yangi tarif"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {input("name", "Nomi")}
        {input("tag", "Belgi", { placeholder: "Ommabop" })}
      </div>
      {input("price", "Narx (so'm / oy)", { inputMode: "numeric" })}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {input("clientLimit", "Mijoz limiti", { placeholder: "cheksiz", inputMode: "numeric" })}
        {input("staffLimit", "Xodim limiti", { placeholder: "cheksiz", inputMode: "numeric" })}
        {input("smsLimit", "SMS / oy", { inputMode: "numeric" })}
      </div>
      <Field label="Imkoniyatlar (har biri yangi qatorda)" id="pl-features">
        <textarea id="pl-features" className="input" rows={4} value={f.features} onChange={(e) => setF({ ...f, features: e.target.value })} />
      </Field>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 48 }} onClick={save}>
        Saqlash
      </button>
    </Modal>
  );
}
