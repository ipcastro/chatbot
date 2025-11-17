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
let Config = null;
try {
    Config = require('./models/Config');
} catch (e) {
    console.warn('[WARN] models/Config.js não encontrado. Usando fallback em memória/ENV para systemInstruction.');
}
let AdminUser = null;
try {
    AdminUser = require('./models/AdminUser');
} catch (e) {
    console.warn('[WARN] models/AdminUser.js não encontrado.');
}
let User = null;
try {
  User = require('./models/User');
} catch (e) {
  console.warn('[WARN] models/User.js não encontrado. User-level auth endpoints ficarão indisponíveis.');
}

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

// Middleware de autenticação para rotas de admin (senha em Mongo com hash)
const bcrypt = require('bcryptjs');
function parseBasicAuth(header) {
    const value = header || '';
    if (!value.startsWith('Basic ')) return null;
    const base64 = value.slice(6);
    try {
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        const idx = decoded.indexOf(':');
        if (idx === -1) return null;
        const username = decoded.slice(0, idx);
        const password = decoded.slice(idx + 1);
        return { username, password };
    } catch (_) { return null; }
}

async function verifyAdminUserPassword(username, password) {
    if (!AdminUser) return false;
    const user = await AdminUser.findOne({ username }).lean();
    if (!user) return false;
    return bcrypt.compare(password, user.passwordHash);
}

async function requireAdmin(req, res, next) {
    try {
        const authHeader = req.headers['authorization'] || '';
        const basic = parseBasicAuth(authHeader);
        if (!basic) return res.status(403).json({ error: 'Acesso negado' });
        const ok = await verifyAdminUserPassword(basic.username, basic.password);
        if (!ok) return res.status(403).json({ error: 'Acesso negado' });
        next();
    } catch (e) {
        console.error('[AdminAuth] Erro:', e);
        return res.status(500).json({ error: 'Erro na verificação de admin.' });
    }
}

// Funções utilitárias para system instruction global
let inMemorySystemInstruction = null;
async function getGlobalSystemInstruction() {
    if (Config) {
        const doc = await Config.findOne({ key: 'systemInstruction' });
        return doc ? String(doc.value) : (process.env.SYSTEM_INSTRUCTION_DEFAULT || inMemorySystemInstruction);
    }
    return process.env.SYSTEM_INSTRUCTION_DEFAULT || inMemorySystemInstruction;
}

// Verifica credenciais de usuário comum (não-admin)
async function verifyUserPassword(username, password) {
  if (!User) return false;
  const user = await User.findOne({ username }).lean();
  if (!user) return false;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : false;
}

// Middleware que tenta extrair usuário via Basic Auth (opcional)
async function optionalUserFromAuth(req, res, next) {
  try {
    if (!User) return next();
    const authHeader = req.headers['authorization'] || '';
    const basic = parseBasicAuth(authHeader);
    if (!basic) return next();
    const user = await User.findOne({ username: basic.username }).lean();
    if (!user) return next();
    const ok = await bcrypt.compare(basic.password, user.passwordHash);
    if (!ok) return next();
    req.currentUser = user; // attach user document (lean)
    return next();
  } catch (e) {
    console.error('[optionalUserFromAuth] Erro:', e);
    return next();
  }
}

// Middleware que exige usuário autenticado (para endpoints de preferências)
async function requireUser(req, res, next) {
  try {
    if (!User) return res.status(500).json({ error: 'Persistência de usuário indisponível.' });
    const authHeader = req.headers['authorization'] || '';
    const basic = parseBasicAuth(authHeader);
    if (!basic) return res.status(403).json({ error: 'Acesso negado' });
    const user = await User.findOne({ username: basic.username }).exec();
    if (!user) return res.status(403).json({ error: 'Acesso negado' });
    const ok = await bcrypt.compare(basic.password, user.passwordHash);
    if (!ok) return res.status(403).json({ error: 'Acesso negado' });
    req.currentUser = user;
    next();
  } catch (e) {
    console.error('[requireUser] Erro:', e);
    res.status(500).json({ error: 'Erro na verificação do usuário.' });
  }
}

async function setGlobalSystemInstruction(text) {
    if (typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Instrução inválida.');
    }
    const value = text.trim();
    if (Config) {
        await Config.findOneAndUpdate(
            { key: 'systemInstruction' },
            { key: 'systemInstruction', value },
            { upsert: true, new: true }
        );
    } else {
        inMemorySystemInstruction = value;
    }
    return value;
}

// Endpoints de Admin
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const totalConversasPromise = SessaoChat.countDocuments({});
        const ultimasConversasPromise = SessaoChat.find({})
            .sort({ startTime: -1 })
            .limit(5)
            .select({ _id: 1, titulo: 1, startTime: 1, botId: 1 })
            .exec();
        const totalMensagensPromise = SessaoChat.aggregate([
            { $unwind: '$messages' },
            { $count: 'total' }
        ]);

        const [totalConversas, ultimasConversas, totalMensagensAgg] = await Promise.all([
            totalConversasPromise,
            ultimasConversasPromise,
            totalMensagensPromise
        ]);

        const totalMensagens = totalMensagensAgg[0]?.total || 0;

        res.json({
            totalConversas,
            totalMensagens,
            ultimasConversas
        });
    } catch (error) {
        console.error('[Admin] Erro em /api/admin/stats:', error);
        res.status(500).json({ error: 'Erro ao obter estatísticas.' });
    }
});

