const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    businessAddress: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
  },
  { timestamps: true }
);

customerSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Customer = mongoose.model('Customer', customerSchema);

async function createCustomer(input) {
  const doc = await Customer.create(input);
  return doc.toJSON();
}

async function listCustomers() {
  const docs = await Customer.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getCustomerById(id) {
  const doc = await Customer.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function updateCustomer(id, update) {
  const allowed = {};
  if (typeof update.name === 'string') allowed.name = update.name;
  if (typeof update.businessAddress === 'string') allowed.businessAddress = update.businessAddress;
  if (typeof update.contact === 'string') allowed.contact = update.contact;
  if (typeof update.email === 'string') allowed.email = update.email;
  const doc = await Customer.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteCustomer(id) {
  return Customer.findByIdAndDelete(id).exec();
}

module.exports = {
  Customer,
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};


