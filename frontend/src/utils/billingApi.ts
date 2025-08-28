import api, { API_ROUTES } from './api';

// NOTE: We intentionally avoid referencing API_ROUTES.billing.* at module top-level
// so TypeScript won't try to resolve missing literal properties if the type shape
// of API_ROUTES was widened without billing/adminBilling in its declaration.

function billingRoutes() {
  return (API_ROUTES as any)?.billing || {};
}
function adminBillingRoutes() {
  return (API_ROUTES as any)?.adminBilling || {};
}

export async function getTenantBillingOverview(token: string) {
  const B = billingRoutes();
  return api.get(B.overview, { headers: { Authorization: `Bearer ${token}` } });
}
export async function getTenantInvoices(token: string, params?: { status?: string; overdue?: boolean }) {
  const B = billingRoutes();
  return api.get(B.invoices ? B.invoices(params) : undefined, { headers: { Authorization: `Bearer ${token}` } });
}
export async function requestBillingPayment(token: string, body: { amountUsd: number; methodId: string; invoiceId?: string }) {
  const B = billingRoutes();
  return api.post(B.pay, body, { headers: { Authorization: `Bearer ${token}` } });
}
export async function adminListTenants(token: string, limit=20, offset=0) {
  const AB = adminBillingRoutes();
  return api.get(AB.tenants ? AB.tenants(limit, offset) : undefined, { headers: { Authorization: `Bearer ${token}` } });
}
export async function adminListInvoices(token: string, tenantId: string) {
  const AB = adminBillingRoutes();
  return api.get(AB.invoices ? AB.invoices(tenantId) : undefined, { headers: { Authorization: `Bearer ${token}` } });
}
export async function adminMarkInvoicePaid(token: string, id: string, depositId?: string) {
  const AB = adminBillingRoutes();
  return api.post(AB.markPaid ? AB.markPaid(id) : undefined, { depositId }, { headers: { Authorization: `Bearer ${token}` } });
}
export async function adminHealth(token: string) {
  const AB = adminBillingRoutes();
  return api.get(AB.health, { headers: { Authorization: `Bearer ${token}` } });
}

export const billingApi = {
  getTenantBillingOverview,
  getTenantInvoices,
  requestBillingPayment,
  adminListTenants,
  adminListInvoices,
  adminMarkInvoicePaid,
  adminHealth,
};
