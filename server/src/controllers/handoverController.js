import mongoose from 'mongoose';
import HandoverNote from '../models/HandoverNote.js';
import Product from '../models/Product.js';
import { generateHandoverCode, isDuplicateKeyError } from '../utils/codeGenerators.js';

const parseDepartmentUsage = (departmentUsage, fallbackQuantity) => {
  if (!departmentUsage) return [];

  const trimmed = String(departmentUsage).trim();
  if (!trimmed) return [];

  const items = trimmed.split(',').map((entry) => entry.trim()).filter(Boolean);

  if (!items.length) return [];

  return items.map((entry) => {
    const match = entry.match(/^(.+?)\s*:\s*(\d+(?:\.\d+)?)$/i);
    if (match) {
      return {
        department: match[1].trim(),
        quantity: Number(match[2]),
      };
    }

    return {
      department: entry,
      quantity: Number(fallbackQuantity || 0),
    };
  });
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeHandoverStatus = (status, fallback = 'Completed') => {
  const candidate = String(status ?? fallback).trim();

  if (!candidate) return fallback;
  if (/^completed$/i.test(candidate)) return 'Completed';
  if (/^cancelled$/i.test(candidate)) return 'Cancelled';

  return fallback;
};

const resolveProductReference = async (productValue) => {
  if (!productValue) return null;

  if (mongoose.isValidObjectId(productValue)) {
    const productById = await Product.findById(productValue);
    if (productById) return productById;
  }

  const nameMatch = await Product.findOne({
    name: { $regex: `^${escapeRegex(String(productValue))}$`, $options: 'i' },
  });

  if (nameMatch) return nameMatch;

  return Product.findOne({
    sku: { $regex: `^${escapeRegex(String(productValue))}$`, $options: 'i' },
  });
};

const runWithOptionalSession = async (operation) => {
  let session = null;

  try {
    if (mongoose.connection.readyState !== 1) {
      return operation(null);
    }

    session = await mongoose.startSession();
    return await session.withTransaction(async () => operation(session));
  } catch (error) {
    const message = error?.message || '';
    const sessionUnsupported = /session|replica set|transaction|buffering timed out|not connected/i.test(message);

    if (sessionUnsupported) {
      return operation(null);
    }

    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

const applyStockAdjustment = async (note, direction, session) => {
  for (const item of note.items || []) {
    const productQuery = session ? Product.findById(item.product).session(session) : Product.findById(item.product);
    const product = await productQuery;

    if (!product) {
      throw Object.assign(new Error(`Product not found for item: ${item.product}`), { statusCode: 400 });
    }

    const quantity = Number(item.quantity || 0);

    if (direction === 'decrement' && product.quantity < quantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}. Requested: ${quantity}, Available: ${product.quantity}`), { statusCode: 400 });
    }

    const updateOptions = session ? { session } : {};
    await Product.findOneAndUpdate(
      { _id: product._id },
      { $inc: { quantity: direction === 'decrement' ? -quantity : quantity } },
      { ...updateOptions, new: true }
    );
  }
};

const validateAndDecrementStock = async (items, session) => {
  const requiredByProduct = new Map();

  for (const item of items || []) {
    const product = await resolveProductReference(item.product);

    if (!product) {
      throw Object.assign(new Error(`Product not found: ${String(item.product)}`), { statusCode: 400 });
    }

    const productKey = String(product._id);
    const quantity = Number(item.quantity || 0);
    requiredByProduct.set(productKey, (requiredByProduct.get(productKey) || 0) + quantity);
  }

  const productIds = [...requiredByProduct.keys()];
  const productQuery = session ? Product.find({ _id: { $in: productIds } }).session(session) : Product.find({ _id: { $in: productIds } });
  const products = await productQuery;
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const [productId, requiredQuantity] of requiredByProduct.entries()) {
    const product = productMap.get(productId);

    if (!product) {
      throw Object.assign(new Error(`Product not found: ${productId}`), { statusCode: 400 });
    }

    if (Number(product.quantity) < requiredQuantity) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}. Requested: ${requiredQuantity}, Available: ${product.quantity}`), { statusCode: 400 });
    }
  }

  for (const item of items || []) {
    const product = await resolveProductReference(item.product);
    if (!product) {
      throw Object.assign(new Error(`Product not found: ${String(item.product)}`), { statusCode: 400 });
    }

    const updateOptions = session ? { session } : {};
    const result = await Product.findOneAndUpdate(
      { _id: product._id, quantity: { $gte: Number(item.quantity || 0) } },
      { $inc: { quantity: -Number(item.quantity || 0) } },
      { ...updateOptions, new: true }
    );

    if (!result) {
      throw Object.assign(new Error(`Insufficient stock for ${product.name}. Requested: ${Number(item.quantity || 0)}`), { statusCode: 400 });
    }
  }
};

const saveHandoverWithRetry = async (note, autoGenerateCode, session) => {
  let attempts = 0;

  while (attempts < 5) {
    try {
      await note.save(session ? { session } : undefined);
      return note;
    } catch (error) {
      if (!isDuplicateKeyError(error) || !autoGenerateCode) {
        throw error;
      }

      attempts += 1;
      note.code = autoGenerateCode();
      note.noteCode = note.code;
    }
  }

  throw new Error('Unable to create a unique handover note code.');
};

