from flask import Flask, jsonify, request
from flask_cors import CORS
from conexion import obtener_conexion
import pyodbc
from werkzeug.exceptions import BadRequest
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_DOWN, ROUND_HALF_UP
import calendar
from uuid import UUID

app = Flask(__name__)

CORS(app)

#devuelve un mensaje de error en caso de que ocurra un error en la base de datos
@app.errorhandler(pyodbc.Error)
def manejar_error_sql(error):

    respuesta_plan = error_sql_plan(error)
    if respuesta_plan is not None:
        return respuesta_plan

    print("ERROR SQL:")
    print(error)

    return jsonify({
        "error": "Error en la base de datos"
    }), 500


@app.errorhandler(KeyError)
def manejar_campo_faltante(error):

    campo = str(error).replace("'", "")

    return jsonify({
        "error": "Falta un campo obligatorio",
        "campo": campo
    }), 400

@app.errorhandler(BadRequest)
def manejar_json_invalido(error):

    return jsonify({
        "error": "Solicitud invalida",
        "detalle": "El JSON enviado esta vacio o tiene un formato incorrecto"
    }), 400


@app.route("/")
def inicio():
    return jsonify({
        "mensaje": "API MAGIS-AUTO funcionando correctamente"
    })

# Inicio CRUD de persona 
#GET PERSONAS
@app.route("/personas", methods=["GET"])
def listar_personas():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Persona_Listar")

    columnas = [columna[0] for columna in cursor.description]

    personas = []

    for fila in cursor.fetchall():
        persona = dict(zip(columnas, fila))
        personas.append(persona)

    conexion.close()

    return jsonify(personas)


#POST PERSONAS
@app.route("/personas", methods=["POST"])
def insertar_persona():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Persona_Insertar
            @codigo_persona = ?,
            @primer_nombre = ?,
            @segundo_nombre = ?,
            @primer_apellido = ?,
            @segundo_apellido = ?,
            @correo_electronico = ?,
            @dpi = ?,
            @no_pasaporte = ?,
            @fecha_nacimiento = ?,
            @nit = ?,
            @genero = ?
        """,
        datos["codigo_persona"],
        datos["primer_nombre"],
        datos["segundo_nombre"],
        datos["primer_apellido"],
        datos["segundo_apellido"],
        datos["correo_electronico"],
        datos["dpi"],
        datos["no_pasaporte"],
        datos["fecha_nacimiento"],
        datos["nit"],
        datos["genero"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Persona registrada correctamente"
    }), 201

#PUT PERSONAS 
@app.route("/personas/<int:codigo_persona>", methods=["PUT"])
def actualizar_persona(codigo_persona):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Persona_Actualizar
            @codigo_persona = ?,
            @primer_nombre = ?,
            @segundo_nombre = ?,
            @primer_apellido = ?,
            @segundo_apellido = ?,
            @correo_electronico = ?,
            @dpi = ?,
            @no_pasaporte = ?,
            @fecha_nacimiento = ?,
            @nit = ?,
            @genero = ?
        """,
        codigo_persona,
        datos["primer_nombre"],
        datos["segundo_nombre"],
        datos["primer_apellido"],
        datos["segundo_apellido"],
        datos["correo_electronico"],
        datos["dpi"],
        datos["no_pasaporte"],
        datos["fecha_nacimiento"],
        datos["nit"],
        datos["genero"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Persona actualizada correctamente"
    })

def entero_cliente(valor, campo, minimo=1):
    if isinstance(valor, bool) or not isinstance(valor, (int, str)):
        raise ValueError(f"{campo}: debe ser un número entero")
    try:
        numero = int(valor)
    except ValueError:
        raise ValueError(f"{campo}: debe ser un número entero")
    if numero < minimo or numero > 2147483647:
        raise ValueError(f"{campo}: está fuera del rango permitido")
    return numero


def validar_cliente_completo(datos, codigo_persona=None):
    if not isinstance(datos, dict):
        raise ValueError("Debe enviar un objeto JSON válido")
    codigo = entero_cliente(datos.get("codigo_persona") if codigo_persona is None else codigo_persona, "Código de persona")
    if codigo_persona is not None and "codigo_persona" in datos and entero_cliente(datos["codigo_persona"], "Código de persona") != codigo:
        raise ValueError("El código de persona no coincide con el cliente que se está editando")
    campos = ("primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "correo_electronico",
              "dpi", "no_pasaporte", "fecha_nacimiento", "nit", "genero")
    persona = {"codigo_persona": codigo}
    for campo in campos:
        valor = datos.get(campo, "")
        if valor is not None and not isinstance(valor, str):
            raise ValueError(f"{campo}: debe ser texto")
        persona[campo] = (valor or "").strip()
    if not persona["primer_nombre"] or not persona["primer_apellido"]:
        raise ValueError("El primer nombre y el primer apellido son obligatorios")
    if persona["fecha_nacimiento"]:
        try:
            datetime.strptime(persona["fecha_nacimiento"], "%Y-%m-%d")
        except ValueError:
            raise ValueError("La fecha de nacimiento debe tener el formato AAAA-MM-DD y ser válida")
    else:
        persona["fecha_nacimiento"] = None
    if persona["genero"] not in ("", "H", "M"):
        raise ValueError("El género debe ser H o M")
    contactos = {}
    for tipo in ("telefonos", "direcciones"):
        if codigo_persona is not None and tipo not in datos:
            raise ValueError(f"Envía la lista completa de {tipo}, incluso si está vacía")
        lista = datos.get(tipo, [])
        if not isinstance(lista, list) or any(not isinstance(item, dict) for item in lista):
            raise ValueError(f"{tipo}: debe ser una lista de objetos")
        contactos[tipo] = []
        usados = set()
        for indice, item in enumerate(lista, 1):
            prefijo = f"{tipo}, registro {indice}"
            registro = {}
            if item.get("correlativo") is not None:
                registro["correlativo"] = entero_cliente(item["correlativo"], f"{prefijo}: correlativo")
                if registro["correlativo"] in usados:
                    raise ValueError(f"{prefijo}: correlativo repetido")
                usados.add(registro["correlativo"])
            if tipo == "telefonos":
                if not isinstance(item.get("numero"), str) or not item["numero"].strip():
                    raise ValueError(f"{prefijo}: el número de teléfono es obligatorio")
                registro["numero"] = item["numero"].strip()
                registro["codigo_tipo_telefono"] = entero_cliente(item.get("codigo_tipo_telefono"), f"{prefijo}: tipo")
            else:
                for campo in ("calle", "avenida"):
                    if not isinstance(item.get(campo), str) or not item[campo].strip():
                        raise ValueError(f"{prefijo}: {campo} es obligatorio")
                    registro[campo] = item[campo].strip()
                for campo in ("zona", "codigo_departamento", "codigo_municipio", "codigo_tipo_direccion"):
                    registro[campo] = entero_cliente(item.get(campo), f"{prefijo}: {campo}", 0 if campo == "zona" else 1)
            contactos[tipo].append(registro)
    return persona, contactos


@app.route("/personas/<int:codigo_persona>/completo", methods=["GET"])
def consultar_cliente_completo(codigo_persona):
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")
        cursor.execute("SELECT * FROM dbo.Persona WHERE codigo_persona = ?", codigo_persona)
        fila = cursor.fetchone()
        if fila is None:
            return jsonify({"error": "El cliente no existe"}), 404
        resultado = {"persona": dict(zip([columna[0] for columna in cursor.description], fila))}
        for clave, tabla in (("telefonos", "Telefono"), ("direcciones", "Direccion")):
            cursor.execute(f"SELECT * FROM dbo.{tabla} WHERE codigo_persona = ? ORDER BY correlativo", codigo_persona)
            columnas = [columna[0] for columna in cursor.description]
            resultado[clave] = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
        return jsonify(resultado)
    finally:
        conexion.close()


@app.route("/personas/completo", methods=["POST"])
@app.route("/personas/<int:codigo_persona>/completo", methods=["PUT"])
def guardar_cliente_completo(codigo_persona=None):
    try:
        persona, contactos = validar_cliente_completo(request.get_json(silent=True), codigo_persona)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    editando = codigo_persona is not None
    codigo = persona["codigo_persona"]
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")
        cursor.execute("SELECT codigo_persona FROM dbo.Persona WITH (UPDLOCK, HOLDLOCK) WHERE codigo_persona = ?", codigo)
        existe = cursor.fetchone() is not None
        if editando and not existe:
            conexion.rollback()
            return jsonify({"error": "El cliente no existe"}), 404
        if not editando and existe:
            conexion.rollback()
            return jsonify({"error": "El código de persona ya está registrado"}), 409
        campos = tuple(campo for campo in persona if campo != "codigo_persona")
        if editando:
            cursor.execute(f"UPDATE dbo.Persona SET {', '.join(campo + ' = ?' for campo in campos)} WHERE codigo_persona = ?",
                           *[persona[campo] for campo in campos], codigo)
        else:
            cursor.execute(f"INSERT INTO dbo.Persona (codigo_persona, {', '.join(campos)}) VALUES ({', '.join('?' for _ in persona)})",
                           codigo, *[persona[campo] for campo in campos])
        ids = {}
        for clave, tabla in (("telefonos", "Telefono"), ("direcciones", "Direccion")):
            cursor.execute(f"SELECT correlativo FROM dbo.{tabla} WITH (UPDLOCK, HOLDLOCK) WHERE codigo_persona = ?", codigo)
            existentes = {fila[0] for fila in cursor.fetchall()}
            recibidos = set()
            for registro in contactos[clave]:
                correlativo = registro.get("correlativo")
                if correlativo is None:
                    # La API asigna el identificador; los bloqueos evitan duplicarlo entre sesiones.
                    cursor.execute(f"SELECT COALESCE(MAX(correlativo), 0) + 1 FROM dbo.{tabla} WITH (UPDLOCK, HOLDLOCK)")
                    correlativo = cursor.fetchone()[0]
                elif correlativo not in existentes:
                    cursor.execute(f"SELECT codigo_persona FROM dbo.{tabla} WITH (UPDLOCK, HOLDLOCK) WHERE correlativo = ?", correlativo)
                    if cursor.fetchone() is not None:
                        raise ValueError(f"El registro de {clave} pertenece a otro cliente")
                if correlativo in recibidos:
                    raise ValueError(f"Hay identificadores repetidos en {clave}")
                if clave == "direcciones":
                    cursor.execute("SELECT codigo_departamento FROM dbo.Municipio WHERE codigo_municipio = ?", registro["codigo_municipio"])
                    municipio = cursor.fetchone()
                    if municipio is None or municipio[0] != registro["codigo_departamento"]:
                        raise ValueError("El municipio no pertenece al departamento seleccionado")
                columnas = tuple(campo for campo in registro if campo != "correlativo")
                valores = [registro[campo] for campo in columnas]
                if correlativo in existentes:
                    cursor.execute(f"UPDATE dbo.{tabla} SET {', '.join(campo + ' = ?' for campo in columnas)} WHERE correlativo = ? AND codigo_persona = ?",
                                   *valores, correlativo, codigo)
                else:
                    cursor.execute(f"INSERT INTO dbo.{tabla} (correlativo, codigo_persona, {', '.join(columnas)}) VALUES ({', '.join('?' for _ in range(len(columnas) + 2))})",
                                   correlativo, codigo, *valores)
                recibidos.add(correlativo)
            # En edición, las listas representan los contactos que el usuario quiere conservar.
            for eliminado in existentes - recibidos:
                cursor.execute(f"DELETE FROM dbo.{tabla} WHERE correlativo = ? AND codigo_persona = ?", eliminado, codigo)
            ids[clave] = sorted(recibidos)
        conexion.commit()
        return jsonify({"mensaje": "Cliente y contactos guardados correctamente", "codigo_persona": codigo, **ids}), 200 if editando else 201
    except ValueError as error:
        conexion.rollback()
        return jsonify({"error": str(error)}), 400
    except pyodbc.Error as error:
        conexion.rollback()
        texto = str(error)
        if "2627" in texto or "2601" in texto:
            return jsonify({"error": "Uno de los códigos o datos únicos ya está registrado. No se guardó ningún cambio."}), 409
        if "547" in texto:
            return jsonify({"error": "Hay un tipo, departamento o municipio inválido. No se guardó ningún cambio."}), 400
        raise
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()


