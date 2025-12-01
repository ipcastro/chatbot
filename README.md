# 🎵 Chatbot Musical - A Vitrine Profissional

> **Seu Assistente Musical Inteligente com IA Adaptativa, Painel de Análise Avançado e Personalização em Tempo Real**

---

## 🎬 Demonstração em Ação

### Interface do Chatbot
```
┌─────────────────────────────────────────────────────────────┐
│         🎵 Chatbot Musical - Seu guia musical virtual        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Escolha a personalidade do chatbot:                         │
│  [👨‍🏫 Professor] [🎧 DJ Animado] [🎭 Crítico] [🎼 Compositor]  │
│  [📚 Historiador]                                             │
│                                                               │
│  💬 Conversa em tempo real                                    │
│  📚 Histórico persistente                                     │
│  🎭 5 Personalidades diferentes                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Painel de Administração - Sala de Guerra de Dados
```
┌──────────────────────────────────────────────────────────────┐
│        Dashboard do Administrador - Inteligência em Ação      │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  📊 Profundidade de Engajamento                               │
│     • Duração média: 5.2 mensagens                            │
│     • Conversas curtas: 12  |  Conversas longas: 38          │
│                                                                │
│  👥 Lealdade do Usuário (Top 5)                               │
│     1. usuario_alpha — 45 conversas                           │
│     2. usuario_beta — 38 conversas                            │
│     ...                                                        │
│                                                                │
│  ⚠️  Análise de Falhas                                        │
│     • Respostas inconclusivas: 8                              │
│     • Últimos trechos com falha: [detalhes]                   │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## ✨ Features Principais

- 🎭 **Personalização Adaptativa de IA**
  - 5 personalidades distintas: Professor, DJ, Crítico, Compositor, Historiador
  - Cada personalidade tem instruções de sistema únicas
  - Seleção salva em tempo real no navegador

- 📊 **Painel de Administração Avançado** (Sala de Guerra de Dados)
  - Dashboard com métricas de engajamento em tempo real
  - Detecção automática de falhas do bot com análise de padrões
  - Ranking de usuários mais ativos (Top 5)
  - Análise de profundidade de conversas (curtas vs. longas)

- 💾 **Histórico Inteligente de Conversas**
  - Armazenamento persistente em MongoDB
  - Geração automática de títulos por IA
  - Capacidade de renomear e deletar conversas
  - Visualização detalhada de diálogos anteriores

- 🌐 **Integração com APIs Externas**
  - **Google Gemini 2.5 Flash**: IA generativa de última geração
  - **OpenWeather**: Informações climáticas em tempo real
  - **Last.fm**: Busca e recomendação de músicas

- 🔧 **Funções Auxiliares Inteligentes**
  - `getCurrentTime()`: Retorna hora/data exata do Brasil (fuso Brasília)
  - `getWeather()`: Clima em qualquer cidade com detalhes completos
  - `searchSong()`: Busca de músicas e artistas com informações

- 🛡️ **Segurança e Autenticação**
  - Autenticação Admin com Basic Auth
  - Criptografia de senhas com bcryptjs
  - Endpoints protegidos para operações críticas

- 📱 **Design Responsivo e Moderno**
  - Interface elegante com gradientes e glassmorphism
  - Suporte completo para mobile, tablet e desktop
  - Animações fluidas e feedback visual em tempo real

---

## 🚀 Tech Stack

| Tecnologia | Descrição |
|-----------|-----------|
| **Node.js** | Runtime JavaScript do servidor |
| **Express** | Framework web para APIs REST |
| **MongoDB** | Banco de dados NoSQL escalável |
| **Mongoose** | ODM (Object Data Modeling) para MongoDB |
| **Google Gemini 2.5** | IA generativa de última geração |
| **JavaScript (ES6+)** | Linguagem de programação moderna |
| **bcryptjs** | Hash seguro de senhas |
| **Axios** | Cliente HTTP para requisições |
| **OpenWeather API** | Serviço de informações climáticas |
| **Last.fm API** | Serviço de dados musicais |

---

## 🎯 Links para Demo

