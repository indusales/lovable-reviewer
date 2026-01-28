import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cookieParser from "cookie-parser"; // ADICIONE

import authRoutes from "./src/routes/auth.js";
import apiRoutes from "./src/routes/api.js";
import webRoutes from "./src/routes/web.js";
import { inicializarTracking } from "./src/services/tracking.js";
import { atualizarInventarioGitHub } from "./src/services/github.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware GLOBAL
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // ADICIONE AQUI
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

// Sincronização inicial
const tracking = loadTracking();
if (!tracking.inventario?.paginas?.length) {
  console.log('🔄 Pré-carregando inventário...');
  atualizarInventarioGitHub().catch(console.error);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});