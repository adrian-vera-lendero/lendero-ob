require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { connectDB } = require('./config/db');

const app = express();

// ── Conectar MongoDB ───────────────────────────────────────
connectDB();

// ── Middlewares ────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Sirve los archivos subidos (documentos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Sirve el formulario HTML directamente
app.use(express.static(path.join(__dirname)));

// ── Rutas API ──────────────────────────────────────────────
app.use('/api/catalogos',   require('./src/routes/catalogos'));
app.use('/api/solicitudes', require('./src/routes/solicitudes'));

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok:       true,
    servicio: 'Lendero Onboarding API',
    puerto:   process.env.PORT || 5000,
    ts:       new Date().toISOString(),
  });
});

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Error global ───────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
});

// ── Iniciar ────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Lendero Onboarding API — http://localhost:${PORT}`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/catalogos/:nombre`);
  console.log(`   POST /api/solicitudes`);
  console.log(`   GET  /api/solicitudes/:id`);
  console.log(`   POST /api/solicitudes/:id/documentos/:docNum\n`);
});

module.exports = app;
