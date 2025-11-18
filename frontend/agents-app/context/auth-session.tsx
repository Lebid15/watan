"use client";

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN, assertEnv } from "@/lib/env";
import { AuthExchangeResponse, BackendUser, exchangeAuth0Token } from "@/lib/backend";

export type SessionStatus = "idle" | "connecting" | "ready" | "error";

type SessionContextValue = {
  status: SessionStatus;
  user: BackendUser | null;
  token: string | null;
  error?: string;
  connect: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function loadPersistedSession(): AuthExchangeResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ahla.session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistSession(data: AuthExchangeResponse | null) {
  if (typeof window === "undefined") return;
  if (!data) {
    window.localStorage.removeItem("ahla.session");
    return;
  }
  window.localStorage.setItem("ahla.session", JSON.stringify(data));
}

export function AuthProviders({ children }: { children: ReactNode }) {
  assertEnv("NEXT_PUBLIC_AUTH0_DOMAIN", AUTH0_DOMAIN);
  assertEnv("NEXT_PUBLIC_AUTH0_CLIENT_ID", AUTH0_CLIENT_ID);
  const redirectUri = typeof window === "undefined" ? undefined : window.location.origin;

  return (
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      cacheLocation="localstorage"
      useRefreshTokens
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: AUTH0_AUDIENCE || undefined,
      }}
    >
      <BackendSessionProvider>{children}</BackendSessionProvider>
    </Auth0Provider>
  );
}

function BackendSessionProvider({ children }: { children: ReactNode }) {
  const { loginWithPopup, logout: auth0Logout, getIdTokenClaims, isAuthenticated } = useAuth0();
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<BackendUser | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const persisted = loadPersistedSession();
    if (persisted) {
      setToken(persisted.token);
      setUser(persisted.user);
      setStatus("ready");
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(undefined);
      if (!isAuthenticated) {
        await loginWithPopup();
      }
      const claims = await getIdTokenClaims();
      const idToken = claims?.__raw;
      if (!idToken) {
        throw new Error("لم يتم الحصول على رمز Auth0");
      }
      const session = await exchangeAuth0Token(idToken);
      setToken(session.token);
      setUser(session.user);
      persistSession(session);
      setStatus("ready");
    } catch (err) {
      console.error("Auth connection failed", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "فشل تسجيل الدخول");
    }
  }, [getIdTokenClaims, isAuthenticated, loginWithPopup]);

  const logout = useCallback(async () => {
    persistSession(null);
    setToken(null);
    setUser(null);
    setStatus("idle");
    await auth0Logout({ logoutParams: { returnTo: window.location.origin } });
  }, [auth0Logout]);

  const value = useMemo(
    () => ({ status, token, user, error, connect, logout }),
    [connect, error, logout, status, token, user]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useBackendSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useBackendSession must be used within AuthProviders");
  }
  return ctx;
}
