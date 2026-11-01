import bcrypt

password = input("Ingresa la contraseña: ")
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
print(f"\nHash generado:\n{hashed}")
