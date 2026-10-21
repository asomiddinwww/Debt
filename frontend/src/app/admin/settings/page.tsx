"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { PageHead } from "@/components/Shell";
import { Field, Loading, Modal, Toggle, toast } from "@/components/ui";
import { useAdmin } from "@/components/adminCtx";

type Security = { twoFactor: boolean; ipRestrict: boolean; suspiciousAlert: boolean };
type Integrations = { payme: boolean; click: boolean; sms: boolean; telegram: boolean };
type Resp = {
  general: { platformName: string; supportPhone: string; supportEmail: string; trialDays: number };
  security: Security;
  sessionDays: number;
  integrations: Integrations;
  admins: { id: number; name: string; email: string; initials: string; role: string }[];
};

const SECURITY: [keyof Security, string, string][] = [
  ["twoFactor", "Adminlar uchun ikki bosqichli kirish", "Har kirishda SMS kod so'raladi"],
  ["ipRestrict", "IP manzil bo'yicha cheklov", "Admin panelga faqat ruxsat etilgan IP lardan"],
  ["suspiciousAlert", "Shubhali kirishlar haqida xabar", "Telegram orqali darhol ogohlantirish"],
];
const INTEGRATIONS: [keyof Integrations, string, string][] = [
  ["payme", "PM", "Payme"],
  ["click", "CL", "Click"],
  ["sms", "SMS", "SMS provayder"],
  ["telegram", "TG", "Telegram bot"],
];

export default function AdminSettings() {
  const { user } = useAdmin();
  const { data, reload } = useApi<Resp>("/admin/settings");
  const [draft, setS] = useState<Resp | null>(null);
  const s = draft ?? data;
  const [invite, setInvite] = useState(false);

  if (!s) return <Loading h={400} />;

  async function save(next = s!) {
    try {
      await api("/admin/settings", { method: "PUT", body: { general: next.general, security: next.security, sessionDays: next.sessionDays, integrations: next.integrations } });
      toast("Sozlamalar saqlandi");
      setS(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const general: [keyof Resp["general"], string][] = [
    ["platformName", "Platforma nomi"],
    ["supportPhone", "Qo'llab-quvvatlash telefoni"],
    ["supportEmail", "Aloqa uchun email"],
    ["trialDays", "Sinov muddati (kun)"],
  ];

  return (
    <>
      <PageHead title="Sozlamalar" sub="Platforma, xavfsizlik va integratsiyalar">
        <button className="btn btn-primary" onClick={() => save()}>
          Saqlash
        </button>
      </PageHead>

      <div className="row-wrap">
        <div style={{ flex: "999 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <section aria-label="Umumiy" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="h2">Umumiy</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {general.map(([k, label]) => (
                <Field key={k} label={label} id={`g-${k}`}>
                  <input
                    id={`g-${k}`}
                    className="input"
                    value={String(s.general[k] ?? "")}
                    placeholder={k === "supportPhone" ? "+998 __ ___ __ __" : undefined}
                    onChange={(e) => setS({ ...s, general: { ...s.general, [k]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section aria-label="Xavfsizlik" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="h2" style={{ marginBottom: 8 }}>
              Xavfsizlik
            </h2>
            {SECURITY.map(([k, title, sub]) => (
              <label key={k} className="toggle-row" style={{ padding: "12px 0" }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</span>
                </span>
                <Toggle on={s.security[k]} onChange={(v) => setS({ ...s, security: { ...s.security, [k]: v } })} label={title} />
              </label>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
              <label htmlFor="sess" style={{ fontSize: 14, fontWeight: 700 }}>
                Sessiya muddati
              </label>
              <select id="sess" className="select" style={{ height: 40 }} value={s.sessionDays} onChange={(e) => setS({ ...s, sessionDays: Number(e.target.value) })}>
                {[1, 7, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    {d} kun
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 18 }}>
          <section aria-label="Integratsiyalar" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="h2" style={{ marginBottom: 4 }}>
              Integratsiyalar
            </h2>
            {INTEGRATIONS.map(([k, ini, name]) => {
              const on = s.integrations[k];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, background: "var(--field)", border: "1px solid var(--line-2)" }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, background: "#fff", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "var(--green-deep)" }}>{ini}</span>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{name}</span>
                    <span style={{ fontSize: 12, color: on ? "var(--green)" : "var(--orange)", fontWeight: 700 }}>{on ? "Ulangan" : "Ulanmagan"}</span>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 12, fontWeight: 700 }}
                    onClick={() => {
                      const next = { ...s, integrations: { ...s.integrations, [k]: !on } };
                      setS(next);
                      save(next);
                    }}
                  >
                    {on ? "O'chirish" : "Ulash"}
                  </button>
                </div>
              );
            })}
          </section>

          <section aria-label="Adminlar" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="h2">Adminlar</h2>
              {user.role === "superadmin" && (
                <button className="btn btn-outline btn-sm" onClick={() => setInvite(true)}>
                  + Taklif qilish
                </button>
              )}
            </div>
            {s.admins.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
                <span className="av" style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 12 }}>
                  {a.initials}
                </span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.email}</span>
                </div>
                <span className="tag">{a.role}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      {invite && <InviteModal onClose={() => setInvite(false)} onSaved={reload} />}
    </>
  );
}

function InviteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", role: "support" });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Admin qo'shish" onClose={onClose}>
      <Field label="Ism" id="ad-name">
        <input id="ad-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Email" id="ad-email">
        <input id="ad-email" type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Vaqtinchalik parol" id="ad-pass">
        <input id="ad-pass" type="password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <Field label="Rol" id="ad-role">
        <select id="ad-role" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="support">Qo&apos;llab-quvvatlash</option>
          <option value="finance">Moliya</option>
          <option value="superadmin">Super admin</option>
        </select>
      </Field>
      {err && <div className="err">{err}</div>}
      <button
        className="btn btn-primary"
        style={{ height: 48 }}
        onClick={async () => {
          setErr(null);
          try {
            await api("/admin/admins", { body: f });
            toast("Admin qo'shildi");
            onSaved();
            onClose();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        Qo&apos;shish
      </button>
    </Modal>
  );
}
