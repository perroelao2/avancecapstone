// Script sencillo para comprobar por consola que la conexion a MySQL funciona
// y que las tablas tienen los datos cargados. Se ejecuta con: npm run test:db
const { pool } = require('./db');

async function verify() {
  const [tables] = await pool.query('SHOW TABLES');
  console.log(`Conectado a MySQL exitosamente. Total tablas en algarrobo_connect: ${tables.length}`);

  const [cabanas] = await pool.query('SELECT id_cabana, nombre, ubicacion, precio_por_noche FROM cabanas');
  console.log('Cabañas registradas:', cabanas);

  await pool.end();
}

verify().catch(err => {
  console.error('Error verificando la base de datos:', err);
  process.exit(1);
});
