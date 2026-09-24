import express from 'express';
import cors from 'cors';
import productRoutes from './routes/productRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import handoverRoutes from './routes/handoverRoutes.js';
import purchaseProposalRoutes from './routes/purchaseProposalRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Warehouse API is running.' });
});

app.use('/api/products', productRoutes);
app.use('/api/handover-notes', handoverRoutes);
app.use('/api/purchase-proposals', purchaseProposalRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/reports', reportRoutes);

app.use(errorHandler);

export default app;
