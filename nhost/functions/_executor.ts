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
          id
          type
          config
        }
      }
    }
  }
`;

const UPDATE_STEP_RUN = `
  mutation UpdateStepRun($id: uuid!, $status: String!, $input: jsonb, $output: jsonb, $error: String, $attempt_count: Int) {
    update_step_runs_by_pk(pk_columns: {id: $id}, _set: {status: $status, input: $input, output: $output, error: $error, attempt_count: $attempt_count}) {
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

const INSERT_DB_WRITE = `
  mutation InsertWorkflowResult($workflow_run_id: uuid!, $data: jsonb!) {
    insert_workflow_results_one(object: {workflow_run_id: $workflow_run_id, data: $data}) {
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
  const skipStepIds = new Set<string>();

  for (const stepRun of run.step_runs) {
    if (stepRun.status === 'completed') {
      previousOutput = stepRun.output;
      continue;
    }
    if (stepRun.status === 'failed' || stepRun.status === 'paused') {
      break; // Stop execution on failure or pause
    }

    if (skipStepIds.has(stepRun.step.id)) {
      await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'completed', input: previousOutput, output: { skipped: true }, error: null, attempt_count: stepRun.attempt_count });
      continue;
    }

    // Mark as running
    await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'running', input: previousOutput, output: null, error: null, attempt_count: stepRun.attempt_count });

    let attemptCount = stepRun.attempt_count || 0;
    const maxRetries = (stepRun.step.type === 'llm_call' || stepRun.step.type === 'http_request') ? 2 : 0;
    let output: any = null;
    let success = false;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptCount++;
      try {
        const { type, config } = stepRun.step;
        
        if (type === 'llm_call') {
          // Stubbed LLM call for now, can be replaced with real Groq/OpenAI call
          await new Promise(r => setTimeout(r, 200));
          
          // Simulate random failure for testing retries if config says so, otherwise succeed
          if (config.simulate_failure && attempt < maxRetries) {
            throw new Error("Simulated LLM network failure");
          }
          
          output = { response: `Mock LLM response for input: ${JSON.stringify(previousOutput)}`, ...config };
        } 
        else if (type === 'http_request') {
          const res = await fetch(config.url || 'https://jsonplaceholder.typicode.com/posts/1', {
            method: config.method || 'GET',
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          output = await res.json();
        }
        else if (type === 'conditional_branch') {
          const condition = config.condition || {};
          // Simplistic evaluation: check if previous output contains expected key-value
          const passes = previousOutput && previousOutput[condition.key] === condition.value;
          output = { branch_taken: passes ? 'true_branch' : 'false_branch' };
          
          // If true, skip the false_skip_steps. If false, skip the true_skip_steps.
          const stepsToSkip = passes ? (config.false_skip_steps || []) : (config.true_skip_steps || []);
          stepsToSkip.forEach((id: string) => skipStepIds.add(id));
        }
        else if (type === 'approval_gate') {
          await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'paused', input: previousOutput, output: null, error: null, attempt_count: attemptCount });
          await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'paused' });
          return; // Pause execution
        }
        else if (type === 'notify') {
          // Just mock - Event trigger handles actual notification
          output = { notified: true, destination: config.destination };
        }
        else if (type === 'db_write') {
          // Write to our new workflow_results table
          const dataToWrite = config.data_path && previousOutput ? previousOutput[config.data_path] : previousOutput;
          await executeGraphql(INSERT_DB_WRITE, { workflow_run_id: run.id, data: dataToWrite || {} });
          output = { written: true, data: dataToWrite };
        }

        success = true;
        break; // break retry loop
      } catch (error: any) {
        lastError = error;
        console.error(`Step ${stepRun.id} attempt ${attemptCount} failed:`, error.message);
        if (attempt < maxRetries) {
          // Backoff before retry
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    if (success) {
      await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'completed', input: previousOutput, output, error: null, attempt_count: attemptCount });
      previousOutput = output;
    } else {
      await executeGraphql(UPDATE_STEP_RUN, { id: stepRun.id, status: 'failed', input: previousOutput, output: null, error: lastError?.message || 'Step failed after retries', attempt_count: attemptCount });
      await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'failed' });
      return;
    }
  }

  // If all steps completed or skipped
  const { workflow_runs_by_pk: updatedRun } = await executeGraphql(GET_RUN_DETAILS, { run_id: runId });
  const allCompleted = updatedRun.step_runs.every((sr: any) => sr.status === 'completed');
  if (allCompleted) {
    await executeGraphql(UPDATE_RUN_STATUS, { id: run.id, status: 'completed' });
  }
}