app.get('/api/admin/system-instruction', requireAdmin, async (req, res) => {
    try {
        const current = await getGlobalSystemInstruction();
        res.json({ systemInstruction: current || '' });
    } catch (error) {
        console.error('[Admin] Erro ao obter system-instruction:', error);
        res.status(500).json({ error: 'Erro ao obter instrução.' });
    }
});

app.post('/api/admin/system-instruction', requireAdmin, async (req, res) => {
    try {
        const { systemInstruction: newInstruction } = req.body || {};
        if (!newInstruction || typeof newInstruction !== 'string') {
            return res.status(400).json({ error: 'systemInstruction (string) é obrigatório.' });
        }
        const saved = await setGlobalSystemInstruction(newInstruction);
        res.json({ message: 'Instrução atualizada com sucesso.', systemInstruction: saved });
    } catch (error) {
        console.error('[Admin] Erro ao salvar system-instruction:', error);
        res.status(500).json({ error: 'Erro ao salvar instrução.' });
    }
});

// Endpoints para preferências do usuário (personalidade)
// GET retorna a instrução de sistema personalizada do usuário autenticado
app.get('/api/user/preferences', requireUser, async (req, res) => {
  try {
    const user = req.currentUser;
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ systemInstruction: user.systemInstruction || '' });
  } catch (error) {
    console.error('[User Prefs] Erro ao obter preferências do usuário:', error);
    res.status(500).json({ error: 'Erro ao obter preferências.' });
  }
});

// PUT atualiza a instrução de sistema personalizada do usuário autenticado
app.put('/api/user/preferences', requireUser, async (req, res) => {
  try {
    const { systemInstruction } = req.body || {};
    if (typeof systemInstruction !== 'string') return res.status(400).json({ error: 'systemInstruction (string) é obrigatório.' });
    const updated = await User.findByIdAndUpdate(req.currentUser._id, { systemInstruction: systemInstruction.trim() }, { new: true }).lean().exec();
    res.json({ message: 'Personalidade salva com sucesso.', systemInstruction: updated.systemInstruction || '' });
  } catch (error) {
    console.error('[User Prefs] Erro ao salvar preferências do usuário:', error);
    res.status(500).json({ error: 'Erro ao salvar preferências.' });
  }
});

// Endpoint protegido para registrar usuários comuns
app.post('/api/user/register', async (req, res) => {
  try {
    if (!User) return res.status(500).json({ error: 'Persistência de usuário indisponível.' });
    const tokenHeader = req.headers['x-bootstrap-token'] || '';
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
    if (!expectedToken) return res.status(500).json({ error: 'ADMIN_BOOTSTRAP_TOKEN não configurado.' });
    if (tokenHeader !== expectedToken) return res.status(403).json({ error: 'Token inválido.' });

    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ error: 'username é obrigatório.' });
    }
    if (typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({ error: 'password deve ter ao menos 6 caracteres.' });
    }

    const normalizedUsername = username.trim();
    const existing = await User.findOne({ username: normalizedUsername }).lean();
    if (existing) return res.status(409).json({ error: 'Usuário já existe.' });

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    await User.create({ username: normalizedUsername, passwordHash });

    res.status(201).json({ message: 'Usuário criado com sucesso.' });
  } catch (error) {
    console.error('[User Register] Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  }
});

// Endpoint para atualizar a senha de admin (requer senha atual)
app.post('/api/admin/password', requireAdmin, async (req, res) => {
    try {
        if (!AdminUser) return res.status(500).json({ error: 'Persistência indisponível.' });
        const { username, newPassword } = req.body || {};
        if (typeof username !== 'string' || !username.trim()) {
            return res.status(400).json({ error: 'Usuário inválido.' });
        }
        if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
            return res.status(400).json({ error: 'Nova senha inválida (mínimo 6 caracteres).' });
        }
        const hash = await bcrypt.hash(newPassword.trim(), 10);
        await AdminUser.findOneAndUpdate(
            { username: username.trim() },
            { username: username.trim(), passwordHash: hash },
            { upsert: true, new: true }
        );
        res.json({ message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        console.error('[Admin] Erro ao atualizar senha:', error);
        res.status(500).json({ error: 'Erro ao atualizar senha.' });
    }
});

// Bootstrap: definir senha inicial de admin uma única vez usando token de implantação
app.post('/api/admin/bootstrap-password', async (req, res) => {
    try {
        if (!AdminUser) return res.status(500).json({ error: 'Persistência indisponível.' });
        const tokenHeader = req.headers['x-bootstrap-token'] || '';
        const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN || '';
        if (!expectedToken) return res.status(500).json({ error: 'ADMIN_BOOTSTRAP_TOKEN não configurado.' });
        if (tokenHeader !== expectedToken) return res.status(403).json({ error: 'Token inválido.' });

        // Impede reexecução se já houver algum usuário admin
        const existing = await AdminUser.findOne({}).lean();
        if (existing) {
            return res.status(409).json({ error: 'Senha de admin já foi configurada.' });
        }

        const { username, newPassword } = req.body || {};
        if (typeof username !== 'string' || !username.trim()) {
            return res.status(400).json({ error: 'Usuário inválido.' });
        }
        if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
            return res.status(400).json({ error: 'Nova senha inválida (mínimo 6 caracteres).' });
        }

        const hash = await bcrypt.hash(newPassword.trim(), 10);
        await AdminUser.create({ username: username.trim(), passwordHash: hash });

        res.json({ message: 'Senha inicial configurada com sucesso. Remova ADMIN_BOOTSTRAP_TOKEN do ambiente.' });
    } catch (error) {
        console.error('[Admin Bootstrap] Erro:', error);
        res.status(500).json({ error: 'Erro ao configurar senha inicial.' });
    }
});

