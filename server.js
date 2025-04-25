require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Configuração CORS mais permissiva para debugging
app.use(cors({
    origin: '*', // Permite todas as origens durante o desenvolvimento
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Middleware adicional para garantir headers CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Responder imediatamente às solicitações OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Configuração do Express
app.use(express.json());
app.use(express.static('public'));

// Inicialização do Gemini com chave da variável de ambiente
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCAWuWXyYs7uxzED5Db6ep0O10SxWL7WlQ"; 
const genAI = new GoogleGenerativeAI(API_KEY);

// Rota para servir o frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para o chat com histórico
app.post('/chat', async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        // Inicializa o modelo Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        // Prepara o histórico para o formato esperado pela API
        const formattedHistory = history.length > 0 ? history : [
            {
                role: "user",
                parts: [{ text: "Você é um chatbot musical especializado em responder perguntas sobre música, artistas, gêneros musicais e teoria musical. Responda sempre em português do Brasil." }]
            },
            {
                role: "model",
                parts: [{ text: "Olá! Sou um chatbot musical e estou aqui para ajudar com qualquer dúvida sobre música. Posso falar sobre artistas, gêneros musicais, teoria musical, instrumentos e muito mais. Como posso ajudar você hoje?" }]
            }
        ];

        // Iniciar chat com histórico
        const chat = model.startChat({
            history: formattedHistory
        });

        // Envia a mensagem para o Gemini
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        // Cria novo histórico para retornar ao cliente
        const newHistory = [
            ...formattedHistory,
            { role: "user", parts: [{ text: message }] },
            { role: "model", parts: [{ text: text }] }
        ];

        res.json({ 
            response: text,
            history: newHistory 
        });
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        res.status(500).json({ 
            error: 'Desculpe, não consegui processar sua mensagem agora. Tente novamente em breve.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Inicialização do servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
    
    // Aviso sobre a chave API
    if (!process.env.GEMINI_API_KEY) {
        console.warn('AVISO: GEMINI_API_KEY não encontrada no arquivo .env.');
        console.warn('Por favor, crie um arquivo .env com sua chave API para produção.');
    }
});