const mongoose = require('mongoose');

/**
 * Conexión principal a MongoDB.
 * Usamos UNA sola conexión al cluster y cambiamos de DB con .useDb()
 *
 * DBs:
 *   - catalogos   → ya existente con tus catálogos
 *   - onboarding  → nueva, guarda los datos del formulario
 */
const connectDB = async () => {
  try {
    // Conectamos sin especificar DB en la URI para poder usar useDb()
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri);

    console.log(`✅ MongoDB conectado: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ Error al conectar MongoDB:', err.message);
    process.exit(1);
  }
};

/**
 * Acceso a la DB de catálogos (ya existente)
 * Uso: const db = getCatalogosDB(); const col = db.collection('paises');
 */
const getCatalogosDB = () => {
  return mongoose.connection.useDb(process.env.DATABASE_NAME || 'catalogos');
};

/**
 * Acceso a la DB de onboarding (nueva)
 * Uso: const db = getOnboardingDB();
 */
const getOnboardingDB = () => {
  return mongoose.connection.useDb('onboarding');
};

module.exports = { connectDB, getCatalogosDB, getOnboardingDB };
