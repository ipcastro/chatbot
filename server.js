// Importações necessárias
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Importar os modelos
const SessaoChat = require('./models/SessaoChat');
const Log = require('./models/Log');

// Configuração do servidor Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Conexão com MongoDB usando Mongoose
mongoose.connect(process.env.MONGO_HISTORIA)
    .then(() => {
        console.log('Conectado ao MongoDB via Mongoose');
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Erro ao conectar ao MongoDB:', err);
        process.exit(1);
    });

let dadosRankingVitrine = [];

// Inicialização da API Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = 'gemini-1.5-flash';

// Função para obter hora atual
function getCurrentTime() {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));

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

  return {
    currentTime: `${dayOfWeek}, ${day} de ${monthName} de ${year}, ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    dayOfWeek,
    dayOfMonth: day,
    month: monthName,
    year,
    hours,
    minutes,
    seconds
  };
}

async function getWeather(args) {
  const location = args.location;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return { error: "Chave da API não configurada." };

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=pt_br`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6),
      feelsLike: Math.round(data.main.feels_like)
    };
  } catch {
    return { error: `Não encontrei informações do tempo para "${location}".` };
  }
}

async function searchSong(args) {
  const { title, artist } = args;
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return { error: "Chave da API Last.fm não configurada." };

  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(title)}${artist ? '&artist=' + encodeURIComponent(artist) : ''}&api_key=${apiKey}&format=json&limit=5`;

  try {
    const response = await axios.get(url);
    const tracks = response.data.results?.trackmatches?.track;
    if (!tracks) return { results: [], message: "Nenhuma música encontrada." };

    const trackArray = Array.isArray(tracks) ? tracks : [tracks];
    return {
      results: trackArray.map(track => ({
        title: track.name,
        artist: track.artist,
        url: track.url
      })).slice(0, 5)
    };
  } catch {
    return { error: "Erro ao buscar música." };
  }
}

const availableFunctions = { getCurrentTime, getWeather, searchSong };
const functionDeclarations = [
  { name: "getCurrentTime", description: "Retorna hora e data atuais no Brasil", parameters: { type: "object", properties: {} } },
  {
    name: "getWeather",
    description: "Obtém informações meteorológicas",
    parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"] }
  },
  {
    name: "searchSong",
    description: "Pesquisa informações sobre uma música",
    parameters: { type: "object", properties: { title: { type: "string" }, artist: { type: "string" } }, required: ["title"] }
  }
];

const systemInstruction = `Você é o Chatbot Musical, um assistente virtual brasileiro especializado em música.
IMPORTANTE: Você DEVE SEMPRE responder em português do Brasil, usando linguagem informal e amigável.`;

// ✅ ROTA /chat (corrigida e única)
app.post('/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    console.log("Mensagem recebida:", message);

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ functionDeclarations }],
      generation_config: { temperature: 0.7 },
    });

    const formattedHistory = history.map(msg => {
      const text = typeof msg === 'string' ? msg :
                  msg.message || msg.text || 
                  (msg.parts && msg.parts[0] && msg.parts[0].text) || 
                  JSON.stringify(msg);

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        parts: [{ text }]
      };
    });

    formattedHistory.unshift(
      { role: 'system', parts: [{ text: systemInstruction }] },
      { role: 'system', parts: [{ text: 'Você DEVE responder SEMPRE em português do Brasil.' }] }
    );

    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { temperature: 0.7, topP: 0.8, topK: 40 }
    });

    const result = await chat.sendMessage(message);
    const modelResponse = result.response;

    let responseText = "";
    if (typeof modelResponse.text === 'function') {
      responseText = modelResponse.text();
    } else if (modelResponse.candidates?.[0]?.content?.parts) {
      responseText = modelResponse.candidates[0].content.parts
        .filter(part => part.text)
        .map(part => part.text)
        .join("");
    }

    res.json({ response: responseText, history: await chat.getHistory() });

  } catch (error) {
    console.error("Erro no /chat:", error);
    res.status(500).json({ response: "Erro interno no servidor.", history: [], error: error.message });
  }
});
