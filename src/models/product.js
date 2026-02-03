const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Required inputs for creating a product
    category: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
    notes: { type: String, required: true, trim: true },
    productId: { type: String, trim: true, unique: true, sparse: true, index: true },
    expiringDate: { type: Date },
    quantity: { type: Number, min: 0 },
    publishStatus: { type: String, default: 'yes', trim: true }, // 'yes' or 'no'
    productImage: { type: String, default: null, trim: true }, // URL or path
  },
  { timestamps: true }
);

productSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);

async function createProduct({
  category,
  productName,
  price,
  notes,
  productId = null,
  expiringDate = null,
  quantity = null,
  productImage = null,
  publishStatus = 'yes',
}) {
  const doc = await Product.create({
    category,
    productName,
    price,
    notes,
    productId,
    expiringDate,
    quantity,
    productImage,
    publishStatus,
  });
  return doc.toJSON();
}

async function listProducts() {
  const docs = await Product.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getProductById(id) {
  const doc = await Product.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function getProductByProductId(productId) {
  const doc = await Product.findOne({ productId }).exec();
  return doc ? doc.toJSON() : null;
}

async function updateProduct(id, update) {
  const allowed = {};
  if (typeof update.category === 'string') allowed.category = update.category;
  if (typeof update.productId === 'string') allowed.productId = update.productId;
  if (typeof update.productName === 'string') allowed.productName = update.productName;
  if (typeof update.price === 'string') allowed.price = update.price;
  if (typeof update.notes === 'string') allowed.notes = update.notes;
  if (update.expiringDate) allowed.expiringDate = update.expiringDate;
  if (typeof update.quantity === 'number') allowed.quantity = update.quantity;
  if (typeof update.publishStatus === 'string') allowed.publishStatus = update.publishStatus;
  if (typeof update.productImage === 'string' || update.productImage === null) allowed.productImage = update.productImage;
  const doc = await Product.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteProduct(id) {
  return Product.findByIdAndDelete(id).exec();
}

module.exports = {
  Product,
  createProduct,
  listProducts,
  getProductById,
  getProductByProductId,
  updateProduct,
  deleteProduct,
};


