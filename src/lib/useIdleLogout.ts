"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

type Opts = {
  // milisegundos sin actividad antes de cerrar sesión
  timeoutMs?: number;
  // adónde redirigir al salir
  callbackUrl?: string;
};

// Eventos que cuentan como “actividad”
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "wheel",
  "touchstart",
  "scroll",
  "visibilitychange",
];

export default function useIdleLogout(opts: Opts = {}) {
  const { timeoutMs = 15 * 60 * 1000, callbackUrl = "/superadmin/login" } = opts;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        // sin actividad → salir
        signOut({ callbackUrl });
      }, timeoutMs);
    };

    // iniciar y escuchar eventos
    reset();
    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, reset, { passive: true }));

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, reset));
    };
  }, [timeoutMs, callbackUrl]);
}
