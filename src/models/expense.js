const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    item: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: String, required: true, trim: true, lowercase: true, index: true },
    submittedBy: { type: String, required: true, trim: true },
    date: { type: Date, required: true, trim: true },
  },
  { timestamps: true }
);

expenseSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Expense = mongoose.model('Expense', expenseSchema);

async function createExpense(input) {
  const doc = await Expense.create(input);
  return doc.toJSON();
}

async function listExpense() {
  const docs = await Expense.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getExpenseById(id) {
  const doc = await Expense.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function updateExpense(id, update) {
  const allowed = {};
  if (typeof update.item === 'string') allowed.item = update.item;
  if (typeof update.description === 'string') allowed.description = update.description;
  if (typeof update.amount === 'string') allowed.amount = update.amount;
  if (typeof update.submittedBy === 'string') allowed.submittedBy = update.submittedBy;
  if (typeof update.date === 'date') allowed.date = update.date;

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const doc = await Expense.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteExpense(id) {
  return Expense.findByIdAndDelete(id).exec();
}

module.exports = {
  Expense,
  createExpense,
  listExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
};


