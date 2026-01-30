// src/data/estrutura.js - Estrutura do Projeto INDUSALES v4.0 (Reorganizado MVP vs Futuro)

export function getEstruturaInicial() {
  return [
    {
      id: "1",
      titulo: "📋 1. Hierarquia e Autenticação",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "1.1",
          titulo: "1.1 Perfis de Usuário",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.1.1", titulo: "Super Admin Indusales", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.2", titulo: "Admin Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.3", titulo: "Gerente Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.4", titulo: "Atendente Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.5", titulo: "Financeiro Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.6", titulo: "Revendedor (B2B2C)", concluido: false, expandido: false, filhos: [] },
            { id: "1.1.7", titulo: "Cliente Final (Consumidor)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "1.2",
          titulo: "1.2 Workflow de Aprovações Dupla",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.2.1", titulo: "Triagem Indusales (Documentação)", concluido: false, expandido: false, filhos: [] },
            { id: "1.2.2", titulo: "Vínculo Fabricante-Revendedor", concluido: false, expandido: false, filhos: [] },
            { id: "1.2.3", titulo: "Visibilidade de Preços (Pós-aprovação)", concluido: false, expandido: false, filhos: [] },
            { id: "1.2.4", titulo: "Inatividade 4 Meses + Cobrança por Ativo", concluido: false, expandido: false, filhos: [
              { id: "1.2.4.1", titulo: "Bloqueio automático após 120 dias sem login", concluido: false, expandido: false, filhos: [] },
              { id: "1.2.4.2", titulo: "Modelo de billing: paga apenas por revendedor ativo", concluido: false, expandido: false, filhos: [] }
            ]}
          ]
        },
        {
          id: "1.3",
          titulo: "1.3 Segurança e 2FA",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "1.3.1", titulo: "Autenticação JWT +RBAC", concluido: false, expandido: false, filhos: [] },
            { id: "1.3.2", titulo: "TOTP (Google Authenticator)", concluido: false, expandido: false, filhos: [] },
            { id: "1.3.3", titulo: "Códigos de Backup (Recovery)", concluido: false, expandido: false, filhos: [] },
            { id: "1.3.4", titulo: "Criptografia AES-256 (LGPD)", concluido: false, expandido: false, filhos: [] },
            { id: "1.3.5", titulo: "Rate Limiting + Audit Logs", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "2",
      titulo: "⚙️ 2. Arquitetura de Microserviços",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "2.1",
          titulo: "2.1 Core Services",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.1.1", titulo: "identity-svc (Auth 2FA RBAC) :3000", concluido: false, expandido: false, filhos: [] },
            { id: "2.1.2", titulo: "catalog-svc (Produtos/Estoque) :3002", concluido: false, expandido: false, filhos: [] },
            { id: "2.1.3", titulo: "order-svc (Pedidos/Carrinho) :3003", concluido: false, expandido: false, filhos: [] },
            { id: "2.1.4", titulo: "payment-svc (PIX/Controle Simples) :3004", concluido: false, expandido: false, filhos: [] },
            { id: "2.1.5", titulo: "notification-svc (WhatsApp/Email) :3006", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "2.2",
          titulo: "2.2 Serviços de Suporte",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.2.1", titulo: "crm-svc (Clientes Revendedor) :3016", concluido: false, expandido: false, filhos: [] },
            { id: "2.2.2", titulo: "approval-svc (Workflow) :3020", concluido: false, expandido: false, filhos: [] },
            { id: "2.2.3", titulo: "calendar-svc (Feriados/Campanhas) :3023", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "2.3",
          titulo: "2.3 Banco de Dados Multi-Tenant",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "2.3.1", titulo: "PostgreSQL (Tenant Isolamento)", concluido: false, expandido: false, filhos: [] },
            { id: "2.3.2", titulo: "Redis (Cache/Sessions)", concluido: false, expandido: false, filhos: [] },
            { id: "2.3.3", titulo: "MongoDB (Logs Auditoria)", concluido: false, expandido: false, filhos: [] },
            { id: "2.3.4", titulo: "S3 (Imagens/PDFs)", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "3",
      titulo: "📦 3. Catálogo e Estoque",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "3.1",
          titulo: "3.1 Multi-Warehouse Básico",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.1.1", titulo: "Cadastro Matriz/Filiais", concluido: false, expandido: false, filhos: [] },
            { id: "3.1.2", titulo: "Visão Consolidada Revendedor (Aprovados)", concluido: false, expandido: false, filhos: [] },
            { id: "3.1.3", titulo: "Estoque Simples (Sem Lock)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "3.2",
          titulo: "3.2 Marketplace Público (Core)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.2.1", titulo: "Diretório Público de Fabricantes", concluido: false, expandido: false, filhos: [] },
            { id: "3.2.2", titulo: "Filtros: Categoria, Localização, Rating", concluido: false, expandido: false, filhos: [] },
            { id: "3.2.3", titulo: "Perfil Público com Avaliações", concluido: false, expandido: false, filhos: [] },
            { id: "3.2.4", titulo: "Solicitação de Vínculo (Matchmaking)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "3.3",
          titulo: "3.3 White Label Unificado (Definição Pendente)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "3.3.1", titulo: "Score Mínimo Participação (8.0)", concluido: false, expandido: false, filhos: [] },
            { id: "3.3.2", titulo: "Catálogo Multi-Fabricante (Conceito)", concluido: false, expandido: false, filhos: [] },
            { id: "3.3.3", titulo: "Logística Cross-Docking (Conceito)", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "4",
      titulo: "💰 4. Vendas e Financeiro (MVP)",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "4.1",
          titulo: "4.1 Pagamentos Digitais",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "4.1.1", titulo: "PIX (QR Code + Copia/Cola)", concluido: false, expandido: false, filhos: [] },
            { id: "4.1.2", titulo: "Confirmação Manual de Pagamentos", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "4.2",
          titulo: "4.2 Gestão de Acertos (Consignação)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "4.2.1", titulo: "Controle Peças Enviadas (Manual)", concluido: false, expandido: false, filhos: [] },
            { id: "4.2.2", titulo: "Acerto Simplificado (Fora do sistema em MVP)", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "5",
      titulo: "👥 5. CRM e Comunicação",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "5.1",
          titulo: "5.1 CRM do Revendedor",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "5.1.1", titulo: "Cadastro Clientes Finais", concluido: false, expandido: false, filhos: [] },
            { id: "5.1.2", titulo: "Histórico de Compras", concluido: false, expandido: false, filhos: [] },
            { id: "5.1.3", titulo: "Tags (VIP, Atrasado, Novo)", concluido: false, expandido: false, filhos: [] },
            { id: "5.1.4", titulo: "Importação CSV", concluido: false, expandido: false, filhos: [] },
            { id: "5.1.5", titulo: "Anotações Privadas", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "5.2",
          titulo: "5.2 Mensageria Omnichannel",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "5.2.1", titulo: "Evolution API (WhatsApp Business)", concluido: false, expandido: false, filhos: [] },
            { id: "5.2.2", titulo: "Email Transacional (SMTP)", concluido: false, expandido: false, filhos: [] },
            { id: "5.2.3", titulo: "Templates Automáticos", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "7",
      titulo: "📅 7. Marketing e Calendário",
      concluido: false, 
      expandido: false,
      filhos: [
        {
          id: "7.1",
          titulo: "7.1 Calendário Promocional (Campanhas)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "7.1.1", titulo: "Feriados Nacionais Automáticos", concluido: false, expandido: false, filhos: [] },
            { id: "7.1.2", titulo: "Alertas D-30 (Preparação de Estoque)", concluido: false, expandido: false, filhos: [] },
            { id: "7.1.3", titulo: "Cálculo Automático Datas Móveis (Páscoa)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "7.2",
          titulo: "7.2 Datas Comemorativas Principais",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "7.2.1", titulo: "Dia das Mães (12/05) - Semi-jóias", concluido: false, expandido: false, filhos: [] },
            { id: "7.2.2", titulo: "Dia dos Pais (11/08) - Relógios", concluido: false, expandido: false, filhos: [] },
            { id: "7.2.3", titulo: "Natal (25/12) - Presentes", concluido: false, expandido: false, filhos: [] },
            { id: "7.2.4", titulo: "Black Friday (15/11) - Liquidação", concluido: false, expandido: false, filhos: [] },
            { id: "7.2.5", titulo: "Dia do Consumidor (15/03)", concluido: false, expandido: false, filhos: [] },
            { id: "7.2.6", titulo: "Páscoa (Móvel) - Família", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "8",
      titulo: "🚀 8. Roadmap e Implementação (Fases)",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "8.1",
          titulo: "8.1 Fase 1.1: Hierarquia e Aprovações",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "8.1.1", titulo: "approval-svc workflow", concluido: false, expandido: false, filhos: [] },
            { id: "8.1.2", titulo: "RBAC granular por perfil", concluido: false, expandido: false, filhos: [] },
            { id: "8.1.3", titulo: "Tela vínculo Fab-Rev", concluido: false, expandido: false, filhos: [] },
            { id: "8.1.4", titulo: "Regra inatividade 4 meses", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "8.2",
          titulo: "8.2 Fase 1.2: CRM e Clientes",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "8.2.1", titulo: "crud-svc cadastro clientes", concluido: false, expandido: false, filhos: [] },
            { id: "8.2.2", titulo: "Histórico compras", concluido: false, expandido: false, filhos: [] },
            { id: "8.2.3", titulo: "Sistema tags/segmentação", concluido: false, expandido: false, filhos: [] },
            { id: "8.2.4", titulo: "Importação CSV", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "8.3",
          titulo: "8.3 Fase 1.3: Catálogo e Marketplace",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "8.3.1", titulo: "Diretório público fabricantes", concluido: false, expandido: false, filhos: [] },
            { id: "8.3.2", titulo: "Sistema de avaliações 0-10", concluido: false, expandido: false, filhos: [] },
            { id: "8.3.3", titulo: "Matchmaking Fab-Rev", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "8.4",
          titulo: "8.4 Fase 1.4: Estoque Básico",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "8.4.1", titulo: "Multi-warehouse cadastro", concluido: false, expandido: false, filhos: [] },
            { id: "8.4.2", titulo: "Visão consolidada", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "8.5",
          titulo: "8.5 Checklist Compliance",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "8.5.1", titulo: "2FA obrigatório admins", concluido: false, expandido: false, filhos: [] },
            { id: "8.5.2", titulo: "Logs auditoria append-only", concluido: false, expandido: false, filhos: [] },
            { id: "8.5.3", titulo: "LGPD consentimento", concluido: false, expandido: false, filhos: [] },
            { id: "8.5.4", titulo: "Isolamento tenant 100%", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "9",
      titulo: "📱 9. Social Media Hub (Meta + WhatsApp)",
      concluido: false,
      expandido: true,
      filhos: [
        {
          id: "9.1",
          titulo: "9.1 Integrações Core",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "9.1.1", titulo: "Evolution API (WhatsApp Business)", concluido: false, expandido: false, filhos: [] },
            { id: "9.1.2", titulo: "Meta Business API (IG/FB)", concluido: false, expandido: false, filhos: [] },
            { id: "9.1.3", titulo: "OAuth2 Conexão Contas Sociais", concluido: false, expandido: false, filhos: [] },
            { id: "9.1.4", titulo: "Webhooks Status Publicação", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "9.2",
          titulo: "9.2 Módulo Fabricante (B2B)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "9.2.1", titulo: "Calendário Visual de Posts (Drag & Drop)", concluido: false, expandido: false, filhos: [] },
            { id: "9.2.2", titulo: "Criador de Conteúdo (Imagem + Copy + Hashtags)", concluido: false, expandido: false, filhos: [] },
            { id: "9.2.3", titulo: "Publicação Direta nas Redes do Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "9.2.4", titulo: "Enviar para Revendedores (Push Agenda)", concluido: false, expandido: false, filhos: [] },
            { id: "9.2.5", titulo: "Analytics Básico (Views, Likes, Compartilhamentos)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "9.3",
          titulo: "9.3 Módulo Revendedor (B2B2C)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "9.3.1", titulo: "Caixa de Entrada (Posts Recebidos)", concluido: false, expandido: false, filhos: [] },
            { id: "9.3.2", titulo: "Aprovar/Rejeitar Posts do Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "9.3.3", titulo: "Criar Posts Próprios (Agenda Pessoal)", concluido: false, expandido: false, filhos: [] },
            { id: "9.3.4", titulo: "Visualizar Calendário Consolidado", concluido: false, expandido: false, filhos: [] },
            { id: "9.3.5", titulo: "Auto-post nas Redes do Revendedor", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "9.4",
          titulo: "9.4 Fluxo de Aprovação B2B2C",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "9.4.1", titulo: "Status: Pendente → Aprovado → Agendado", concluido: false, expandido: false, filhos: [] },
            { id: "9.4.2", titulo: "Notificação WhatsApp (Novo Post Recebido)", concluido: false, expandido: false, filhos: [] },
            { id: "9.4.3", titulo: "Templates Editáveis (revendedor customiza)", concluido: false, expandido: false, filhos: [] },
            { id: "9.4.4", titulo: "Bulk Actions (Aprovar múltiplos)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "9.5",
          titulo: "9.5 Technical Stack Social",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "9.5.1", titulo: "social-svc (Porta 3024) - Microserviço", concluido: false, expandido: false, filhos: [] },
            { id: "9.5.2", titulo: "Queue BullMQ (Agendamentos)", concluido: false, expandido: false, filhos: [] },
            { id: "9.5.3", titulo: "Redis (Cache de Imagens/Mídia)", concluido: false, expandido: false, filhos: [] },
            { id: "9.5.4", titulo: "Storage S3 (Assets de Mídia)", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    },
    {
      id: "10",
      titulo: "🔮 10. Futuro e Expansão (Pós-MVP)",
      concluido: false,
      expandido: false,
      filhos: [
        {
          id: "10.1",
          titulo: "10.1 Smart POS (Indusales Pay)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.1.1", titulo: "Tela HD 10 Android/Linux", concluido: false, expandido: false, filhos: [] },
            { id: "10.1.2", titulo: "Catálogo Digital Integrado", concluido: false, expandido: false, filhos: [] },
            { id: "10.1.3", titulo: "Leitor NFC/Chip + Impressora 58mm", concluido: false, expandido: false, filhos: [] },
            { id: "10.1.4", titulo: "Dual Stock (Local/Fábrica)", concluido: false, expandido: false, filhos: [] },
            { id: "10.1.5", titulo: "Sync Offline-First (SQLite Local)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "10.2",
          titulo: "10.2 POS Sync Service",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.2.1", titulo: "WebSocket Socket.io", concluido: false, expandido: false, filhos: [] },
            { id: "10.2.2", titulo: "Cache Local 72h Offline", concluido: false, expandido: false, filhos: [] },
            { id: "10.2.3", titulo: "Reconciliação Conflitos", concluido: false, expandido: false, filhos: [] },
            { id: "10.2.4", titulo: "Rastreamento GPS Anti-fraude", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "10.3",
          titulo: "10.3 Sistema de Fiado (Credit)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.3.1", titulo: "Limite de Crédito por Cliente", concluido: false, expandido: false, filhos: [] },
            { id: "10.3.2", titulo: "Prazos: 7, 15, 30 dias", concluido: false, expandido: false, filhos: [] },
            { id: "10.3.3", titulo: "Parcela Única (Sem Juros)", concluido: false, expandido: false, filhos: [] },
            { id: "10.3.4", titulo: "Cobrança Auto (D-1, D-Day, D+3, D+7)", concluido: false, expandido: false, filhos: [] },
            { id: "10.3.5", titulo: "Bloqueio ao Atingir Limite", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "10.4",
          titulo: "10.4 Reservas TTL Avançado",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.4.1", titulo: "reservation-svc Go (TTL 1h)", concluido: false, expandido: false, filhos: [] },
            { id: "10.4.2", titulo: "Lock Máx 5 SKUs por Revendedor", concluido: false, expandido: false, filhos: [] },
            { id: "10.4.3", titulo: "Liberação Automática Redis", concluido: false, expandido: false, filhos: [] },
            { id: "10.4.4", titulo: "Notificação Fabricante Urgente", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "10.5",
          titulo: "10.5 Pagamentos Avançados",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.5.1", titulo: "Cartão Crédito (Split)", concluido: false, expandido: false, filhos: [] },
            { id: "10.5.2", titulo: "Boleto Bancário", concluido: false, expandido: false, filhos: [] },
            { id: "10.5.3", titulo: "Maquininhas (SumUp/Cielo/MP)", concluido: false, expandido: false, filhos: [] }
          ]
        },
        {
          id: "10.6",
          titulo: "10.6 White Label Unificado (Multi-Fabricante)",
          concluido: false,
          expandido: false,
          filhos: [
            { id: "10.6.1", titulo: "Score Mínimo Participação (8.0)", concluido: false, expandido: false, filhos: [] },
            { id: "10.6.2", titulo: "Catálogo Unificado Multi-Fabricante", concluido: false, expandido: false, filhos: [] },
            { id: "10.6.3", titulo: "Embalagens Padronizadas", concluido: false, expandido: false, filhos: [] },
            { id: "10.6.4", titulo: "Logística Cross-Docking", concluido: false, expandido: false, filhos: [] }
          ]
        }
      ]
    }
  ];
}