import express from 'express';
import { createExportOrder, getExportOrderById, getExportOrders, updateExportOrderStatus } from '../controllers/exportController.js';

const router = express.Router();

router.get('/', getExportOrders);
router.get('/:id', getExportOrderById);
router.post('/', createExportOrder);
router.patch('/:id/status', updateExportOrderStatus);

export default router;
