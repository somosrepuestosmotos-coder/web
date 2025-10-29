// ===============================
// 🚀 Backend SRM-QK v2.3 — Integrado, Seguro y Limpieza Global
// ===============================

import express from "express";
import cors from "cors";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const { Pool } = pkg;

// =====================================================
// 📍 Configuración inicial
// =====================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_KEY = process.env.ADMIN_KEY || "SRM2025ADMIN";
const RENDER_URL = process.env.RENDER_URL || `https://srm-backend-web.onrender.com`;

app.use(cors());
app.use(express.json());

// =====================================================
// 💾 Conexión a PostgreSQL
// =====================================================
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ ERROR: Falta la variable DATABASE_URL en el entorno.");
  process.exit(1);
}

// 🔐 Configuración SSL (solo en Render)
const sslConfig =
  dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: dbUrl,
  ssl: sslConfig,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 🔍 Probar conexión inicial
(async () => {
  try {
    const result = await pool.query("SELECT current_database(), current_user");
    console.log(
      `📦 Conectado a BD: ${result.rows[0].current_database}, Usuario: ${result.rows[0].current_user}`
    );
  } catch (err) {
    console.error("❌ Error al conectar con PostgreSQL:", err.message);
  }
})();

// =====================================================
// 🧱 Crear tabla si no existe
// =====================================================
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        nombre TEXT,
        correo TEXT,
        whatsapp TEXT,
        tipo_empresa TEXT,
        herramientas TEXT,
        meta_6m TEXT,
        area_critica TEXT,
        empleados TEXT,
        fecha TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Tabla 'empresas' verificada o creada.");
  } catch (err) {
    console.error("❌ Error creando tabla 'empresas':", err.message);
  }
})();

// =====================================================
// 🌐 Servir frontend (Render usa el mismo repo)
// =====================================================
const publicPath = path.join(__dirname);

if (existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log(`🧭 Frontend servido desde: ${publicPath}`);
} else {
  console.warn("⚠️  No se encontró la carpeta de archivos estáticos.");
}

// Página principal
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "dashboard.html"));
});

// =====================================================
// 🧠 Endpoints API
// =====================================================

// Estado básico (para Render keep-alive)
app.get("/ping", (req, res) => {
  console.log(`🔄 Ping recibido a las ${new Date().toLocaleTimeString()}`);
  res.status(200).send("pong");
});

// Listar empresas
app.get("/api/empresas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM empresas ORDER BY fecha DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error al listar empresas:", error.message);
    res.status(500).json({ success: false, message: "Error al obtener empresas" });
  }
});

// Insertar nueva empresa
app.post("/api/empresas", async (req, res) => {
  try {
    const {
      session_id,
      nombre,
      correo,
      whatsapp,
      tipo_empresa,
      herramientas,
      meta_6m,
      area_critica,
      empleados,
    } = req.body;

    if (!session_id || !nombre || !correo) {
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    await pool.query(
      `INSERT INTO empresas (session_id, nombre, correo, whatsapp, tipo_empresa, herramientas, meta_6m, area_critica, empleados)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [session_id, nombre, correo, whatsapp, tipo_empresa, herramientas, meta_6m, area_critica, empleados]
    );

    console.log(`✅ Empresa registrada: ${nombre} (${tipo_empresa || "sin tipo"})`);
    res.status(201).json({ success: true, message: "Empresa guardada correctamente" });
  } catch (error) {
    console.error("❌ Error al guardar empresa:", error.message);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

// 🔒 Limpiar toda la tabla (solo admin)
app.delete("/api/limpiar", async (req, res) => {
  try {
    const { key } = req.body;
    if (key !== ADMIN_KEY)
      return res.status(403).json({ success: false, error: "Clave incorrecta" });

    await pool.query("TRUNCATE TABLE empresas RESTART IDENTITY");
    console.log("🗑️  Base de datos 'empresas' vaciada por administrador.");
    res.json({ success: true, message: "Base de datos vaciada correctamente." });
  } catch (error) {
    console.error("❌ Error al limpiar base de datos:", error.message);
    res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
});
// =====================================================
// 📊 Endpoint de estadísticas globales
// =====================================================
app.get("/api/stats", async (req, res) => {
  try {
    // 1️⃣ Total de registros
    const totalEmpresas = await pool.query(`SELECT COUNT(*) FROM empresas`);

    // 2️⃣ Distribución por tipo de empresa
    const tipos = await pool.query(`
      SELECT COALESCE(tipo_empresa, 'No especifica') AS tipo, COUNT(*) 
      FROM empresas 
      GROUP BY tipo_empresa
      ORDER BY COUNT(*) DESC;
    `);

    // 3️⃣ Herramientas más usadas
    const herramientas = await pool.query(`
      SELECT COALESCE(herramientas, 'No especifica') AS herramienta, COUNT(*) 
      FROM empresas 
      GROUP BY herramientas
      ORDER BY COUNT(*) DESC;
    `);

    // 4️⃣ Áreas críticas más comunes
    const areas = await pool.query(`
      SELECT COALESCE(area_critica, 'No especifica') AS area, COUNT(*) 
      FROM empresas 
      GROUP BY area_critica
      ORDER BY COUNT(*) DESC;
    `);

    // 5️⃣ Últimos registros (para auditoría)
    const recientes = await pool.query(`
      SELECT nombre, tipo_empresa, fecha 
      FROM empresas 
      ORDER BY fecha DESC 
      LIMIT 5;
    `);

    res.json({
      success: true,
      total_empresas: Number(totalEmpresas.rows[0].count),
      tipos: tipos.rows,
      herramientas: herramientas.rows,
      areas: areas.rows,
      recientes: recientes.rows,
    });
  } catch (error) {
    console.error("❌ Error al obtener estadísticas:", error.message);
    res.status(500).json({ success: false, message: "Error al generar estadísticas" });
  }
});


// =====================================================
// 🚀 Inicialización del servidor
// =====================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend SRM-QK v2.3 corriendo en puerto ${PORT}`);
  console.log(`🌐 API disponible en: ${RENDER_URL}/api/empresas`);
  console.log(`🧭 Dashboard: ${RENDER_URL}/dashboard.html`);
  console.log(`🔒 Clave admin: ${ADMIN_KEY}`);
  console.log("⚙️ Configuración SSL:", sslConfig === false ? "Desactivada" : "Activada");
});
