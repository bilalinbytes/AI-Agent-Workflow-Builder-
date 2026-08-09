import { executeGraphql } from './_utils';

const GET_RUN_DETAILS = `
  query GetRunDetails($run_id: uuid!) {
    workflow_runs_by_pk(id: $run_id) {
      id
      workflow_id
      workflow {
        organization_id
      }
      status
      step_runs(order_by: {step: {step_order: asc}}) {
        id
        status
        input
        output
        error
        attempt_count
        step {
          type
          config
        }
      }
    }
  }
`;

const UPDATE_STEP_RUN = `
  mutation UpdateStepRun($id: uuid!, $status: String!, $input: jsonb, $output: jsonb, $error: String) {
    update_step_runs_by_pk(pk_columns: {id: $id}, _set: {status: $status, input: $input, output: $output, error: $error}) {
      id
    }
  }
`;

const UPDATE_RUN_STATUS = `
  mutation UpdateRunStatus($id: uuid!, $status: String!) {
    update_workflow_runs_by_pk(pk_columns: {id: $id}, _set: {status: $status}) {
      id
    }
  }
`;

export async function executeSteps(runId: string, orgId: string) {
  const { workflow_runs_by_pk: run } = await executeGraphql(GET_RUN_DETAILS, { run_id: runId });
  if (!run || run.status === 'paused' || run.status === 'completed' || run.status === 'failed') {
    return;
  }

  let previousOutput: any = null;

  for (const stepRun of run.step_runs) {
    if (stepRun.status === 'completed') {
      previousOutput = stepRun.output;
      continue;
    }
    if (stepRun.status === 'failed' || stepRun.status === 'paused') {
      break; // Stop execution on failure or pause
    }

    // Mark as running
    await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'running', input: previousOutput });

    try {
      const { type, config } = stepRun.step;
      let output: any = null;

      if (type === 'llm_call') {
        // Stubbed LLM call for now, can be replaced with real Groq/OpenAI call
        await new Promise(r => setTimeout(r, 200));
        output = { response: `Mock LLM response for input: ${JSON.stringify(previousOutput)}`, ...config };
      } 
      else if (type === 'http_request') {
        const res = await fetch(config.url || 'https://jsonplaceholder.typicode.com/posts/1', {
          method: config.method || 'GET',
        });
        output = await res.json();
      }
      else if (type === 'conditional_branch') {
        const condition = config.condition || {};
        // Simplistic evaluation
        const passes = previousOutput && previousOutput[condition.key] === condition.value;
        output = { branch_taken: passes ? 'true_branch' : 'false_branch' };
      }
      else if (type === 'approval_gate') {
        await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'paused', input: previousOutput });
        await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'paused' });
        return; // Pause execution
      }
      else if (type === 'notify') {
        // Just mock
        output = { notified: true, destination: config.destination };
      }
      else if (type === 'db_write') {
        // Write to some dummy table or just log it
        output = { written: true, data: previousOutput };
      }

      await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'completed', output, error: null });
      previousOutput = output;

    } catch (error: any) {
      console.error("Step execution error details:", error);
      await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'failed', error: error.message });
      await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'failed' });
      return;
    }
  }

  // If all steps completed
  const { workflow_runs_by_pk: updatedRun } = await executeGraphql(GET_RUN_DETAILS, { run_id: runId });
  const allCompleted = updatedRun.step_runs.every((sr: any) => sr.status === 'completed');
  if (allCompleted) {
    await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'completed' });
  }
}
