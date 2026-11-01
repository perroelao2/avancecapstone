from django.db import models

class Usuario(models.Model):
    id_usuario = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)
    correo = models.CharField(unique=True, max_length=100)
    contrasena = models.CharField(max_length=100)
    rol = models.CharField(max_length=20)

    class Meta:
        db_table = 'usuarios'
        managed = False

    def __str__(self):
        return self.nombre


class Cabana(models.Model):
    id_cabana = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)
    ubicacion = models.CharField(max_length=100)
    capacidad = models.IntegerField()
    estado = models.CharField(max_length=20, default='Disponible')
    precio_por_noche = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'cabanas'
        managed = False

    def __str__(self):
        return self.nombre


class Reserva(models.Model):
    id_reserva = models.AutoField(primary_key=True)
    usuario = models.ForeignKey('Usuario', on_delete=models.CASCADE, db_column='id_usuario')
    cabana = models.ForeignKey(Cabana, on_delete=models.CASCADE, db_column='id_cabana')
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=20, default='Pendiente')

    class Meta:
        db_table = 'reservas'
        managed = False

    def __str__(self):
        return f"Reserva #{self.id_reserva}"


class EstadoPago(models.Model):
    id_estado_pago = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = 'estados_pago'
        managed = False

    def __str__(self):
        return self.nombre


class MetodoPago(models.Model):
    id_metodo_pago = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = 'metodos_pago'
        managed = False

    def __str__(self):
        return self.nombre


class Pago(models.Model):
    id_pago = models.AutoField(primary_key=True)
    id_reserva = models.IntegerField()
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=30, default='Transferencia', null=True, blank=True)
    id_metodo_pago = models.IntegerField(default=1, null=True, blank=True)
    id_estado_pago = models.IntegerField(default=1, null=True, blank=True)
    fecha_pago = models.DateTimeField(auto_now_add=True)
    observaciones = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'pagos'
        managed = False

    @property
    def confirmado(self):
        return self.id_estado_pago == 2

    @confirmado.setter
    def confirmado(self, value):
        self.id_estado_pago = 2 if value else 1

    @property
    def estado_nombre(self):
        estados = {1: 'Pendiente Revisión', 2: 'Aprobado', 3: 'Rechazado'}
        return estados.get(self.id_estado_pago, 'Desconocido')

    def __str__(self):
        return f"Pago #{self.id_pago}"


class Inventario(models.Model):
    id_item = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)
    cantidad = models.IntegerField()
    ubicacion = models.CharField(max_length=50, blank=True, null=True)
    observacion = models.TextField(blank=True, null=True)
    cabana = models.ForeignKey('Cabana', on_delete=models.CASCADE, db_column='id_cabana', null=True)

    class Meta:
        db_table = 'inventario'
        managed = False


class MensajeContacto(models.Model):
    id_mensaje = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    correo = models.EmailField()
    mensaje = models.TextField()
    fecha_envio = models.DateTimeField()
    leido = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = 'mensajes_contacto'


class Comentario(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    correo = models.EmailField()
    comentario = models.TextField()
    fecha = models.DateTimeField(auto_now_add=True)
    id_cabana = models.IntegerField(null=True, blank=True)
    estrellas = models.IntegerField(default=5)

    class Meta:
        db_table = 'comentarios'
        managed = False

    def __str__(self):
        return f"Comentario de {self.nombre} ({self.estrellas}★)"
