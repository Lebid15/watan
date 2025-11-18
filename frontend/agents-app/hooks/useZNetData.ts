"use client";

import { useCallback, useEffect, useState } from "react";
import { useBackendSession } from "@/context/auth-session";
import { ZNetBalanceResponse, ZNetProduct, fetchWithAuth } from "@/lib/backend";

type State = {
  products: ZNetProduct[];
  balance: ZNetBalanceResponse | null;
  loading: boolean;
  error?: string;
};

const initialState: State = {
  products: [],
  balance: null,
  loading: false,
};

export function useZNetData(auto = false, credentialId?: string) {
  const { token, status } = useBackendSession();
  const [state, setState] = useState<State>(initialState);

  const load = useCallback(async () => {
    if (!token || !credentialId) {
      return;
    }
    setState((prev: State) => ({ ...prev, loading: true, error: undefined }));
    try {
      const [balance, products] = await Promise.all([
        fetchWithAuth<ZNetBalanceResponse>(
          token,
          `/api/v1/providers/znet/balance?credential_id=${encodeURIComponent(
            credentialId
          )}`
        ),
        fetchWithAuth<{ items: ZNetProduct[] }>(
          token,
          `/api/v1/providers/znet/products?credential_id=${encodeURIComponent(
            credentialId
          )}`
        ),
      ]);
      setState({ balance, products: products.items, loading: false });
    } catch (err) {
      setState((prev: State) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "تعذر تحميل بيانات المزود",
      }));
    }
  }, [credentialId, token]);

  useEffect(() => {
    if (auto && status === "ready" && token && credentialId) {
      load();
    }
  }, [auto, credentialId, load, status, token]);

  return { ...state, reload: load };
}
