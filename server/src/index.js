import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

import { entitiesRouter, authRouter, functionsRouter } from './routes/index.js';
import { ossProxy } from './functions/ossUpload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.UPLOAD_DIR || join(__dirname, '..', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadDir));

// OSS file proxy — requires auth (JWT via Bearer header or ?token=), supports Range for PDF preview
app.get('/api/files/(*)', ossProxy);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/entities', entitiesRouter);
app.use('/api/functions', functionsRouter);
app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