@app.route("/personas/<int:codigo_persona>/resumen-eliminacion", methods=["GET"])
def resumen_eliminacion_persona(codigo_persona):
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")
        cursor.execute("SELECT codigo_persona FROM dbo.Persona WHERE codigo_persona = ?", codigo_persona)
        if cursor.fetchone() is None:
            return jsonify({"error": "El cliente no existe"}), 404
        # Solo lectura. Las condiciones coinciden con la eliminación completa.
        cursor.execute("""
            WITH CreditosPropios AS (
                SELECT c.codigo_credito, c.codigo_garantia
                FROM dbo.Credito c JOIN dbo.Deudor d ON d.codigo_deudor = c.codigo_deudor
                WHERE d.codigo_persona = ?
            ), CuotasPropias AS (
                SELECT q.codigo_cuota FROM dbo.Cuota q
                JOIN CreditosPropios c ON c.codigo_credito = q.codigo_credito
            ), GarantiasCandidatas AS (
                SELECT DISTINCT g.codigo_garantia, g.codigo_vehiculo FROM dbo.Garantia g
                JOIN CreditosPropios c ON c.codigo_garantia = g.codigo_garantia
            ), GarantiasEliminables AS (
                SELECT g.* FROM GarantiasCandidatas g WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.Credito c WHERE c.codigo_garantia = g.codigo_garantia
                    AND NOT EXISTS (SELECT 1 FROM CreditosPropios p WHERE p.codigo_credito = c.codigo_credito)
                )
            ), VehiculosCandidatos AS (
                SELECT DISTINCT v.codigo_vehiculo FROM dbo.Vehiculo v
                JOIN GarantiasCandidatas g ON g.codigo_vehiculo = v.codigo_vehiculo
            ), VehiculosEliminables AS (
                SELECT v.* FROM VehiculosCandidatos v WHERE NOT EXISTS (
                    SELECT 1 FROM dbo.Garantia g WHERE g.codigo_vehiculo = v.codigo_vehiculo
                    AND NOT EXISTS (SELECT 1 FROM GarantiasEliminables e WHERE e.codigo_garantia = g.codigo_garantia)
                )
            ), PersonaObjetivo AS (SELECT CAST(? AS INT) AS codigo_persona)
            SELECT
                1,
                (SELECT COUNT(*) FROM dbo.Telefono WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM dbo.Direccion WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM dbo.Deudor WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM dbo.Vendedor WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM dbo.Referencia WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM dbo.Fiador WHERE codigo_persona = p.codigo_persona),
                (SELECT COUNT(*) FROM CreditosPropios),
                (SELECT COUNT(*) FROM CuotasPropias),
                (SELECT COUNT(*) FROM dbo.TransaccionPago t WHERE
                    EXISTS (SELECT 1 FROM CreditosPropios c WHERE c.codigo_credito = t.codigo_credito)
                    OR EXISTS (SELECT 1 FROM CuotasPropias q WHERE q.codigo_cuota = t.codigo_cuota)),
                (SELECT COUNT(*) FROM dbo.CreditoFiador f WHERE EXISTS
                    (SELECT 1 FROM CreditosPropios c WHERE c.codigo_credito = f.codigo_credito)),
                (SELECT COUNT(*) FROM dbo.ReferenciaCredito r WHERE EXISTS
                    (SELECT 1 FROM CreditosPropios c WHERE c.codigo_credito = r.codigo_credito)),
                (SELECT COUNT(*) FROM GarantiasEliminables),
                (SELECT COUNT(*) FROM VehiculosEliminables),
                (SELECT COUNT(*) FROM GarantiasCandidatas) - (SELECT COUNT(*) FROM GarantiasEliminables),
                (SELECT COUNT(*) FROM VehiculosCandidatos) - (SELECT COUNT(*) FROM VehiculosEliminables),
                (SELECT COUNT(DISTINCT c.codigo_credito) FROM dbo.Credito c
                    JOIN dbo.Vendedor v ON v.codigo_vendedor = c.codigo_vendedor
                    WHERE v.codigo_persona = p.codigo_persona AND NOT EXISTS
                    (SELECT 1 FROM CreditosPropios propios WHERE propios.codigo_credito = c.codigo_credito)),
                (SELECT COUNT(DISTINCT cf.codigo_credito) FROM dbo.CreditoFiador cf
                    JOIN dbo.Fiador f ON f.codigo_fiador = cf.codigo_fiador
                    WHERE f.codigo_persona = p.codigo_persona AND NOT EXISTS
                    (SELECT 1 FROM CreditosPropios propios WHERE propios.codigo_credito = cf.codigo_credito)),
                (SELECT COUNT(DISTINCT rc.codigo_credito) FROM dbo.ReferenciaCredito rc
                    JOIN dbo.Referencia r ON r.codigo_referencia = rc.codigo_referencia
                    WHERE r.codigo_persona = p.codigo_persona AND NOT EXISTS
                    (SELECT 1 FROM CreditosPropios propios WHERE propios.codigo_credito = rc.codigo_credito)),
                (SELECT COUNT(*) FROM dbo.TransaccionPago t JOIN CuotasPropias q ON q.codigo_cuota = t.codigo_cuota
                    WHERE NOT EXISTS (SELECT 1 FROM CreditosPropios propios WHERE propios.codigo_credito = t.codigo_credito))
            FROM PersonaObjetivo p
        """, codigo_persona, codigo_persona)
        fila = cursor.fetchone()
        nombres = ("clientes", "telefonos", "direcciones", "deudores", "vendedores", "referencias", "fiadores",
                   "creditos", "cuotas", "pagos", "vinculos_fiadores", "vinculos_referencias", "garantias", "vehiculos")
        conteos = dict(zip(nombres, fila[:14]))
        conservados = dict(zip(("garantias", "vehiculos"), fila[14:16]))
        bloqueos = {nombre: cantidad for nombre, cantidad in zip(
            ("creditos_como_vendedor", "creditos_como_fiador", "creditos_como_referencia", "pagos_de_otros_creditos"),
            fila[16:20]) if cantidad > 0}
        return jsonify({
            "codigo_persona": codigo_persona,
            "puede_eliminar": not bool(bloqueos),
            "conteos": conteos,
            "conservados": conservados,
            "bloqueos": bloqueos,
            "mensaje": "No se ha eliminado ningún registro. Al confirmar se volverán a comprobar las relaciones."
        })
    finally:
        conexion.close()


#DELETE PERSONAS
@app.route("/personas/<int:codigo_persona>", methods=["DELETE"])
def eliminar_persona(codigo_persona):

    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        # Mantener estable el conjunto de relaciones hasta confirmar o revertir todo.
        cursor.execute("SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")
        cursor.execute("SELECT codigo_persona FROM dbo.Persona WITH (UPDLOCK, HOLDLOCK) WHERE codigo_persona = ?", codigo_persona)
        if cursor.fetchone() is None:
            conexion.rollback()
            return jsonify({"error": "El cliente no existe"}), 404

        # Estas tablas temporales pertenecen únicamente a esta conexión.
        # Crearlas sin parámetros evita que ODBC limite su alcance a la consulta preparada.
        cursor.execute("""
            CREATE TABLE #MagisCreditosCliente (codigo_credito INT PRIMARY KEY, codigo_garantia INT NULL);
            CREATE TABLE #MagisCuotasCliente (codigo_cuota INT PRIMARY KEY);
            CREATE TABLE #MagisGarantiasCliente (codigo_garantia INT PRIMARY KEY, codigo_vehiculo INT NULL);
        """)
        while cursor.nextset():
            pass
        cursor.execute(
            """
            INSERT INTO #MagisCreditosCliente (codigo_credito, codigo_garantia)
            SELECT c.codigo_credito, c.codigo_garantia
            FROM dbo.Credito c
            INNER JOIN dbo.Deudor d ON d.codigo_deudor = c.codigo_deudor
            WHERE d.codigo_persona = ?;

            INSERT INTO #MagisCuotasCliente (codigo_cuota)
            SELECT q.codigo_cuota
            FROM dbo.Cuota q
            INNER JOIN #MagisCreditosCliente c ON c.codigo_credito = q.codigo_credito;

            INSERT INTO #MagisGarantiasCliente (codigo_garantia, codigo_vehiculo)
            SELECT DISTINCT g.codigo_garantia, g.codigo_vehiculo
            FROM dbo.Garantia g
            INNER JOIN #MagisCreditosCliente c ON c.codigo_garantia = g.codigo_garantia;
            """,
            codigo_persona
        )
        while cursor.nextset():
            pass
        cursor.execute(
            """
            SELECT
                (SELECT COUNT(DISTINCT c.codigo_credito)
                 FROM dbo.Credito c INNER JOIN dbo.Vendedor v ON v.codigo_vendedor = c.codigo_vendedor
                 WHERE v.codigo_persona = ? AND NOT EXISTS
                    (SELECT 1 FROM #MagisCreditosCliente propios WHERE propios.codigo_credito = c.codigo_credito)),
                (SELECT COUNT(DISTINCT cf.codigo_credito)
                 FROM dbo.CreditoFiador cf INNER JOIN dbo.Fiador f ON f.codigo_fiador = cf.codigo_fiador
                 WHERE f.codigo_persona = ? AND NOT EXISTS
                    (SELECT 1 FROM #MagisCreditosCliente propios WHERE propios.codigo_credito = cf.codigo_credito)),
                (SELECT COUNT(DISTINCT rc.codigo_credito)
                 FROM dbo.ReferenciaCredito rc INNER JOIN dbo.Referencia r ON r.codigo_referencia = rc.codigo_referencia
                 WHERE r.codigo_persona = ? AND NOT EXISTS
                    (SELECT 1 FROM #MagisCreditosCliente propios WHERE propios.codigo_credito = rc.codigo_credito)),
                (SELECT COUNT(*) FROM dbo.TransaccionPago p
                 INNER JOIN #MagisCuotasCliente q ON q.codigo_cuota = p.codigo_cuota
                 WHERE NOT EXISTS
                    (SELECT 1 FROM #MagisCreditosCliente propios WHERE propios.codigo_credito = p.codigo_credito))
            """,
            codigo_persona, codigo_persona, codigo_persona
        )
        nombres = ("creditos_como_vendedor", "creditos_como_fiador", "creditos_como_referencia", "pagos_de_otros_creditos")
        relaciones = {nombre: cantidad for nombre, cantidad in zip(nombres, cursor.fetchone()) if cantidad > 0}
        if relaciones:
            conexion.rollback()
            etiquetas = {
                "creditos_como_vendedor": "créditos de otros clientes como vendedor",
                "creditos_como_fiador": "créditos de otros clientes como fiador",
                "creditos_como_referencia": "créditos de otros clientes como referencia",
                "pagos_de_otros_creditos": "pagos de otros créditos vinculados a sus cuotas"
            }
            detalle = ", ".join(f"{etiquetas[nombre]} ({cantidad})" for nombre, cantidad in relaciones.items())
            return jsonify({
                "error": f"No se puede eliminar el cliente {codigo_persona}: participa en operaciones de otras personas: {detalle}. Revisa esas relaciones antes de eliminarlo.",
                "relaciones": relaciones
            }), 409

        # Borrar primero los dependientes y confirmar una sola vez al final.
        cursor.execute("""
            DELETE p FROM dbo.TransaccionPago p
            WHERE EXISTS (SELECT 1 FROM #MagisCreditosCliente c WHERE c.codigo_credito = p.codigo_credito)
               OR EXISTS (SELECT 1 FROM #MagisCuotasCliente q WHERE q.codigo_cuota = p.codigo_cuota);

            DELETE cf FROM dbo.CreditoFiador cf
            WHERE EXISTS (SELECT 1 FROM #MagisCreditosCliente c WHERE c.codigo_credito = cf.codigo_credito);

            DELETE rc FROM dbo.ReferenciaCredito rc
            WHERE EXISTS (SELECT 1 FROM #MagisCreditosCliente c WHERE c.codigo_credito = rc.codigo_credito);

            DELETE q FROM dbo.Cuota q
            WHERE EXISTS (SELECT 1 FROM #MagisCuotasCliente propias WHERE propias.codigo_cuota = q.codigo_cuota);

            DELETE c FROM dbo.Credito c
            WHERE EXISTS (SELECT 1 FROM #MagisCreditosCliente propios WHERE propios.codigo_credito = c.codigo_credito);

            DELETE g FROM dbo.Garantia g
            WHERE EXISTS (SELECT 1 FROM #MagisGarantiasCliente propias WHERE propias.codigo_garantia = g.codigo_garantia)
              AND NOT EXISTS (SELECT 1 FROM dbo.Credito c WHERE c.codigo_garantia = g.codigo_garantia);

            DELETE v FROM dbo.Vehiculo v
            WHERE EXISTS (SELECT 1 FROM #MagisGarantiasCliente propias WHERE propias.codigo_vehiculo = v.codigo_vehiculo)
              AND NOT EXISTS (SELECT 1 FROM dbo.Garantia g WHERE g.codigo_vehiculo = v.codigo_vehiculo);
        """)
        while cursor.nextset():
            pass
        for tabla in ("Telefono", "Direccion", "Referencia", "Fiador", "Vendedor", "Deudor"):
            # Los nombres son constantes internas; el código del cliente sigue parametrizado.
            cursor.execute(f"DELETE FROM dbo.{tabla} WHERE codigo_persona = ?", codigo_persona)
        cursor.execute("DELETE FROM dbo.Persona WHERE codigo_persona = ?", codigo_persona)
        conexion.commit()
        return jsonify({"mensaje": "Cliente y sus datos asociados eliminados correctamente. Se conservaron los datos compartidos con otras operaciones."})
    except pyodbc.Error as error:
        conexion.rollback()
        if any("547" in str(argumento) for argumento in error.args):
            return jsonify({
                "error": "No se pudo completar la eliminación porque hay otras relaciones que deben revisarse. Se revirtió toda la operación; no se eliminó ningún registro."
            }), 409
        raise
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()

