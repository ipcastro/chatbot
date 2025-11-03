const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    // Instrução de sistema personalizada pelo usuário
    systemInstruction: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema, 'users');
