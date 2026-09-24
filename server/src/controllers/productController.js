import Product from '../models/Product.js';
import HandoverNote from '../models/HandoverNote.js';
import PurchaseProposal from '../models/PurchaseProposal.js';
import { createProductSchema, updateProductSchema } from '../validators/productValidators.js';

const stockStatus = (quantity, minThreshold) => {
  if (quantity === 0) return 'Out of Stock';
  if (quantity <= minThreshold) return 'Low Stock';
  return 'In Stock';
};

export const getProducts = async (req, res, next) => {
  try {
    const { search = '', category = '', status = '', page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) {
      filter.category = category;
    }

    const products = await Product.find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Product.countDocuments(filter);

    const normalizedProducts = products.map((product) => ({
      ...product.toObject(),
      stockStatus: stockStatus(product.quantity, product.minThreshold),
    }));

    res.json({
      success: true,
      data: normalizedProducts,
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

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        stockStatus: stockStatus(product.quantity, product.minThreshold),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const parsedBody = createProductSchema.parse(req.body);
    const product = new Product(parsedBody);
    await product.save();

    res.status(201).json({
      success: true,
      data: {
        ...product.toObject(),
        stockStatus: stockStatus(product.quantity, product.minThreshold),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const parsedBody = updateProductSchema.parse(req.body);
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const previousQuantity = Number(product.quantity ?? 0);
    const nextQuantity = parsedBody.quantity !== undefined ? Number(parsedBody.quantity) : previousQuantity;
    const reason = String(parsedBody.reason || parsedBody.adjustmentReason || 'Manual stock adjustment').trim() || 'Manual stock adjustment';

    const sanitizedBody = { ...parsedBody };
    delete sanitizedBody.reason;
    delete sanitizedBody.adjustmentReason;

    if (sanitizedBody.quantity !== undefined) {
      sanitizedBody.quantity = nextQuantity;
    }

    Object.assign(product, sanitizedBody);

    if (parsedBody.quantity !== undefined && Number(parsedBody.quantity) !== previousQuantity) {
      product.adjustmentHistory = [
        {
          reason,
          previousQuantity,
          newQuantity: nextQuantity,
          delta: nextQuantity - previousQuantity,
          adjustedBy: req.user?.name || 'system',
          createdAt: new Date(),
        },
        ...product.adjustmentHistory,
      ];
    }

    await product.save();

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        stockStatus: stockStatus(product.quantity, product.minThreshold),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const hasProposalHistory = await PurchaseProposal.exists({ 'items.product': product._id });
    const hasHandoverHistory = await HandoverNote.exists({ 'items.product': product._id });

    if (hasProposalHistory || hasHandoverHistory) {
      return res.status(409).json({
        success: false,
        message: 'Không thể xóa sản phẩm đã có lịch sử đề xuất hoặc phiếu bàn giao.',
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
