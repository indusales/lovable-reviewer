import express from "express";
import { requireAuth } from "./auth.js";
import { loadTracking, saveTracking } from "../services/tracking.js";
import { atualizarInventarioGitHub } from "../services/github.js";
import { generateLovablePrompt } from "../services/openai.js";

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
// Modelo: { id, titulo, concluido, filhos: [], expandido }

router.get("/estrutura", (req, res) => {
  const tracking = loadTracking();
  if (!tracking.estrutura) {
    // Dados iniciais baseados nos documentos
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

function getEstruturaInicial() {
  return [
    {
      id: "1",
      titulo: "1. Hierarquia e Autenticação",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "1.1",
          titulo: "1.1 Perfis de Usuário",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.1.1", titulo: "Admin Indusales (Super Admin)", concluido: false, filhos: [] },
            { id: "1.1.2", titulo: "Admin Fabricante", concluido: false, filhos: [] },
            { id: "1.1.3", titulo: "Gerente Fabricante", concluido: false, filhos: [] },
            { id: "1.1.4", titulo: "Revendedor", concluido: false, filhos: [] },
            { id: "1.1.5", titulo: "Cliente Final", concluido: false, filhos: [] }
          ]
        },
        {
          id: "1.2",
          titulo: "1.2 Autenticação e 2FA",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.2.1", titulo: "Login JWT", concluido: false, filhos: [] },
            { id: "1.2.2", titulo: "Google Authenticator (TOTP)", concluido: false, filhos: [] },
            { id: "1.2.3", titulo: "Códigos de Backup", concluido: false, filhos: [] }
          ]
        },
        {
          id: "1.3",
          titulo: "1.3 Workflow de Aprovações",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.3.1", titulo: "Aprovação Indusales (Triagem)", concluido: false, filhos: [] },
            { id: "1.3.2", titulo: "Aprovação Fabricante-Revendedor", concluido: false, filhos: [] },
            { id: "1.3.3", titulo: "Bloqueio automático (120 dias)", concluido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "2",
      titulo: "2. Catálogo e Produtos",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "2.1",
          titulo: "2.1 Multi-Estoque (Warehouse)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.1.1", titulo: "Cadastro de CD/Matriz/Filiais", concluido: false, filhos: [] },
            { id: "2.1.2", titulo: "Sync de saldos", concluido: false, filhos: [] },
            { id: "2.1.3", titulo: "Visão consolidada revendedor", concluido: false, filhos: [] }
          ]
        },
        {
          id: "2.2",
          titulo: "2.2 Sistema de Reservas",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.2.1", titulo: "Reserva TTL 1h", concluido: false, filhos: [] },
            { id: "2.2.2", titulo: "Liberação automática", concluido: false, filhos: [] },
            { id: "2.2.3", titulo: "Notificação fabricante", concluido: false, filhos: [] }
          ]
        },
        {
          id: "2.3",
          titulo: "2.3 White Label",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.3.1", titulo: "Score mínimo participação", concluido: false, filhos: [] },
            { id: "2.3.2", titulo: "Catalogo unificado", concluido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "3",
      titulo: "3. Vendas e Financeiro",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "3.1",
          titulo: "3.1 Sistema de Fiado (Credit)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.1.1", titulo: "Limite por cliente", concluido: false, filhos: [] },
            { id: "3.1.2", titulo: "Prazos 7/15/30 dias", concluido: false, filhos: [] },
            { id: "3.1.3", titulo: "Cobrança automática", concluido: false, filhos: [] },
            { id: "3.1.4", titulo: "Notificações D-1/D-Day", concluido: false, filhos: [] }
          ]
        },
        {
          id: "3.2",
          titulo: "3.2 Pagamentos",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.2.1", titulo: "PIX", concluido: false, filhos: [] },
            { id: "3.2.2", titulo: "Cartão (split)", concluido: false, filhos: [] },
            { id: "3.2.3", titulo: "Boleto", concluido: false, filhos: [] }
          ]
        },
        {
          id: "3.3",
          titulo: "3.3 Garantias",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.3.1", titulo: "PDF com QR Code", concluido: false, filhos: [] },
            { id: "3.3.2", titulo: "Validação online", concluido: false, filhos: [] },
            { id: "3.3.3", titulo: "Regras por tipo (1a, 6m, 3m)", concluido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "4",
      titulo: "4. CRM e Comunicação",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "4.1",
          titulo: "4.1 CRM do Revendedor",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "4.1.1", titulo: "Cadastro clientes", concluido: false, filhos: [] },
            { id: "4.1.2", titulo: "Histórico compras", concluido: false, filhos: [] },
            { id: "4.1.3", titulo: "Tags e segmentação", concluido: false, filhos: [] }
          ]
        },
        {
          id: "4.2",
          titulo: "4.2 Notificações",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "4.2.1", titulo: "WhatsApp Business API", concluido: false, filhos: [] },
            { id: "4.2.2", titulo: "Email transacional", concluido: false, filhos: [] },
            { id: "4.2.3", titulo: "Push notifications", concluido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "5",
      titulo: "5. Hardware & Futuro",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "5.1",
          titulo: "5.1 Indusales Pay (POS)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "5.1.1", titulo: "Smart POS com catálogo", concluido: false, filhos: [] },
            { id: "5.1.2", titulo: "Dual Stock (Local/Fábrica)", concluido: false, filhos: [] },
            { id: "5.1.3", titulo: "Sync offline-first", concluido: false, filhos: [] }
          ]
        },
        {
          id: "5.2",
          titulo: "5.2 Calendário Promocional",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "5.2.1", titulo: "Feriados automáticos", concluido: false, filhos: [] },
            { id: "5.2.2", titulo: "Alertas D-30", concluido: false, filhos: [] },
            { id: "5.2.3", titulo: "Agendamento posts", concluido: false, filhos: [] }
          ]
        }
      ]
    }
  ];
}

export default router;