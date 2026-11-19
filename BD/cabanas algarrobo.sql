-- Script Maestro de Base de Datos: Cabañas Algarrobo
-- Compatible con MySQL 8+ y MariaDB 10+

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `historial_mensajes_whatsapp`;
DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `promociones`;
DROP TABLE IF EXISTS `reservas_servicios`;
DROP TABLE IF EXISTS `servicios_adicionales`;
DROP TABLE IF EXISTS `huespedes_adicionales`;
DROP TABLE IF EXISTS `comprobantes_transferencia`;
DROP TABLE IF EXISTS `bloqueos_fechas`;
DROP TABLE IF EXISTS `mantenciones_cabana`;
DROP TABLE IF EXISTS `reglas_cabana`;
DROP TABLE IF EXISTS `cabanas_comodidades`;
DROP TABLE IF EXISTS `comodidades`;
DROP TABLE IF EXISTS `fotos_cabana`;
DROP TABLE IF EXISTS `comentarios`;
DROP TABLE IF EXISTS `mensajes_contacto`;
DROP TABLE IF EXISTS `inventario`;
DROP TABLE IF EXISTS `pagos`;
DROP TABLE IF EXISTS `reservas`;
DROP TABLE IF EXISTS `cabanas`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `categorias_inventario`;
DROP TABLE IF EXISTS `estados_pago`;
DROP TABLE IF EXISTS `metodos_pago`;
DROP TABLE IF EXISTS `estados_reserva`;
DROP TABLE IF EXISTS `estados_cabana`;
DROP TABLE IF EXISTS `sectores_algarrobo`;
DROP TABLE IF EXISTS `comunas`;
DROP TABLE IF EXISTS `provincias`;
DROP TABLE IF EXISTS `regiones`;
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `id_rol` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) UNIQUE NOT NULL,
  `descripcion` varchar(100)
);

CREATE TABLE `regiones` (
  `id_region` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL
);

CREATE TABLE `provincias` (
  `id_provincia` integer PRIMARY KEY AUTO_INCREMENT,
  `id_region` integer NOT NULL,
  `nombre` varchar(100) NOT NULL
);

CREATE TABLE `comunas` (
  `id_comuna` integer PRIMARY KEY AUTO_INCREMENT,
  `id_provincia` integer NOT NULL,
  `nombre` varchar(100) NOT NULL
);

CREATE TABLE `sectores_algarrobo` (
  `id_sector` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL
);

CREATE TABLE `estados_cabana` (
  `id_estado_cabana` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(30) UNIQUE NOT NULL
);

CREATE TABLE `estados_reserva` (
  `id_estado_reserva` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(30) UNIQUE NOT NULL
);

CREATE TABLE `metodos_pago` (
  `id_metodo_pago` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) UNIQUE NOT NULL
);

CREATE TABLE `estados_pago` (
  `id_estado_pago` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(30) UNIQUE NOT NULL
);

CREATE TABLE `categorias_inventario` (
  `id_categoria` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL
);

CREATE TABLE `usuarios` (
  `id_usuario` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `correo` varchar(100) UNIQUE NOT NULL,
  `contrasena` varchar(100) NOT NULL,
  `rol` varchar(20) NOT NULL COMMENT 'Mantiene compatibilidad con backend actual',
  `id_rol` integer,
  `telefono` varchar(20),
  `id_comuna` integer,
  `fecha_creacion` timestamp DEFAULT (now())
);

CREATE TABLE `cabanas` (
  `id_cabana` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `ubicacion` varchar(100) NOT NULL,
  `capacidad` integer NOT NULL,
  `estado` varchar(20) DEFAULT 'Disponible',
  `id_estado` integer,
  `id_comuna` integer,
  `id_sector` integer,
  `precio_por_noche` decimal(10,2) DEFAULT 0
);

