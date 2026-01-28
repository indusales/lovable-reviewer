// Estado global
let backlogData = [];
let inventarioData = null;
let currentCommand = null;
let currentBacklogId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadData();
});

async function loadData() {
    await Promise.all([loadInventario(), loadBacklog()]);
    updateStats();
}

// Carregar Inventário
async function loadInventario() {
    try {
        const res = await fetch('/api/inventario');
        const data = await res.json();
        inventarioData = data;
        
        const container = document.getElementById('inventario-list');
        
        if (!data.paginas || data.paginas.length === 0) {
            container.innerHTML = '<div class="loading">Nenhum arquivo encontrado. Clique em Sync.</div>';
            return;
        }
        
        // Agrupar por diretório
        const grupos = {};
        data.paginas.forEach(p => {
            const dir = p.caminho.split('/').slice(0, -1).join('/') || 'raiz';
            if (!grupos[dir]) grupos[dir] = [];
            grupos[dir].push(p);
        });
        
        let html = '';
        if (data.ultimo_commit) {
            html += `
                <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:16px; border-radius:12px; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:13px; color:#60a5fa;">
                        <i data-lucide="git-commit" style="width:16px;"></i>
                        <strong>${data.ultimo_commit.sha}</strong>
                    </div>
                    <p style="font-size:13px; color:var(--text-muted); margin:0;">${data.ultimo_commit.mensagem.substring(0, 100)}...</p>
                    <small style="color:#64748b; font-size:11px;">${data.ultimo_commit.autor} • ${new Date(data.ultimo_commit.data).toLocaleDateString()}</small>
                </div>
            `;
        }
        
        Object.entries(grupos).slice(0, 4).forEach(([dir, arquivos]) => {
            html += `<div style="margin-bottom:16px;"><div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px; letter-spacing:1px;">${dir}</div>`;
            arquivos.slice(0, 5).forEach(arq => {
                const tipo = arq.tipo || 'page';
                const badgeClass = tipo === 'page' ? 'badge-page' : 'badge-component';
                html += `
                    <div class="item">
                        <div class="item-info">
                            <span class="item-name">${arq.nome}</span>
                            <span class="item-path">${arq.caminho}</span>
                        </div>
                        <span class="item-badge ${badgeClass}">${tipo}</span>
                    </div>
                `;
            });
            if (arquivos.length > 5) html += `<div style="text-align:center; padding:8px; font-size:12px; color:var(--text-muted);">+${arquivos.length - 5} arquivos</div>`;
            html += '</div>';
        });
        
        container.innerHTML = html;
        lucide.createIcons();
        
    } catch (err) {
        console.error('Erro ao carregar inventário:', err);
    }
}

// Carregar Backlog
async function loadBacklog() {
    try {
        const res = await fetch('/api/backlog');
        const data = await res.json();
        backlogData = data.filter(b => b.status !== 'concluido' && b.status !== 'cancelado');
        
        renderBacklog();
        populateSelect();
        
    } catch (err) {
        console.error('Erro ao carregar backlog:', err);
    }
}

function renderBacklog() {
    const container = document.getElementById('backlog-list');
    const select = document.getElementById('select-backlog');
    
    // Limpar opções mantendo as 2 primeiras
    while (select.options.length > 2) select.remove(2);
    
    if (backlogData.length === 0) {
        container.innerHTML = '<div class="loading">Nenhuma tarefa na fila. Clique em "+ Novo" para adicionar.</div>';
        return;
    }
    
    let html = '';
    backlogData.forEach(item => {
        const pClass = item.prioridade === 'alta' ? 'p-alta' : (item.prioridade === 'media' ? 'p-media' : 'p-baixa');
        
        html += `
            <div class="backlog-item">
                <div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="priority-dot ${pClass}"></span>
                        <strong style="font-size:14px;">${item.feature.substring(0, 40)}</strong>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:6px;">
                        <span style="background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; font-size:11px; color:var(--text-muted);">Fase ${item.fase}</span>
                        ${item.status === 'em-desenvolvimento' ? '<span style="font-size:11px; color:#fbbf24;">● Em desenvolvimento</span>' : ''}
                    </div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="usarBacklog('${item.id}')">Usar</button>
            </div>
        `;
        
        // Adicionar ao select
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.text = item.feature.substring(0, 35);
        select.add(opt);
    });
    
    container.innerHTML = html;
}

