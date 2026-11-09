export type Health = { status: "ok" };

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch(`${apiUrl}/api/health`, { signal });
  if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
  return (await response.json()) as Health;
}