CREATE TABLE `reservas` (
  `id_reserva` integer PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` integer NOT NULL,
  `id_cabana` integer NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `estado` varchar(20) DEFAULT 'Pendiente',
  `id_estado_reserva` integer,
  `monto_total` decimal(10,2) DEFAULT 0,
  `fecha_creacion` timestamp DEFAULT (now())
);

CREATE TABLE `pagos` (
  `id_pago` integer PRIMARY KEY AUTO_INCREMENT,
  `id_reserva` integer NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `metodo_pago` varchar(30) DEFAULT 'Transferencia',
  `id_metodo_pago` integer,
  `id_estado_pago` integer,
  `fecha_pago` timestamp DEFAULT (now()),
  `observaciones` varchar(100)
);

CREATE TABLE `inventario` (
  `id_item` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `cantidad` integer NOT NULL,
  `ubicacion` varchar(50),
  `id_cabana` integer,
  `id_categoria` integer,
  `observacion` text
);

CREATE TABLE `mensajes_contacto` (
  `id_mensaje` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `correo` varchar(100) NOT NULL,
  `mensaje` text NOT NULL,
  `fecha_envio` timestamp DEFAULT (now()),
  `leido` boolean DEFAULT false
);

CREATE TABLE `comentarios` (
  `id` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(100),
  `correo` varchar(100),
  `comentario` text,
  `fecha` datetime DEFAULT (now()),
  `id_cabana` integer,
  `estrellas` integer DEFAULT 5
);

CREATE TABLE `fotos_cabana` (
  `id_foto` integer PRIMARY KEY AUTO_INCREMENT,
  `id_cabana` integer NOT NULL,
  `url_foto` varchar(255) NOT NULL,
  `es_principal` boolean DEFAULT false
);

CREATE TABLE `comodidades` (
  `id_comodidad` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `icono` varchar(50)
);

CREATE TABLE `cabanas_comodidades` (
  `id_cabana` integer NOT NULL,
  `id_comodidad` integer NOT NULL,
  PRIMARY KEY (`id_cabana`, `id_comodidad`)
);

CREATE TABLE `reglas_cabana` (
  `id_regla` integer PRIMARY KEY AUTO_INCREMENT,
  `id_cabana` integer NOT NULL,
  `descripcion` varchar(200) NOT NULL
);

CREATE TABLE `mantenciones_cabana` (
  `id_mantencion` integer PRIMARY KEY AUTO_INCREMENT,
  `id_cabana` integer NOT NULL,
  `descripcion` text NOT NULL,
  `costo` decimal(10,2) DEFAULT 0,
  `fecha` date NOT NULL
);

CREATE TABLE `bloqueos_fechas` (
  `id_bloqueo` integer PRIMARY KEY AUTO_INCREMENT,
  `id_cabana` integer NOT NULL,
  `fecha_desde` date NOT NULL,
  `fecha_hasta` date NOT NULL,
  `motivo` varchar(100)
);

CREATE TABLE `comprobantes_transferencia` (
  `id_comprobante` integer PRIMARY KEY AUTO_INCREMENT,
  `id_pago` integer NOT NULL,
  `url_archivo` varchar(255) NOT NULL,
  `numero_operacion` varchar(50),
  `banco_origen` varchar(50)
);

CREATE TABLE `huespedes_adicionales` (
  `id_huesped` integer PRIMARY KEY AUTO_INCREMENT,
  `id_reserva` integer NOT NULL,
  `nombre_completo` varchar(100) NOT NULL,
  `rut_o_pasaporte` varchar(30)
);

CREATE TABLE `servicios_adicionales` (
  `id_servicio` integer PRIMARY KEY AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `precio` decimal(10,2) NOT NULL
);

CREATE TABLE `reservas_servicios` (
  `id_reserva` integer NOT NULL,
  `id_servicio` integer NOT NULL,
  `cantidad` integer DEFAULT 1,
  `subtotal` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id_reserva`, `id_servicio`)
);

CREATE TABLE `promociones` (
  `id_promocion` integer PRIMARY KEY AUTO_INCREMENT,
  `codigo` varchar(20) UNIQUE NOT NULL,
  `porcentaje_descuento` decimal(5,2) NOT NULL,
  `fecha_expiracion` date NOT NULL,
  `activo` boolean DEFAULT true
);

CREATE TABLE `notificaciones` (
  `id_notificacion` integer PRIMARY KEY AUTO_INCREMENT,
  `id_usuario` integer NOT NULL,
  `titulo` varchar(100) NOT NULL,
  `mensaje` text NOT NULL,
  `leido` boolean DEFAULT false,
  `fecha` timestamp DEFAULT (now())
);

CREATE TABLE `historial_mensajes_whatsapp` (
  `id_registro` integer PRIMARY KEY AUTO_INCREMENT,
  `telefono_destino` varchar(20) NOT NULL,
  `id_reserva` integer,
  `mensaje` text NOT NULL,
  `fecha_envio` timestamp DEFAULT (now())
);

