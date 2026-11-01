import cx_Oracle

try:
    conn = cx_Oracle.connect("PROYECTO", "proyecto", "localhost:1521/XEPDB1")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM usuarios")
    for row in cursor:
        print(row)
    cursor.close()
    conn.close()
except cx_Oracle.DatabaseError as e:
    print("❌ Error al conectar:", e)
