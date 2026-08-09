'use client';

import { useAuthenticationStatus } from '@nhost/react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Plus, Trash2, CheckCircle2, Clock, AlertCircle, PauseCircle } from 'lucide-react';

const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      organization_id
      steps(order_by: {step_order: asc}) {
        id
        type
        config
        step_order
      }
      workflow_runs(order_by: {started_at: desc}, limit: 1) {
        id
        status
      }
    }
  }
`;

const ADD_STEP = gql`
  mutation AddStep($workflow_id: uuid!, $type: String!, $step_order: Int!, $config: jsonb!) {
    insert_workflow_steps_one(object: {
      workflow_id: $workflow_id,
      type: $type,
      step_order: $step_order,
      config: $config
    }) {
      id
    }
  }
`;

const DELETE_STEP = gql`
  mutation DeleteStep($id: uuid!) {
    delete_workflow_steps_by_pk(id: $id) {
      id
    }
  }
`;

const TRIGGER_RUN = gql`
  mutation TriggerRun($workflow_id: uuid!) {
    triggerWorkflowRun(workflow_id: $workflow_id) {
      success
      workflow_run_id
      message
    }
  }
`;

const APPROVE_STEP = gql`
  mutation ApproveStepMutation($step_run_id: uuid!) {
    approveStep(step_run_id: $step_run_id) {
      success
      message
    }
  }
`;

const SUB_STEP_RUNS = gql`
  subscription SubStepRuns($run_id: uuid!) {
    workflow_runs_by_pk(id: $run_id) {
      status
      step_runs(order_by: {step: {step_order: asc}}) {
        id
        status
        output
        error
        step {
          type
          config
        }
      }
    }
  }
