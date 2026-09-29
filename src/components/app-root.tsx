"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { CampaignDetailScreen } from "@/components/campaign-detail-screen";
import { DashboardScreen } from "@/components/dashboard-screen";
import {
  databaseIsConfigured,
  getSession,
  onAuthChange,
  signIn,
  signUp,
} from "@/lib/repository";

export function AppRoot({ campaignId }: { campaignId?: string }) {
  const configured = databaseIsConfigured();
  const [ready, setReady] = useState(!configured);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;

    getSession()
      .then((current) => {
        if (active) setSession(current);
      })
      .catch((error: unknown) => {
        if (active) setSessionError(error instanceof Error ? error.message : "No se pudo abrir la sesión.");
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const unsubscribe = onAuthChange((current) => {
      if (active) {
        setSession(current);
        setReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [configured]);

  if (!ready) {
    return <LoadingScreen label="Abriendo tu espacio de trabajo…" />;
  }

  if (configured && !session) {
    return <AuthenticationScreen initialError={sessionError} />;
  }

  if (campaignId) {
    return <CampaignDetailScreen campaignId={campaignId} mode={configured ? "live" : "demo"} />;
  }

  return <DashboardScreen mode={configured ? "live" : "demo"} />;
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="loading-page">
      <div className="loading-mark" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

function AuthenticationScreen({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setMessage(null);

    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        setMessage(
          result.confirmationRequired
            ? "Revisa tu correo y confirma tu cuenta antes de iniciar sesión."
            : "Cuenta creada. Ya puedes empezar a registrar tus campañas.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo continuar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-symbol" aria-hidden="true">Y</div>
        <p className="eyebrow">Control avícola</p>
        <h1>{mode === "signin" ? "Ingresa a YSABAL" : "Crea tu acceso"}</h1>
        <p className="auth-copy">
          {mode === "signin"
            ? "Tus galpones, campañas y ventas quedan protegidos en tu cuenta."
            : "Usa un correo y una contraseña para proteger tu información."}
        </p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Correo
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            Contraseña
            <input autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} name="password" required type="password" />
          </label>
          {message ? <p className="form-message" role="status">{message}</p> : null}
          <button className="button button-primary button-full" disabled={busy} type="submit">
            {busy ? "Un momento…" : mode === "signin" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
        <button className="text-button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); }} type="button">
          {mode === "signin" ? "Aún no tengo cuenta" : "Ya tengo una cuenta"}
        </button>
      </section>
    </main>
  );
}