const buildHandoverItem = async (item) => {
  const productReference = item?.product || item?.productId;

  if (!productReference) {
    throw new Error('Each handover item must include a valid product reference.');
  }

  const product = await resolveProductReference(productReference);

  if (!product) {
    throw new Error(`Product not found: ${item.product}`);
  }

  const quantity = Number(item.quantity || 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Quantity for product ${product.name} must be greater than zero.`);
  }

  const departmentUsage = item.departmentUsage || item.departmentAllocations || '';
  let parsedAllocations = [];

  if (Array.isArray(item.departmentAllocations) && item.departmentAllocations.length > 0) {
    parsedAllocations = item.departmentAllocations.map((allocation) => ({
      department: String(allocation.department || '').trim(),
      quantity: Number(allocation.quantity || 0),
    }));
  } else if (departmentUsage) {
    parsedAllocations = parseDepartmentUsage(departmentUsage, quantity);
  }

  const totalAllocated = parsedAllocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);

  if (parsedAllocations.length > 0 && totalAllocated > quantity) {
    throw new Error(`Allocated quantity for ${product.name} exceeds the handover quantity.`);
  }

  return {
    date: item.date || new Date(),
    product: product._id,
    productName: product.name,
    unit: item.unit || product.unit,
    quantity,
    departmentUsage: parsedAllocations.length > 0
      ? parsedAllocations.map((allocation) => `${allocation.department}: ${allocation.quantity}`).join(', ')
      : String(item.departmentUsage || '').trim(),
    receiverSignature: String(item.receiverSignature || item.receivedBy || '').trim(),
    note: String(item.note || '').trim(),
  };
};

export const getHandoverNotes = async (req, res, next) => {
  try {
    const { status, department, search = '', page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { noteCode: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      filter.$or = [
        ...(filter.$or || []),
        { items: { $elemMatch: { departmentUsage: { $regex: department, $options: 'i' } } } },
      ];
    }

    const notes = await HandoverNote.find(filter)
      .populate('items.product', 'name sku unit quantity')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await HandoverNote.countDocuments(filter);

    res.json({
      success: true,
      data: notes,
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

export const getHandoverNoteById = async (req, res, next) => {
  try {
    const note = await HandoverNote.findById(req.params.id).populate('items.product', 'name sku unit quantity');

    if (!note) {
      return res.status(404).json({ success: false, message: 'Handover note not found.' });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

export const createHandoverNote = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const normalizedStatus = normalizeHandoverStatus(payload.status, 'Completed');

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one handover item is required.' });
    }

    for (const item of items) {
      const productReference = item?.product || item?.productId;
      const quantity = Number(item?.quantity || 0);

      if (!productReference) {
        return res.status(400).json({ success: false, message: 'Mỗi dòng phiếu bàn giao phải có mã sản phẩm.' });
      }

      const product = await resolveProductReference(productReference);

      if (!product) {
        return res.status(400).json({ success: false, message: `Sản phẩm ${String(productReference)} không tồn tại.` });
      }

      if (Number(product.quantity) < quantity) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm ${product.name} chỉ còn ${product.quantity} ${product.unit}, không đủ để xuất!`,
        });
      }
    }

    const normalizedItems = await Promise.all(items.map((item) => buildHandoverItem(item)));
    const autoGenerateCode = !payload.code && !payload.noteCode ? generateHandoverCode : null;
    const note = new HandoverNote({
      ...payload,
      code: payload.code || payload.noteCode || autoGenerateCode(),
      items: normalizedItems,
      status: normalizedStatus,
    });

    await runWithOptionalSession(async (session) => {
      if (note.status === 'Completed') {
        for (const item of items) {
          const productReference = item?.product || item?.productId;
          const product = await resolveProductReference(productReference);
          if (!product) {
            throw Object.assign(new Error(`Sản phẩm ${String(productReference)} không tồn tại.`), { statusCode: 400 });
          }

          await Product.findByIdAndUpdate(
            product._id,
            { $inc: { quantity: -Number(item.quantity || 0) } },
            session ? { session, new: true } : { new: true }
          );
        }
      }

      await saveHandoverWithRetry(note, autoGenerateCode, session);
    });

    const createdNote = await HandoverNote.findById(note._id).populate('items.product', 'name sku unit quantity');

    res.status(201).json({ success: true, data: createdNote, message: 'Phiếu bàn giao đã được tạo thành công.' });
  } catch (error) {
    next(error);
  }
};

export const updateHandoverNoteStatus = async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const handoverNote = await HandoverNote.findById(req.params.id);

    if (!handoverNote) {
      return res.status(404).json({ success: false, message: 'Handover note not found.' });
    }

    const previousStatus = handoverNote.status;
    const nextStatus = normalizeHandoverStatus(status, handoverNote.status);

    if (!['Completed', 'Cancelled'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid handover status.' });
    }

    await runWithOptionalSession(async (session) => {
      if (nextStatus === 'Completed' && previousStatus !== 'Completed') {
        await validateAndDecrementStock(handoverNote.items, session);
      }

      if (nextStatus === 'Cancelled' && previousStatus === 'Completed') {
        await applyStockAdjustment(handoverNote, 'increment', session);
      }

      handoverNote.status = nextStatus;
      await handoverNote.save(session ? { session } : undefined);
    });

    const updatedNote = await HandoverNote.findById(handoverNote._id).populate('items.product', 'name sku unit quantity');
    res.json({ success: true, data: updatedNote });
  } catch (error) {
    next(error);
  }
};

export const deleteHandoverNote = async (req, res, next) => {
  try {
    const note = await HandoverNote.findById(req.params.id);

    if (!note) {
      return res.status(404).json({ success: false, message: 'Handover note not found.' });
    }

    if (note.status === 'Completed') {
      await runWithOptionalSession(async (session) => {
        await applyStockAdjustment(note, 'increment', session);
      });
    }

    await note.deleteOne();
    res.json({ success: true, message: 'Handover note deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
