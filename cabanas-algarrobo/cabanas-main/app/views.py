import os
import json
import html
import smtplib
from datetime import date, datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
import requests
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.utils import timezone
from django.conf import settings
from django.db import connection

from .models import Pago, Usuario, Cabana, Reserva, Comentario


def _construir_html_correo(titulo, subtitulo, filas_detalle, texto_adicional='', badge_texto='Confirmado', badge_color='#16a34a'):
    """Genera una plantilla HTML institucional responsiva para los correos de Cabañas Algarrobo."""
    filas_html = ''.join(
        f"""
        <tr>
          <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#475569; font-weight:600; font-size:13.5px; width:44%;">{html.escape(str(etiqueta))}</td>
          <td style="padding:10px 14px; border-bottom:1px solid #e2e8f0; color:#0f172a; font-weight:600; font-size:13.5px; text-align:right;">{html.escape(str(valor))}</td>
        </tr>
        """
        for etiqueta, valor in filas_detalle
    )
    extra_html = ''
    if texto_adicional:
        extra_html = f"""
        <div style="margin-top:18px; padding:14px 16px; background:#f8fafc; border-left:4px solid #004B87; border-radius:6px; color:#334155; font-size:14px; line-height:1.55; white-space:pre-line;">
          {html.escape(str(texto_adicional))}
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /></head>
<body style="margin:0; padding:24px 12px; background-color:#f1f5f9; font-family:'Segoe UI', Arial, Helvetica, sans-serif;">
  <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 16px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg, #004B87 0%, #0284c7 100%); padding:26px 28px; text-align:center; color:#ffffff;">
      <div style="font-size:22px; font-weight:700; letter-spacing:0.3px;">🏡 Cabañas Algarrobo</div>
      <div style="font-size:13px; color:#e0f2fe; margin-top:4px;">El Manzano, Algarrobo — Litoral Central, Chile</div>
    </div>

    <div style="padding:28px;">
      <div style="text-align:center; margin-bottom:18px;">
        <span style="display:inline-block; background:{badge_color}; color:#ffffff; padding:5px 14px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase;">
          {html.escape(str(badge_texto))}
        </span>
      </div>

      <h2 style="margin:0 0 8px 0; color:#004B87; font-size:20px; text-align:center;">{html.escape(str(titulo))}</h2>
      <p style="margin:0 0 22px 0; color:#475569; font-size:14.5px; line-height:1.55; text-align:center;">
        {html.escape(str(subtitulo))}
      </p>

      <table style="width:100%; border-collapse:collapse; background:#f8fafc; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0;">
        <tbody>
          {filas_html}
        </tbody>
      </table>

      {extra_html}
    </div>

    <div style="background:#f8fafc; padding:18px 24px; text-align:center; border-top:1px solid #e2e8f0; color:#64748b; font-size:12.5px; line-height:1.5;">
      <strong style="color:#004B87;">¡Te esperamos en Cabañas Algarrobo!</strong><br />
      Este correo fue generado automáticamente. Ante cualquier consulta, contáctanos desde nuestro sitio web.
    </div>
  </div>
</body>
</html>"""


