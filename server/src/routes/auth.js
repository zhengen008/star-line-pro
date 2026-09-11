import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.get('/me', authRequired, (req, res) => {
  res.json(req.user);
});

export { router as authRouter };
