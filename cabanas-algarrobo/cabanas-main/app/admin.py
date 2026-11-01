from django.contrib import admin
from .models import Usuario, Cabana, Reserva, Pago, Inventario

@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ('id_usuario', 'nombre', 'correo', 'rol')
    search_fields = ('nombre', 'correo', 'rol')


@admin.register(Cabana)
class CabanaAdmin(admin.ModelAdmin):
    list_display = ('id_cabana', 'nombre', 'ubicacion', 'capacidad', 'estado')
    list_filter = ('estado',)
    search_fields = ('nombre', 'ubicacion')


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ('id_reserva', 'usuario', 'cabana', 'fecha_inicio', 'fecha_fin', 'estado')
    list_filter = ('estado',)
    search_fields = ('usuario__nombre', 'cabana__nombre')

@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ('id_pago', 'id_reserva', 'monto', 'metodo_pago', 'fecha_pago')
    list_filter = ('metodo_pago',)
    search_fields = ('id_reserva',)


class InventarioAdmin(admin.ModelAdmin):
    list_display = ('id_item', 'nombre', 'cantidad', 'estado_display','observacion')

    def estado_display(self, obj):
        return obj.ubicacion
    estado_display.short_description = 'Estado'

admin.site.register(Inventario, InventarioAdmin)


from django.contrib import admin
from .models import MensajeContacto

@admin.register(MensajeContacto)
class MensajeContactoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'correo', 'fecha_envio')
    search_fields = ('nombre', 'correo', 'mensaje')
    list_filter = ('fecha_envio',)