#Fin CRUD de persona



#Inicio CRUD Creditos
#GET CREDITOS
@app.route("/creditos", methods=["GET"])
def listar_creditos():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Credito_Listar")

    columnas = [columna[0] for columna in cursor.description]

    creditos = []

    for fila in cursor.fetchall():
        credito = dict(zip(columnas, fila))
        creditos.append(credito)

    conexion.close()

    return jsonify(creditos)


# POST CREDITOS
def error_sql_plan(error):
    texto = str(error)
    for numero, estado in (("51001", 400), ("51004", 404), ("51009", 409)):
        if numero in texto:
            return jsonify({"error": texto.split("]")[-1].split("(")[0].strip() or "Revisa los datos del plan de cuotas"}), estado
    if "2812" in texto and ("PlanCuotas" in texto or "InsertarConPlan" in texto):
        return jsonify({"error": "Falta instalar plan_pagos.sql en Magis_Auto. No se guardó el crédito."}), 503
    return None


def importe_plan(valor, etiqueta, minimo=Decimal("0"), maximo=Decimal("99999999.99")):
    if valor is None or isinstance(valor, bool) or str(valor).strip() == "":
        raise ValueError(f"{etiqueta}: indica un importe válido")
    try:
        numero = Decimal(str(valor))
        if not numero.is_finite() or numero < minimo or numero > maximo:
            raise ValueError(f"{etiqueta}: importe fuera del rango permitido")
        if numero != numero.quantize(Decimal("0.01")):
            raise ValueError(f"{etiqueta}: usa como máximo dos decimales")
        return numero.quantize(Decimal("0.01"))
    except InvalidOperation:
        raise ValueError(f"{etiqueta}: indica un importe válido")


def validar_cambio_plan(conexion, cursor, sql, *parametros):
    try:
        cursor.execute(sql, *parametros)
        while cursor.nextset():
            pass
    except Exception:
        conexion.rollback()
        conexion.close()
        raise


def validar_credito_con_plan(datos):
    if not isinstance(datos, dict):
        raise ValueError("Debe enviar un objeto JSON válido")
    credito = {}
    for campo in ("codigo_credito", "codigo_garantia", "codigo_vendedor", "codigo_deudor", "plazo"):
        credito[campo] = entero_cliente(datos.get(campo), campo)
    if credito["plazo"] > 1200:
        raise ValueError("El plazo debe estar entre 1 y 1200 meses")
    numero = datos.get("numero_credito")
    if not isinstance(numero, str) or not numero.strip() or len(numero.strip()) > 30:
        raise ValueError("El número de crédito es obligatorio y admite hasta 30 caracteres")
    credito["numero_credito"] = numero.strip()
    if datos.get("estado") != "Activo":
        raise ValueError("Un crédito nuevo se aprueba como Activo para generar su plan")
    credito["estado"] = "Activo"
    try:
        fecha = datetime.strptime(datos.get("fecha_credito", ""), "%Y-%m-%d").date()
        if fecha.year < 1753:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValueError("Indica una fecha de crédito válida desde el año 1753")
    credito["fecha_credito"] = fecha
    credito["monto"] = importe_plan(datos.get("monto"), "Monto", Decimal("0.01"))
    credito["tasa_intereses"] = importe_plan(datos.get("tasa_intereses"), "Tasa anual", maximo=Decimal("999.99"))
    credito["porcentaje_comision"] = importe_plan(datos.get("porcentaje_comision"), "Comisión", maximo=Decimal("100"))
    credito["seguro_vehiculo"] = importe_plan(datos.get("seguro_vehiculo"), "Seguro mensual del vehículo", Decimal("0.01"))
    credito["seguro_vida"] = importe_plan(datos.get("seguro_vida"), "Seguro mensual de vida")
    return credito


def calcular_plan_credito(credito):
    """Calculamos todas las cuotas; no insertamos registros durante la vista previa."""
    monto, plazo, fecha = credito["monto"], credito["plazo"], credito["fecha_credito"]
    capital_base = (monto / plazo).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    if capital_base <= 0:
        raise ValueError("El monto es demasiado pequeño para el plazo seleccionado")
    cuotas, saldo = [], monto
    for numero in range(1, plazo + 1):
        mes = fecha.month - 1 + numero
        anio, mes = fecha.year + mes // 12, mes % 12 + 1
        if anio > 9999:
            raise ValueError("El último vencimiento supera el rango de fechas permitido")
        vencimiento = fecha.replace(year=anio, month=mes, day=min(fecha.day, calendar.monthrange(anio, mes)[1]))
        capital = saldo if numero == plazo else capital_base
        interes = (saldo * credito["tasa_intereses"] / Decimal("1200")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total = capital + interes + Decimal("25") + credito["seguro_vehiculo"] + credito["seguro_vida"]
        if total > Decimal("99999999.99"):
            raise ValueError("El total de una cuota supera el límite permitido")
        saldo -= capital
        cuotas.append({"numero_cuota": numero, "fecha_plan": fecha.isoformat(), "fecha_vencimiento": vencimiento.isoformat(),
            "capital": capital, "intereses": interes, "manejo_cuenta": Decimal("25.00"),
            "seguro_vehiculo": credito["seguro_vehiculo"], "seguro_vida": credito["seguro_vida"],
            "valor_total_cuota": total, "saldo_capital": saldo})
    return {"cuotas": cuotas, "resumen": {"cantidad_cuotas": plazo, "capital": monto,
        "total_intereses": sum(c["intereses"] for c in cuotas),
        "total_recaudable": sum(c["valor_total_cuota"] for c in cuotas), "manejo_mensual": Decimal("25.00")}}


def leer_plan_credito(cursor, codigo_credito):
    cursor.execute("EXEC dbo.sp_PlanCuotas_Consultar @codigo_credito = ?", codigo_credito)
    columnas = [columna[0] for columna in cursor.description]
    fila = cursor.fetchone()
    if fila is None:
        return None
    credito = dict(zip(columnas, fila))
    cursor.nextset()
    columnas = [columna[0] for columna in cursor.description]
    cuotas = [dict(zip(columnas, fila)) for fila in cursor.fetchall()]
    while cursor.nextset():
        pass
    return {"credito": credito, "cuotas": cuotas,
        "completo": len(cuotas) == credito["plazo"] and sorted(c["numero_cuota"] for c in cuotas) == list(range(1, credito["plazo"] + 1))}


@app.route("/creditos/plan/preview", methods=["POST"])
def previsualizar_plan_credito():
    try:
        return jsonify(calcular_plan_credito(validar_credito_con_plan(request.get_json(silent=True))))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@app.route("/creditos/<int:codigo_credito>/plan", methods=["GET"])
def consultar_plan_credito(codigo_credito):
    conexion = obtener_conexion()
    try:
        plan = leer_plan_credito(conexion.cursor(), codigo_credito)
        return (jsonify(plan), 200) if plan else (jsonify({"error": "El crédito no existe"}), 404)
    finally:
        conexion.close()


@app.route("/creditos/<int:codigo_credito>/plan", methods=["POST"])
def generar_plan_credito_existente(codigo_credito):
    datos = request.get_json(silent=True)
    try:
        if not isinstance(datos, dict):
            raise ValueError("Indica los dos seguros mensuales")
        vehiculo = importe_plan(datos.get("seguro_vehiculo"), "Seguro vehicular", Decimal("0.01"))
        vida = importe_plan(datos.get("seguro_vida"), "Seguro de vida")
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("EXEC dbo.sp_PlanCuotas_Generar @codigo_credito=?, @seguro_vehiculo=?, @seguro_vida=?", codigo_credito, vehiculo, vida)
        while cursor.nextset():
            pass
        plan = leer_plan_credito(cursor, codigo_credito)
        conexion.commit()
        return jsonify({"mensaje": "Plan de cuotas generado correctamente", **plan}), 201
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()


@app.route("/creditos", methods=["POST"])
def insertar_credito():
    try:
        datos = validar_credito_con_plan(request.get_json(silent=True))
        calcular_plan_credito(datos)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("""EXEC dbo.sp_Credito_InsertarConPlan
            @codigo_credito=?, @numero_credito=?, @fecha_credito=?, @estado=?, @monto=?, @plazo=?,
            @tasa_intereses=?, @porcentaje_comision=?, @codigo_garantia=?, @codigo_vendedor=?, @codigo_deudor=?,
            @seguro_vehiculo=?, @seguro_vida=?""",
            *[datos[campo] for campo in ("codigo_credito", "numero_credito", "fecha_credito", "estado", "monto", "plazo",
                "tasa_intereses", "porcentaje_comision", "codigo_garantia", "codigo_vendedor", "codigo_deudor", "seguro_vehiculo", "seguro_vida")])
        while cursor.nextset():
            pass
        plan = leer_plan_credito(cursor, datos["codigo_credito"])
        conexion.commit()
        return jsonify({"mensaje": "Crédito y plan completo guardados correctamente", **plan}), 201
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()


#PUT CREDITOS
@app.route("/creditos/<int:codigo_credito>", methods=["PUT"])
def actualizar_credito(codigo_credito):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()
    validar_cambio_plan(conexion, cursor,
        "EXEC dbo.sp_PlanCuotas_ValidarCambioCredito @codigo_credito=?, @monto=?, @plazo=?, @tasa=?, @fecha=?",
        codigo_credito, datos["monto"], datos["plazo"], datos["tasa_intereses"], datos["fecha_credito"])


    cursor.execute(
        """
        EXEC sp_Credito_Actualizar
            @codigo_credito = ?,
            @numero_credito = ?,
            @fecha_credito = ?,
            @estado = ?,
            @monto = ?,
            @plazo = ?,
            @tasa_intereses = ?,
            @porcentaje_comision = ?,
            @codigo_garantia = ?,
            @codigo_vendedor = ?,
            @codigo_deudor = ?
        """,
        codigo_credito,
        datos["numero_credito"],
        datos["fecha_credito"],
        datos["estado"],
        datos["monto"],
        datos["plazo"],
        datos["tasa_intereses"],
        datos["porcentaje_comision"],
        datos["codigo_garantia"],
        datos["codigo_vendedor"],
        datos["codigo_deudor"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Credito actualizado correctamente"
    })


#DELETE CREDITOS
@app.route("/creditos/<int:codigo_credito>", methods=["DELETE"])
def eliminar_credito(codigo_credito):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Credito_Eliminar
            @codigo_credito = ?
        """,
        codigo_credito
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Credito eliminado correctamente"
    })

#Fin CRUD de Creditos

#Inicio CRUD de Garantias
#GET GARANTIAS
@app.route("/garantias", methods=["GET"])
def listar_garantias():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Garantia_Listar")

    columnas = [columna[0] for columna in cursor.description]

    garantias = []

    for fila in cursor.fetchall():
        garantia = dict(zip(columnas, fila))
        garantias.append(garantia)

    conexion.close()

    return jsonify(garantias)


#POST GARANTIAS
@app.route("/garantias", methods=["POST"])
def insertar_garantia():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Garantia_Insertar
            @codigo_garantia = ?,
            @valor_comercial = ?,
            @descripcion = ?,
            @codigo_tipo_garantia = ?,
            @codigo_vehiculo = ?
        """,
        datos["codigo_garantia"],
        datos["valor_comercial"],
        datos["descripcion"],
        datos["codigo_tipo_garantia"],
        datos["codigo_vehiculo"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Garantia registrada correctamente"
    }), 201


