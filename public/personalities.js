// Auth Token e Gerenciamento de Sessão
let authToken = null;

// Funções de autenticação
function getAuthToken() {
    return authToken;
}

function setAuthToken(token) {
    authToken = token;
    if (token) {
        localStorage.setItem('chatAuthToken', token);
    } else {
        localStorage.removeItem('chatAuthToken');
    }
    updateLoginStatus();
}

function getBasicAuthHeader() {
    const token = getAuthToken();
    return token ? { 'Authorization': `Basic ${token}` } : {};
}

function updateLoginStatus() {
    const loginLink = document.getElementById('loginLink');
    if (loginLink) {
        if (getAuthToken()) {
            loginLink.textContent = 'Você está logado ✓';
            loginLink.style.cursor = 'default';
            loginLink.onclick = (e) => {
                e.preventDefault();
                if (confirm('Deseja sair?')) {
                    logout();
                }
            };
        } else {
            loginLink.textContent = 'Faça login para salvar suas preferências';
            loginLink.style.cursor = 'pointer';
            loginLink.onclick = (e) => {
                e.preventDefault();
                showLoginModal();
            };
        }
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    const form = document.getElementById('loginForm');
    const cancelBtn = document.getElementById('cancelLogin');
    const errorDiv = document.getElementById('loginError');

    modal.style.display = 'flex';
    form.reset();
    errorDiv.style.display = 'none';

    // Event listeners
    form.onsubmit = async (e) => {
        e.preventDefault();
        await handleLogin();
    };

    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const modal = document.getElementById('loginModal');

    try {
        // Criar o token Basic Auth
        const token = btoa(`${username}:${password}`);
        
        // Testar o login fazendo uma requisição para o endpoint de preferências
        const response = await fetch('/api/user/preferences', {
            headers: {
                'Authorization': `Basic ${token}`
            }
        });

        if (response.ok) {
            // Login bem sucedido
            setAuthToken(token);
            modal.style.display = 'none';
            showToast('Login realizado com sucesso!');
        } else {
            throw new Error('Credenciais inválidas');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        errorDiv.textContent = 'Usuário ou senha incorretos';
        errorDiv.style.display = 'block';
    }
}

function logout() {
    setAuthToken(null);
    showToast('Logout realizado com sucesso');
}

// Tentar restaurar a sessão no carregamento
document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('chatAuthToken');
    if (savedToken) {
        setAuthToken(savedToken);
    }
    updateLoginStatus();
});

// Definições das personalidades
const personalities = {
    professor: {
        instruction: `Você é um professor de música experiente e paciente. Use termos técnicos musicais mas explique-os de forma clara. 
        Sempre conecte o assunto com a teoria musical e dê exemplos práticos. Use analogias para explicar conceitos complexos.
        Seu objetivo é ensinar e inspirar o amor pela música. Mencione exercícios e dicas de estudo quando relevante.`
    },
    dj: {
        instruction: `Você é um DJ super animado e atualizado! Use uma linguagem mais informal e jovem. 
        Fale sobre remixes, batidas, tendências musicais e sempre sugira músicas que estão bombando.
        Mencione festivais, eventos e artistas populares. Seu objetivo é animar e compartilhar novidades do mundo da música.`
    },
    critico: {
        instruction: `Você é um crítico musical experiente com olhar analítico e opinião embasada. 
        Analise aspectos técnicos e artísticos das músicas/artistas discutidos. Compare diferentes obras e estilos.
        Cite referências históricas e influências. Seu objetivo é aprofundar a apreciação musical.`
    },
    compositor: {
        instruction: `Você é um compositor criativo sempre pensando em novas melodias e arranjos. 
        Fale sobre o processo criativo, técnicas de composição e como desenvolver ideias musicais.
        Dê dicas de songwriting e produção musical. Seu objetivo é inspirar a criatividade musical.`
    },
    historiador: {
        instruction: `Você é um historiador musical apaixonado que conecta músicas com seu contexto histórico e cultural.
        Conte histórias fascinantes sobre a origem dos gêneros e evolução da música. 
        Mencione fatos históricos interessantes e curiosidades. Seu objetivo é mostrar como a música reflete cada época.`
    }
};

// Estado atual da personalidade selecionada
let currentPersonality = null;

// Função para atualizar a personalidade do chatbot
async function updatePersonality(personality) {
    try {
        // Se não estiver logado, mostrar modal de login
        if (!getAuthToken()) {
            showLoginModal();
            return;
        }

        const response = await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getBasicAuthHeader()
            },
            body: JSON.stringify({
                systemInstruction: personalities[personality].instruction
            })
        });

        if (!response.ok) {
            throw new Error('Não foi possível atualizar a personalidade');
        }

        // Atualiza o estado local
        currentPersonality = personality;
        
        // Atualiza a UI
        document.querySelectorAll('.personality-button').forEach(button => {
            button.classList.toggle('active', button.dataset.personality === personality);
        });

        // Adiciona mensagem de confirmação no chat
        const personalityNames = {
            professor: 'Professor de Música',
            dj: 'DJ Animado',
            critico: 'Crítico Musical',
            compositor: 'Compositor',
            historiador: 'Historiador Musical'
        };

        addMessage(`Agora estou em modo ${personalityNames[personality]}! Como posso ajudar?`, false);

    } catch (error) {
        console.error('Erro ao atualizar personalidade:', error);
        if (error.message.includes('403')) {
            showLoginModal();
        } else {
            showError('Não foi possível alterar a personalidade. Por favor, tente novamente.');
        }
    }
}

// Inicializa os event listeners para os botões de personalidade
document.addEventListener('DOMContentLoaded', () => {
    const personalityButtons = document.querySelectorAll('.personality-button');
    
    personalityButtons.forEach(button => {
        button.addEventListener('click', () => {
            const personality = button.dataset.personality;
            if (personality !== currentPersonality) {
                updatePersonality(personality);
            }
        });
    });
});