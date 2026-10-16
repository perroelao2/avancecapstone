// Importamos mysql2 con soporte de promesas para poder usar async/await en las consultas
const mysql = require('mysql2/promise');

// Creamos un pool de conexiones hacia la base de datos local.
// Usar createPool en vez de createConnection evita que la conexion se caiga
// si hacemos varias consultas seguidas al mismo tiempo.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'algarrobo_connect',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Esto hace que los campos DECIMAL (como el precio por noche) lleguen como numeros y no como texto
  decimalNumbers: true
});

module.exports = { pool };
