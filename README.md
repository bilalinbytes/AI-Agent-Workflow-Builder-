# AI Agent Workflow Builder

A full-stack application for chaining AI agent steps, built with Nhost, Hasura, PostgreSQL, and Next.js.

## Prerequisites
- **Docker**: Required to run the Nhost environment locally.
- **Node.js 18+**: For the frontend.
- **Nhost CLI**: Install globally via `npm i -g @nhost/cli`.

## Setup & Run Locally

1. **Start the Backend:**
   Ensure Docker Desktop is running, then execute:
   ```bash
   nhost up
   ```
   This spins up PostgreSQL, Hasura GraphQL Engine, Nhost Auth, and the Serverless Functions on your local machine.

2. **Start the Frontend:**
   In a new terminal window, navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm run dev
   ```
   The Next.js app will be available at [http://localhost:3000](http://localhost:3000).

3. **Seeding the Database (Testing the Scenario):**
   - Since Nhost starts fresh locally, you can create a test user by visiting the frontend login page and signing up. 
   - However, for the specific assignment scenario (Two separate organizations), you should insert mock organizations and assign users into `org_members` directly via the Hasura Console (available at `http://localhost:9695` once `nhost up` is running) to test the strict org-level isolation.

## API Keys
The application uses a simulated delay for the `llm_call` step to guarantee immediate setup without requiring external API keys. It uses a real `fetch` for the `http_request` step. If you wish to plug in a real LLM (like Groq), update the implementation in `nhost/functions/_executor.ts`.

## Features
- **Two Permission Layers**: Data-level (Hasura RLS) and Execution-level (Node.js Action Handlers).
- **GraphQL Subscriptions**: The frontend streams live step-by-step progress using an Apollo Client subscription.
- **Approval Gates**: Workflows pause on `approval_gate` steps, requiring manual intervention from an org Owner or Editor.
- **Event Triggers**: Workflows can be triggered automatically via database events (`watched_events` table).
