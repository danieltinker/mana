// Halom menus: create an owner account (pilot). Public endpoint with its own checks: honeypot, minimum fill time,
// per-address rate limit. The account is confirmed at once because the project has no mail service yet, so the
// e-mail address is NOT verified. Paid launch needs a mail service and real confirmation.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "method" }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, code: "invalid_email" }); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const hp = String(body.hp ?? "");
  const elapsed = Number(body.elapsed_ms ?? 0);
  if (hp !== "" || (elapsed > 0 && elapsed < 1500)) return json({ ok: false, code: "spam" });
  if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ ok: false, code: "invalid_email" });
  if (password.length < 8 || password.length > 72) return json({ ok: false, code: "weak_password" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = await sha256hex(ip + "|" + key.slice(-24));
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();
  const { count: perHour } = await admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", hourAgo);
  const { count: perDay } = await admin.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("at", dayAgo);
  const { count: allDay } = await admin.from("signup_attempts").select("id", { count: "exact", head: true }).gte("at", dayAgo);
  if ((perHour ?? 0) >= 6 || (perDay ?? 0) >= 20 || (allDay ?? 0) >= 500) return json({ ok: false, code: "rate_limited" });
  const { data: attempt } = await admin.from("signup_attempts").insert({ ip_hash: ipHash }).select("id").single();

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { via: "menus-signup" } });
  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) return json({ ok: false, code: "exists" });
    if (msg.includes("password")) return json({ ok: false, code: "weak_password" });
    console.error("createUser failed", error.status, error.message);
    return json({ ok: false, code: "failed" });
  }
  if (attempt?.id) await admin.from("signup_attempts").update({ ok: true }).eq("id", attempt.id);
  return json({ ok: true });
});
