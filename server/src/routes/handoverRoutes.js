import express from 'express';
import { createHandoverNote, deleteHandoverNote, getHandoverNoteById, getHandoverNotes, updateHandoverNoteStatus } from '../controllers/handoverController.js';

const router = express.Router();

router.get('/', getHandoverNotes);
router.get('/:id', getHandoverNoteById);
router.post('/', createHandoverNote);
router.patch('/:id/status', updateHandoverNoteStatus);
router.delete('/:id', deleteHandoverNote);

export default router;
