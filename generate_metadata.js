const fs = require('fs');
const path = require('path');

const tablesDir = path.join(__dirname, 'nhost', 'metadata', 'databases', 'default', 'tables');
fs.mkdirSync(tablesDir, { recursive: true });

const tables = [
  {
    table: { schema: 'public', name: 'organizations' },
    array_relationships: [
      { name: 'members', using: { foreign_key_constraint_on: { column: 'organization_id', table: { schema: 'public', name: 'org_members' } } } },
      { name: 'workflows', using: { foreign_key_constraint_on: { column: 'organization_id', table: { schema: 'public', name: 'workflows' } } } }
    ],
    select_permissions: [
      {
        role: 'owner',
        permission: {
          columns: '*',
          filter: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _eq: 'owner' } } }
        }
      },
      {
        role: 'editor',
        permission: {
          columns: '*',
          filter: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } }
        }
      },
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } }
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'org_members' },
    object_relationships: [
      { name: 'organization', using: { foreign_key_constraint_on: 'organization_id' } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } }
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'workflows' },
    object_relationships: [
      { name: 'organization', using: { foreign_key_constraint_on: 'organization_id' } }
    ],
    array_relationships: [
      { name: 'steps', using: { foreign_key_constraint_on: { column: 'workflow_id', table: { schema: 'public', name: 'workflow_steps' } } } },
      { name: 'triggers', using: { foreign_key_constraint_on: { column: 'workflow_id', table: { schema: 'public', name: 'workflow_triggers' } } } },
      { name: 'runs', using: { foreign_key_constraint_on: { column: 'workflow_id', table: { schema: 'public', name: 'workflow_runs' } } } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } }
        }
      }
    ],
    insert_permissions: [
      {
        role: 'editor',
        permission: {
          check: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } },
          columns: ['name', 'description', 'organization_id']
        }
      }
    ],
    update_permissions: [
      {
        role: 'editor',
        permission: {
          check: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } },
          columns: ['name', 'description'],
          filter: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } }
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'workflow_steps' },
    object_relationships: [
      { name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } } }
        }
      }
    ],
    insert_permissions: [
      {
        role: 'editor',
        permission: {
          check: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } } },
          columns: ['workflow_id', 'type', 'step_order', 'config']
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'workflow_triggers' },
    object_relationships: [
      { name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } } }
        }
      }
    ],
    insert_permissions: [
      {
        role: 'editor',
        permission: {
          check: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } } },
          columns: ['workflow_id', 'type', 'config']
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'workflow_runs' },
    object_relationships: [
      { name: 'workflow', using: { foreign_key_constraint_on: 'workflow_id' } }
    ],
    array_relationships: [
      { name: 'step_runs', using: { foreign_key_constraint_on: { column: 'workflow_run_id', table: { schema: 'public', name: 'step_runs' } } } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } } }
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'step_runs' },
    object_relationships: [
      { name: 'workflow_run', using: { foreign_key_constraint_on: 'workflow_run_id' } },
      { name: 'step', using: { foreign_key_constraint_on: 'workflow_step_id' } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { workflow_run: { workflow: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } } } }
        }
      }
    ],
    event_triggers: [
      {
        name: 'step_run_notify',
        definition: {
          enable_manual: false,
          insert: { columns: '*' },
          update: { columns: ['status'] }
        },
        webhook: '{{NHOST_BACKEND_URL}}/v1/functions/notifyEventTrigger'
      }
    ]
  },
  {
    table: { schema: 'public', name: 'org_usage_stats' },
    object_relationships: [
      { name: 'organization', using: { manual_configuration: { remote_table: { schema: 'public', name: 'organizations' }, column_mapping: { organization_id: 'id' } } } }
    ],
    select_permissions: [
      {
        role: 'viewer',
        permission: {
          columns: '*',
          filter: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' } } } }
        }
      }
    ]
  },
  {
    table: { schema: 'public', name: 'watched_events' },
    object_relationships: [
      { name: 'organization', using: { foreign_key_constraint_on: 'organization_id' } }
    ],
    insert_permissions: [
      {
        role: 'editor',
        permission: {
          check: { organization: { members: { user_id: { _eq: 'X-Hasura-User-Id' }, role: { _in: ['owner', 'editor'] } } } },
          columns: ['organization_id', 'payload']
        }
      }
    ],
    event_triggers: [
      {
        name: 'db_event_watcher',
        definition: {
          enable_manual: false,
          insert: { columns: '*' }
        },
        webhook: '{{NHOST_BACKEND_URL}}/v1/functions/dbEventWatcher'
      }
    ]
  }
];

// Helper to convert JSON to minimal YAML manually since we don't have js-yaml installed
function toYaml(obj, indent = 0) {
  const spaces = ' '.repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]\n';
    let yaml = '';
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        const itemYaml = toYaml(item, indent + 2);
        yaml += `${spaces}- ${itemYaml.trimStart()}`;
      } else {
        yaml += `${spaces}- ${item}\n`;
      }
    }
    return yaml;
  } else if (typeof obj === 'object' && obj !== null) {
    let yaml = '';
    let first = true;
    for (const key of Object.keys(obj)) {
      if (obj[key] === undefined) continue;
      const keyPrefix = first ? '' : spaces;
      first = false;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        const childYaml = toYaml(obj[key], indent + 2);
        if (Array.isArray(obj[key]) && obj[key].length === 0) {
          yaml += `${keyPrefix}${key}: []\n`;
        } else {
          yaml += `${keyPrefix}${key}:\n${childYaml}`;
        }
      } else {
        yaml += `${keyPrefix}${key}: ${obj[key]}\n`;
      }
    }
    return yaml || '{}\n';
  } else {
    return `${obj}\n`;
  }
}

let tablesList = [];

for (const tableConfig of tables) {
  const yamlContent = toYaml(tableConfig);
  const filename = `public_${tableConfig.table.name}.yaml`;
  fs.writeFileSync(path.join(tablesDir, filename), yamlContent);
  tablesList.push(`!include ${filename}`);
}

fs.writeFileSync(path.join(tablesDir, 'tables.yaml'), tablesList.map(t => `- ${t}`).join('\n') + '\n');
console.log('Metadata generated successfully.');
