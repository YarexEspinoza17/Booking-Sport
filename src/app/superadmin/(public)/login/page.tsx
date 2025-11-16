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
        redirect: false,
        email,
        password,
      });
      if (res?.error) {
        setLocalError(
          res.error === "CredentialsSignin"
            ? "Credenciales inválidas."
            : res.error
        );
        return;
      }
      router.replace(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--color-bg))] relative">
      {/* Fondo suave con degradado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--color-muted))] via-[hsl(var(--color-bg))] to-[hsl(var(--color-muted))]" />

      {/* Contenedor principal */}
      <div className="relative z-10 w-full max-w-sm bg-[hsl(var(--color-card))] border border-[hsl(var(--color-border))] rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-[hsl(var(--color-text))]">
            Acceso Súper Admin
          </h1>
          <p className="text-sm text-[hsl(var(--color-text-weak))] mt-1">
            Inicia sesión para gestionar organizaciones y sedes.
          </p>
        </div>

        {(error || localError) && (
          <div className="bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg mb-4 text-sm text-center">
            {localError || "Credenciales inválidas."}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-[hsl(var(--color-text))]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] rounded-lg px-3 py-2 text-[hsl(var(--color-text))] placeholder-[hsl(var(--color-text-weak))] focus:ring-2 focus:ring-[hsl(var(--color-primary))] outline-none transition"
              placeholder="superadmin@accrom.test"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-[hsl(var(--color-text))]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[hsl(var(--color-border))] bg-[hsl(var(--color-card))] rounded-lg px-3 py-2 text-[hsl(var(--color-text))] placeholder-[hsl(var(--color-text-weak))] focus:ring-2 focus:ring-[hsl(var(--color-primary))] outline-none transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-400 transition font-medium disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-center text-[hsl(var(--color-text-weak))] mt-6">
          © {new Date().getFullYear()} Accrom Admin
        </p>
      </div>
    </div>
  );
}
