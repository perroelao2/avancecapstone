from typing import Optional
from pydantic import BaseModel

class UsuarioCreate(BaseModel):
    nombre: str
    correo: str
    contrasena: str
    rol: str = "cliente"
    telefono: Optional[str] = None

class UsuarioLogin(BaseModel):
    correo: str
    contrasena: str

class CambiarPassword(BaseModel):
    correo: str
    contrasena_actual: str
    nueva_contrasena: str

class UsuarioOut(BaseModel):
    id_usuario: int
    nombre: str
    correo: str
    rol: str
    telefono: Optional[str] = None

    class Config:
        orm_mode = True
