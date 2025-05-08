// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');

// Array para armazenar o histórico de conversas para exibição
const conversationHistory = [];

// Array para armazenar o histórico no formato da API Gemini
let apiChatHistory = [];

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
    timestampSpan.className = 'message-timestamp';
    timestampSpan.textContent = timestamp;
    messageDiv.appendChild(timestampSpan);
    
    chatMessages.appendChild(messageDiv);
    
    // Adiciona ao histórico de exibição
    conversationHistory.push({ 
        message, 
        isUser,
        timestamp: timestamp
    });
    
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
    timestampSpan.className = 'message-timestamp';
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

// Função para enviar mensagem ao servidor
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Desabilita o input e o botão durante o processamento
    userInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Enviando...';
    
    // Adiciona a mensagem do usuário à interface
    addMessage(message, true);
    userInput.value = '';
    
    // Mostra o indicador de digitação
    showTypingIndicator();
    
    try {
        // Log para debug - verificar se é uma pergunta relacionada a tempo
        if (isTimeRelatedQuestion(message)) {
            console.log("Detectada pergunta relacionada a horário/data:", message);
        }
        
        // Envia a mensagem para o servidor com o histórico da API
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message,
                history: apiChatHistory
            })
        });
        
        // Remove o indicador de digitação
        removeTypingIndicator();
        
        // Processa a resposta
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Resposta do servidor:", data);
        
        // Atualiza o histórico da API
        apiChatHistory = data.history;
        
        // Adiciona a resposta do bot à interface
        addMessage(data.response);
    } catch (error) {
        console.error('Erro ao conversar com o bot:', error);
        removeTypingIndicator();
        showError('Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.');
    } finally {
        // Reabilita o input e o botão após o processamento
        userInput.disabled = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Enviar';
        userInput.focus();
    }
}

// Função para testar diretamente a função de hora
async function testTimeFunction() {
    try {
        const response = await fetch('/check-time');
        const data = await response.json();
        console.log("Teste de hora:", data);
        
        if (data.success) {
            alert(`Função de horário está funcionando corretamente!\n\nHora atual: ${data.data.currentTime}`);
        } else {
            alert(`Erro na função de horário: ${data.error}`);
        }
    } catch (error) {
        console.error("Erro ao testar função de hora:", error);
        alert("Não foi possível testar a função de horário");
    }
}

// Função para mostrar histórico
function showHistory() {
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    
    // Cria o cabeçalho do histórico
    const headerDiv = document.createElement('div');
    headerDiv.className = 'history-header';
    
    const historyTitle = document.createElement('div');
    historyTitle.className = 'history-title';
    historyTitle.textContent = '📜 Histórico de Conversas';
    headerDiv.appendChild(historyTitle);
    
    const backButton = document.createElement('button');
    backButton.className = 'back-button';
    backButton.textContent = 'Voltar ao Chat';
    backButton.onclick = () => {
        chatMessages.innerHTML = '';
        conversationHistory.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.isUser ? 'user-message' : 'bot-message'}`;
            
            if (typeof msg.message === 'string') {
                messageDiv.innerHTML = msg.message.replace(/\n/g, '<br>');
            } else {
                messageDiv.textContent = msg.message;
            }
            
            // Adicionar timestamp ao restaurar as mensagens
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'message-timestamp';
            timestampSpan.textContent = msg.timestamp;
            messageDiv.appendChild(timestampSpan);
            
            chatMessages.appendChild(messageDiv);
        });
    };
    headerDiv.appendChild(backButton);
    
    chatMessages.appendChild(headerDiv);
    
    // Agrupa as mensagens por assunto
    let currentSubject = '';
    let currentMessages = [];
    
    conversationHistory.forEach((msg, index) => {
        if (msg.isUser) {
            if (currentSubject) {
                addMessageGroup(currentSubject, currentMessages);
            }
            currentSubject = msg.message;
            currentMessages = [msg];
        } else {
            currentMessages.push(msg);
        }
        
        if (index === conversationHistory.length - 1 && currentSubject) {
            addMessageGroup(currentSubject, currentMessages);
        }
    });
    
    scrollToBottom();
}

// Função para adicionar grupo de mensagens no histórico
function addMessageGroup(subject, messages) {
    const chatMessages = document.querySelector('.chat-messages');
    
    const subjectDiv = document.createElement('div');
    subjectDiv.className = 'history-subject';
    subjectDiv.textContent = `💬 ${subject}`;
    chatMessages.appendChild(subjectDiv);
    
    messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `history-message ${msg.isUser ? 'user-message' : 'bot-message'}`;
        
        if (typeof msg.message === 'string') {
            messageDiv.innerHTML = msg.message.replace(/\n/g, '<br>');
        } else {
            messageDiv.textContent = msg.message;
        }
        
        // Adiciona timestamp às mensagens no histórico
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'message-timestamp';
        timestampSpan.textContent = msg.timestamp;
        messageDiv.appendChild(timestampSpan);
        
        chatMessages.appendChild(messageDiv);
    });
    
    const separator = document.createElement('div');
    separator.className = 'history-separator';
    chatMessages.appendChild(separator);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona os event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    historyButton.addEventListener('click', showHistory);
    
    // Adicionar botão de teste de hora (apenas em desenvolvimento)
    const testButton = document.createElement('button');
    testButton.textContent = 'Testar Hora';
    testButton.className = 'test-button';
    testButton.style.position = 'fixed';
    testButton.style.bottom = '10px';
    testButton.style.right = '10px';
    testButton.style.zIndex = '1000';
    testButton.style.padding = '8px 15px';
    testButton.style.background = '#a1887f';
    testButton.addEventListener('click', testTimeFunction);
    document.body.appendChild(testButton);
    
    // Inicializar o histórico de conversa com a mensagem de boas-vindas
    if (conversationHistory.length === 0) {
        const welcomeMessage = document.querySelector('.message.bot-message');
        if (welcomeMessage) {
            // Adicionar timestamp à mensagem de boas-vindas existente
            const timestamp = new Date().toLocaleTimeString();
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'message-timestamp';
            timestampSpan.textContent = timestamp;
            welcomeMessage.appendChild(timestampSpan);
            
            conversationHistory.push({
                message: welcomeMessage.textContent,
                isUser: false,
                timestamp: timestamp
            });
        }
    }
    
    // Configurar o foco inicial
    userInput.focus();
});