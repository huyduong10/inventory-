import mongoose from 'mongoose';
import ExportOrder from '../models/ExportOrder.js';
import Product from '../models/Product.js';
import { generateOrderCode } from '../utils/generateOrderCode.js';
import { createExportOrderSchema, updateExportStatusSchema } from '../validators/exportValidators.js';

const applyStockAdjustment = async (order, direction, session) => {
  for (const item of order.items) {
    const product = await Product.findById(item.product).session(session);

    if (!product) {
      throw new Error(`Product not found for item: ${item.product}`);
    }

    if (direction === 'decrement' && product.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}. Requested: ${item.quantity}, Available: ${product.quantity}`);
    }

    product.quantity = direction === 'decrement' ? product.quantity - item.quantity : product.quantity + item.quantity;
    await product.save({ session });
  }
};

export const getExportOrders = async (req, res, next) => {
  try {
    const { department, recipientName, status, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (department) filter.department = { $regex: department, $options: 'i' };
    if (recipientName) filter.recipientName = { $regex: recipientName, $options: 'i' };
    if (status) filter.status = status;

    const orders = await ExportOrder.find(filter)
      .populate('items.product', 'name sku category unit quantity')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await ExportOrder.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getExportOrderById = async (req, res, next) => {
  try {
    const order = await ExportOrder.findById(req.params.id).populate('items.product', 'name sku category unit quantity');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Export order not found.' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

export const createExportOrder = async (req, res, next) => {
  try {
    const payload = createExportOrderSchema.parse(req.body);
    const orderCode = generateOrderCode();

    const newOrder = new ExportOrder({
      ...payload,
      orderCode,
      exportDate: payload.exportDate || new Date(),
      items: payload.items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
      })),
    });

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      if (newOrder.status === 'Completed') {
        await applyStockAdjustment(newOrder, 'decrement', session);
      }

      await newOrder.save({ session });
    });

    await session.endSession();

    res.status(201).json({
      success: true,
      data: await ExportOrder.findById(newOrder._id).populate('items.product', 'name sku category unit quantity'),
    });
  } catch (error) {
    next(error);
  }
};

export const updateExportOrderStatus = async (req, res, next) => {
  try {
    const payload = updateExportStatusSchema.parse(req.body);
    const order = await ExportOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Export order not found.' });
    }

    const previousStatus = order.status;
    const nextStatus = payload.status;

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      if (nextStatus === 'Completed' && previousStatus !== 'Completed') {
        await applyStockAdjustment(order, 'decrement', session);
      }

      if (nextStatus === 'Cancelled' && previousStatus === 'Completed') {
        await applyStockAdjustment(order, 'increment', session);
      }

      order.status = nextStatus;
      if (payload.note !== undefined) order.note = payload.note;
      await order.save({ session });
    });

    await session.endSession();

    const updatedOrder = await ExportOrder.findById(order._id).populate('items.product', 'name sku category unit quantity');

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
};
