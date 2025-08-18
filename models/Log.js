const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    col_data: String,
    col_hora: String,
    col_IP: String,
    col_nome_bot: String,
    col_acao: String
});

module.exports = mongoose.model('Log', logSchema, 'tb_cl_user_log_acess');
