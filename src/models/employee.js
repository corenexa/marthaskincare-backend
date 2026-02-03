const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    contact: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    branch: { type: String, required: true, trim: true },
    educationLevel: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    nationality: { type: String, required: true, trim: true },
    cv: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true, trim: true },
    endDate: { type: Date, required: true, trim: true },
    salary: { type: Number, required: true, trim: true },
  },
  { timestamps: true }
);

employeeSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Employee = mongoose.model('Employee', employeeSchema);

async function createEmployee(input) {
  const doc = await Employee.create(input);
  return doc.toJSON();
}

async function listEmployees() {
  const docs = await Employee.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function getEmployeeById(id) {
  const doc = await Employee.findById(id).exec();
  return doc ? doc.toJSON() : null;
}

async function updateEmployee(id, update) {
  const allowed = {};
  if (typeof update.name === 'string') allowed.name = update.name;
  if (typeof update.address === 'string') allowed.address = update.address;
  if (typeof update.email === 'string') allowed.email = update.email;
  if (typeof update.contact === 'string') allowed.contact = update.contact;
  if (typeof update.position === 'string') allowed.position = update.position;
  if (typeof update.branch === 'string') allowed.branch = update.branch;
  if (typeof update.educationLevel === 'string') allowed.educationLevel = update.educationLevel;
  if (typeof update.department === 'string') allowed.department = update.department;
  if (typeof update.gender === 'string') allowed.gender = update.gender;
  if (typeof update.nationality === 'string') allowed.nationality = update.nationality;
  if (typeof update.cv === 'string') allowed.cv = update.cv;
  if (typeof update.status === 'string') allowed.status = update.status;
  if (typeof update.startDate === 'date') allowed.startDate = update.startDate;
  if (typeof update.endDate === 'date') allowed.endDate = update.endDate;
  if (typeof update.salary === 'number') allowed.salary = update.salary;

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const doc = await Employee.findByIdAndUpdate(id, allowed, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteEmployee(id) {
  return Employee.findByIdAndDelete(id).exec();
}

module.exports = {
  Employee,
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};


