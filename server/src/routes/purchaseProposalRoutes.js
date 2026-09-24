import express from 'express';
import {
  createPurchaseProposal,
  deletePurchaseProposal,
  getPurchaseProposalById,
  getPurchaseProposals,
  stockInPurchaseProposal,
  updatePurchaseProposal,
  updatePurchaseProposalStatus,
} from '../controllers/purchaseProposalController.js';

const router = express.Router();

router.get('/', getPurchaseProposals);
router.get('/:id', getPurchaseProposalById);
router.post('/', createPurchaseProposal);
router.put('/:id', updatePurchaseProposal);
router.patch('/:id/status', updatePurchaseProposalStatus);
router.post('/:id/stock', stockInPurchaseProposal);
router.delete('/:id', deletePurchaseProposal);

export default router;
