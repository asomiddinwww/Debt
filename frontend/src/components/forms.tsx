"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { addDaysIso, money, moneyInput, parseMoney, todayIso } from "@/lib/format";
import type { Client } from "@/lib/types";
import { Field, Modal, Toggle, toast } from "./ui";
import { openSms } from "./sms";
import { useSession } from "./session";

const METHODS = ["Naqd", "Karta", "Click", "Payme"];

function useClients(kind: "customer" | "supplier" | "all" = "all") {
  return useApi<{ clients: Client[] }>(`/clients?kind=${kind}&sort=name`);
}

/** Mijoz tanlash yoki yangisini kiritish */
export function ClientPicker({
  value,
  onChange,
  newName,
  setNewName,
  newPhone,
  setNewPhone,
  onlyDebtors = false,
  kind = "all",
}: {
  value: number | "new" | "";
  onChange: (v: number | "new" | "") => void;
  newName?: string;
  setNewName?: (s: string) => void;
  newPhone?: string;
  setNewPhone?: (s: string) => void;
  onlyDebtors?: boolean;
  kind?: "customer" | "supplier" | "all";
}) {
  const { data } = useClients(kind);
  const list = (data?.clients || []).filter((c) => !onlyDebtors || c.remaining > 0);
  return (
    <>
      <Field label="Mijoz" id="f-client">
        <select
          id="f-client"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value === "new" ? "new" : e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">— Mijozni tanlang —</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.remaining > 0 ? ` — ${money(c.remaining)} qoldiq` : ""}
            </option>
          ))}
          {setNewName && <option value="new">+ Yangi mijoz</option>}
        </select>
      </Field>
      {value === "new" && setNewName && setNewPhone && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Field label="Ism familiya" id="f-new-name">
            <input id="f-new-name" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Masalan: Akmal Karimov" />
          </Field>
          <Field label="Telefon" id="f-new-phone">
            <input id="f-new-phone" className="input" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="90 123 45 67" />
          </Field>
        </div>
      )}
    </>
  );
}

export function DebtModal({ onClose, onSaved, clientId }: { onClose: () => void; onSaved: () => void; clientId?: number }) {
  const [direction, setDirection] = useState<"give" | "take">("give");
  const [client, setClient] = useState<number | "new" | "">(clientId ?? "");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");
  const [date, setDate] = useState(todayIso());
  const [due, setDue] = useState(addDaysIso(todayIso(), 30));
  const [note, setNote] = useState("");
  const [sms, setSms] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const smsOn = useSession().sms;

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      await api("/debts", {
        body: {
          direction,
          clientId: typeof client === "number" ? client : undefined,
          clientName: client === "new" ? newName : undefined,
          clientPhone: client === "new" ? newPhone : undefined,
          amount: parseMoney(amount),
          currency,
          date,
          dueDate: due || null,
          note,
          smsReminder: sms,
        },
      });
      toast("Qarz saqlandi");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Yangi qarz" onClose={onClose}>
      <div className="seg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <button className={direction === "give" ? "on" : ""} onClick={() => setDirection("give")}>
          Qarz berdim
        </button>
        <button className={direction === "take" ? "on" : ""} onClick={() => setDirection("take")}>
          Qarz oldim
        </button>
      </div>
      <ClientPicker value={client} onChange={setClient} newName={newName} setNewName={setNewName} newPhone={newPhone} setNewPhone={setNewPhone} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <Field label="Summa" id="f-amount">
          <input id="f-amount" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(moneyInput(e.target.value))} placeholder="500 000" style={{ fontSize: 16, fontWeight: 800 }} />
        </Field>
        <div className="seg" style={{ height: 46, alignItems: "center" }}>
          {(["UZS", "USD"] as const).map((c) => (
            <button key={c} className={currency === c ? "on" : ""} onClick={() => setCurrency(c)} style={{ height: 36 }}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Sana" id="f-date">
          <input id="f-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Qaytarish muddati" id="f-due">
          <input id="f-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="Izoh" id="f-note">
        <textarea id="f-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: 2 qop un, 1 yashik yog'" />
      </Field>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, background: "var(--soft)", cursor: "pointer" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{smsOn ? "SMS eslatma" : "Eslatma"}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Muddatdan 1 kun oldin sizga eslatiladi</span>
        </span>
        <Toggle on={sms} onChange={setSms} label="SMS eslatma" />
      </label>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 48 }} disabled={busy} onClick={save}>
        {busy ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </Modal>
  );
}

