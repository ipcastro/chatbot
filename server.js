// Importações necessárias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const path = require('path');

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicialização da API Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = 'gemini-1.5-pro';

// Função CORRIGIDA para obter a hora atual - Agora garantindo o fuso horário brasileiro
function getCurrentTime() {
  console.log("⏰ Executando getCurrentTime - Versão corrigida");
  
  // Criar nova data e forçar o timezone para Brasil/São Paulo
  const now = new Date();
  
  // Ajustando para horário de Brasília (GMT-3)
  const brasiliaOffset = -3 * 60; // offset em minutos
  const utcOffset = now.getTimezoneOffset(); // offset local em minutos
  const totalOffsetMinutes = brasiliaOffset - utcOffset;
  
  // Criar nova data ajustada
  const brasiliaTime = new Date(now.getTime() + totalOffsetMinutes * 60000);
  
  // Log detalhado para debug
  console.log("Data original:", now);
  console.log("Data ajustada para Brasília:", brasiliaTime);
  
  // Extrair componentes da data/hora
  const hours = brasiliaTime.getHours();
  const minutes = brasiliaTime.getMinutes();
  const seconds = brasiliaTime.getSeconds();
  const day = brasiliaTime.getDate();
  const month = brasiliaTime.getMonth() + 1; // getMonth retorna 0-11
  const year = brasiliaTime.getFullYear();
  
  // Nomes dos dias da semana em português
  const diasSemana = [
    "domingo", "segunda-feira", "terça-feira", 
    "quarta-feira", "quinta-feira", "sexta-feira", "sábado"
  ];
  
  // Nomes dos meses em português
  const nomesMeses = [
    "janeiro", "fevereiro", "março", "abril",
    "maio", "junho", "julho", "agosto", 
    "setembro", "outubro", "novembro", "dezembro"
  ];
  
  const dayOfWeek = diasSemana[brasiliaTime.getDay()];
  const monthName = nomesMeses[brasiliaTime.getMonth()];
  
  // Formatação manual para garantir precisão
  const formattedDateTime = `${dayOfWeek}, ${day} de ${monthName} de ${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  console.log("Horário formatado:", formattedDateTime);
  
  return { 
    currentTime: formattedDateTime,
    dayOfWeek: dayOfWeek,
    dayOfMonth: day,
    month: monthName,
    year: year,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    isDay: hours >= 6 && hours < 18,
    timestamp: brasiliaTime.getTime()
  };
}

async function getWeather(args) {
  console.log("Executando getWeather com args:", args);
  const location = args.location;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    throw new Error("Chave da API OpenWeatherMap não configurada.");
  }
  
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=metric&lang=pt_br`;
  
  try {
    const response = await axios.get(url);
    return {
      location: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
      humidity: response.data.main.humidity,
      windSpeed: response.data.wind.speed
    };
  } catch (error) {
    console.error("Erro ao chamar OpenWeatherMap:", error.response?.data || error.message);
    return { 
      error: error.response?.data?.message || "Não foi possível obter o tempo para esta localização." 
    };
  }
}

