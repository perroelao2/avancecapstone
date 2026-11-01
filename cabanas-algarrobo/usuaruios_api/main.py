from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
import crud, models, schemas
from database import engine, get_db

app = FastAPI()

# Crea tablas si no existen
models.Base.metadata.create_all(bind=engine)

@app.post("/usuarios/registro", response_model=schemas.UsuarioOut)
def registrar_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    if crud.get_usuario_por_correo(db, usuario.correo):
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    return crud.crear_usuario(db, usuario)

@app.post("/usuarios/login", response_model=schemas.UsuarioOut)
def login(usuario: schemas.UsuarioLogin, db: Session = Depends(get_db)):
    db_user = crud.get_usuario_por_correo(db, usuario.correo)
    if not db_user or not crud.verificar_contrasena(usuario.contrasena, db_user.contrasena):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return db_user

@app.put("/usuarios/{user_id}/cambiar-password")
def cambiar_password(user_id: int, datos: schemas.CambiarPassword, db: Session = Depends(get_db)):
    user = crud.get_usuario_por_correo(db, datos.correo)
    db_user = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
    if not db_user or not crud.verificar_contrasena(datos.contrasena_actual, db_user.contrasena):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    crud.cambiar_contrasena(db, user_id, datos.nueva_contrasena)
    return {"mensaje": "Contraseña actualizada correctamente"}
