import { API_BASE_URL } from "@/lib/env";

export type BackendUser = {
  id: string;
  tenantId: string;
  email?: string;
  name?: string;
  role: string;
};

export type AuthExchangeResponse = {
  token: string;
  user: BackendUser;
};

export type ZNetBalanceResponse = {
  balance: number;
  debt: number;
  note: string;
  raw: string;
};

export type ZNetProduct = {
  id: string;
  name: string;
  game: string;
  price_try: number;
  coupon: string;
};

export type ZNetProductsResponse = {
  items: ZNetProduct[];
};

export type ZNetOrderResponse = {
  success: boolean;
  cost_try: number;
  remaining_balance: number;
  provider_reference: string;
  raw: string;
};

export type ProviderCredential = {
  id: string;
  provider: string;
  base_url: string;
  created_at: string;
  updated_at: string;
};

export type CreateProviderCredentialPayload = {
  provider: string;
  base_url: string;
  kod: string;
  sifre: string;
};

export async function exchangeAuth0Token(idToken: string): Promise<AuthExchangeResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || "فشل تبادل رمز Auth0");
  }

  return res.json();
}

export async function fetchWithAuth<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const message = await safeMessage(res);
    throw new Error(message || "فشل الاتصال بالخادم");
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export async function listProviderCredentials(
  token: string,
  provider?: string
): Promise<ProviderCredential[]> {
  const search = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  const response = await fetchWithAuth<{ items: ProviderCredential[] }>(
    token,
    `/api/v1/provider-credentials${search}`
  );
  return response.items;
}

export async function createProviderCredential(
  token: string,
  payload: CreateProviderCredentialPayload
): Promise<ProviderCredential> {
  return fetchWithAuth<ProviderCredential>(token, "/api/v1/provider-credentials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function safeMessage(res: Response): Promise<string | undefined> {
  try {
    const data = await res.json();
    if (typeof data === "string") return data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  } catch {
    // ignore
  }
  return res.statusText;
}