ALTER TABLE `provincias` ADD FOREIGN KEY (`id_region`) REFERENCES `regiones` (`id_region`);
ALTER TABLE `comunas` ADD FOREIGN KEY (`id_provincia`) REFERENCES `provincias` (`id_provincia`);
ALTER TABLE `usuarios` ADD FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`);
ALTER TABLE `usuarios` ADD FOREIGN KEY (`id_comuna`) REFERENCES `comunas` (`id_comuna`);
ALTER TABLE `cabanas` ADD FOREIGN KEY (`id_estado`) REFERENCES `estados_cabana` (`id_estado_cabana`);
ALTER TABLE `cabanas` ADD FOREIGN KEY (`id_comuna`) REFERENCES `comunas` (`id_comuna`);
ALTER TABLE `cabanas` ADD FOREIGN KEY (`id_sector`) REFERENCES `sectores_algarrobo` (`id_sector`);
ALTER TABLE `fotos_cabana` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `cabanas_comodidades` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `cabanas_comodidades` ADD FOREIGN KEY (`id_comodidad`) REFERENCES `comodidades` (`id_comodidad`);
ALTER TABLE `reglas_cabana` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `mantenciones_cabana` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `bloqueos_fechas` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `reservas` ADD FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);
ALTER TABLE `reservas` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `reservas` ADD FOREIGN KEY (`id_estado_reserva`) REFERENCES `estados_reserva` (`id_estado_reserva`);
ALTER TABLE `pagos` ADD FOREIGN KEY (`id_reserva`) REFERENCES `reservas` (`id_reserva`);
ALTER TABLE `pagos` ADD FOREIGN KEY (`id_metodo_pago`) REFERENCES `metodos_pago` (`id_metodo_pago`);
ALTER TABLE `pagos` ADD FOREIGN KEY (`id_estado_pago`) REFERENCES `estados_pago` (`id_estado_pago`);
ALTER TABLE `comprobantes_transferencia` ADD FOREIGN KEY (`id_pago`) REFERENCES `pagos` (`id_pago`);
ALTER TABLE `huespedes_adicionales` ADD FOREIGN KEY (`id_reserva`) REFERENCES `reservas` (`id_reserva`);
ALTER TABLE `reservas_servicios` ADD FOREIGN KEY (`id_reserva`) REFERENCES `reservas` (`id_reserva`);
ALTER TABLE `reservas_servicios` ADD FOREIGN KEY (`id_servicio`) REFERENCES `servicios_adicionales` (`id_servicio`);
ALTER TABLE `inventario` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `inventario` ADD FOREIGN KEY (`id_categoria`) REFERENCES `categorias_inventario` (`id_categoria`);
ALTER TABLE `comentarios` ADD FOREIGN KEY (`id_cabana`) REFERENCES `cabanas` (`id_cabana`);
ALTER TABLE `notificaciones` ADD FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);
ALTER TABLE `historial_mensajes_whatsapp` ADD FOREIGN KEY (`id_reserva`) REFERENCES `reservas` (`id_reserva`);

-- ============================================================
-- DATOS SEMILLA DE CATÁLOGOS Y OPERACIÓN
-- ============================================================

INSERT INTO `roles` (`id_rol`, `nombre`, `descripcion`) VALUES
  (1, 'Administrador', 'Control total del sistema'),
  (2, 'Recepcionista', 'Gestión de reservas y check-in'),
  (3, 'Cliente', 'Usuario web que reserva en línea');

INSERT INTO `regiones` (`id_region`, `nombre`) VALUES
  (5, 'Región de Valparaíso'),
  (13, 'Región Metropolitana de Santiago');

INSERT INTO `provincias` (`id_provincia`, `id_region`, `nombre`) VALUES
  (1, 5, 'San Antonio'),
  (2, 13, 'Santiago');

INSERT INTO `comunas` (`id_comuna`, `id_provincia`, `nombre`) VALUES
  (1, 1, 'Algarrobo'),
  (2, 1, 'El Quisco'),
  (3, 2, 'Providencia');

INSERT INTO `sectores_algarrobo` (`id_sector`, `nombre`) VALUES
  (1, 'El Canelo'),
  (2, 'El Canelillo'),
  (3, 'Mirasol'),
  (4, 'San Alfonso del Mar'),
  (5, 'Algarrobo Central');

INSERT INTO `estados_cabana` (`id_estado_cabana`, `nombre`) VALUES
  (1, 'Disponible'),
  (2, 'Ocupada'),
  (3, 'En Mantención'),
  (4, 'Limpieza');

INSERT INTO `estados_reserva` (`id_estado_reserva`, `nombre`) VALUES
  (1, 'Pendiente'),
  (2, 'Confirmada'),
  (3, 'Check-in Realizado'),
  (4, 'Finalizada'),
  (5, 'Cancelada');

INSERT INTO `metodos_pago` (`id_metodo_pago`, `nombre`) VALUES
  (1, 'Transferencia Bancaria'),
  (2, 'Webpay / Tarjeta Débito-Crédito'),
  (3, 'Efectivo Presencial');

INSERT INTO `estados_pago` (`id_estado_pago`, `nombre`) VALUES
  (1, 'Pendiente Revisión'),
  (2, 'Aprobado'),
  (3, 'Rechazado');

INSERT INTO `categorias_inventario` (`id_categoria`, `nombre`) VALUES
  (1, 'Ropa de Cama'),
  (2, 'Menaje y Cocina'),
  (3, 'Electrodomésticos');

INSERT INTO `comodidades` (`id_comodidad`, `nombre`, `icono`) VALUES
  (1, 'Wifi Gratis', 'wifi'),
  (2, 'Tinaja Caliente / Hot Tub', 'hot-tub'),
  (3, 'Parrilla Asadera', 'grill'),
  (4, 'Vista al Mar', 'water'),
  (5, 'Estacionamiento Privado', 'car');

INSERT INTO `servicios_adicionales` (`id_servicio`, `nombre`, `precio`) VALUES
  (1, 'Uso de Tinaja Caliente (por día)', 25000.00),
  (2, 'Pack Leña y Carbón Asado', 12000.00),
  (3, 'Desayuno Campestre a la Cabaña', 15000.00);

INSERT INTO `usuarios` (`id_usuario`, `nombre`, `correo`, `contrasena`, `rol`, `id_rol`, `telefono`, `id_comuna`) VALUES
  (1, 'Administrador Algarrobo', 'admin@algarroboconnect.cl', '$2b$10$F1qkXdG6mp7Qw/wn3I11M.AXxHupIA.zENCFGlhl4wsoszyKKvlve', 'admin', 1, '+56911112222', 1),
  (2, 'Carlos Muñoz', 'carlos.munoz@gmail.com', '$2b$10$LlW0J/KkQOElcHaa7GQTx.JDRPkFKCp/8w6MlniWxBiWECPz76P6y', 'cliente', 3, '+56998765432', 3),
  (3, 'Camila Soto', 'camila.soto@gmail.com', '$2b$10$LlW0J/KkQOElcHaa7GQTx.JDRPkFKCp/8w6MlniWxBiWECPz76P6y', 'cliente', 3, '+56987654321', 1);

INSERT INTO `cabanas` (`id_cabana`, `nombre`, `ubicacion`, `capacidad`, `estado`, `id_estado`, `id_comuna`, `id_sector`, `precio_por_noche`) VALUES
  (1, 'Cabaña El Canelo', 'Av. Alessandri 450, Algarrobo', 4, 'Disponible', 1, 1, 1, 55000.00),
  (2, 'Cabaña Mirasol Vista', 'Camino Mirasol 120, Algarrobo', 6, 'Disponible', 1, 1, 3, 75000.00),
  (3, 'Domo San Alfonso', 'Sector Norte Parcela 4, Algarrobo', 2, 'Disponible', 1, 1, 4, 45000.00);

INSERT INTO `fotos_cabana` (`id_cabana`, `url_foto`, `es_principal`) VALUES
  (1, 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=600&q=80', 1),
  (1, 'https://images.unsplash.com/photo-1540518614846-7ede433c4573?auto=format&fit=crop&w=400&q=80', 0),
  (1, 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80', 0),
  (2, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=600&q=80', 1),
  (2, 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=400&q=80', 0),
  (2, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=400&q=80', 0),
  (3, 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=600&q=80', 1);

INSERT INTO `cabanas_comodidades` (`id_cabana`, `id_comodidad`) VALUES
  (1, 1), (1, 3), (1, 5),
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5),
  (3, 1), (3, 5);

INSERT INTO `reglas_cabana` (`id_cabana`, `descripcion`) VALUES
  (1, 'Check-in desde las 15:00 hrs y Check-out hasta las 12:00 hrs. Ideal para descanso familiar cerca de playa El Canelo.'),
  (1, 'No se permiten fiestas ni ruidos molestos después de las 23:00 hrs.'),
  (2, 'Amplia cabaña con vista panorámica en sector Mirasol, terraza equipada y tinaja privada.'),
  (3, 'Espacio ideal para parejas en entorno tranquilo cercano a San Alfonso.');

INSERT INTO `mantenciones_cabana` (`id_mantencion`, `id_cabana`, `descripcion`, `costo`, `fecha`) VALUES
  (1, 1, 'Revisión de calefont y sellado de ventanas pre-temporada', 35000.00, '2026-09-25');

INSERT INTO `reservas` (`id_reserva`, `id_usuario`, `id_cabana`, `fecha_inicio`, `fecha_fin`, `estado`, `id_estado_reserva`, `monto_total`) VALUES
  (1, 2, 1, '2026-10-10', '2026-10-12', 'Confirmada', 2, 122000.00),
  (2, 3, 2, '2026-11-01', '2026-11-04', 'Pendiente', 1, 275000.00);

INSERT INTO `huespedes_adicionales` (`id_huesped`, `id_reserva`, `nombre_completo`, `rut_o_pasaporte`) VALUES
  (1, 1, 'María González', '15.234.567-8'),
  (2, 1, 'Tomás Muñoz González', '23.456.789-0'),
  (3, 2, 'Diego Ramírez', '17.890.123-4');

INSERT INTO `reservas_servicios` (`id_reserva`, `id_servicio`, `cantidad`, `subtotal`) VALUES
  (1, 2, 1, 12000.00),
  (2, 1, 2, 50000.00);

INSERT INTO `pagos` (`id_pago`, `id_reserva`, `monto`, `metodo_pago`, `id_metodo_pago`, `id_estado_pago`, `observaciones`) VALUES
  (1, 1, 122000.00, 'Transferencia', 1, 2, 'Pago completo verificado vía comprobante BancoEstado'),
  (2, 2, 50000.00, 'Transferencia', 1, 1, 'Abono enviado vía transferencia');

INSERT INTO `comprobantes_transferencia` (`id_comprobante`, `id_pago`, `url_archivo`, `numero_operacion`, `banco_origen`) VALUES
  (1, 1, 'comprobante_op_998123.pdf', 'OP-998123', 'BancoEstado'),
  (2, 2, 'abono_op_445120.jpg', 'OP-445120', 'Banco de Chile');

INSERT INTO `inventario` (`id_item`, `nombre`, `cantidad`, `ubicacion`, `id_cabana`, `id_categoria`, `observacion`) VALUES
  (1, 'Juego de sábanas 2 plazas', 4, 'Dormitorio principal', 1, 1, 'Compradas temporada 2026'),
  (2, 'Juego de loza 6 piezas', 1, 'Cocina', 1, 2, 'Completo sin roturas'),
  (3, 'Frigobar Midea', 1, 'Cocina', 3, 3, 'Operativo 100%');

INSERT INTO `promociones` (`id_promocion`, `codigo`, `porcentaje_descuento`, `fecha_expiracion`, `activo`) VALUES
  (1, 'VERANO2026', 15.00, '2026-12-31', 1);

INSERT INTO `comentarios` (`id`, `nombre`, `correo`, `comentario`, `id_cabana`, `estrellas`) VALUES
  (1, 'Carlos Muñoz', 'carlos.munoz@gmail.com', 'Excelente ubicación cerca de la playa El Canelo, todo muy limpio y bien equipado.', 1, 5),
  (2, 'Camila Soto', 'camila.soto@gmail.com', 'La vista desde Mirasol es hermosa, muy recomendada para ir en familia.', 2, 5);

INSERT INTO `mensajes_contacto` (`id_mensaje`, `nombre`, `correo`, `mensaje`, `leido`) VALUES
  (1, 'Pedro Rojas', 'pedro.rojas@correo.cl', 'Hola, ¿tienen disponibilidad para la primera semana de diciembre en Cabaña Mirasol?', 0),
  (2, 'Consulta Huesped', 'consulta@correo.cl', '¿Aceptan mascotas pequeñas?', 0);

INSERT INTO `notificaciones` (`id_notificacion`, `id_usuario`, `titulo`, `mensaje`, `leido`) VALUES
  (1, 1, 'Nueva Reserva Pendiente', 'Camila Soto ha registrado la reserva #2 para Cabaña Mirasol Vista.', 0),
  (2, 1, 'Abono Recibido', 'Se registró un abono por $50.000 en la reserva #2 pendiente de revisión.', 0);

INSERT INTO `historial_mensajes_whatsapp` (`id_registro`, `telefono_destino`, `id_reserva`, `mensaje`) VALUES
  (1, '+56998765432', 1, 'Hola Carlos, tu reserva #1 en Cabaña El Canelo está confirmada. ¡Te esperamos!');

SET FOREIGN_KEY_CHECKS = 1;
