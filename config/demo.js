/* Mana's demo settings: the Supabase project `mana` (schema 2). Built with MANA_ENV=demo, served on a machine, never published (docs/environments.md). */
window.HALOM_MENUS_CONFIG = {
  supabaseUrl: 'https://hhmjcudeiiycwqqklksc.supabase.co',
  supabaseKey: 'sb_publishable_AI-_3IJMOwIaxuMEZIRWHg_JWVMF0Io',
  env: 'demo', schema: 2, realtime: true,
  shortBase: location.origin + '/m/',  // the demo's own short links, on the server that serves this build (tools/serve-site.mjs routes /m/<slug>); never halom.io's
  shortLive: true,
  siteBase: location.origin + '/mana/',          // the product's address (F01); v2 reads it, never halom.io outside production
  support: { whatsapp: 'https://wa.me/972542022269' },   // Halom's support number, as the site publishes it
  viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',
  auth: { providers: [] },
  features: { scan: false }           // the scanner function is not on `mana` yet
};
