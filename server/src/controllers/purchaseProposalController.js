import mongoose from 'mongoose';
import PurchaseProposal from '../models/PurchaseProposal.js';
import Product from '../models/Product.js';
import { generateProposalCode, isDuplicateKeyError } from '../utils/codeGenerators.js';
import { formatVietnameseCurrency } from '../utils/vietnameseCurrency.js';

const normalizeProposalItems = async (items = []) => {
  const normalized = [];

  for (const item of items) {
    const unitPrice = Number(item.unitPrice || 0);
    const quantity = Number(item.quantity || 0);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const productName = String(item.productName || item.content || '').trim();
    const productId = item.product ? String(item.product) : null;

    let resolvedProduct = null;
    if (productId) {
      resolvedProduct = await Product.findById(productId);
    }

    if (!resolvedProduct && productName) {
      resolvedProduct = await Product.findOne({
        $or: [{ name: { $regex: `^${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }, { sku: { $regex: `^${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }],
      });
    }

    normalized.push({
      product: resolvedProduct ? resolvedProduct._id : null,
      productName: resolvedProduct ? resolvedProduct.name : productName,
      content: productName || String(item.content || '').trim(),
      unit: String(item.unit || resolvedProduct?.unit || '').trim(),
      quantity,
      unitPrice,
      totalPrice,
      note: String(item.note || '').trim(),
    });
  }

  return normalized;
};

const saveProposalWithRetry = async (proposal, autoGenerateCode, session) => {
  let attempts = 0;

  while (attempts < 5) {
    try {
      await proposal.save({ session });
      return proposal;
    } catch (error) {
      if (!isDuplicateKeyError(error) || !autoGenerateCode) {
        throw error;
      }

      attempts += 1;
      proposal.code = autoGenerateCode();
      proposal.proposalCode = proposal.code;
    }
  }

  throw new Error('Unable to create a unique purchase proposal code.');
};

const stockInProposalItems = async (proposal, session) => {
  const productTotals = new Map();

  for (const item of proposal.items || []) {
    const content = String(item.content || item.productName || '').trim();
    const quantity = Number(item.quantity || 0);

    if (!content || quantity <= 0) continue;

    const product = await Product.findOne({
      $or: [
        { name: { $regex: `^${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { sku: { $regex: `^${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      ],
    }).session(session);

    if (!product) {
      throw Object.assign(new Error(`Không tìm thấy sản phẩm tương ứng để nhập kho: ${content}`), { statusCode: 400 });
    }

    const key = String(product._id);
    productTotals.set(key, (productTotals.get(key) || 0) + quantity);
  }

  for (const [productId, quantity] of productTotals.entries()) {
    await Product.updateOne(
      { _id: productId },
      { $inc: { quantity } },
      { session }
    );
  }
};

export const getPurchaseProposals = async (req, res, next) => {
  try {
    const { status, department, search = '', page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (department) filter.department = { $regex: department, $options: 'i' };
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { proposalCode: { $regex: search, $options: 'i' } },
        { proposer: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const proposals = await PurchaseProposal.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await PurchaseProposal.countDocuments(filter);

    res.json({
      success: true,
      data: proposals,
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

export const getPurchaseProposalById = async (req, res, next) => {
  try {
    const proposal = await PurchaseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Purchase proposal not found.' });
    }

    res.json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

export const createPurchaseProposal = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const items = await normalizeProposalItems(payload.items || []);

    if (!items.length) {
      return res.status(400).json({ success: false, message: 'At least one purchase item is required.' });
    }

    const subtotal = Number(items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0).toFixed(2));
    const vatRate = Number(payload.vatRate ?? 10);
    const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
    const totalPayment = Number((subtotal + vatAmount).toFixed(2));
    const autoGenerateCode = !payload.code && !payload.proposalCode ? generateProposalCode : null;
    const code = payload.code || payload.proposalCode || autoGenerateCode();

    const proposal = new PurchaseProposal({
      ...payload,
      code,
      items,
      subtotal,
      vatRate,
      vatAmount,
      totalPayment,
      amountInWords: formatVietnameseCurrency(totalPayment),
      status: payload.status || 'Pending',
    });

    await saveProposalWithRetry(proposal, autoGenerateCode);
    res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseProposal = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const proposal = await PurchaseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Purchase proposal not found.' });
    }

    if (payload.items) proposal.items = await normalizeProposalItems(payload.items);
    if (payload.code) proposal.code = payload.code;
    if (payload.proposalCode) proposal.proposalCode = payload.proposalCode;
    if (payload.vatRate !== undefined) proposal.vatRate = Number(payload.vatRate || 0);

    proposal.set({
      ...payload,
      items: proposal.items,
      code: proposal.code,
      proposalCode: proposal.proposalCode || proposal.code,
    });

    await proposal.save();
    res.json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

export const updatePurchaseProposalStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const proposal = await PurchaseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Purchase proposal not found.' });
    }

    if (!['Draft', 'Pending', 'Approved', 'Stocked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid purchase proposal status.' });
    }

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const shouldStock = ['Approved', 'Stocked'].includes(status) && !['Approved', 'Stocked'].includes(proposal.status);

      if (shouldStock) {
        await stockInProposalItems(proposal, session);
      }

      proposal.status = status;
      proposal.amountInWords = formatVietnameseCurrency(proposal.totalPayment || 0);
      await proposal.save({ session });
    });

    await session.endSession();

    res.json({ success: true, data: proposal });
  } catch (error) {
    next(error);
  }
};

export const stockInPurchaseProposal = async (req, res, next) => {
  try {
    const proposal = await PurchaseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Purchase proposal not found.' });
    }

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      if (proposal.status !== 'Stocked') {
        await stockInProposalItems(proposal, session);
      }

      proposal.status = 'Stocked';
      proposal.amountInWords = formatVietnameseCurrency(proposal.totalPayment || 0);
      await proposal.save({ session });
    });

    await session.endSession();

    res.json({ success: true, data: proposal, message: 'Stock updated successfully.' });
  } catch (error) {
    next(error);
  }
};

export const deletePurchaseProposal = async (req, res, next) => {
  try {
    const proposal = await PurchaseProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Purchase proposal not found.' });
    }

    await proposal.deleteOne();
    res.json({ success: true, message: 'Purchase proposal deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
