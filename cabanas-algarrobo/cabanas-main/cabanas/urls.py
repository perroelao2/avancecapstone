from django.urls import path
from app import views

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('cliente-panel/', views.panel_cliente, name='panel_cliente'),
    path('cabanas/', views.ver_cabanas, name='ver_cabanas'),
    path('reservar/<int:id_cabana>/', views.reservar_cabana, name='reservar_cabana'),
    path('reservas/', views.reservar_formulario, name='reservas'),
    path('contacto/', views.contacto_view, name='contacto'),
    path('guardar-mensaje/', views.guardar_mensaje, name='guardar_mensaje'),
    path('comentarios/', views.comentarios, name='comentarios'),
    path('crear-cuenta/', views.crear_cuenta, name='crear_cuenta'),
    path('pago-transferencia/', views.pago_transferencia, name='pago_transferencia'),
    path('pago/webpay/iniciar/', views.iniciar_pago_webpay, name='iniciar_pago_webpay'),
    path('pago/webpay/retorno/', views.retorno_pago_webpay, name='retorno_pago_webpay'),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / "static")
