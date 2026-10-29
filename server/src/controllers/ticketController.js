import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { deadlines, isSlaBreached } from '../utils/sla.js';

const populateTicket = (q) => q.populate('customer', 'name email').populate('assignedAgent', 'name email');
function canView(ticket, user) { return ['admin', 'agent'].includes(user.role) || String(ticket.customer._id || ticket.customer) === String(user._id); }

export async function listTickets(req, res) {
  const filter = {};
  if (req.user.role === 'customer') filter.customer = req.user._id;
  if (req.user.role === 'agent') filter.$and = [{ $or: [{ assignedAgent: req.user._id }, { assignedAgent: null }] }];
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.search) {
    const searchClause = { $or: [{ subject: { $regex: req.query.search, $options: 'i' } }, { ticketNumber: { $regex: req.query.search, $options: 'i' } }] };
    filter.$and = [...(filter.$and || []), searchClause];
  }
  const tickets = await populateTicket(Ticket.find(filter).sort({ updatedAt: -1 }).limit(200));
  res.json({ tickets: tickets.map(t => ({ ...t.toObject(), slaBreached: t.slaBreached || isSlaBreached(t) })) });
}
export async function createTicket(req, res) {
  try {
    const { subject, description, category = 'General', priority = 'medium' } = req.body;
    if (!subject?.trim() || !description?.trim()) return res.status(400).json({ message: 'Subject and description are required.' });
    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) return res.status(400).json({ message: 'Invalid priority.' });
    const due = deadlines(priority);
    const ticket = await Ticket.create({ subject, description, category, priority, customer: req.user._id, ...due });
    await Message.create({ ticket: ticket._id, sender: req.user._id, body: description });
    const populated = await populateTicket(Ticket.findById(ticket._id));
    req.io.emit('ticket:created', { ticketId: String(ticket._id) });
    res.status(201).json({ ticket: populated });
  } catch (error) { res.status(400).json({ message: 'Could not create ticket.', detail: error.message }); }
}
export async function getTicket(req, res) {
  const ticket = await populateTicket(Ticket.findById(req.params.id));
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (!canView(ticket, req.user)) return res.status(403).json({ message: 'You cannot view this ticket.' });
  const messages = await Message.find({ ticket: ticket._id }).populate('sender', 'name role').sort({ createdAt: 1 });
  res.json({ ticket: { ...ticket.toObject(), slaBreached: ticket.slaBreached || isSlaBreached(ticket) }, messages });
}
export async function updateTicket(req, res) {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (req.user.role === 'customer') return res.status(403).json({ message: 'Only support staff can update ticket status or assignment.' });
  const { status, priority, assignedAgent } = req.body;
  if (status && !['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
  if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) return res.status(400).json({ message: 'Invalid priority.' });
  if (assignedAgent !== undefined && assignedAgent !== null) {
    const agent = await User.findById(assignedAgent);
    if (!agent || !['agent', 'admin'].includes(agent.role)) return res.status(400).json({ message: 'Select a valid support agent.' });
    ticket.assignedAgent = agent._id;
  } else if (assignedAgent === null) ticket.assignedAgent = null;
  if (priority && priority !== ticket.priority) { ticket.priority = priority; Object.assign(ticket, deadlines(priority, ticket.createdAt)); }
  if (status) { ticket.status = status; if (status === 'resolved' || status === 'closed') ticket.resolvedAt = ticket.resolvedAt || new Date(); else ticket.resolvedAt = null; }
  ticket.slaBreached = isSlaBreached(ticket);
  await ticket.save();
  const populated = await populateTicket(Ticket.findById(ticket._id));
  req.io.to(`ticket:${ticket._id}`).emit('ticket:updated', { ticketId: String(ticket._id) });
  req.io.emit('ticket:changed', { ticketId: String(ticket._id) });
  res.json({ ticket: populated });
}
export async function agents(req, res) {
  const users = await User.find({ role: { $in: ['agent', 'admin'] }, isActive: true }).select('name email role').sort({ name: 1 });
  res.json({ agents: users });
}
export async function reports(req, res) {
  const base = req.user.role === 'customer' ? { customer: req.user._id } : {};
  const tickets = await Ticket.find(base).lean();
  const now = new Date();
  const byStatus = Object.fromEntries(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map(s => [s, tickets.filter(t => t.status === s).length]));
  const byPriority = Object.fromEntries(['low', 'medium', 'high', 'urgent'].map(p => [p, tickets.filter(t => t.priority === p).length]));
  const overdue = tickets.filter(t => t.slaBreached || ((!t.firstResponseAt && now > t.responseDueAt) || (!t.resolvedAt && now > t.resolutionDueAt))).length;
  const resolved = tickets.filter(t => t.resolvedAt);
  const avgResolutionHours = resolved.length ? Math.round(resolved.reduce((sum, t) => sum + (new Date(t.resolvedAt) - new Date(t.createdAt)) / 3600000, 0) / resolved.length * 10) / 10 : 0;
  const agentRows = req.user.role === 'customer' ? [] : await Promise.all((await User.find({ role: 'agent' }).select('name')).map(async a => ({ name: a.name, assigned: await Ticket.countDocuments({ ...base, assignedAgent: a._id }), resolved: await Ticket.countDocuments({ ...base, assignedAgent: a._id, status: { $in: ['resolved', 'closed'] } }) })));
  res.json({ total: tickets.length, byStatus, byPriority, overdue, avgResolutionHours, agentRows });
}
