import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { requireAuth } from "./auth.js";
import { loadTracking } from "../services/tracking.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Tela de Login (simples HTML readFile)
router.get("/login", (req, res) => {
  const loginHtml = fs.readFileSync(path.join(__dirname, '../views/login.html'), 'utf8');
  const error = req.query.error ? '<div class="error">Usuário ou senha incorretos</div>' : '';
  res.send(loginHtml.replace('{{ERRO}}', error));
});

// Dashboard protegido
router.get("/dashboard", requireAuth, (req, res) => {
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '../views/dashboard.html'), 'utf8');
  const tracking = loadTracking();
  
  // Substituir variáveis no template
  let html = dashboardHtml
    .replace('{{USER}}', req.user)
    .replace('{{FASES_OPTIONS}}', Object.entries(tracking.fases)
      .map(([k,v]) => `<option value="${k}">${k} - ${v.nome}</option>`).join(''))
    .replace('{{FASES_NAV}}', Object.entries(tracking.fases)
      .map(([k,v]) => `<div class="nav-sub-item"><span>${k}</span><span class="count">${v.items.length}</span></div>`).join(''));
    
  res.send(html);
});

export default router;