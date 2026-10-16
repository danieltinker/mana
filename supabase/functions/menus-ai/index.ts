// Mana's scanner, v2 (ADR-006): the Deno entry. Everything it does is in handler.ts and the modules it imports, which
// the Node tests run with mocks (test/); this file only reads the environment. README.md says what deploying needs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { DEFAULT_SCAN_MODEL } from "./deps.ts";
import { handle } from "./handler.ts";

const env = (name: string): string => (Deno.env.get(name) ?? "").trim();

Deno.serve((req: Request) =>
  handle(req, {
    env: {
      url: env("SUPABASE_URL"),
      anonKey: env("SUPABASE_ANON_KEY"),
      serviceKey: env("SUPABASE_SERVICE_ROLE_KEY"),
      anthropicKey: env("ANTHROPIC_API_KEY"),
      workspaceId: env("ANTHROPIC_WORKSPACE_ID"),
      model: env("MANA_SCAN_MODEL") || DEFAULT_SCAN_MODEL,
    },
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    log: (entry) => console.log(JSON.stringify(entry)),
    // deno-lint-ignore no-explicit-any
    waitUntil: (work) => (globalThis as any).EdgeRuntime?.waitUntil?.(work),
  })
);
