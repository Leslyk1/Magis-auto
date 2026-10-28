# MAGIS-AUTO

Aplicación de gestión de clientes, vehículos, garantías, créditos, planes de cuotas y pagos.

## Partes del proyecto

- `frontend web/index.html`: estructura de la página y menú.
- `frontend web/estilos.css`: apariencia de la interfaz.
- `frontend web/app.js`: formularios, tablas y solicitudes HTTP a la API.
- `app.py`: API Flask, validaciones y comunicación con SQL Server.
- `conexion.py`: conexión ODBC con autenticación de Windows.
- `probar_conexion.py`: prueba de acceso a la base de datos.

Flujo de comunicación: navegador → solicitudes HTTP → API Flask → SQL Server → respuesta JSON → navegador.

## Instalación en otra PC con Windows

Se utiliza Python 3.12. Instala también Git, SQL Server, SQL Server Management Studio y Microsoft ODBC Driver 17 for SQL Server. Para abrir el frontend puedes utilizar Visual Studio Code con la extensión Live Server.

### 1. Copiar el código

Inicia sesión con una cuenta que tenga acceso al repositorio y ejecuta:

```powershell
git clone https://github.com/Leslyk1/Magis-auto.git
cd Magis-auto
py -3.12 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

El entorno `venv` se crea nuevamente en cada equipo; no se copia desde la PC anterior.

### 2. Trasladar SQL Server por separado

Este repositorio NO contiene la base de datos ni sus datos. Copiar el código por sí solo no completa la instalación.

En la PC original, crea en SQL Server Management Studio un respaldo completo y reciente de `Magis_Auto` desde Tareas → Copia de seguridad. Transfiere el archivo `.bak` por un medio privado y restáuralo en la otra PC. El SQL Server de destino debe ser de una versión compatible con el respaldo; un respaldo de una versión más nueva no se restaura en una más antigua.

El respaldo debe incluir las tablas, catálogos, datos, procedimientos almacenados, secuencias e índices actuales. Entre las incorporaciones recientes están los procedimientos del plan de cuotas y `dbo.sp_TransaccionPago_InsertarAutomatico`, la secuencia `dbo.SecuenciaTransaccionPago` y los campos de seguros y totales del crédito. Los archivos SQL que se eliminaron del proyecto no sustituyen este respaldo: sus objetos permanecen instalados en la base original.

No subas respaldos con información personal a GitHub. El usuario de Windows de la otra PC debe contar con acceso a la base restaurada.

La configuración actual de `conexion.py` usa:

```text
DRIVER={ODBC Driver 17 for SQL Server}
SERVER=localhost
DATABASE=Magis_Auto
Trusted_Connection=yes
```

Si SQL Server está instalado como una instancia con nombre, ajusta `SERVER` a la instancia real. Por ejemplo, una instancia Express podría llamarse `localhost\SQLEXPRESS`; compruébalo en el equipo de destino.

### 3. Iniciar la API

```powershell
.\venv\Scripts\python.exe probar_conexion.py
.\venv\Scripts\python.exe app.py
```

La primera orden debe confirmar la conexión a `Magis_Auto`. Mantén abierta la terminal de Flask durante la demostración. La API escucha en `http://127.0.0.1:5000`.

### 4. Iniciar el frontend

Abre la carpeta clonada en Visual Studio Code. En `frontend web/index.html`, selecciona **Open with Live Server**. Usualmente se abrirá:

```text
http://127.0.0.1:5500/frontend%20web/index.html
```

En `app.js` se mantiene:

```javascript
const API = "http://127.0.0.1:5000";
```

API, navegador y SQL Server deben ejecutarse en la nueva PC para utilizar esta configuración local. Live Server puede elegir otro puerto si el 5500 ya está ocupado.

## Verificación antes de presentar

1. Comprueba la conexión con `probar_conexion.py`.
2. Inicia Flask y abre Clientes desde el frontend.
3. Confirma que aparecen los catálogos, nombres y registros esperados.
4. Abre el plan de cuotas de un crédito y su historial de pagos.
5. Para una prueba nueva, sigue Cliente → Deudor → Vehículo → Garantía → Crédito → Plan de cuotas → Pago. El vendedor y los catálogos necesarios deben existir previamente.

## Reglas actuales que conviene recordar

- El número de cuotas corresponde al plazo del crédito.
- El plan mensual calcula capital, intereses sobre saldos y cargos. El manejo de cuenta es Q25 por cuota; los seguros se indican al crear el crédito.
- El plan existente no se reemplaza automáticamente ni se modifica cuota por cuota si fue generado como plan automático.
- Se permiten pagos parciales hasta cubrir el saldo de la cuota.
- El código de transacción y el comprobante se generan al guardar en SQL Server. La referencia bancaria debe corresponder a la operación real; para efectivo no aplica.

## Continuar trabajando

Antes de trabajar en la otra PC, actualiza el código con `git pull`. Guarda y sube tus cambios antes de cambiar de equipo. Git sincroniza el código; los cambios realizados en la base de datos requieren su propia migración o respaldo.

Para retomar consultas, abre esta carpeta en tu asistente y señala `app.js`, `app.py` y `conexion.py`. Este README aporta el contexto básico; el historial de un chat no forma parte del repositorio.
