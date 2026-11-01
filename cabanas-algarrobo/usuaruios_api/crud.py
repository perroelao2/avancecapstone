from sqlalchemy.orm import Session
from models import Usuario
from schemas import UsuarioCreate
import bcrypt

def get_usuario_por_correo(db: Session, correo: str):
    return db.query(Usuario).filter(Usuario.correo == correo).first()

def crear_usuario(db: Session, user: UsuarioCreate):
    hashed = bcrypt.hashpw(user.contrasena.encode(), bcrypt.gensalt()).decode()
    nuevo = Usuario(
        nombre=user.nombre,
        correo=user.correo,
        contrasena=hashed,
        rol=user.rol
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

def verificar_contrasena(contrasena: str, hashed: str):
    try:
        return bcrypt.checkpw(contrasena.encode(), hashed.encode())
    except Exception:
        return contrasena == hashed

def cambiar_contrasena(db: Session, user_id: int, nueva_pass: str):
    hashed = bcrypt.hashpw(nueva_pass.encode(), bcrypt.gensalt()).decode()
    user = db.query(Usuario).filter(Usuario.id_usuario == user_id).first()
    if user:
        user.contrasena = hashed
        db.commit()
        return True
    return False
