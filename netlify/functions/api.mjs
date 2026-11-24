// Netlify Function: every /api/* request is redirected here (see netlify.toml).
import serverless from 'serverless-http';
import app from '../../server/app.js';

export const handler = serverless(app);
