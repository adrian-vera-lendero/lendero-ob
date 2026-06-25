const mongoose = require('mongoose');
const { getOnboardingDB } = require('../../config/db');

const DatosEmpresaSchema = new mongoose.Schema({
  solicitud_id: { type: mongoose.Schema.Types.ObjectId, required: true },

  // ── País / Estado ────────────────────────────────────────
  pais_constitucion:   { type: String, required: true },
  estado_constitucion: { type: String, required: true },

  // ── Bloque México ────────────────────────────────────────
  razon_social:        { type: String, trim: true },
  rfc:                 { type: String, uppercase: true, trim: true, maxlength: 13 },
  actividad_sat:       { type: String, trim: true },
  pct_preponderante:   { type: Number },
  fecha_solicitud:     { type: Date },
  nacionalidad_empresa:{ type: String, default: 'Mexicana' },
  num_fiel:            { type: String, trim: true },
  giro:                { type: String, trim: true },

  // ── Bloque USA ───────────────────────────────────────────
  legal_name_usa:      { type: String, trim: true },
  ein_usa:             { type: String, trim: true },
  naics_usa:           { type: String, trim: true },
  phone_usa:           { type: String, trim: true },
  email_usa:           { type: String, lowercase: true, trim: true },
  website_usa:         { type: String, trim: true },

  // ── Actividades Vulnerables ──────────────────────────────
  es_actividad_vulnerable:    { type: Boolean, default: false },
  actividad_vulnerable_clave: { type: String, trim: true },   // ej. "IV", "XI-a"
  actividad_vulnerable_desc:  { type: String, trim: true },

  // ── Entidad Financiera Regulada ──────────────────────────
  entidad_financiera_regulada: { type: String, trim: true },  // del catálogo entidad-financiera-vulnerable

  // ── Modelo de Negocio ────────────────────────────────────
  modelo_negocio:   { type: String, trim: true },
  tipo_clientes:    { type: String, enum: ['PF', 'PM', 'ambos', ''] },
  industria_clientes:{ type: String, trim: true },

  // ── Uso Lendero Pay ──────────────────────────────────────
  uso_lendero_pay:  [{ type: String }],   // array de casos de uso seleccionados

  // ── Custodia de recursos ─────────────────────────────────
  custodia_recursos:      { type: Boolean, default: false },
  custodia_descripcion:   { type: String, trim: true },

  // ── Países de alto riesgo ────────────────────────────────
  paises_alto_riesgo:     { type: Boolean, default: false },
  paises_riesgo_desc:     { type: String, trim: true },

  // ── Productos / servicios sensibles ─────────────────────
  productos_sensibles:    [{ type: String }],

  // ── Contacto Corporativo ─────────────────────────────────
  telefono_empresa:  { type: String, trim: true },
  correo_empresa:    { type: String, lowercase: true, trim: true },
  sitio_web:         { type: String, trim: true },
  nombre_comercial:  { type: String, trim: true },

  creado_en:      { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now },
}, { collection: 'datos_empresa' });

DatosEmpresaSchema.pre('save', function (next) {
  this.actualizado_en = new Date();
  next();
});

const db = getOnboardingDB();
module.exports = db.model('DatosEmpresa', DatosEmpresaSchema);
