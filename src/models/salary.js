const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, trim: true },
    month: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    paymentStatus: { type: String, required: true, enum: ['paid', 'unpaid'], default: 'unpaid' },
    paymentDate: { type: Date, trim: true },
    transactionId: { type: String, trim: true },
  },
  { timestamps: true }
);

// Create compound index to ensure unique employee-month combination
salarySchema.index({ employeeId: 1, month: 1 }, { unique: true });

salarySchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Salary = mongoose.model('Salary', salarySchema);

async function createSalary(input) {
  const doc = await Salary.create(input);
  return doc.toJSON();
}

async function listSalaries() {
  const docs = await Salary.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getSalaryById(id) {
  const doc = await Salary.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function getSalaryByEmployeeAndMonth(employeeId, month) {
  const doc = await Salary.findOne({ employeeId, month }).exec();
  return doc ? doc.toJSON() : null;
}

async function updateSalary(id, update) {
  const allowed = {};
  if (typeof update.employeeId === 'string') allowed.employeeId = update.employeeId;
  if (typeof update.month === 'string') allowed.month = update.month;
  if (typeof update.year === 'number') allowed.year = update.year;
  if (typeof update.paymentStatus === 'string') allowed.paymentStatus = update.paymentStatus;
  if (update.paymentDate) allowed.paymentDate = new Date(update.paymentDate);
  if (typeof update.transactionId === 'string') allowed.transactionId = update.transactionId;

  if (Object.keys(allowed).length === 0) {
    return null;
  }

  const doc = await Salary.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteSalary(id) {
  return Salary.findByIdAndDelete(id).exec();
}

module.exports = {
  Salary,
  createSalary,
  listSalaries,
  getSalaryById,
  getSalaryByEmployeeAndMonth,
  updateSalary,
  deleteSalary,
};