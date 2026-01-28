import express from "express";
import cookieParser from "cookie-parser";

const router = express.Router();
router.use(cookieParser());

const SESSION_COOKIE = "indusales_auth";
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24h

// Configurações dinâmicas
const VALID_USERS = [
  { username: process.env.ADMIN_USER || "admin", password: process.env.ADMIN_PASS || "indusales2024" },
  { username: "dev", password: process.env.DEV_PASS || "indusales2024" }
];

export function requireAuth(req, res, next) {
  const token = req.cookies[SESSION_COOKIE];
  
  // Verifica cookie válido
  if (token) {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [user, exp] = decoded.split(':');
      if (parseInt(exp) > Date.now() && VALID_USERS.some(u => u.username === user)) {
        req.user = user;
        return next();
      }
    } catch (e) {}
  }
  
  // Redireciona para login se não autenticado
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: "Não autorizado" });
  }
  res.redirect('/login');
}

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  
  const valid = VALID_USERS.some(u => u.username === username && u.password === password);
  
  if (valid) {
    const expiration = Date.now() + SESSION_DURATION;
    const token = Buffer.from(`${username}:${expiration}`).toString('base64');
    
    res.cookie(SESSION_COOKIE, token, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.redirect('/dashboard');
  } else {
    res.redirect('/login?error=1');
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.redirect('/login');
});

export default router;