import express from 'express';
import cors from 'cors';
import productRoutes from './routes/productRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import handoverRoutes from './routes/handoverRoutes.js';
import purchaseProposalRoutes from './routes/purchaseProposalRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : ['*'];

console.log('CORS allowed origins:', allowedOrigins);

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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