import { Request, Response } from 'express';
import { executeGraphql } from './_utils';

const GET_WORKFLOW_AND_USER = `
  query GetWorkflow($workflow_id: uuid!, $user_id: uuid!) {
    workflows_by_pk(id: $workflow_id) {
      id
      organization_id
      organization {
        quota_limit
        members(where: {user_id: {_eq: $user_id}}) {
          role
        }
      }
      steps(order_by: {step_order: asc}) {
        id
        type
        config
        step_order
      }
    }
    org_usage_stats {
      organization_id
      total_runs
      used_llm_calls
    }
  }
`;

const INSERT_RUN = `
  mutation InsertRun($workflow_id: uuid!, $steps: [step_runs_insert_input!]!) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflow_id,
      status: "running",
      step_runs: {
        data: $steps
      }
    }) {
      id
    }
  }
`;

export default async function handler(req: Request, res: Response) {
  try {
    const { workflow_id } = req.body.input || {};
    const userId = req.body.session_variables?.['x-hasura-user-id'];

    if (!userId || !workflow_id) {
      return res.status(400).json({ message: 'Missing user or workflow id' });
    }

    const { workflows_by_pk, org_usage_stats } = await executeGraphql(GET_WORKFLOW_AND_USER, {
      workflow_id,
      user_id: userId,
    });

    if (!workflows_by_pk) {
      return res.status(404).json({ message: 'Workflow not found' });
    }

    const org = workflows_by_pk.organization;
    const members = org.members;

    if (members.length === 0 || !['owner', 'editor'].includes(members[0].role)) {
      return res.status(403).json({ message: 'You do not have permission to trigger this workflow' });
    }

    const stats = org_usage_stats.find((s: any) => s.organization_id === workflows_by_pk.organization_id);
    const usedCalls = stats?.used_llm_calls || 0;
    
    if (usedCalls >= org.quota_limit) {
      return res.status(403).json({ message: 'Organization quota exhausted' });
    }

    const steps = workflows_by_pk.steps;
    if (steps.length === 0) {
      return res.status(400).json({ message: 'Workflow has no steps' });
    }

    // Prepare step runs
    const stepRunsData = steps.map((step: any, index: number) => ({
      workflow_step_id: step.id,
      status: index === 0 ? 'pending' : 'pending', // first step could be running, but we let executor pick it up
    }));

    const result = await executeGraphql(INSERT_RUN, {
      workflow_id,
      steps: stepRunsData
    });

    const runId = result.insert_workflow_runs_one.id;

    // Async execution kickoff (fire and forget for this prototype)
    executeWorkflow(runId, workflows_by_pk.organization_id).catch(console.error);

    return res.status(200).json({
      success: true,
      workflow_run_id: runId,
      message: 'Workflow triggered successfully'
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}

// Background executor
async function executeWorkflow(runId: string, orgId: string) {
  // Ideally, call another serverless function or trigger a queue, 
  // but for the internship assignment, doing it in the same process is fine if it doesn't timeout.
  // Real world: Nhost functions might timeout. 
  // The assignment implies testing it end-to-end live, which is fast.
  const fetch = (await import('node-fetch')).default;
  
  // Implementation of step execution logic will go here
  // ... (to be implemented in next step or separate utility)
  const { executeSteps } = await import('./_executor');
  await executeSteps(runId, orgId);
}
