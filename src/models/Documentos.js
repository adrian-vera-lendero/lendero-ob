const mongoose = require('mongoose');
const { getOnboardingDB } = require('../../config/db');

const ArchivoSchema = new mongoose.Schema({
  doc_num:    { type: Number, required: true },
  nombre:     { type: String, required: true },
  tipo:       { type: String },
  tamano:     { type: Number },
  url:        { type: String, default: null },
  requerido:  { type: Boolean, default: true },
  cargado_en: { type: Date, default: Date.now },
}, { _id: false });

const DocumentosSchema = new mongoose.Schema({
  solicitud_id:         { type: mongoose.Schema.Types.ObjectId, required: true },
  empresa:              [ArchivoSchema],
  representante_legal:  [ArchivoSchema],
  propietario_real:     [ArchivoSchema],
  total_cargados:       { type: Number, default: 0 },
  obligatorios_ok:      { type: Number, default: 0 },
  total_obligatorios:   { type: Number, default: 10 },
  creado_en:            { type: Date, default: Date.now },
  actualizado_en:       { type: Date, default: Date.now },
}, { collection: 'documentos' });

DocumentosSchema.pre('save', function (next) {
  const all = [...this.empresa, ...this.representante_legal, ...this.propietario_real];
  this.total_cargados = all.length;
  this.actualizado_en = new Date();
  next();
});

const db = getOnboardingDB();
module.exports = db.model('Documentos', DocumentosSchema);
