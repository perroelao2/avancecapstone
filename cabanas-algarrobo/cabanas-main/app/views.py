import requests
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils import timezone
from django.core.mail import send_mail, BadHeaderError
from django.db import connection

from .models import Pago, Usuario, Cabana, Reserva, Comentario


# Página principal (pública)
def index(request):
    cabanas_disponibles = Cabana.objects.filter(estado='Disponible')
    return render(request, 'index.html', {
        'cabanas_disponibles': cabanas_disponibles,
        'nombre': request.session.get('usuario_nombre', '')
    })


# Login de usuarios (clientes)
def login_view(request):
    mensaje = ''
    if request.method == 'POST':
        correo = request.POST.get('correo')
        clave = request.POST.get('clave')

        try:
            response = requests.post(
                "http://127.0.0.1:8001/usuarios/login",
                json={"correo": correo, "contrasena": clave},
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()

                # Si es administrador, se le informa que debe usar la app de escritorio
                if data.get('rol', '').lower() == 'admin':
                    mensaje = 'Las cuentas de administrador deben gestionarse desde la aplicación de escritorio.'
                    return render(request, 'vistas/login.html', {'mensaje': mensaje})

                request.session['usuario_id'] = data['id_usuario']
                request.session['usuario_nombre'] = data['nombre']
                request.session['usuario_rol'] = data['rol']
                return redirect('panel_cliente')
            else:
                mensaje = 'Correo o contraseña incorrectos'

        except requests.RequestException:
            mensaje = 'Error al conectar con el servidor de autenticación'

    return render(request, 'vistas/login.html', {'mensaje': mensaje})


# Logout
def logout_view(request):
    request.session.flush()
    messages.success(request, 'Has cerrado sesión correctamente.')
    return redirect('index')


# Panel de Cliente
def panel_cliente(request):
    nombre = request.session.get('usuario_nombre', '')
    cabanas = Cabana.objects.filter(estado='Disponible')
    return render(request, 'panelCliente.html', {'nombre': nombre, 'cabanas': cabanas})


# Catálogo público de cabañas
def ver_cabanas(request):
    nombre = request.session.get('usuario_nombre', '')
    cabanas = Cabana.objects.order_by('estado')
    return render(request, 'vistas/cabanas.html', {'nombre': nombre, 'cabanas': cabanas})


# Formulario general de reserva
def reservar_formulario(request):
    return render(request, 'vistas/reservas.html')


# Crear reserva de cabaña específica
def reservar_cabana(request, id_cabana):
    if request.method == 'POST':
        fecha_inicio = request.POST.get('fecha_inicio')
        fecha_fin = request.POST.get('fecha_fin')
        usuario_id = request.session.get("usuario_id")

        if not usuario_id:
            messages.warning(request, "Debes iniciar sesión para realizar una reserva.")
            return redirect('login')

        usuario = get_object_or_404(Usuario, id_usuario=usuario_id)
        cabana = get_object_or_404(Cabana, id_cabana=id_cabana)

        Reserva.objects.create(
            usuario=usuario,
            cabana=cabana,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            estado='Pendiente'
        )
        messages.success(request, 'Reserva realizada correctamente.')
        return redirect('pago_transferencia')

    return render(request, 'reservar.html')


# Formulario de pago por transferencia (para la última reserva pendiente del cliente)
def pago_transferencia(request):
    id_usuario = request.session.get('usuario_id')
    reserva = Reserva.objects.filter(usuario_id=id_usuario, estado='Pendiente').order_by('id_reserva').last()

    if request.method == 'POST':
        if reserva:
            monto = 50000  # Monto por defecto
            if reserva.cabana and reserva.cabana.precio_por_noche and reserva.cabana.precio_por_noche > 0:
                noches = (reserva.fecha_fin - reserva.fecha_inicio).days
                if noches > 0:
                    monto = reserva.cabana.precio_por_noche * noches
                else:
                    monto = reserva.cabana.precio_por_noche

            nuevo_pago = Pago(
                id_reserva=reserva.id_reserva,
                monto=monto,
                metodo_pago='transferencia',
                id_metodo_pago=1,
                id_estado_pago=1  # Pendiente Revisión
            )
            nuevo_pago.save()

            messages.success(request, "Comprobante de pago enviado con éxito. La administración validará su pago.")
            return redirect('panel_cliente')
        else:
            messages.error(request, "No tienes reservas pendientes para pagar.")

    nombre = request.session.get('usuario_nombre', '')
    return render(request, 'vistas/pago_transferencia.html', {'nombre': nombre, 'reserva': reserva})


# Contacto público
def contacto_view(request):
    nombre = request.session.get('usuario_nombre', '')
    return render(request, 'vistas/contacto.html', {'nombre': nombre})


# Guardar mensaje de contacto
def guardar_mensaje(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        correo = request.POST.get('correo')
        mensaje = request.POST.get('mensaje')

        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO mensajes_contacto (nombre, correo, mensaje)
                VALUES (%s, %s, %s)
            """, [nombre, correo, mensaje])

        try:
            send_mail(
                subject='📩 Nuevo mensaje de contacto',
                message=f'Nombre: {nombre}\nCorreo: {correo}\n\nMensaje:\n{mensaje}',
                from_email='tunuevocorreo@gmail.com',
                recipient_list=['rodrigo01acr@gmail.com'],
                fail_silently=True,
            )
        except Exception:
            pass

        messages.success(request, '✅ Mensaje enviado correctamente.')
        return redirect('contacto')

    return redirect('contacto')


# Comentarios públicos y calificaciones con estrellas
def comentarios(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        correo = request.POST.get('correo', '').strip()
        texto = request.POST.get('comentario', '').strip()
        estrellas = int(request.POST.get('estrellas', 5))

        if not nombre or not correo or not texto:
            messages.error(request, "❌ Todos los campos son obligatorios.")
        else:
            Comentario.objects.create(
                nombre=nombre,
                correo=correo,
                comentario=texto,
                estrellas=estrellas,
                fecha=timezone.now()
            )
            estrellas_visual = "★" * estrellas + "☆" * (5 - estrellas)
            messages.success(request, f"✅ ¡Gracias por tu comentario! {estrellas_visual}")
            return redirect('comentarios')

    comentarios_list = Comentario.objects.order_by('-fecha')
    nombre_usuario = request.session.get('usuario_nombre', '')
    return render(request, 'vistas/comentarios.html', {
        'comentarios': comentarios_list,
        'nombre': nombre_usuario
    })


# Crear cuenta de cliente
def crear_cuenta(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre')
        correo = request.POST.get('correo')
        contrasena1 = request.POST.get('contrasena1')
        contrasena2 = request.POST.get('contrasena2')

        if contrasena1 != contrasena2:
            messages.error(request, "Las contraseñas no coinciden.")
            return render(request, 'vistas/crear_cuenta.html')

        try:
            registro_resp = requests.post(
                "http://127.0.0.1:8001/usuarios/registro",
                json={
                    "nombre": nombre,
                    "correo": correo,
                    "contrasena": contrasena1,
                    "rol": "cliente"
                },
                timeout=5
            )

            if registro_resp.status_code == 200:
                login_resp = requests.post(
                    "http://127.0.0.1:8001/usuarios/login",
                    json={
                        "correo": correo,
                        "contrasena": contrasena1
                    },
                    timeout=5
                )

                if login_resp.status_code == 200:
                    user_data = login_resp.json()
                    request.session['usuario_id'] = user_data['id_usuario']
                    request.session['usuario_nombre'] = user_data['nombre']
                    request.session['usuario_rol'] = user_data['rol']

                    messages.success(request, "Cuenta creada e iniciada sesión correctamente.")
                    return redirect('panel_cliente')
                else:
                    messages.error(request, "Error al iniciar sesión después del registro.")
            elif registro_resp.status_code == 400:
                detalle = registro_resp.json().get("detail", "Correo ya registrado.")
                messages.error(request, detalle)
            else:
                messages.error(request, "No se pudo crear la cuenta. Intenta nuevamente.")

        except requests.RequestException:
            messages.error(request, "Error de conexión con el servidor de usuarios.")

    return render(request, 'vistas/crear_cuenta.html')