#PUT GARANTIAS
@app.route("/garantias/<int:codigo_garantia>", methods=["PUT"])
def actualizar_garantia(codigo_garantia):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Garantia_Actualizar
            @codigo_garantia = ?,
            @valor_comercial = ?,
            @descripcion = ?,
            @codigo_tipo_garantia = ?,
            @codigo_vehiculo = ?
        """,
        codigo_garantia,
        datos["valor_comercial"],
        datos["descripcion"],
        datos["codigo_tipo_garantia"],
        datos["codigo_vehiculo"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Garantia actualizada correctamente"
    })

#DELETE GARANTIAS
@app.route("/garantias/<int:codigo_garantia>", methods=["DELETE"])
def eliminar_garantia(codigo_garantia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Garantia_Eliminar
            @codigo_garantia = ?
        """,
        codigo_garantia
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Garantia eliminada correctamente"
    })

#Fin CRUD de Garantias


#Inicio CRUD  de Vehiculos
#GET VEHICULOS
@app.route("/vehiculos", methods=["GET"])
def listar_vehiculos():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Vehiculo_Listar")

    columnas = [columna[0] for columna in cursor.description]

    vehiculos = []

    for fila in cursor.fetchall():
        vehiculo = dict(zip(columnas, fila))
        vehiculos.append(vehiculo)

    conexion.close()

    return jsonify(vehiculos)

#POST VEHICULOS
@app.route("/vehiculos", methods=["POST"])
def insertar_vehiculo():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vehiculo_Insertar
            @codigo_vehiculo = ?,
            @VIN = ?,
            @chasis = ?,
            @placa = ?,
            @serie = ?,
            @anio_fabricacion = ?,
            @codigo_marca = ?,
            @codigo_linea = ?
        """,
        datos["codigo_vehiculo"],
        datos["VIN"],
        datos["chasis"],
        datos["placa"],
        datos["serie"],
        datos["anio_fabricacion"],
        datos["codigo_marca"],
        datos["codigo_linea"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vehiculo registrado correctamente"
    }), 201


#PUT VEHICULOS
@app.route("/vehiculos/<int:codigo_vehiculo>", methods=["PUT"])
def actualizar_vehiculo(codigo_vehiculo):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vehiculo_Actualizar
            @codigo_vehiculo = ?,
            @VIN = ?,
            @chasis = ?,
            @placa = ?,
            @serie = ?,
            @anio_fabricacion = ?,
            @codigo_marca = ?,
            @codigo_linea = ?
        """,
        codigo_vehiculo,
        datos["VIN"],
        datos["chasis"],
        datos["placa"],
        datos["serie"],
        datos["anio_fabricacion"],
        datos["codigo_marca"],
        datos["codigo_linea"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vehiculo actualizado correctamente"
    })

#DELETE VEHICULOS
@app.route("/vehiculos/<int:codigo_vehiculo>", methods=["DELETE"])
def eliminar_vehiculo(codigo_vehiculo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vehiculo_Eliminar
            @codigo_vehiculo = ?
        """,
        codigo_vehiculo
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vehiculo eliminado correctamente"
    })
#Fin CRUD de Vehiculos


#Inicio CRUD de TransaccionPago
#GET PAGOS
@app.route("/pagos", methods=["GET"])
def listar_pagos():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_TransaccionPago_Listar")

    columnas = [columna[0] for columna in cursor.description]

    pagos = []

    for fila in cursor.fetchall():
        pago = dict(zip(columnas, fila))
        pagos.append(pago)

    conexion.close()

    return jsonify(pagos)


#POST PAGOS
# Revisamos el pago antes de abrir la conexión con la base de datos.
def validar_datos_pago(datos, codigo_transaccion=None):
    if not isinstance(datos, dict):
        raise ValueError("Debe enviar un objeto JSON válido")
    # SQL Server asigna el código del pago nuevo; al editar conservamos el de la URL.
    codigo = None if codigo_transaccion is None else entero_cliente(codigo_transaccion, "Código de transacción")
    if codigo_transaccion is not None and "codigo_transaccion" in datos and entero_cliente(datos["codigo_transaccion"], "Código de transacción") != codigo:
        raise ValueError("El código de transacción no coincide con el pago que se está editando")
    pago = {"codigo_transaccion": codigo}
    for campo, etiqueta in (("codigo_credito", "Crédito"), ("codigo_cuota", "Cuota"), ("codigo_medio_pago", "Medio de pago")):
        pago[campo] = entero_cliente(datos.get(campo), etiqueta)
    if codigo_transaccion is not None:
        comprobante = datos.get("numero_comprobante")
        if not isinstance(comprobante, str) or not comprobante.strip() or len(comprobante.strip()) > 50:
            raise ValueError("El comprobante es obligatorio y debe tener como máximo 50 caracteres")
        pago["numero_comprobante"] = comprobante.strip()
    else:
        pago["numero_comprobante"] = None
    solicitud = datos.get("id_solicitud")
    try:
        pago["id_solicitud"] = str(UUID(solicitud)) if solicitud is not None else None
    except (ValueError, TypeError, AttributeError):
        raise ValueError("El identificador de la solicitud de pago no es válido")
    referencia = datos.get("referencia_bancaria", "")
    if referencia is not None and not isinstance(referencia, str):
        raise ValueError("La referencia bancaria debe ser texto")
    pago["referencia_bancaria"] = (referencia or "").strip()
    if len(pago["referencia_bancaria"]) > 100:
        raise ValueError("La referencia bancaria debe tener como máximo 100 caracteres")
    valor = datos.get("monto_pagado")
    if isinstance(valor, bool) or not isinstance(valor, (int, float, str, Decimal)):
        raise ValueError("El monto pagado debe ser un número válido")
    try:
        monto = Decimal(str(valor))
    except InvalidOperation:
        raise ValueError("El monto pagado debe ser un número válido")
    if not monto.is_finite() or monto <= 0 or monto > Decimal("99999999.99"):
        raise ValueError("El monto debe ser mayor que cero y no superar 99999999.99")
    if monto != monto.quantize(Decimal("0.01")):
        raise ValueError("El monto debe tener como máximo dos decimales")
    pago["monto_pagado"] = monto.quantize(Decimal("0.01"))
    fecha = datos.get("fecha_hora_pago")
    if not isinstance(fecha, str) or "T" not in fecha:
        raise ValueError("La fecha y hora son obligatorias; usa el formato AAAA-MM-DDTHH:MM")
    try:
        fecha_hora = datetime.fromisoformat(fecha)
    except ValueError:
        raise ValueError("La fecha y hora del pago no son válidas")
    if fecha_hora.tzinfo is not None:
        raise ValueError("Envía la fecha y hora local sin zona horaria")
    if not datetime(1753, 1, 1) <= fecha_hora <= datetime(9999, 12, 31, 23, 59, 59, 997000):
        raise ValueError("La fecha y hora están fuera del rango permitido por SQL Server")
    pago["fecha_hora_pago"] = fecha_hora
    return pago


# Usamos la misma revisión para registrar y editar un pago.
def guardar_pago_automatico(pago):
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        # Validación del saldo y asignación del código en una sola transacción de SQL Server.
        cursor.execute("""EXEC dbo.sp_TransaccionPago_InsertarAutomatico
            @numero_comprobante=?, @fecha_hora_pago=?, @monto_pagado=?, @referencia_bancaria=?,
            @codigo_cuota=?, @codigo_credito=?, @codigo_medio_pago=?, @id_solicitud=?""",
            pago["numero_comprobante"], pago["fecha_hora_pago"], pago["monto_pagado"], pago["referencia_bancaria"],
            pago["codigo_cuota"], pago["codigo_credito"], pago["codigo_medio_pago"], pago["id_solicitud"])
        while cursor.description is None and cursor.nextset():
            pass
        fila = cursor.fetchone()
        if fila is None or len(fila) < 2:
            conexion.rollback()
            return jsonify({"error": "Actualiza pagos_codigo_automatico.sql para generar el comprobante. No se guardó el pago."}), 503
        codigo = int(fila[0])
        comprobante = str(fila[1])
        while cursor.nextset():
            pass
        conexion.commit()
        return jsonify({"mensaje": f"Pago registrado correctamente. Comprobante: {comprobante}. Código de transacción: {codigo}.",
                        "codigo_transaccion": codigo, "numero_comprobante": comprobante}), 201
    except pyodbc.Error as error:
        conexion.rollback()
        texto = str(error)
        if "2812" in texto or "11719" in texto or "208" in texto:
            return jsonify({"error": "Falta instalar pagos_codigo_automatico.sql en Magis_Auto. No se guardó el pago."}), 503
        if "11728" in texto:
            return jsonify({"error": "Se agotaron los códigos de transacción disponibles. No se guardó el pago."}), 409
        respuesta = error_sql_plan(error)
        if respuesta is not None:
            return respuesta
        if any(codigo in texto for codigo in ("2627", "2601", "547", "1205", "1222")):
            return jsonify({"error": "No se guardó el pago por un conflicto de datos o una operación simultánea. Revisa los pagos antes de reintentar."}), 409
        raise
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()


def guardar_pago_validado(codigo_transaccion=None):
    try:
        pago = validar_datos_pago(request.get_json(silent=True), codigo_transaccion)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    editando = codigo_transaccion is not None
    if not editando:
        return guardar_pago_automatico(pago)
    conexion = obtener_conexion()
    try:
        cursor = conexion.cursor()
        cursor.execute("SET XACT_ABORT ON; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;")

        def rechazar(mensaje, estado=400, **detalle):
            conexion.rollback()
            return jsonify({"error": mensaje, **detalle}), estado

        # Bloqueamos el crédito antes de consultar el saldo para coordinar los pagos simultáneos.
        cursor.execute("SELECT estado FROM dbo.Credito WITH (UPDLOCK, HOLDLOCK) WHERE codigo_credito = ?", pago["codigo_credito"])
        credito = cursor.fetchone()
        if credito is None:
            return rechazar("El crédito seleccionado no existe", 404)
        if str(credito[0] or "").strip().lower() != "activo":
            return rechazar("El crédito debe estar activo para registrar o editar un pago", 409)
        cursor.execute("SELECT codigo_credito, valor_total_cuota FROM dbo.Cuota WITH (UPDLOCK, HOLDLOCK) WHERE codigo_cuota = ?", pago["codigo_cuota"])
        cuota = cursor.fetchone()
        if cuota is None:
            return rechazar("La cuota seleccionada no existe", 404)
        if cuota[0] != pago["codigo_credito"]:
            return rechazar("La cuota seleccionada no pertenece al crédito")
        if cuota[1] is None or cuota[1] <= 0:
            return rechazar("La cuota no tiene un valor válido para recibir pagos", 409)
        cursor.execute("SELECT codigo_medio_pago, descripcion FROM dbo.MedioPago WITH (HOLDLOCK) WHERE codigo_medio_pago = ?", pago["codigo_medio_pago"])
        medio = cursor.fetchone()
        if medio is None:
            return rechazar("El medio de pago seleccionado no existe")
        if str(medio[1] or "").strip().lower().startswith("efectivo"):
            pago["referencia_bancaria"] = None
        elif not pago["referencia_bancaria"] or pago["referencia_bancaria"].lower() in ("no aplica", "n/a"):
            return rechazar("Ingresa la referencia real de la boleta, transferencia o autorización")
        cursor.execute("SELECT codigo_transaccion FROM dbo.TransaccionPago WITH (UPDLOCK, HOLDLOCK) WHERE codigo_transaccion = ?", pago["codigo_transaccion"])
        existe = cursor.fetchone() is not None
        if editando and not existe:
            return rechazar("El pago que intentas editar ya no existe", 404)
        if not editando and existe:
            return rechazar("El código de transacción ya está registrado", 409)

        # Sumamos todos los pagos de la cuota, excepto el que estamos editando.
        cursor.execute("""
            SELECT COALESCE(SUM(monto_pagado), 0)
            FROM dbo.TransaccionPago WITH (UPDLOCK, HOLDLOCK)
            WHERE codigo_cuota = ? AND codigo_transaccion <> ?
        """, pago["codigo_cuota"], pago["codigo_transaccion"])
        abonado = cursor.fetchone()[0]
        if abonado < 0:
            return rechazar("La cuota tiene pagos anteriores inválidos que deben revisarse", 409)
        saldo = Decimal(str(cuota[1])) - Decimal(str(abonado))
        if pago["monto_pagado"] > saldo:
            return rechazar("El monto pagado supera el saldo disponible de la cuota", saldo_disponible=format(max(saldo, Decimal("0")), ".2f"))

        procedimiento = "sp_TransaccionPago_Actualizar" if editando else "sp_TransaccionPago_Insertar"
        cursor.execute(f"""
            EXEC dbo.{procedimiento}
                @codigo_transaccion = ?, @numero_comprobante = ?, @fecha_hora_pago = ?,
                @monto_pagado = ?, @referencia_bancaria = ?, @codigo_cuota = ?,
                @codigo_credito = ?, @codigo_medio_pago = ?
        """, pago["codigo_transaccion"], pago["numero_comprobante"], pago["fecha_hora_pago"],
            pago["monto_pagado"], pago["referencia_bancaria"], pago["codigo_cuota"],
            pago["codigo_credito"], pago["codigo_medio_pago"])
        while cursor.nextset():
            pass
        # Confirmamos una sola vez, después de revisar y guardar el pago.
        conexion.commit()
        return jsonify({"mensaje": "Pago actualizado correctamente" if editando else "Pago registrado correctamente"}), 200 if editando else 201
    except pyodbc.Error as error:
        conexion.rollback()
        texto = str(error)
        if "2627" in texto or "2601" in texto:
            return jsonify({"error": "El código o un dato único del pago ya está registrado. No se guardaron cambios."}), 409
        if "547" in texto:
            return jsonify({"error": "El crédito, cuota o medio de pago ya no está disponible. No se guardaron cambios."}), 409
        if "1205" in texto or "1222" in texto:
            return jsonify({"error": "Otra operación está modificando estos datos. Actualiza el saldo e intenta nuevamente. No se guardaron cambios."}), 409
        raise
    except Exception:
        conexion.rollback()
        raise
    finally:
        conexion.close()


# Conservamos las direcciones que ya usa el frontend.
@app.route("/pagos", methods=["POST"])
def insertar_pago():
    return guardar_pago_validado()


@app.route("/pagos/<int:codigo_transaccion>", methods=["PUT"])
def actualizar_pago(codigo_transaccion):
    return guardar_pago_validado(codigo_transaccion)


#DELETE PAGOS
@app.route("/pagos/<int:codigo_transaccion>", methods=["DELETE"])
def eliminar_pago(codigo_transaccion):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TransaccionPago_Eliminar
            @codigo_transaccion = ?
        """,
        codigo_transaccion
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Pago eliminado correctamente"
    })
