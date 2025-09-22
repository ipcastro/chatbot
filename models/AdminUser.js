const mongoose = require('mongoose');

const adminUserSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true, trim: true, index: true },
	passwordHash: { type: String, required: true },
	createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminUser', adminUserSchema, 'admin_users');


