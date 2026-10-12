/* Mana (Halom Menus): public client settings. The key is a publishable key (safe in a browser); row-level security does the guarding. */
window.HALOM_MENUS_CONFIG = {
  supabaseUrl: 'https://zemdhczqlhkabfwxccqq.supabase.co',
  supabaseKey: 'sb_publishable_2VJC5Vn-AlpkXKpQPOVnfA_5nirGaKS',
  shortBase: 'https://halom.io/m/',   // QR codes encode shortBase + slug + '?t=1'; links people share are shortBase + slug
  shortLive: true,
  viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',
  auth: { providers: [] },            // 'google', 'apple', 'facebook': a button shows only for the ones listed here
  features: { scan: false }           // true once the menu scanner's key is set and one real scan has passed
};
