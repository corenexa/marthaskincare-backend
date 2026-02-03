const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'salesperson', 'storekeeper'], default: 'salesperson', index: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true },
    phone: { type: String, trim: true },
    balance: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now },
    branch: { type: String, trim: true },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

async function getUserByUsername(username) {
  return User.findOne({ username }).exec();
}

async function getUserById(id) {
  return User.findById(id).exec();
}

async function createUser({ name, username, passwordHash, branch, status, phone, balance, role = 'salesperson' }) {
  const user = await User.create({ name, username, passwordHash, branch, status, phone, balance, role });
  return user.toJSON();
}

async function listUsers() {
  const docs = await User.find({}).sort({ createdAt: -1 }).exec();
  return docs.map((d) => d.toJSON());
}

async function updateUser(id, update) {
  const doc = await User.findByIdAndUpdate(id, update, { new: true }).exec();
  return doc ? doc.toJSON() : null;
}

async function deleteUser(id) {
  const doc = await User.findByIdAndDelete(id).exec();
  return !!doc;
}

module.exports = {
  User,
  getUserByUsername,
  getUserById,
  createUser,
  listUsers,
  updateUser,
  deleteUser,
};