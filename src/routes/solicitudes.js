const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { spawn } = require('child_process');

const Solicitud              = require('../models/Solicitud');
const DatosEmpresa           = require('../models/DatosEmpresa');
const RepresentanteLegal     = require('../models/RepresentanteLegal');
const PropietarioReal        = require('../models/PropietarioReal');
const DomicilioTransaccional = require('../models/DomicilioTransaccional');
const Documentos             = require('../models/Documentos');

// ─── Multer (upload de documentos) ────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, req.params.solicitudId || 'tmp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${req.params.docNum || Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error(`Formato no permitido: ${ext}`));
  },
});

// ─── Helper: ejecutar script Python de score ──────────────────────────────────
/**
 * Llama a logica_score_onboarding_matriz_riesgo.py pasándole el JSON
 * de la solicitud y devuelve el resultado como objeto.
 *
 * El script Python debe:
 *   1. Leer el JSON desde stdin (sys.stdin)  ← recomendado
 *      O recibir el path de un archivo JSON como argumento
 *   2. Imprimir el resultado como JSON en stdout
 *
 * Ejemplo en el script Python:
 *   import sys, json
 *   data = json.load(sys.stdin)
 *   resultado = calcular_score(data)
 *   print(json.dumps(resultado))
 */
const calcularScore = (solicitudData) => {
  return new Promise((resolve) => {
    // Ajusta el path si tu script está en otra ubicación
    const scriptPath = path.join(__dirname, '../../scripts/logica_score_onboarding_matriz_riesgo.py');

    if (!fs.existsSync(scriptPath)) {
      console.warn('⚠️  Script de score no encontrado, se omite el cálculo.');
      return resolve({ score: null, detalle: null, error: 'Script no encontrado' });
    }

    const py = spawn('python3', [scriptPath]);
    let stdout = '';
    let stderr = '';

    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.stderr.on('data', (d) => { stderr += d.toString(); });

    py.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Error en script Python:', stderr);
        return resolve({ score: null, detalle: null, error: stderr });
      }
      try {
        const resultado = JSON.parse(stdout.trim());
        resolve(resultado);
      } catch {
        console.error('❌ Output del script no es JSON válido:', stdout);
        resolve({ score: null, detalle: null, error: 'Output inválido' });
      }
    });

    // Enviamos los datos de la solicitud al script por stdin
    py.stdin.write(JSON.stringify(solicitudData));
    py.stdin.end();
  });
};

// ─── Mapeo de documentos por número ───────────────────────────────────────────
const DOC_EMPRESA = [1, 2, 3, 4, 5, 6, 9];
const DOC_RL      = [7, 8];
const DOC_PR      = [10, 11, 12, 13, 14];

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitudes
// Submit final (paso 5) — guarda todo en MongoDB y calcula el score
// ══════════════════════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const body = req.body;

    // 1 ─ Crear solicitud maestra
    const solicitud = new Solicitud({
      estatus:          'enviada',
      paso_actual:      5,
      acepta_terminos:  body.metadata?.acepta_terminos  || false,
      acepta_privacidad:body.metadata?.acepta_terminos  || false,
      fecha_aceptacion: new Date(),
      ip_origen:        req.ip,
      enviado_en:       new Date(),
    });
    await solicitud.save();
    const sid = solicitud._id;