async function searchSong(args) {
  console.log("Executando searchSong com args:", args);
  const { title, artist } = args;
  const apiKey = process.env.LASTFM_API_KEY;
  
  if (!apiKey) {
    throw new Error("Chave da API Last.fm não configurada.");
  }
  
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${title}${artist ? '&artist=' + artist : ''}&api_key=${apiKey}&format=json&limit=5`;
  
  try {
    const response = await axios.get(url);
    const tracks = response.data.results.trackmatches.track;
    
    if (!tracks || tracks.length === 0) {
      return { error: "Nenhuma música encontrada com esses critérios." };
    }
    
    return {
      results: tracks.map(track => ({
        title: track.name,
        artist: track.artist,
        url: track.url
      }))
    };
  } catch (error) {
    console.error("Erro ao pesquisar música:", error.response?.data || error.message);
    return { error: "Não foi possível realizar a pesquisa de música." };
  }
}

// Mapeamento de nomes de funções para as funções reais
const availableFunctions = {
  getCurrentTime,
  getWeather,
  searchSong
};

// Definição das funções para o modelo
const functionDefinitions = [
  {
    name: "getCurrentTime",
    description: "Retorna a hora e data atuais no Brasil, com informações detalhadas sobre o dia, mês, ano e horário",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "getWeather",
    description: "Obtém informações meteorológicas para uma localização específica",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Nome da cidade para obter o clima (ex: São Paulo, Rio de Janeiro)"
        }
      },
      required: ["location"]
    }
  },
  {
    name: "searchSong",
    description: "Pesquisa informações sobre uma música pelo título e/ou artista",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título da música a ser pesquisada"
        },
        artist: {
          type: "string",
          description: "Nome do artista (opcional)"
        }
      },
      required: ["title"]
    }
  }
];

// Configuração do modelo e contexto inicial
const chatContext = `Você é o Chatbot Musical, um assistente virtual especializado em música. 
Você deve responder principalmente sobre temas relacionados à música, como:
- Informações sobre artistas, bandas e compositores
- História e curiosidades musicais
- Gêneros musicais e suas características
- Instrumentos musicais e técnicas
- Teoria musical básica
- Recomendações musicais baseadas em preferências
- Eventos musicais importantes

Você tem acesso às seguintes funções:
- getCurrentTime: Para informar a hora e data atuais no Brasil
- getWeather: Para verificar o clima em uma cidade (pode relacionar com músicas sobre o clima)
- searchSong: Para buscar informações sobre músicas específicas

REGRAS IMPORTANTES:
1. Quando o usuário perguntar sobre a hora atual, data atual, ou fazer perguntas como "que horas são?", "que dia é hoje?", "qual é a data de hoje?", "que horas são agora?", "me diga as horas", "data de hoje", ou algo similar, SEMPRE use a função getCurrentTime e forneça uma resposta completa que inclua o dia da semana, data e horário.

2. Depois de informar a hora/data, você pode fazer uma conexão com alguma curiosidade musical relacionada ao período do dia (manhã, tarde, noite) ou ao dia da semana, se apropriado.

3. Seja amigável e entusiasmado sobre música!

4. Use emojis musicais ocasionalmente (🎵, 🎸, 🎹, 🎷, 🥁, etc.)

5. Quando não souber uma resposta, seja honesto e sugira outro tema musical

6. Para enriquecer a conversa, use suas funções quando relevante

7. É OBRIGATÓRIO usar a função getCurrentTime sempre que o usuário perguntar sobre horário ou data atual, não tente gerar essa informação por conta própria!
Além disso, você pode usar ferramentas especiais:
• Quando o usuário perguntar sobre a data ou hora atual (ex: "que dia é hoje?", "que horas são?"), use a ferramenta getCurrentTime para obter informações precisas e atualizadas de data e hora.
• Quando o usuário perguntar sobre o clima ou tempo meteorológico em alguma cidade (ex: "como está o tempo em Curitiba?"), use a ferramenta getWeather para buscar informações atuais.

Utilize essas ferramentas sempre que necessário para responder de forma precisa às perguntas do usuário, especialmente quando se tratarem de informações em tempo real como data, hora ou clima.

Aja com precisão, profundidade e didática. Você é um guia completo no universo da Física.
A data atual é ${getCurrentTime()}, utilize em caso de precisão

Quando o usuário digitar "ajuda", sugira temas sobre os quais você pode conversar.`;
function getCurrentTime (){
    const date = Date;
    return date;
}
const tools = [
    {
      functionDeclarations: [
        {
          name: "getCurrentTime",
          description: "Obtém a data e hora atuais.",
          parameters: { type: "object", properties: {} } // Sem parâmetros necessários
        },
        // Adicione outras declarações de função aqui depois (se desejar adicionar mais funções no futuro)
      ]
    }
  ];
  


// Rota para verificar se funções estão funcionando corretamente
app.get('/check-time', async (req, res) => {
  try {
    const timeData = getCurrentTime();
    res.json({ success: true, data: timeData });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Rota para servir o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para processar mensagens do chat
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    console.log("Mensagem do usuário:", message);
    
    // Verificar diretamente se é uma pergunta sobre hora/data
    const timeQuestions = [
      "que horas são", "horas", "horário", "que dia é hoje", "data", 
      "dia de hoje", "data atual", "dia atual", "hora atual", "data de hoje", 
      "hora agora", "que horas", "hora exata", "me diga as horas", 
      "pode me dizer que horas são", "diga a hora"
    ];
    
    // Checar se a mensagem contém perguntas sobre hora/data
    const isTimeQuestion = timeQuestions.some(q => 
      message.toLowerCase().includes(q.toLowerCase()));
    
    // Inicializar modelo com contexto e histórico
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: functionDefinitions
    });
    
    const chat = model.startChat({
      history: history || [],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
      },
      systemInstruction: chatContext,
    });
    
    // Enviar mensagem do usuário
    let response = await chat.sendMessage(message);
    let responseText = '';
    
    // Verificar se a resposta inclui chamadas de função
    while (response.functionCalls() && response.functionCalls().length > 0) {
      const functionCall = response.functionCalls()[0];
      console.log(`Chamada de função detectada: ${functionCall.name}`);
      
      if (availableFunctions[functionCall.name]) {
        try {
          // Executar a função
          const functionArgs = functionCall.args;
          const functionToCall = availableFunctions[functionCall.name];
          const functionResult = await functionToCall(functionArgs);
          
          console.log(`Resultado da função ${functionCall.name}:`, functionResult);
          
          // Enviar o resultado de volta para o modelo
          response = await chat.sendMessage([{
            functionResponse: {
              name: functionCall.name,
              response: functionResult
            }
          }]);
        } catch (error) {
          console.error(`Erro ao executar função ${functionCall.name}:`, error);
          
          // Informar o erro ao modelo
          response = await chat.sendMessage([{
            functionResponse: {
              name: functionCall.name,
              response: { error: error.message }
            }
          }]);
        }
      } else {
        console.error(`Função ${functionCall.name} não implementada`);
        
        // Informar ao modelo que a função não está disponível
        response = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: { error: "Função não implementada" }
          }
        }]);
      }
    }
    
    // Extrair texto final da resposta
    responseText = response.text();
    
    // Obter histórico atualizado
    const updatedHistory = chat.getHistory();
    
    // Enviar resposta ao cliente
    res.json({
      response: responseText,
      history: updatedHistory
    });
    
  } catch (error) {
    console.error("Erro no processamento do chat:", error);
    res.status(500).json({
      response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
      error: error.message
    });
  }
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acessível em: http://localhost:${PORT}`);
});