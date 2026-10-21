"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, "").replace(/^998/, "").slice(0, 9);
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/auth/login", { body: { phone, password } });
      setToken(r.token);
      router.replace(window.innerWidth < 900 ? "/m" : "/dashboard");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-hero">
        <div className="ring1" />
        <div className="ring2" />
        <span style={{ width: 56, height: 56, borderRadius: 18, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, position: "relative" }}>
          <Icon name="book" size={28} color="var(--green)" />
        </span>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: -0.5, position: "relative" }}>Qarz Daftar</h1>
        <span style={{ fontSize: 15, color: "var(--mint)", marginTop: 6, position: "relative" }}>Qarzlaringizni qog&apos;ozsiz, tartibli yuriting</span>
        <div className="points">
          {["Mijozlar va qarzlar bitta joyda", "To'lovlar va qoldiqni avtomatik hisoblash", "Muddat haqida SMS eslatmalar", "Hisobotlar va undirish tahlili"].map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff", fontSize: 16, fontWeight: 600 }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, background: "var(--green-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="check" size={16} color="var(--mint-bar)" sw={2.6} />
              </span>
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="login-side">
      <form onSubmit={submit} className="login-form">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Kirish</h2>
          <span style={{ fontSize: 14, color: "var(--muted)" }}>Administrator bergan telefon raqam va parol bilan kiring</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="phone" style={{ fontSize: 13, fontWeight: 700 }}>
            Telefon raqam
          </label>
          <div style={{ height: 56, borderRadius: 16, border: "1.5px solid var(--green)", display: "flex", alignItems: "center", padding: "0 14px", gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-2)", paddingRight: 10, borderRight: "1px solid var(--line)" }}>+998</span>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              inputMode="tel"
              autoComplete="username"
              placeholder="90 123 45 67"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 17, fontWeight: 700, letterSpacing: 0.5, background: "transparent" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor="password" style={{ fontSize: 13, fontWeight: 700 }}>
            Parol
          </label>
          <div style={{ height: 56, borderRadius: 16, border: "1px solid var(--line)", background: "var(--field)", display: "flex", alignItems: "center", padding: "0 6px 0 14px", gap: 10 }}>
            <Icon name="lock" size={18} color="var(--muted)" />
            <input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 17, fontWeight: 700, background: "transparent" }}
            />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Parolni yashirish" : "Parolni ko'rsatish"} className="icon-btn" style={{ border: "none", background: "transparent" }}>
              <Icon name="eye" size={20} color={show ? "var(--green)" : "var(--muted)"} />
            </button>
          </div>
        </div>

        {err && <div className="err">{err}</div>}

        <div className="bottom" style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", paddingTop: 12 }}>
          <button type="submit" className="m-cta" disabled={busy || !phone || !password}>
            {busy ? "Kuting…" : "Kirish"}
          </button>
          <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
            Login va parol olish uchun platforma administratoriga murojaat qiling
          </span>
        </div>
      </form>
      </div>
    </div>
  );
}
