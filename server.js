// Se tiver user/pass configurado, exige auth
if (process.env.DASHBOARD_USER && process.env.DASHBOARD_PASS) {
  app.use('/dashboard', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).send('Login necessário');
    // ... validar usuario/senha
  });
}
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
// TRACKING (Checklist)
// =========================
const TRACKING_FILE = './project_tracking.json';

function initTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    fs.writeFileSync(TRACKING_FILE, JSON.stringify({
      project: "INDUSALES v4.0",
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
      creditos_estimados: 0,
      creditos_economizados: 0
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
// GERADOR CORRIGIDO (Prompts curtos, comando direto)
// =========================

async function generateLovablePrompt(feature, fase, contexto) {
  // CORREÇÃO: Gera prompts CURTOS (<80 palavras), diretos, sem floreios
  // Estilo: "Crie X. Use Y. NÃO faça Z."
  
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
        content: `Feature: ${feature}\nContexto: ${contexto || 'nenhum'}\n\nGere comando CURTO (max 80 palavras) no estilo do exemplo acima.`
      }
    ],
    max_tokens: 150,  // Força resposta curta (~100-120 palavras no máximo)
    temperature: 0.0  // Zero criatividade, 100% diretividade
  });

  return response.choices[0].message.content;
}

// =========================
// DASHBOARD WEB (Interface)
// =========================