def despachar_correo_sistema(asunto, cuerpo, destinatario, id_usuario=None, html_cuerpo=None):
    """
    Envía el correo multipart (texto plano + HTML institucional) vía SMTP limpiando espacios
    de la clave de aplicación, guarda copia de respaldo en correos_enviados/ y registra
    notificación interna en BD.
    """
    # 1. Guardar copia local en correos_enviados/
    try:
        carpeta_correos = os.path.join(settings.BASE_DIR, 'correos_enviados')
        os.makedirs(carpeta_correos, exist_ok=True)
        timestamp_str = timezone.now().strftime('%Y%m%d_%H%M%S')
        safe_dest = str(destinatario or 'sistema').replace('@', '_at_').replace('/', '_')
        ruta_archivo = os.path.join(carpeta_correos, f"{timestamp_str}_{safe_dest}.txt")
        with open(ruta_archivo, 'w', encoding='utf-8') as f:
            f.write(f"DE: {settings.EMAIL_HOST_USER}\n")
            f.write(f"PARA: {destinatario}\n")
            f.write(f"FECHA: {timezone.now()}\n")
            f.write(f"ASUNTO: {asunto}\n")
            f.write("-" * 50 + "\n")
            f.write(cuerpo)
        print(f"📩 [CORREO REGISTRADO EN DISCO]: {ruta_archivo}")
    except Exception as e:
        print("Error guardando copia de correo en disco:", e)

    # 2. Registrar notificación interna en la tabla `notificaciones`
    try:
        with connection.cursor() as cursor:
            uid = id_usuario
            if not uid and destinatario:
                cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s LIMIT 1", [destinatario])
                row = cursor.fetchone()
                if row:
                    uid = row[0]
            if not uid:
                cursor.execute("SELECT id_usuario FROM usuarios WHERE id_rol = 1 OR rol = 'admin' ORDER BY id_usuario LIMIT 1")
                row = cursor.fetchone()
                if row:
                    uid = row[0]
            if uid:
                cursor.execute(
                    "INSERT INTO notificaciones (id_usuario, titulo, mensaje) VALUES (%s, %s, %s)",
                    [uid, str(asunto)[:100], f"Para: {destinatario}\n{cuerpo}"]
                )
    except Exception as e:
        print("Error registrando notificación interna:", e)

    # 3. Enviar por SMTP a través de Gmail (Texto Plano + HTML)
    smtp_user = (settings.EMAIL_HOST_USER or '').strip()
    smtp_pass = (settings.EMAIL_HOST_PASSWORD or '').replace(' ', '').strip()
    if not smtp_user or not smtp_pass:
        print("⚠️ [AVISO SMTP]: Faltan credenciales EMAIL_HOST_USER/EMAIL_HOST_PASSWORD. Copia respaldada en disco.")
        return False

    html_final = html_cuerpo or _construir_html_correo(
        titulo=asunto,
        subtitulo='Notificación oficial de Cabañas Algarrobo',
        filas_detalle=[('Destinatario', destinatario), ('Fecha', timezone.now().strftime('%Y-%m-%d %H:%M'))],
        texto_adicional=cuerpo,
        badge_texto='Aviso',
        badge_color='#004B87'
    )

    server = None
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = asunto
        msg['From'] = formataddr(('Cabañas Algarrobo', smtp_user))
        msg['To'] = destinatario
        msg.attach(MIMEText(cuerpo, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_final, 'html', 'utf-8'))

        server = smtplib.SMTP(settings.EMAIL_HOST, int(settings.EMAIL_PORT), timeout=10)
        server.ehlo()
        if getattr(settings, 'EMAIL_USE_TLS', True):
            server.starttls()
            server.ehlo()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, [destinatario], msg.as_string())
        print(f"✅ [CORREO SMTP ENVIADO]: Para {destinatario}")
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"⚠️ [AVISO SMTP 535]: Gmail rechazó usuario o Contraseña de Aplicación para {smtp_user} ({e}). Revisa la clave de 16 caracteres en settings.py. Copia respaldada en correos_enviados/.")
        return False
    except smtplib.SMTPServerDisconnected as e:
        print(f"⚠️ [AVISO SMTP]: Gmail cerró la conexión inesperadamente ({e}); verifica que la Contraseña de Aplicación de 16 caracteres corresponda a {smtp_user}. Copia respaldada en correos_enviados/.")
        return False
    except Exception as e:
        print(f"⚠️ [AVISO SMTP]: No se pudo entregar vía Gmail SMTP ({e}). Copia respaldada en correos_enviados/.")
        return False
    finally:
        if server:
            try:
                server.quit()
            except Exception:
                pass


