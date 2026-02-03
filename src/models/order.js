const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, trim: true },
  },
  { _id: false }
);

const customerInfoSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    address: { type: String, trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true, trim: true, sparse: true },
    receiptCode: { type: String, unique: true, index: true, trim: true, sparse: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentReference: { type: String, trim: true },
    customer: customerInfoSchema, 
    shippingAddress: addressSchema,
    notes: { type: String, trim: true },
    inventoryAdjusted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Order = mongoose.model('Order', orderSchema);

async function createOrder(orderData) {
  const doc = await Order.create(orderData);
  return doc.toJSON();
}

async function listOrders(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

  const docs = await Order.find(query).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getOrderById(id) {
  const doc = await Order.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function updateOrder(id, updates) {
  const allowed = {};

  if (typeof updates.status === 'string') allowed.status = updates.status;
  if (typeof updates.paymentStatus === 'string') allowed.paymentStatus = updates.paymentStatus;
  if (typeof updates.notes === 'string') allowed.notes = updates.notes;
  if (updates.shippingAddress) allowed.shippingAddress = updates.shippingAddress;
  if (updates.customer) allowed.customer = updates.customer;
  if (typeof updates.paymentReference === 'string') allowed.paymentReference = updates.paymentReference;
  if (typeof updates.discount === 'number') allowed.discount = updates.discount;
  if (typeof updates.total === 'number') allowed.total = updates.total;
  if (typeof updates.subtotal === 'number') allowed.subtotal = updates.subtotal;
  if (typeof updates.inventoryAdjusted === 'boolean') allowed.inventoryAdjusted = updates.inventoryAdjusted;

  const doc = await Order.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteOrder(id) {
  return Order.findByIdAndDelete(id).exec();
}

module.exports = {
  Order,
  createOrder,
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
};