// Applies the auth stub, every migration and the synthetic seed to a throwaway cluster, prints what exists, stops.
// Usage: node tests/harness/smoke.mjs
import { startCluster, migrationFiles } from './cluster.mjs';

const t0 = Date.now();
const c = await startCluster({ seed: true });
try {
  const { rows } = await c.admin.query(`
    select (select count(*) from pg_tables where schemaname = 'public') as tables,
           (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity) as tables_without_rls,
           (select count(*) from pg_policies where schemaname = 'public') as policies,
           (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') as rpcs`);
  console.log(`migrations: ${migrationFiles().join(', ')}`);
  console.log(JSON.stringify(rows[0]), `in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await c.stop();
}
