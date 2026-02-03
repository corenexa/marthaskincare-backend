#!/usr/bin/env node
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { User } = require('../src/models/user');

async function upsertUser({ name, username, password, role, branch }) {
  const existing = await User.findOne({ username }).exec();
  const passwordHash = await bcrypt.hash(password, 10);
  if (existing) {
    existing.name = name;
    existing.role = role;
    existing.branch = branch;
    existing.passwordHash = passwordHash;
    await existing.save();
    return existing.toJSON();
  }
  const created = await User.create({ name, username, passwordHash, role, branch });
  return created.toJSON();
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pharmacy';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const users = [
    { name: 'Mawuliah Mansaray', username: 'mawuliah', password: 'Admin@123', role: 'admin', branch: 'Freetown', status: 'Active', phone: '0777777777', balance: 0, lastLogin: new Date() },
    { name: 'Princess Kamara', username: 'princess', password: 'Salesperson@123', role: 'salesperson', branch: 'Bo', status: 'Active', phone: '0777777777', balance: 0, lastLogin: new Date() },
    { name: 'Samuel Kamara', username: 'samuel', password: 'Storekeeper@123', role: 'storekeeper', branch: 'Makeni', status: 'Active', phone: '0777777777', balance: 0, lastLogin: new Date() },
  ];

  for (const u of users) {
    const doc = await upsertUser(u);
    console.log(`Seeded: ${doc.username} (${doc.role})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
