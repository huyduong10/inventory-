import mongoose from 'mongoose';
import { formatVietnameseCurrency } from '../utils/vietnameseCurrency.js';

const PurchaseProposalItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    productName: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      default: '',
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
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false }
);

const PurchaseProposalSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    proposalCode: {
      type: String,
      trim: true,
      default: null,
    },
    proposer: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [PurchaseProposalItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'At least one purchase item is required.',
      },
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    vatRate: {
      type: Number,
      default: 10,
      min: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPayment: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountInWords: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Draft', 'Pending', 'Approved', 'Stocked'],
      default: 'Pending',
    },
    signers: {
      director: { type: String, default: '' },
      accountingManager: { type: String, default: '' },
      departmentHead: { type: String, default: '' },
      proposerSignature: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

PurchaseProposalSchema.pre('save', function (next) {
  const items = Array.isArray(this.items) ? this.items : [];

  this.subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    item.totalPrice = lineTotal;
    item.productName = item.productName || item.content || '';
    item.content = item.content || item.productName || '';
    return Number((sum + lineTotal).toFixed(2));
  }, 0);

  this.vatAmount = Number((this.subtotal * (Number(this.vatRate || 0) / 100)).toFixed(2));
  this.totalPayment = Number((this.subtotal + this.vatAmount).toFixed(2));
  this.amountInWords = formatVietnameseCurrency(this.totalPayment);

  if (!this.proposalCode && this.code) {
    this.proposalCode = this.code;
  }

  if (this.proposalCode && !this.code) {
    this.code = this.proposalCode;
  }

  next();
});

const PurchaseProposal = mongoose.model('PurchaseProposal', PurchaseProposalSchema);

export default PurchaseProposal;