// 2 ─ Datos de la Empresa
    const e = body.empresa || {};
    const empresa = new DatosEmpresa({
      solicitud_id: sid,
      pais_constitucion:   e.pais_constitucion,
      estado_constitucion: e.estado_constitucion,
      razon_social:         e.razon_social,
      rfc:                  e.rfc,
      actividad_sat:        e.actividad_sat,
      pct_preponderante:    Number(e.pct_preponderante) || undefined,
      fecha_solicitud:      e.fecha_solicitud || new Date(),
      nacionalidad_empresa: e.nacionalidad_empresa || 'Mexicana',
      num_fiel:             e.num_fiel,
      giro:                 e.giro,
      legal_name_usa: e.legal_name_usa,
      ein_usa:        e.ein_usa,
      naics_usa:      e.naics_usa,
      phone_usa:      e.phone_usa,
      email_usa:      e.email_usa,
      website_usa:    e.website_usa,
      es_actividad_vulnerable:    e.es_actividad_vulnerable || false,
      actividad_vulnerable_clave: e.actividad_vulnerable_clave,
      actividad_vulnerable_desc:  e.actividad_vulnerable_desc,
      entidad_financiera_regulada: e.entidad_financiera_regulada,
      modelo_negocio:    e.modelo_negocio,
      tipo_clientes:     e.tipo_clientes,
      industria_clientes:e.industria_clientes,
      uso_lendero_pay: Array.isArray(e.uso_lendero_pay) ? e.uso_lendero_pay : [],
      custodia_recursos:    e.custodia_recursos || false,
      custodia_descripcion: e.custodia_descripcion,
      paises_alto_riesgo:   e.paises_alto_riesgo || false,
      paises_riesgo_desc:   e.paises_riesgo_desc,
      productos_sensibles: Array.isArray(e.productos_sensibles) ? e.productos_sensibles : [],
      telefono_empresa: e.telefono_empresa,
      correo_empresa:   e.correo_empresa,
      sitio_web:        e.sitio_web,
      nombre_comercial: e.nombre_comercial,
    });
    await empresa.save();

    // 3 ─ Representante Legal
    const rl = new RepresentanteLegal({
      solicitud_id:        sid,
      nombres:             body.representante_legal?.nombres,
      apellido_paterno:    body.representante_legal?.apellido_paterno,
      apellido_materno:    body.representante_legal?.apellido_materno,
      fecha_nacimiento:    body.representante_legal?.fecha_nacimiento,
      genero:              body.representante_legal?.genero,
      nacionalidad:        body.representante_legal?.nacionalidad,
      pais_residencia:     body.representante_legal?.pais_residencia,
      pais_nacimiento:     body.representante_legal?.pais_nacimiento,
      entidad_federativa:  body.representante_legal?.entidad_federativa,
      actividad_economica: body.representante_legal?.actividad_economica,
      rfc:                 body.representante_legal?.rfc,
      curp:                body.representante_legal?.curp,
      grado_estudios:      body.representante_legal?.grado_estudios,
      num_identificacion:  body.representante_legal?.num_identificacion,
      correo:              body.representante_legal?.correo,
      telefono:            body.representante_legal?.telefono,
      domicilio:           body.representante_legal?.domicilio,
    });
    await rl.save();

    // 4 ─ Propietario Real
    const prData = body.propietario_real || {};
    const pr = new PropietarioReal({
      solicitud_id:              sid,
      mismo_que_rl:              prData.mismo_que_rl || false,
      nombres:                   prData.nombres,
      apellido_paterno:          prData.apellido_paterno,
      apellido_materno:          prData.apellido_materno,
      fecha_nacimiento:          prData.fecha_nacimiento,
      genero:                    prData.genero,
      nacionalidad:              prData.nacionalidad,
      pais_residencia:           prData.pais_residencia,
      pais_nacimiento:           prData.pais_nacimiento,
      entidad_federativa:        prData.entidad_federativa,
      actividad_economica:       prData.actividad_economica,
      rfc:                       prData.rfc,
      curp:                      prData.curp,
      grado_estudios:            prData.grado_estudios,
      num_identificacion:        prData.num_identificacion,
      declaracion_nombre_propio: prData.declaracion_nombre_propio || false,
      domicilio:                 prData.domicilio,
    });
    await pr.save();

    // 5 ─ Domicilio Fiscal + Perfil Transaccional
    const pt = body.perfil_transaccional || {};
    const domTx = new DomicilioTransaccional({
      solicitud_id:         sid,
      domicilio_fiscal:     body.domicilio_fiscal,
      origen_recursos:      pt.origen_recursos,
      destino_recursos:     pt.destino_recursos,
      tif:                  pt.tif || false,
      paises_tif:           pt.paises_tif || [],
      ofac_confirmado:      pt.ofac_confirmado || false,
      usa_nomina:           pt.nomina || false,
      tipo_nomina:          pt.tipo_nomina || '',
      tiene_repse:          pt.repse || false,
      repse_num:            pt.repse_num,
      ingresos_tx_rango:    pt.ingresos_tx_rango,
      ingresos_tx_exacto:   Number(pt.ingresos_tx_exacto)  || 0,
      ingresos_mxn_rango:   pt.ingresos_mxn_rango,
      ingresos_mxn_exacto:  Number(pt.ingresos_mxn_exacto) || 0,
      egresos_tx_rango:     pt.egresos_tx_rango,
      egresos_tx_exacto:    Number(pt.egresos_tx_exacto)   || 0,
      egresos_mxn_rango:    pt.egresos_mxn_rango,
      egresos_mxn_exacto:   Number(pt.egresos_mxn_exacto)  || 0,
      spei_in:              Number(pt.spei_in)     || 0,
      spei_out:             Number(pt.spei_out)    || 0,
      spei_ticket:          Number(pt.spei_ticket) || 0,
      volumen_mensual_mxn: (Number(pt.spei_in) + Number(pt.spei_out)) * Number(pt.spei_ticket) || 0,
    });
    await domTx.save();

    // 6 ─ Documentos (metadatos)
    const docs = body.documentos || [];
    const mapDoc = d => ({ doc_num: Number(d.doc_num), nombre: d.nombre, tipo: d.tipo, tamano: d.tamano });
    const documento = new Documentos({
      solicitud_id:        sid,
      empresa:             docs.filter(d => DOC_EMPRESA.includes(Number(d.doc_num))).map(mapDoc),
      representante_legal: docs.filter(d => DOC_RL.includes(Number(d.doc_num))).map(mapDoc),
      propietario_real:    docs.filter(d => DOC_PR.includes(Number(d.doc_num))).map(mapDoc),
    });
    await documento.save();

    // 7 ─ Calcular score con el script Python
    console.log(`🐍 Ejecutando script de score para solicitud ${sid}…`);
    const scoreResultado = await calcularScore({
      empresa:                 empresa.toObject(),
      representante_legal:     rl.toObject(),
      propietario_real:        pr.toObject(),
      domicilio_transaccional: domTx.toObject(),
    });

    // 8 ─ Actualizar solicitud con referencias y score
    solicitud.datos_empresa_id           = empresa._id;
    solicitud.representante_legal_id     = rl._id;
    solicitud.propietario_real_id        = pr._id;
    solicitud.domicilio_transaccional_id = domTx._id;
    solicitud.documentos_id              = documento._id;
    solicitud.score                      = scoreResultado.score ?? null;
    solicitud.score_detalle              = scoreResultado.detalle ?? scoreResultado;
    await solicitud.save();

    console.log(`✅ Solicitud ${sid} guardada | Score: ${scoreResultado.score ?? 'N/D'}`);

    res.status(201).json({
      ok:      true,
      id:      sid,
      score:   scoreResultado.score ?? null,
      mensaje: 'Solicitud registrada correctamente.',
    });

  } catch (err) {
    console.error('Error al guardar solicitud:', err);
    if (err.name === 'ValidationError') {
      const errores = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ ok: false, error: 'Validación fallida', detalles: errores });
    }
    res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/solicitudes/:solicitudId/documentos/:docNum