def _to_date(val):
    """Convierte string ISO o datetime a date."""
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    return datetime.strptime(str(val)[:10], '%Y-%m-%d').date()


def _obtener_disponibilidad_cabana(id_cabana):
    """
    Construye el mapa día por día y rangos de fechas ocupadas o bloqueadas para una cabaña.
    Incluye reservas activas (no canceladas), bloqueos_fechas y mantenciones_cabana.
    """
    dias_ocupados = {}
    rangos_bloqueados = []

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT id_reserva, fecha_inicio, fecha_fin, estado
            FROM reservas
            WHERE id_cabana = %s
              AND LOWER(COALESCE(estado, '')) NOT IN ('cancelada', 'rechazada')
              AND (id_estado_reserva IS NULL OR id_estado_reserva != 5)
            ORDER BY fecha_inicio
        """, [id_cabana])
        for id_res, f_ini, f_fin, estado in cursor.fetchall():
            d_ini = _to_date(f_ini)
            d_fin = _to_date(f_fin)
            rangos_bloqueados.append({
                'tipo': 'reservado',
                'inicio': d_ini.isoformat(),
                'fin': d_fin.isoformat(),
                'motivo': f'Reserva #{id_res} ({estado})'
            })
            cur = d_ini
            while cur <= d_fin:
                dias_ocupados[cur.isoformat()] = {
                    'tipo': 'reservado',
                    'motivo': f'Reservado ({d_ini.isoformat()} al {d_fin.isoformat()})'
                }
                cur += timedelta(days=1)

        cursor.execute("""
            SELECT id_bloqueo, fecha_desde, fecha_hasta, motivo
            FROM bloqueos_fechas
            WHERE id_cabana = %s
            ORDER BY fecha_desde
        """, [id_cabana])
        for id_bloq, f_desde, f_hasta, motivo in cursor.fetchall():
            d_ini = _to_date(f_desde)
            d_fin = _to_date(f_hasta)
            mot = motivo or 'Bloqueo administrativo'
            rangos_bloqueados.append({
                'tipo': 'bloqueado',
                'inicio': d_ini.isoformat(),
                'fin': d_fin.isoformat(),
                'motivo': mot
            })
            cur = d_ini
            while cur <= d_fin:
                if cur.isoformat() not in dias_ocupados:
                    dias_ocupados[cur.isoformat()] = {'tipo': 'bloqueado', 'motivo': mot}
                cur += timedelta(days=1)

        cursor.execute("""
            SELECT id_mantencion, fecha, descripcion
            FROM mantenciones_cabana
            WHERE id_cabana = %s
            ORDER BY fecha
        """, [id_cabana])
        for id_mant, f_mant, desc in cursor.fetchall():
            d_m = _to_date(f_mant)
            mot = f'Mantención: {desc}'
            rangos_bloqueados.append({
                'tipo': 'bloqueado',
                'inicio': d_m.isoformat(),
                'fin': d_m.isoformat(),
                'motivo': mot
            })
            if d_m.isoformat() not in dias_ocupados:
                dias_ocupados[d_m.isoformat()] = {'tipo': 'bloqueado', 'motivo': mot}

    return dias_ocupados, rangos_bloqueados


def _calcular_monto_reserva(reserva):
    """Obtiene el monto total persistido de la reserva o lo calcula por noches + servicios."""
    if getattr(reserva, 'monto_total', None) and float(reserva.monto_total) > 0:
        return int(round(float(reserva.monto_total)))
    precio_noche = float(reserva.cabana.precio_por_noche) if (reserva.cabana and reserva.cabana.precio_por_noche) else 50000.0
    noches = max(1, (reserva.fecha_fin - reserva.fecha_inicio).days)
    servicios_total = 0.0
    with connection.cursor() as cursor:
        cursor.execute("SELECT COALESCE(SUM(subtotal), 0) FROM reservas_servicios WHERE id_reserva = %s", [reserva.id_reserva])
        row = cursor.fetchone()
        if row and row[0]:
            servicios_total = float(row[0])
    return int(round(noches * precio_noche + servicios_total))


def _obtener_detalles_reservas_usuario(id_usuario):
    """Retorna todas las reservas del cliente con huéspedes, servicios y último estado de pago."""
    reservas_qs = Reserva.objects.filter(usuario_id=id_usuario).select_related('cabana').order_by('-id_reserva')
    resultado = []
    if not reservas_qs:
        return resultado

    with connection.cursor() as cursor:
        for res in reservas_qs:
            cursor.execute(
                "SELECT nombre_completo, rut_o_pasaporte FROM huespedes_adicionales WHERE id_reserva = %s ORDER BY id_huesped",
                [res.id_reserva]
            )
            huespedes = [{'nombre_completo': r[0], 'rut_o_pasaporte': r[1]} for r in cursor.fetchall()]

            cursor.execute("""
                SELECT sa.nombre, rs.cantidad, rs.subtotal
                FROM reservas_servicios rs
                JOIN servicios_adicionales sa ON rs.id_servicio = sa.id_servicio
                WHERE rs.id_reserva = %s
            """, [res.id_reserva])
            servicios = [{'nombre': r[0], 'cantidad': r[1], 'subtotal': float(r[2])} for r in cursor.fetchall()]

            cursor.execute("""
                SELECT p.id_pago, p.monto, p.metodo_pago, p.id_estado_pago, ep.nombre
                FROM pagos p
                LEFT JOIN estados_pago ep ON p.id_estado_pago = ep.id_estado_pago
                WHERE p.id_reserva = %s
                ORDER BY p.id_pago DESC
                LIMIT 1
            """, [res.id_reserva])
            pago_row = cursor.fetchone()
            pago_info = None
            if pago_row:
                pago_info = {
                    'id_pago': pago_row[0],
                    'monto': float(pago_row[1]),
                    'metodo': pago_row[2],
                    'id_estado_pago': pago_row[3],
                    'estado_nombre': pago_row[4] or ('Aprobado' if pago_row[3] == 2 else 'Pendiente Revisión')
                }

            noches = max(1, (res.fecha_fin - res.fecha_inicio).days)
            monto_calc = _calcular_monto_reserva(res)
            resultado.append({
                'reserva': res,
                'noches': noches,
                'monto_total': monto_calc,
                'huespedes': huespedes,
                'total_personas': 1 + len(huespedes),
                'servicios': servicios,
                'pago': pago_info,
            })
    return resultado


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
    usuario_id = request.session.get('usuario_id')
    if not usuario_id:
        messages.warning(request, "Debes iniciar sesión para ver tu panel de cliente.")
        return redirect('login')

    nombre = request.session.get('usuario_nombre', '')
    cabanas = Cabana.objects.all().order_by('id_cabana')
    mis_reservas = _obtener_detalles_reservas_usuario(usuario_id)
    return render(request, 'panelCliente.html', {
        'nombre': nombre,
        'cabanas': cabanas,
        'mis_reservas': mis_reservas,
    })


# Cancelar reserva desde el Panel de Cliente
def cancelar_reserva_cliente(request, id_reserva):
    usuario_id = request.session.get('usuario_id')
    if not usuario_id:
        messages.warning(request, "Debes iniciar sesión para realizar esta acción.")
        return redirect('login')

    reserva = get_object_or_404(Reserva, id_reserva=id_reserva, usuario_id=usuario_id)
    if reserva.estado in ('Finalizada', 'Check-in Realizado'):
        messages.error(request, "No es posible cancelar una reserva que ya está en curso o finalizada.")
        return redirect('panel_cliente')

    reserva.estado = 'Cancelada'
    reserva.id_estado_reserva = 5
    reserva.save()
    messages.success(request, f"✅ Reserva #{reserva.id_reserva} cancelada. Las fechas han quedado liberadas.")
    return redirect('panel_cliente')


# Catálogo público de cabañas
def ver_cabanas(request):
    nombre = request.session.get('usuario_nombre', '')
    cabanas = Cabana.objects.order_by('id_cabana')
    return render(request, 'vistas/cabanas.html', {'nombre': nombre, 'cabanas': cabanas})


# Formulario general de reserva
def reservar_formulario(request):
    return redirect('ver_cabanas')


# Crear reserva de cabaña específica con calendario, validación de traslape, capacidad y servicios
def reservar_cabana(request, id_cabana):
    usuario_id = request.session.get("usuario_id")
    if not usuario_id:
        messages.warning(request, "Debes iniciar sesión para realizar una reserva.")
        return redirect('login')

    usuario = get_object_or_404(Usuario, id_usuario=usuario_id)
    cabana = get_object_or_404(Cabana, id_cabana=id_cabana)

    with connection.cursor() as cursor:
        cursor.execute("SELECT id_servicio, nombre, precio FROM servicios_adicionales ORDER BY id_servicio")
        servicios_disponibles = [
            {'id_servicio': r[0], 'nombre': r[1], 'precio': int(float(r[2]))}
            for r in cursor.fetchall()
        ]
        cursor.execute("""
            SELECT co.nombre FROM cabanas_comodidades cc
            JOIN comodidades co ON cc.id_comodidad = co.id_comodidad
            WHERE cc.id_cabana = %s
        """, [id_cabana])
        comodidades = [r[0] for r in cursor.fetchall()]

        cursor.execute("SELECT descripcion FROM reglas_cabana WHERE id_cabana = %s ORDER BY id_regla", [id_cabana])
        reglas = [r[0] for r in cursor.fetchall()]

    dias_ocupados, rangos_bloqueados = _obtener_disponibilidad_cabana(id_cabana)
    hoy_str = date.today().isoformat()

    if request.method == 'POST':
        fecha_inicio_str = (request.POST.get('fecha_inicio') or '').strip()
        fecha_fin_str = (request.POST.get('fecha_fin') or '').strip()
        nombres_h = request.POST.getlist('huesped_nombre')
        ruts_h = request.POST.getlist('huesped_rut')
        servicios_sel = request.POST.getlist('servicio_id')

        huespedes_limpios = []
        for idx, nom in enumerate(nombres_h):
            nom_clean = (nom or '').strip()
            if nom_clean:
                rut_clean = (ruts_h[idx] if idx < len(ruts_h) else '').strip()
                huespedes_limpios.append((nom_clean, rut_clean))

        error_msg = None
        f_ini = None
        f_fin = None

        if cabana.estado != 'Disponible':
            error_msg = f"La cabaña '{cabana.nombre}' actualmente se encuentra en estado '{cabana.estado}' y no admite nuevas reservas."
        else:
            try:
                f_ini = date.fromisoformat(fecha_inicio_str)
                f_fin = date.fromisoformat(fecha_fin_str)
            except ValueError:
                error_msg = "Debes seleccionar fechas válidas de entrada y salida en el calendario."

        if not error_msg:
            if f_ini < date.today():
                error_msg = "No puedes reservar en una fecha pasada."
            elif f_fin <= f_ini:
                error_msg = "La fecha de salida debe ser al menos 1 día posterior a la fecha de llegada."

        # Verificar cruce con reservas activas, bloqueos o mantenciones (rango inclusivo)
        if not error_msg:
            for r in rangos_bloqueados:
                r_ini = date.fromisoformat(r['inicio'])
                r_fin = date.fromisoformat(r['fin'])
                if f_ini <= r_fin and f_fin >= r_ini:
                    error_msg = f"Las fechas seleccionadas chocan con un período no disponible ({r['inicio']} al {r['fin']} — {r['motivo']}). Por favor elige fechas verdes en el calendario."
                    break

        # Verificar capacidad máxima (1 titular + acompañantes <= cabana.capacidad)
        if not error_msg:
            total_personas = 1 + len(huespedes_limpios)
            if total_personas > cabana.capacidad:
                error_msg = f"Capacidad excedida: '{cabana.nombre}' admite máximo {cabana.capacidad} personas (tú como titular + {len(huespedes_limpios)} acompañantes = {total_personas})."

        if error_msg:
            messages.error(request, error_msg)
        else:
            noches = (f_fin - f_ini).days
            precio_noche = float(cabana.precio_por_noche or 0)
            subtotal_noches = noches * precio_noche

            servicios_a_guardar = []
            subtotal_servicios = 0.0
            serv_map = {str(s['id_servicio']): s for s in servicios_disponibles}
            for sid in servicios_sel:
                if sid in serv_map:
                    try:
                        cant = max(1, int(request.POST.get(f'servicio_cantidad_{sid}', 1)))
                    except ValueError:
                        cant = 1
                    sub = cant * float(serv_map[sid]['precio'])
                    subtotal_servicios += sub
                    servicios_a_guardar.append((int(sid), cant, sub))

            monto_total = subtotal_noches + subtotal_servicios

            nueva_reserva = Reserva.objects.create(
                usuario=usuario,
                cabana=cabana,
                fecha_inicio=f_ini,
                fecha_fin=f_fin,
                estado='Pendiente',
                id_estado_reserva=1,
                monto_total=monto_total
            )

            with connection.cursor() as cursor:
                for nom_h, rut_h in huespedes_limpios:
                    cursor.execute(
                        "INSERT INTO huespedes_adicionales (id_reserva, nombre_completo, rut_o_pasaporte) VALUES (%s, %s, %s)",
                        [nueva_reserva.id_reserva, nom_h[:100], (rut_h[:30] if rut_h else None)]
                    )
                for sid, cant, sub in servicios_a_guardar:
                    cursor.execute(
                        "INSERT INTO reservas_servicios (id_reserva, id_servicio, cantidad, subtotal) VALUES (%s, %s, %s, %s)",
                        [nueva_reserva.id_reserva, sid, cant, sub]
                    )

            messages.success(request, f"Reserva #{nueva_reserva.id_reserva} creada (${int(monto_total):,} CLP). Completa tu pago para confirmarla.")
            return redirect(f"/pago-transferencia/?reserva_id={nueva_reserva.id_reserva}")

    return render(request, 'reservar.html', {
        'cabana': cabana,
        'usuario': usuario,
        'nombre': request.session.get('usuario_nombre', usuario.nombre),
        'servicios': servicios_disponibles,
        'comodidades': comodidades,
        'reglas': reglas,
        'hoy_str': hoy_str,
        'dias_ocupados_json': json.dumps(dias_ocupados),
        'rangos_bloqueados': rangos_bloqueados,
        'servicios_json': json.dumps(servicios_disponibles),
    })


def _resolver_reserva_cliente(request, id_usuario):
    """Obtiene la reserva solicitada por reserva_id/pago_id o la última reserva pendiente del cliente."""
    reserva_id = request.GET.get('reserva_id') or request.POST.get('reserva_id')
    pago_id = request.GET.get('pago_id')
    reserva = None
    if reserva_id:
        reserva = Reserva.objects.filter(id_reserva=reserva_id, usuario_id=id_usuario).select_related('cabana', 'usuario').first()
    if not reserva and pago_id:
        pago = Pago.objects.filter(id_pago=pago_id).first()
        if pago and pago.id_reserva:
            reserva = Reserva.objects.filter(id_reserva=pago.id_reserva, usuario_id=id_usuario).select_related('cabana', 'usuario').first()
    if not reserva:
        reserva = Reserva.objects.filter(usuario_id=id_usuario, estado='Pendiente').select_related('cabana', 'usuario').order_by('id_reserva').last()
    if not reserva:
        reserva = Reserva.objects.filter(usuario_id=id_usuario).exclude(estado='Cancelada').select_related('cabana', 'usuario').order_by('id_reserva').last()
    return reserva


# Formulario de pago por transferencia o pasarela Webpay
def pago_transferencia(request):
    id_usuario = request.session.get('usuario_id')
    if not id_usuario:
        messages.warning(request, "Debes iniciar sesión para realizar el pago.")
        return redirect('login')

    reserva = _resolver_reserva_cliente(request, id_usuario)

    if request.method == 'POST':
        if reserva:
            monto = _calcular_monto_reserva(reserva)
            banco_origen = (request.POST.get('banco_origen') or '').strip()
            numero_operacion = (request.POST.get('numero_operacion') or '').strip()

            nuevo_pago = Pago(
                id_reserva=reserva.id_reserva,
                monto=monto,
                metodo_pago='transferencia',
                id_metodo_pago=1,
                id_estado_pago=1  # Pendiente Revisión
            )
            nuevo_pago.save()

            if numero_operacion or banco_origen:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO comprobantes_transferencia (id_pago, url_archivo, numero_operacion, banco_origen) VALUES (%s, %s, %s, %s)",
                        [nuevo_pago.id_pago, 'transferencia_web.pdf', numero_operacion or None, banco_origen or None]
                    )

            messages.success(request, "Comprobante de pago enviado con éxito. La administración validará su pago.")
            return redirect('panel_cliente')
        else:
            messages.error(request, "No tienes reservas pendientes para pagar.")

    huespedes = []
    servicios = []
    monto_total = 0
    noches = 1
    if reserva:
        noches = max(1, (reserva.fecha_fin - reserva.fecha_inicio).days)
        monto_total = _calcular_monto_reserva(reserva)
        with connection.cursor() as cursor:
            cursor.execute("SELECT nombre_completo, rut_o_pasaporte FROM huespedes_adicionales WHERE id_reserva = %s", [reserva.id_reserva])
            huespedes = [{'nombre': r[0], 'rut': r[1]} for r in cursor.fetchall()]
            cursor.execute("""
                SELECT sa.nombre, rs.cantidad, rs.subtotal
                FROM reservas_servicios rs
                JOIN servicios_adicionales sa ON rs.id_servicio = sa.id_servicio
                WHERE rs.id_reserva = %s
            """, [reserva.id_reserva])
            servicios = [{'nombre': r[0], 'cantidad': r[1], 'subtotal': int(float(r[2]))} for r in cursor.fetchall()]

    nombre = request.session.get('usuario_nombre', '')
    return render(request, 'vistas/pago_transferencia.html', {
        'nombre': nombre,
        'reserva': reserva,
        'noches': noches,
        'monto_total': monto_total,
        'huespedes': huespedes,
        'servicios': servicios,
    })


# Integración Pasarela de Pagos: Transbank Webpay Plus REST API (Sandbox)
WEBPAY_COMMERCE_CODE = '597055555532'
WEBPAY_API_KEY_SECRET = '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C'
WEBPAY_URL_CREAR = 'https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions'


def iniciar_pago_webpay(request):
    id_usuario = request.session.get('usuario_id')
    if not id_usuario:
        messages.warning(request, "Debes iniciar sesión para realizar el pago.")
        return redirect('login')

    reserva = _resolver_reserva_cliente(request, id_usuario)
    if not reserva:
        messages.error(request, "No tienes reservas pendientes para pagar.")
        return redirect('panel_cliente')

    monto = _calcular_monto_reserva(reserva)

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
                    reserva = Reserva.objects.filter(id_reserva=id_reserva).select_related('cabana', 'usuario').first()
                if not reserva:
                    id_usuario = request.session.get('usuario_id')
                    reserva = Reserva.objects.filter(usuario_id=id_usuario).select_related('cabana', 'usuario').order_by('id_reserva').last()

                if reserva:
                    reserva.estado = 'Confirmada'
                    reserva.id_estado_reserva = 2
                    if not reserva.monto_total or float(reserva.monto_total) <= 0:
                        reserva.monto_total = amount
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

                    # Enviar correo electrónico de confirmación al cliente + respaldo + notificación BD
                    correo_cliente = reserva.usuario.correo if reserva.usuario and reserva.usuario.correo else settings.EMAIL_HOST_USER
                    monto_fmt = f"${int(round(float(amount))):,}".replace(",", ".") + " CLP"
                    asunto_correo = f"✅ Confirmación de Pago y Reserva #{reserva.id_reserva} - Cabañas Algarrobo"
                    cuerpo_correo = (
                        f"Hola {reserva.usuario.nombre},\n\n"
                        f"¡Tu pago a través de Webpay Plus ha sido aprobado con éxito!\n\n"
                        f"Resumen de la Transacción:\n"
                        f"• Reserva N°: #{reserva.id_reserva}\n"
                        f"• Orden de compra: {buy_order}\n"
                        f"• Código de Autorización Transbank: {auth_code}\n"
                        f"• Tarjeta: **** {card_last4}\n"
                        f"• Monto Pagado: {monto_fmt}\n"
                        f"• Cabaña: {reserva.cabana.nombre}\n"
                        f"• Ubicación: {reserva.cabana.ubicacion}\n"
                        f"• Fecha de Entrada: {reserva.fecha_inicio}\n"
                        f"• Fecha de Salida: {reserva.fecha_fin}\n"
                        f"• Estado: Confirmada\n\n"
                        f"¡Te esperamos en Cabañas Algarrobo!"
                    )
                    html_correo = _construir_html_correo(
                        titulo=f"Confirmación de Reserva #{reserva.id_reserva}",
                        subtitulo=f"Hola {reserva.usuario.nombre}, tu pago a través de Webpay Plus ha sido aprobado con éxito y tu estadía está confirmada.",
                        filas_detalle=[
                            ('Reserva N°', f"#{reserva.id_reserva}"),
                            ('Cabaña', reserva.cabana.nombre),
                            ('Ubicación', reserva.cabana.ubicacion),
                            ('Fecha de Entrada', str(reserva.fecha_inicio)),
                            ('Fecha de Salida', str(reserva.fecha_fin)),
                            ('Orden de Compra', buy_order),
                            ('Código Autorización Transbank', auth_code),
                            ('Tarjeta', f"**** **** **** {card_last4}"),
                            ('Estado', 'Confirmada'),
                            ('Monto Total Pagado', monto_fmt),
                        ],
                        badge_texto='✔ Pago Aprobado',
                        badge_color='#16a34a'
                    )
                    despachar_correo_sistema(
                        asunto_correo,
                        cuerpo_correo,
                        correo_cliente,
                        id_usuario=reserva.usuario.id_usuario if reserva.usuario else None,
                        html_cuerpo=html_correo
                    )

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

        asunto_contacto = f'📩 Nuevo mensaje de contacto de {nombre} - Cabañas Algarrobo'
        cuerpo_contacto = f'Nombre: {nombre}\nCorreo: {correo}\n\nMensaje:\n{mensaje}'
        html_contacto = _construir_html_correo(
            titulo='Nuevo Mensaje de Contacto Web',
            subtitulo='Has recibido una nueva consulta desde el formulario de Cabañas Algarrobo.',
            filas_detalle=[
                ('Nombre', nombre),
                ('Correo del Remitente', correo),
                ('Fecha de Recepción', timezone.now().strftime('%Y-%m-%d %H:%M')),
            ],
            texto_adicional=mensaje,
            badge_texto='📩 Consulta Web',
            badge_color='#0284c7'
        )
        despachar_correo_sistema(asunto_contacto, cuerpo_contacto, settings.EMAIL_HOST_USER, html_cuerpo=html_contacto)

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
