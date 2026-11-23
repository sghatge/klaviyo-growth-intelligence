const BASE_URL = "https://a.klaviyo.com/api";
const DEFAULT_REVISION = "2026-10-15";

export function isKlaviyoConfigured() {
  return Boolean(process.env.KLAVIYO_PRIVATE_API_KEY);
}

function headers(extra?: Record<string, string>) {
  const key = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!key) throw new Error("Add a restricted Klaviyo private API key in server environment variables.");
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    accept: "application/vnd.api+json",
    revision: process.env.KLAVIYO_API_REVISION || DEFAULT_REVISION,
    ...extra,
  };
}

// Tiny in-memory TTL cache: Klaviyo rate limits are tight, and a public demo page can be refreshed a lot.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 60_000;

export async function klaviyoRequest<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const response = await fetch(`${BASE_URL}${path}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Klaviyo API returned ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const value = (await response.json()) as T;
  cache.set(path, { at: Date.now(), value });
  return value;
}

export async function klaviyoPost(path: string, body: unknown): Promise<{ status: number; text: string }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers({ "content-type": "application/vnd.api+json" }),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, text: (await response.text()).slice(0, 300) };
}

/** Writes are opt-in and limited to test addresses so a public demo can never touch real customers. */
export function eventWritePolicy(email: string): { allowed: boolean; reason: string } {
  if (!isKlaviyoConfigured()) return { allowed: false, reason: "No Klaviyo key configured, showing the payload as a dry run." };
  if (process.env.KLAVIYO_ALLOW_EVENT_WRITES !== "true") {
    return { allowed: false, reason: "Event writes are disabled (set KLAVIYO_ALLOW_EVENT_WRITES=true and use a key with events:write)." };
  }
  const allowed = (process.env.KLAVIYO_TEST_EMAIL_DOMAINS || "example.test").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!allowed.includes(domain)) return { allowed: false, reason: `Only test domains may be written: ${allowed.join(", ")}.` };
  return { allowed: true, reason: "Test address on an allowed domain." };
}
