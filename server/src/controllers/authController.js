import jwt from 'jsonwebtoken';
import User from '../models/User.js';
const safeUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });
const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'An account with this email already exists.' });
    // Public registration always creates a customer; role escalation is not allowed.
    const user = await User.create({ name, email, password, role: 'customer' });
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { res.status(500).json({ message: 'Could not create account.', detail: error.message }); }
}
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password');
    if (!user || !user.isActive || !(await user.comparePassword(password || ''))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: safeUser(user) });
  } catch (error) { res.status(500).json({ message: 'Could not sign in.', detail: error.message }); }
}
export async function me(req, res) { res.json({ user: safeUser(req.user) }); }