#FIN CRUD de TransaccionPago

#INICIO CRUD de Cuotas
#GET CUOTAS
@app.route("/cuotas", methods=["GET"])
def listar_cuotas():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC dbo.sp_PlanCuotas_ListarCuotas")

    columnas = [columna[0] for columna in cursor.description]

    cuotas = []

    for fila in cursor.fetchall():
        cuota = dict(zip(columnas, fila))
        cuotas.append(cuota)

    conexion.close()

    return jsonify(cuotas)

#post CUOTAS
@app.route("/cuotas", methods=["POST"])
def insertar_cuota():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()
    validar_cambio_plan(conexion, cursor,
        "EXEC dbo.sp_PlanCuotas_ValidarCambioCuota @codigo_credito=?, @codigo_cuota=NULL", datos["codigo_credito"])


    cursor.execute(
        """
        EXEC sp_Cuota_Insertar
            @codigo_cuota = ?,
            @numero_cuota = ?,
            @fecha_plan = ?,
            @fecha_vencimiento = ?,
            @capital = ?,
            @intereses = ?,
            @manejo_cuenta = ?,
            @seguro_vehiculo = ?,
            @seguro_vida = ?,
            @valor_total_cuota = ?,
            @codigo_credito = ?
        """,
        datos["codigo_cuota"],
        datos["numero_cuota"],
        datos["fecha_plan"],
        datos["fecha_vencimiento"],
        datos["capital"],
        datos["intereses"],
        datos["manejo_cuenta"],
        datos["seguro_vehiculo"],
        datos["seguro_vida"],
        datos["valor_total_cuota"],
        datos["codigo_credito"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Cuota registrada correctamente"
    }), 201

#PUT CUOTAS
@app.route("/cuotas/<int:codigo_cuota>", methods=["PUT"])
def actualizar_cuota(codigo_cuota):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()
    validar_cambio_plan(conexion, cursor,
        "EXEC dbo.sp_PlanCuotas_ValidarCambioCuota @codigo_credito=?, @codigo_cuota=?", datos["codigo_credito"], codigo_cuota)


    cursor.execute(
        """
        EXEC sp_Cuota_Actualizar
            @codigo_cuota = ?,
            @numero_cuota = ?,
            @fecha_plan = ?,
            @fecha_vencimiento = ?,
            @capital = ?,
            @intereses = ?,
            @manejo_cuenta = ?,
            @seguro_vehiculo = ?,
            @seguro_vida = ?,
            @valor_total_cuota = ?,
            @codigo_credito = ?
        """,
        codigo_cuota,
        datos["numero_cuota"],
        datos["fecha_plan"],
        datos["fecha_vencimiento"],
        datos["capital"],
        datos["intereses"],
        datos["manejo_cuenta"],
        datos["seguro_vehiculo"],
        datos["seguro_vida"],
        datos["valor_total_cuota"],
        datos["codigo_credito"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Cuota actualizada correctamente"
    })

#DELETE CUOTAS
@app.route("/cuotas/<int:codigo_cuota>", methods=["DELETE"])
def eliminar_cuota(codigo_cuota):

    conexion = obtener_conexion()
    cursor = conexion.cursor()
    validar_cambio_plan(conexion, cursor,
        "EXEC dbo.sp_PlanCuotas_ValidarCambioCuota @codigo_credito=NULL, @codigo_cuota=?", codigo_cuota)


    cursor.execute(
        """
        EXEC sp_Cuota_Eliminar
            @codigo_cuota = ?
        """,
        codigo_cuota
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Cuota eliminada correctamente"
    })
#FIN CRUD de Cuotas

#INICIO CRUD de Deudor
#GET DEUDORES
@app.route("/deudores", methods=["GET"])
def listar_deudores():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Deudor_Listar")

    columnas = [columna[0] for columna in cursor.description]

    deudores = []

    for fila in cursor.fetchall():
        deudor = dict(zip(columnas, fila))
        deudores.append(deudor)

    conexion.close()

    return jsonify(deudores)

#POST DEUDORES
@app.route("/deudores", methods=["POST"])
def insertar_deudor():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Deudor_Insertar
            @codigo_deudor = ?,
            @codigo_persona = ?
        """,
        datos["codigo_deudor"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Deudor registrado correctamente"
    }), 201

#PUT DEUDORES
@app.route("/deudores/<int:codigo_deudor>", methods=["PUT"])
def actualizar_deudor(codigo_deudor):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Deudor_Actualizar
            @codigo_deudor = ?,
            @codigo_persona = ?
        """,
        codigo_deudor,
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Deudor actualizado correctamente"
    })

#DELETE DEUDORES
@app.route("/deudores/<int:codigo_deudor>", methods=["DELETE"])
def eliminar_deudor(codigo_deudor):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Deudor_Eliminar
            @codigo_deudor = ?
        """,
        codigo_deudor
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Deudor eliminado correctamente"
    })
#FIN CRUD de Deudor

#INICIO CRUD de Vendedor
#GET VENDEDORES
@app.route("/vendedores", methods=["GET"])
def listar_vendedores():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Vendedor_Listar")

    columnas = [columna[0] for columna in cursor.description]

    vendedores = []

    for fila in cursor.fetchall():
        vendedor = dict(zip(columnas, fila))
        vendedores.append(vendedor)

    conexion.close()

    return jsonify(vendedores)

#POST VENDEDORES
@app.route("/vendedores", methods=["POST"])
def insertar_vendedor():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vendedor_Insertar
            @codigo_vendedor = ?,
            @codigo_empleado = ?,
            @codigo_persona = ?
        """,
        datos["codigo_vendedor"],
        datos["codigo_empleado"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vendedor registrado correctamente"
    }), 201

#PUT VENDEDORES
@app.route("/vendedores/<int:codigo_vendedor>", methods=["PUT"])
def actualizar_vendedor(codigo_vendedor):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vendedor_Actualizar
            @codigo_vendedor = ?,
            @codigo_empleado = ?,
            @codigo_persona = ?
        """,
        codigo_vendedor,
        datos["codigo_empleado"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vendedor actualizado correctamente"
    })

#DELETE VENDEDORES
@app.route("/vendedores/<int:codigo_vendedor>", methods=["DELETE"])
def eliminar_vendedor(codigo_vendedor):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vendedor_Eliminar
            @codigo_vendedor = ?
        """,
        codigo_vendedor
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Vendedor eliminado correctamente"
    })
#FIN CRUD de Vendedor

#INICIO CRUD de Referencia
#GET REFERENCIAS
@app.route("/referencias", methods=["GET"])
def listar_referencias():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Referencia_Listar")

    columnas = [columna[0] for columna in cursor.description]

    referencias = []

    for fila in cursor.fetchall():
        referencia = dict(zip(columnas, fila))
        referencias.append(referencia)

    conexion.close()

    return jsonify(referencias)

#POST REFERENCIAS
@app.route("/referencias", methods=["POST"])
def insertar_referencia():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Referencia_Insertar
            @codigo_referencia = ?,
            @codigo_persona = ?,
            @codigo_tipo_referencia = ?
        """,
        datos["codigo_referencia"],
        datos["codigo_persona"],
        datos["codigo_tipo_referencia"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia registrada correctamente"
    }), 201

#PUT REFERENCIAS
@app.route("/referencias/<int:codigo_referencia>", methods=["PUT"])
def actualizar_referencia(codigo_referencia):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Referencia_Actualizar
            @codigo_referencia = ?,
            @codigo_persona = ?,
            @codigo_tipo_referencia = ?
        """,
        codigo_referencia,
        datos["codigo_persona"],
        datos["codigo_tipo_referencia"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia actualizada correctamente"
    })

