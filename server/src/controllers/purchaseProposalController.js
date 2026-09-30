import mongoose from 'mongoose';
import PurchaseProposal from '../models/PurchaseProposal.js';
import Product from '../models/Product.js';
import { generateProposalCode, isDuplicateKeyError } from '../utils/codeGenerators.js';
import { formatVietnameseCurrency } from '../utils/vietnameseCurrency.js';

export const removeVietnameseTones = (str = '') => {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

export const findProductByNameOrSku = async (nameOrSku, session) => {
  if (!nameOrSku) return null;
  const trimmed = String(nameOrSku).trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1. Direct case-insensitive match on name or sku
  const exactQuery = Product.findOne({
    $or: [
      { name: { $regex: `^${escaped}$`, $options: 'i' } },
      { sku: { $regex: `^${escaped}$`, $options: 'i' } },
    ],
  });
  if (session) exactQuery.session(session);
  const exactMatch = await exactQuery;
  if (exactMatch) return exactMatch;

  // 2. Collation match (strength 1 ignores case and diacritics if MongoDB supports it)
  try {
    const collationQuery = Product.findOne({
      $or: [{ name: trimmed }, { sku: trimmed }],
    }).collation({ locale: 'vi', strength: 1 });
    if (session) collationQuery.session(session);
    const collationMatch = await collationQuery;
    if (collationMatch) return collationMatch;
  } catch {
    // Collation not supported or index mismatch, proceed to fallback
  }

  // 3. Fallback: match by removing Vietnamese diacritics & lowercase
  const normalizedTarget = removeVietnameseTones(trimmed).toLowerCase();
  const allProductsQuery = Product.find({});
  if (session) allProductsQuery.session(session);
  const allProducts = await allProductsQuery;

  for (const p of allProducts) {
    const pNameNorm = removeVietnameseTones(p.name || '').toLowerCase().trim();
    const pSkuNorm = removeVietnameseTones(p.sku || '').toLowerCase().trim();
    if (pNameNorm === normalizedTarget || pSkuNorm === normalizedTarget) {
      return p;
    }
  }

  return null;
};

const normalizeProposalItems = async (items = []) => {
  const normalized = [];

  for (const item of items) {
    const unitPrice = Number(item.unitPrice || 0);
    const quantity = Number(item.quantity || 0);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    const productName = String(item.productName || item.content || '').trim();
    const itemSku = String(item.sku || '').trim();
    const productId = item.product ? String(item.product) : null;

    let resolvedProduct = null;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      resolvedProduct = await Product.findById(productId);
    }

    // Prioritize SKU lookup when provided
    if (!resolvedProduct && itemSku) {
      resolvedProduct = await findProductByNameOrSku(itemSku);
    }

    if (!resolvedProduct && productName) {
      resolvedProduct = await findProductByNameOrSku(productName);
    }

    normalized.push({
      product: resolvedProduct ? resolvedProduct._id : null,
      productName: resolvedProduct ? resolvedProduct.name : productName,
      sku: resolvedProduct ? resolvedProduct.sku : itemSku,
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
  const codeGenerator = autoGenerateCode || generateProposalCode;
  let attempts = 0;

  while (attempts < 5) {
    try {
      await proposal.save(session ? { session } : undefined);
      return proposal;
    } catch (error) {
      if (!isDuplicateKeyError(error) || !codeGenerator) {
        throw error;
      }

      attempts += 1;
      proposal.code = codeGenerator();
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

    let product = null;
    if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
      product = await Product.findById(item.product).session(session);
    }
    if (!product) {
      product = await findProductByNameOrSku(content, session);
    }

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
    const autoGenerateCode = generateProposalCode;
    const code = payload.code || payload.proposalCode || autoGenerateCode();

    // Auto-create or update products from proposal items
    const newProducts = [];
    const updatedProducts = [];
    const processedProducts = new Map();

    for (const item of items) {
      const productName = String(item.productName || item.content || '').trim();
      const itemSku = String(item.sku || '').trim();
      if (!productName && !itemSku) continue;

      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) continue;

      // Find existing product by ID, then SKU, then name (case-insensitive & tone-tolerant)
      let existingProduct = null;
      if (item.product && mongoose.Types.ObjectId.isValid(item.product)) {
        const prodKey = String(item.product);
        if (processedProducts.has(prodKey)) {
          existingProduct = processedProducts.get(prodKey);
        } else {
          existingProduct = await Product.findById(item.product);
        }
      }

      // Prioritize SKU lookup when provided
      if (!existingProduct && itemSku) {
        existingProduct = await findProductByNameOrSku(itemSku);
        if (existingProduct && processedProducts.has(String(existingProduct._id))) {
          existingProduct = processedProducts.get(String(existingProduct._id));
        }
      }

      if (!existingProduct && productName) {
        existingProduct = await findProductByNameOrSku(productName);
        if (existingProduct && processedProducts.has(String(existingProduct._id))) {
          existingProduct = processedProducts.get(String(existingProduct._id));
        }
      }

      if (existingProduct) {
        // Product exists → add the proposal quantity to existing stock
        const previousQty = Number(existingProduct.quantity || 0);
        const newQty = previousQty + quantity;
        existingProduct.quantity = newQty;
        existingProduct.adjustmentHistory = [
          {
            reason: `Đề xuất mua sắm: ${code}`,
            previousQuantity: previousQty,
            newQuantity: newQty,
            delta: quantity,
            adjustedBy: req.user?.name || payload.proposer || 'system',
            createdAt: new Date(),
          },
          ...(existingProduct.adjustmentHistory || []),
        ];

        await existingProduct.save();
        item.product = existingProduct._id;
        item.productName = existingProduct.name;
        item.sku = existingProduct.sku;
        processedProducts.set(String(existingProduct._id), existingProduct);

        if (!updatedProducts.some((p) => String(p._id) === String(existingProduct._id))) {
          updatedProducts.push(existingProduct);
        }
      } else {
        // Product does not exist → create a new one
        // Use user-provided SKU if available, otherwise auto-generate
        const productSku = itemSku || (() => {
          const skuSuffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
          return `AUTO-${skuSuffix}`;
        })();

        const newProduct = new Product({
          name: productName || itemSku,
          sku: productSku,
          category: 'Khác',
          unit: item.unit || 'Cái',
          quantity,
          minThreshold: 5,
          location: '',
          description: `Tự động tạo từ đề xuất mua sắm: ${code}`,
          adjustmentHistory: [
            {
              reason: `Tạo mới từ đề xuất mua sắm: ${code}`,
              previousQuantity: 0,
              newQuantity: quantity,
              delta: quantity,
              adjustedBy: req.user?.name || payload.proposer || 'system',
              createdAt: new Date(),
            },
          ],
        });

        try {
          await newProduct.save();
          item.product = newProduct._id;
          item.sku = newProduct.sku;
          processedProducts.set(String(newProduct._id), newProduct);
          newProducts.push(newProduct);
        } catch (saveError) {
          if (!isDuplicateKeyError(saveError)) {
            throw saveError;
          }
        }
      }
    }

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
    res.status(201).json({ success: true, data: proposal, newProducts, updatedProducts });
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

    const newItems = payload.items ? await normalizeProposalItems(payload.items) : proposal.items;
    if (!newItems.length) {
      return res.status(400).json({ success: false, message: 'At least one purchase item is required.' });
    }

    // Map old items by product
    const oldQtyMap = new Map();
    for (const item of proposal.items || []) {
      const prod = item.product
        ? await Product.findById(item.product)
        : await findProductByNameOrSku(item.productName || item.content);
      if (prod) {
        const key = String(prod._id);
        oldQtyMap.set(key, (oldQtyMap.get(key) || 0) + Number(item.quantity || 0));
      }
    }

    // Map new items by product
    const newQtyMap = new Map();
    const productInstanceMap = new Map();

    for (const item of newItems) {
      const itemSku = String(item.sku || '').trim();
      let prod = null;

      if (item.product) {
        prod = await Product.findById(item.product);
      }

      // Prioritize SKU lookup when provided
      if (!prod && itemSku) {
        prod = await findProductByNameOrSku(itemSku);
      }

      if (!prod && (item.productName || item.content)) {
        prod = await findProductByNameOrSku(item.productName || item.content);
      }

      if (!prod && (item.productName || item.content || itemSku)) {
        const productName = String(item.productName || item.content || itemSku).trim();
        const productSku = itemSku || (() => {
          const skuSuffix = `${Date.now().toString(36).slice(-4).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
          return `AUTO-${skuSuffix}`;
        })();
        prod = new Product({
          name: productName,
          sku: productSku,
          category: 'Khác',
          unit: item.unit || 'Cái',
          quantity: 0,
          minThreshold: 5,
          location: '',
          description: `Tự động tạo từ đề xuất mua sắm: ${payload.code || proposal.code}`,
        });
        await prod.save();
      }

      if (prod) {
        const key = String(prod._id);
        item.product = prod._id;
        item.productName = prod.name;
        item.sku = prod.sku;
        productInstanceMap.set(key, prod);
        newQtyMap.set(key, (newQtyMap.get(key) || 0) + Number(item.quantity || 0));
      }
    }

    // Adjust warehouse stock according to difference:
    // In Purchase Proposal: when proposal item quantity increases (newQty > oldQty),
    // delta = newQty - oldQty > 0 => warehouse stock INCREASES by delta.
    // When proposal item quantity decreases (newQty < oldQty),
    // delta = newQty - oldQty < 0 => warehouse stock DECREASES by |delta|.
    const allProductIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
    const updatedWarehouseProducts = [];

    for (const productId of allProductIds) {
      const oldQty = oldQtyMap.get(productId) || 0;
      const newQty = newQtyMap.get(productId) || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        const product = productInstanceMap.get(productId) || (await Product.findById(productId));
        if (product) {
          const prevQty = Number(product.quantity || 0);
          const nextQty = Math.max(0, prevQty + delta);
          product.quantity = nextQty;
          product.adjustmentHistory = [
            {
              reason: `Chỉnh sửa đề xuất mua sắm: ${payload.code || proposal.code}`,
              previousQuantity: prevQty,
              newQuantity: nextQty,
              delta,
              adjustedBy: req.user?.name || payload.proposer || 'system',
              createdAt: new Date(),
            },
            ...(product.adjustmentHistory || []),
          ];
          await product.save();
          updatedWarehouseProducts.push(product);
        }
      }
    }

    const subtotal = Number(newItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0).toFixed(2));
    const vatRate = Number(payload.vatRate ?? proposal.vatRate ?? 10);
    const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
    const totalPayment = Number((subtotal + vatAmount).toFixed(2));
    const code = payload.code || payload.proposalCode || proposal.code;

    proposal.name = payload.name || proposal.name;
    proposal.code = code;
    proposal.proposalCode = code;
    proposal.proposer = payload.proposer || proposal.proposer;
    proposal.department = payload.department || proposal.department;
    proposal.reason = payload.reason || proposal.reason;
    proposal.date = payload.date || proposal.date;
    proposal.vatRate = vatRate;
    proposal.subtotal = subtotal;
    proposal.vatAmount = vatAmount;
    proposal.totalPayment = totalPayment;
    proposal.amountInWords = formatVietnameseCurrency(totalPayment);
    proposal.items = newItems;
    if (payload.status) proposal.status = payload.status;

    await proposal.save();
    res.json({ success: true, data: proposal, updatedWarehouseProducts, message: 'Cập nhật đề xuất mua sắm thành công.' });
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
