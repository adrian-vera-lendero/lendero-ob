const mongoose = require('mongoose');
const { getOnboardingDB } = require('../../config/db');

const DomicilioTransaccionalSchema = new mongoose.Schema({
  solicitud_id: { type: mongoose.Schema.Types.ObjectId, required: true },

  domicilio_fiscal: {
    calle:        { type: String, trim: true },
    num_ext:      { type: String, trim: true },
    num_int:      { type: String, trim: true },
    colonia:      { type: String, trim: true },
    cp:           { type: String, trim: true },
    entre_calles: { type: String, trim: true },
    entidad:      { type: String },
    ciudad:       { type: String, trim: true },
    pais:         { type: String, default: 'México' },
  },

  origen_recursos:  { type: String },
  destino_recursos: { type: String },

  // TIF
  tif:             { type: Boolean, default: false },
  paises_tif:      [{ type: String }],
  ofac_confirmado: { type: Boolean, default: false },

  // Nómina
  usa_nomina:   { type: Boolean, default: false },
  tipo_nomina:  { type: String, enum: ['propia', 'tercero', ''], default: '' },
  tiene_repse:  { type: Boolean, default: false },
  repse_num:    { type: String, trim: true },

  // Rangos financieros
  ingresos_tx_rango:    { type: String },
  ingresos_tx_exacto:   { type: Number },
  ingresos_mxn_rango:   { type: String },
  ingresos_mxn_exacto:  { type: Number },
  egresos_tx_rango:     { type: String },
  egresos_tx_exacto:    { type: Number },
  egresos_mxn_rango:    { type: String },
  egresos_mxn_exacto:   { type: Number },

  // SPEI
  spei_in:             { type: Number },
  spei_out:            { type: Number },
  spei_ticket:         { type: Number },
  volumen_mensual_mxn: { type: Number },

  creado_en:      { type: Date, default: Date.now },
  actualizado_en: { type: Date, default: Date.now },
}, { collection: 'domicilio_transaccional' });

DomicilioTransaccionalSchema.pre('save', function (next) {
  this.actualizado_en = new Date();
  next();
});

const db = getOnboardingDB();
module.exports = db.model('DomicilioTransaccional', DomicilioTransaccionalSchema);
