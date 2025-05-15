// Importações necessárias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const path = require('path');

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ... (código anterior do server.js) ...

app.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    console.log("\n--- Nova Mensagem ---");
    console.log("Mensagem do usuário:", message);
    if (history) {
        // console.log("Histórico recebido (primeiro e último item se houver):", history.length > 0 ? [history[0], history[history.length -1]] : "vazio");
    }


    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ functionDeclarations }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    });

    const chat = model.startChat({
      history: history, // O histórico já foi sanitizado para [] se undefined
      generationConfig: {
        temperature: 0.7,
      },
    });

    let currentApiRequestContents;
    let modelResponse;
    let loopCount = 0;
    const MAX_FUNCTION_CALL_LOOPS = 5;

    // Primeira chamada com a mensagem do usuário
    currentApiRequestContents = message;

    while (loopCount < MAX_FUNCTION_CALL_LOOPS) {
      loopCount++;
      console.log(`[CHAT_LOOP ${loopCount}] Enviando para o modelo. Tipo do input: ${typeof currentApiRequestContents}`);
      if (typeof currentApiRequestContents !== 'string') {
        // console.log("[CHAT_LOOP] Conteúdo (partes de função):", JSON.stringify(currentApiRequestContents, null, 2).substring(0, 300) + "...");
      } else {
        // console.log("[CHAT_LOOP] Conteúdo (mensagem):", currentApiRequestContents.substring(0,300));
      }

      let result;
      try {
        result = await chat.sendMessage(currentApiRequestContents);
      } catch (sdkError) {
        console.error(`[SDK_ERROR] Erro ao chamar chat.sendMessage na iteração ${loopCount}:`, sdkError);
        console.error("[SDK_ERROR] Stack:", sdkError.stack);
        // Tenta enviar uma mensagem de erro baseada no que o SDK retornou, se possível.
        const errorResponseText = sdkError.message || "Ocorreu um erro ao comunicar com a IA.";
        const currentHistory = await chat.getHistory(); // Pega o histórico até o ponto do erro
        return res.status(500).json({ response: errorResponseText, history: currentHistory, error: "SDK Error" });
      }
      
      console.log(`[CHAT_LOOP ${loopCount}] Resposta recebida do modelo.`);
      // console.log("[DEBUG] Objeto 'result' completo de sendMessage:", JSON.stringify(result, null, 2)); // LOG MUITO VERBOSO, DESCOMENTE SE NECESSÁRIO

      if (!result || !result.response) {
          console.error(`[PANIC_RESPONSE] result ou result.response está undefined/null após sendMessage na iteração ${loopCount}.`);
          console.error("[PANIC_RESPONSE] Conteúdo de result:", JSON.stringify(result, null, 2));
          const historySoFar = await chat.getHistory();
          return res.status(500).json({ response: "Erro crítico: A IA não retornou uma resposta válida.", history: historySoFar, error: "Invalid AI Response" });
      }
      modelResponse = result.response;
      // console.log(`[CHAT_LOOP ${loopCount}] modelResponse (result.response):`, JSON.stringify(modelResponse, null, 2)); // LOG VERBOSO

      // Verifica se functionCalls existe e é uma função
      if (typeof modelResponse.functionCalls !== 'function') {
        console.log(`[CHAT_LOOP ${loopCount}] modelResponse.functionCalls não é uma função. Assumindo resposta textual.`);
        break; 
      }

      const functionCallRequests = modelResponse.functionCalls();

      if (!functionCallRequests || functionCallRequests.length === 0) {
        console.log(`[CHAT_LOOP ${loopCount}] Nenhuma chamada de função pendente nesta resposta.`);
        break; 
      }

      console.log(`[CHAT_LOOP ${loopCount}] Chamadas de função requisitadas (${functionCallRequests.length}):`, JSON.stringify(functionCallRequests.map(fc => fc.name)));

      const functionExecutionResponses = [];
      for (const call of functionCallRequests) {
        const functionToCall = availableFunctions[call.name];
        if (functionToCall) {
          try {
            console.log(`[FUNC_EXEC] Executando: ${call.name}, Args:`, call.args);
            const functionResultData = await functionToCall(call.args);
            console.log(`[FUNC_EXEC] Resultado de ${call.name}:`, JSON.stringify(functionResultData).substring(0,200) + "...");
            functionExecutionResponses.push({
              functionResponse: { name: call.name, response: functionResultData },
            });
          } catch (funcError) {
            console.error(`[FUNC_ERROR] Erro ao executar ${call.name}:`, funcError);
            functionExecutionResponses.push({
              functionResponse: { name: call.name, response: { error: `Erro interno ao executar ${call.name}: ${funcError.message}` } },
            });
          }
        } else {
          console.error(`[FUNC_ERROR] Função ${call.name} não implementada.`);
          functionExecutionResponses.push({
            functionResponse: { name: call.name, response: { error: "Função não implementada no servidor." } },
          });
        }
      }

      if (functionExecutionResponses.length > 0) {
        currentApiRequestContents = functionExecutionResponses; 
      } else {
        console.log(`[CHAT_LOOP ${loopCount}] Nenhuma resposta de função processada, saindo do loop.`);
        break;
      }
    } 

    if (loopCount >= MAX_FUNCTION_CALL_LOOPS) {
        console.warn("[CHAT_LOOP_MAX] Loop de chamadas de função atingiu o limite máximo.");
    }

    let responseText = "";
    if (modelResponse && typeof modelResponse.text === 'function') {
        responseText = modelResponse.text();
    } else if (modelResponse && modelResponse.candidates && modelResponse.candidates[0]?.content?.parts) {
        // Fallback para extrair texto se modelResponse.text() não estiver disponível
        responseText = modelResponse.candidates[0].content.parts.filter(part => part.text).map(part => part.text).join("");
        if (!responseText) {
             console.warn("[TEXT_EXTRACTION] Não foi possível extrair texto de modelResponse.candidates. Verifique a estrutura.");
             // console.log("[DEBUG] modelResponse para extração de texto com falha:", JSON.stringify(modelResponse, null, 2));
        }
    } else {
        console.error("[TEXT_EXTRACTION_FAIL] Não foi possível obter texto final de modelResponse. Estrutura:", JSON.stringify(modelResponse, null, 2));
        responseText = "Desculpe, tive um problema ao gerar a resposta final.";
    }

    console.log("[FINAL_RESPONSE] Texto para o usuário:", responseText.substring(0,300) + "...");

    const updatedHistory = await chat.getHistory();
    // console.log("[HISTORY_UPDATE] Histórico atualizado para enviar ao cliente (primeiro e último):", updatedHistory.length > 0 ? [updatedHistory[0], updatedHistory[updatedHistory.length -1]] : "vazio");

    res.json({
      response: responseText,
      history: updatedHistory,
    });

  } catch (error) {
    console.error("===== ERRO GERAL NA ROTA /chat =====");
    console.error("Mensagem do Erro:", error.message);
    console.error("Stack Trace do Erro:", error.stack); // ESSENCIAL!
    
    // Tenta pegar o histórico atual se possível, mesmo em erro
    let errorHistory = req.body.history || []; // Pega o histórico que veio na requisição
    try {
        if (typeof chat !== 'undefined' && chat && typeof chat.getHistory === 'function') { // Verifica se chat foi inicializado
            errorHistory = await chat.getHistory();
        }
    } catch (historyError) {
        console.error("Erro ao tentar obter histórico durante o tratamento de erro:", historyError.message);
    }

    res.status(500).json({
      response: `Desculpe, ocorreu um erro interno no servidor: ${error.message}. Por favor, tente novamente.`,
      history: errorHistory, // Envia o histórico que temos até o momento do erro
      error: error.message || "Erro desconhecido",
      // Em desenvolvimento, você pode querer enviar o stack, mas NUNCA em produção.
      // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});



// Inicialização da API Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = 'gemini-2.0-flash';

// Função para obter a hora atual - Garantindo o fuso horário brasileiro
function getCurrentTime() {
  console.log("⏰ Executando getCurrentTime");
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

  // console.log("Data original (servidor):", now);
  // console.log("Data ajustada para Brasília:", brasiliaTime);

  const hours = brasiliaTime.getHours();
  const minutes = brasiliaTime.getMinutes();
  const seconds = brasiliaTime.getSeconds();
  const day = brasiliaTime.getDate();
  const month = brasiliaTime.getMonth();
  const year = brasiliaTime.getFullYear();

  const diasSemana = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const nomesMeses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

  const dayOfWeek = diasSemana[brasiliaTime.getDay()];
  const monthName = nomesMeses[month];

  const formattedDateTime = `${dayOfWeek}, ${day} de ${monthName} de ${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  // console.log("Horário formatado:", formattedDateTime);

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
    console.error("Chave da API OpenWeatherMap não configurada.");
    return { error: "Chave da API OpenWeatherMap não configurada no servidor." };
  }
  if (!location) {
    console.warn("Localização não fornecida para getWeather. Retornando erro amigável.");
    return { error: "Por favor, especifique uma cidade para a previsão do tempo." };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=pt_br`;

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
    console.error("Erro ao chamar OpenWeatherMap:", error.response?.data?.message || error.message);
    const errorMessage = error.response?.data?.cod === "404" || error.response?.data?.message === 'city not found'
      ? `Não encontrei informações do tempo para "${location}". Pode verificar o nome da cidade?`
      : "Não foi possível obter o tempo para esta localização no momento.";
    return {
      error: errorMessage
    };
  }
}

async function searchSong(args) {
  console.log("Executando searchSong com args:", args);
  const { title, artist } = args;
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    console.error("Chave da API Last.fm não configurada.");
    return { error: "Chave da API Last.fm não configurada no servidor." };
  }
  if (!title) {
    console.warn("Título não fornecido para searchSong. Retornando erro amigável.");
    return { error: "Por favor, especifique o título da música." };
  }

  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(title)}${artist ? '&artist=' + encodeURIComponent(artist) : ''}&api_key=${apiKey}&format=json&limit=5`;

  try {
    const response = await axios.get(url);
    const tracks = response.data.results?.trackmatches?.track;

    if (!tracks || (Array.isArray(tracks) && tracks.length === 0) || (typeof tracks === 'object' && !Array.isArray(tracks) && Object.keys(tracks).length === 0) ) {
      return { results: [], message: "Nenhuma música encontrada com esses critérios." };
    }
    
    const trackArray = Array.isArray(tracks) ? tracks : [tracks]; // Last.fm pode retornar um objeto se for um só resultado

    return {
      results: trackArray.map(track => ({
        title: track.name,
        artist: track.artist,
        url: track.url
      })).slice(0, 5) // Garante no máximo 5 resultados
    };
  } catch (error) {
    console.error("Erro ao pesquisar música:", error.response?.data || error.message);
    return { error: "Não foi possível realizar a pesquisa de música no momento." };
  }
}

const availableFunctions = {
  getCurrentTime,
  getWeather,
  searchSong
};

const functionDeclarations = [
  {
    name: "getCurrentTime",
    description: "Retorna a hora e data atuais no Brasil (fuso horário de Brasília), com informações detalhadas sobre o dia, mês, ano e horário.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "getWeather",
    description: "Obtém informações meteorológicas para uma localização específica (cidade).",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Nome da cidade para obter o clima (ex: São Paulo, Rio de Janeiro, Curitiba)"
        }
      },
      required: ["location"]
    }
  },
  {
    name: "searchSong",
    description: "Pesquisa informações sobre uma música pelo título e, opcionalmente, pelo artista.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título da música a ser pesquisada"
        },
        artist: {
          type: "string",
          description: "Nome do artista (opcional, mas ajuda a refinar a busca)"
        }
      },
      required: ["title"]
    }
  }
];

const systemInstruction = `Você é o Chatbot Musical, um assistente virtual especializado em música. 
Você deve responder principalmente sobre temas relacionados à música.
Você tem acesso às seguintes funções:
- getCurrentTime: Para informar a hora e data atuais no Brasil (horário de Brasília).
- getWeather: Para verificar o clima em uma cidade (você pode relacionar com músicas sobre o clima ou humor).
- searchSong: Para buscar informações sobre músicas específicas.

REGRAS IMPORTANTES:
1. Quando o usuário perguntar sobre a hora atual, data atual, ou fazer perguntas como "que horas são?", "que dia é hoje?", SEMPRE use a função getCurrentTime. Forneça uma resposta completa que inclua o dia da semana, data e horário.
2. Após informar a hora/data, você pode fazer uma conexão com alguma curiosidade musical relacionada.
3. Seja amigável e entusiasmado sobre música! Use emojis musicais (🎵, 🎸, 🎹) quando apropriado.
4. Se não souber uma resposta, seja honesto.
5. Use as funções quando relevante para enriquecer a conversa. É OBRIGATÓRIO usar getCurrentTime para perguntas sobre data/hora.
6. Se o usuário pedir ajuda, sugira temas musicais ou funcionalidades que você oferece.
A data e hora atual (no momento em que o servidor iniciou) é: ${getCurrentTime().currentTime}. Use a função getCurrentTime para obter o valor mais recente quando o usuário perguntar.`;


app.get('/check-time', async (req, res) => {
  try {
    const timeData = getCurrentTime();
    res.json({ success: true, data: timeData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body; // Garante que history seja um array
    console.log("\n--- Nova Mensagem ---");
    // console.log("Histórico recebido:", JSON.stringify(history, null, 2));
    console.log("Mensagem do usuário:", message);

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ functionDeclarations }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
    });

    const chat = model.startChat({
      history: history,
      generationConfig: {
        temperature: 0.7,
      },
    });

    let currentApiRequestContents = [{role: "user", parts: [{text: message}]}]; // Conteúdo para enviar ao sendMessage
    let modelResponse; // Para armazenar a resposta do modelo (`GenerateContentResponse`)
    let loopCount = 0;
    const MAX_FUNCTION_CALL_LOOPS = 5;

    while (loopCount < MAX_FUNCTION_CALL_LOOPS) {
      loopCount++;
      console.log(`Loop ${loopCount}, enviando para o modelo (primeira parte):`, JSON.stringify(currentApiRequestContents[0]).substring(0, 200) + "...");

      // `sendMessage` espera um `string` ou `Part[]` ou `GenerateContentRequest`
      // Se `currentApiRequestContents` for um array de `FunctionResponsePart`, está correto.
      // Se for a primeira mensagem do usuário, `message` (string) é usado.
      const messageToSend = (loopCount === 1) ? message : currentApiRequestContents;
      const result = await chat.sendMessage(messageToSend); // `result` é `EnhancedGenerateContentResponse`
      
      modelResponse = result.response; // `modelResponse` é `GenerateContentResponse`

      if (!modelResponse) {
          console.error("PANIC: result.response (modelResponse) está undefined ou null. Conteúdo de result:", JSON.stringify(result, null, 2));
          const historySoFar = await chat.getHistory();
          const lastModelPart = historySoFar.filter(h => h.role === 'model').pop();
          const fallbackText = lastModelPart ? lastModelPart.parts.map(p => p.text || "").join('') : "Não consegui processar a resposta devido a um erro interno.";
          return res.json({ response: fallbackText, history: historySoFar });
      }
      
      // Log para depuração
      // console.log("Conteúdo de modelResponse (result.response):", JSON.stringify(modelResponse, null, 2));

      // Verifica se functionCalls existe e é uma função
      if (typeof modelResponse.functionCalls !== 'function') {
        console.log("modelResponse.functionCalls não é uma função. A resposta atual é provavelmente texto.");
        // console.log("Estrutura de modelResponse para depuração:", JSON.stringify(modelResponse, null, 2));
        break; // Sai do loop, pois não há (mais) chamadas de função ou o método não existe.
      }

      const functionCallRequests = modelResponse.functionCalls(); // Isto retorna FunctionCall[] | undefined

      if (!functionCallRequests || functionCallRequests.length === 0) {
        console.log("Nenhuma chamada de função pendente nesta resposta.");
        break; // Sai do loop se não houver chamadas de função
      }

      console.log(`Chamadas de função requisitadas pelo modelo (${functionCallRequests.length}):`, JSON.stringify(functionCallRequests, null, 2));

      const functionExecutionResponses = [];
      for (const call of functionCallRequests) { // `call` aqui é um objeto FunctionCall {name, args}
        const functionToCall = availableFunctions[call.name];
        if (functionToCall) {
          try {
            console.log(`Executando função: ${call.name} com args:`, call.args);
            const functionResultData = await functionToCall(call.args);
            console.log(`Resultado da função ${call.name}:`, functionResultData);
            functionExecutionResponses.push({ // Esta é a estrutura de FunctionResponsePart
              functionResponse: {
                name: call.name,
                response: functionResultData,
              },
            });
          } catch (error) {
            console.error(`Erro ao executar função ${call.name}:`, error);
            functionExecutionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: `Erro interno ao executar a função: ${error.message}` },
              },
            });
          }
        } else {
          console.error(`Função ${call.name} não implementada`);
          functionExecutionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: "Função não implementada no servidor." },
            },
          });
        }
      }

      if (functionExecutionResponses.length > 0) {
        console.log("Enviando respostas das funções para o modelo:", JSON.stringify(functionExecutionResponses, null, 2).substring(0,200) + "...");
        currentApiRequestContents = functionExecutionResponses; // Prepara para a próxima chamada ao sendMessage
      } else {
        console.log("Nenhuma resposta de função processada (isso não deveria acontecer se functionCallRequests existia), saindo do loop.");
        break;
      }
    } // Fim do while

    if (loopCount >= MAX_FUNCTION_CALL_LOOPS) {
        console.warn("Loop de chamadas de função atingiu o limite máximo.");
    }

    let responseText = "";
    if (modelResponse && typeof modelResponse.text === 'function') {
        responseText = modelResponse.text();
    } else if (modelResponse && modelResponse.candidates && modelResponse.candidates[0]?.content?.parts) {
        responseText = modelResponse.candidates[0].content.parts.map(part => part.text || "").join("");
    } else {
        console.error("Não foi possível obter texto final de modelResponse. Estrutura de modelResponse:", JSON.stringify(modelResponse, null, 2));
        responseText = "Desculpe, tive um problema ao gerar a resposta final.";
    }

    console.log("Resposta final do modelo para o usuário:", responseText);

    const updatedHistory = await chat.getHistory();
    // console.log("Histórico atualizado para enviar ao cliente:", JSON.stringify(updatedHistory, null, 2));

    res.json({
      response: responseText,
      history: updatedHistory,
    });

  } catch (error) {
    console.error("Erro GERAL no processamento do chat:", error);
    console.error("Stack do erro:", error.stack);
    if (error.message && error.message.includes('API key not valid')) {
         res.status(401).json({
            response: "Desculpe, ocorreu um erro de autenticação com a API de IA. Verifique a chave da API.",
            error: error.message
        });
    } else if (error.response && error.response.data) { // Erros de Axios ou outras APIs
        res.status(500).json({
            response: "Desculpe, ocorreu um erro ao se comunicar com um serviço externo.",
            error: error.response.data
        });
    }
    else {
        res.status(500).json({
          response: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.",
          error: error.message || "Erro desconhecido",
        });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acessível em: http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("ALERTA: GEMINI_API_KEY não está definida no arquivo .env! O chatbot não funcionará.");
  }
  if (!process.env.OPENWEATHER_API_KEY) {
    console.warn("ALERTA: OPENWEATHER_API_KEY não está definida no arquivo .env! A função getWeather não funcionará.");
  }
  if (!process.env.LASTFM_API_KEY) {
    console.warn("ALERTA: LASTFM_API_KEY não está definida no arquivo .env! A função searchSong não funcionará.");
  }
});