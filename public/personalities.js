// Estado atual e definições das personalidades

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

        addMessage(`Agora estou em modo ${personalityNames[personality]}! Como posso ajudar?`, false);

    } catch (error) {
        console.error('Erro ao atualizar personalidade:', error);
        showError('Não foi possível alterar a personalidade. Por favor, tente novamente.');
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