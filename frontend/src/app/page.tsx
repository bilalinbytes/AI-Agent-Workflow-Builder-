'use client';

import { useState } from 'react';
import { useSignInEmailPassword, useSignUpEmailPassword } from '@nhost/react';
import { nhost } from '../components/NhostProvider';
import { useRouter } from 'next/navigation';
import { LucideWorkflow } from 'lucide-react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const { signInEmailPassword, isLoading: isSignInLoading, error: signInError } = useSignInEmailPassword();
  const { signUpEmailPassword, isLoading: isSignUpLoading, error: signUpError } = useSignUpEmailPassword();

  const router = useRouter();

  const isLoading = isSignInLoading || isSignUpLoading;
  const error = isSignUp ? signUpError : signInError;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      const res = await signUpEmailPassword(email, password);
      if (res.isSuccess) {
        const userId = nhost.auth.getUser()?.id;
        if (userId) {
          try {
            await fetch(`${process.env.NEXT_PUBLIC_NHOST_FUNCTIONS_URL || 'http://localhost:3000'}/v1/setupNewUser`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, orgName: orgName || `${email.split('@')[0]}'s Org` }),
            });
          } catch (err) {
            console.error('Failed to setup org:', err);
          }
        }
        router.push('/dashboard');
      }
    } else {
      const res = await signInEmailPassword(email, password);
      if (res.isSuccess) {
        router.push('/dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Orbs / Mesh Gradient */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.35)] transform hover:rotate-6 transition-transform">
            <LucideWorkflow className="text-white h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
          AI Agent Workflow
        </h2>
        <p className="mt-2 text-center text-sm text-neutral-450">
          {isSignUp ? "Create a new account" : "Sign in to your organization"}
        </p>
      </div>
 
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="glass-card py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/0 via-indigo-500/30 to-purple-500/0" />
          
          <form className="space-y-6" onSubmit={handleAuth}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Email address
              </label>
              <div className="mt-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 bg-neutral-950/60 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-550/20 transition-all text-sm font-sans"
                  placeholder="admin@orga.com"
                />
              </div>
            </div>
 
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Password
              </label>
              <div className="mt-2">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-4 py-3 bg-neutral-950/60 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-550/20 transition-all text-sm font-sans"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Organization Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="block w-full px-4 py-3 bg-neutral-950/60 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-550/20 transition-all text-sm font-sans"
                    placeholder="My Company (optional)"
                  />
                </div>
              </div>
            )}

 
            {error && (
              <div className="text-red-400 text-sm bg-red-950/30 p-3.5 rounded-xl border border-red-900/30 font-sans">
                {error?.message}
              </div>
            )}
 
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-550 to-purple-600 hover:from-indigo-600 hover:to-purple-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(99,102,241,0.2)]"
              >
                {isLoading ? 'Processing...' : (isSignUp ? 'Sign up' : 'Sign in')}
              </button>
            </div>
          </form>
           
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer tracking-wide"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