// Sube un archivo físico para un documento
// ══════════════════════════════════════════════════════════════════════════════
router.post('/:solicitudId/documentos/:docNum', upload.single('archivo'), async (req, res) => {
  try {
    const { solicitudId, docNum } = req.params;
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió archivo.' });

    const docRecord = await Documentos.findOne({ solicitud_id: solicitudId });
    if (!docRecord) return res.status(404).json({ ok: false, error: 'Registro de documentos no encontrado.' });

    const archInfo = {
      doc_num:    Number(docNum),
      nombre:     req.file.originalname,
      tipo:       req.file.mimetype,
      tamano:     req.file.size,
      url:        `/uploads/${solicitudId}/${req.file.filename}`,
      cargado_en: new Date(),
    };

    const num = Number(docNum);
    if      (DOC_EMPRESA.includes(num)) docRecord.empresa.push(archInfo);
    else if (DOC_RL.includes(num))      docRecord.representante_legal.push(archInfo);
    else if (DOC_PR.includes(num))      docRecord.propietario_real.push(archInfo);
    else return res.status(400).json({ ok: false, error: `Número de documento ${docNum} no reconocido.` });

    await docRecord.save();
    res.json({ ok: true, archivo: archInfo });

  } catch (err) {
    if (err.message?.includes('Formato no permitido')) return res.status(400).json({ ok: false, error: err.message });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ ok: false, error: 'El archivo excede 10 MB.' });
    console.error('Error al subir archivo:', err);
    res.status(500).json({ ok: false, error: 'Error al procesar el archivo.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/solicitudes/:id
// Detalle completo de una solicitud
// ══════════════════════════════════════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const sid = req.params.id;
    const [solicitud, empresa, rl, pr, domTx, docs] = await Promise.all([
      Solicitud.findById(sid),
      DatosEmpresa.findOne({ solicitud_id: sid }),
      RepresentanteLegal.findOne({ solicitud_id: sid }),
      PropietarioReal.findOne({ solicitud_id: sid }),
      DomicilioTransaccional.findOne({ solicitud_id: sid }),
      Documentos.findOne({ solicitud_id: sid }),
    ]);

    if (!solicitud) return res.status(404).json({ ok: false, error: 'Solicitud no encontrada.' });

    res.json({
      ok: true,
      data: { solicitud, datos_empresa: empresa, representante_legal: rl,
              propietario_real: pr, domicilio_transaccional: domTx, documentos: docs }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al obtener la solicitud.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/solicitudes
// Lista solicitudes (con filtro opcional por estatus)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { estatus, page = 1, limit = 20 } = req.query;
    const filtro = estatus ? { estatus } : {};
    const [data, total] = await Promise.all([
      Solicitud.find(filtro).sort({ creado_en: -1 }).skip((page - 1) * limit).limit(Number(limit)),
      Solicitud.countDocuments(filtro),
    ]);
    res.json({ ok: true, total, page: Number(page), data });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al listar solicitudes.' });
  }
});

module.exports = router;
