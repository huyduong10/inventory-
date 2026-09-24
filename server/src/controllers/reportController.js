import ExportOrder from '../models/ExportOrder.js';

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
