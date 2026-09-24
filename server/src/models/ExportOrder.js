import mongoose from 'mongoose';

const ExportItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      default: '',
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const ExportOrderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    createdByUser: {
      type: String,
      default: 'System',
    },
    exportDate: {
      type: Date,
      default: Date.now,
    },
    items: [ExportItemSchema],
    status: {
      type: String,
      enum: ['Draft', 'Completed', 'Cancelled'],
      default: 'Completed',
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const ExportOrder = mongoose.model('ExportOrder', ExportOrderSchema);

export default ExportOrder;
