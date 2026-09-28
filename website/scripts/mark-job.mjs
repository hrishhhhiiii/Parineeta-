// CI step: node scripts/mark-job.mjs <building|live|failed> [error]. No-op for push-triggered runs.
const [status, error] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_ANON_KEY, JOB_ID, JOB_SECRET, RUN_URL, DEPLOY_URL } = process.env;
if (!JOB_ID) process.exit(0);
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_job`, {
  method: 'POST',
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_id: Number(JOB_ID), p_secret: JOB_SECRET, p_status: status, p_run_url: RUN_URL || null, p_deploy_url: DEPLOY_URL || null, p_error: error || null }),
});
if (!res.ok) {
  console.error(`mark_job(${status}) failed: HTTP ${res.status} ${await res.text()}`);
  process.exit(status === 'failed' ? 0 : 1);
}
console.log(`job ${JOB_ID} → ${status}`);
