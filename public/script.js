// Elementos do DOM
// Elementos do DOM - usando let para permitir reatribuição se necessário
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const historyButton = document.getElementById('history-button');
const historyModal = document.getElementById('history-modal-overlay');
const historyClose = document.getElementById('history-close');
const sessionsList = document.getElementById('sessions-list');
const sessionDetails = document.getElementById('session-details');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const openLoginBtn = document.getElementById('open-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authUserLabel = document.getElementById('auth-user-label');
const loginCancelBtn = document.getElementById('login-cancel-btn');
let backToSessions = null; // Será atribuído dinamicamente quando necessário

// Array para armazenar o histórico de conversas para exibição
const conversationHistory = [];

// Array para armazenar o histórico no formato da API
let apiChatHistory = [];

const AUTH_STORAGE_KEY = 'chatbotAuth';
let authState = {
    username: null,
    authHeader: null
};

function encodeBasicAuth(username, password) {
    return 'Basic ' + btoa(unescape(encodeURIComponent(`${username}:${password}`)));
}

function updateAuthUI() {
    if (!authUserLabel || !openLoginBtn || !logoutBtn) return;
    if (authState.username) {
        authUserLabel.textContent = `Conectado como ${authState.username}`;
        logoutBtn.classList.remove('hidden');
        openLoginBtn.textContent = 'Trocar usuário';
    } else {
        authUserLabel.textContent = 'Você não está conectado.';
        logoutBtn.classList.add('hidden');
        openLoginBtn.textContent = 'Entrar';
    }
}

function persistAuthState() {
    if (authState.username && authState.authHeader) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
}

function setAuthState(username, authHeader) {
    authState = { username, authHeader };
    persistAuthState();
    updateAuthUI();
}

function clearAuthState() {
    authState = { username: null, authHeader: null };
    persistAuthState();
    updateAuthUI();
}

function showLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = 'flex';
    if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
    }
    loginForm?.reset();
}

function hideLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = 'none';
    loginForm?.reset();
}

async function verifyCredentials(username, password) {
    const authHeader = encodeBasicAuth(username, password);
    const res = await fetch('/api/user/preferences', {
        headers: { Authorization: authHeader }
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Usuário ou senha inválidos.');
    }
    return authHeader;
}

function restoreAuthFromStorage() {
    try {
        const data = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!data) {
            updateAuthUI();
            return;
        }
        const parsed = JSON.parse(data);
        if (parsed?.username && parsed?.authHeader) {
            authState = parsed;
        }
    } catch (error) {
        console.warn('Não foi possível restaurar credenciais salvas.', error);
    } finally {
        updateAuthUI();
    }
}

restoreAuthFromStorage();

// Função para formatar mensagem para o histórico da API
function formatMessageForHistory(message, isUser) {
    const messageText = typeof message === 'string' ? message : 
                       (message.text || message.message || JSON.stringify(message));
    
    return {
        role: isUser ? 'user' : 'assistant', // <-- corrigido
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

async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = loginUsername?.value.trim();
    const password = loginPassword?.value || '';
    if (!username || !password) {
        if (loginError) {
            loginError.textContent = 'Informe usuário e senha para entrar.';
            loginError.style.display = 'block';
        }
        return;
    }
    try {
        if (loginError) {
            loginError.textContent = '';
            loginError.style.display = 'none';
        }
        const authHeader = await verifyCredentials(username, password);
        setAuthState(username, authHeader);
        hideLoginModal();
        showToast('Login realizado com sucesso!');
    } catch (error) {
        if (loginError) {
            loginError.textContent = error.message || 'Não foi possível fazer login.';
            loginError.style.display = 'block';
        }
    }
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
            userId: authState.username || 'anonimo',
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

        const result = await response.json();
        console.log("Histórico de sessão salvo:", result.message);
        
    } catch (error) {
        console.error("Erro ao enviar histórico de sessão:", error);
        throw new Error("Ocorreu um erro ao salvar a conversa. Por favor, tente novamente.");
    }
}

