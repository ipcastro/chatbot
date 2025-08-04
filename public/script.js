// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');
const historicoContainer = document.getElementById('historico-container');
const listaSessoes = document.getElementById('lista-sessoes');
const visualizacaoConversa = document.getElementById('visualizacao-conversa-detalhada');
const fecharHistoricoBtn = document.getElementById('fechar-historico');

// Array para armazenar o histórico de conversas para exibição
const conversationHistory = [];

// Array para armazenar o histórico no formato da API Gemini
let apiChatHistory = [];

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

// Função para salvar histórico da sessão
async function salvarHistoricoSessao() {
    try {
        // Usar URL local para desenvolvimento
        const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3001' 
            : 'https://chatbot-dny3.onrender.com';
            
        const payload = {
            sessionId: currentSessionId,
            botId: "IFCODE SuperBot",
            startTime: chatStartTime.toISOString(),
            endTime: new Date().toISOString(),
            messages: apiChatHistory // O array completo do histórico da API
        };

        const response = await fetch(`${backendUrl}/api/chat/salvar-historico`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Falha ao salvar histórico:", errorData.error || response.statusText);
        } else {
            const result = await response.json();
            console.log("Histórico de sessão salvo:", result.message);
        }
    } catch (error) {
        console.error("Erro ao enviar histórico de sessão:", error);
    }
}

// Função para carregar histórico de sessões do backend
async function carregarHistoricoSessoes() {
    try {
        // Usar URL local para desenvolvimento
        const backendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3001' 
            : 'https://chatbot-dny3.onrender.com';
            
        const response = await fetch(`${backendUrl}/api/chat/historicos`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const historicos = await response.json();
        console.log('Históricos carregados:', historicos);
        
        // Limpar lista atual
        listaSessoes.innerHTML = '';
        
        if (historicos.length === 0) {
            const noHistoryItem = document.createElement('li');
            noHistoryItem.textContent = 'Nenhuma conversa salva ainda.';
            noHistoryItem.style.textAlign = 'center';
            noHistoryItem.style.opacity = '0.7';
            noHistoryItem.style.cursor = 'default';
            listaSessoes.appendChild(noHistoryItem);
            return;
        }
        
        // Criar itens da lista para cada sessão
        historicos.forEach(sessao => {
            const listItem = document.createElement('li');
            const startTime = new Date(sessao.startTime);
            const endTime = new Date(sessao.endTime);
            
            // Formatar data e hora
            const dataFormatada = startTime.toLocaleDateString('pt-BR');
            const horaFormatada = startTime.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Contar mensagens
            const numMensagens = sessao.messages ? sessao.messages.length : 0;
            
            listItem.innerHTML = `
                <strong>Conversa em ${dataFormatada} às ${horaFormatada}</strong><br>
                <small>${numMensagens} mensagens • ${sessao.botId || 'Chatbot'}</small>
            `;
            
            // Adicionar event listener para exibir conversa detalhada
            listItem.addEventListener('click', () => {
                // Remover seleção anterior
                document.querySelectorAll('#lista-sessoes li').forEach(li => {
                    li.classList.remove('sessao-selecionada');
                });
                
                // Selecionar item atual
                listItem.classList.add('sessao-selecionada');
                
                // Exibir conversa detalhada
                exibirConversaDetalhada(sessao);
            });
            
            listaSessoes.appendChild(listItem);
        });
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showError('Erro ao carregar histórico de conversas.');
    }
}

// Função para exibir conversa detalhada
function exibirConversaDetalhada(sessao) {
    // Limpar área de visualização
    visualizacaoConversa.innerHTML = '';
    
    // Criar cabeçalho da conversa
    const header = document.createElement('h3');
    const startTime = new Date(sessao.startTime);
    const endTime = new Date(sessao.endTime);
    
    header.textContent = `Conversa de ${startTime.toLocaleDateString('pt-BR')} às ${startTime.toLocaleTimeString('pt-BR')}`;
    visualizacaoConversa.appendChild(header);
    
    // Verificar se há mensagens
    if (!sessao.messages || sessao.messages.length === 0) {
        const noMessages = document.createElement('p');
        noMessages.textContent = 'Nenhuma mensagem encontrada nesta conversa.';
        noMessages.style.opacity = '0.7';
        noMessages.style.textAlign = 'center';
        visualizacaoConversa.appendChild(noMessages);
        return;
    }
    
    // Exibir cada mensagem, filtrando a instrução do sistema
    sessao.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        
        // Determinar se é mensagem do usuário ou do bot
        const isUserMessage = msg.role === 'user';
        messageDiv.className = `message ${isUserMessage ? 'user-message' : 'bot-message'}`;
        
        // Extrair texto da mensagem
        let messageText = '';
        if (msg.parts && Array.isArray(msg.parts)) {
            messageText = msg.parts
                .filter(part => part.text)
                .map(part => part.text)
                .join(' ');
        } else if (typeof msg === 'string') {
            messageText = msg;
        } else if (msg.text) {
            messageText = msg.text;
        }
        
        // Filtrar a instrução do sistema (system instruction)
        const systemInstructionKeywords = [
            'Você é o Chatbot Musical',
            'assistente virtual especializado em música',
            'REGRAS IMPORTANTES',
            'getCurrentTime',
            'getWeather',
            'searchSong',
            'NUNCA responda perguntas sobre data',
            'Use emojis musicais',
            'NUNCA mencione o nome das funções'
        ];
        
        const isSystemInstruction = systemInstructionKeywords.some(keyword => 
            messageText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Pular mensagens que são instruções do sistema
        if (isSystemInstruction) {
            return; // Pula esta mensagem
        }
        
        // Formatar texto com quebras de linha
        messageDiv.innerHTML = messageText.replace(/\n/g, '<br>');
        
        // Adicionar timestamp se disponível
        if (msg.timestamp) {
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'message-timestamp';
            timestampSpan.textContent = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
            messageDiv.appendChild(timestampSpan);
        }
        
        visualizacaoConversa.appendChild(messageDiv);
    });
}

// Função para mostrar/esconder o histórico
function toggleHistorico() {
    if (historicoContainer.style.display === 'none' || !historicoContainer.style.display) {
        historicoContainer.style.display = 'flex';
        carregarHistoricoSessoes(); // Carregar dados quando abrir
    } else {
        historicoContainer.style.display = 'none';
    }
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
        const response = await fetch('https://chatbot-dny3.onrender.com/chat', {
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
        
        // Salva o histórico após cada interação
        await salvarHistoricoSessao();
        
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
        const response = await fetch('https://chatbot-dny3.onrender.com/check-time');
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





// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Adiciona os event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Event listeners para o histórico
    historyButton.addEventListener('click', toggleHistorico);
    fecharHistoricoBtn.addEventListener('click', () => {
        historicoContainer.style.display = 'none';
    });
    
    // Fechar histórico ao clicar fora dele
    historicoContainer.addEventListener('click', (e) => {
        if (e.target === historicoContainer) {
            historicoContainer.style.display = 'none';
        }
    });
    
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