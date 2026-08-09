import express from 'express';
import cors from 'cors';

// Configure environment variables for local HGE access
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.NHOST_GRAPHQL_URL = 'https://local.graphql.local.nhost.run/v1';

const app = express();
app.use(cors());
app.use(express.json());

// Load TypeScript handlers dynamically
import triggerWorkflowRun from './functions/triggerWorkflowRun';
import approveStep from './functions/approveStep';
import notifyEventTrigger from './functions/notifyEventTrigger';
import dbEventWatcher from './functions/dbEventWatcher';

app.post('/v1/triggerWorkflowRun', triggerWorkflowRun);
app.post('/v1/approveStep', approveStep);
app.post('/v1/notifyEventTrigger', notifyEventTrigger);
app.post('/v1/dbEventWatcher', dbEventWatcher);

// Fallback error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Internal server error' });
});

const PORT = 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Custom Nhost Functions runner listening on port ${PORT}`);
});
