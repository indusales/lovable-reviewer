import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./src/routes/auth.js";
import apiRoutes from "./src/routes/api.js";
import webRoutes from "./src/routes/web.js";
import { inicializarTracking } from "./src/services/tracking.js";
import { atualizarInventarioGitHub } from "./src/services/github.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Inicialização
inicializarTracking();

// Rotas
app.use("/", authRoutes);
app.use("/api", apiRoutes);
app.use("/", webRoutes);

// Rota raiz
app.get("/", (req, res) => {
  res.redirect("/login");
});

// Sincronização inicial com GitHub (se vazio)
const tracking = JSON.parse(fs.existsSync('./project_tracking.json') ? fs.readFileSync('./project_tracking.json') : '{}');
if (!tracking.inventario?.paginas?.length) {
  console.log('🔄 Pré-carregando inventário...');
  atualizarInventarioGitHub().catch(console.error);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 INDUSALES Architect v5.0 rodando na porta ${PORT}`);
  console.log(`🔐 Login: http://localhost:${PORT}/login`);
});