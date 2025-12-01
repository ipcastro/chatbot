// Estado atual e definições das personalidades
let currentPersonality = null;

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

// Carrega personalidades customizadas do localStorage
function loadCustomPersonalities() {
    const saved = localStorage.getItem('customPersonalities');
    if (saved) {
        try {
            const custom = JSON.parse(saved);
            Object.assign(personalities, custom);
        } catch (e) {
            console.error('Erro ao carregar personalidades customizadas:', e);
        }
    }
}

// Salva personalidades customizadas no localStorage
function saveCustomPersonalities() {
    const custom = {};
    Object.keys(personalities).forEach(key => {
        if (!['professor', 'dj', 'critico', 'compositor', 'historiador'].includes(key)) {
            custom[key] = personalities[key];
        }
    });
    if (Object.keys(custom).length > 0) {
        localStorage.setItem('customPersonalities', JSON.stringify(custom));
    }
}

// Função para atualizar a personalidade do chatbot
async function updatePersonality(personality) {
    try {
        // Armazena a personalidade no localStorage para persistência
        localStorage.setItem('selectedPersonality', personality);

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

        const name = personalityNames[personality] || personalities[personality]?.name || personality;
        addMessage(`Agora estou em modo ${name}! Como posso ajudar?`, false);

    } catch (error) {
        console.error('Erro ao atualizar personalidade:', error);
        showError('Não foi possível alterar a personalidade. Por favor, tente novamente.');
    }
}

// Verifica se o usuário está logado
function isUserLoggedIn() {
    const authState = localStorage.getItem('chatbotAuth');
    return authState ? JSON.parse(authState).username : null;
}

// Abre o modal para criar personalidade customizada
function openCustomPersonalityModal() {
    const loggedInUser = isUserLoggedIn();
    if (!loggedInUser) {
        showError('⚠️ Você precisa estar logado para criar personalidades customizadas!');
        // Abre o modal de login
        const openLoginBtn = document.getElementById('open-login-btn');
        if (openLoginBtn) openLoginBtn.click();
        return;
    }
    
    const modal = document.getElementById('custom-personality-modal');
    modal.style.display = 'flex';
    document.getElementById('custom-personality-form').reset();
    updateCharacterCounts();
}

// Fecha o modal
function closeCustomPersonalityModal() {
    const modal = document.getElementById('custom-personality-modal');
    modal.style.display = 'none';
}

// Atualiza o contador de caracteres
function updateCharacterCounts() {
    const nameInput = document.getElementById('custom-name');
    const instructionInput = document.getElementById('custom-instruction');
    
    if (nameInput) document.getElementById('name-count').textContent = nameInput.value.length;
    if (instructionInput) document.getElementById('instruction-count').textContent = instructionInput.value.length;
}

// Cria uma nova personalidade customizada
async function createCustomPersonality(name, emoji, instruction) {
    try {
        // Gera um ID único para a personalidade
        const customId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Salva a personalidade
        personalities[customId] = {
            instruction: instruction,
            name: name,
            emoji: emoji || '✨',
            isCustom: true
        };

        // Persiste no localStorage
        saveCustomPersonalities();

        // Cria um botão para a nova personalidade
        const newButton = document.createElement('button');
        newButton.className = 'personality-button';
        newButton.dataset.personality = customId;
        newButton.innerHTML = `<span>${emoji || '✨'}</span> ${name}`;
        newButton.addEventListener('click', () => updatePersonality(customId));

        // Adiciona antes do botão "Criar Personalidade"
        const addCustomBtn = document.getElementById('btn-add-custom');
        addCustomBtn.parentNode.insertBefore(newButton, addCustomBtn);

        // Fecha o modal
        closeCustomPersonalityModal();

        // Aplica a nova personalidade
        updatePersonality(customId);

        showToast(`✨ Personalidade "${name}" criada com sucesso!`);

    } catch (error) {
        console.error('Erro ao criar personalidade customizada:', error);
        showError('Não foi possível criar a personalidade. Tente novamente.');
    }
}

// Inicializa os event listeners para os botões de personalidade
document.addEventListener('DOMContentLoaded', () => {
    // Carrega personalidades customizadas do localStorage
    loadCustomPersonalities();

    // Event listeners para botões de personalidade predefinida
    const personalityButtons = document.querySelectorAll('.personality-button:not(.add-custom)');
    personalityButtons.forEach(button => {
        button.addEventListener('click', () => {
            const loggedInUser = isUserLoggedIn();
            if (!loggedInUser) {
                showError('⚠️ Você precisa estar logado para escolher uma personalidade!');
                const openLoginBtn = document.getElementById('open-login-btn');
                if (openLoginBtn) openLoginBtn.click();
                return;
            }
            const personality = button.dataset.personality;
            if (personality !== currentPersonality) {
                updatePersonality(personality);
            }
        });
    });

    // Event listener para botão "Criar Personalidade"
    const btnAddCustom = document.getElementById('btn-add-custom');
    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', openCustomPersonalityModal);
    }

    // Event listeners para o formulário de criar personalidade
    const form = document.getElementById('custom-personality-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = document.getElementById('custom-name').value.trim();
            const emoji = document.getElementById('custom-emoji').value.trim();
            const instruction = document.getElementById('custom-instruction').value.trim();

            if (!name || !instruction) {
                showError('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            createCustomPersonality(name, emoji, instruction);
        });
    }

    // Event listener para cancelar
    const btnCancel = document.getElementById('btn-cancel-custom');
    if (btnCancel) {
        btnCancel.addEventListener('click', closeCustomPersonalityModal);
    }

    // Event listener para fechar ao clicar fora
    const modal = document.getElementById('custom-personality-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCustomPersonalityModal();
            }
        });
    }

    // Event listeners para atualizar contador de caracteres
    const nameInput = document.getElementById('custom-name');
    const instructionInput = document.getElementById('custom-instruction');
    if (nameInput) nameInput.addEventListener('input', updateCharacterCounts);
    if (instructionInput) instructionInput.addEventListener('input', updateCharacterCounts);

    // Restaura personalidade anterior se existir
    const savedPersonality = localStorage.getItem('selectedPersonality');
    if (savedPersonality && personalities[savedPersonality]) {
        updatePersonality(savedPersonality);
    }
});