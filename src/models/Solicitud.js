const mongoose = require('mongoose');
const { getOnboardingDB } = require('../../config/db');

const SolicitudSchema = new mongoose.Schema({
  estatus: {
    type: String,
    enum: ['borrador', 'enviada', 'en_revision', 'aprobada', 'rechazada'],
    default: 'borrador',
  },
  paso_actual: { type: Number, default: 1 },

  // Referencias a cada módulo
  datos_empresa_id:           { type: mongoose.Schema.Types.ObjectId, default: null },
  representante_legal_id:     { type: mongoose.Schema.Types.ObjectId, default: null },
  propietario_real_id:        { type: mongoose.Schema.Types.ObjectId, default: null },
  domicilio_transaccional_id: { type: mongoose.Schema.Types.ObjectId, default: null },
  documentos_id:              { type: mongoose.Schema.Types.ObjectId, default: null },

  // Score calculado por el script Python
  score:              { type: Number, default: null },
  score_detalle:      { type: mongoose.Schema.Types.Mixed, default: null },

  // Aceptaciones legales
  acepta_terminos:   { type: Boolean, default: false },
  acepta_privacidad: { type: Boolean, default: false },
  fecha_aceptacion:  { type: Date, default: null },

  // Metadata
  ip_origen:    { type: String },
  modo_prueba:  { type: Boolean, default: false },
  creado_en:    { type: Date, default: Date.now },
  actualizado_en:{ type: Date, default: Date.now },
  enviado_en:   { type: Date, default: null },
}, { collection: 'solicitudes' });

SolicitudSchema.pre('save', function (next) {
  this.actualizado_en = new Date();
  next();
});

// Usamos la DB "onboarding" para este modelo
const db = getOnboardingDB();
module.exports = db.model('Solicitud', SolicitudSchema);
