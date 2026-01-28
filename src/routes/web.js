import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "./auth.js";
import { loadTracking } from "../services/tracking.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get("/login", (req, res) => {
  try {
    const loginPath = path.join(__dirname, '../views/login.html');
    console.log("[Web] Carregando login de:", loginPath);
    
    if (!fs.existsSync(loginPath)) {
      console.error("[Web] ERRO: login.html não encontrado!");
      return res.status(500).send("Erro: Tela de login não encontrada no servidor");
    }
    
    let html = fs.readFileSync(loginPath, 'utf8');
    const error = req.query.error ? 
      '<div class="error">Usuário ou senha incorretos</div>' : '';
    html = html.replace('{{ERRO}}', error);
    res.send(html);
    
  } catch (err) {
    console.error("[Web] Erro ao renderizar login:", err.message);
    res.status(500).send("Erro interno ao carregar login: " + err.message);
  }
});

router.get("/dashboard", requireAuth, (req, res) => {
  try {
    console.log("[Web] Iniciando renderização do dashboard...");
    console.log("[Web] Usuário:", req.user);
    
    const dashboardPath = path.join(__dirname, '../views/dashboard.html');
    console.log("[Web] Caminho do dashboard:", dashboardPath);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(dashboardPath)) {
      console.error("[Web] ERRO: dashboard.html não existe em:", dashboardPath);
      return res.status(500).send("Erro: Arquivo dashboard.html não encontrado no servidor");
    }
    
    console.log("[Web] Arquivo existe, lendo conteúdo...");
    let html = fs.readFileSync(dashboardPath, 'utf8');
    console.log("[Web] Arquivo lido, tamanho:", html.length, "caracteres");
    
    // Carregar tracking
    console.log("[Web] Carregando tracking.json...");
    const tracking = loadTracking();
    console.log("[Web] Tracking carregado. Fases:", Object.keys(tracking.fases).join(', '));
    
    // Verificar se tem as variáveis no HTML
    const hasUserVar = html.includes('{{USER}}');
    const hasFasesOptions = html.includes('{{FASES_OPTIONS}}');
    const hasFasesNav = html.includes('{{FASES_NAV}}');
    
    console.log("[Web] Variáveis no template:", {
      USER: hasUserVar,
      FASES_OPTIONS: hasFasesOptions,
      FASES_NAV: hasFasesNav
    });
    
    // Fazer replaces
    console.log("[Web] Substituindo variáveis...");
    html = html.replace(/{{USER}}/g, req.user || 'admin');
    console.log("[Web] User substituído");
    
    const fasesOptions = Object.entries(tracking.fases)
      .map(([k,v]) => `<option value="${k}">${k} - ${v.nome}</option>`)
      .join('');
    html = html.replace('{{FASES_OPTIONS}}', fasesOptions);
    console.log("[Web] FASES_OPTIONS substituído");
    
    const fasesNav = Object.entries(tracking.fases)
      .map(([k,v]) => `<div class="nav-sub-item"><span>${k}</span><span class="count">${v.items.length || 0}</span></div>`)
      .join('');
    html = html.replace('{{FASES_NAV}}', fasesNav);
    console.log("[Web] FASES_NAV substituído");
    
    console.log("[Web] Enviando resposta...");
    res.send(html);
    console.log("[Web] Dashboard enviado com sucesso!");
    
  } catch (err) {
    console.error("[Web] ERRO CRÍTICO no dashboard:", err.message);
    console.error("[Web] Stack:", err.stack);
    res.status(500).send(`
      <h1>Erro ao carregar Dashboard</h1>
      <p>Detalhes técnicos: ${err.message}</p>
      <p>Verifique os logs do servidor para mais informações.</p>
      <a href="/login">Voltar para login</a>
    `);
  }
});

export default router;