const fs = require('fs');
const path = require('path');

const metadataDir = path.join(__dirname, 'nhost/metadata/databases/default/tables');

const filesContent = {
  'public_organizations.yaml': `table:
  name: organizations
  schema: public
array_relationships:
  - name: members
    using:
      foreign_key_constraint_on:
        column: organization_id
        table:
          name: org_members
          schema: public
  - name: workflows
    using:
      foreign_key_constraint_on:
        column: organization_id
        table:
          name: workflows
          schema: public
  - name: org_usage_stats
    using:
      manual_configuration:
        column_mapping:
          id: organization_id
        remote_table:
          name: org_usage_stats
          schema: public
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
          role:
            _eq: owner
  - role: editor
    permission:
      columns: "*"
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
          role:
            _in:
              - owner
              - editor
  - role: viewer
    permission:
      columns: "*"
      filter:
        members:
          user_id:
            _eq: X-Hasura-User-Id
`,

  'public_org_members.yaml': `table:
  name: org_members
  schema: public
object_relationships:
  - name: organization
    using:
      foreign_key_constraint_on: organization_id
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
`,

  'public_org_usage_stats.yaml': `table:
  name: org_usage_stats
  schema: public
object_relationships:
  - name: organization
    using:
      manual_configuration:
        column_mapping:
          organization_id: id
        remote_table:
          name: organizations
          schema: public
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
`,

  'public_workflows.yaml': `table:
  name: workflows
  schema: public
object_relationships:
  - name: organization
    using:
      foreign_key_constraint_on: organization_id
array_relationships:
  - name: steps
    using:
      foreign_key_constraint_on:
        column: workflow_id
        table:
          name: workflow_steps
          schema: public
  - name: triggers
    using:
      foreign_key_constraint_on:
        column: workflow_id
        table:
          name: workflow_triggers
          schema: public
  - name: workflow_runs
    using:
      foreign_key_constraint_on:
        column: workflow_id
        table:
          name: workflow_runs
          schema: public
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
insert_permissions:
  - role: owner
    permission:
      check:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _eq: owner
      columns:
        - name
        - description
        - organization_id
  - role: editor
    permission:
      check:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _in:
                - owner
                - editor
      columns:
        - name
        - description
        - organization_id
update_permissions:
  - role: owner
    permission:
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _eq: owner
      columns:
        - name
        - description
  - role: editor
    permission:
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _in:
                - owner
                - editor
      columns:
        - name
        - description
delete_permissions:
  - role: owner
    permission:
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _eq: owner
  - role: editor
    permission:
      filter:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
            role:
              _in:
                - owner
                - editor
`,

  'public_workflow_steps.yaml': `table:
  name: workflow_steps
  schema: public
object_relationships:
  - name: workflow
    using:
      foreign_key_constraint_on: workflow_id
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
insert_permissions:
  - role: owner
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _eq: owner
      columns:
        - workflow_id
        - type
        - step_order
        - config
  - role: editor
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _in:
                  - owner
                  - editor
      columns:
        - workflow_id
        - type
        - step_order
        - config
update_permissions:
  - role: owner
    permission:
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _eq: owner
      columns:
        - type
        - step_order
        - config
  - role: editor
    permission:
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _in:
                  - owner
                  - editor
      columns:
        - type
        - step_order
        - config
delete_permissions:
  - role: owner
    permission:
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _eq: owner
  - role: editor
    permission:
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _in:
                  - owner
                  - editor
`,

  'public_workflow_triggers.yaml': `table:
  name: workflow_triggers
  schema: public
object_relationships:
  - name: workflow
    using:
      foreign_key_constraint_on: workflow_id
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
insert_permissions:
  - role: owner
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _eq: owner
      columns:
        - workflow_id
        - type
        - config
  - role: editor
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
              role:
                _in:
                  - owner
                  - editor
      columns:
        - workflow_id
        - type
        - config
`,

  'public_workflow_runs.yaml': `table:
  name: workflow_runs
  schema: public
object_relationships:
  - name: workflow
    using:
      foreign_key_constraint_on: workflow_id
array_relationships:
  - name: step_runs
    using:
      foreign_key_constraint_on:
        column: workflow_run_id
        table:
          name: step_runs
          schema: public
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
insert_permissions:
  - role: owner
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
      columns:
        - workflow_id
        - status
  - role: editor
    permission:
      check:
        workflow:
          organization:
            members:
              user_id:
                _eq: X-Hasura-User-Id
      columns:
        - workflow_id
        - status
`,

  'public_step_runs.yaml': `table:
  name: step_runs
  schema: public
object_relationships:
  - name: workflow_run
    using:
      foreign_key_constraint_on: workflow_run_id
  - name: step
    using:
      foreign_key_constraint_on: workflow_step_id
select_permissions:
  - role: owner
    permission:
      columns: "*"
      filter:
        workflow_run:
          workflow:
            organization:
              members:
                user_id:
                  _eq: X-Hasura-User-Id
  - role: editor
    permission:
      columns: "*"
      filter:
        workflow_run:
          workflow:
            organization:
              members:
                user_id:
                  _eq: X-Hasura-User-Id
  - role: viewer
    permission:
      columns: "*"
      filter:
        workflow_run:
          workflow:
            organization:
              members:
                user_id:
                  _eq: X-Hasura-User-Id
update_permissions:
  - role: owner
    permission:
      filter:
        workflow_run:
          workflow:
            organization:
              members:
                user_id:
                  _eq: X-Hasura-User-Id
      columns:
        - status
        - approved_by
        - approved_at
        - output
  - role: editor
    permission:
      filter:
        workflow_run:
          workflow:
            organization:
              members:
                user_id:
                  _eq: X-Hasura-User-Id
      columns:
        - status
        - approved_by
        - approved_at
        - output
event_triggers:
  - name: step_run_notify
    definition:
      enable_manual: false
      insert:
        columns: "*"
      update:
        columns:
          - status
    retry_conf:
      num_retries: 0
      interval_sec: 10
      timeout_sec: 60
    webhook: "{{NHOST_FUNCTIONS_URL}}/notifyEventTrigger"
`,

  'public_watched_events.yaml': `table:
  name: watched_events
  schema: public
object_relationships:
  - name: organization
    using:
      foreign_key_constraint_on: organization_id
insert_permissions:
  - role: owner
    permission:
      check:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
      columns:
        - organization_id
        - payload
  - role: editor
    permission:
      check:
        organization:
          members:
            user_id:
              _eq: X-Hasura-User-Id
      columns:
        - organization_id
        - payload
event_triggers:
  - name: db_event_watcher
    definition:
      enable_manual: false
      insert:
        columns: "*"
    retry_conf:
      num_retries: 0
      interval_sec: 10
      timeout_sec: 60
    webhook: "{{NHOST_FUNCTIONS_URL}}/dbEventWatcher"
`
};

for (const [filename, content] of Object.entries(filesContent)) {
  fs.writeFileSync(path.join(metadataDir, filename), content, 'utf8');
  console.log(`Generated clean ${filename}`);
}
