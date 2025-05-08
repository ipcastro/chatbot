// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Função para adicionar mensagem ao chat
function addMessage(message, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Função para enviar mensagem para o servidor
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Adiciona mensagem do usuário
    addMessage(message, true);
    userInput.value = '';

    try {
        // Envia a mensagem para o servidor
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message }),
        });

        if (!response.ok) {
            throw new Error('Erro ao enviar mensagem');
        }

        const data = await response.json();
        
        // Adiciona a resposta do bot
        addMessage(data.response, false);
    } catch (error) {
        console.error('Erro:', error);
        addMessage('Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.', false);
    }
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Mensagem inicial do bot
addMessage('Olá! Sou o Chatbot Musical, seu guia musical virtual! 🎵🎼 Estou aqui para compartilhar meu amor pela música com você.\n\nPosso te ajudar com vários temas musicais. Se você não souber o que perguntar, é só digitar "ajuda" e eu te mostro algumas sugestões de perguntas que posso responder.\n\nO que você gostaria de saber sobre o maravilhoso mundo da música?', false); 