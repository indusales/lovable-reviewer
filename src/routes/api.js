import express from "express";
import { requireAuth } from "./auth.js";
import { loadTracking, saveTracking } from "../services/tracking.js";
import { atualizarInventarioGitHub } from "../services/github.js";
import { generateLovablePrompt } from "../services/openai.js";
import { getEstruturaInicial } from "../data/estrutura.js";

const router = express.Router();

router.use(requireAuth);

router.get("/teste-github", async (req, res) => {
  res.json({ status: "OK", user: req.user });
});

router.get("/inventario", async (req, res) => {
  const tracking = loadTracking();
  const umaHora = 60 * 60 * 1000;
  const deveAtualizar = !tracking.inventario?.atualizado_em || 
    (new Date() - new Date(tracking.inventario.atualizado_em)) > umaHora;
    
  if (deveAtualizar) {
    const inv = await atualizarInventarioGitHub();
    res.json(inv || tracking.inventario);
  } else {
    res.json(tracking.inventario);
  }
});

router.post("/inventario/refresh", async (req, res) => {
  const inv = await atualizarInventarioGitHub();
  res.json(inv || { error: "Falha" });
});

router.get("/backlog", (req, res) => {
  res.json(loadTracking().backlog || []);
});

router.post("/backlog/add", (req, res) => {
  const { feature, fase, prioridade = "media", descricao = "" } = req.body;
  const tracking = loadTracking();
  
  tracking.backlog.push({
    id: Date.now().toString(),
    feature, descricao, fase, prioridade,
    status: "pendente",
    criado_em: new Date().toISOString()
  });
  
  saveTracking(tracking);
  res.json({ success: true });
});

router.post("/backlog/update", (req, res) => {
  const { id, status } = req.body;
  const tracking = loadTracking();
  const item = tracking.backlog.find(b => b.id === id);
  
  if (item) {
    item.status = status;
    if (status === 'concluido') item.concluido_em = new Date().toISOString();
    saveTracking(tracking);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Não encontrado" });
  }
});

router.get("/tracking", (req, res) => {
  res.json(loadTracking());
});

router.post("/tracking/update", (req, res) => {
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

router.post("/architect", async (req, res) => {
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
      saveTracking(tracking);
    }
    
    res.json({ prompt, custo: "1 crédito" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== ESTRUTURA DO PROJETO (Hierárquica) =====

router.get("/estrutura", (req, res) => {
  const tracking = loadTracking();
  if (!tracking.estrutura) {
    tracking.estrutura = getEstruturaInicial();
    saveTracking(tracking);
  }
  res.json(tracking.estrutura);
});

router.post("/estrutura", (req, res) => {
  const { estrutura } = req.body;
  const tracking = loadTracking();
  tracking.estrutura = estrutura;
  saveTracking(tracking);
  res.json({ success: true });
});

router.post("/estrutura/reset", (req, res) => {
  const tracking = loadTracking();
  tracking.estrutura = getEstruturaInicial();
  saveTracking(tracking);
  res.json(tracking.estrutura);
});

export default router;