// Endpoint de login para checagem explícita (retorna 200/403)
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (typeof username !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ error: 'Credenciais inválidas.' });
        }
        const ok = await verifyAdminUserPassword(username, password);
        if (!ok) return res.status(403).json({ error: 'Acesso negado' });
        res.json({ message: 'OK' });
    } catch (e) {
        console.error('[Admin Login] Erro:', e);
        res.status(500).json({ error: 'Erro no login.' });
    }
});

// Conexão com MongoDB usando Mongoose
mongoose.connect(process.env.MONGO_HISTORIA)
    .then(() => {
        console.log('Conectado ao MongoDB via Mongoose');
        
        // Iniciar o servidor apenas após conectar ao banco
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            //console.log(`Acesse http://localhost:${PORT} no seu navegador`);
        });
    })
    .catch((err) => {
        console.error('Erro ao conectar ao MongoDB:', err);
        process.exit(1); // Encerra o processo se não conseguir conectar ao banco
    });

let dadosRankingVitrine = [];

app.post('/chat', optionalUserFromAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    console.log("\n--- Nova Mensagem ---");
    console.log("Mensagem do usuário:", message);

    // Detecta perguntas sobre data/hora e responde direto do servidor
    const msgLower = message.trim().toLowerCase();
    
    // Palavras-chave em português para data/hora
    const palavrasDataHoraPT = [
      "que horas são", "qual a hora", "me diga a hora", "me diga as horas",
      "que dia é hoje", "qual a data", "data de hoje", "hora atual", "data atual",
      "horas", "horário", "dia de hoje", "dia atual", "hora agora", "que horas",
      "hora exata", "me diga as horas", "pode me dizer que horas são", "diga a hora",
      "que data e hora", "data e hora", "hora e data", "que dia e hora", "dia e hora",
      "hora e dia", "me diga a data e hora", "me diga a hora e data", "me diga o dia e hora",
      "me diga a hora e dia", "me diga o horário", "me diga o dia", "me diga a data"
    ];

    // Palavras-chave em inglês para data/hora
    const palavrasDataHoraEN = [
      "what time", "what's the time", "tell me the time",
      "what day", "what's the date", "tell me the date",
      "current time", "current date", "what time is it",
      "what day is it", "what's today", "what's the current time"
    ];

    // Palavras-chave para clima
    const palavrasClima = [
      "clima", "tempo", "previsão", "temperatura", "chuva",
      "weather", "forecast", "temperature", "rain", "frio",
      "calor", "umidade", "vento", "nublado", "ensolarado"
    ];

    // Verifica se é uma pergunta sobre clima
    const isClimaQuestion = palavrasClima.some(palavra => msgLower.includes(palavra));

    // Se for pergunta sobre clima, responde diretamente
    if (isClimaQuestion) {
      // Extrai o nome da cidade da mensagem
      const cidadeMatch = msgLower.match(/(?:clima|tempo|previsão|weather|forecast)(?:\s+de|\s+em|\s+para)?\s+([^,.!?]+)/i);
      const cidade = cidadeMatch ? cidadeMatch[1].trim() : null;

      if (!cidade) {
        return res.json({
          response: "Me diga qual cidade você quer saber o clima, meu amor! 💕",
          history: history
        });
      }

      try {
        const weatherData = await getWeather({ location: cidade });
        
        if (weatherData.error) {
          return res.json({
            response: weatherData.error,
            history: history
          });
        }

        // Formata a resposta de forma amigável
        let response = `Em ${weatherData.location} agora está:\n\n`;
        response += `🌡️ Temperatura: ${weatherData.temperature}°C\n`;
        response += `🌤️ ${weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1)}\n`;
        response += `💨 Vento: ${weatherData.windSpeed} km/h\n`;
        response += `💧 Umidade: ${weatherData.humidity}%\n`;
        
        if (weatherData.feelsLike !== weatherData.temperature) {
          response += `🌡️ Sensação térmica: ${weatherData.feelsLike}°C\n`;
        }

        // Sugere uma música baseada no clima
        response += "\nQue tal ouvirmos uma música que combine com esse clima? 🎵 Posso te ajudar a encontrar uma música específica ou explorar um gênero que você goste!";
        
        return res.json({
          response: response,
          history: history
        });
      } catch (error) {
        console.error("Erro ao obter clima:", error);
        return res.json({
          response: "Desculpe, meu amor! 💕 Não consegui verificar o clima agora. Pode tentar novamente em alguns instantes?",
          history: history
        });
      }
    }

    // Verifica se é uma pergunta sobre data/hora
    const isDataHoraQuestion = palavrasDataHoraPT.some(q => msgLower.includes(q)) ||
                             palavrasDataHoraEN.some(q => msgLower.includes(q));

    // Verifica se a mensagem é uma pergunta
    const isQuestion = msgLower.includes("?") || 
                      msgLower.startsWith("what") || 
                      msgLower.startsWith("que") || 
                      msgLower.startsWith("qual") ||
                      msgLower.startsWith("me diga") ||
                      msgLower.startsWith("tell me");

    // Verifica se a mensagem contém menção a getCurrentTime ou aguardando execução
    const contemMencaoGetCurrentTime = msgLower.includes("getcurrenttime") || 
                                     msgLower.includes("aguardando execução") ||
                                     msgLower.includes("awaiting execution");

    if ((isDataHoraQuestion && isQuestion) || contemMencaoGetCurrentTime) {
      const timeData = getCurrentTime();
      const isDataQuestion = msgLower.includes("dia") || msgLower.includes("data") || 
                           msgLower.includes("date") || msgLower.includes("day");
      const isHoraQuestion = msgLower.includes("hora") || msgLower.includes("horário") || 
                           msgLower.includes("time") || msgLower.includes("hour");
      
      let response = "";
      if (isDataQuestion && isHoraQuestion) {
        response = `Olá! 😊\n\nAgora são:\n${timeData.currentTime} 🕒`;
      } else if (isDataQuestion) {
        response = `Olá! 😊\n\nHoje é:\n${timeData.dayOfWeek}, ${timeData.dayOfMonth} de ${timeData.month} de ${timeData.year} 📅`;
      } else {
        response = `Olá! 😊\n\nAgora são:\n${timeData.hours}:${timeData.minutes.toString().padStart(2, '0')}:${timeData.seconds.toString().padStart(2, '0')} 🕒`;
      }
      
      // Adiciona uma resposta mais amigável e musical com mais espaçamento
      response += "\n\n--------------------\n\nQue tal ouvirmos uma música para celebrar esse momento? 🎵\nPosso te ajudar a encontrar uma música específica ou explorar um gênero que você goste! 🎸";
      
      return res.json({
        response: response,
        history: history
      });
    }

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{
        functionDeclarations: functionDeclarations
      }],
      generation_config: { 
        temperature: 0.7,
        top_p: 0.8,
        top_k: 40
      },
    });

    // Determina a instrução correta respeitando a hierarquia Usuário > Global > Default
    let resolvedSystemInstruction = defaultSystemInstruction;
    try {
      const globalInstruction = await getGlobalSystemInstruction();
      if (typeof globalInstruction === 'string' && globalInstruction.trim()) {
        resolvedSystemInstruction = globalInstruction.trim();
      }
      const userInstruction = req.currentUser?.systemInstruction;
      if (typeof userInstruction === 'string' && userInstruction.trim()) {
        resolvedSystemInstruction = userInstruction.trim();
      }
    } catch (instructionError) {
      console.error('[SystemInstruction] Erro ao resolver instrução:', instructionError);
    }

    // Força o modelo a responder em português (usar role 'system' para maior prioridade)
    const languageInstruction = {
      role: 'system',
      parts: [{ text: 'Você DEVE responder SEMPRE em português do Brasil, de forma amigável e informal, como se estivesse conversando com um amigo.' }]
    };

    const systemMessages = [];
    if (resolvedSystemInstruction && resolvedSystemInstruction.trim()) {
      systemMessages.push({
        role: 'system',
        parts: [{ text: resolvedSystemInstruction.trim() }]
      });
    }
    systemMessages.push(languageInstruction);

    // Inicializa o chat já com as instruções de sistema aplicadas
    const chat = model.startChat({
      history: systemMessages,
      generationConfig: {
        temperature: 0.7,
        top_p: 0.8,
        top_k: 40
      },
    });

    // Adiciona cada mensagem do histórico sequencialmente
    if (history && history.length > 0) {
      for (const msg of history) {
        try {
          const text = typeof msg === 'string' ? msg :
                      msg.message || msg.text ||
                      (msg.parts && msg.parts[0] && msg.parts[0].text) ||
                      JSON.stringify(msg);
          
          await chat.sendMessage(text);
        } catch (historyError) {
          console.error("Erro ao processar mensagem do histórico:", historyError);
          // Continua mesmo se houver erro em uma mensagem do histórico
        }
      }
    }

    let currentApiRequestContents = message;
    let modelResponse;
    let loopCount = 0;
    const MAX_FUNCTION_CALL_LOOPS = 5;

    while (loopCount < MAX_FUNCTION_CALL_LOOPS) {
      loopCount++;
      console.log(`[CHAT_LOOP ${loopCount}] Enviando para o modelo. Tipo do input: ${typeof currentApiRequestContents}`);

      let result;
      try {
        result = await chat.sendMessage(currentApiRequestContents);
      } catch (sdkError) {
        console.error(`[SDK_ERROR] Erro ao chamar chat.sendMessage na iteração ${loopCount}:`, sdkError);
        console.error("[SDK_ERROR] Stack:", sdkError.stack);
        const errorResponseText = sdkError.message || "Ocorreu um erro ao comunicar com a IA.";
        const currentHistory = await chat.getHistory();
        return res.status(500).json({ response: errorResponseText, history: currentHistory, error: "SDK Error" });
      }
      
      if (!result || !result.response) {
        console.error(`[PANIC_RESPONSE] result ou result.response está undefined/null após sendMessage na iteração ${loopCount}.`);
        console.error("[PANIC_RESPONSE] Conteúdo de result:", JSON.stringify(result, null, 2));
        const historySoFar = await chat.getHistory();
        return res.status(500).json({ response: "Erro crítico: A IA não retornou uma resposta válida.", history: historySoFar, error: "Invalid AI Response" });
      }

      modelResponse = result.response;
      
      // Verifica se a resposta do modelo contém menção a getCurrentTime
      let responseText = "";
      if (modelResponse && typeof modelResponse.text === 'function') {
        responseText = modelResponse.text();
      } else if (modelResponse && modelResponse.candidates && modelResponse.candidates[0]?.content?.parts) {
        responseText = modelResponse.candidates[0].content.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join("");
      }

      // Se a resposta contém menção a getCurrentTime, substitui pela data/hora atual
      if (responseText.toLowerCase().includes("getcurrenttime") || 
          responseText.toLowerCase().includes("aguardando execução") ||
          responseText.toLowerCase().includes("awaiting execution")) {
        const timeData = getCurrentTime();
        responseText = `Agora são ${timeData.currentTime} 🕒\n\nQue tal ouvirmos uma música para celebrar esse momento? 🎵 Posso te ajudar a encontrar uma música específica ou explorar um gênero que você goste!`;
        return res.json({
          response: responseText,
          history: history
        });
      }

      // Verifica se há chamadas de função na resposta
      const functionCalls = modelResponse.functionCalls?.() || [];
      
      if (!functionCalls || functionCalls.length === 0) {
        console.log(`[CHAT_LOOP ${loopCount}] Nenhuma chamada de função pendente nesta resposta.`);
        break;
      }

      console.log(`[CHAT_LOOP ${loopCount}] Chamadas de função requisitadas:`, JSON.stringify(functionCalls, null, 2));

      const functionExecutionResponses = [];
      for (const call of functionCalls) {
        const functionToCall = availableFunctions[call.name];
        if (functionToCall) {
          try {
            console.log(`[FUNC_EXEC] Executando: ${call.name}, Args:`, call.args);
            const functionResultData = await functionToCall(call.args);
            console.log(`[FUNC_EXEC] Resultado de ${call.name}:`, JSON.stringify(functionResultData).substring(0,200) + "...");
            functionExecutionResponses.push({
              functionResponse: { 
                name: call.name, 
                response: functionResultData 
              }
            });
          } catch (funcError) {
            console.error(`[FUNC_ERROR] Erro ao executar ${call.name}:`, funcError);
            functionExecutionResponses.push({
              functionResponse: { 
                name: call.name, 
                response: { error: `Erro interno ao executar ${call.name}: ${funcError.message}` } 
              }
            });
          }
        } else {
          console.error(`[FUNC_ERROR] Função ${call.name} não implementada.`);
          functionExecutionResponses.push({
            functionResponse: { 
              name: call.name, 
              response: { error: "Função não implementada no servidor." } 
            }
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
      responseText = modelResponse.candidates[0].content.parts
        .filter(part => part.text)
        .map(part => part.text)
        .join("");
    } else {
      console.error("[TEXT_EXTRACTION_FAIL] Não foi possível obter texto final de modelResponse.");
      responseText = "Desculpe, tive um problema ao gerar a resposta final.";
    }

    console.log("[FINAL_RESPONSE] Texto para o usuário:", responseText.substring(0,300) + "...");

    const updatedHistory = await chat.getHistory();

    res.json({
      response: responseText,
      history: updatedHistory,
    });

  } catch (error) {
    console.error("===== ERRO GERAL NA ROTA /chat =====");
    console.error("Mensagem do Erro:", error.message);
    console.error("Stack Trace do Erro:", error.stack);
    
    let errorHistory = req.body.history || [];
    try {
      if (typeof chat !== 'undefined' && chat && typeof chat.getHistory === 'function') {
        errorHistory = await chat.getHistory();
      }
    } catch (historyError) {
      console.error("Erro ao tentar obter histórico durante o tratamento de erro:", historyError.message);
    }

    res.status(500).json({
      response: `Desculpe, ocorreu um erro interno no servidor: ${error.message}. Por favor, tente novamente.`,
      history: errorHistory,
      error: error.message || "Erro desconhecido"
    });
  }
});

app.post('/api/log-connection', async (req, res) => {
    try {
        const { ip, acao } = req.body;
        const nomeBot = "IFCODE SuperBot"; // Troque para o nome do seu bot!

        if (!ip || !acao) {
            return res.status(400).json({ error: "Dados de log incompletos (IP e ação são obrigatórios)." });
        }

        const agora = new Date();
        const dataFormatada = agora.toISOString().split('T')[0]; // YYYY-MM-DD
        const horaFormatada = agora.toTimeString().split(' ')[0]; // HH:MM:SS

        await Log.create({
            col_data: dataFormatada,
            col_hora: horaFormatada,
            col_IP: ip,
            col_nome_bot: nomeBot,
            col_acao: acao
        });

        res.status(201).json({ message: "Log registrado com sucesso." });
    } catch (error) {
        console.error("[Servidor] Erro ao registrar log:", error);
        res.status(500).json({ error: "Erro ao registrar log." });
    }
});

app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot, timestampAcesso, usuarioId } = req.body;

    if (!botId || !nomeBot) {
        return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios para o ranking." });
    }

    const acesso = {
        botId,
        nomeBot,
        usuarioId: usuarioId || 'anonimo',
        acessoEm: timestampAcesso ? new Date(timestampAcesso) : new Date(),
        contagem: 1
    };

    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);
    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = acesso.acessoEm;
    } else {
        dadosRankingVitrine.push({
            botId: botId,
            nomeBot: nomeBot,
            contagem: 1,
            ultimoAcesso: acesso.acessoEm
        });
    }

    console.log('[Servidor] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado para ranking.` });
});

