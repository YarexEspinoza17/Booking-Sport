"use client";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function SuperadminLoginPage() {
  const search = useSearchParams();
  const router = useRouter();
  const next = search.get("next") || "/superadmin";
  const error = search.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setLocalError("");
    try {
      const res = await signIn("credentials", {
        redirect: false, // ← controla la redirección tú
        email,
        password,
      });
      if (res?.error) {
        setLocalError(res.error === "CredentialsSignin" ? "Credenciales inválidas." : res.error);
        return;
      }
      router.replace(next);
    } finally {
      setLoading(false);
    }
  }

  return (

    
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
<div className="p-4 bg-primary text-white rounded-xl shadow-soft">
  ✅ Si ves este bloque con fondo, Tailwind está funcionando.
</div>


      <div style={{ width: 360, padding: 24, border: "1px solid #eee", borderRadius: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Acceso Súper Admin</h1>
        <p style={{ color: "#666", marginTop: 6, marginBottom: 18 }}>
          Inicia sesión para gestionar organizaciones y sedes.
        </p>

        {(error || localError) && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: 10, borderRadius: 8, marginBottom: 12 }}>
            {localError || "Credenciales inválidas."}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required autoFocus
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }} />
          </label>

          <button type="submit" disabled={loading}
            style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #111", background: "#111", color: "#fff" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
