import express from 'express';
import { getDepartmentReport, getDepartmentUsage } from '../controllers/reportController.js';

const router = express.Router();

router.get('/department-summary', getDepartmentReport);
router.get('/department-usage', getDepartmentUsage);

export default router;
