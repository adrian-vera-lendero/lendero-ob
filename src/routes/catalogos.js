const express = require('express');
const router  = express.Router();
const { getCatalogosDB } = require('../../config/db');

// Nombres exactos de las colecciones en tu DB "catalogos"
const CATALOGOS_PERMITIDOS = [
  'actividad-economica',
  'actividad-vulnerable',
  'detino-recursos',           // typo original conservado
  'divisa',
  'entidad-federativa',
  'entidad-financiera-vulnerable',   // nombre real en Mongo
  'grado-estudios',
  'nacionalidad',
  'origen-recursos',
  'paises',
  'producto-servicio-sencible',      // typo original conservado
  'tipo-persona',
  'uso-lendero-pay',
  // Catálogos nuevos agregados
  'entidad-financiera-regulada',
  'otros-productos-servicios-sensibles',
];

// GET /api/catalogos
router.get('/', (req, res) => {
  res.json({ ok: true, catalogos: CATALOGOS_PERMITIDOS });
});

// GET /api/catalogos/:nombre
router.get('/:nombre', async (req, res) => {
  try {
    const { nombre } = req.params;

    if (!CATALOGOS_PERMITIDOS.includes(nombre)) {
      return res.status(400).json({ ok: false, error: `Catálogo "${nombre}" no existe.` });
    }

    const db    = getCatalogosDB();
    const col   = db.collection(nombre);
    // Sin proyección fija — devuelve todos los campos del documento
    const items = await col.find({}).toArray();

    res.json({ ok: true, catalogo: nombre, total: items.length, items });
  } catch (err) {
    console.error(`Error leyendo catálogo "${req.params.nombre}":`, err.message);
    res.status(500).json({ ok: false, error: 'Error al leer el catálogo.' });
  }
});

module.exports = router;
