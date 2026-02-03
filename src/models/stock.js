const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema(
  {
    // Required inputs for creating a stock
    productId: { type: String, required: true, trim: true },
    productCode: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, trim: true },
    price: { type: Number, required: true, trim: true },
    total: { type: Number, required: true, trim: true },
    date: { type: Date, required: true, trim: true },
    supplier: { type: String, required: true, trim: true },
    image: { type: String, default: null, trim: true },
    notes: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

stockSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

    const Stock = mongoose.model('Stock', stockSchema);

const createStock = async ({
  productId,
  quantity,
  price,
  total,
  date,
  supplier,
  productCode,
  notes,
  image = null,
}) => {
  const doc = await Stock.create({
    productId,
    quantity,
    price,
    total,
    date,
    supplier,
    productCode,
    notes,
    image,
  });
  return doc.toJSON();
}

const listStocks = async () => {
  const docs = await Stock.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

const getStockById = async (id) => {
  const doc = await Stock.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

const getStockByProductId = async (productId) => {
  const doc = await Stock.findOne({ productId }).exec();
  return doc ? doc.toJSON() : null;
}

const updateStock = async (id, update) => {
  const allowed = {};
  if (typeof update.productId === 'string') allowed.productId = update.productId;
  if (typeof update.productCode === 'string') allowed.productCode = update.productCode;
  if (typeof update.quantity === 'number') allowed.quantity = update.quantity;
  if (typeof update.price === 'number') allowed.price = update.price;
  if (typeof update.total === 'number') allowed.total = update.total;
  if (typeof update.date === 'date') allowed.date = update.date;
  if (typeof update.supplier === 'string') allowed.supplier = update.supplier;
  if (typeof update.notes === 'string') allowed.notes = update.notes;
  if (typeof update.image === 'string') allowed.image = update.image;
  const doc = await Stock.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

const deleteStock = async (id) => {
  return Stock.findByIdAndDelete(id).exec();
}

module.exports = {
    Stock,
    createStock,
    listStocks,
    getStockById,
    getStockByProductId,
    updateStock,
    deleteStock,
};