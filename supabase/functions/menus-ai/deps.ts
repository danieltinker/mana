/** What the scanner needs from its runtime, passed in so every module but `index.ts` runs in Node tests with mocks. */

export type Env = {
  /** The project's address (`SUPABASE_URL`). */
  readonly url: string;
  /** The project's publishable (anon) key, used as `apikey` when the caller sent none. */
  readonly anonKey: string;
  /** The service role key (`SUPABASE_SERVICE_ROLE_KEY`): reads the images, saves the draft, marks a failure, purges. */
  readonly serviceKey: string;
  /** `ANTHROPIC_API_KEY`. Empty: every read answers `not_configured` and nothing is claimed. */
  readonly anthropicKey: string;
  /** `ANTHROPIC_WORKSPACE_ID`, for a key that is not tied to one workspace (v1, 11 Oct 2026). */
  readonly workspaceId: string;
  /** `MANA_SCAN_MODEL`. */
  readonly model: string;
};

export type Deps = {
  readonly env: Env;
  readonly fetch: typeof fetch;
  readonly now: () => number;
  /** One JSON line per call, with counts and codes only: never a menu's text, an image or a key. */
  readonly log: (entry: Record<string, unknown>) => void;
  /** Keeps the work running if the caller leaves (the platform's `EdgeRuntime.waitUntil`). */
  readonly waitUntil?: (work: Promise<unknown>) => void;
};

/** The same model the v1 scanner defaults to (`functions/menus-ai`). */
export const DEFAULT_SCAN_MODEL = 'claude-sonnet-5-5';
