import fs from "fs";

const TRACKING_FILE = './project_tracking.json';

export function inicializarTracking() {
  if (!fs.existsSync(TRACKING_FILE)) {
    fs.writeFileSync(TRACKING_FILE, JSON.stringify({
      project: "INDUSALES v5.0",
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

export function loadTracking() {
  return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
}

export function saveTracking(data) {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
}