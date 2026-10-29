import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  category: { type: String, enum: ['Technical', 'Billing', 'Account', 'General'], default: 'General' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: { type: String, enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'], default: 'open' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  firstResponseAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  responseDueAt: { type: Date, required: true },
  resolutionDueAt: { type: Date, required: true },
  slaBreached: { type: Boolean, default: false }
}, { timestamps: true });

ticketSchema.pre('validate', function () {
  if (!this.ticketNumber) this.ticketNumber = `SD-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
});
export default mongoose.model('Ticket', ticketSchema);