app.get('/api/ranking/visualizar', (req, res) => {
    // Ordena do maior para o menor
    const rankingOrdenado = [...dadosRankingVitrine].sort((a, b) => b.contagem - a.contagem);
    res.json(rankingOrdenado);
});

// Inicialização da API Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Troque para um modelo suportado pela sua conta/projeto:
const modelName = 'gemini-2.5-flash';

// Função para obter a hora atual - Garantindo o fuso horário brasileiro
function getCurrentTime() {
  console.log("⏰ Executando getCurrentTime");
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

  // Formata a hora com zeros à esquerda quando necessário
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');

  const formattedDateTime = `${dayOfWeek}, ${day} de ${monthName} de ${year}, ${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

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
    return { error: "Desculpe, não consigo verificar o clima no momento. Tente novamente mais tarde." };
  }
  if (!location) {
    console.warn("Localização não fornecida para getWeather. Retornando erro amigável.");
    return { error: "Por favor, me diga qual cidade você quer saber o clima." };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric&lang=pt_br`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    
    // Formata a resposta de forma mais amigável
    return {
      location: data.name,
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // Converte m/s para km/h
      feelsLike: Math.round(data.main.feels_like),
      icon: data.weather[0].icon
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

let defaultSystemInstruction = `Você é o Chatbot Musical, um assistente virtual brasileiro especializado em música.
IMPORTANTE: Você DEVE SEMPRE responder em português do Brasil, usando linguagem informal e amigável.
Você deve responder principalmente sobre temas relacionados à música, mantendo um tom alegre e acolhedor.
Você tem acesso às seguintes funções:
- getCurrentTime: Para informar a hora e data atuais no Brasil (horário de Brasília).
- getWeather: Para verificar o clima em uma cidade (você pode relacionar com músicas sobre o clima ou humor).
- searchSong: Para buscar informações sobre músicas específicas.

REGRAS IMPORTANTES:
1. Quando o usuário perguntar sobre a hora atual, data atual, ou fazer perguntas como "que horas são?", "que dia é hoje?", VOCÊ DEVE SEMPRE usar a função getCurrentTime. NUNCA responda que não tem acesso a essas informações.
2. NUNCA responda perguntas sobre data ou hora usando seu próprio conhecimento ou informações antigas. Sempre utilize o resultado da função getCurrentTime.
3. Se você responder sobre data/hora sem usar a função, estará ERRADO. Exemplo de resposta ERRADA: "Não tenho acesso a informações em tempo real". Exemplo de resposta CERTA: (resultado da função getCurrentTime).
4. Após informar a hora/data, você pode fazer uma conexão com alguma curiosidade musical relacionada.
5. Seja amigável e entusiasmado sobre música! Use emojis musicais (🎵, 🎸, 🎹) quando apropriado.
6. Se não souber uma resposta, seja honesto.
7. Use as funções quando relevante para enriquecer a conversa. É OBRIGATÓRIO usar getCurrentTime para perguntas sobre data/hora.
8. Se o usuário pedir ajuda, sugira temas musicais ou funcionalidades que você oferece.
9. NUNCA mencione o nome das funções em suas respostas. Apenas use-as e forneça as informações solicitadas de forma natural.
10. Para perguntas sobre clima, use a função getWeather e responda de forma natural, sem mencionar a função.`;


// Adiciona instruções iniciais
/*formattedHistory.unshift(
  {
    role: 'system',
    parts: [{ text: systemInstruction }]
  },
  {
    role: 'system',
    parts: [{ text: 'Você DEVE responder SEMPRE em português do Brasil, de forma amigável e informal, como se estivesse conversando com um amigo.' }]
  }
)*/

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

async function registrarAcessoBotParaRanking(botId, nomeBot) {
    const dataRanking = {
        botId: botId,
        nomeBot: nomeBot,
        timestampAcesso: new Date().toISOString()
    };
    await fetch('/api/ranking/registrar-acesso-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataRanking)
    });
}

app.post('/api/chat/salvar-historico', async (req, res) => {
    try {
        const { sessionId, userId, botId, startTime, endTime, messages } = req.body;

        if (!sessionId || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: "Dados incompletos para salvar histórico (sessionId e messages são obrigatórios)." });
        }

        // Formatar as mensagens para garantir estrutura correta
        const formattedMessages = messages.map(msg => ({
            role: msg.role || (msg.isUser ? 'user' : 'assistant'),
            parts: [{
                text: msg.message || msg.text || msg.parts?.[0]?.text || msg
            }]
        }));

        const novaSessao = new SessaoChat({
            sessionId,
            userId: userId || 'anonimo',
            botId: botId || 'IFCODE SuperBot',
            startTime: startTime ? new Date(startTime) : new Date(),
            endTime: endTime ? new Date(endTime) : new Date(),
            messages: formattedMessages
        });

        await novaSessao.save();

        console.log('[Servidor] Histórico de sessão salvo:', novaSessao._id);
        res.status(201).json({ message: "Histórico de chat salvo com sucesso!", sessionId: novaSessao.sessionId });

    } catch (error) {
        console.error("[Servidor] Erro em /api/chat/salvar-historico:", error.message);
        res.status(500).json({ error: "Erro interno ao salvar histórico de chat." });
    }
});

