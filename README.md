# Chatbot com API Gemini

Este é um chatbot simples desenvolvido usando a API Gemini do Google. O chatbot é especializado em responder perguntas sobre tecnologia, programação e desenvolvimento.

## Pré-requisitos

- Node.js instalado
- NPM instalado
- Uma API Key do Google AI Studio

## Instalação

1. Clone este repositório ou baixe os arquivos
2. Instale as dependências:
```bash
npm install
```

3. Configure sua API Key:
   - Abra o arquivo `index.js`
   - Substitua "SUA_API_KEY_AQUI" pela sua API Key do Google AI Studio

## Como usar

1. Execute o chatbot:
```bash
node index.js
```

2. Digite suas perguntas no prompt
3. Para sair, digite 'sair'

## Funcionalidades

- Chat interativo em tempo real
- Configurações de segurança implementadas
- Histórico de conversa mantido
- Respostas especializadas em tecnologia

## Configurações

O chatbot está configurado com os seguintes parâmetros:
- Modelo: gemini-pro
- Temperatura: 0.7
- Máximo de tokens: 200
- Configurações de segurança para bloquear conteúdo inadequado

## Licença

ISC 