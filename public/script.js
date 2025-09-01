// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');
const historyModal = document.getElementById('history-modal-overlay');
const historyClose = document.getElementById('history-close');
const sessionsList = document.getElementById('sessions-list');
const sessionDetails = document.getElementById('session-details');
let backToSessions = null;

// Array para armazenar histórico
const conversationHistory = [];
let apiChatHistory = [];

// Função para formatar mensagem para API
function formatMessageForHistory(message, isUser) {
    const messageText = typeof message === 'string'
        ? message
        : (message.text || message.message || JSON.stringify(message));

    return {
        role: isUser ? 'user' : 'assistant', // ✅ corrigido
        parts: [{ text: messageText }]
    };
}

let currentSessionId = `sessao_${Date.now()}_${Math.random().toString(36).substring(7)}`;
let chatStartTime = new Date();

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = '<span class="typing-dots">Digitando</span>';
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function addMessage(message, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const timestamp = new Date().toLocaleTimeString();
    if (typeof message === 'string') {
        messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    } else {
        messageDiv.textContent = message;
    }

    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = timestamp;
    messageDiv.appendChild(timestampSpan);

    chatMessages.appendChild(messageDiv);

    conversationHistory.push({ message, isUser, timestamp });
    apiChatHistory.push(formatMessageForHistory(message, isUser));

    scrollToBottom();
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'message error-message';
    errorDiv.textContent = message;

    const timestamp = new Date().toLocaleTimeString();
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = timestamp;
    errorDiv.appendChild(timestampSpan);

    chatMessages.appendChild(errorDiv);
    scrollToBottom();
}

function isTimeRelatedQuestion(message) {
    const timeQuestions = [
        "que horas são", "horas", "horário", "que dia é hoje", "data",
        "dia de hoje", "data atual", "dia atual", "hora atual", "data de hoje",
        "hora agora", "que horas", "hora exata", "me diga as horas",
        "pode me dizer que horas são", "diga a hora"
    ];
    return timeQuestions.some(q => message.toLowerCase().includes(q.toLowerCase()));
}

async function salvarHistoricoSessao() {
    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        const formattedMessages = apiChatHistory.map(msg => ({
            role: msg.role || (msg.isUser ? 'user' : 'assistant'), // ✅ corrigido
            parts: [{
                text: typeof msg.text === 'string'
                    ? msg.text
                    : msg.message || (msg.parts && msg.parts[0] && msg.parts[0].text) || JSON.stringify(msg)
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
            throw new Error("Não foi possível salvar o histórico da conversa.");
        }

        const result = await response.json();
        console.log("Histórico salvo:", result.message);

    } catch (error) {
        console.error("Erro ao salvar histórico:", error);
    }
}

async function updateSessionsList() {
    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        const response = await fetch(`${backendUrl}/api/chat/historicos`);
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);

        const historicos = await response.json();
        console.log('Históricos carregados:', historicos);
        sessionsList.innerHTML = '';

        if (historicos.length === 0) {
            sessionsList.innerHTML = `<div class="no-history"><p>Nenhuma conversa salva ainda.</p></div>`;
            return;
        }

        historicos.forEach(sessao => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'session-card';
            sessionCard.dataset.id = sessao._id;

            const startTime = new Date(sessao.startTime);
            const dataFormatada = startTime.toLocaleDateString('pt-BR');
            const horaFormatada = startTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const numMensagens = sessao.messages ? sessao.messages.length : 0;
            const titulo = sessao.titulo || 'Conversa Sem Título';

            sessionCard.innerHTML = `
                <div class="session-header">
                    <h3>${titulo}</h3>
                    <div class="session-actions">
                        <button class="btn-rename" data-id="${sessao._id}">✨</button>
                        <button class="btn-delete" data-id="${sessao._id}">🗑️</button>
                    </div>
                </div>
                <div class="session-info">
                    <span>${dataFormatada} às ${horaFormatada}</span>
                    <span>${numMensagens} mensagens • ${sessao.botId || 'Chatbot'}</span>
                </div>
            `;

            sessionsList.appendChild(sessionCard);
        });

    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showError('Erro ao carregar histórico.');
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    userInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Enviando...';

    addMessage(message, true);
    userInput.value = '';
    showTypingIndicator();

    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        const formattedHistory = apiChatHistory.map(msg => {
            let messageText = '';
            if (typeof msg.text === 'string') {
                messageText = msg.text;
            } else if (msg.message) {
                messageText = msg.message;
            } else if (msg.parts && msg.parts[0] && msg.parts[0].text) {
                messageText = msg.parts[0].text;
            } else {
                messageText = JSON.stringify(msg);
            }

            let role = msg.role;
            if (!role) {
                role = msg.isUser ? 'user' : 'assistant'; // ✅ corrigido
            }

            return { role, parts: [{ text: messageText }] };
        });

        const requestBody = { message, history: formattedHistory };

        const response = await fetch(`${backendUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        removeTypingIndicator();

        if (!response.ok) throw new Error(`Erro ${response.status}: ${response.statusText}`);

        const data = await response.json();
        addMessage(data.response);

        if (data.history) apiChatHistory = data.history;
        await salvarHistoricoSessao();

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        removeTypingIndicator();
        showError('Erro ao processar sua mensagem. Tente novamente.');
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
        userInput.focus();
    }
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
historyButton.addEventListener('click', () => { historyModal.style.display = 'flex'; updateSessionsList(); });
historyClose.addEventListener('click', () => { historyModal.style.display = 'none'; });
