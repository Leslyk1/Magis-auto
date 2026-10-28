from conexion import obtener_conexion


try:
    conexion = obtener_conexion()

    cursor = conexion.cursor()

    cursor.execute("SELECT DB_NAME()")

    resultado = cursor.fetchone()

    print("Conexion realizada correctamente.")
    print("Base de datos:", resultado[0])

    conexion.close()

except Exception as error:
    print("Ocurrio un error:")
    print(error)