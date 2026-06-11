# VEXX AI Operating System & Copilot v2

Uma plataforma integrada de agentes de IA autônomos para mídias sociais (Instagram e WhatsApp) conectada a uma arena de debate multi-modelo local, equipada com análise visual de tela (RPA), scraping estruturado e memória de longo prazo.

---

## 🚀 Funcionalidades

### 1. 🤖 Visual Operator & Browser RPA (Computer Use)
* **Visual Grounding**: Executa ações de clique e digitação baseadas em coordenadas espaciais `[x, y]` e seletores CSS.
* **Drag-Drop**: Permite arrastar e soltar elementos para ajustar o posicionamento de adesivos, templates e controles de mídias na tela.
* **Execução Segura**: Cartões interativos de execução de macro no chat dão controle total ao usuário antes de alterar a tela.

### 2. 🔬 Context Engine & Análise Visual
* **Leitura Profunda**: Extrai seguidores, dados demográficos, curtidas, e bios do Instagram de forma desacoplada de idiomas e classes mutáveis.
* **Auditoria Passo a Passo**: O Copilot rola a tela suavemente (`SCROLL_PAGE`), analisa cada parte da página usando IAs multimodais, e consolida um plano de ação tático de conversão em 5 pontos.

### 3. 💬 Arena de Debate Multi-Modelo
* Coloca múltiplos modelos (Gemini, Claude, GPT, Groq, Cohere) para conversar e debater as melhores estratégias antes de sintetizar uma sugestão ao usuário.
* Integrada à memória do sistema para recuperar interações passadas e dar respostas contextuais.

### 4. 🧠 Sistema de Memória Persistente (RAG Local)
* Armazena histórico de conversas, perfis de leads visitados, taxas de retorno e hashtags populares localmente usando `chrome.storage.local`.

---

## 🛠️ Tecnologias Utilizadas

* **Frontend**: HTML5, Vanilla CSS3 (glassmorphism UI), Vanilla JavaScript (ES6).
* **Backend**: Node.js, Express, CORS.
* **Desktop Shell**: Electron.
* **Modelos Suportados**: Gemini 2.0/2.5, GPT-4o-mini, Llama 3.3, Claude Sonnet 3.5, Qwen 2.5, Cohere, Cerebras.

---

## 📂 Estrutura de Pastas

```
├── vexx-copilot-extension/    # Extensão do Google Chrome
│   ├── manifest.json          # Manifesto da Extensão (v3)
│   ├── content.js             # Script de conteúdo (RPA/AutomationEngine)
│   ├── sidebar.html           # Interface da barra lateral (glassmorphism)
│   ├── sidebar.js             # Controlador da interface
│   ├── visual-audit.js        # Fluxo de auditoria de tela
│   ├── arena-chat.js          # Chat e debate na arena
│   └── context-engine.js      # Extrator profundo de DOM (Instagram/WhatsApp)
├── routes/                    # Rotas Express do Servidor Local
│   ├── chat.js                # Proxy/orquestrador de LLMs
│   ├── terminal.js            # Interface de comando (Guardrails UABL)
│   └── scheduler.js           # Agendador de tarefas automatizadas
├── lib/                       # Bibliotecas e Middleware
│   ├── uabl_context.js        # Contexto UABL
│   └── uabl_guardrails.js     # Regras de segurança de execução
├── server.js                  # Servidor Express Local (Porta 3000)
└── package.json               # Configurações e scripts npm
```

---

## 📦 Instalação e Execução

### Pré-requisitos
* Node.js v18+ instalado.
* Google Chrome.

### 1. Iniciar o Servidor Local
Clone o repositório, instale as dependências e inicie o servidor:
```bash
npm install
npm run dev
```
O servidor estará ativo em `http://localhost:3000`.

### 2. Configurar a Extensão no Chrome
1. Abra o Chrome e vá em `chrome://extensions/`.
2. Ative o **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação** (Load unpacked) e selecione a pasta `vexx-copilot-extension`.
4. Abra o Instagram Web e o Copilot aparecerá automaticamente na lateral direita.

---

## 🛡️ Segurança e Guardrails (UABL)
Para evitar execuções acidentais ou destrutivas de comandos pela IA, o sistema inclui um módulo de segurança chamado **UABL (User Action Boundary Layer)**:
* **Níveis de Risco**: As ações são classificadas de `SAFE` a `CRITICAL`.
* **Aprovação Necessária**: Comandos que alteram arquivos ou enviam mensagens exigem aprovação explícita do usuário antes de rodar.