### 🌐 Frontend (Chat Interativo)
**[🚀 Acesse o Chat Agora!](https://chatbot-dny3.onrender.com)**
- Acesso livre - comece a conversar agora!
- Chat em tempo real com 5 personalidades
- Histórico de conversas
- Seleção de personalidades

### ⚙️ Backend (APIs)
**[📡 Base URL: https://chatbot-dny3.onrender.com](https://chatbot-dny3.onrender.com)**
- Status: ✅ Ativo e operacional
- Endpoints RESTful para:
  - `POST /chat` - Enviar mensagem
  - `GET /api/chat/historicos` - Histórico
  - `GET /api/admin/dashboard` - Métricas
  - `GET/PUT /api/user/preferences` - Preferências

### 🔐 Painel Admin
**[🔑 Painel Administrativo](https://chatbot-dny3.onrender.com/admin.html)**
- Autenticação: Basic Auth
- Funcionalidades: 
  - Métricas de engajamento em tempo real
  - Análise de falhas do bot
  - Configuração global de system instruction
  - Ranking de usuários mais ativos

---

## 📦 Instalação Local

### Pré-requisitos
- Node.js v14+
- npm ou yarn
- MongoDB (local ou Atlas)
- API Keys necessárias:
  - Google Gemini API
  - OpenWeather API (opcional)
  - Last.fm API (opcional)

### Passos

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/chatbot-musical.git
cd chatbot-musical

# 2. Instale dependências
npm install

# 3. Configure variáveis de ambiente (.env)
MONGO_HISTORIA=mongodb+srv://user:pass@cluster.mongodb.net/chatbot
GEMINI_API_KEY=your_gemini_api_key
OPENWEATHER_API_KEY=your_weather_api_key
LASTFM_API_KEY=your_lastfm_api_key
ADMIN_BOOTSTRAP_TOKEN=your_bootstrap_token
PORT=3001

# 4. Inicie o servidor
npm start

# 5. Acesse no navegador
# Frontend: http://localhost:3001
# Admin: http://localhost:3001/admin.html
```

---

## 🏗️ Arquitetura do Projeto

```
chatbot-musical/
│
├── 📄 server.js                    # Servidor Express principal
├── 📄 .env                         # Variáveis de ambiente
│
├── 📁 models/
│   ├── SessaoChat.js              # Schema para histórico de chats
│   ├── AdminUser.js               # Schema para usuários admin
│   └── User.js                    # Schema para preferências de usuários
│
├── 📁 public/
│   ├── index.html                 # Interface principal do chat
│   ├── admin.html                 # Painel administrativo
│   ├── script.js                  # Lógica do chat (cliente)
│   ├── admin.js                   # Lógica do painel admin
│   ├── personalities.js           # Gerenciamento de personalidades
│   ├── styles.css                 # Estilos principais
│   ├── personality-styles.css     # Estilos das personalidades
│   └── history-modal.css          # Estilos do histórico
│
└── 📄 README.md                   # Este arquivo
```

---

## 🎓 Casos de Uso

### Para Usuários Finais
✅ Conversar sobre música em diferentes estilos e especialidades
✅ Selecionar 5 personalidades diferentes para diferentes contextos
✅ Manter histórico de conversas com títulos gerados automaticamente
✅ Buscar informações sobre músicas, artistas e tendências
✅ Obter recomendações musicais personalizadas

### Para Administradores
✅ Monitorar engajamento de usuários em tempo real
✅ Identificar automaticamente falhas e pontos fracos do bot
✅ Ajustar instruções globais do sistema
✅ Analisar padrões de uso e comportamento
✅ Tomar decisões estratégicas baseadas em dados (Business Intelligence)

---

## 📊 Plano de Melhorias Baseado em Dados

### 1️⃣ Reduzir Respostas Inconclusivas sobre Temas Específicos

**Observação**: O widget "Análise de Falhas" mostra uma concentração de falhas sobre determinados temas (ex: preços, disponibilidade).

**Ação Proposta**: 
- Atualizar a `systemInstruction` para incluir guias de resposta específicos
- Adicionar dados complementares (FAQ) que o bot possa consultar
- Treinar o modelo com exemplos de respostas melhores

**Impacto Esperado**: ↓ 40% de respostas inconclusivas em 2 semanas

---

### 2️⃣ Melhorar Engajamento para Conversas Curtas

**Observação**: "Duração Média" é baixa e muitas conversas são curtíssimas (≤3 mensagens).

**Ação Proposta**:
- Ajustar a abertura do bot com sugestões de tópicos interativos
- Implementar prompts envolventes (ex: "Posso procurar uma música, dar recomendações ou mostrar tendências — o que prefere?")
- Testar variações A/B na `systemInstruction` para maximizar engajamento

**Impacto Esperado**: ↑ 50% na duração média de conversas

---

## 🔄 Ciclo de Melhoria Contínua (Build → Measure → Learn → Repeat)

```
┌─────────────┐
│  Construir  │  ← Criar features e melhorias
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Medir     │  ← Dashboard coleta métricas em tempo real
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Aprender   │  ← Analisar insights e padrões
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Repetir   │  ← Implementar melhorias baseadas em dados
└──────┬──────┘
       │
       └─────→ (volta para Construir)
```

**Este ciclo nunca termina** — é o que separa produtos bons de produtos incríveis! 🚀

---

## 🤝 Contribuindo

Sugestões de melhorias e pull requests são bem-vindos! Para mudanças maiores:

1. Abra uma issue descrevendo a mudança
2. Faça um fork do projeto
3. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
4. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
5. Push para a branch (`git push origin feature/AmazingFeature`)
6. Abra um Pull Request

---

## 📄 Licença

ISC - Livre para usar, modificar e distribuir

---

## 👨‍💻 Desenvolvido com ❤️

**🎵 Chatbot Musical**

_Transformando Dados em Decisões Estratégicas_

**Stack Moderna** | **IA Adaptativa** | **Análise Avançada em Tempo Real**

---

**Última atualização**: Dezembro 2025 ✨
**Status**: ✅ Ativo e em desenvolvimento contínuo