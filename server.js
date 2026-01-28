import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import cors from "cors";
import axios from "axios";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// =========================
// CONFIGURAÇÕES DE SEGURANÇA
// =========================
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "indusales2024";
const SESSION_COOKIE_NAME = "indusales_session";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 horas

// =========================
// TRACKING + BACKLOG
// =========================
const TRACKING_FILE = './project_tracking.json';

function initTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    fs.writeFileSync(TRACKING_FILE, JSON.stringify({
      project: "INDUSALES v4.0",
      inventario: {
        paginas: [],
        componentes: [],
        apis: [],
        tabelas: [],
        ultimo_commit: null,
        atualizado_em: null,
        stats: { total_arquivos: 0, linhas_codigo: 0 }
      },
      backlog: [],
      fases: {
        "1.1": { nome: "Autenticação e Hierarquia", items: [], progresso: 0 },
        "1.2": { nome: "Dashboards por Perfil", items: [], progresso: 0 },
        "1.3": { nome: "Workflow de Aprovações", items: [], progresso: 0 },
        "2.1": { nome: "Catálogo do Fabricante", items: [], progresso: 0 },
        "2.2": { nome: "Catálogo do Revendedor", items: [], progresso: 0 },
        "3.1": { nome: "Carrinho e Pedidos", items: [], progresso: 0 },
        "3.2": { nome: "Sistema de Fiado", items: [], progresso: 0 },
        "4.1": { nome: "CRM e Clientes", items: [], progresso: 0 },
        "4.2": { nome: "Notificações WhatsApp", items: [], progresso: 0 }
      },
    }, null, 2));
  }
}

function loadTracking() {
  initTracking();
  return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
}

function saveTracking(data) {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}

// =========================
// INVENTÁRIO AUTOMÁTICO (GitHub) - VERSÃO CORRIGIDA
// =========================
async function atualizarInventarioGitHub() {
  try {
    console.log("🔍 [GitHub] Iniciando scan do repositório...");
    const tracking = loadTracking();
    
    // 1. Verificar repositório e branch
    const repoInfo = await axios.get(
      'https://api.github.com/repos/indusales/indusales-connect-sell',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const defaultBranch = repoInfo.data.default_branch;
    console.log(`✅ [GitHub] Repo acessível. Branch: ${defaultBranch}`);
    
    // 2. Buscar árvore completa
    const treeRes = await axios.get(
      `https://api.github.com/repos/indusales/indusales-connect-sell/git/trees/${defaultBranch}?recursive=1`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const files = treeRes.data.tree.filter(f => f.type === 'blob');
    console.log(`📁 [GitHub] Total de arquivos: ${files.length}`);
    
    // 3. Analisar estrutura (suporta Next.js 14 app/ e pages/)
    const extensoesCodigo = ['.tsx', '.ts', '.jsx', '.js', '.json', '.sql'];
    
    const arquivosCodigo = files.filter(f => 
      extensoesCodigo.some(ext => f.path.endsWith(ext)) &&
      !f.path.includes('node_modules') &&
      !f.path.includes('.next') &&
      !f.path.includes('dist')
    );
    
    // Detectar páginas (Next.js 13+ ou páginas antigas)
    const paginas = arquivosCodigo
      .filter(f => {
        const p = f.path.toLowerCase();
        return (
          (p.includes('/app/') && (p.endsWith('.tsx') || p.endsWith('.ts'))) ||
          (p.includes('/pages/') && (p.endsWith('.tsx') || p.endsWith('.ts'))) ||
          p.includes('page.tsx') || 
          p.includes('page.ts') ||
          p.includes('route.ts') ||
          p.includes('layout.tsx')
        );
      })
      .map(f => ({
        nome: f.path.split('/').pop(),
        caminho: f.path,
        tipo: f.path.includes('page') ? 'page' : (f.path.includes('route') ? 'api' : 'layout'),
        tamanho: f.size
      }));
    
    // Detectar componentes React
    const componentes = arquivosCodigo
      .filter(f => {
        const p = f.path.toLowerCase();
        return (
          (p.includes('/components/') || p.includes('/ui/')) &&
          (p.endsWith('.tsx') || p.endsWith('.jsx')) &&
          !p.includes('page') &&
          !p.includes('layout')
        );
      })
      .map(f => ({
        nome: f.path.split('/').pop(),
        caminho: f.path,
        tamanho: f.size
      }));
    
    // Detectar rotas API
    const apis = arquivosCodigo
      .filter(f => 
        f.path.includes('/api/') || 
        f.path.includes('/app/api/') ||
        f.path.includes('/server/') ||
        f.path.includes('/services/')
      )
      .map(f => ({
        nome: f.path.split('/').pop(),
        caminho: f.path,
        tipo: f.path.includes('.sql') ? 'sql' : 'endpoint'
      }));
    
    // SQL files
    const sqlFiles = files.filter(f => 
      f.path.endsWith('.sql') || 
      f.path.includes('/migrations/') ||
      f.path.includes('/schema/')
    );
    
    // 4. Último commit
    const commits = await axios.get(
      `https://api.github.com/repos/indusales/indusales-connect-sell/commits?per_page=5&sha=${defaultBranch}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const ultimoCommit = commits.data[0];
    
    tracking.inventario = {
      paginas: paginas.slice(0, 50), // limitar para não sobrecarregar
      componentes: componentes.slice(0, 30),
      apis: apis.slice(0, 20),
      tabelas: sqlFiles.map(f => ({ nome: f.path.split('/').pop(), caminho: f.path })),
      ultimo_commit: {
        mensagem: ultimoCommit?.commit?.message || "N/A",
        autor: ultimoCommit?.commit?.author?.name || "Desconhecido",
        data: ultimoCommit?.commit?.author?.date,
        sha: ultimoCommit?.sha?.substring(0, 7) || "N/A"
      },
      stats: {
        total_arquivos: files.length,
        total_codigo: arquivosCodigo.length,
        paginas: paginas.length,
        componentes: componentes.length
      },
      branch: defaultBranch,
      atualizado_em: new Date().toISOString()
    };
    
    saveTracking(tracking);
    console.log(`✅ [GitHub] Inventário atualizado: ${paginas.length} páginas, ${componentes.length} componentes`);
    return tracking.inventario;
    
  } catch (error) {
    console.error("❌ [GitHub] Erro:", error.response?.status, error.response?.data?.message || error.message);
    return null;
  }
}

// =========================
// GERADOR DE COMANDOS IA
// =========================
async function generateLovablePrompt(feature, fase, contexto, inventarioAtual) {
  const contextoInventario = inventarioAtual?.paginas?.length ? 
    `CONTEXTO ATUAL:\n- Páginas existentes: ${inventarioAtual.paginas.slice(0,5).map(p => p.caminho).join(', ')}\n- Último commit: ${inventarioAtual.ultimo_commit?.mensagem?.substring(0,50)}\n\n` : '';
    
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Você é um gerador de comandos técnicos para Lovable. 
    
REGRAS:
1. Máximo 80 palavras. Brutalmente conciso.
2. Formato: "Ação. Componentes shadcn: [lista]. Dados: [tabela/campos]. NÃO faça: [lista]."
3. Foco em ${fase} do projeto INDUSALES (SaaS B2B industriais).
4. Sem explicações, apenas o comando.

ESTRUTURA:
Crie [feature]. Use [componentes]. Dados Supabase: [schema]. NÃO: [escopo negativo]. Teste: [validação].`
      },
      {
        role: "user",
        content: `${contextoInventario}Feature: ${feature}\nFase: ${fase}\nContexto adicional: ${contexto || 'nenhum'}`
      }
    ],
    max_tokens: 200,
    temperature: 0.0
  });

  return response.choices[0].message.content.trim();
}

