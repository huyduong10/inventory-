import ExportOrder from '../models/ExportOrder.js';
import HandoverNote from '../models/HandoverNote.js';

export const getDepartmentReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const match = { status: 'Completed' };

    if (startDate || endDate) {
      match.exportDate = {};

      if (startDate) {
        match.exportDate.$gte = new Date(startDate);
      }

      if (endDate) {
        match.exportDate.$lte = new Date(endDate);
      }
    }

    const report = await ExportOrder.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.product',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: '$productInfo' },
      {
        $group: {
          _id: {
            department: '$department',
            month: {
              $dateToString: { format: '%Y-%m', date: '$exportDate' },
            },
          },
          department: { $first: '$department' },
          month: { $first: { $dateToString: { format: '%Y-%m', date: '$exportDate' } } },
          totalItems: { $sum: '$items.quantity' },
          orderCount: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          _id: 0,
          department: 1,
          month: 1,
          totalItems: 1,
          orderCount: { $size: '$orderCount' },
        },
      },
      { $sort: { month: 1, department: 1 } },
    ]);

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentUsage = async (req, res, next) => {
  try {
    const { department, startDate, endDate } = req.query;

    const match = { status: 'Completed' };

    if (startDate || endDate) {
      match.exportDate = {};
      if (startDate) match.exportDate.$gte = new Date(startDate);
      if (endDate) match.exportDate.$lte = new Date(endDate);
    }

    if (department) {
      match.$or = [
        { department: { $regex: department, $options: 'i' } },
        { 'items.departmentUsage': { $regex: department, $options: 'i' } },
      ];
    }

    const notes = await HandoverNote.find(match)
      .populate('items.product', 'name sku unit quantity category location')
      .sort({ exportDate: -1, createdAt: -1 })
      .lean();

    // Build a per-department summary of products received
    const departmentMap = new Map();

    for (const note of notes) {
      // The note-level department
      const noteDept = (note.department || '').trim();

      for (const item of note.items || []) {
        const quantity = Number(item.quantity || 0);
        if (quantity <= 0) continue;

        const productName = item.product?.name || item.productName || 'Không rõ';
        const productSku = item.product?.sku || '';
        const productUnit = item.product?.unit || item.unit || '';
        const productId = item.product?._id || item.product || '';

        // Parse departmentUsage to figure out which departments received how many
        // Format: "IT: 5, HCNS: 3" or just a plain department name
        const usageStr = (item.departmentUsage || '').trim();
        const allocations = [];

        if (usageStr) {
          const entries = usageStr.split(',').map((e) => e.trim()).filter(Boolean);
          for (const entry of entries) {
            const colonMatch = entry.match(/^(.+?):\s*(\d+(?:\.\d+)?)$/);
            if (colonMatch) {
              allocations.push({ dept: colonMatch[1].trim(), qty: Number(colonMatch[2]) });
            } else {
              // Plain department name — use full quantity
              allocations.push({ dept: entry, qty: quantity });
            }
          }
        }

        // If no allocations parsed, assign to the note-level department
        if (allocations.length === 0 && noteDept) {
          allocations.push({ dept: noteDept, qty: quantity });
        }

        for (const { dept, qty } of allocations) {
          if (!dept) continue;

          if (!departmentMap.has(dept)) {
            departmentMap.set(dept, { department: dept, products: new Map(), totalQuantity: 0, noteCount: new Set() });
          }

          const deptData = departmentMap.get(dept);
          deptData.totalQuantity += qty;
          deptData.noteCount.add(String(note._id));

          const prodKey = String(productId);
          if (!deptData.products.has(prodKey)) {
            deptData.products.set(prodKey, {
              productId: prodKey,
              productName,
              productSku,
              unit: productUnit,
              totalQuantity: 0,
              handovers: [],
            });
          }

          const prodEntry = deptData.products.get(prodKey);
          prodEntry.totalQuantity += qty;
          prodEntry.handovers.push({
            noteId: note._id,
            noteCode: note.code || note.noteCode || '',
            date: note.exportDate || note.createdAt,
            quantity: qty,
            receiverName: note.receiverName || '',
          });
        }
      }
    }

    // Convert Maps to arrays for JSON response
    const result = [];
    for (const [, deptData] of departmentMap) {
      const productsArray = [];
      for (const [, prod] of deptData.products) {
        productsArray.push(prod);
      }
      // Sort products by total quantity descending
      productsArray.sort((a, b) => b.totalQuantity - a.totalQuantity);

      result.push({
        department: deptData.department,
        totalQuantity: deptData.totalQuantity,
        noteCount: deptData.noteCount.size,
        products: productsArray,
      });
    }

    // Sort departments alphabetically
    result.sort((a, b) => a.department.localeCompare(b.department, 'vi'));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

