const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      contact: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true},
    },
    { timestamps: true }
  );

 supplierSchema.set('toJSON', {
    transform: function (doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  });

const Supplier = mongoose.model('Supplier', supplierSchema);

async function createSupplier(input) {
    const doc = await Supplier.create(input);
    return Array.isArray(doc) ? doc.map((d) => d.toJSON()) : doc.toJSON();
}

async function getSupplierById(id) {
    const doc = await Supplier.findById(id).exec();
    return doc ? doc.toJSON() : null;
  }

  async function updateSupplier(id, update) {
    const allowed = {};
    if (typeof update.name === 'string') allowed.name = update.name;
    if (typeof update.address === 'string') allowed.address = update.address;
    if (typeof update.email === 'string') allowed.email = update.email;
    if (typeof update.contact === 'string') allowed.contact = update.contact;
  
    if (Object.keys(allowed).length === 0) {
      return null;
    }
  
    const doc = await Supplier.findByIdAndUpdate(id, allowed, { new: true }).exec();
    return doc ? doc.toJSON() : null;
  }

  async function deleteSupplier(id) {
    return Supplier.findByIdAndDelete(id).exec();
  }

  async function listSupplier() {
    const docs = await Supplier.find({}).sort({ createdAt: -1 }).exec();
    return docs.map((d) => d.toJSON());
  }

  module.exports = {
    Supplier,
    createSupplier,
    listSupplier,
    getSupplierById,
    updateSupplier,  // Make sure it's updateSupplier, not updateEmployee
    deleteSupplier,
  };