// =========================
// MIDDLEWARE DE AUTENTICAÇÃO
// =========================
function requireAuth(req, res, next) {
  // Verifica query string (?key=SENHA) ou cookie
  const senhaQuery = req.query.key || req.query.senha;
  const senhaHeader = req.headers['x-api-key'];
  const cookie = req.headers.cookie?.includes(`${SESSION_COOKIE_NAME}=authenticated`);
  
  if (senhaQuery === DASHBOARD_PASSWORD || senhaHeader === DASHBOARD_PASSWORD || cookie) {
    // Seta cookie se veio por query/header pela primeira vez
    if (!cookie && (senhaQuery === DASHBOARD_PASSWORD || senhaHeader === DASHBOARD_PASSWORD)) {
      res.cookie(SESSION_COOKIE_NAME, 'authenticated', { 
        maxAge: SESSION_DURATION,
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      });
    }
    return next();
  }
  
  // Se for rota API, retorna 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  
  // Se for HTML, mostra tela de login
  res.send(renderLoginPage());
}

// =========================
// ROTAS API (Protegidas)
// =========================

// API Pública de teste (mantida para diagnóstico)
app.get("/api/teste-github", async (req, res) => {
  try {
    const teste = await axios.get(
      'https://api.github.com/repos/indusales/indusales-connect-sell',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    res.json({ sucesso: true, repo: teste.data.full_name, branch: teste.data.default_branch });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// APIs protegidas
app.use(['/api/inventario', '/api/backlog', '/api/tracking', '/architect'], requireAuth);

app.get("/api/inventario", async (req, res) => {
  const tracking = loadTracking();
  const ultimaAtualizacao = tracking.inventario?.atualizado_em;
  const umaHora = 60 * 60 * 1000;
  
  const deveAtualizar = !ultimaAtualizacao || (new Date() - new Date(ultimaAtualizacao)) > umaHora;
  
  if (deveAtualizar) {
    const inventario = await atualizarInventarioGitHub();
    res.json(inventario || tracking.inventario);
  } else {
    res.json(tracking.inventario);
  }
});

app.post("/api/inventario/refresh", async (req, res) => {
  const inventario = await atualizarInventarioGitHub();
  res.json(inventario || { error: "Falha ao atualizar" });
});

app.get("/api/backlog", (req, res) => {
  const tracking = loadTracking();
  res.json(tracking.backlog || []);
});

app.post("/api/backlog/add", (req, res) => {
  const { feature, fase, prioridade = "media", descricao = "" } = req.body;
  const tracking = loadTracking();
  
  tracking.backlog.push({
    id: Date.now().toString(),
    feature,
    descricao,
    fase,
    prioridade,
    status: "pendente",
    criado_em: new Date().toISOString()
  });
  
  saveTracking(tracking);
  res.json({ success: true, id: Date.now() });
});

app.post("/api/backlog/update", (req, res) => {
  const { id, status } = req.body;
  const tracking = loadTracking();
  
  const item = tracking.backlog.find(b => b.id === id);
  if (item) {
    item.status = status;
    if (status === 'concluido') item.concluido_em = new Date().toISOString();
    saveTracking(tracking);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Item não encontrado" });
  }
});

app.get("/api/tracking", (req, res) => {
  res.json(loadTracking());
});

app.post("/api/tracking/update", (req, res) => {
  const { fase, nome, status } = req.body;
  const tracking = loadTracking();
  if (tracking.fases[fase]) {
    tracking.fases[fase].items.push({ nome, status, data: new Date().toISOString() });
    saveTracking(tracking);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: "Fase inválida" });
  }
});

app.post("/architect", async (req, res) => {
  try {
    const { feature, fase, contexto } = req.body;
    const tracking = loadTracking();
    
    const prompt = await generateLovablePrompt(feature, fase, contexto, tracking.inventario);
    
    if (tracking.fases[fase]) {
      tracking.fases[fase].items.push({ 
        nome: feature.substring(0, 50), 
        status: "gerado", 
        data: new Date().toISOString() 
      });
    }
    
    saveTracking(tracking);
    res.json({ prompt, custo: "1 crédito" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// PÁGINAS WEB
// =========================

// Tela de Login
function renderLoginPage(error = "") {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | INDUSALES Architect</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #f8fafc;
        overflow: hidden;
      }
      
      .bg-grid {
        position: absolute;
        inset: 0;
        background-image: 
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 40px 40px;
        pointer-events: none;
      }
      
      .login-container {
        position: relative;
        background: rgba(30, 41, 59, 0.7);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 24px;
        padding: 48px;
        width: 100%;
        max-width: 420px;
        margin: 20px;
        box-shadow: 
          0 25px 50px -12px rgba(0,0,0,0.5),
          0 0 0 1px rgba(255,255,255,0.05) inset;
      }
      
      .logo {
        text-align: center;
        margin-bottom: 32px;
      }
      
      .logo-icon {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin-bottom: 16px;
        box-shadow: 0 10px 25px -5px rgba(245,158,11,0.4);
      }
      
      h1 {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.5px;
        margin-bottom: 8px;
      }
      
      .subtitle {
        color: #94a3b8;
        font-size: 14px;
      }
      
      .form-group {
        margin-bottom: 20px;
      }
      
      label {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #cbd5e1;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      input[type="password"] {
        width: 100%;
        padding: 14px 16px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        color: white;
        font-size: 16px;
        transition: all 0.2s;
        outline: none;
      }
      
      input[type="password"]:focus {
        border-color: #f59e0b;
        background: rgba(15, 23, 42, 0.8);
        box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
      }
      
      button {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #0f172a;
        border: none;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 4px 6px -1px rgba(245,158,11,0.2);
      }
      
      button:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 20px -5px rgba(245,158,11,0.4);
      }
      
      button:active {
        transform: translateY(0);
      }
      
      .error {
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.3);
        color: #fca5a5;
        padding: 12px;
        border-radius: 8px;
        font-size: 13px;
        margin-bottom: 20px;
        display: ${error ? 'block' : 'none'};
      }
      
      .hint {
        text-align: center;
        margin-top: 24px;
        font-size: 12px;
        color: #64748b;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .login-container {
        animation: fadeIn 0.5s ease-out;
      }
    </style>
</head>
<body>
    <div class="bg-grid"></div>
    <div class="login-container">
      <div class="logo">
        <div class="logo-icon">🏗️</div>
        <h1>INDUSALES Architect</h1>
        <p class="subtitle">Gestão de Projeto e Inventário</p>
      </div>
      
      <div class="error">${error}</div>
      
      <form method="POST" action="/login">
        <div class="form-group">
          <label>Senha de Acesso</label>
          <input type="password" name="senha" placeholder="Digite a senha..." autofocus required>
        </div>
        <button type="submit">Entrar no Dashboard</button>
      </form>
      
      <p class="hint">Versão 4.0 • Ambiente Seguro</p>
    </div>
</body>
</html>
  `;
}

// Rota de login
app.get("/", (req, res) => {
  res.redirect('/dashboard');
});

app.get("/login", (req, res) => {
  res.send(renderLoginPage());
});

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  if (req.body.senha === DASHBOARD_PASSWORD) {
    res.cookie(SESSION_COOKIE_NAME, 'authenticated', { 
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.redirect('/dashboard?key=' + DASHBOARD_PASSWORD);
  } else {
    res.send(renderLoginPage("Senha incorreta. Tente novamente."));
  }
});

// Dashboard Principal (Protegido)
app.get("/dashboard", requireAuth, async (req, res) => {
  const tracking = loadTracking();
  
  // Força atualização se estiver vazio
  if (!tracking.inventario.paginas?.length) {
    await atualizarInventarioGitHub();
  }
  
  res.send(renderDashboard(tracking, req.query.key));
});

function renderDashboard(tracking, sessionKey = "") {
  const addQuery = sessionKey ? `?key=${sessionKey}` : '';
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard | INDUSALES Architect</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      :root {
        --bg-primary: #0f172a;
        --bg-secondary: #1e293b;
        --bg-card: rgba(30, 41, 59, 0.6);
        --border: rgba(255, 255, 255, 0.1);
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
        --accent: #f59e0b;
        --accent-hover: #d97706;
        --success: #10b981;
        --warning: #f59e0b;
        --danger: #ef4444;
      }
      
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: linear-gradient(135deg, var(--bg-primary) 0%, #1e1b4b 100%);
        color: var(--text-primary);
        min-height: 100vh;
        line-height: 1.6;
      }
      
      /* Layout */
      .app {
        display: grid;
        grid-template-columns: 260px 1fr;
        min-height: 100vh;
      }
      
      @media (max-width: 1024px) {
        .app { grid-template-columns: 1fr; }
        .sidebar { display: none; }
      }
      
      /* Sidebar */
      .sidebar {
        background: rgba(15, 23, 42, 0.8);
        border-right: 1px solid var(--border);
        padding: 24px;
        position: fixed;
        height: 100vh;
        width: 260px;
        overflow-y: auto;
        backdrop-filter: blur(10px);
      }
      
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 32px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--border);
      }
      
      .brand-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }
      
      .brand-text {
        font-weight: 700;
        font-size: 18px;
        letter-spacing: -0.5px;
      }
      
      .nav-section {
        margin-bottom: 24px;
      }
      
      .nav-title {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--text-secondary);
        margin-bottom: 12px;
        font-weight: 600;
      }
      
      .nav-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 8px;
        color: var(--text-secondary);
        text-decoration: none;
        font-size: 14px;
        transition: all 0.2s;
        margin-bottom: 4px;
      }
      
      .nav-item:hover {
        background: rgba(255,255,255,0.05);
        color: var(--text-primary);
      }
      
      .nav-item.active {
        background: rgba(245,158,11,0.1);
        color: var(--accent);
      }
      
      /* Main Content */
      .main {
        margin-left: 260px;
        padding: 32px;
        max-width: 1400px;
      }
      
      @media (max-width: 1024px) {
        .main { margin-left: 0; }
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;
      }
      
      .header h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
      }
      
      .header-stats {
        display: flex;
        gap: 16px;
      }
      
      .stat-badge {
        background: var(--bg-card);
        border: 1px solid var(--border);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        backdrop-filter: blur(10px);
      }
      
      /* Grid */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
      }
      
      @media (max-width: 768px) {
        .grid { grid-template-columns: 1fr; }
      }
      
      /* Cards */
      .card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 16px;
        overflow: hidden;
        backdrop-filter: blur(10px);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      
      .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 40px -15px rgba(0,0,0,0.4);
      }
      
      .card-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .card-title {
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .card-action {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .card-action:hover {
        background: rgba(245,158,11,0.1);
        color: var(--accent);
        border-color: rgba(245,158,11,0.3);
      }
      
      .card-body {
        padding: 20px;
        max-height: 500px;
        overflow-y: auto;
      }
      
      .empty-state {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      
      /* Items */
      .inventario-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        margin-bottom: 8px;
        transition: all 0.2s;
        font-size: 13px;
      }
      
      .inventario-item:hover {
        background: rgba(15, 23, 42, 0.8);
        border-color: rgba(245,158,11,0.2);
      }
      
      .item-info {
        display: flex;
        flex-direction: column;
      }
      
      .item-name {
        font-weight: 500;
        color: var(--text-primary);
      }
      
      .item-path {
        font-size: 11px;
        color: var(--text-secondary);
        font-family: 'Monaco', 'Menlo', monospace;
        margin-top: 2px;
      }
      
      .item-badge {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .badge-page { background: rgba(59,130,246,0.15); color: #60a5fa; }
      .badge-component { background: rgba(16,185,129,0.15); color: #34d399; }
      .badge-api { background: rgba(245,158,11,0.15); color: #fbbf24; }
      .badge-sql { background: rgba(139,92,246,0.15); color: #a78bfa; }
      
      /* Formulários */
      .form-group {
        margin-bottom: 16px;
      }
      
      label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .input, .select, textarea {
        width: 100%;
        padding: 12px;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: white;
        font-size: 14px;
        transition: all 0.2s;
        font-family: inherit;
      }
      
      .input:focus, .select:focus, textarea:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
      }
      
      textarea {
        resize: vertical;
        min-height: 100px;
      }
      
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 14px;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .btn-primary {
        background: linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%);
        color: #0f172a;
        box-shadow: 0 4px 12px rgba(245,158,11,0.3);
      }
      
      .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(245,158,11,0.4);
      }
      
      .btn-secondary {
        background: rgba(255,255,255,0.05);
        color: white;
        border: 1px solid var(--border);
      }
      
      .btn-secondary:hover {
        background: rgba(255,255,255,0.1);
      }
      
      /* Resultado */
      .result-box {
        background: rgba(0,0,0,0.3);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-top: 20px;
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 13px;
        line-height: 1.6;
        position: relative;
        color: #e2e8f0;
      }
      
      .copy-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255,255,255,0.1);
        border: 1px solid var(--border);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .copy-btn:hover {
        background: var(--accent);
        color: #0f172a;
      }
      
      /* Backlog */
      .backlog-item {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        transition: all 0.2s;
      }
      
      .backlog-item:hover {
        border-color: rgba(245,158,11,0.3);
      }
      
      .backlog-item.developing {
        border-left: 3px solid var(--accent);
      }
      
      .backlog-item.done {
        opacity: 0.6;
        border-left: 3px solid var(--success);
      }
      
      .priority {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        margin-right: 6px;
      }
      
      .priority-alta { background: var(--danger); box-shadow: 0 0 8px var(--danger); }
      .priority-media { background: var(--warning); }
      .priority-baixa { background: var(--text-secondary); }
      
      .fase-badge {
        font-size: 11px;
        background: rgba(255,255,255,0.05);
        padding: 4px 8px;
        border-radius: 6px;
        color: var(--text-secondary);
      }
      
      /* Scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05);
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.3);
      }
      
      /* Loading */
      .loading-skeleton {
        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
        height: 20px;
        margin-bottom: 8px;
      }
      
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      /* Mobile */
      .mobile-header {
        display: none;
        padding: 16px;
        background: rgba(15, 23, 42, 0.9);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      
      @media (max-width: 1024px) {
        .mobile-header { display: block; }
      }
    </style>
</head>
<body>
    <div class="mobile-header">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:700;">🏗️ INDUSALES</span>
        <span style="font-size:12px; color:var(--text-secondary);">Architect v4.0</span>
      </div>
    </div>
    
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">🏗️</div>
          <div class="brand-text">INDUSALES</div>
        </div>
        
        <nav>
          <div class="nav-section">
            <div class="nav-title">Menu</div>
            <a href="#inventario" class="nav-item active" onclick="showTab('inventario')">
              <i data-lucide="folder-tree" style="width:18px;"></i>
              Inventário
            </a>
            <a href="#backlog" class="nav-item" onclick="showTab('backlog')">
              <i data-lucide="list-todo" style="width:18px;"></i>
              Backlog
            </a>
            <a href="#gerador" class="nav-item" onclick="showTab('gerador')">
              <i data-lucide="zap" style="width:18px;"></i>
              Gerador IA
            </a>
          </div>
          
          <div class="nav-section">
            <div class="nav-title">Fases</div>
            ${Object.entries(tracking.fases).map(([key, fase]) => `
              <a href="/api/tracking${escapeHtml(addQuery)}" class="nav-item" style="font-size:13px; padding-left:20px;">
                <span style="opacity:0.6;">${key}</span>
                <span style="margin-left:auto; font-size:11px; opacity:0.6;">${fase.items.length}</span>
              </a>
            `).join('')}
          </div>
        </nav>
        
        <div style="margin-top:auto; padding-top:24px; border-top:1px solid var(--border);">
          <div style="font-size:12px; color:var(--text-secondary);">
            Última sync: <span id="last-sync">Carregando...</span>
          </div>
        </div>
      </aside>
      
      <main class="main">
        <div class="header">
          <div>
            <h1>Dashboard</h1>
            <p style="color:var(--text-secondary); font-size:14px; margin-top:4px;">
              Gerencie o desenvolvimento do INDUSALES v4.0
            </p>
          </div>
          <div class="header-stats">
            <div class="stat-badge">
              <i data-lucide="git-commit" style="width:16px; width:16px;"></i>
              <span id="commit-count">0 commits</span>
            </div>
            <div class="stat-badge">
              <i data-lucide="file-code" style="width:16px;"></i>
              <span id="file-count">0 arquivos</span>
            </div>
          </div>
        </div>
        
        <div class="grid">
          <!-- INVENTÁRIO -->
          <div class="card" id="tab-inventario" style="grid-column: span 1;">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="folder-tree" style="width:18px; color:var(--accent);"></i>
                Inventário GitHub
              </div>
              <button class="card-action" onclick="atualizarInventario()">
                <i data-lucide="refresh-cw" style="width:14px; display:inline; vertical-align:middle; margin-right:4px;"></i>
                Sync
              </button>
            </div>
            <div class="card-body" id="inventario-content">
              <div class="loading-skeleton" style="height:60px;"></div>
              <div class="loading-skeleton" style="height:60px;"></div>
              <div class="loading-skeleton" style="height:60px;"></div>
            </div>
          </div>
          
          <!-- BACKLOG -->
          <div class="card" id="tab-backlog" style="grid-column: span 1;">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="list-todo" style="width:18px; color:var(--success);"></i>
                Fila de Desenvolvimento
              </div>
              <button class="card-action" onclick="document.getElementById('add-form').scrollIntoView({behavior:'smooth'})">
                + Nova
              </button>
            </div>
            <div class="card-body" id="backlog-content">
              <div class="empty-state">Carregando backlog...</div>
            </div>
          </div>
          
          <!-- GERADOR IA -->
          <div class="card" id="tab-gerador" style="grid-column: span 2;">
            <div class="card-header">
              <div class="card-title">
                <i data-lucide="zap" style="width:18px; color:var(--warning);"></i>
                Gerador de Comandos (Lovable)
              </div>
            </div>
            <div class="card-body">
              <form id="cmdForm" onsubmit="gerarComando(event)">
                <div style="display:grid; grid-template-columns: 1fr 200px; gap:16px; margin-bottom:16px;">
                  <div class="form-group" style="margin:0;">
                    <label>Feature a desenvolver</label>
                    <select id="backlog-select" class="select" onchange="preencherFromBacklog()">
                      <option value="">Selecionar da fila...</option>
                      <option value="custom" style="font-style:italic;">→ Digitar manualmente</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin:0;">
                    <label>Fase do projeto</label>
                    <select id="fase-select" class="select" required>
                      ${Object.entries(tracking.fases).map(([key, val]) => 
                        `<option value="${key}">${key} - ${val.nome}</option>`
                      ).join('')}
                    </select>
                  </div>
                </div>
                
                <div class="form-group" id="custom-input" style="display:none;">
                  <label>Descrição detalhada</label>
                  <textarea id="feature-text" placeholder="Descreva a funcionalidade em até 80 palavras..."></textarea>
                </div>
                
                <button type="submit" class="btn btn-primary" style="width:100%;">
                  <i data-lucide="sparkles" style="width:16px;"></i>
                  Gerar Comando Otimizado
                </button>
              </form>
              
              <div id="resultado" style="display:none;">
                <div class="result-box">
                  <button class="copy-btn" onclick="copiarComando()">Copiar</button>
                  <pre id="cmdText" style="margin:0; white-space:pre-wrap;"></pre>
                </div>
                <div style="display:flex; gap:12px; margin-top:16px;">
                  <button class="btn btn-secondary" onclick="marcarConcluido()" style="flex:1;">
                    <i data-lucide="check" style="width:16px;"></i>
                    Marcar como Implementado
                  </button>
                  <button class="btn btn-secondary" onclick="novoComando()" style="flex:1;">
                    Novo Comando
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
    
    <script>
      // Inicializar ícones
      lucide.createIcons();
      
      let currentCmd = "";
      let backlogData = [];
      let inventarioData = null;
      
      // Carregar dados
      async function loadData() {
        await Promise.all([loadInventario(), loadBacklog()]);
        lucide.createIcons();
      }
      
      async function loadInventario() {
        const res = await fetch('/api/inventario${addQuery}');
        const data = await res.json();
        inventarioData = data;
        
        document.getElementById('commit-count').textContent = (data.stats?.total_codigo || 0) + ' arquivos';
        document.getElementById('file-count').textContent = (data.paginas?.length || 0) + ' páginas';
        document.getElementById('last-sync').textContent = data.atualizado_em ? 
          new Date(data.atualizado_em).toLocaleTimeString() : 'Nunca';
        
        const div = document.getElementById('inventario-content');
        
        if (!data.paginas || data.paginas.length === 0) {
          div.innerHTML = '<div class="empty-state">Nenhum arquivo detectado. Clique em Sync para atualizar.</div>';
          return;
        }
        
        // Agrupar por pasta
        const grupos = {};
        data.paginas.forEach(p => {
          const folder = p.caminho.split('/').slice(0, -1).join('/') || 'root';
          if (!grupos[folder]) grupos[folder] = [];
          grupos[folder].push(p);
        });
        
        let html = '';
        
        // Último commit
        if (data.ultimo_commit) {
          html += '<div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:16px; border-radius:10px; margin-bottom:20px;">';
          html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">';
          html += '<i data-lucide="git-commit" style="width:16px; color:#60a5fa;"></i>';
          html += '<span style="font-weight:600; font-size:13px;">Último commit</span>';
          html += '</div>';
          html += '<p style="font-size:13px; color:#94a3b8; margin:0; line-height:1.5;">';
          html += '<strong style="color:#f59e0b;">' + data.ultimo_commit.sha + '</strong> • ';
          html += data.ultimo_commit.mensagem.substring(0, 80) + '...<br>';
          html += '<small>por ' + data.ultimo_commit.autor + ' • ' + new Date(data.ultimo_commit.data).toLocaleString() + '</small>';
          html += '</p>';
          html += '</div>';
        }
        
        // Lista de arquivos
        Object.entries(grupos).slice(0, 5).forEach(([folder, items]) => {
          html += '<div style="margin-bottom:20px;">';
          html += '<div style="font-size:11px; text-transform:uppercase; color:var(--text-secondary); margin-bottom:8px; letter-spacing:1px;">' + folder + '</div>';
          items.slice(0, 5).forEach(item => {
            const tipo = item.tipo || 'page';
            const badgeClass = tipo === 'page' ? 'badge-page' : (tipo === 'api' ? 'badge-api' : 'badge-component');
            html += '<div class="inventario-item">';
            html += '<div class="item-info">';
            html += '<span class="item-name">' + item.nome + '</span>';
            html += '<span class="item-path">' + item.caminho + '</span>';
            html += '</div>';
            html += '<span class="item-badge ' + badgeClass + '">' + tipo + '</span>';
            html += '</div>';
          });
          if (items.length > 5) {
            html += '<div style="text-align:center; padding:8px; font-size:12px; color:var(--text-secondary);">+' + (items.length - 5) + ' mais</div>';
          }
          html += '</div>';
        });
        
        div.innerHTML = html;
      }
      
      async function loadBacklog() {
        const res = await fetch('/api/backlog${addQuery}');
        const data = await res.json();
        backlogData = data.filter(b => b.status !== 'concluido' && b.status !== 'cancelado');
        
        const div = document.getElementById('backlog-content');
        const select = document.getElementById('backlog-select');
        
        // Limpar select (mantém as 2 primeiras)
        while (select.options.length > 2) {
          select.remove(2);
        }
        
        if (backlogData.length === 0) {
          div.innerHTML = '<div class="empty-state">Fila vazia. Adicione novas funcionalidades abaixo.</div>';
          return;
        }
        
        let html = '';
        backlogData.forEach(item => {
          const statusClass = item.status === 'em-desenvolvimento' ? 'developing' : '';
          const priorityClass = 'priority-' + item.prioridade;
          
          html += '<div class="backlog-item ' + statusClass + '">';
          html += '<div>';
          html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
          html += '<span class="priority ' + priorityClass + '"></span>';
          html += '<strong style="font-size:14px;">' + escapeHtml(item.feature.substring(0, 50)) + '</strong>';
          html += '</div>';
          html += '<div style="display:flex; gap:8px; margin-top:6px;">';
          html += '<span class="fase-badge">Fase ' + item.fase + '</span>';
          if (item.status === 'em-desenvolvimento') {
            html += '<span style="font-size:11px; color:var(--warning);">● Em desenvolvimento</span>';
          }
          html += '</div>';
          html += '</div>';
          html += '<button class="card-action" onclick="usarBacklog(' + item.id + ')">Usar</button>';
          html += '</div>';
          
          // Adicionar ao select
          const opt = document.createElement('option');
          opt.value = item.id;
          opt.text = item.feature.substring(0, 40);
          select.add(opt);
        });
        
        // Form de adicionar
        html += '<div id="add-form" style="margin-top:24px; padding-top:24px; border-top:1px solid var(--border);">';
        html += '<div class="form-group">';
        html += '<label>Adicionar à fila</label>';
        html += '<input type="text" id="new-feature" class="input" placeholder="Nome da funcionalidade...">';
        html += '</div>';
        html += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">';
        html += '<select id="new-fase" class="select">${Object.keys(tracking.fases).map(k => '<option value="' + k + '">' + k + '</option>').join('')}</select>';
        html += '<select id="new-priority" class="select"><option value="alta">🔥 Alta</option><option value="media" selected>⚡ Média</option><option value="baixa">📌 Baixa</option></select>';
        html += '</div>';
        html += '<button class="btn btn-secondary" onclick="addBacklog()" style="width:100%;">Adicionar à Fila</button>';
        html += '</div>';
        
        div.innerHTML = html;
      }
      
      function preencherFromBacklog() {
        const id = document.getElementById('backlog-select').value;
        const customDiv = document.getElementById('custom-input');
        
        if (id === 'custom') {
          customDiv.style.display = 'block';
          document.getElementById('feature-text').value = '';
          document.getElementById('feature-text').focus();
        } else if (id) {
          customDiv.style.display = 'none';
          const item = backlogData.find(b => b.id == id);
          if (item) {
            document.getElementById('fase-select').value = item.fase;
          }
        } else {
          customDiv.style.display = 'none';
        }
      }
      
      function usarBacklog(id) {
        document.getElementById('backlog-select').value = id;
        preencherFromBacklog();
        document.getElementById('tab-gerador').scrollIntoView({ behavior: 'smooth' });
      }
      
      async function addBacklog() {
        const feature = document.getElementById('new-feature').value;
        const fase = document.getElementById('new-fase').value;
        const prioridade = document.getElementById('new-priority').value;
        
        if (!feature) return alert('Digite o nome da funcionalidade');
        
        await fetch('/api/backlog/add${addQuery}', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ feature, fase, prioridade })
        });
        
        loadBacklog();
        lucide.createIcons();
      }
      
      async function gerarComando(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerHTML = '<i data-lucide="loader-2" style="width:16px; animation:spin 1s linear infinite;"></i> Gerando...';
        lucide.createIcons();
        
        const select = document.getElementById('backlog-select');
        const id = select.value;
        let feature;
        
        if (id === 'custom' || !id) {
          feature = document.getElementById('feature-text').value;
        } else {
          const item = backlogData.find(b => b.id == id);
          feature = item ? item.feature : document.getElementById('feature-text').value;
        }
        
        const fase = document.getElementById('fase-select').value;
        
        try {
          const res = await fetch('/architect${addQuery}', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ feature, fase })
          });
          
          const data = await res.json();
          currentCmd = data.prompt;
          
          document.getElementById('cmdText').textContent = data.prompt;
          document.getElementById('resultado').style.display = 'block';
          document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
          alert('Erro ao gerar comando');
        } finally {
          btn.innerHTML = '<i data-lucide="sparkles" style="width:16px;"></i> Gerar Comando Otimizado';
          lucide.createIcons();
        }
      }
      
      function copiarComando() {
        navigator.clipboard.writeText(currentCmd);
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copiado!';
        setTimeout(() => btn.textContent = 'Copiar', 2000);
      }
      
      function novoComando() {
        document.getElementById('resultado').style.display = 'none';
        document.getElementById('cmdForm').reset();
        document.getElementById('custom-input').style.display = 'none';
      }
      
      async function marcarConcluido() {
        const select = document.getElementById('backlog-select');
        const id = select.value;
        
        if (id && id !== 'custom') {
          await fetch('/api/backlog/update${addQuery}', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id, status: 'concluido' })
          });
          loadBacklog();
        }
        
        novoComando();
        alert('✓ Marcado como implementado!');
      }
      
      async function atualizarInventario() {
        const div = document.getElementById('inventario-content');
        div.innerHTML = '<div class="loading-skeleton" style="height:60px;"></div><div class="loading-skeleton" style="height:60px;"></div>';
        
        await fetch('/api/inventario/refresh${addQuery}', { method: 'POST' });
        await loadInventario();
        lucide.createIcons();
      }
      
      function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      function showTab(tab) {
        // Em mobile, scroll para a seção
        document.getElementById('tab-' + tab).scrollIntoView({ behavior: 'smooth' });
        
        // Atualizar active state
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        event.target.closest('.nav-item').classList.add('active');
      }
      
      // Inicializar
      loadData();
    </script>
    
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
  </body>
</html>
  `;
}

// Helper para escapar HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================
// INICIALIZAÇÃO
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 INDUSALES Architect v4.0 rodando na porta ${PORT}`);
  console.log(`🔒 Dashboard protegido: http://localhost:${PORT}/login`);
  console.log(`🔑 Senha: ${DASHBOARD_PASSWORD === 'indusales2024' ? 'indusales2024 (Padrão - ALTERE!)' : 'Configurada via ENV'}`);
  
  // Pré-carregar inventário se vazio
  const tracking = loadTracking();
  if (!tracking.inventario.paginas?.length) {
    console.log('📦 Pré-carregando inventário...');
    atualizarInventarioGitHub().catch(console.error);
  }
});