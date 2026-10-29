import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';

await connectDB();
const demoUsers = [
  { name: 'Support Admin', email: 'admin@supportdesk.local', password: 'Admin123!', role: 'admin' },
  { name: 'Alex Agent', email: 'agent@supportdesk.local', password: 'Agent123!', role: 'agent' },
  { name: 'Demo Customer', email: 'customer@supportdesk.local', password: 'Customer123!', role: 'customer' }
];
for (const item of demoUsers) {
  const existing = await User.findOne({ email: item.email });
  if (!existing) await User.create(item);
  console.log(`${item.role}: ${item.email} / ${item.password}`);
}
await mongoose.disconnect();
console.log('Demo accounts are ready. Change these passwords for any non-demo use.');