`;

const STEP_TYPES = [
  { id: 'llm_call', label: 'LLM Call', color: 'bg-purple-500' },
  { id: 'http_request', label: 'HTTP Request', color: 'bg-blue-500' },
  { id: 'db_write', label: 'Database Write', color: 'bg-emerald-500' },
  { id: 'conditional_branch', label: 'Conditional Branch', color: 'bg-amber-500' },
  { id: 'approval_gate', label: 'Approval Gate', color: 'bg-pink-500' },
  { id: 'notify', label: 'Notify (Event Trigger)', color: 'bg-indigo-500' },
];

export default function WorkflowBuilderPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthenticationStatus();
  const router = useRouter();
  const params = useParams();
  const workflowId = params?.id as string;

  const { data, loading, refetch } = useQuery(GET_WORKFLOW, {
    variables: { id: workflowId },
    skip: !isAuthenticated || !workflowId,
  });

  const [addStep] = useMutation(ADD_STEP);
  const [deleteStep] = useMutation(DELETE_STEP);
  const [triggerRun, { loading: isRunning }] = useMutation(TRIGGER_RUN);
  const [approveStepAction, { loading: isApproving }] = useMutation(APPROVE_STEP);

  const latestRunId = (data as any)?.workflows_by_pk?.workflow_runs?.[0]?.id;

  const { data: subData } = useSubscription(SUB_STEP_RUNS, {
    variables: { run_id: latestRunId },
    skip: !latestRunId,
  });

  const [selectedType, setSelectedType] = useState('llm_call');
  const [stepConfig, setStepConfig] = useState('{}');

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) router.push('/');
  }, [isAuthLoading, isAuthenticated, router]);

  if (loading || isAuthLoading) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;
  if (!(data as any)?.workflows_by_pk) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Workflow not found</div>;

  const workflow = (data as any).workflows_by_pk;
  const steps = workflow.steps;
  const liveRunStatus = (subData as any)?.workflow_runs_by_pk?.status || workflow.workflow_runs?.[0]?.status;
  const liveSteps = (subData as any)?.workflow_runs_by_pk?.step_runs || [];

  const handleAddStep = async () => {
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(stepConfig);
    } catch (e) {
      alert("Invalid JSON config");
      return;
    }
    await addStep({
      variables: {
        workflow_id: workflowId,
        type: selectedType,
        step_order: steps.length + 1,
        config: parsedConfig
      }
    });
    refetch();
  };

  const handleRun = async () => {
    try {
      const res = await triggerRun({ variables: { workflow_id: workflowId } });
      if ((res.data as any)?.triggerWorkflowRun?.success) {
        refetch(); // to get the new run ID and subscribe
      } else {
        alert((res.data as any)?.triggerWorkflowRun?.message || "Failed to trigger");
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApprove = async (stepRunId: string) => {
    try {
      await approveStepAction({ variables: { step_run_id: stepRunId } });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Decorative Backdrops */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      <header className="glass-card border-b border-white/5 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="h-10 w-10 bg-neutral-900 border border-white/5 hover:border-white/10 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-all flex items-center justify-center rounded-xl"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">{workflow.name}</h1>
              <span className="text-[10px] text-neutral-450 font-bold uppercase tracking-widest mt-1 block">Orchestrator Matrix</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {liveRunStatus && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 rounded-full border border-white/5 text-xs font-bold">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Status:</span>
                <span className={`uppercase tracking-wider flex items-center gap-1.5 ${
                  liveRunStatus === 'running' ? 'text-amber-400' :
                  liveRunStatus === 'completed' ? 'text-emerald-400' :
                  liveRunStatus === 'paused' ? 'text-blue-400' :
                  'text-red-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    liveRunStatus === 'running' ? 'bg-amber-400 animate-pulse' :
                    liveRunStatus === 'completed' ? 'bg-emerald-400' :
                    liveRunStatus === 'paused' ? 'bg-blue-400 animate-pulse' :
                    'bg-red-400'
                  }`} />
                  {liveRunStatus}
                </span>
              </div>
            )}
            <button 
              onClick={handleRun}
              disabled={isRunning || liveRunStatus === 'running' || liveRunStatus === 'paused'}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {isRunning ? 'Starting...' : 'Run Workflow'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
        {/* Left Col: Builder */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Workflow Steps
            </h2>
            <span className="text-xs text-neutral-500 font-bold bg-neutral-900 border border-white/5 rounded-md px-2.5 py-1">{steps.length} Steps Defined</span>
          </div>
          
          <div className="space-y-4">
            {steps.map((step: any, index: number) => {
              const typeInfo = STEP_TYPES.find(t => t.id === step.type);
              return (
                <div key={step.id} className="glass-card rounded-2xl p-5 flex gap-4 items-start relative group transition-all hover:border-white/10 hover:bg-neutral-950/40">
                  <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-md ${typeInfo?.color || 'bg-neutral-700'}`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white text-sm tracking-tight">{typeInfo?.label || step.type}</h3>
                      <button 
                        onClick={async () => { await deleteStep({ variables: { id: step.id } }); refetch(); }}
                        className="text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer h-8 w-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <pre className="text-xs text-indigo-300 bg-neutral-950/80 p-3.5 rounded-xl border border-white/5 overflow-x-auto font-mono leading-relaxed">
                      {JSON.stringify(step.config, null, 2)}
                    </pre>
                  </div>
                </div>
              );
            })}

            <div className="glass-card border-dashed border-white/10 rounded-2xl p-5 space-y-4 bg-neutral-950/20">
              <h3 className="font-bold text-xs text-neutral-400 uppercase tracking-wider">Add New Step</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select 
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="bg-neutral-950 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 font-medium"
                >
                  {STEP_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input 
                  type="text" 
                  value={stepConfig}
                  onChange={e => setStepConfig(e.target.value)}
                  placeholder="Config JSON (e.g. {})"
                  className="bg-neutral-950 border border-white/10 text-white rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
              <button 
                onClick={handleAddStep}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-850 text-white px-4 py-3 rounded-xl font-bold text-xs transition-all transform active:scale-[0.99] cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Add Step Matrix
              </button>
            </div>
          </div>
        </div>

        {/* Right Col: Live Execution */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
            Live Execution Status
          </h2>

          <div className="glass-card rounded-3xl p-6 min-h-[450px] relative overflow-hidden flex flex-col">
            {liveSteps.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 space-y-4 py-20">
                <div className="h-16 w-16 bg-neutral-900 border border-white/5 rounded-2xl flex items-center justify-center shadow-inner">
                  <Play className="h-6 w-6 opacity-20 text-indigo-400" />
                </div>
                <p className="text-sm font-medium text-neutral-450">Run the workflow to see live status here.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[2px] before:bg-gradient-to-b before:from-indigo-500/30 before:via-neutral-800 before:to-transparent">
                {liveSteps.map((sr: any) => (
                  <div key={sr.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-neutral-950 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-lg transition-all duration-350
                      ${sr.status === 'completed' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' :
                        sr.status === 'running' ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse' :
                        sr.status === 'paused' ? 'bg-indigo-550 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' :
                        sr.status === 'failed' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
                        'bg-neutral-800 text-neutral-500'
                      }
                    `}>
                      {sr.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> :
                       sr.status === 'running' ? <Clock className="w-5 h-5" /> :
                       sr.status === 'paused' ? <PauseCircle className="w-5 h-5" /> :
                       sr.status === 'failed' ? <AlertCircle className="w-5 h-5" /> :
                       <div className="w-1.5 h-1.5 rounded-full bg-current" />
                      }
                    </div>
                    
                    <div className="w-[calc(100%-3.5rem)] md:w-[calc(50%-2rem)] bg-neutral-950/80 p-4.5 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="font-bold text-white text-xs uppercase tracking-wider">{sr.step.type}</h4>
                        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md ${
                          sr.status === 'completed' ? 'text-emerald-400 bg-emerald-500/10' :
                          sr.status === 'running' ? 'text-amber-400 bg-amber-500/10 animate-pulse' :
                          sr.status === 'paused' ? 'text-indigo-400 bg-indigo-500/10' :
                          sr.status === 'failed' ? 'text-red-400 bg-red-500/10' :
                          'text-neutral-500 bg-neutral-850'
                        }`}>{sr.status}</span>
                      </div>
                      
                      {sr.status === 'paused' && sr.step.type === 'approval_gate' && (
                        <div className="mt-3">
                          <button 
                            onClick={() => handleApprove(sr.id)}
                            disabled={isApproving}
                            className="w-full bg-gradient-to-r from-indigo-550 to-purple-600 hover:from-indigo-600 hover:to-purple-750 text-white text-xs font-bold py-3 rounded-xl transition-all transform hover:scale-[1.01] cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                          >
                            {isApproving ? 'Approving...' : 'Approve & Continue'}
                          </button>
                        </div>
                      )}
                      
                      {sr.output && (
                        <div className="mt-3 bg-neutral-900/60 rounded-xl p-3 border border-white/5 overflow-hidden">
                          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">Output</span>
                          <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {JSON.stringify(sr.output, null, 2)}
                          </pre>
                        </div>
                      )}
                      {sr.error && (
                        <div className="mt-3 bg-red-950/20 text-red-400 rounded-xl p-3 border border-red-900/20 font-mono text-[11px] leading-relaxed">
                          <span className="text-[10px] text-red-400/60 font-bold uppercase tracking-wider block mb-1">Error</span>
                          {sr.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
