"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApi } from "@/lib/api";
import { addDaysIso, initials, money, moneyInput, parseMoney, todayIso } from "@/lib/format";
import type { Client } from "@/lib/types";
import { MobileHeader } from "@/components/MobileHeader";
import { Icon } from "@/components/Icon";
import { Toggle, toast } from "@/components/ui";
import { useSession } from "@/components/session";

const fieldStyle: React.CSSProperties = {
  height: 50, borderRadius: 16, border: "1px solid var(--line)", background: "var(--field)", padding: "0 14px",
  fontSize: 14, fontWeight: 600, outline: "none", width: "100%",
};

function AddDebt() {
  const params = useSearchParams();
  const smsOn = useSession().sms;
  const router = useRouter();
  const presetClient = Number(params.get("client")) || null;
  const dirParam = params.get("dir");
  const [dirState, setDirection] = useState<"give" | "take" | null>(dirParam === "take" || dirParam === "give" ? dirParam : null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");
  const [queryState, setQuery] = useState<string | null>(null);
  const [pickedState, setPicked] = useState<Client | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [due, setDue] = useState(addDaysIso(todayIso(), 30));
  const [note, setNote] = useState("");
  const [sms, setSms] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useApi<{ clients: Client[] }>("/clients?kind=all&sort=name");

  // URL dagi ?client= bo'yicha oldindan tanlangan mijoz (foydalanuvchi o'zgartirmaguncha)
  const preset = data?.clients.find((x) => x.id === presetClient) ?? null;
  const picked = pickedState === undefined ? preset : pickedState;
  const query = queryState ?? picked?.name ?? "";
  const direction = dirState ?? (picked?.kind === "supplier" ? "take" : "give");

  const matches = (data?.clients || [])
    .filter((c) => c.kind === (direction === "take" ? "supplier" : "customer"))
    .filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ debt: { clientId: number } }>("/debts", {
        body: {
          direction,
          clientId: picked?.id,
          clientName: picked ? undefined : query,
          clientPhone: picked ? undefined : phone,
          amount: parseMoney(amount),
          currency,
          date,
          dueDate: due || null,
          note,
          smsReminder: sms,
        },
      });
      toast("Qarz saqlandi");
      router.replace(`/m/client?id=${r.debt.clientId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="m-shell white no-nav" style={{ paddingBottom: 108 }}>
      <MobileHeader title="Yangi qarz" icon="close" back={presetClient ? `/m/client?id=${presetClient}` : "/m"} />

      <div style={{ margin: "18px 20px 0", padding: 4, borderRadius: 16, background: "var(--soft)", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4 }}>
        {(["give", "take"] as const).map((d) => (
          <button
            key={d}
            onClick={() => {
              setDirection(d);
              if (picked && picked.kind !== (d === "take" ? "supplier" : "customer")) {
                setPicked(null);
                setQuery("");
              }
            }}
            style={{ height: 42, borderRadius: 12, border: "none", background: direction === d ? "var(--green)" : "transparent", color: direction === d ? "#fff" : "var(--muted)", fontSize: 14, fontWeight: direction === d ? 700 : 600 }}
          >
            {d === "give" ? "Qarz berdim" : "Qarz oldim"}
          </button>
        ))}
      </div>

      <div style={{ margin: "22px 20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <label htmlFor="summa" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          Summa
        </label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <input
            id="summa"
            value={amount}
            inputMode="numeric"
            placeholder="0"
            autoFocus
            onChange={(e) => setAmount(moneyInput(e.target.value))}
            style={{ width: 230, border: "none", outline: "none", textAlign: "right", fontSize: 40, fontWeight: 800, letterSpacing: -0.8, background: "transparent", padding: 0 }}
          />
          <span style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{currency === "UZS" ? "so'm" : "$"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {(["UZS", "USD"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{ height: 30, padding: "0 12px", borderRadius: 999, border: `1px solid ${currency === c ? "var(--green)" : "var(--line)"}`, background: currency === c ? "var(--green-soft)" : "#fff", color: currency === c ? "var(--green)" : "var(--muted)", fontSize: 12, fontWeight: currency === c ? 700 : 600 }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ margin: "24px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
          <label htmlFor="mijoz" style={{ fontSize: 13, fontWeight: 700 }}>
            {direction === "take" ? "Kimdan" : "Mijoz"}
          </label>
          <div style={{ height: 54, borderRadius: 16, border: "1.5px solid var(--green)", background: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {query ? initials(query) : <Icon name="user" size={16} color="var(--green)" />}
            </span>
            <input
              id="mijoz"
              value={query}
              autoComplete="off"
              placeholder="Ism bo'yicha qidiring yoki yangisini yozing"
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
                setOpen(true);
              }}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontWeight: 600, background: "transparent", minWidth: 0 }}
            />
            <Icon name="chevronDown" size={18} color="var(--muted)" />
          </div>
          {open && matches.length > 0 && (
            <div className="m-card" style={{ position: "absolute", top: 82, left: 0, right: 0, zIndex: 5, boxShadow: "0 12px 30px rgba(19,32,26,.12)", overflow: "hidden" }}>
              {matches.map((c) => (
                <button
                  key={c.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPicked(c);
                    setQuery(c.name);
                    setOpen(false);
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "none", background: "#fff", borderTop: "1px solid var(--line-2)", textAlign: "left" }}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  {c.remaining > 0 && <span style={{ fontSize: 12, color: "var(--muted)" }}>{money(c.remaining)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {!picked && query.trim().length >= 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="tel" style={{ fontSize: 13, fontWeight: 700 }}>
              Yangi mijoz telefoni
            </label>
            <input id="tel" inputMode="tel" placeholder="90 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldStyle} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="sana" style={{ fontSize: 13, fontWeight: 700 }}>
              Sana
            </label>
            <input id="sana" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="muddat" style={{ fontSize: 13, fontWeight: 700 }}>
              Qaytarish muddati
            </label>
            <input id="muddat" type="date" value={due} onChange={(e) => setDue(e.target.value)} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="izoh" style={{ fontSize: 13, fontWeight: 700 }}>
            Izoh
          </label>
          <textarea id="izoh" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: 2 qop un, 1 yashik yog'" style={{ ...fieldStyle, height: 80, padding: "12px 14px", resize: "none", fontWeight: 500 }} />
        </div>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 16, background: "var(--soft)", cursor: "pointer" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{smsOn ? "SMS eslatma" : "Eslatma"}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Muddatdan 1 kun oldin sizga eslatiladi</span>
          </span>
          <Toggle on={sms} onChange={setSms} label="SMS eslatma" />
        </label>
        {err && <div className="err">{err}</div>}
      </div>

      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, bottom: 0, padding: "12px 20px 28px", background: "linear-gradient(transparent, #fff 30%)" }}>
        <button className="m-cta" onClick={save} disabled={busy}>
          {busy ? "Saqlanmoqda…" : "Saqlash"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="m-shell white" />}>
      <AddDebt />
    </Suspense>
  );
}
