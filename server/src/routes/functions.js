import { Router } from 'express';
import multer from 'multer';
import { authRequired } from '../middleware/auth.js';
import { feishuAuth } from '../functions/feishuAuth.js';
import { feishuContacts } from '../functions/feishuContacts.js';
import { syncFeishuOrg } from '../functions/syncFeishuOrg.js';
import { sendFeishuNotice } from '../functions/sendFeishuNotice.js';
import { sendFeishuNotification } from '../functions/sendFeishuNotification.js';
import { ossUpload } from '../functions/ossUpload.js';
import { createNotification } from '../functions/createNotification.js';
import { ensurePendingProject } from '../functions/ensurePendingProject.js';
import { markBidWonHandled } from '../functions/markBidWonHandled.js';
import { onNoticePublish } from '../functions/onNoticePublish.js';
import { onApprovalChange } from '../functions/onApprovalChange.js';
import { onProjectChange } from '../functions/onProjectChange.js';
import { importExecutionItems } from '../functions/importExecutionItems.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Public endpoints (no auth required)
router.post('/feishuAuth', feishuAuth);
router.post('/feishuContacts', feishuContacts);

// Protected endpoint with file upload
router.post('/ossUpload', authRequired, upload.single('file'), ossUpload);
router.post('/importExecutionItems', authRequired, upload.single('file'), importExecutionItems);

// Protected function handlers
const protectedHandlers = {
  syncFeishuOrg,
  sendFeishuNotice,
  sendFeishuNotification,
  createNotification,
  ensurePendingProject,
  markBidWonHandled,
  onNoticePublish,
  onApprovalChange,
  onProjectChange,
};

router.post('/:name', authRequired, async (req, res) => {
  const handler = protectedHandlers[req.params.name];
  if (!handler) {
    return res.status(404).json({ error: `Function '${req.params.name}' not found` });
  }
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`Function ${req.params.name} error:`, error);
    res.status(500).json({ error: error.message });
  }
});

export { router as functionsRouter };
