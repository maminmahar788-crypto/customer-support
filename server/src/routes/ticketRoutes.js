import { Router } from 'express';
import { protect, allowRoles } from '../middleware/auth.js';
import { listTickets, createTicket, getTicket, updateTicket, agents, reports } from '../controllers/ticketController.js';
import Message from '../models/Message.js';
import Ticket from '../models/Ticket.js';
const router = Router();
router.use(protect);
router.get('/reports', reports);
router.get('/agents', allowRoles('admin', 'agent'), agents);
router.get('/', listTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.patch('/:id', updateTicket);
router.post('/:id/messages', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('customer', '_id');
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
    if (req.user.role === 'customer' && String(ticket.customer._id) !== String(req.user._id)) return res.status(403).json({ message: 'You cannot reply to this ticket.' });
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    if (body.length > 4000) return res.status(400).json({ message: 'Message must be 4000 characters or less.' });
    const message = await Message.create({ ticket: ticket._id, sender: req.user._id, body });
    if (req.user.role === 'agent' || req.user.role === 'admin') {
      if (!ticket.firstResponseAt) ticket.firstResponseAt = new Date();
      if (ticket.status === 'open' || ticket.status === 'waiting_customer') ticket.status = 'in_progress';
      ticket.slaBreached = ticket.slaBreached || new Date() > ticket.responseDueAt;
      await ticket.save();
    } else if (ticket.status === 'waiting_customer') { ticket.status = 'in_progress'; await ticket.save(); }
    const populated = await message.populate('sender', 'name role');
    req.io.to(`ticket:${ticket._id}`).emit('message:new', populated);
    req.io.emit('ticket:changed', { ticketId: String(ticket._id) });
    res.status(201).json({ message: populated });
  } catch (error) { res.status(400).json({ message: 'Could not send message.', detail: error.message }); }
});
export default router;
