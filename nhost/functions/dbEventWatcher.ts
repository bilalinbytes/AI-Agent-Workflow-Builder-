import { Request, Response } from 'express';
import { executeGraphql } from './_utils';
import { executeSteps } from './_executor';

const GET_DB_EVENT_WORKFLOWS = `
  query GetWorkflowsForEvent($org_id: uuid!) {
    workflows(where: {
      organization_id: {_eq: $org_id}, 
      triggers: {type: {_eq: "db_event"}}
    }) {
      id
      organization_id
      steps(order_by: {step_order: asc}) {
        id
      }
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
    const event = req.body.event;
    if (!event || event.op !== 'INSERT') {
      return res.status(200).json({ message: 'Ignoring non-insert event' });
    }

    const { organization_id } = event.data.new;

    const { workflows } = await executeGraphql(GET_DB_EVENT_WORKFLOWS, { org_id: organization_id });

    for (const workflow of workflows) {
      if (workflow.steps.length === 0) continue;

      const stepRunsData = workflow.steps.map((step: any, index: number) => ({
        workflow_step_id: step.id,
        status: 'pending',
      }));

      const result = await executeGraphql(INSERT_RUN, {
        workflow_id: workflow.id,
        steps: stepRunsData
      });

      const runId = result.insert_workflow_runs_one.id;
      executeSteps(runId, workflow.organization_id).catch(console.error);
    }

    return res.status(200).json({ message: `Triggered ${workflows.length} workflows` });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
