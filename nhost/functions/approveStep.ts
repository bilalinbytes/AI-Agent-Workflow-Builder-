import { Request, Response } from 'express';
import { executeGraphql } from './_utils';
import { executeSteps } from './_executor';

const GET_STEP_AND_USER = `
  query GetStepAndUser($step_run_id: uuid!, $user_id: uuid!) {
    step_runs_by_pk(id: $step_run_id) {
      id
      status
      workflow_run {
        id
        workflow {
          organization_id
          organization {
            members(where: {user_id: {_eq: $user_id}}) {
              role
            }
          }
        }
      }
    }
  }
`;

const APPROVE_STEP_MUTATION = `
  mutation ApproveStep($step_run_id: uuid!, $user_id: uuid!) {
    update_step_runs_by_pk(pk_columns: {id: $step_run_id}, _set: {status: "completed", approved_by: $user_id, approved_at: "now()"}) {
      id
    }
    update_workflow_runs(where: {step_runs: {id: {_eq: $step_run_id}}}, _set: {status: "running"}) {
      affected_rows
    }
  }
`;

export default async function handler(req: Request, res: Response) {
  try {
    const { step_run_id } = req.body.input || {};
    const userId = req.body.session_variables?.['x-hasura-user-id'];

    if (!userId || !step_run_id) {
      return res.status(400).json({ message: 'Missing user or step run id' });
    }

    const { step_runs_by_pk } = await executeGraphql(GET_STEP_AND_USER, {
      step_run_id,
      user_id: userId,
    });

    if (!step_runs_by_pk) {
      return res.status(404).json({ message: 'Step run not found' });
    }

    if (step_runs_by_pk.status !== 'paused') {
      return res.status(400).json({ message: 'Step is not paused' });
    }

    const members = step_runs_by_pk.workflow_run.workflow.organization.members;
    if (members.length === 0 || !['owner', 'editor'].includes(members[0].role)) {
      return res.status(403).json({ message: 'You do not have permission to approve this step (Layer 2 Gate)' });
    }

    await executeGraphql(APPROVE_STEP_MUTATION, {
      step_run_id,
      user_id: userId
    });

    // Resume execution
    executeSteps(step_runs_by_pk.workflow_run.id, step_runs_by_pk.workflow_run.workflow.organization_id).catch(console.error);

    return res.status(200).json({
      success: true,
      step_run_id,
      message: 'Step approved successfully'
    });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
