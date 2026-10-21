"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { Field, Modal, toast } from "./ui";

export type StoreRow = {
  id: number;
  code: string;
  initials: string;
  name: string;
  city: string;
  region: string;
  owner: string;
  phone: string;
  plan: string;
  planId: number | null;
  clients: number;
  turnover: number;
  until: string | null;
  joined: string;
  lastActive: string | null;
  smsEnabled: boolean;
  status: "active" | "trial" | "blocked";
};

export const STORE_STATUS: Record<string, [string, string]> = {
  active: ["Faol", "b-ok"],
  trial: ["Sinov", "b-blue"],
  blocked: ["Bloklangan", "b-late"],
};

export function StoreStatus({ s }: { s: string }) {
  const [label, cls] = STORE_STATUS[s] || [s, "b-paid"];
  return <span className={`badge ${cls}`}>{label}</span>;
}

/** Tasodifiy 8 belgili parol (o'xshash belgilarsiz) */
export function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

export function AddStoreModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<{ plans: { id: number; name: string }[] }>("/admin/plans");
  const [f, setF] = useState({ name: "", city: "", ownerName: "", phone: "", password: "", planId: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await api("/admin/stores", { body: f });
      toast("Do'kon qo'shildi");
      onSaved();
      setCreated(true);
      setBusy(false);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (created) {
    const text = `Qarz Daftar\nLogin: +998 ${f.phone}\nParol: ${f.password}`;
    return (
      <Modal title="Do'kon yaratildi" onClose={onClose}>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
          <b>{f.name}</b> uchun kirish ma&apos;lumotlari. Ularni do&apos;kon egasiga yetkazing — parol keyin ko&apos;rsatilmaydi.
        </span>
        <div style={{ padding: 14, borderRadius: 14, background: "var(--green-softer)", border: "1px solid var(--green-border)", display: "flex", flexDirection: "column", gap: 8, fontSize: 15 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--muted)" }}>Login</span>
            <b>+998 {f.phone}</b>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--muted)" }}>Parol</span>
            <b className="mono">{f.password}</b>
          </div>
        </div>
        <button
          className="btn"
          onClick={() => {
            navigator.clipboard?.writeText(text).then(() => toast("Nusxalandi"), () => toast("Nusxalab bo'lmadi"));
          }}
        >
          Nusxalash
        </button>
        <button className="btn btn-primary" style={{ height: 48 }} onClick={onClose}>
          Tayyor
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Do'kon qo'shish" onClose={onClose}>
      <Field label="Do'kon nomi" id="ns-name">
        <input id="ns-name" className="input" value={f.name} onChange={set("name")} />
      </Field>
      <Field label="Hudud / shahar" id="ns-city">
        <input id="ns-city" className="input" value={f.city} onChange={set("city")} placeholder="Masalan: Toshkent, Chilonzor" />
      </Field>
      <Field label="Egasining ismi" id="ns-owner">
        <input id="ns-owner" className="input" value={f.ownerName} onChange={set("ownerName")} />
      </Field>
      <div style={{ padding: 14, borderRadius: 14, background: "var(--green-softer)", border: "1px solid var(--green-border)", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--green-deep)" }}>Kirish ma&apos;lumotlari</span>
        <Field label="Login — egasining telefon raqami" id="ns-phone">
          <input id="ns-phone" className="input" style={{ background: "#fff" }} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="90 123 45 67" autoComplete="off" />
        </Field>
        <Field label="Parol (kamida 6 belgi)" id="ns-pass">
          <div style={{ display: "flex", gap: 8 }}>
            <input id="ns-pass" className="input" style={{ background: "#fff" }} value={f.password} onChange={set("password")} autoComplete="new-password" />
            <button type="button" className="btn" style={{ height: 46, flexShrink: 0 }} onClick={() => setF({ ...f, password: genPassword() })}>
              Yaratish
            </button>
          </div>
        </Field>
      </div>
      <Field label="Tarif" id="ns-plan">
        <select id="ns-plan" className="input" value={f.planId} onChange={set("planId")}>
          {data?.plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>Do&apos;kon sinov rejimida ochiladi. Egasi shu telefon raqam va parol bilan kiradi — parolni unga o&apos;zingiz yetkazing.</span>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 48 }} onClick={save} disabled={busy}>
        {busy ? "Saqlanmoqda…" : "Qo'shish"}
      </button>
    </Modal>
  );
}
