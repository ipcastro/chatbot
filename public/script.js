// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');
const historyModal = document.getElementById('history-modal-overlay');
const historyClose = document.getElementById('history-close');
const sessionsList = document.getElementById('sessions-list');
const sessionDetails = document.getElementById('session-details');
let backToSessions = null; // Será atribuído dinamicamente quando necessário

// Array para armazenar o histórico de conversas para exibição
const conversationHistory = [];

// Array para armazenar o histórico no formato da API
let apiChatHistory = [];

// Função para formatar mensagem para o histórico da API
function formatMessageForHistory(message, isUser) {
    const messageText = typeof message === 'string' ? message : 
                       (message.text || message.message || JSON.stringify(message));
    
    return {
        role: isUser ? 'user' : 'assistant',
        parts: [{ text: messageText }]
    }
}

// Variáveis para gerenciar a sessão atual
let currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
let chatStartTime = new Date();

// Função para rolar automaticamente para a última mensagem
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Função para mostrar o indicador de "digitando..."
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<span class="typing-dots">Digitando</span>';
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

// Função para remover o indicador de "digitando..."
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Função para adicionar mensagem ao chat
function addMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    
    // Gerar timestamp
    const timestamp = new Date().toLocaleTimeString();
    
    // Converter strings de texto com quebras de linha em HTML com <br>
    if (typeof message === 'string') {
        messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    } else {
        messageDiv.textContent = message;
    }
    
    // Adicionar timestamp à mensagem
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp'; // Classe corrigida
    timestampSpan.textContent = timestamp;
    messageDiv.appendChild(timestampSpan);
    
    chatMessages.appendChild(messageDiv);
    
    // Adiciona ao histórico de exibição
    conversationHistory.push({ 
        message, 
        isUser,
        timestamp: timestamp
    });
    
    // Adiciona ao histórico da API
    apiChatHistory.push(formatMessageForHistory(message, isUser));
    
    scrollToBottom();
}

// Função para mostrar erro no chat
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error-message';
    errorDiv.textContent = message;
    
    // Adicionar timestamp à mensagem de erro
    const timestamp = new Date().toLocaleTimeString();
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp'; // Classe corrigida
    timestampSpan.textContent = timestamp;
    errorDiv.appendChild(timestampSpan);
    
    chatMessages.appendChild(errorDiv);
    scrollToBottom();
}

// Função para verificar se uma mensagem está relacionada a hora/data
function isTimeRelatedQuestion(message) {
    const timeQuestions = [
        "que horas são", "horas", "horário", "que dia é hoje", "data", 
        "dia de hoje", "data atual", "dia atual", "hora atual", "data de hoje", 
        "hora agora", "que horas", "hora exata", "me diga as horas", 
        "pode me dizer que horas são", "diga a hora"
    ];
    
    return timeQuestions.some(q => message.toLowerCase().includes(q.toLowerCase()));
}

// Função para salvar histórico da sessão
async function salvarHistoricoSessao() {
    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        
        // Formata as mensagens garantindo a estrutura correta
        const formattedMessages = apiChatHistory.map(msg => ({
            role: msg.role || (msg.isUser ? 'user' : 'assistant'),
            parts: [{
                text: typeof msg.text === 'string' ? msg.text :
                      msg.message || 
                      (msg.parts && msg.parts[0] && msg.parts[0].text) ||
                      JSON.stringify(msg)
            }],
            timestamp: msg.timestamp || new Date().toISOString()
        }));
            
        const payload = {
            sessionId: currentSessionId,
            userId: 'anonimo',
            botId: "IFCODE SuperBot",
            startTime: chatStartTime.toISOString(),
            endTime: new Date().toISOString(),
            messages: formattedMessages
        };

        const response = await fetch(`${backendUrl}/api/chat/salvar-historico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Resposta do servidor ao salvar histórico:", errorText);
            throw new Error("Não foi possível salvar o histórico da conversa. Por favor, tente novamente.");
        }

        