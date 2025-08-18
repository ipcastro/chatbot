// Elementos do DOM
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');
const historyModal = document.getElementById('history-modal-overlay');
const historyClose = document.getElementById('history-close');
const sessionsList = document.getElementById('sessions-list');
const sessionDetails = document.getElementById('session-details');
const backToSessions = document.getElementById('back-to-sessions');

// Array para armazenar o histórico de conversas para exibição
const conversationHistory = [];

// Array para armazenar o histórico no formato da API
let apiChatHistory = [];

// Função para formatar mensagem para o histórico da API
function formatMessageForHistory(message, isUser) {
    return {
        role: isUser ? 'user' : 'assistant',
        text: message,
        timestamp: new Date().toISOString()
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
        const backendUrl = 'http://localhost:3001'; // URL fixa para desenvolvimento local
            
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
async function updateSessionsList() {
    try {
        const backendUrl = 'http://localhost:3001'; // URL fixa para desenvolvimento local
            
        const response = await fetch(`${backendUrl}/api/chat/historicos`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const historicos = await response.json();
        console.log('Históricos carregados:', historicos);
        
        // Limpar lista atual
        sessionsList.innerHTML = '';
        
        if (historicos.length === 0) {
            sessionsList.innerHTML = `
                <div class="no-history">
                    <p>Nenhuma conversa salva ainda.</p>
                </div>
            `;
            return;
        }
        
        // Criar itens da lista para cada sessão
        historicos.forEach(sessao => {
            const sessionCard = document.createElement('div');
            sessionCard.className = 'session-card';
            sessionCard.dataset.id = sessao._id;
            
            const startTime = new Date(sessao.startTime);
            
            // Formatar data e hora
            const dataFormatada = startTime.toLocaleDateString('pt-BR');
            const horaFormatada = startTime.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Contar mensagens
            const numMensagens = sessao.messages ? sessao.messages.length : 0;
            
            const titulo = sessao.titulo || 'Conversa Sem Título';
            
            sessionCard.innerHTML = `
                <div class="session-header">
                    <h3>${titulo}</h3>
                    <div class="session-actions">
                        <button class="btn-rename" title="Renomear Conversa" data-id="${sessao._id}">✨</button>
                        <button class="btn-delete" title="Excluir Conversa" data-id="${sessao._id}">🗑️</button>
                    </div>
                </div>
                <div class="session-info">
                    <span class="session-date">${dataFormatada} às ${horaFormatada}</span>
                    <span class="session-stats">${numMensagens} mensagens • ${sessao.botId || 'Chatbot'}</span>
                </div>
            `;
            
            // Event listener para botões
            const btnRename = sessionCard.querySelector('.btn-rename');
            const btnDelete = sessionCard.querySelector('.btn-delete');
            
            btnRename.addEventListener('click', async (e) => {
                e.stopPropagation();
                await obterESalvarTitulo(sessao._id, sessionCard);
            });
            
            btnDelete.addEventListener('click', async (e) => {
                e.stopPropagation();
                await excluirSessao(sessao._id, sessionCard);
            });

            // Event listener para visualizar conversa
            sessionCard.addEventListener('click', () => {
                sessionsList.style.display = 'none';
                sessionDetails.style.display = 'flex';
                showSessionDetails(sessao);
            });
            
            sessionsList.appendChild(sessionCard);
        });
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showError('Erro ao carregar histórico de conversas.');
    }
}

// Função para exibir conversa detalhada
function showSessionDetails(sessao) {
    // Limpar área de visualização
    sessionDetails.innerHTML = '';
    
    // Criar cabeçalho com título e data
    const header = document.createElement('div');
    header.className = 'session-details-header';
    const startTime = new Date(sessao.startTime);
    
    header.innerHTML = `
        <button id="back-to-sessions" class="btn-back">←</button>
        <div class="session-title">
            <h2>${sessao.titulo || 'Conversa Sem Título'}</h2>
            <span class="session-date">${startTime.toLocaleDateString('pt-BR')} às ${startTime.toLocaleTimeString('pt-BR')}</span>
        </div>
    `;
    
    // Adicionar event listener para o botão voltar
    const backButton = header.querySelector('#back-to-sessions');
    backButton.addEventListener('click', () => {
        sessionDetails.style.display = 'none';
        sessionsList.style.display = 'flex';
    });
    
    sessionDetails.appendChild(header);
    
    // Container para mensagens
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'session-messages';
    
    // Verificar se há mensagens
    if (!sessao.messages || sessao.messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="no-messages">
                <p>Nenhuma mensagem encontrada nesta conversa.</p>
            </div>
        `;
        sessionDetails.appendChild(messagesContainer);
        return;
    }
    
    // Exibir cada mensagem, filtrando a instrução do sistema
    sessao.messages.forEach(msg => {
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
        
        // Filtrar a instrução do sistema
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
            return;
        }
        
        const messageDiv = document.createElement('div');
        const isUserMessage = msg.role === 'user';
        messageDiv.className = `session-message ${isUserMessage ? 'user' : 'bot'}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${messageText.replace(/\n/g, '<br>')}
                ${msg.timestamp ? `<span class="message-time">${new Date(msg.timestamp).toLocaleTimeString('pt-BR')}</span>` : ''}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    sessionDetails.appendChild(messagesContainer);
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
        const backendUrl = 'http://localhost:3001';
        const response = await fetch(`${backendUrl}/chat`, {
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
        
        // Adiciona a resposta do bot à interface
        addMessage(data.response);
        
        // Se recebemos um novo histórico do servidor, atualizamos
        if (data.history) {
            apiChatHistory = data.history;
        }
        
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
// Função para excluir uma sessão de chat
async function excluirSessao(sessionId, sessionCard) {
    try {
        const result = await showConfirmDialog('Excluir Conversa', 'Tem certeza que deseja excluir esta conversa?');
        if (!result) return;

        const backendUrl = 'http://localhost:3001';
        console.log('Tentando excluir sessão:', sessionId);
        
        const response = await fetch(`${backendUrl}/api/chat/historicos/${sessionId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao excluir conversa');
        }

        // Animação de fade out antes de remover
        sessionCard.style.opacity = '0';
        setTimeout(() => {
            sessionCard.remove();
            
            // Se não houver mais sessões, mostrar mensagem
            if (sessionsList.children.length === 0) {
                sessionsList.innerHTML = `
                    <div class="no-history">
                        <p>Nenhuma conversa salva ainda.</p>
                    </div>
                `;
            }
        }, 300);
        
        showToast('Conversa excluída com sucesso');
        console.log('Sessão excluída com sucesso');
    } catch (error) {
        console.error('Erro ao excluir conversa:', error);
        showToast('Não foi possível excluir a conversa. Por favor, tente novamente.', 'error');
    }
}

// Função para obter e salvar o título de uma sessão de chat
async function obterESalvarTitulo(sessionId, sessionCard) {
    const backendUrl = 'http://localhost:3001';
    const titleElement = sessionCard.querySelector('.session-header h3');
    const originalTitle = titleElement.textContent;

    try {
        // Mostrar dialog personalizado para editar título
        const newTitle = await showEditTitleDialog('Editar Título', originalTitle);
        
        if (!newTitle || newTitle === originalTitle) {
            return;
        }

        // Mostrar loading no título
        titleElement.innerHTML = `
            <div class="loading-title">
                <span class="loading-dots"></span>
                Salvando...
            </div>
        `;

        console.log('Salvando novo título para sessão:', sessionId);
        
        // Salvar novo título
        const saveResponse = await fetch(`${backendUrl}/api/chat/historicos/${sessionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ titulo: newTitle })
        });

        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || 'Erro ao salvar título');
        }

        // Atualizar título na interface com animação
        titleElement.style.opacity = '0';
        setTimeout(() => {
            titleElement.textContent = newTitle;
            titleElement.style.opacity = '1';
        }, 200);

        showToast('Título atualizado com sucesso');
    } catch (error) {
        console.error('Erro ao salvar título:', error);
        showToast('Não foi possível salvar o título. Por favor, tente novamente.', 'error');
        titleElement.textContent = originalTitle;
    }
}

// Funções auxiliares para UI
function showConfirmDialog(title, message) {
    return new Promise(resolve => {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="dialog-buttons">
                    <button class="btn-cancel">Cancelar</button>
                    <button class="btn-confirm">Confirmar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        dialog.querySelector('.btn-cancel').onclick = () => {
            dialog.remove();
            resolve(false);
        };
        
        dialog.querySelector('.btn-confirm').onclick = () => {
            dialog.remove();
            resolve(true);
        };
    });
}

function showEditTitleDialog(title, currentTitle) {
    return new Promise(resolve => {
        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>${title}</h3>
                <input type="text" class="title-input" value="${currentTitle}" maxlength="50" placeholder="Digite um título para a conversa">
                <div class="dialog-buttons">
                    <button class="btn-cancel">Cancelar</button>
                    <button class="btn-save" disabled>Salvar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        const input = dialog.querySelector('.title-input');
        const saveButton = dialog.querySelector('.btn-save');
        
        // Habilita/desabilita botão de salvar baseado no input
        function updateSaveButton() {
            const newTitle = input.value.trim();
            saveButton.disabled = !newTitle || newTitle === currentTitle;
        }
        
        input.focus();
        input.select();
        
        input.addEventListener('input', updateSaveButton);
        
        dialog.querySelector('.btn-cancel').onclick = () => {
            dialog.remove();
            resolve(null);
        };
        
        dialog.querySelector('.btn-save').onclick = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                dialog.remove();
                resolve(newTitle);
            }
        };
        
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                const newTitle = input.value.trim();
                if (newTitle && newTitle !== currentTitle) {
                    dialog.remove();
                    resolve(newTitle);
                }
            }
        };

        // Fechar ao clicar fora ou pressionar ESC
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
                resolve(null);
            }
        });

        document.addEventListener('keydown', function handler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handler);
                dialog.remove();
                resolve(null);
            }
        });
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after animation
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Adiciona os event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Event listeners para o histórico
    historyButton.addEventListener('click', () => {
        historyModal.style.display = 'flex';
        updateSessionsList();
    });
    
    historyClose.addEventListener('click', () => {
        historyModal.style.display = 'none';
        sessionDetails.style.display = 'none';
        sessionsList.style.display = 'flex';
    });
    
    backToSessions.addEventListener('click', () => {
        sessionDetails.style.display = 'none';
        sessionsList.style.display = 'flex';
    });
    
    // Fechar histórico ao clicar fora dele
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
            sessionDetails.style.display = 'none';
            sessionsList.style.display = 'flex';
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