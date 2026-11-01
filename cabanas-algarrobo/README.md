---

# 🏡 Proyecto Cabañas Algarrobo ☀️

¡Bienvenido al proyecto Cabañas Algarrobo! Esta plataforma integral está diseñada para simplificar la gestión y reserva de cabañas, ofreciendo una experiencia fluida tanto para administradores como para usuarios.

---

## 📝 Descripción del Proyecto

Cabañas Algarrobo es una solución completa que consta de una **aplicación web robusta desarrollada con Django** para la administración y visualización, y una **API potente construida con FastAPI** para la gestión de usuarios y otras funcionalidades clave.

Los usuarios pueden:
* **Registrarse** e **iniciar sesión** de forma segura.
* Explorar las **cabañas disponibles**.
* Realizar **reservas** de manera sencilla.
* Completar **pagos** de forma eficiente.

El panel administrativo proporciona herramientas completas para la gestión de:
* **Cabañas**
* **Reservas**
* **Pagos**
* **Usuarios**

---

## 🛠️ Tecnologías Utilizadas

Este proyecto ha sido construido con tecnologías modernas y eficientes:

* **Django 5.2**: Para el desarrollo de la aplicación web principal.
* **FastAPI**: Para la creación de la API RESTful.
* **MySQL**: Como sistema de gestión de bases de datos.
* **Bootstrap 5**: Para un diseño responsivo y atractivo en el frontend.
* **SQLAlchemy**: Como ORM para la interacción con la base de datos en la API.
* **Python 3.11**: El lenguaje de programación base para todo el proyecto.

---

## 🚀 Instalación del Proyecto

Sigue estos pasos para poner en marcha el proyecto en tu entorno local:

1.  **Clona el repositorio:**
    ```bash
    git clone [https://github.com/DanGamer23/cabanas-algarrobo.git]
    cd cabanas-algarrobo
    ```

2.  **(Opcional, pero muy recomendado) Crea y activa un entorno virtual:**
    ```bash
    python -m venv venv
    ```
    * **En Windows:**
        ```bash
        venv\Scripts\activate
        ```
    * **En Linux / macOS:**
        ```bash
        source venv/bin/activate
        ```

3.  **Instala las dependencias necesarias:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configura tu base de datos MySQL:**
    Asegúrate de haber creado una base de datos y un usuario dedicados para este proyecto en MySQL.

5.  **Configura las variables de entorno:**
    Crea un archivo `.env` (o similar) y define las variables de entorno requeridas para la conexión a la base de datos y otras configuraciones.

6.  **Ejecuta las migraciones de la base de datos:**
    ```bash
    python manage.py migrate
    ```

7.  **Ejecuta el servidor de Django:**
    ```bash
    python manage.py runserver
    ```

8.  **Ejecuta la API de FastAPI (en una terminal separada):**
    ```bash
    uvicorn main:app --reload --port 8001
    ```

---

## 💻 Uso de la Aplicación

Una vez que ambos servidores estén en funcionamiento:

* Accede a la **aplicación web** en tu navegador:
    [http://localhost:8000](http://localhost:8000)

* La **API de FastAPI** estará disponible para pruebas en:
    [http://localhost:8001/docs](http://localhost:8001/docs) (documentación interactiva de Swagger UI)

---