"use client";

import { useBackendSession } from "@/context/auth-session";
import {
  ProviderCredential,
  listProviderCredentials,
  createProviderCredential,
} from "@/lib/backend";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type CreateCredentialInput = {
  base_url: string;
  kod: string;
  sifre: string;
};

const STORAGE_PREFIX = "ahla.providerCredential";

const getInitialSelection = (key: string) => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(key) ?? "";
};

export function useProviderCredentials(provider: string) {
  const storageKey = `${STORAGE_PREFIX}.${provider}`;
  const { token, status } = useBackendSession();
  const [credentials, setCredentials] = useState<ProviderCredential[]>([]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>(() =>
    getInitialSelection(storageKey)
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const persistSelection = useCallback(
    (id: string) => {
      if (typeof window === "undefined") return;
      if (id) {
        window.localStorage.setItem(storageKey, id);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    },
    [storageKey]
  );

  const selectCredential = useCallback(
    (id: string) => {
      setSelectedCredentialId(id);
      persistSelection(id);
    },
    [persistSelection]
  );

  const refresh = useCallback(async () => {
    if (status !== "ready" || !token) {
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const list = await listProviderCredentials(token, provider);
      setCredentials(list);
      if (!list.length) {
        setSelectedCredentialId("");
        persistSelection("");
        return;
      }
      if (!list.some((cred) => cred.id === selectedCredentialId)) {
        const fallback = list[0].id;
        setSelectedCredentialId(fallback);
        persistSelection(fallback);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load provider credentials"
      );
    } finally {
      setLoading(false);
    }
  }, [persistSelection, provider, selectedCredentialId, status, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createCredential = useCallback(
    async (input: CreateCredentialInput) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      setCreating(true);
      setError(undefined);
      try {
        const credential = await createProviderCredential(token, {
          provider,
          base_url: input.base_url,
          kod: input.kod,
          sifre: input.sifre,
        });
        setCredentials((prev) => [credential, ...prev]);
        setSelectedCredentialId(credential.id);
        persistSelection(credential.id);
        return credential;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create credential";
        setError(message);
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [persistSelection, provider, token]
  );

  const hasCredentials = useMemo(() => credentials.length > 0, [credentials]);

  return {
    credentials,
    selectedCredentialId,
    loading,
    creating,
    error,
    hasCredentials,
    selectCredential,
    createCredential,
    refresh,
  };
}

type ProviderCredentialContextValue = ReturnType<typeof useProviderCredentials>;

const ProviderCredentialsContext = createContext<ProviderCredentialContextValue | null>(null);

type ProviderCredentialsProviderProps = {
  provider: string;
  children: ReactNode;
};

export function ProviderCredentialsProvider({
  provider,
  children,
}: ProviderCredentialsProviderProps) {
  const value = useProviderCredentials(provider);
  return (
    <ProviderCredentialsContext.Provider value={value}>
      {children}
    </ProviderCredentialsContext.Provider>
  );
}

export function useProviderCredentialContext() {
  const ctx = useContext(ProviderCredentialsContext);
  if (!ctx) {
    throw new Error(
      "useProviderCredentialContext must be used within ProviderCredentialsProvider"
    );
  }
  return ctx;
}
