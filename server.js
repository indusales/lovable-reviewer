import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import cors from "cors";
import axios from "axios";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
        tabelas: [],
        ultimo_commit: "",
        atualizado_em: null
      },
      backlog: [], // Fila de funcionalidades pendentes
      fases: {
        "1.1": { nome: "Autenticação e Hierarquia", items: [] },
        "1.2": { nome: "Dashboards por Perfil", items: [] },
        "1.3": { nome: "Workflow de Aprovações", items: [] },
        "2.1": { nome: "Catálogo do Fabricante", items: [] },
        "2.2": { nome: "Catálogo do Revendedor", items: [] },
        "3.1": { nome: "Carrinho e Pedidos", items: [] },
        "3.2": { nome: "Sistema de Fiado", items: [] },
        "4.1": { nome: "CRM e Clientes", items: [] },
        "4.2": { nome: "Notificações WhatsApp", items: [] }
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
// INVENTÁRIO AUTOMÁTICO (GitHub)
// =========================
async function atualizarInventarioGitHub() {
  try {
    const tracking = loadTracking();
    
    // Buscar estrutura de arquivos
    const treeRes = await axios.get(
      'https://api.github.com/repos/indusales/indusales-connect-sell/git/trees/main?recursive=1',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const files = treeRes.data.tree;
    
    // Detectar páginas (app/ ou pages/ ou src/)
    const paginas = files
      .filter(f => f.path.match(/\.(tsx|jsx|vue|html)$/))
      .map(f => ({
        nome: f.path.split('/').pop(),
        caminho: f.path,
        tipo: f.path.includes('page') || f.path.includes('index') ? 'página' : 'componente'
      }));
      
    // Detectar possíveis tabelas (de arquivos SQL ou migrations)
    const sqlFiles = files.filter(f => f.path.endsWith('.sql'));
    
    // Buscar último commit
    const commitRes = await axios.get(
      'https://api.github.com/repos/indusales/indusales-connect-sell/commits?per_page=1',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const ultimoCommit = commitRes.data[0];
    
    tracking.inventario = {
      paginas: paginas.filter(p => p.tipo === 'página'),
      componentes: paginas.filter(p => p.tipo === 'componente'),
      tabelas: sqlFiles.map(f => f.path),
      ultimo_commit: {
        mensagem: ultimoCommit?.commit?.message || "N/A",
        data: ultimoCommit?.commit?.committer?.date || new Date().toISOString(),
        autor: ultimoCommit?.commit?.committer?.name || "Desconhecido"
      },
      atualizado_em: new Date().toISOString()
    };
    
    saveTracking(tracking);
    return tracking.inventario;
  } catch (error) {
    console.error("Erro ao buscar inventário:", error.message);
    return null;
  }
}

// =========================
// GERADOR DE COMANDOS
// =========================
async function generateLovablePrompt(feature, fase, contexto, inventarioAtual) {
  const contextoInventario = inventarioAtual ? 
    `\nJÁ EXISTE NO PROJETO: ${inventarioAtual.paginas.map(p => p.caminho).join(', ')}` : '';
    
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Você é um gerador de comandos técnicos para Lovable. 
    
REGRAS ABSOLUTAS:
1. MÁXIMO 80 PALAVRAS (seja brutalmente conciso)
2. Formato: "Ação. Componentes. Dados. NÃO faça."
3. SEM explicações, SEM introduções, SEM conclusões
4. Apenas o comando puro para copiar e colar

ESTRUTURA OBRIGATÓRIA:
Crie [página/componente]. Componentes shadcn: [lista]. Dados Supabase: [tabela/campos]. NÃO crie: [restrições].

EXEMPLO PERFEITO:
"Crie página /login. Componentes: Input email/senha, Button submit. Layout: centrado mobile-first. Dados: tabela profiles (email,role). NÃO crie: cadastro, recovery senha, navbar. Teste: submit redireciona /dashboard."

Agora gere o comando para:`
      },
      {
        role: "user",
        content: `Feature: ${feature}\nContexto: ${contexto || 'nenhum'}${contextoInventario}\n\nGere comando CURTO (max 80 palavras) no estilo do exemplo acima.`
      }
    ],
    max_tokens: 150,
    temperature: 0.0
  });

  return response.choices[0].message.content;
}

// =========================
// ROTAS API
// =========================

// Inventário automático
app.get("/api/inventario", async (req, res) => {
  const tracking = loadTracking();
  
  // Se tiver mais de 1 hora sem atualizar, busca do GitHub
  const ultimaAtualizacao = tracking.inventario?.atualizado_em;
  const deveAtualizar = !ultimaAtualizacao || 
    (new Date() - new Date(ultimaAtualizacao)) > (60 * 60 * 1000); // 1 hora
    
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

// Backlog (Fila)
app.get("/api/backlog", (req, res) => {
  const tracking = loadTracking();
  res.json(tracking.backlog || []);
});

app.post("/api/backlog/add", (req, res) => {
  const { feature, fase, prioridade = "media" } = req.body;
  const tracking = loadTracking();
  
  tracking.backlog.push({
    id: Date.now(),
    feature,
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
    saveTracking(tracking);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Item não encontrado" });
  }
});

// Tracking (implementados)
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

// Architect
app.post("/architect", async (req, res) => {
  try {
    const { feature, fase, contexto } = req.body;
    const tracking = loadTracking();
    
    const prompt = await generateLovablePrompt(feature, fase, contexto, tracking.inventario);
    
    // Marcar como "gerado" na fase
    if (tracking.fases[fase]) {
      tracking.fases[fase].items.push({ 
        nome: feature.substring(0, 50), 
        status: "gerado", 
        data: new Date().toISOString() 
      });
    }
    
    saveTracking(tracking);
    res.json({ prompt, custo: "1 crédito Lovable" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// =========================
// DASHBOARD WEB
// =========================
app.get("/dashboard", async (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>INDUSALES - Gestão do Projeto</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #f1f5f9;
        min-height: 100vh;
        padding: 20px;
      }
      .container { max-width: 1400px; margin: 0 auto; }
      h1 { color: #f59e0b; text-align: center; margin-bottom: 10px; font-size: 2rem; }
      .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 14px; }
      
      .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
      @media (max-width: 1200px) { .grid-3 { grid-template-columns: 1fr; } }
      
      .card {
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .card h2 { 
        color: #3b82f6; 
        margin-bottom: 15px; 
        font-size: 1.1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .refresh-btn {
        font-size: 12px;
        padding: 4px 8px;
        background: #334155;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      /* Inventário */
      .inventario-item {
        background: rgba(15, 23, 42, 0.6);
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid #10b981;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .inventario-item small { color: #64748b; font-size: 11px; }
      
      /* Backlog */
      .backlog-form {
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid #334155;
      }
      .backlog-input {
        width: 100%;
        padding: 8px;
        margin-bottom: 8px;
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 4px;
        color: #f1f5f9;
      }
      .backlog-select {
        width: 48%;
        padding: 8px;
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 4px;
        color: #f1f5f9;
      }
      .add-btn {
        width: 100%;
        padding: 8px;
        margin-top: 8px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
      }
      
      .backlog-item {
        background: rgba(15, 23, 42, 0.6);
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 6px;
        border-left: 3px solid #f59e0b;
        position: relative;
      }
      .backlog-item.em-desenvolvimento { border-left-color: #3b82f6; }
      .backlog-item.concluido { border-left-color: #10b981; opacity: 0.6; }
      
      .backlog-item strong { color: #f59e0b; font-size: 13px; }
      .backlog-item small { display: block; color: #64748b; font-size: 11px; margin-top: 4px; }
      
      .backlog-actions {
        margin-top: 8px;
        display: flex;
        gap: 5px;
      }
      .action-btn {
        font-size: 11px;
        padding: 4px 8px;
        background: #334155;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
      }
      .action-btn:hover { background: #475569; }
      .action-btn.gerar { background: #f59e0b; color: #0f172a; font-weight: bold; }
      
      /* Gerador */
      .form-group { margin-bottom: 15px; }
      label { display: block; margin-bottom: 5px; color: #cbd5e1; font-size: 13px; font-weight: 600; }
      select, textarea {
        width: 100%;
        padding: 10px;
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 6px;
        color: #f1f5f9;
        font-size: 13px;
        font-family: inherit;
      }
      textarea { min-height: 80px; resize: vertical; }
      
      .gerar-btn {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #0f172a;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      }
      
      .result-box {
        background: #0a0f1d;
        border: 2px solid #334155;
        border-radius: 8px;
        padding: 15px;
        margin-top: 15px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: #e2e8f0;
        position: relative;
        white-space: pre-wrap;
      }
      .copy-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 6px 12px;
        background: #f59e0b;
        color: #0f172a;
        border: none;
        border-radius: 4px;
        font-weight: bold;
        cursor: pointer;
        font-size: 12px;
      }
      
      .hint { font-size: 11px; color: #64748b; margin-top: 5px; font-style: italic; }
      
      .status-prioridade { 
        display: inline-block; 
        padding: 2px 6px; 
        border-radius: 3px; 
        font-size: 10px; 
        margin-left: 5px;
      }
      .prioridade-alta { background: #ef4444; color: white; }
      .prioridade-media { background: #f59e0b; color: black; }
      .prioridade-baixa { background: #64748b; color: white; }
      
      .loading {
        display: none;
        text-align: center;
        padding: 20px;
        color: #f59e0b;
      }
      .empty-state {
        text-align: center;
        padding: 30px;
        color: #64748b;
        font-size: 13px;
      }
    </style>
</head>
<body>
    <div class="container">
      <h1>🏗️ INDUSALES Architect</h1>
      <p class="subtitle">Inventário Automático + Fila de Desenvolvimento</p>
      
      <div class="grid-3">
        <!-- COLUNA 1: Inventário (O que existe) -->
        <div class="card">
          <h2>
            📦 Inventário GitHub
            <button class="refresh-btn" onclick="atualizarInventario()" title="Atualizar do GitHub">🔄</button>
          </h2>
          <div id="inventario-content">
            <div class="loading">Carregando...</div>
          </div>
        </div>
        
        <!-- COLUNA 2: Backlog (Fila) -->
        <div class="card">
          <h2>📋 Backlog (Fila)</h2>
          
          <div class="backlog-form">
            <input type="text" id="novo-feature" class="backlog-input" placeholder="Nova funcionalidade..." />
            <div style="display: flex; gap: 4%;">
              <select id="novo-fase" class="backlog-select">
                <option value="">Fase...</option>
                <option value="1.1">1.1 Auth</option>
                <option value="1.2">1.2 Dashboard</option>
                <option value="1.3">1.3 Aprovações</option>
                <option value="2.1">2.1 Catálogo</option>
                <option value="2.2">2.2 Revendedor</option>
                <option value="3.1">3.1 Pedidos</option>
                <option value="3.2">3.2 Fiado</option>
                <option value="4.1">4.1 CRM</option>
                <option value="4.2">4.2 WhatsApp</option>
              </select>
              <select id="novo-prioridade" class="backlog-select">
                <option value="alta">🔥 Alta</option>
                <option value="media" selected>⚡ Média</option>
                <option value="baixa">📌 Baixa</option>
              </select>
            </div>
            <button class="add-btn" onclick="adicionarBacklog()">+ Adicionar à Fila</button>
          </div>
          
          <div id="backlog-lista">
            <!-- Preenchido via JS -->
          </div>
        </div>
        
        <!-- COLUNA 3: Gerador -->
        <div class="card">
          <h2>⚡ Gerar Comando</h2>
          
          <form id="cmdForm" onsubmit="gerarComando(event)">
            <div class="form-group">
              <label>Item da Fila ou Novo</label>
              <select id="feature-select" onchange="preencherFeature()">
                <option value="">-- Selecionar da fila --</option>
                <option value="novo">✏️ Digitar manualmente</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Descrição da Feature</label>
              <textarea id="feature-text" placeholder="Selecione da fila ou digite aqui..." required></textarea>
              <div class="hint">Máx 80 palavras. Seja específico.</div>
            </div>
            
            <div class="form-group">
              <label>Fase</label>
              <select id="fase-select" required>
                <option value="1.1">1.1 - Autenticação</option>
                <option value="1.2">1.2 - Dashboards</option>
                <option value="1.3">1.3 - Aprovações</option>
                <option value="2.1">2.1 - Catálogo Fabricante</option>
                <option value="2.2">2.2 - Catálogo Revendedor</option>
                <option value="3.1">3.1 - Pedidos</option>
                <option value="3.2">3.2 - Fiado</option>
                <option value="4.1">4.1 - CRM</option>
                <option value="4.2">4.2 - WhatsApp</option>
              </select>
            </div>
            
            <button type="submit" class="gerar-btn">🚀 Gerar Comando para Lovable</button>
          </form>
          
          <div class="loading" id="loading">
            <p>Gerando...</p>
          </div>
          
          <div id="resultado" style="display:none;">
            <div class="result-box" id="cmdText"></div>
            <button class="copy-btn" onclick="copiar()">📋 Copiar</button>
            <button onclick="marcarConcluido()" style="width:100%; margin-top:10px; padding:10px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">
              ✓ Marcar como Implementado
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      let currentCmd = "";
      let backlogData = [];
      
      // Carregar inventário
      async function carregarInventario() {
        const r = await fetch('/api/inventario');
        const data = await r.json();
        const div = document.getElementById('inventario-content');
        
        if (!data || !data.paginas) {
          div.innerHTML = '<div class="empty-state">Erro ao carregar inventário</div>';
          return;
        }
        
        let html = '';
        
        // Último commit
        if (data.ultimo_commit) {
          html += '<div style="background:rgba(59,130,246,0.1); padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px;">';
          html += '<strong style="color:#3b82f6;">📝 Último Commit:</strong><br/>';
          html += data.ultimo_commit.mensagem.substring(0, 60) + '...<br/>';
          html += '<small>' + new Date(data.ultimo_commit.data).toLocaleString() + '</small>';
          html += '</div>';
        }
        
        // Páginas
        if (data.paginas && data.paginas.length > 0) {
          html += '<h3 style="color:#10b981; font-size:13px; margin:15px 0 10px;">📄 Páginas Detectadas</h3>';
          data.paginas.forEach(p => {
            html += '<div class="inventario-item">';
            html += '<span>' + p.nome + '</span>';
            html += '<small>' + (p.caminho.includes('page') ? 'page' : 'comp') + '</small>';
            html += '</div>';
          });
        } else {
          html += '<div class="empty-state">Nenhuma página detectada ainda</div>';
        }
        
        // Componentes
        if (data.componentes && data.componentes.length > 0) {
          html += '<h3 style="color:#10b981; font-size:13px; margin:15px 0 10px;">🧩 Componentes</h3>';
          html += '<div style="font-size:12px; color:#94a3b8;">';
          html += data.componentes.slice(0, 5).map(c => c.nome).join(', ');
          if (data.componentes.length > 5) html += ' +' + (data.componentes.length - 5) + ' mais';
          html += '</div>';
        }
        
        div.innerHTML = html;
      }
      
      // Atualizar inventário (forçar refresh)
      async function atualizarInventario() {
        document.getElementById('inventario-content').innerHTML = '<div class="loading">Atualizando...</div>';
        const r = await fetch('/api/inventario/refresh', { method: 'POST' });
        await carregarInventario();
      }
      
      // Carregar backlog
      async function carregarBacklog() {
        const r = await fetch('/api/backlog');
        backlogData = await r.json();
        const div = document.getElementById('backlog-lista');
        const select = document.getElementById('feature-select');
        
        // Limpar opções anteriores (exceto as 2 primeiras)
        while (select.options.length > 2) {
          select.remove(2);
        }
        
        if (backlogData.length === 0) {
          div.innerHTML = '<div class="empty-state">Fila vazia. Adicione itens acima!</div>';
          return;
        }
        
        let html = '';
        backlogData.filter(b => b.status !== 'concluido').forEach(item => {
          const prioridadeClass = 'prioridade-' + item.prioridade;
          const statusClass = item.status === 'em-desenvolvimento' ? 'em-desenvolvimento' : '';
          
          html += '<div class="backlog-item ' + statusClass + '">';
          html += '<strong>' + item.feature.substring(0, 40) + '</strong>';
          html += '<span class="status-prioridade ' + prioridadeClass + '">' + item.prioridade + '</span>';
          html += '<small>Fase ' + item.fase + ' • ' + new Date(item.criado_em).toLocaleDateString() + '</small>';
          html += '<div class="backlog-actions">';
          html += '<button class="action-btn gerar" onclick="usarBacklog(' + item.id + ')">⚡ Gerar</button>';
          if (item.status === 'pendente') {
            html += '<button class="action-btn" onclick="atualizarStatus(' + item.id + ', \'em-desenvolvimento\')">▶️ Iniciar</button>';
          }
          html += '<button class="action-btn" onclick="removerBacklog(' + item.id + ')" style="background:#ef4444;">🗑️</button>';
          html += '</div>';
          html += '</div>';
          
          // Adicionar ao select
          const option = document.createElement('option');
          option.value = item.id;
          option.text = '📋 ' + item.feature.substring(0, 30) + '...';
          select.add(option);
        });
        
        div.innerHTML = html;
      }
      
      // Adicionar à fila
      async function adicionarBacklog() {
        const feature = document.getElementById('novo-feature').value;
        const fase = document.getElementById('novo-fase').value;
        const prioridade = document.getElementById('novo-prioridade').value;
        
        if (!feature || !fase) {
          alert('Preencha a funcionalidade e a fase!');
          return;
        }
        
        await fetch('/api/backlog/add', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ feature, fase, prioridade })
        });
        
        document.getElementById('novo-feature').value = '';
        await carregarBacklog();
      }
      
      // Usar item do backlog no gerador
      function usarBacklog(id) {
        const item = backlogData.find(b => b.id === id);
        if (item) {
          document.getElementById('feature-select').value = id;
          preencherFeature();
          
          // Scroll para o gerador
          document.querySelector('.card:last-child').scrollIntoView({ behavior: 'smooth' });
        }
      }
      
      function preencherFeature() {
        const select = document.getElementById('feature-select');
        const id = select.value;
        
        if (id === 'novo') {
          document.getElementById('feature-text').value = '';
          document.getElementById('feature-text').focus();
        } else if (id) {
          const item = backlogData.find(b => b.id == id);
          if (item) {
            document.getElementById('feature-text').value = item.feature;
            document.getElementById('fase-select').value = item.fase;
          }
        }
      }
      
      // Gerar comando
      async function gerarComando(e) {
        e.preventDefault();
        document.getElementById('loading').style.display = 'block';
        
        const feature = document.getElementById('feature-text').value;
        const fase = document.getElementById('fase-select').value;
        
        const r = await fetch('/architect', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ feature, fase })
        });
        
        const d = await r.json();
        currentCmd = d.prompt;
        
        document.getElementById('cmdText').textContent = d.prompt;
        document.getElementById('resultado').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
      }
      
      function copiar() {
        navigator.clipboard.writeText(currentCmd);
        alert('Comando copiado! Cole no Lovable.');
      }
      
      async function marcarConcluido() {
        const select = document.getElementById('feature-select');
        const id = select.value;
        
        if (id && id !== 'novo') {
          await atualizarStatus(id, 'concluido');
        }
        
        // Também salvar no tracking da fase
        const fase = document.getElementById('fase-select').value;
        const feature = document.getElementById('feature-text').value;
        
        await fetch('/api/tracking/update', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ fase, nome: feature, status: 'implementado' })
        });
        
        await carregarBacklog();
        alert('✓ Marcado como implementado!');
        
        // Limpar formulário
        document.getElementById('cmdForm').reset();
        document.getElementById('resultado').style.display = 'none';
      }
      
      async function atualizarStatus(id, status) {
        await fetch('/api/backlog/update', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ id, status })
        });
        await carregarBacklog();
      }
      
      async function removerBacklog(id) {
        if (confirm('Remover da fila?')) {
          // Implementar delete se necessário, por agora apenas status 'cancelado'
          await atualizarStatus(id, 'cancelado');
        }
      }
      
      // Inicializar
      carregarInventario();
      carregarBacklog();
    </script>
</body>
</html>
  `);
});

// Webhooks (manter existente)
app.post("/github-webhook", async (req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/", (req, res) => {
  res.redirect('/dashboard');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Architect com Inventário + Backlog rodando em ${PORT}`);
});