import axios from "axios";
import { loadTracking, saveTracking } from "./tracking.js";

export async function atualizarInventarioGitHub() {
  try {
    console.log("[GitHub] Sincronizando repositório...");
    const tracking = loadTracking();
    
    const repoInfo = await axios.get(
      'https://api.github.com/repos/indusales/indusales-connect-sell',
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const defaultBranch = repoInfo.data.default_branch;
    
    const treeRes = await axios.get(
      `https://api.github.com/repos/indusales/indusales-connect-sell/git/trees/${defaultBranch}?recursive=1`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const files = treeRes.data.tree.filter(f => f.type === 'blob');
    
    // Análise de arquivos
    const extensoes = ['.tsx', '.ts', '.jsx', '.js'];
    const codigo = files.filter(f => 
      extensoes.some(ext => f.path.endsWith(ext)) &&
      !f.path.includes('node_modules') &&
      !f.path.includes('.next')
    );
    
    const paginas = codigo.filter(f => {
      const p = f.path.toLowerCase();
      return p.includes('/app/') || p.includes('/pages/') || p.includes('page.') || p.includes('route.');
    }).map(f => ({
      nome: f.path.split('/').pop(),
      caminho: f.path,
      tipo: f.path.includes('page') ? 'page' : (f.path.includes('route') ? 'api' : 'componente')
    }));
    
    const componentes = codigo.filter(f => 
      (f.path.includes('/components/') || f.path.includes('/ui/')) &&
      !f.path.includes('page')
    ).map(f => ({
      nome: f.path.split('/').pop(),
      caminho: f.path
    }));
    
    const sqlFiles = files.filter(f => f.path.endsWith('.sql'));
    
    const commits = await axios.get(
      `https://api.github.com/repos/indusales/indusales-connect-sell/commits?per_page=1&sha=${defaultBranch}`,
      { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } }
    );
    
    const ultimo = commits.data[0];
    
    tracking.inventario = {
      paginas,
      componentes,
      apis: codigo.filter(f => f.path.includes('/api/')).map(f => ({ nome: f.path.split('/').pop(), caminho: f.path })),
      tabelas: sqlFiles.map(f => f.path),
      stats: { total_codigo: codigo.length, paginas: paginas.length, componentes: componentes.length },
      branch: defaultBranch,
      ultimo_commit: ultimo ? {
        mensagem: ultimo.commit.message,
        autor: ultimo.commit.author.name,
        data: ultimo.commit.author.date,
        sha: ultimo.sha.substring(0, 7)
      } : null,
      atualizado_em: new Date().toISOString()
    };
    
    saveTracking(tracking);
    console.log(`[GitHub] OK: ${paginas.length} páginas, ${componentes.length} componentes`);
    return tracking.inventario;
    
  } catch (error) {
    console.error("[GitHub] Erro:", error.response?.status, error.message);
    return null;
  }
}