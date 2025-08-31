
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  pageInfo: {
    nextCursor: string | null;
    hasMore: boolean;
  };
  meta?: Record<string, unknown>;
}

export interface User {
  id: string;
  username?: string;
  email?: string;
  priceGroup?: {
    id: string;
    name: string;
  };
  tenantId?: string;
}

export interface Product {
  id: string;
  name?: string;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  icon?: string;
}

export interface ProductPackage {
  id: string;
  name?: string;
  image?: string;
  imageUrl?: string;
  logoUrl?: string;
  iconUrl?: string;
  icon?: string;
  product?: Product;
}

export interface Order {
  id: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  sentAt?: string;
  completedAt?: string;
  product?: Product;
  package?: ProductPackage;
  user?: User;
  username?: string;
  userEmail?: string;
  providerMessage?: string;
  pinCode?: string;
  notesCount?: number;
  providerName?: string;
  type?: string;
  sellPrice?: number;
  sellPriceCurrency?: string;
}

export interface Currency {
  id: string;
  code: string;
  name?: string;
  symbol?: string;
}

export interface PriceGroup {
  id: string;
  name: string;
  usersCount?: number;
}

export interface Integration {
  id: string;
  name?: string;
  type?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface PaymentMethod {
  id: string;
  name?: string;
  type?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface Deposit {
  id: string;
  amount?: number;
  currency?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  user?: User;
  method?: PaymentMethod;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  channel: 'in_app' | 'email' | 'sms';
  priority: 'low' | 'normal' | 'high';
  createdAt?: string;
  readAt?: string;
}

export interface FormEvent {
  target: {
    value: string;
    name?: string;
  };
  preventDefault?: () => void;
}

export interface MouseEvent {
  target: EventTarget | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

export interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
    };
    status?: number;
  };
  message?: string;
  name?: string;
}
