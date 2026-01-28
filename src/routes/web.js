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
    
    if (!fs.existsSync(loginPath)) {
      console.error("Arquivo login.html não encontrado:", loginPath);
      return res.status(500).send("Erro: Tela de login não encontrada");
    }
    
    let html = fs.readFileSync(loginPath, 'utf8');
    const error = req.query.error ? 
      '<div class="error">Usuário ou senha incorretos</div>' : '';
    html = html.replace('{{ERRO}}', error);
    res.send(html);
  } catch (err) {
    console.error("Erro ao renderizar login:", err);
    res.status(500).send("Erro interno ao carregar login");
  }
});

router.get("/dashboard", requireAuth, (req, res) => {
  try {
    const dashboardPath = path.join(__dirname, '../views/dashboard.html');
    
    if (!fs.existsSync(dashboardPath)) {
      console.error("Arquivo dashboard.html não encontrado:", dashboardPath);
      return res.status(500).send("Erro: Dashboard não encontrado");
    }
    
    let html = fs.readFileSync(dashboardPath, 'utf8');
    const tracking = loadTracking();
    
    html = html
      .replace(/{{USER}}/g, req.user || 'admin')
      .replace('{{FASES_OPTIONS}}', Object.entries(tracking.fases)
        .map(([k,v]) => `<option value="${k}">${k} - ${v.nome}</option>`).join(''))
      .replace('{{FASES_NAV}}', Object.entries(tracking.fases)
        .map(([k,v]) => `<div class="nav-sub-item"><span>${k}</span><span class="count">${v.items.length}</span></div>`).join(''));
    
    res.send(html);
  } catch (err) {
    console.error("Erro ao renderizar dashboard:", err);
    res.status(500).send("Erro interno ao carregar dashboard");
  }
});

export default router;