import { API_BASE } from "../config/api";

export interface MenuItem {
  id: string;
  label: string;
  icon: string;
}

export interface MenuResponse {
  items: MenuItem[];
}

export interface ActionResponse {
  message: string;
  success: boolean;
}

export async function fetchMenu(): Promise<MenuResponse> {
  const res = await fetch(`${API_BASE}/api/menu`);
  if (!res.ok) throw new Error("Failed to fetch menu");
  return res.json();
}

export async function postMenuAction(action: string): Promise<ActionResponse> {
  const res = await fetch(`${API_BASE}/api/menu/${encodeURIComponent(action)}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to perform action");
  return res.json();
}
