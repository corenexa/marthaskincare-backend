// models/Sale.js
const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  saleNumber: {
    type: String,
    required: true,
    unique: true
  },
  items: {
    type: [saleItemSchema],
    required: true,
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Sale must have at least one item'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'card', 'mobile_money', 'debt'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['completed', 'pending', 'refunded'],
    default: 'completed'
  },
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
// saleNumber already has unique index from unique: true
saleSchema.index({ cashierId: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ paymentMethod: 1 });
saleSchema.index({ paymentStatus: 1 });
saleSchema.index({ createdAt: -1, paymentStatus: 1 }); // For filtering sales by date and status

// Virtual populate for cashier details
saleSchema.virtual('cashier', {
  ref: 'User',
  localField: 'cashierId',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included in JSON
saleSchema.set('toJSON', { virtuals: true });
saleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sale', saleSchema);