#DELETE REFERENCIAS
@app.route("/referencias/<int:codigo_referencia>", methods=["DELETE"])
def eliminar_referencia(codigo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Referencia_Eliminar
            @codigo_referencia = ?
        """,
        codigo_referencia
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia eliminada correctamente"
    })
#FIN CRUD de Referencia

#INICIO CRUD de Fiador
#GET FIADORES
@app.route("/fiadores", methods=["GET"])
def listar_fiadores():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Fiador_Listar")

    columnas = [columna[0] for columna in cursor.description]

    fiadores = []

    for fila in cursor.fetchall():
        fiador = dict(zip(columnas, fila))
        fiadores.append(fiador)

    conexion.close()

    return jsonify(fiadores)

#POST FIADORES
@app.route("/fiadores", methods=["POST"])
def insertar_fiador():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Fiador_Insertar
            @codigo_fiador = ?,
            @codigo_persona = ?
        """,
        datos["codigo_fiador"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Fiador registrado correctamente"
    }), 201

#PUT FIADORES
@app.route("/fiadores/<int:codigo_fiador>", methods=["PUT"])
def actualizar_fiador(codigo_fiador):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Fiador_Actualizar
            @codigo_fiador = ?,
            @codigo_persona = ?
        """,
        codigo_fiador,
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Fiador actualizado correctamente"
    })

#DELETE FIADORES
@app.route("/fiadores/<int:codigo_fiador>", methods=["DELETE"])
def eliminar_fiador(codigo_fiador):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Fiador_Eliminar
            @codigo_fiador = ?
        """,
        codigo_fiador
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Fiador eliminado correctamente"
    })
#FIN CRUD de Fiador

#INICIO CRUD de Telefono
#GET TELEFONOS
@app.route("/telefonos", methods=["GET"])
def listar_telefonos():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Telefono_Listar")

    columnas = [columna[0] for columna in cursor.description]

    telefonos = []

    for fila in cursor.fetchall():
        telefono = dict(zip(columnas, fila))
        telefonos.append(telefono)

    conexion.close()

    return jsonify(telefonos)

#POST TELEFONOS
@app.route("/telefonos", methods=["POST"])
def insertar_telefono():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Telefono_Insertar
            @correlativo = ?,
            @numero = ?,
            @codigo_persona = ?,
            @codigo_tipo_telefono = ?
        """,
        datos["correlativo"],
        datos["numero"],
        datos["codigo_persona"],
        datos["codigo_tipo_telefono"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Telefono registrado correctamente"
    }), 201

#PUT TELEFONOS
@app.route("/telefonos/<int:correlativo>", methods=["PUT"])
def actualizar_telefono(correlativo):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Telefono_Actualizar
            @correlativo = ?,
            @numero = ?,
            @codigo_persona = ?,
            @codigo_tipo_telefono = ?
        """,
        correlativo,
        datos["numero"],
        datos["codigo_persona"],
        datos["codigo_tipo_telefono"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Telefono actualizado correctamente"
    })

#DELETE TELEFONOS
@app.route("/telefonos/<int:correlativo>", methods=["DELETE"])
def eliminar_telefono(correlativo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Telefono_Eliminar
            @correlativo = ?
        """,
        correlativo
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Telefono eliminado correctamente"
    })
#FIN CRUD de Telefono

#INICIO CRUD de Direccion
#GET DIRECCIONES
@app.route("/direcciones", methods=["GET"])
def listar_direcciones():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Direccion_Listar")

    columnas = [columna[0] for columna in cursor.description]

    direcciones = []

    for fila in cursor.fetchall():
        direccion = dict(zip(columnas, fila))
        direcciones.append(direccion)

    conexion.close()

    return jsonify(direcciones)

#POST DIRECCIONES
@app.route("/direcciones", methods=["POST"])
def insertar_direccion():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Direccion_Insertar
            @correlativo = ?,
            @calle = ?,
            @avenida = ?,
            @zona = ?,
            @codigo_departamento = ?,
            @codigo_municipio = ?,
            @codigo_tipo_direccion = ?,
            @codigo_persona = ?
        """,
        datos["correlativo"],
        datos["calle"],
        datos["avenida"],
        datos["zona"],
        datos["codigo_departamento"],
        datos["codigo_municipio"],
        datos["codigo_tipo_direccion"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Direccion registrada correctamente"
    }), 201

#PUT DIRECCIONES
@app.route("/direcciones/<int:correlativo>", methods=["PUT"])
def actualizar_direccion(correlativo):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Direccion_Actualizar
            @correlativo = ?,
            @calle = ?,
            @avenida = ?,
            @zona = ?,
            @codigo_departamento = ?,
            @codigo_municipio = ?,
            @codigo_tipo_direccion = ?,
            @codigo_persona = ?
        """,
        correlativo,
        datos["calle"],
        datos["avenida"],
        datos["zona"],
        datos["codigo_departamento"],
        datos["codigo_municipio"],
        datos["codigo_tipo_direccion"],
        datos["codigo_persona"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Direccion actualizada correctamente"
    })

#DELETE DIRECCIONES
@app.route("/direcciones/<int:correlativo>", methods=["DELETE"])
def eliminar_direccion(correlativo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Direccion_Eliminar
            @correlativo = ?
        """,
        correlativo
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Direccion eliminada correctamente"
    })
#FIN CRUD de Direccion

#INICIO CRUD de Marca
#GET MARCAS
@app.route("/marcas", methods=["GET"])
def listar_marcas():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Marca_Listar")

    columnas = [columna[0] for columna in cursor.description]

    marcas = []

    for fila in cursor.fetchall():
        marca = dict(zip(columnas, fila))
        marcas.append(marca)

    conexion.close()

    return jsonify(marcas)

#POST MARCAS
@app.route("/marcas", methods=["POST"])
def insertar_marca():

    datos = request.get_json(silent=True)

    # Si el JSON está vacío, mal formado o no es un objeto
    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Marca_Insertar
            @codigo_marca = ?,
            @descripcion = ?
        """,
        datos["codigo_marca"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Marca registrada correctamente"
    }), 201

#PUT MARCAS
@app.route("/marcas/<int:codigo_marca>", methods=["PUT"])
def actualizar_marca(codigo_marca):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Marca_Actualizar
            @codigo_marca = ?,
            @descripcion = ?
        """,
        codigo_marca,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Marca actualizada correctamente"
    })

#DELETE MARCAS
@app.route("/marcas/<int:codigo_marca>", methods=["DELETE"])
def eliminar_marca(codigo_marca):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Marca_Eliminar
            @codigo_marca = ?
        """,
        codigo_marca
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Marca eliminada correctamente"
    })
#FIN CRUD de Marca

#INICIO CRUD de Linea
#GET LINEAS
@app.route("/lineas", methods=["GET"])
def listar_lineas():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Linea_Listar")

    columnas = [columna[0] for columna in cursor.description]

    lineas = []

    for fila in cursor.fetchall():
        linea = dict(zip(columnas, fila))
        lineas.append(linea)

    conexion.close()

    return jsonify(lineas)


#POST LINEAS
@app.route("/lineas", methods=["POST"])
def insertar_linea():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Linea_Insertar
            @codigo_linea = ?,
            @descripcion = ?,
            @codigo_marca = ?
        """,
        datos["codigo_linea"],
        datos["descripcion"],
        datos["codigo_marca"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Linea registrada correctamente"
    }), 201

#PUT LINEAS
@app.route("/lineas/<int:codigo_linea>", methods=["PUT"])
def actualizar_linea(codigo_linea):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Linea_Actualizar
            @codigo_linea = ?,
            @descripcion = ?,
            @codigo_marca = ?
        """,
        codigo_linea,
        datos["descripcion"],
        datos["codigo_marca"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Linea actualizada correctamente"
    })

#DELETE LINEAS
@app.route("/lineas/<int:codigo_linea>", methods=["DELETE"])
def eliminar_linea(codigo_linea):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Linea_Eliminar
            @codigo_linea = ?
        """,
        codigo_linea
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Linea eliminada correctamente"
    })
#FIN CRUD de Linea

#INICIO CRUD de MedioPago
#GET MEDIOS DE PAGO
@app.route("/medios-pago", methods=["GET"])
def listar_medios_pago():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_MedioPago_Listar")

    columnas = [columna[0] for columna in cursor.description]

    medios_pago = []

    for fila in cursor.fetchall():
        medio = dict(zip(columnas, fila))
        medios_pago.append(medio)

    conexion.close()

    return jsonify(medios_pago)

#  POST MEDIOS DE PAGO
@app.route("/medios-pago", methods=["POST"])
def insertar_medio_pago():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_MedioPago_Insertar
            @codigo_medio_pago = ?,
            @descripcion = ?
        """,
        datos["codigo_medio_pago"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Medio de pago registrado correctamente"
    }), 201

#PUT MEDIOS DE PAGO
@app.route("/medios-pago/<int:codigo_medio_pago>", methods=["PUT"])
def actualizar_medio_pago(codigo_medio_pago):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_MedioPago_Actualizar
            @codigo_medio_pago = ?,
            @descripcion = ?
        """,
        codigo_medio_pago,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Medio de pago actualizado correctamente"
    })

#DELETE MEDIOS DE PAGO
@app.route("/medios-pago/<int:codigo_medio_pago>", methods=["DELETE"])
def eliminar_medio_pago(codigo_medio_pago):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_MedioPago_Eliminar
            @codigo_medio_pago = ?
        """,
        codigo_medio_pago
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Medio de pago eliminado correctamente"
    })
#FIN CRUD de MedioPago

#Inicio CRUD de TipoTelefono
#GET TIPOS DE TELEFONO
@app.route("/tipos-telefono", methods=["GET"])
def listar_tipos_telefono():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_TipoTelefono_Listar")

    columnas = [columna[0] for columna in cursor.description]

    tipos_telefono = []

    for fila in cursor.fetchall():
        tipo = dict(zip(columnas, fila))
        tipos_telefono.append(tipo)

    conexion.close()

    return jsonify(tipos_telefono)

#  POST TIPOS DE TELEFONO
@app.route("/tipos-telefono", methods=["POST"])
def insertar_tipo_telefono():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoTelefono_Insertar
            @codigo_tipo_telefono = ?,
            @descripcion = ?
        """,
        datos["codigo_tipo_telefono"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de telefono registrado correctamente"
    }), 201

#PUT TIPOS DE TELEFONO
@app.route("/tipos-telefono/<int:codigo_tipo_telefono>", methods=["PUT"])
def actualizar_tipo_telefono(codigo_tipo_telefono):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoTelefono_Actualizar
            @codigo_tipo_telefono = ?,
            @descripcion = ?
        """,
        codigo_tipo_telefono,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de telefono actualizado correctamente"
    })

#DELETE TIPOS DE TELEFONO
@app.route("/tipos-telefono/<int:codigo_tipo_telefono>", methods=["DELETE"])
def eliminar_tipo_telefono(codigo_tipo_telefono):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoTelefono_Eliminar
            @codigo_tipo_telefono = ?
        """,
        codigo_tipo_telefono
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de telefono eliminado correctamente"
    })
#FIN CRUD de TipoTelefono

#INICIO CRUD de TipoDireccion
#GET TIPOS DE DIRECCION
@app.route("/tipos-direccion", methods=["GET"])
def listar_tipos_direccion():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_TipoDireccion_Listar")

    columnas = [columna[0] for columna in cursor.description]

    tipos_direccion = []

    for fila in cursor.fetchall():
        tipo = dict(zip(columnas, fila))
        tipos_direccion.append(tipo)

    conexion.close()

    return jsonify(tipos_direccion)

#  POST TIPOS DE DIRECCION
@app.route("/tipos-direccion", methods=["POST"])
def insertar_tipo_direccion():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoDireccion_Insertar
            @codigo_tipo_direccion = ?,
            @descripcion = ?
        """,
        datos["codigo_tipo_direccion"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de direccion registrado correctamente"
    }), 201

#PUT TIPOS DE DIRECCION
@app.route("/tipos-direccion/<int:codigo_tipo_direccion>", methods=["PUT"])
def actualizar_tipo_direccion(codigo_tipo_direccion):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoDireccion_Actualizar
            @codigo_tipo_direccion = ?,
            @descripcion = ?
        """,
        codigo_tipo_direccion,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de direccion actualizado correctamente"
    })

