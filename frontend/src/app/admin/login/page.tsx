"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { Logo } from "@/components/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/auth/admin-login", { body: { email, password } });
      setToken(r.token, "admin");
      router.replace("/admin");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--green-deep)" }}>
      <form onSubmit={submit} className="card" style={{ width: "100%", maxWidth: 400, padding: 28, display: "flex", flexDirection: "column", gap: 16, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Logo />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>Qarz Daftar</span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Admin panel</span>
          </div>
        </div>
        <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>Kirish</h1>
        <div className="field">
          <label htmlFor="a-email" className="label">
            Email
          </label>
          <input id="a-email" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@qarzdaftar.uz" />
        </div>
        <div className="field">
          <label htmlFor="a-pass" className="label">
            Parol
          </label>
          <input id="a-pass" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {err && <div className="err">{err}</div>}
        <button type="submit" className="btn btn-primary" style={{ height: 48 }} disabled={busy}>
          {busy ? "Kuting…" : "Kirish"}
        </button>
      </form>
    </div>
  );
}
