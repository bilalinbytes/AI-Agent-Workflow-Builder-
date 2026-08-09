# Write-up: AI Agent Workflow Builder Architecture

## Schema Reasoning
The database schema revolves around achieving strict multi-tenant isolation (Organization level) and an ordered workflow graph.
- **Organizations & Org Members**: `organizations` acts as the root boundary. `org_members` ties Nhost `auth.users` to organizations with specific roles (`owner`, `editor`, `viewer`).
- **Workflows & Steps**: `workflows` belong directly to an organization. `workflow_steps` tracks the execution template, leveraging `step_order` for execution sequence and `config` as JSONB for dynamic step parameters without schema migrations for each new tool.
- **Executions (Runs)**: `workflow_runs` tracks an individual execution instance, and `step_runs` stores the state, inputs, and outputs of every discrete node evaluation.
- **Usage View**: The `org_usage_stats` SQL view automatically aggregates LLM call usage by counting completed `llm_call` step_runs, decoupling complex quota logic from the application tier.

## The Dual Permission System
A core requirement of this application is that standard Row Level Security (RLS) is not sufficient for securing execution flows mid-flight. Thus, the system uses two distinct authorization layers:

### Layer 1: Data Isolation (Hasura Permissions)
Enforced purely at the database level by Hasura's permission engine. Every GraphQL query is scoped by the `X-Hasura-User-Id` header.
Hasura uses the `org_members` relationship to automatically rewrite queries. 
For example, a user attempting to query `workflows` will only receive records where the parent `organization` contains a member matching their user ID. This guarantees that an "Org A" user can never accidentally or maliciously query "Org B" data, even through direct ID guessing, because the GraphQL engine strictly drops the row at the SQL generation level.

### Layer 2: Execution Gating (Action Handlers)
While Layer 1 prevents unauthorized *reading and writing of rows*, it cannot handle conditional execution states (e.g., stopping mid-workflow and only allowing specific roles to resume it).
To solve this, mutations that drive execution (`triggerWorkflowRun` and `approveStep`) are routed to Node.js Serverless Functions via Hasura Actions.
Inside these functions, we perform *Layer 2 checks*:
1. The function securely extracts the user's ID from session variables provided by Hasura.
2. It explicitly queries the user's role in the organization.
3. If the role is not `owner` or `editor`, the execution is immediately rejected with a 403 Forbidden.
This mid-execution decision guarantees that even if a Viewer somehow triggers the action payload, the function verifies their role before touching the `step_runs` or resuming the workflow graph.

## Approval Gate Implementation
The `approval_gate` step type is unique because it forces the executor engine (`_executor.ts`) to immediately yield and halt execution.
When the loop encounters an `approval_gate`:
1. It updates the `step_run` status to `paused`.
2. It updates the parent `workflow_run` status to `paused`.
3. It exits the function loop entirely (yielding execution).

The UI subscribes to these status changes in real-time. When it detects a `paused` state, it surfaces an "Approve & Continue" button (conditionally hidden from `viewer` roles, though the backend enforces this regardless). 
Clicking the button fires the `approveStep` Action. The handler verifies Layer 2 permissions, marks the step as `completed`, records the `approved_by` UUID, sets the workflow back to `running`, and immediately re-invokes the `executeSteps` loop to pick up the remaining steps.
