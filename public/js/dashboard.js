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
// ===== PLANO DE PROJETO (Árvore Hierárquica) =====
let estruturaData = [];

async function carregarEstrutura() {
    try {
        const res = await fetch('/api/estrutura');
        estruturaData = await res.json();
        renderArvore();
    } catch (e) {
        console.error('Erro ao carregar estrutura:', e);
        document.getElementById('arvore-container').innerHTML = 'Erro ao carregar.';
    }
}

function renderArvore() {
    const container = document.getElementById('arvore-container');
    if (!container) return;
    container.innerHTML = buildTreeHTML(estruturaData, 0);
}

function buildTreeHTML(nos, nivel) {
    if (!nos || nos.length === 0) return '';
    
    const indent = nivel * 24; // Indentação em pixels
    let html = `<ul style="list-style:none;padding:0;margin:0;">`;
    
    nos.forEach((no, index) => {
        const temFilhos = no.filhos && no.filhos.length > 0;
        const corCheckbox = no.concluido ? '#10b981' : 'transparent';
        const textDecoration = no.concluido ? 'line-through' : 'none';
        const opacity = no.concluido ? '0.6' : '1';
        
        html += `
            <li style="margin:4px 0;position:relative;">
                <div style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    padding:8px 12px;
                    margin-left:${indent}px;
                    background:rgba(255,255,255,0.03);
                    border:1px solid rgba(255,255,255,0.1);
                    border-radius:8px;
                    transition:all 0.2s;
                    opacity:${opacity};
                " onmouseover="this.style.background='rgba(255,255,255,0.08)'" 
                   onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                    
                    <!-- Expandir/Colapsar -->
                    ${temFilhos ? `
                        <button onclick="toggleExpandido('${no.id}')" 
                                style="background:none;border:none;color:#64748b;cursor:pointer;padding:4px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:0.2s;">
                            <span style="transform:${no.expandido ? 'rotate(90deg)' : 'rotate(0deg)'};transition:transform 0.2s;">▶</span>
                        </button>
                    ` : '<span style="width:24px;"></span>'}
                    
                    <!-- Checkbox -->
                    <div onclick="toggleConcluido('${no.id}')" 
                         style="width:18px;height:18px;border:2px solid #475569;border-radius:4px;cursor:pointer;background:${corCheckbox};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${no.concluido ? '<i data-lucide="check" style="width:12px;color:white;"></i>' : ''}
                    </div>
                    
                    <!-- Título editável -->
                    <span onclick="editarTitulo('${no.id}')" 
                          style="flex:1;cursor:text;text-decoration:${textDecoration};color:${no.concluido ? '#94a3b8' : '#f1f5f9'};font-weight:${nivel === 0 ? '600' : (nivel === 1 ? '500' : '400')};font-size:${nivel === 0 ? '15px' : (nivel === 1 ? '14px' : '13px')};">
                        ${escapeHtml(no.titulo)}
                    </span>
                    
                    <!-- Ações -->
                    <div style="display:flex;gap:4px;opacity:0;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">
                        <button onclick="adicionarFilho('${no.id}')" class="btn btn-sm" style="padding:4px 8px;font-size:11px;" title="Adicionar subtarefa">
                            <i data-lucide="plus" style="width:12px;"></i>
                        </button>
                        <button onclick="removerNo('${no.id}')" class="btn btn-sm" style="padding:4px 8px;font-size:11px;background:rgba(239,68,68,0.2);color:#fca5a5;" title="Remover">
                            <i data-lucide="trash-2" style="width:12px;"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Filhos recursivos -->
                ${(temFilhos && no.expandido) ? buildTreeHTML(no.filhos, nivel + 1) : ''}
            </li>
        `;
    });
    
    // Botão adicionar no nível raiz (apenas no nível 0)
    if (nivel === 0) {
        html += `
            <li style="margin-top:12px;margin-left:${indent}px;">
                <button onclick="adicionarRaiz()" class="btn btn-secondary" style="width:100%;padding:10px;border-style:dashed;">
                    <i data-lucide="plus" style="width:14px;"></i> Adicionar Tarefa Principal
                </button>
            </li>
        `;
    }
    
    html += `</ul>`;
    return html;
}

function findNo(nos, id) {
    for (let no of nos) {
        if (no.id === id) return no;
        if (no.filhos) {
            const found = findNo(no.filhos, id);
            if (found) return found;
        }
    }
    return null;
}

function findParent(nos, id, parent = null) {
    for (let no of nos) {
        if (no.id === id) return parent;
        if (no.filhos) {
            const found = findParent(no.filhos, id, no);
            if (found) return found;
        }
    }
    return null;
}

function toggleExpandido(id) {
    const no = findNo(estruturaData, id);
    if (no) {
        no.expandido = !no.expandido;
        renderArvore();
    }
}

function toggleConcluido(id) {
    const no = findNo(estruturaData, id);
    if (no) {
        no.concluido = !no.concluido;
        // Recursivamente marca/desmarca filhos?
        // marcarFilhos(no, no.concluido);
        renderArvore();
    }
}

function marcarFilhos(no, valor) {
    if (no.filhos) {
        no.filhos.forEach(f => {
            f.concluido = valor;
            marcarFilhos(f, valor);
        });
    }
}

function editarTitulo(id) {
    const no = findNo(estruturaData, id);
    if (!no) return;
    
    const novo = prompt('Editar tarefa:', no.titulo);
    if (novo !== null && novo.trim() !== '') {
        no.titulo = novo.trim();
        renderArvore();
    }
}

function adicionarFilho(parentId) {
    const parent = findNo(estruturaData, parentId);
    if (!parent) return;
    
    if (!parent.filhos) parent.filhos = [];
    
    const novoId = `${parentId}.${parent.filhos.length + 1}`;
    const titulo = prompt('Nome da nova subtarefa:');
    if (titulo && titulo.trim()) {
        parent.filhos.push({
            id: novoId,
            titulo: titulo.trim(),
            concluido: false,
            expandido: false,
            filhos: []
        });
        parent.expandido = true; // Auto-expande
        renderArvore();
    }
}

function adicionarRaiz() {
    const titulo = prompt('Nome da nova tarefa principal:');
    if (titulo && titulo.trim()) {
        const novoId = (estruturaData.length + 1).toString();
        estruturaData.push({
            id: novoId,
            titulo: titulo.trim(),
            concluido: false,
            expandido: true,
            filhos: []
        });
        renderArvore();
    }
}

function removerNo(id) {
    if (!confirm('Tem certeza que deseja remover esta tarefa e todas as subtarefas?')) return;
    
    // Remove do array pai
    function removeRec(nos, id) {
        const idx = nos.findIndex(n => n.id === id);
        if (idx !== -1) {
            nos.splice(idx, 1);
            return true;
        }
        for (let no of nos) {
            if (no.filhos && removeRec(no.filhos, id)) return true;
        }
        return false;
    }
    
    removeRec(estruturaData, id);
    renderArvore();
}

async function salvarEstrutura() {
    try {
        await fetch('/api/estrutura', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ estrutura: estruturaData })
        });
        alert('Estrutura salva com sucesso!');
    } catch (e) {
        alert('Erro ao salvar');
    }
}

async function resetEstrutura() {
    if (!confirm('Isso vai restaurar a estrutura inicial. Continuar?')) return;
    try {
        const res = await fetch('/api/estrutura/reset', { method: 'POST' });
        estruturaData = await res.json();
        renderArvore();
    } catch (e) {
        alert('Erro ao resetar');
    }
}

// Inicialização quando entrar na aba
function initPlanoProjeto() {
    carregarEstrutura();
}