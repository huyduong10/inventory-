import mongoose from 'mongoose';

const AdjustmentLogSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    newQuantity: {
      type: Number,
      required: true,
      default: 0,
    },
    delta: {
      type: Number,
      required: true,
      default: 0,
    },
    adjustedBy: {
      type: String,
      default: 'system',
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    minThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    adjustmentHistory: {
      type: [AdjustmentLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

ProductSchema.virtual('stockStatus').get(function () {
  if (this.quantity === 0) return 'Out of Stock';
  if (this.quantity <= this.minThreshold) return 'Low Stock';
  return 'In Stock';
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

const Product = mongoose.model('Product', ProductSchema);

export default Product;
