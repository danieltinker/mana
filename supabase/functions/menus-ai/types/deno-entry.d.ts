// For `npm run check:functions` only: the little of Deno that index.ts uses, so Node's TypeScript checks the entry
// too (tsconfig.entry.json). Deno checks the real thing at deploy; the edge runtime's own types come from jsr.
declare module 'jsr:@supabase/functions-js@2.117.2/edge-runtime.d.ts' {}

declare const Deno: {
  readonly env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};
