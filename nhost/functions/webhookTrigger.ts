import { Request, Response } from 'express';
import { executeGraphql } from './_utils';
import { executeSteps } from './_executor';

const GET_WORKFLOW_BY_SECRET = `
  query GetWorkflowBySecret($workflow_id: uuid!, $webhook_secret: String!) {
    workflows(where: {id: {_eq: $workflow_id}, webhook_secret: {_eq: $webhook_secret}}) {
      id
      organization_id
      organization {
        quota_limit
      }
      steps(order_by: {step_order: asc}) {
        id
      }
    }
    org_usage_stats {
      organization_id
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
    const { workflow_id, webhook_secret } = req.body;

    if (!workflow_id || !webhook_secret) {
      return res.status(400).json({ message: 'Missing workflow_id or webhook_secret' });
    }

    const { workflows, org_usage_stats } = await executeGraphql(GET_WORKFLOW_BY_SECRET, {
      workflow_id,
      webhook_secret,
    });

    if (workflows.length === 0) {
      return res.status(403).json({ message: 'Invalid workflow ID or secret' });
    }

    const workflow = workflows[0];
    const org = workflow.organization;

    const stats = org_usage_stats.find((s: any) => s.organization_id === workflow.organization_id);
    const usedCalls = stats?.used_llm_calls || 0;
    
    if (usedCalls >= org.quota_limit) {
      return res.status(403).json({ message: 'Organization quota exhausted' });
    }

    const steps = workflow.steps;
    if (steps.length === 0) {
      return res.status(400).json({ message: 'Workflow has no steps' });
    }

    // Prepare step runs
    const stepRunsData = steps.map((step: any) => ({
      workflow_step_id: step.id,
      status: 'pending',
    }));

    const result = await executeGraphql(INSERT_RUN, {
      workflow_id,
      steps: stepRunsData
    });

    const runId = result.insert_workflow_runs_one.id;

    // Async execution kickoff
    executeSteps(runId, workflow.organization_id).catch(console.error);

    return res.status(200).json({
      success: true,
      workflow_run_id: runId,
      message: 'Workflow triggered successfully via webhook'
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
