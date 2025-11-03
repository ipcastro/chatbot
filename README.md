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

## Plano de Melhorias Baseado em Dados

Após adicionar o Painel de Guerra (dashboard) no admin, você terá métricas acionáveis. Abaixo estão duas ações concretas que podem ser tomadas com base nas novas métricas:

1) Reduzir respostas inconclusivas sobre temas específicos
- Observação: Se o widget "Análise de Falhas" mostrar uma concentração de falhas sobre um tema (ex: preços, disponibilidade de produto), atualizar a `systemInstruction` para incluir guias de resposta ou roteiros sobre esse tema, ou adicionar dados complementares (FAQ) que o bot possa consultar.

2) Melhorar engajamento para conversas curtas
- Observação: Se a "Duração Média" for baixa e muitas conversas forem curtíssimas (≤3 mensagens), considere ajustar a abertura do bot (prompts iniciais) para sugerir tópicos ou opções (ex: "Posso procurar uma música, dar recomendações ou mostrar as últimas tendências — o que prefere?"). Teste variações A/B na `systemInstruction` para mensurar impacto.

Essas são sugestões iniciais — o ciclo ideal é: medir (dashboard), agir (ajustes na instrução ou fluxos), e reavaliar (verificar métricas após deploy).