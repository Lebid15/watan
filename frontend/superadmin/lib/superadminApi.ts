import axios, { AxiosError } from 'axios';

const DEFAULT_BASE_URL = 'http://localhost:8080/api/v1/superadmin';
const SUPERADMIN_API_BASE_URL = (process.env.NEXT_PUBLIC_SUPERADMIN_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const TOKEN_KEY = 'superadminToken';

const superadminClient = axios.create({
  baseURL: SUPERADMIN_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

superadminClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export type SuperAdminProfile = {
  id: string;
  email: string;
  username: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type TenantStatus = 'active' | 'suspended' | 'pending';

export type TenantPayload = {
  name: string;
  display_name?: string;
  subdomain: string;
  contact_email: string;
  logo_url?: string;
  status?: TenantStatus;
};

export type TenantDTO = {
  id: string;
  name: string;
  display_name: string;
  subdomain: string;
  contact_email: string;
  logo_url?: string;
  status: TenantStatus;
};

export type ProductCategoryDTO = {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  sort_order: number;
  active: boolean;
};

export type ProductPayload = {
  category_id?: string;
  code: string;
  name: string;
  display_name?: string;
  base_cost_usd: number;
  available?: boolean;
  customizable?: boolean;
  min_amount?: number;
  max_amount?: number;
  sort_order?: number;
  input_parameters?: any;
  metadata?: any;
};

export type ProductDTO = {
  id: string;
  category_id: string;
  category?: ProductCategoryDTO | null;
  code: string;
  name: string;
  display_name: string;
  base_cost_usd: number;
  available: boolean;
  customizable: boolean;
  min_amount: number;
  max_amount: number;
  sort_order: number;
  input_parameters: any;
  metadata: any;
};

export function setSuperAdminToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearSuperAdminToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getSuperAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function extractErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    return (
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      fallback
    );
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export const superadminApi = {
  async login(email: string, password: string) {
    const res = await axios.post(`${SUPERADMIN_API_BASE_URL}/auth/login`, { email, password });
    return res.data as { token: string; super_admin: SuperAdminProfile };
  },
  async profile() {
    const res = await superadminClient.get('/auth/profile');
    return res.data.super_admin as SuperAdminProfile;
  },
  tenants: {
    async list(params?: { q?: string; status?: TenantStatus }) {
      const res = await superadminClient.get('/tenants', {
        params: {
          q: params?.q || undefined,
          status: params?.status || undefined,
        },
      });
      const data = res.data?.items;
      return Array.isArray(data) ? (data as TenantDTO[]) : [];
    },
    async create(payload: TenantPayload) {
      const res = await superadminClient.post('/tenants', payload);
      return res.data as TenantDTO;
    },
    async update(id: string, payload: Partial<TenantPayload>) {
      const res = await superadminClient.put(`/tenants/${id}`, payload);
      return res.data as TenantDTO;
    },
  },
  categories: {
    async list() {
      const res = await superadminClient.get('/categories');
      const data = res.data?.items;
      return Array.isArray(data) ? (data as ProductCategoryDTO[]) : [];
    },
  },
  products: {
    async list(params?: { q?: string; category_id?: string; available?: boolean }) {
      const res = await superadminClient.get('/products', {
        params: {
          q: params?.q || undefined,
          category_id: params?.category_id || undefined,
          available: typeof params?.available === 'boolean' ? params?.available : undefined,
        },
      });
      const data = res.data?.items;
      return Array.isArray(data) ? (data as ProductDTO[]) : [];
    },
    async create(payload: ProductPayload) {
      const res = await superadminClient.post('/products', payload);
      return res.data as ProductDTO;
    },
    async update(id: string, payload: Partial<ProductPayload>) {
      const res = await superadminClient.put(`/products/${id}`, payload);
      return res.data as ProductDTO;
    },
    async remove(id: string) {
      await superadminClient.delete(`/products/${id}`);
    },
  },
};

export default superadminClient;
