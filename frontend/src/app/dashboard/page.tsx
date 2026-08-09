'use client';

import { useAuthenticationStatus, useSignOut } from '@nhost/react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, Plus, Activity, Settings2 } from 'lucide-react';

const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    organizations {
      id
      name
      quota_limit
      org_usage_stats {
        total_runs
        used_llm_calls
      }
      workflows(order_by: {created_at: desc}) {
        id
        name
        description
        workflow_runs(order_by: {started_at: desc}, limit: 1) {
          status
        }
      }
    }
  }
`;

const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!) {
    insert_workflows_one(object: {organization_id: $orgId, name: $name, description: "New Workflow"}) {
      id
    }
  }
`;

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuthenticationStatus();
  const { signOut } = useSignOut();
  const router = useRouter();
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD_DATA, {
    skip: !isAuthenticated,
  });
  const [createWorkflow, { loading: isCreating }] = useMutation(CREATE_WORKFLOW);
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;
  }

  if (error) {
    console.error("GraphQL Error:", error);
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-4">
        <h2 className="text-red-500 font-bold text-xl mb-2">Error Loading Dashboard</h2>
        <p className="text-neutral-400 mb-4">{error.message}</p>
        <button onClick={() => signOut()} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg">Sign Out and Try Again</button>
      </div>
    );
  }

  const organization = (data as any)?.organizations?.[0];
  console.log("Dashboard Data:", data, "Organization:", organization);
  const stats = organization?.org_usage_stats?.[0] || { total_runs: 0, used_llm_calls: 0 };

  const handleCreate = async () => {
    if (!organization) {
      alert("No organization found. Please check your permissions or sign out and sign back in.");
      return;
    }
    const res = await createWorkflow({ variables: { orgId: organization.id, name: newWorkflowName || 'Untitled Workflow' } });
    if ((res.data as any)?.insert_workflows_one?.id) {
      router.push(`/workflow/${(res.data as any).insert_workflows_one.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />

      <header className="glass-card border-b border-white/5 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">
                {organization?.name || 'Organization'}
              </h1>
              <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-widest mt-1 block">Workspace Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">LLM Quota:</span>
                <span className={`text-xs font-semibold ${stats.used_llm_calls >= organization?.quota_limit ? 'text-red-400' : 'text-indigo-400'}`}>
                  {stats.used_llm_calls} / {organization?.quota_limit || 0}
                </span>
              </div>
              {/* Sleek Custom Progress Bar */}
              <div className="w-36 h-1.5 bg-neutral-900 border border-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.used_llm_calls >= (organization?.quota_limit || 0) * 0.9 
                      ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                  }`}
                  style={{ width: `${Math.min(100, ((stats.used_llm_calls || 0) / (organization?.quota_limit || 1)) * 100)}%` }}
                />
              </div>
            </div>
            <button 
              onClick={() => signOut()} 
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer border border-white/10 hover:border-white/20 px-3.5 py-2 rounded-xl bg-white/5"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>
 
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              Workflows
            </h2>
            <p className="text-neutral-400 mt-1.5 text-sm font-medium">Create, orchestrate, and trace step-by-step agent triggers.</p>
          </div>
          <button 
            onClick={() => setIsCreatingModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-550 to-purple-600 hover:from-indigo-600 hover:to-purple-750 text-white px-5 py-3 rounded-xl font-bold text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.25)]"
          >
            <Plus className="h-4 w-4" />
            New Workflow
          </button>
        </div>
 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organization?.workflows?.map((wf: any) => (
            <Link href={`/workflow/${wf.id}`} key={wf.id} className="group block">
              <div className="glass-card glass-card-interactive rounded-2xl p-6 h-full relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                {/* Decorative glow inside card */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none" />
                
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 bg-neutral-900/60 rounded-xl flex items-center justify-center group-hover:bg-indigo-950/40 transition-colors border border-white/5 shadow-inner">
                      <Settings2 className="h-5 w-5 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    {wf.workflow_runs?.[0] && (
                      <span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                        wf.workflow_runs[0].status === 'running' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        wf.workflow_runs[0].status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        wf.workflow_runs[0].status === 'paused' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          wf.workflow_runs[0].status === 'running' ? 'bg-amber-400 animate-pulse' :
                          wf.workflow_runs[0].status === 'completed' ? 'bg-emerald-400' :
                          wf.workflow_runs[0].status === 'paused' ? 'bg-blue-400 animate-pulse' :
                          'bg-red-400'
                        }`} />
                        {wf.workflow_runs[0].status}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-455 transition-colors">{wf.name}</h3>
                  <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed font-medium mb-4">{wf.description}</p>
                </div>
                
                <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-white/5 pt-4 mt-auto">
                  <span className="font-semibold group-hover:text-indigo-400 transition-colors">Configure step matrix</span>
                  <span className="font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                </div>
              </div>
            </Link>
          ))}
          {(!organization?.workflows || organization.workflows.length === 0) && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-white/5 rounded-2xl bg-neutral-950/20">
              <p className="text-neutral-500 font-medium">No workflows found. Create one to get started.</p>
            </div>
          )}
        </div>
      </main>
 
      {isCreatingModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 px-4">
          <div className="glass-card border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/40 to-purple-500/0" />
            <h3 className="text-xl font-bold text-white mb-4">Create Workflow</h3>
            
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-450 mb-2">
              Workflow Title
            </label>
            <input 
              type="text" 
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
              placeholder="e.g. Lead Retrieval Agent" 
              className="w-full bg-neutral-950/70 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 mb-6 text-sm font-sans"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsCreatingModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={isCreating}
                className="bg-gradient-to-r from-indigo-550 to-purple-600 hover:from-indigo-600 hover:to-purple-750 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all cursor-pointer disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