async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
    try {
        const backendUrl = 'https://chatbot-dny3.onrender.com';
        
        // Formatar as mensagens para garantir estrutura correta
        const formattedMessages = messages.map(msg => ({
            role: msg.role || (msg.isUser ? 'user' : 'assistant'),
            parts: [{
                text: msg.message || msg.text || msg.parts?.[0]?.text || msg
            }]
        }));

        const payload = {
            sessionId,
            botId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            messages: formattedMessages
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
            console.log("Histórico de sessão enviado:", result.message);
        }
    } catch (error) {
        console.error("Erro ao enviar histórico de sessão:", error);
    }
}

// Endpoint para excluir uma sessão de chat
app.delete('/api/chat/historicos/:id', async (req, res) => {
    try {
        console.log('Tentando excluir documento com ID:', req.params.id);
        const result = await SessaoChat.findByIdAndDelete(req.params.id);
        
        console.log('Resultado da exclusão:', result);
        
        if (!result) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }
        
        res.json({ message: "Histórico excluído com sucesso." });
    } catch (error) {
        console.error("[Servidor] Erro ao excluir histórico:", error);
        res.status(500).json({ error: "Erro interno ao excluir histórico de chat." });
    }
});

// Endpoint para gerar título para uma sessão
app.post('/api/chat/historicos/:id/gerar-titulo', async (req, res) => {
    try {
        console.log('Tentando gerar título para documento com ID:', req.params.id);
        const sessao = await SessaoChat.findById(req.params.id);
        
        if (!sessao) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }

        // Formata o histórico da conversa para a IA
        const mensagens = [];
        sessao.messages.forEach(msg => {
            if (msg.role === 'user') {
                mensagens.push(`Usuário: ${msg.parts[0].text}`);
            } else if (msg.role === 'model') {
                mensagens.push(`Bot: ${msg.parts[0].text}`);
            }
        });

        const historicoFormatado = mensagens.join("\n");
        console.log('Histórico formatado:', historicoFormatado);

        // Gera o título usando a API Gemini
        const model = genAI.getGenerativeModel({ model: modelName });
        const prompt = `Com base nesta conversa, sugira um título curto e conciso de no máximo 5 palavras que capture o tema principal do diálogo:\n\n${historicoFormatado}`;
        
        console.log('Enviando prompt para Gemini:', prompt);
        const result = await model.generateContent(prompt);
        const titulo = result.response.text();
        console.log('Título gerado:', titulo);

        res.json({ titulo: titulo.trim() });
    } catch (error) {
        console.error("[Servidor] Erro ao gerar título:", error);
        res.status(500).json({ error: "Erro interno ao gerar título: " + error.message });
    }
});

