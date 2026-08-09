import { Request, Response } from 'express';
import { executeGraphql } from './_utils';

const GET_STEP_INFO = `
  query GetStepInfo($step_run_id: uuid!) {
    step_runs_by_pk(id: $step_run_id) {
      step {
        type
        config
      }
    }
  }
`;

export default async function handler(req: Request, res: Response) {
  try {
    const event = req.body.event;
    if (!event) {
      return res.status(200).json({ message: 'No event data' });
    }

    const { id, status } = event.data.new;
    const oldStatus = event.data.old?.status;

    // Only trigger if status changed to 'completed'
    if (status !== 'completed' || status === oldStatus) {
      return res.status(200).json({ message: 'Ignored' });
    }

    const { step_runs_by_pk } = await executeGraphql(GET_STEP_INFO, { step_run_id: id });
    if (step_runs_by_pk?.step.type === 'notify') {
      const config = step_runs_by_pk.step.config;
      // In a real app, send email/slack here
      console.log(`[NOTIFY EVENT] Sending notification to ${config.destination}:`, config.message);
    }

    return res.status(200).json({ message: 'Notification checked' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: error.message || 'Internal server error' });
  }
}