app.get("/dashboard", (req, res) => {
  const tracking = loadTracking();
  
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>INDUSALES Architect - Comandos Diretos</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #f1f5f9;
        min-height: 100vh;
        padding: 20px;
      }
      .container { max-width: 1200px; margin: 0 auto; }
      h1 { color: #f59e0b; text-align: center; margin-bottom: 10px; font-size: 2rem; }
      .subtitle { text-align: center; color: #94a3b8; margin-bottom: 30px; font-size: 14px; }
      
      .info-box {
        background: rgba(16, 185, 129, 0.1);
        border-left: 4px solid #10b981;
        padding: 15px;
        margin-bottom: 30px;
        font-size: 14px;
        border-radius: 0 8px 8px 0;
      }
      
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      
      .card {
        background: rgba(30, 41, 59, 0.9);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 25px;
      }
      .card h2 { color: #3b82f6; margin-bottom: 20px; font-size: 1.2rem; }
      
      .form-group { margin-bottom: 18px; }
      label { display: block; margin-bottom: 6px; color: #cbd5e1; font-size: 14px; font-weight: 600; }
      select, textarea {
        width: 100%;
        padding: 12px;
        background: #0f172a;
        border: 1px solid #475569;
        border-radius: 6px;
        color: #f1f5f9;
        font-size: 14px;
        font-family: inherit;
      }
      textarea { min-height: 120px; resize: vertical; }
      
      .hint {
        font-size: 12px;
        color: #64748b;
        margin-top: 6px;
        font-style: italic;
      }
      
      button.primary {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #0f172a;
        border: none;
        border-radius: 6px;
        font-weight: bold;
        font-size: 16px;
        cursor: pointer;
      }
      button.primary:hover { filter: brightness(1.1); }
      
      .result-box {
        background: #0a0f1d;
        border: 2px solid #334155;
        border-radius: 8px;
        padding: 20px;
        margin-top: 20px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        line-height: 1.6;
        color: #e2e8f0;
        position: relative;
      }
      
      .copy-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 8px 16px;
        background: #f59e0b;
        color: #0f172a;
        border: none;
        border-radius: 4px;
        font-weight: bold;
        cursor: pointer;
        font-size: 13px;
      }
      
      .loading {
        display: none;
        text-align: center;
        padding: 30px;
        color: #f59e0b;
      }
      
      .checklist-item {
        padding: 12px;
        background: rgba(15, 23, 42, 0.6);
        border-radius: 6px;
        margin-bottom: 8px;
        font-size: 14px;
        border-left: 3px solid #334155;
      }
      .checklist-item.done { border-left-color: #10b981; opacity: 0.7; }
    </style>
</head>
<body>
    <div class="container">
      <h1>⌨️ INDUSALES Command Generator</h1>
      <p class="subtitle">Gera comandos diretos para Lovable (sem alucinações)</p>
      
      <div class="info-box">
        <strong>✓ Formato:</strong> Linguagem natural, mas ultra-concisa (estilo comando militar). 
        <br>Exemplo: <em>"Crie /login. Componentes: Input, Button. Dados: tabela X. NÃO crie Y."</em>
        <br><strong>Custo:</strong> 1 crédito por comando no Lovable.
      </div>
      
      <div class="grid">
        <div>
          <div class="card">
            <h2>🎯 Gerar Comando</h2>
            
            <form id="cmdForm">
              <div class="form-group">
                <label>Fase</label>
                <select id="fase" required>
                  <option value="">Selecione...</option>
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
              
              <div class="form-group">
                <label>O que criar (seja específico)</label>
                <textarea id="feature" placeholder="Ex: Formulário de login com email/senha e botão submit. Apenas isso." required></textarea>
                <div class="hint">💡 Quanto mais específico, menos o Lovable "inventa"</div>
              </div>
              
              <div class="form-group">
                <label>Contexto (o que já existe)</label>
                <textarea id="contexto" placeholder="Ex: Já temos a página /dashboard criada."></textarea>
              </div>
              
              <button type="submit" class="primary">⚡ Gerar Comando Direto</button>
            </form>
            
            <div class="loading" id="loading">
              <p>Gerando comando otimizado...</p>
            </div>
            
            <div id="resultado" style="display:none;">
              <div class="result-box" id="cmdText">
                <!-- Comando aparece aqui -->
              </div>
              <button class="copy-btn" onclick="copiar()">📋 Copiar</button>
              <button onclick="salvar()" style="margin-top:10px; width:100%; padding:10px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">
                ✓ Já usei no Lovable (marcar OK)
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <div class="card">
            <h2>📋 Progresso</h2>
            <div id="lista"></div>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      let currentCmd = "";
      let currentFase = "";
      
      async function carregar() {
        const r = await fetch('/api/tracking');
        const d = await r.json();
        const div = document.getElementById('lista');
        div.innerHTML = '';
        
        Object.entries(d.fases).forEach(([n,f]) => {
          if(f.items?.length) {
            const p = document.createElement('div');
            p.style.cssText = 'margin-bottom:15px;';
            p.innerHTML = '<strong style="color:#f59e0b;">Fase '+n+'</strong>';
            
            f.items.forEach(i => {
              const item = document.createElement('div');
              item.className = 'checklist-item ' + (i.status==='ok'?'done':'');
              item.textContent = i.nome.substring(0,40) + (i.nome.length>40?'...':'');
              p.appendChild(item);
            });
            div.appendChild(p);
          }
        });
      }
      
      document.getElementById('cmdForm').onsubmit = async (e) => {
        e.preventDefault();
        document.getElementById('loading').style.display = 'block';
        
        const r = await fetch('/architect', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            fase: document.getElementById('fase').value,
            feature: document.getElementById('feature').value,
            contexto: document.getElementById('contexto').value
          })
        });
        
        const d = await r.json();
        currentCmd = d.prompt;
        currentFase = document.getElementById('fase').value;
        
        document.getElementById('cmdText').textContent = d.prompt;
        document.getElementById('resultado').style.display = 'block';
        document.getElementById('loading').style.display = 'none';
        
        carregar();
      };
      
      function copiar() {
        navigator.clipboard.writeText(currentCmd);
        alert('Copiado! Cole no Lovable e envie.');
      }
      
      async function salvar() {
        await fetch('/api/tracking/update', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            fase: currentFase,
            nome: document.getElementById('feature').value,
            status: 'ok'
          })
        });
        carregar();
        alert('Salvo!');
      }
      
      carregar();
    </script>
</body>
</html>
  `);
});

// APIs
app.get("/api/tracking", (req, res) => {
  res.json(loadTracking());
});

app.post("/api/tracking/update", (req, res) => {
  const { fase, nome, status } = req.body;
  const t = loadTracking();
  if (t.fases[fase]) {
    t.fases[fase].items.push({ nome, status, data: new Date().toISOString() });
    saveTracking(t);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: "Fase inválida" });
  }
});

app.post("/architect", async (req, res) => {
  try {
    const { feature, fase, contexto } = req.body;
    const prompt = await generateLovablePrompt(feature, fase, contexto);
    
    // Salvar
    const t = loadTracking();
    if (t.fases[fase]) {
      t.fases[fase].items.push({ 
        nome: feature.substring(0, 50), 
        status: "gerado", 
        data: new Date().toISOString() 
      });
      saveTracking(t);
    }
    
    res.json({ prompt, custo: "1 crédito Lovable" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Webhooks (manter)
app.post("/github-webhook", async (req, res) => {
  res.status(200).json({ ok: true });
  // ... manter código de review automático aqui ...
});

app.get("/", (req, res) => {
  res.redirect('/dashboard');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Architect (comandos diretos) rodando em ${PORT}`);
});