#DELETE TIPOS DE DIRECCION
@app.route("/tipos-direccion/<int:codigo_tipo_direccion>", methods=["DELETE"])
def eliminar_tipo_direccion(codigo_tipo_direccion):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoDireccion_Eliminar
            @codigo_tipo_direccion = ?
        """,
        codigo_tipo_direccion
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de direccion eliminado correctamente"
    })

#FIN CRUD de TipoDireccion

#Inicio CRUD Departamento 
#GET DEPARTAMENTOS
@app.route("/departamentos", methods=["GET"])
def listar_departamentos():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Departamento_Listar")

    columnas = [columna[0] for columna in cursor.description]

    departamentos = []

    for fila in cursor.fetchall():
        departamento = dict(zip(columnas, fila))
        departamentos.append(departamento)

    conexion.close()

    return jsonify(departamentos)

#  POST DEPARTAMENTOS
@app.route("/departamentos", methods=["POST"])
def insertar_departamento():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Departamento_Insertar
            @codigo_departamento = ?,
            @descripcion = ?
        """,
        datos["codigo_departamento"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Departamento registrado correctamente"
    }), 201

#PUT DEPARTAMENTOS
@app.route("/departamentos/<int:codigo_departamento>", methods=["PUT"])
def actualizar_departamento(codigo_departamento):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Departamento_Actualizar
            @codigo_departamento = ?,
            @descripcion = ?
        """,
        codigo_departamento,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Departamento actualizado correctamente"
    })

#DELETE DEPARTAMENTOS
@app.route("/departamentos/<int:codigo_departamento>", methods=["DELETE"])
def eliminar_departamento(codigo_departamento):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Departamento_Eliminar
            @codigo_departamento = ?
        """,
        codigo_departamento
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Departamento eliminado correctamente"
    })
#FIN CRUD de Departamento

#INICIO CRUD de Municipio
#GET MUNICIPIOS
@app.route("/municipios", methods=["GET"])
def listar_municipios():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_Municipio_Listar")

    columnas = [columna[0] for columna in cursor.description]

    municipios = []

    for fila in cursor.fetchall():
        municipio = dict(zip(columnas, fila))
        municipios.append(municipio)

    conexion.close()

    return jsonify(municipios)

#  POST MUNICIPIOS
@app.route("/municipios", methods=["POST"])
def insertar_municipio():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Municipio_Insertar
            @codigo_municipio = ?,
            @descripcion = ?,
            @codigo_departamento = ?
        """,
        datos["codigo_municipio"],
        datos["descripcion"],
        datos["codigo_departamento"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Municipio registrado correctamente"
    }), 201

#PUT MUNICIPIOS
@app.route("/municipios/<int:codigo_municipio>", methods=["PUT"])
def actualizar_municipio(codigo_municipio):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Municipio_Actualizar
            @codigo_municipio = ?,
            @descripcion = ?,
            @codigo_departamento = ?
        """,
        codigo_municipio,
        datos["descripcion"],
        datos["codigo_departamento"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Municipio actualizado correctamente"
    })

#DELETE MUNICIPIOS
@app.route("/municipios/<int:codigo_municipio>", methods=["DELETE"])
def eliminar_municipio(codigo_municipio):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Municipio_Eliminar
            @codigo_municipio = ?
        """,
        codigo_municipio
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Municipio eliminado correctamente"
    })
#FIN CRUD de Municipio

#INICIO CRUD de TipoReferencia
#GET TIPOS DE REFERENCIA
@app.route("/tipos-referencia", methods=["GET"])
def listar_tipos_referencia():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_TipoReferencia_Listar")

    columnas = [columna[0] for columna in cursor.description]

    tipos_referencia = []

    for fila in cursor.fetchall():
        tipo = dict(zip(columnas, fila))
        tipos_referencia.append(tipo)

    conexion.close()

    return jsonify(tipos_referencia)

#  POST TIPOS DE REFERENCIA
@app.route("/tipos-referencia", methods=["POST"])
def insertar_tipo_referencia():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoReferencia_Insertar
            @codigo_tipo_referencia = ?,
            @descripcion = ?
        """,
        datos["codigo_tipo_referencia"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de referencia registrado correctamente"
    }), 201

#PUT TIPOS DE REFERENCIA
@app.route("/tipos-referencia/<int:codigo_tipo_referencia>", methods=["PUT"])
def actualizar_tipo_referencia(codigo_tipo_referencia):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoReferencia_Actualizar
            @codigo_tipo_referencia = ?,
            @descripcion = ?
        """,
        codigo_tipo_referencia,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de referencia actualizado correctamente"
    })

#DELETE TIPOS DE REFERENCIA
@app.route("/tipos-referencia/<int:codigo_tipo_referencia>", methods=["DELETE"])
def eliminar_tipo_referencia(codigo_tipo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoReferencia_Eliminar
            @codigo_tipo_referencia = ?
        """,
        codigo_tipo_referencia
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de referencia eliminado correctamente"
    })
#FIN CRUD de TipoReferencia

#INICIO CRUD de TipoGarantia
#GET TIPOS DE GARANTIA
@app.route("/tipos-garantia", methods=["GET"])
def listar_tipos_garantia():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_TipoGarantia_Listar")

    columnas = [columna[0] for columna in cursor.description]

    tipos_garantia = []

    for fila in cursor.fetchall():
        tipo = dict(zip(columnas, fila))
        tipos_garantia.append(tipo)

    conexion.close()

    return jsonify(tipos_garantia)

#  POST TIPOS DE GARANTIA
@app.route("/tipos-garantia", methods=["POST"])
def insertar_tipo_garantia():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoGarantia_Insertar
            @codigo_tipo_garantia = ?,
            @descripcion = ?
        """,
        datos["codigo_tipo_garantia"],
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de garantia registrado correctamente"
    }), 201

#PUT TIPOS DE GARANTIA
@app.route("/tipos-garantia/<int:codigo_tipo_garantia>", methods=["PUT"])
def actualizar_tipo_garantia(codigo_tipo_garantia):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoGarantia_Actualizar
            @codigo_tipo_garantia = ?,
            @descripcion = ?
        """,
        codigo_tipo_garantia,
        datos["descripcion"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de garantia actualizado correctamente"
    })

#DELETE TIPOS DE GARANTIA
@app.route("/tipos-garantia/<int:codigo_tipo_garantia>", methods=["DELETE"])
def eliminar_tipo_garantia(codigo_tipo_garantia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoGarantia_Eliminar
            @codigo_tipo_garantia = ?
        """,
        codigo_tipo_garantia
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Tipo de garantia eliminado correctamente"
    })
#FIN CRUD de TipoGarantia

#INICIO CRUD de ReferenciaCredito
@app.route("/referencias-credito", methods=["GET"])
def listar_referencias_credito():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_ReferenciaCredito_Listar")

    columnas = [columna[0] for columna in cursor.description]

    referencias_credito = []

    for fila in cursor.fetchall():
        referencia_credito = dict(zip(columnas, fila))
        referencias_credito.append(referencia_credito)

    conexion.close()

    return jsonify(referencias_credito)

# POST REFERENCIAS DE CREDITO
@app.route("/referencias-credito", methods=["POST"])
def insertar_referencia_credito():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_ReferenciaCredito_Insertar
            @numero_credito = ?,
            @codigo_referencia = ?,
            @codigo_credito = ?
        """,
        datos["numero_credito"],
        datos["codigo_referencia"],
        datos["codigo_credito"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia asociada al credito correctamente"
    }), 201

#PUT REFERENCIAS DE CREDITO
@app.route(
    "/referencias-credito/<int:codigo_credito>/<int:codigo_referencia>",
    methods=["PUT"]
)
def actualizar_referencia_credito(codigo_credito, codigo_referencia):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_ReferenciaCredito_Actualizar
            @codigo_credito = ?,
            @codigo_referencia = ?,
            @numero_credito = ?
        """,
        codigo_credito,
        codigo_referencia,
        datos["numero_credito"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia de credito actualizada correctamente"
    })

#DELETE REFERENCIAS DE CREDITO
@app.route(
    "/referencias-credito/<int:codigo_credito>/<int:codigo_referencia>",
    methods=["DELETE"]
)
def eliminar_referencia_credito(codigo_credito, codigo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_ReferenciaCredito_Eliminar
            @codigo_credito = ?,
            @codigo_referencia = ?
        """,
        codigo_credito,
        codigo_referencia
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Referencia eliminada del credito correctamente"
    })
#FIN CRUD de ReferenciaCredito

#INICIO CRUD de CreditoFiador
#GET CREDITOS FIADOR
@app.route("/creditos-fiadores", methods=["GET"])
def listar_creditos_fiadores():

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute("EXEC sp_CreditoFiador_Listar")

    columnas = [columna[0] for columna in cursor.description]

    creditos_fiadores = []

    for fila in cursor.fetchall():
        relacion = dict(zip(columnas, fila))
        creditos_fiadores.append(relacion)

    conexion.close()

    return jsonify(creditos_fiadores)

#POST CREDITOS FIADOR
@app.route("/creditos-fiadores", methods=["POST"])
def insertar_credito_fiador():

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_CreditoFiador_Insertar
            @codigo_credito = ?,
            @codigo_fiador = ?
        """,
        datos["codigo_credito"],
        datos["codigo_fiador"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Fiador asociado al credito correctamente"
    }), 201

#PUT CREDITOS FIADOR
@app.route(
    "/creditos-fiadores/<int:codigo_credito>/<int:codigo_fiador>",
    methods=["PUT"]
)
def actualizar_credito_fiador(codigo_credito, codigo_fiador):

    datos = request.get_json(silent=True)

    if not isinstance(datos, dict):
        return jsonify({
            "error": "Solicitud invalida",
            "detalle": "Debe enviar un JSON valido"
        }), 400

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_CreditoFiador_Actualizar
            @codigo_credito_actual = ?,
            @codigo_fiador_actual = ?,
            @codigo_credito_nuevo = ?,
            @codigo_fiador_nuevo = ?
        """,
        codigo_credito,
        codigo_fiador,
        datos["nuevo_codigo_credito"],
        datos["nuevo_codigo_fiador"]
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Relacion credito-fiador actualizada correctamente"
    })

#DELETE CREDITOS FIADOR
@app.route(
    "/creditos-fiadores/<int:codigo_credito>/<int:codigo_fiador>",
    methods=["DELETE"]
)
def eliminar_credito_fiador(codigo_credito, codigo_fiador):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_CreditoFiador_Eliminar
            @codigo_credito = ?,
            @codigo_fiador = ?
        """,
        codigo_credito,
        codigo_fiador
    )

    conexion.commit()
    conexion.close()

    return jsonify({
        "mensaje": "Relacion credito-fiador eliminada correctamente"
    })
#FIN CRUD de CreditoFiador

#GET por ID
@app.route("/personas/<int:codigo_persona>", methods=["GET"])
def buscar_persona(codigo_persona):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Persona_Buscar
            @codigo_persona = ?
        """,
        codigo_persona
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Persona no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    persona = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(persona)

#GET POR ID Credito
@app.route("/creditos/<int:codigo_credito>", methods=["GET"])
def buscar_credito(codigo_credito):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Credito_Buscar
            @codigo_credito = ?
        """,
        codigo_credito
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Credito no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    credito = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(credito)

#GET POR ID Garantia
@app.route("/garantias/<int:codigo_garantia>", methods=["GET"])
def buscar_garantia(codigo_garantia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Garantia_Buscar
            @codigo_garantia = ?
        """,
        codigo_garantia
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Garantia no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    garantia = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(garantia)

