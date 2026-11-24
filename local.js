// Local development server: serves the API and the static frontend from one origin,
// exactly like the single Vercel deployment.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './server/app.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const server = express();
server.use(app);
server.use(express.static(path.join(root, 'public')));
const port = Number(process.env.PORT) || 3000;
server.listen(port, () => console.log(`Chronicle Atlas running on http://localhost:${port}`));