// Endpoint para atualizar o título de uma sessão
app.put('/api/chat/historicos/:id/:titulo', async (req, res) => {
    try {
        const { titulo } = req.body;
        if (!titulo) {
            return res.status(400).json({ error: "Título não fornecido." });
        }

        const sessao = await SessaoChat.findByIdAndUpdate(
            req.params.id,
            { titulo: req.params.titulo },
            { new: true }
        );

        if (!sessao) {
            return res.status(404).json({ error: "Histórico não encontrado." });
        }

        res.json({ message: "Título atualizado com sucesso." });
    } catch (error) {
        console.error("[Servidor] Erro ao atualizar título:", error);
        res.status(500).json({ error: "Erro interno ao atualizar título: " + error.message });
    }
});

app.get('/api/chat/historicos', async (req, res) => {
    try {
        const historicos = await SessaoChat.find({})
            .sort({ startTime: -1 })
            .limit(10)
            .exec();
        
        console.log(`[Servidor] Buscados ${historicos.length} históricos de chat`);
        res.json(historicos);
        
    } catch (error) {
        console.error("[Servidor] Erro ao buscar históricos:", error);
        res.status(500).json({ error: "Erro interno ao buscar históricos de chat." });
    }
});

// Endpoint administrativo que agrega métricas para o dashboard
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Palavras-chave indicativas de respostas fracas/inconclusivas do bot
    const failureKeywords = [
      'não entendi',
      'não posso ajudar',
      'não sei',
      'não tenho acesso',
      'desculpe',
      'não consigo',
      'pode reformular',
      'not sure',
      'i don\'t know'
    ];

    // 1) Profundidade de Engajamento: média de mensagens + contagem curt/long
    const engagementAgg = await SessaoChat.aggregate([
      { $project: { numeroDeMensagens: { $size: { $ifNull: ['$messages', []] } }, userId: 1 } },
      { $group: {
        _id: null,
        duracaoMedia: { $avg: '$numeroDeMensagens' },
        totalConversas: { $sum: 1 },
        conversasCurtas: { $sum: { $cond: [ { $lte: ['$numeroDeMensagens', 3] }, 1, 0 ] } },
        conversasLongas: { $sum: { $cond: [ { $gt: ['$numeroDeMensagens', 3] }, 1, 0 ] } }
      } }
    ]).exec();

    const engagement = (engagementAgg && engagementAgg[0]) ? engagementAgg[0] : { duracaoMedia: 0, totalConversas: 0, conversasCurtas: 0, conversasLongas: 0 };

    // 2) Lealdade do Usuário: Top 5 usuários por número de sessões
    const topUsuarios = await SessaoChat.aggregate([
      { $group: { _id: '$userId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]).exec();

    // 3) Análise de Falhas: buscar trechos recentes onde o bot usou frases de falha
    // Vamos buscar nas últimas 200 sessões para produtividade
    const recentSessions = await SessaoChat.find({}).sort({ startTime: -1 }).limit(200).lean().exec();

    const conversasComFalha = [];
    for (const sessao of recentSessions) {
      if (!sessao.messages || !Array.isArray(sessao.messages)) continue;

      for (let i = 0; i < sessao.messages.length; i++) {
        const msg = sessao.messages[i];
        if (msg.role === 'model') {
          const text = (msg.parts && msg.parts[0] && msg.parts[0].text) ? String(msg.parts[0].text).toLowerCase() : '';
          if (failureKeywords.some(k => text.includes(k))) {
            // Tentar encontrar a última pergunta do usuário antes desta resposta
            let perguntaUsuario = '';
            for (let j = i - 1; j >= 0; j--) {
              if (sessao.messages[j].role === 'user') {
                perguntaUsuario = sessao.messages[j].parts?.[0]?.text || '';
                break;
              }
            }

            conversasComFalha.push({
              sessionId: sessao._id,
              sessionTitle: sessao.titulo || null,
              userId: sessao.userId || 'anonimo',
              pergunta: perguntaUsuario || null,
              resposta: msg.parts?.[0]?.text || null,
              timestamp: msg.timestamp || sessao.startTime
            });

            // limitar o tamanho do array para não sobrecarregar a resposta
            if (conversasComFalha.length >= 20) break;
          }
        }
      }

      if (conversasComFalha.length >= 20) break;
    }

    res.json({
      duracaoMedia: Math.round((engagement.duracaoMedia || 0) * 100) / 100,
      totalConversas: engagement.totalConversas || 0,
      conversasCurtas: engagement.conversasCurtas || 0,
      conversasLongas: engagement.conversasLongas || 0,
      topUsuarios: topUsuarios.map(u => ({ userId: u._id || 'anonimo', conversas: u.total })),
      conversasComFalha
    });

  } catch (error) {
    console.error('[ADMIN DASHBOARD] Erro ao gerar dashboard:', error);
    res.status(500).json({ error: 'Erro interno ao gerar dashboard.' });
  }
});

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ message: 'Servidor está funcionando!' });
});



// Nota: O servidor será iniciado após a conexão com o MongoDB ser estabelecida