export function PaymentForm({
  clientId,
  debtId,
  onSaved,
  compact = false,
}: {
  clientId?: number;
  debtId?: number;
  onSaved: () => void;
  compact?: boolean;
}) {
  const [client, setClient] = useState<number | "new" | "">(clientId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Naqd");
  const [receipt, setReceipt] = useState(false);
  const smsOn = useSession().sms;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    if (!debtId && typeof client !== "number") return setErr("Mijozni tanlang");
    setBusy(true);
    try {
      const r = await api<{ receipt: { phone: string; text: string } | null }>("/payments", {
        body: { debtId, clientId: debtId ? undefined : client, amount: parseMoney(amount), method, sendReceipt: receipt },
      });
      toast("To'lov saqlandi");
      if (r.receipt) openSms(r.receipt);
      setAmount("");
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!debtId && <ClientPicker value={client} onChange={setClient} onlyDebtors kind="customer" />}
      <Field label="Summa" id="p-sum">
        <input id="p-sum" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(moneyInput(e.target.value))} placeholder="500 000" style={{ height: 44, background: "#fff", fontSize: 16, fontWeight: 800 }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            style={{
              height: 36,
              borderRadius: 10,
              border: method === m ? "1.5px solid var(--green)" : "1px solid var(--line)",
              background: method === m ? "var(--green-soft)" : "#fff",
              color: method === m ? "var(--green)" : "var(--ink-2)",
              fontSize: 12,
              fontWeight: method === m ? 700 : 600,
            }}
          >
            {m}
          </button>
        ))}
      </div>
      {!compact && smsOn && (
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          Mijozga SMS chek yuborish (telefoningizdan)
          <Toggle on={receipt} onChange={setReceipt} label="SMS chek" />
        </label>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 46, fontWeight: 800 }} disabled={busy} onClick={save}>
        {busy ? "Saqlanmoqda…" : "To'lovni saqlash"}
      </button>
    </>
  );
}

export function PaymentModal({ onClose, onSaved, clientId }: { onClose: () => void; onSaved: () => void; clientId?: number }) {
  return (
    <Modal title="To'lov qabul qilish" onClose={onClose}>
      <PaymentForm
        clientId={clientId}
        onSaved={() => {
          onSaved();
          onClose();
        }}
      />
    </Modal>
  );
}

export function ClientModal({ onClose, onSaved, client }: { onClose: () => void; onSaved: () => void; client?: Client }) {
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [kind, setKind] = useState<"customer" | "supplier">(client?.kind || "customer");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      if (client) await api(`/clients/${client.id}`, { method: "PUT", body: { name, phone } });
      else await api("/clients", { body: { name, phone, kind } });
      toast(client ? "Mijoz yangilandi" : "Mijoz qo'shildi");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={client ? "Mijozni tahrirlash" : "Yangi mijoz"} onClose={onClose}>
      {!client && (
        <div className="seg" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <button className={kind === "customer" ? "on" : ""} onClick={() => setKind("customer")}>
            Mijoz
          </button>
          <button className={kind === "supplier" ? "on" : ""} onClick={() => setKind("supplier")}>
            Yetkazib beruvchi
          </button>
        </div>
      )}
      <Field label="Ism familiya" id="c-name">
        <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Akmal Karimov" />
      </Field>
      <Field label="Telefon raqam" id="c-phone">
        <input id="c-phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" />
      </Field>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 48 }} disabled={busy} onClick={save}>
        {busy ? "Saqlanmoqda…" : "Saqlash"}
      </button>
    </Modal>
  );
}
