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


# Integración Pasarela de Pagos: Transbank Webpay Plus REST API (Sandbox)
WEBPAY_COMMERCE_CODE = '597055555532'
WEBPAY_API_KEY_SECRET = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C'
WEBPAY_URL_CREAR = 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions'


def iniciar_pago_webpay(request):
    id_usuario = request.session.get('usuario_id')
    if not id_usuario:
        messages.warning(request, "Debes iniciar sesión para realizar el pago.")
        return redirect('login')

    pago_id = request.GET.get('pago_id')
    reserva = None
    if pago_id:
        pago = Pago.objects.filter(id_pago=pago_id).first()
        if pago and pago.id_reserva:
            reserva = Reserva.objects.filter(id_reserva=pago.id_reserva).first()
    if not reserva:
        reserva = Reserva.objects.filter(usuario_id=id_usuario, estado='Pendiente').order_by('id_reserva').last()
    if not reserva:
        reserva = Reserva.objects.filter(usuario_id=id_usuario).order_by('id_reserva').last()
    if not reserva:
        messages.error(request, "No tienes reservas pendientes para pagar.")
        return redirect('panel_cliente')

    monto = 50000
    if reserva.cabana and reserva.cabana.precio_por_noche and reserva.cabana.precio_por_noche > 0:
        noches = (reserva.fecha_fin - reserva.fecha_inicio).days
        monto = int(reserva.cabana.precio_por_noche * (noches if noches > 0 else 1))

    buy_order = f"ORD-{reserva.id_reserva}-{int(timezone.now().timestamp())}"
    session_id = f"SESS-{id_usuario}-{int(timezone.now().timestamp())}"
    return_url = request.build_absolute_uri('/pago/webpay/retorno/')

    headers = {
        'Tbk-Api-Key-Id': WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret': WEBPAY_API_KEY_SECRET,
        'Content-Type': 'application/json'
    }
    payload = {
        'buy_order': buy_order,
        'session_id': session_id,
        'amount': monto,
        'return_url': return_url
    }

    try:
        resp = requests.post(WEBPAY_URL_CREAR, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return render(request, 'vistas/webpay_redirect.html', {
                'url': data.get('url'),
                'token': data.get('token')
            })
        else:
            messages.error(request, f"Error al iniciar Webpay Plus: {resp.text}")
            return redirect('pago_transferencia')
    except Exception as e:
        messages.error(request, f"Error de conexión con Transbank Webpay: {e}")
        return redirect('pago_transferencia')


def retorno_pago_webpay(request):
    token_ws = request.GET.get('token_ws') or request.POST.get('token_ws')
    tbk_token = request.GET.get('TBK_TOKEN') or request.POST.get('TBK_TOKEN')

    if tbk_token and not token_ws:
        messages.warning(request, "⚠️ Pago en Webpay Plus cancelado por el usuario.")
        return redirect('pago_transferencia')

    if not token_ws:
        messages.error(request, "❌ No se recibió token de transacción válido.")
        return redirect('pago_transferencia')

    headers = {
        'Tbk-Api-Key-Id': WEBPAY_COMMERCE_CODE,
        'Tbk-Api-Key-Secret': WEBPAY_API_KEY_SECRET,
        'Content-Type': 'application/json'
    }

    try:
        commit_url = f"{WEBPAY_URL_CREAR}/{token_ws}"
        resp = requests.put(commit_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('response_code') == 0:  # Aprobado
                buy_order = data.get('buy_order', '')
                amount = data.get('amount', 0)
                auth_code = data.get('authorization_code', 'N/A')
                card_last4 = data.get('card_detail', {}).get('card_number', '****')

                parts = buy_order.split('-')
                id_reserva = int(parts[1]) if len(parts) >= 2 and parts[1].isdigit() else None

                reserva = None
                if id_reserva:
                    reserva = Reserva.objects.filter(id_reserva=id_reserva).first()
                if not reserva:
                    id_usuario = request.session.get('usuario_id')
                    reserva = Reserva.objects.filter(usuario_id=id_usuario).order_by('id_reserva').last()

                if reserva:
                    reserva.estado = 'Confirmada'
                    reserva.save()

                    Pago.objects.create(
                        id_reserva=reserva.id_reserva,
                        monto=amount,
                        metodo_pago='Webpay Plus',
                        id_metodo_pago=2,  # Webpay / Tarjeta Débito-Crédito
                        id_estado_pago=2,  # Aprobado
                        observaciones=f"Webpay Aut: {auth_code} | Tarjeta: ****{card_last4}"
                    )

                    # Registrar notificación automática de WhatsApp
                    try:
                        clean_tel = '+569' + str(reserva.usuario.id_usuario).zfill(8)
                        with connection.cursor() as cursor:
                            cursor.execute("""
                                INSERT INTO historial_mensajes_whatsapp (telefono_destino, id_reserva, mensaje)
                                VALUES (%s, %s, %s)
                            """, [
                                clean_tel,
                                reserva.id_reserva,
                                f"¡Hola {reserva.usuario.nombre}! Tu pago de ${amount} con Webpay Plus fue aprobado (Cod Aut: {auth_code}). Tu reserva #{reserva.id_reserva} en {reserva.cabana.nombre} está Confirmada."
                            ])
                    except Exception as e:
                        print("Error logging whatsapp notification:", e)

                    return render(request, 'vistas/webpay_voucher.html', {
                        'reserva': reserva,
                        'buy_order': buy_order,
                        'auth_code': auth_code,
                        'card_last4': card_last4,
                        'amount': amount
                    })
            else:
                messages.error(request, f"❌ Transacción rechazada por el banco emisor (Código: {data.get('response_code')}).")
                return redirect('pago_transferencia')
        else:
            messages.error(request, f"❌ Error de confirmación con Webpay: {resp.text}")
            return redirect('pago_transferencia')
    except Exception as e:
        messages.error(request, f"❌ Error de comunicación con Webpay Plus: {e}")
        return redirect('pago_transferencia')


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