function populateSelect() {
    // Já feito em renderBacklog
}

function handleBacklogChange() {
    const id = document.getElementById('select-backlog').value;
    const customDiv = document.getElementById('custom-input');
    
    if (id === 'custom') {
        customDiv.style.display = 'block';
        document.getElementById('feature-desc').focus();
    } else if (id) {
        customDiv.style.display = 'none';
        const item = backlogData.find(b => b.id === id);
        if (item) {
            document.getElementById('select-fase').value = item.fase;
            currentBacklogId = id;
        }
    } else {
        customDiv.style.display = 'none';
    }
}

function usarBacklog(id) {
    document.getElementById('select-backlog').value = id;
    handleBacklogChange();
    document.getElementById('gerador').scrollIntoView({ behavior: 'smooth' });
}

// Gerar Comando
async function gerarComando(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Gerando...';
    lucide.createIcons();
    
    const backlogSelect = document.getElementById('select-backlog');
    const id = backlogSelect.value;
    let feature;
    
    if (id === 'custom' || !id) {
        feature = document.getElementById('feature-desc').value;
    } else {
        const item = backlogData.find(b => b.id === id);
        feature = item ? item.feature : document.getElementById('feature-desc').value;
    }
    
    const fase = document.getElementById('select-fase').value;
    
    try {
        const res = await fetch('/api/architect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feature, fase })
        });
        
        const data = await res.json();
        currentCommand = data.prompt;
        
        document.getElementById('comando-texto').textContent = data.prompt;
        document.getElementById('resultado').style.display = 'block';
        document.getElementById('resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (err) {
        alert('Erro ao gerar comando');
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

function copiarComando() {
    if (!currentCommand) return;
    navigator.clipboard.writeText(currentCommand);
    const btn = document.querySelector('#resultado .btn-secondary');
    btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
    setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy"></i> Copiar';
        lucide.createIcons();
    }, 2000);
}

function novoComando() {
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('gerador-form').reset();
    document.getElementById('custom-input').style.display = 'none';
    currentBacklogId = null;
}

async function marcarConcluido() {
    if (!currentBacklogId) {
        novoComando();
        return;
    }
    
    await fetch('/api/backlog/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentBacklogId, status: 'concluido' })
    });
    
    await loadBacklog();
    novoComando();
    showToast('Tarefa marcada como concluída!');
}

// Modal
function openAddModal() {
    document.getElementById('modal-add').classList.add('active');
}

function closeModal() {
    document.getElementById('modal-add').classList.remove('active');
}

async function addToBacklog(e) {
    e.preventDefault();
    const feature = document.getElementById('new-feature').value;
    const fase = document.getElementById('new-fase').value;
    const prioridade = document.getElementById('new-priority').value;
    
    await fetch('/api/backlog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, fase, prioridade })
    });
    
    closeModal();
    e.target.reset();
    await loadBacklog();
    showToast('Adicionado à fila!');
}

// Sync
async function syncGitHub() {
    const btn = document.querySelector('.btn-outline');
    btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Sincronizando...';
    lucide.createIcons();
    
    await fetch('/api/inventario/refresh', { method: 'POST' });
    await loadInventario();
    updateStats();
    
    btn.innerHTML = '<i data-lucide="refresh-cw"></i> Sync GitHub';
    lucide.createIcons();
    showToast('Inventário atualizado!');
}

function updateStats() {
    if (!inventarioData) return;
    document.getElementById('stats-files').textContent = `${inventarioData.stats?.total_codigo || 0} arquivos`;
    document.getElementById('last-sync').textContent = inventarioData.atualizado_em 
        ? new Date(inventarioData.atualizado_em).toLocaleTimeString() 
        : 'Nunca';
}

function scrollToSection(id) {
    document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function showToast(msg) {
    // Implementação simples de toast
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#10b981; color:white; padding:12px 24px; border-radius:8px; font-weight:500; z-index:9999; animation:fadeIn 0.3s;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Animação CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .animate-spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
document.head.appendChild(style);