// Função para carregar histórico de sessões do backend
async function updateSessionsList() {
    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com'; // URL fixa para desenvolvimento local
            
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
    backToSessions = header.querySelector('#back-to-sessions');
    if (backToSessions) {
        backToSessions.addEventListener('click', () => {
            sessionDetails.style.display = 'none';
            sessionsList.style.display = 'flex';
        });
    }
    
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
    if (!authState.authHeader) {
        showToast('Faça login para conversar com o bot.', 'error');
        showLoginModal();
        return;
    }

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
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        
        // Formata o histórico para garantir consistência e compatibilidade com o modelo
        const formattedHistory = apiChatHistory.map(msg => {
            // Primeiro, tenta obter o texto da mensagem
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

            // Determina o papel (role) da mensagem
             let role = msg.role;
        if (!role) {
        if (msg.isUser) {
        role = 'user';
    } else if (role === 'assistant') {
        role = 'model';
    } else {
        role = 'model';
    }
}


            // Retorna o objeto formatado
            return {
                role: role,
                parts: [{
                    text: messageText
                }]
            };
        });
        
        // Prepara a requisição com o formato correto para o modelo
        const requestBody = {
            message: message,
            history: formattedHistory.filter(msg => msg && msg.parts && msg.parts[0] && msg.parts[0].text)
        };

        console.log('Enviando para o servidor:', JSON.stringify(requestBody, null, 2));

        // Adiciona a instrução da personalidade selecionada ao requestBody
        const selectedPersonality = localStorage.getItem('selectedPersonality');
        if (selectedPersonality && personalities[selectedPersonality]) {
            requestBody.systemInstruction = personalities[selectedPersonality].instruction;
        }

        const response = await fetch(`${backendUrl}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authState.authHeader
            },
            body: JSON.stringify(requestBody)
        });
        
        // Remove o indicador de digitação
        removeTypingIndicator();
        
        // Processa a resposta
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Resposta do servidor:", data);
        
        // Adiciona a resposta do botlet role à interface
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
        
        let mensagemErro = 'Desculpe, tive um problema ao processar sua mensagem. Por favor, tente novamente.';
        
        try {
            if (error.message.includes('salvar')) {
                mensagemErro = 'Ops! Tive um problema ao salvar nossa conversa, mas você pode continuar conversando normalmente.';
            } else if (error.message.includes('500')) {
                // Tenta obter mais detalhes do erro
                const errorDetails = await error.response?.text();
                console.error('Detalhes do erro 500:', errorDetails);
                mensagemErro = 'Desculpe, ocorreu um erro interno no servidor. Por favor, aguarde um momento e tente novamente.';
            } else if (!navigator.onLine) {
                mensagemErro = 'Parece que você está sem conexão com a internet. Por favor, verifique sua conexão e tente novamente.';
            }
        } catch (e) {
            console.error('Erro ao processar detalhes do erro:', e);
        }
        
        showError(mensagemErro);
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

        const backendUrl = 'https://chatbot-dny3.onrender.com';
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
    const backendUrl = 'https://chatbot-dny3.onrender.com';
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
        const saveResponse = await fetch(`${backendUrl}/api/chat/historicos/${sessionId}/${newTitle}`, {
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
    // Verifica e adiciona event listeners para elementos essenciais
    if (sendButton && userInput) {
        sendButton.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    } else {
        console.error('Elementos essenciais do chat não encontrados');
    }
    
    // Event listeners para o histórico - com verificações de existência
    if (historyButton && historyModal) {
        historyButton.addEventListener('click', () => {
            historyModal.style.display = 'flex';
            updateSessionsList();
        });
    }
    
    if (historyClose) {
        historyClose.addEventListener('click', () => {
            if (historyModal) historyModal.style.display = 'none';
            if (sessionDetails) sessionDetails.style.display = 'none';
            if (sessionsList) sessionsList.style.display = 'flex';
        });
    }
    
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

    if (openLoginBtn) {
        openLoginBtn.addEventListener('click', showLoginModal);
    }
    if (loginCancelBtn) {
        loginCancelBtn.addEventListener('click', hideLoginModal);
    }
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearAuthState();
            showToast('Você saiu da conta.');
        });
    }
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                hideLoginModal();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loginModal?.style.display === 'flex') {
            hideLoginModal();
        }
    });
});