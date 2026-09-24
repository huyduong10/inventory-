import mongoose from 'mongoose';

const DepartmentAllocationSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const HandoverItemSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    departmentUsage: {
      type: String,
      default: '',
      trim: true,
    },
    departmentAllocations: {
      type: [DepartmentAllocationSchema],
      default: [],
    },
    receiverSignature: {
      type: String,
      default: '',
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const HandoverNoteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    noteCode: {
      type: String,
      trim: true,
      default: null,
    },
    exportDate: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [HandoverItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one handover item is required.',
      },
    },
    status: {
      type: String,
      enum: ['Completed', 'Cancelled'],
      default: 'Completed',
    },
  },
  {
    timestamps: true,
  }
);

HandoverNoteSchema.pre('save', function (next) {
  if (!this.noteCode && this.code) {
    this.noteCode = this.code;
  }

  if (this.noteCode && !this.code) {
    this.code = this.noteCode;
  }

  for (const item of this.items || []) {
    if (!item.departmentUsage && Array.isArray(item.departmentAllocations) && item.departmentAllocations.length > 0) {
      item.departmentUsage = item.departmentAllocations
        .map((allocation) => `${allocation.department}: ${allocation.quantity}`)
        .join(', ');
    }
  }

  next();
});

const HandoverNote = mongoose.model('HandoverNote', HandoverNoteSchema);

export default HandoverNote;
