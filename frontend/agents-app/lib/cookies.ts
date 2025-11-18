"use server";

import { cookies } from "next/headers";

export async function getSidebarCollapsed(): Promise<boolean> {
  const cookieStore = await cookies();
  const collapsed = cookieStore.get("sidebarCollapsed");
  return collapsed?.value === "true";
}

export async function setSidebarCollapsed(collapsed: boolean): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("sidebarCollapsed", collapsed.toString(), {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
}
