const mongoose = require('mongoose');

const sessaoChatSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    titulo: {
        type: String,
        default: 'Conversa Sem Título',
        trim: true
    },
    userId: {
        type: String,
        default: 'anonimo'
    },
    botId: {
        type: String,
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    messages: [{
        role: {
            type: String,
            required: true,
            enum: ['user', 'model']
        },
        parts: [{
            text: {
                type: String,
                required: true
            }
        }],
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    loggedAt: {
        type: Date,
        default: Date.now
    }
});

// Método para atualizar o título de uma sessão
sessaoChatSchema.statics.atualizarTitulo = async function(id, novoTitulo) {
    try {
        const sessao = await this.findByIdAndUpdate(
            id,
            { titulo: novoTitulo },
            { new: true }
        );
        
        if (!sessao) {
            throw new Error('Sessão não encontrada');
        }
        
        return sessao;
    } catch (error) {
        throw new Error(`Erro ao atualizar título: ${error.message}`);
    }
};

// Método para excluir uma sessão
sessaoChatSchema.statics.excluirSessao = async function(id) {
    try {
        const sessao = await this.findByIdAndDelete(id);
        
        if (!sessao) {
            throw new Error('Sessão não encontrada');
        }
        
        return sessao;
    } catch (error) {
        throw new Error(`Erro ao excluir sessão: ${error.message}`);
    }
};

// Método para gerar título com base no conteúdo da conversa
sessaoChatSchema.methods.gerarTitulo = async function(model) {
    try {
        // Formata o histórico da conversa
        const mensagens = this.messages.map(msg => {
            const prefix = msg.role === 'user' ? 'Usuário' : 'Bot';
            return `${prefix}: ${msg.parts[0].text}`;
        }).join('\n');

        const prompt = `Com base nesta conversa, sugira um título curto e conciso de no máximo 5 palavras que capture o tema principal do diálogo:\n\n${mensagens}`;
        
        const result = await model.generateContent(prompt);
        const novoTitulo = result.response.text().trim();
        
        // Atualiza o título da sessão
        this.titulo = novoTitulo;
        await this.save();
        
        return novoTitulo;
    } catch (error) {
        throw new Error(`Erro ao gerar título: ${error.message}`);
    }
};

const SessaoChat = mongoose.model('SessaoChat', sessaoChatSchema);
module.exports = SessaoChat;
