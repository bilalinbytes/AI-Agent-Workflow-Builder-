// using native fetch

const HASURA_URL = 'https://local.hasura.local.nhost.run/v2/query';
const HASURA_ADMIN_SECRET = 'nhost-admin-secret';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const sql = `
CREATE TABLE IF NOT EXISTS public.workflow_results (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT encode(gen_random_bytes(16), 'hex') NOT NULL;
`;

async function run() {
  try {
    // 1. Run SQL
    console.log('Running SQL...');
    const resSql = await fetch(HASURA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        type: 'run_sql',
        args: { sql }
      })
    });
    console.log('SQL Response:', await resSql.json());

    // 2. Track table
    console.log('Tracking table workflow_results...');
    const resTrack = await fetch(HASURA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        type: 'pg_track_table',
        args: {
          table: { schema: 'public', name: 'workflow_results' },
          source: 'default'
        }
      })
    });
    console.log('Track Response:', await resTrack.json());

    // 3. Reload metadata to pick up changes we made to yaml files
    console.log('Reloading metadata...');
    const resReload = await fetch(HASURA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        type: 'reload_metadata',
        args: {
          reload_remote_schemas: true,
        }
      })
    });
    console.log('Reload Response:', await resReload.json());

  } catch (e) {
    console.error(e);
  }
}

run();
