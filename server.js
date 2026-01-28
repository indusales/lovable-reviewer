import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cookieParser from "cookie-parser";

import { inicializarTracking, loadTracking } from "./src/services/tracking.js"; // <-- ADICIONE ISSO
import { atualizarInventarioGitHub } from "./src/services/github.js";
import authRoutes from "./src/routes/auth.js";
import apiRoutes from "./src/routes/api.js";
import webRoutes from "./src/routes/web.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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

// Pré-carregar inventário
const tracking = loadTracking(); // <-- agora funciona!
if (!tracking.inventario?.paginas?.length) {
  console.log('🔄 Pré-carregando inventário...');
  atualizarInventarioGitHub().catch(console.error);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando na porta ${PORT}`);
});