#GET POR ID Vehiculo
@app.route("/vehiculos/<int:codigo_vehiculo>", methods=["GET"])
def buscar_vehiculo(codigo_vehiculo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vehiculo_Buscar
            @codigo_vehiculo = ?
        """,
        codigo_vehiculo
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Vehiculo no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    vehiculo = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(vehiculo)

#GET POR ID Pago
@app.route("/pagos/<int:codigo_transaccion>", methods=["GET"])
def buscar_pago(codigo_transaccion):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TransaccionPago_Buscar
            @codigo_transaccion = ?
        """,
        codigo_transaccion
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Pago no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    pago = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(pago)

#GET POR ID Cuota
@app.route("/cuotas/<int:codigo_cuota>", methods=["GET"])
def buscar_cuota(codigo_cuota):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Cuota_Buscar
            @codigo_cuota = ?
        """,
        codigo_cuota
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Cuota no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    cuota = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(cuota)

#GET POR ID Deudor
@app.route("/deudores/<int:codigo_deudor>", methods=["GET"])
def buscar_deudor(codigo_deudor):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Deudor_Buscar
            @codigo_deudor = ?
        """,
        codigo_deudor
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Deudor no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    deudor = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(deudor)

#GET POR ID Vendedor
@app.route("/vendedores/<int:codigo_vendedor>", methods=["GET"])
def buscar_vendedor(codigo_vendedor):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Vendedor_Buscar
            @codigo_vendedor = ?
        """,
        codigo_vendedor
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Vendedor no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    vendedor = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(vendedor)

#GET POR ID Referencia
@app.route("/referencias/<int:codigo_referencia>", methods=["GET"])
def buscar_referencia(codigo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Referencia_Buscar
            @codigo_referencia = ?
        """,
        codigo_referencia
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Referencia no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    referencia = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(referencia)

#GET POR ID Fiador
@app.route("/fiadores/<int:codigo_fiador>", methods=["GET"])
def buscar_fiador(codigo_fiador):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Fiador_Buscar
            @codigo_fiador = ?
        """,
        codigo_fiador
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Fiador no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    fiador = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(fiador)

#GET POR ID Telefono
@app.route("/telefonos/<int:correlativo>", methods=["GET"])
def buscar_telefono(correlativo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Telefono_Buscar
            @correlativo = ?
        """,
        correlativo
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Telefono no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    telefono = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(telefono)

#GET POR ID Direccion
@app.route("/direcciones/<int:correlativo>", methods=["GET"])
def buscar_direccion(correlativo):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Direccion_Buscar
            @correlativo = ?
        """,
        correlativo
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Direccion no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    direccion = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(direccion)

#GET POR ID Marca
@app.route("/marcas/<int:codigo_marca>", methods=["GET"])
def buscar_marca(codigo_marca):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Marca_Buscar
            @codigo_marca = ?
        """,
        codigo_marca
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Marca no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    marca = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(marca)

#GET POR ID Linea
@app.route("/lineas/<int:codigo_linea>", methods=["GET"])
def buscar_linea(codigo_linea):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Linea_Buscar
            @codigo_linea = ?
        """,
        codigo_linea
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Linea no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    linea = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(linea)

#GET POR ID MedioPago
@app.route("/medios-pago/<int:codigo_medio_pago>", methods=["GET"])
def buscar_medio_pago(codigo_medio_pago):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_MedioPago_Buscar
            @codigo_medio_pago = ?
        """,
        codigo_medio_pago
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Medio de pago no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    medio_pago = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(medio_pago)

#GET POR ID TipoTelefono
@app.route("/tipos-telefono/<int:codigo_tipo_telefono>", methods=["GET"])
def buscar_tipo_telefono(codigo_tipo_telefono):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoTelefono_Buscar
            @codigo_tipo_telefono = ?
        """,
        codigo_tipo_telefono
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Tipo de telefono no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    tipo_telefono = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(tipo_telefono)

#GET POR ID TipoDireccion
@app.route("/tipos-direccion/<int:codigo_tipo_direccion>", methods=["GET"])
def buscar_tipo_direccion(codigo_tipo_direccion):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoDireccion_Buscar
            @codigo_tipo_direccion = ?
        """,
        codigo_tipo_direccion
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Tipo de direccion no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    tipo_direccion = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(tipo_direccion)

#GET POR ID Departamento
@app.route("/departamentos/<int:codigo_departamento>", methods=["GET"])
def buscar_departamento(codigo_departamento):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Departamento_Buscar
            @codigo_departamento = ?
        """,
        codigo_departamento
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Departamento no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    departamento = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(departamento)

#GET POR ID Municipio
@app.route("/municipios/<int:codigo_municipio>", methods=["GET"])
def buscar_municipio(codigo_municipio):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_Municipio_Buscar
            @codigo_municipio = ?
        """,
        codigo_municipio
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Municipio no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    municipio = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(municipio)

#GET POR ID TipoReferencia
@app.route("/tipos-referencia/<int:codigo_tipo_referencia>", methods=["GET"])
def buscar_tipo_referencia(codigo_tipo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoReferencia_Buscar
            @codigo_tipo_referencia = ?
        """,
        codigo_tipo_referencia
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Tipo de referencia no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    tipo_referencia = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(tipo_referencia)

#GET POR ID TipoGarantia
@app.route("/tipos-garantia/<int:codigo_tipo_garantia>", methods=["GET"])
def buscar_tipo_garantia(codigo_tipo_garantia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_TipoGarantia_Buscar
            @codigo_tipo_garantia = ?
        """,
        codigo_tipo_garantia
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Tipo de garantia no encontrado"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    tipo_garantia = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(tipo_garantia)

#GET POR ID ReferenciaCredito
@app.route(
    "/referencias-credito/<int:codigo_credito>/<int:codigo_referencia>",
    methods=["GET"]
)
def buscar_referencia_credito(codigo_credito, codigo_referencia):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_ReferenciaCredito_Buscar
            @codigo_credito = ?,
            @codigo_referencia = ?
        """,
        codigo_credito,
        codigo_referencia
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Relacion referencia-credito no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    referencia_credito = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(referencia_credito)

#GET POR ID CreditoFiador
@app.route(
    "/creditos-fiadores/<int:codigo_credito>/<int:codigo_fiador>",
    methods=["GET"]
)
def buscar_credito_fiador(codigo_credito, codigo_fiador):

    conexion = obtener_conexion()
    cursor = conexion.cursor()

    cursor.execute(
        """
        EXEC sp_CreditoFiador_Buscar
            @codigo_credito = ?,
            @codigo_fiador = ?
        """,
        codigo_credito,
        codigo_fiador
    )

    fila = cursor.fetchone()

    if fila is None:
        conexion.close()

        return jsonify({
            "mensaje": "Relacion credito-fiador no encontrada"
        }), 404

    columnas = [columna[0] for columna in cursor.description]

    credito_fiador = dict(zip(columnas, fila))

    conexion.close()

    return jsonify(credito_fiador)

@app.route("/reportes/creditos-periodo", methods=["GET"])
def reporte_creditos_periodo():

    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")

    if not fecha_inicio or not fecha_fin:
        return jsonify({
            "error": "Debe indicar la fecha inicial y la fecha final"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteCreditosPorPeriodo
                @FechaInicio = ?,
                @FechaFin = ?
            """,
            fecha_inicio,
            fecha_fin
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500


@app.route("/reportes/cartera-mora", methods=["GET"])
def reporte_cartera_mora():

    fecha_corte = request.args.get("fecha_corte")

    if not fecha_corte:
        return jsonify({
            "error": "Debe indicar la fecha de corte"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteCarteraMora
                @FechaCorte = ?
            """,
            fecha_corte
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/pagos-por-tipo", methods=["GET"])
def reporte_pagos_por_tipo():

    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")

    if not fecha_inicio or not fecha_fin:
        return jsonify({
            "error": "Debe indicar la fecha inicial y la fecha final"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReportePagosPorTipo
                @FechaInicio = ?,
                @FechaFin = ?
            """,
            fecha_inicio,
            fecha_fin
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/ventas-vendedor", methods=["GET"])
def reporte_ventas_vendedor():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteVentasPorVendedor"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/cumpleaneros", methods=["GET"])
def reporte_cumpleaneros():

    mes = request.args.get("mes")

    if not mes:
        return jsonify({
            "error": "Debe indicar un mes"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteCumpleanerosMes
                @Mes = ?
            """,
            mes
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/estado-cuenta-deudor", methods=["GET"])
def reporte_estado_cuenta_deudor():

    codigo_deudor = request.args.get("codigo_deudor")

    if not codigo_deudor:
        return jsonify({
            "error": "Debe indicar el código del deudor"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteEstadoCuentaDeudor
                @CodigoDeudor = ?
            """,
            codigo_deudor
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/plan-pagos-credito", methods=["GET"])
def reporte_plan_pagos_credito():

    codigo_credito = request.args.get("codigo_credito")

    if not codigo_credito:
        return jsonify({
            "error": "Debe indicar el código del crédito"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReportePlanPagosCredito
                @CodigoCredito = ?
            """,
            codigo_credito
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500


@app.route("/reportes/creditos-activos", methods=["GET"])
def reporte_creditos_activos():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteCreditosActivos"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/creditos-por-mes", methods=["GET"])
def reporte_creditos_por_mes():

    anio = request.args.get("anio")
    mes = request.args.get("mes")

    if not anio or not mes:
        return jsonify({
            "error": "Debe indicar el año y el mes"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteCreditosPorMes
                @Anio = ?,
                @Mes = ?
            """,
            anio,
            mes
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/creditos-por-estado", methods=["GET"])
def reporte_creditos_por_estado():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteCreditosPorEstado"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/creditos-sobre-promedio", methods=["GET"])
def reporte_creditos_sobre_promedio():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteCreditosSobrePromedio"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/cuotas-vencidas", methods=["GET"])
def reporte_cuotas_vencidas():

    fecha_corte = request.args.get("fecha_corte")

    if not fecha_corte:
        return jsonify({
            "error": "Debe indicar la fecha de corte"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteCuotasVencidasPendientes
                @FechaCorte = ?
            """,
            fecha_corte
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/pagos-parciales", methods=["GET"])
def reporte_pagos_parciales():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReportePagosParciales"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/recaudacion-mensual", methods=["GET"])
def reporte_recaudacion_mensual():

    anio = request.args.get("anio")
    mes = request.args.get("mes")

    if not anio or not mes:
        return jsonify({
            "error": "Debe indicar el año y el mes"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteRecaudacionMensual
                @Anio = ?,
                @Mes = ?
            """,
            anio,
            mes
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/uso-medios-pago", methods=["GET"])
def reporte_uso_medios_pago():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteUsoMediosPago"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/deudores-con-creditos", methods=["GET"])
def reporte_deudores_con_creditos():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteDeudoresConCreditos"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/creditos-con-fiadores", methods=["GET"])
def reporte_creditos_con_fiadores():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteCreditosConFiadores"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/vehiculos-por-marca", methods=["GET"])
def reporte_vehiculos_por_marca():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteVehiculosPorMarca"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/intereses-por-credito", methods=["GET"])
def reporte_intereses_por_credito():

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            "EXEC sp_ReporteInteresesPorCredito"
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500

@app.route("/reportes/comisiones-vendedores", methods=["GET"])
def reporte_comisiones_vendedores():

    fecha_inicio = request.args.get("fecha_inicio")
    fecha_fin = request.args.get("fecha_fin")

    if not fecha_inicio or not fecha_fin:
        return jsonify({
            "error": "Debe indicar la fecha inicial y la fecha final"
        }), 400

    try:

        conexion = obtener_conexion()
        cursor = conexion.cursor()

        cursor.execute(
            """
            EXEC sp_ReporteComisionesVendedores
                @FechaInicio = ?,
                @FechaFin = ?
            """,
            fecha_inicio,
            fecha_fin
        )

        columnas = [
            columna[0]
            for columna in cursor.description
        ]

        resultados = []

        for fila in cursor.fetchall():

            registro = dict(
                zip(columnas, fila)
            )

            resultados.append(registro)

        cursor.close()
        conexion.close()

        return jsonify(resultados)

    except Exception as error:

        print(error)

        return jsonify({
            "error": str(error)
        }), 500









if __name__ == "__main__":
    app.run(debug=True)
