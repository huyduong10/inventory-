import express from 'express';
import { createHandoverNote, deleteHandoverNote, getHandoverNoteById, getHandoverNotes, updateHandoverNote, updateHandoverNoteStatus } from '../controllers/handoverController.js';

const router = express.Router();

router.get('/', getHandoverNotes);
router.get('/:id', getHandoverNoteById);
router.post('/', createHandoverNote);
router.put('/:id', updateHandoverNote);
router.patch('/:id/status', updateHandoverNoteStatus);
router.delete('/:id', deleteHandoverNote);

export default router;
