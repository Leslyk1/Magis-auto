import pyodbc

def obtener_conexion():                                    #Definimos la funcion para poder conectarnos
    conexion = pyodbc.connect(                             # abre la conexion 
        "DRIVER={ODBC Driver 17 for SQL Server};"          # controlador para comunicarnos con sql
        "SERVER=localhost;"                                # nos dice que sql se esta ejecutanto en nuestra pc
        "DATABASE=Magis_Auto;"                             # indica a la base que nos queremos conectar 
        "Trusted_Connection=yes;"                          # indica que usamos la autenticacion de windows
    ) 

    return conexion