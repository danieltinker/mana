// The Halom bot: what Halom staff do in the back office, through the staff RPCs only (ops_*, act_for_owner,
// create_staff_invite / redeem_staff_invite). Staff never write a venue's tables directly; marking a venue as a demo
// is ops_set_demo, an admin's.
import { asUser, createUser, signIn } from './client.mjs';

export class HalomBot {
  /**
   * The first admin: an account, then the one SQL line supabase/README.md says whoever applies the migrations runs
   * (`insert into public.staff …`). `setup` is the stack (its addStaff runs that line); nothing else here uses SQL.
   */
  static async firstAdmin(target, setup, { email, password = 'sim-staff-pass-1' }) {
    await createUser(target, { email, password });
    const session = await signIn(target, { email, password });
    await setup.addStaff(session.userId, 'admin');
    return new HalomBot(target, session, 'admin');
  }

  /** A staff member who joins with an invite code an admin made: sign up, sign in, redeem. */
  static async join(target, { email, password = 'sim-staff-pass-1', code }) {
    await createUser(target, { email, password });
    const session = await signIn(target, { email, password });
    const bot = new HalomBot(target, session, null);
    const r = await bot.api.rpc('redeem_staff_invite', { p_code: code });
    if (!r.ok) throw new Error('redeem_staff_invite: ' + JSON.stringify(r));
    bot.role = r.role;
    return bot;
  }

  constructor(target, session, role) {
    this.target = target;
    this.session = session;
    this.userId = session.userId;
    this.role = role;
    this.api = asUser(target, session);
  }

  /** Admins only: an invite for one e-mail address; the code is returned once. */
  invite(email, role = 'support') { return this.api.rpc('create_staff_invite', { p_email: email, p_role: role }); }

  /** Phase 0's back office (kept for older callers; the clients list is `venues`). */
  overview() { return this.api.rpc('ops_overview', {}); }

  /** The clients list (ops_venues): filters, sort and paging as OpsVenuesQuery. */
  venues(filters = {}) { return this.api.rpc('ops_venues', { p_filters: filters }); }

  /** One venue (ops_venue): its row, members, onboarding, imports, cases and timeline. */
  venue(venueId) { return this.api.rpc('ops_venue', { p_venue: venueId }); }

  async venueCard(venueId) { return (await this.venue(venueId)).venue ?? null; }

  /** The stored menu Halom approves (ops_revision): the newest revision unless a number is asked. */
  revision(venueId, number = null) { return this.api.rpc('ops_revision', { p_venue: venueId, p_revision: number }); }

  /** Counts per minute or per day across venues or for one (ops_analytics, OpsAnalyticsQuery). */
  analytics(query) { return this.api.rpc('ops_analytics', { p_query: query }); }

  /** A support case's status or topic, with the reason the owner sees. */
  updateCase(caseId, { status = null, topic = null, reason }) {
    return this.api.rpc('ops_update_case', { p_case: caseId, p_status: status, p_topic: topic, p_reason: reason });
  }

  /** Admins only: label a venue demo or real (ops_set_demo), with the reason the owner sees. */
  setDemo(venueId, demo, reason) { return this.api.rpc('ops_set_demo', { p_venue: venueId, p_demo: demo, p_reason: reason }); }

  approve(venueId, reason) { return this.api.rpc('ops_approve_venue', { p_venue: venueId, p_reason: reason }); }

  /** The only staff write path into a venue's menu: logged with the reason, shown to the owner. */
  actForOwner(venueId, reason, action, payload = {}) {
    return this.api.rpc('act_for_owner', { p_venue: venueId, p_reason: reason, p_action: action, p_payload: payload });
  }

  /** Mana's own leads; every read is logged. */
  leads({ status = null, source = null, since = null, limit = 100 } = {}) {
    return this.api.rpc('ops_leads', { p_status: status, p_source: source, p_since: since, p_limit: limit });
  }

  updateLead(id, { status = null, owner = null, notes = null } = {}) {
    return this.api.rpc('ops_update_lead', { p_id: id, p_status: status, p_owner: owner, p_notes: notes });
  }

  /** A venue's dashboard as staff see it (the same numbers the owner sees). */
  dashboard(venueId, range = 'today') { return this.api.rpc('my_dashboard', { p_venue: venueId, p_range: range }); }

  /** Halom-wide activity (staff joins, invites, lead reads): rows with no venue. */
  staffActivity(limit = 100) {
    return this.api.select('activity_log', { select: 'id,at,actor_kind,via,reason,action,detail,n', venue_id: 'is.null', order: 'id.desc', limit });
  }
}
