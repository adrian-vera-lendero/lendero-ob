const mongoose = require('mongoose');
const { getOnboardingDB } = require('../../config/db');

const DomicilioPRSchema = new mongoose.Schema({
  calle:     { type: String, trim: true },
  num_ext:   { type: String, trim: true },
  num_int:   { type: String, trim: true },
  colonia:   { type: String, trim: true },
  cp:        { type: String, trim: true },
  ciudad:    { type: String, trim: true },
  municipio: { type: String, trim: true },
  estado:    { type: String, trim: true },
  pais:      { type: String, default: 'México' },
}, { _id: false });

const PropietarioRealSchema = new mongoose.Schema({
  solicitud_id:              { type: mongoose.Schema.Types.ObjectId, required: true },
  mismo_que_rl:              { type: Boolean, default: false },
  nombres:                   { type: String, trim: true },
  apellido_paterno:          { type: String, trim: true },
  apellido_materno:          { type: String, trim: true },
  fecha_nacimiento:          { type: Date },
  genero:                    { type: String, enum: ['H', 'M', ''] },
  nacionalidad:              { type: String, trim: true },
  pais_residencia:           { type: String },
  pais_nacimiento:           { type: String },
  entidad_federativa:        { type: String },
  actividad_economica:       { type: String },
  rfc:                       { type: String, uppercase: true, trim: true },
  curp:                      { type: String, uppercase: true, trim: true },
  grado_estudios:            { type: String },
  num_identificacion:        { type: String, trim: true },
  declaracion_nombre_propio: { type: Boolean, default: false },
  domicilio:                 DomicilioPRSchema,
  creado_en:                 { type: Date, default: Date.now },
  actualizado_en:            { type: Date, default: Date.now },
}, { collection: 'propietario_real' });

PropietarioRealSchema.pre('save', function (next) {
  this.actualizado_en = new Date();
  next();
});

const db = getOnboardingDB();
module.exports = db.model('PropietarioReal', PropietarioRealSchema);
