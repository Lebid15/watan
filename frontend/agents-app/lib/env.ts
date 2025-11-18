export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080")
  .replace(/\/$/, "");

export const AUTH0_DOMAIN = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "";
export const AUTH0_CLIENT_ID = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "";
export const AUTH0_AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || "";

export function assertEnv(name: string, value: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}
