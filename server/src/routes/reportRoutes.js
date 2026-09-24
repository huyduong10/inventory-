import express from 'express';
import { getDepartmentReport } from '../controllers/reportController.js';

const router = express.Router();

router.get('/department-summary', getDepartmentReport);

export default router;
