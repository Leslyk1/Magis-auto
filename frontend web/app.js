
// Esta es la dirección donde está funcionando nuestra API.
const API = "http://127.0.0.1:5000";

// Aquí recordamos qué formularios tienen datos que todavía no se han guardado.
const cambiosFormularios = new WeakMap();
let salidaFormularioAceptada = false;

function esFormularioDeDatos(formulario) {
    return Boolean(formulario && !/^formReporte/.test(formulario.id) && formulario.querySelector('[type="submit"]'));
}

function estadoCambiosFormulario(formulario) {
    if (!cambiosFormularios.has(formulario)) cambiosFormularios.set(formulario, { modificado: false, revision: 0 });
    return cambiosFormularios.get(formulario);
}

function marcarFormularioModificado(formulario) {
    if (!esFormularioDeDatos(formulario)) return;
    const estado = estadoCambiosFormulario(formulario);
    estado.modificado = true;
    estado.revision++;
}

function formularioTieneCambios(formulario) {
    return esFormularioDeDatos(formulario) && Boolean(cambiosFormularios.get(formulario)?.modificado);
}

function formulariosConCambios() {
    return [...document.querySelectorAll("#contenido form")].filter(formularioTieneCambios);
}

// Tomamos una referencia al formulario antes del envío, aunque después se abra otra pantalla.
function capturarFormularioParaGuardar() {
    const formulario = document.querySelector("#contenido form");
    if (!esFormularioDeDatos(formulario)) return null;
    return { formulario, revision: estadoCambiosFormulario(formulario).revision };
}

function confirmarFormularioGuardado(seguimiento) {
    if (!seguimiento) return;
    const estado = estadoCambiosFormulario(seguimiento.formulario);
    // Si se escribió algo más mientras se guardaba, esos cambios nuevos siguen pendientes.
    if (estado.revision === seguimiento.revision) estado.modificado = false;
}

function confirmarSalidaFormulario(formularios = formulariosConCambios()) {
    if (salidaFormularioAceptada || !formularios.length) return true;
    if (!confirm("Tienes cambios sin guardar. Si sales de este formulario, se perderán. ¿Quieres salir?")) return false;
    // El clic y la función del menú pueden comprobar lo mismo. Preguntamos solo una vez por clic.
    salidaFormularioAceptada = true;
    queueMicrotask(() => { salidaFormularioAceptada = false; });
    return true;
}

function prepararAvisosFormulario() {
    const alEscribir = event => {
        const campo = event.target.closest?.("input,select,textarea");
        if (campo?.closest("#contenido")) marcarFormularioModificado(campo.closest("form"));
    };
    document.addEventListener("input", alEscribir, true);
    document.addEventListener("change", alEscribir, true);
    document.addEventListener("click", event => {
        const boton = event.target.closest?.("button,a");
        if (!boton || boton.disabled) return;
        const accion = boton.getAttribute("onclick") || "";
        const menu = boton.matches("[data-module],a.brand");
        const volver = boton.closest("#contenido") && ((boton.classList.contains("boton-cancelar") && !/^reintentar/.test(boton.id))
            || /\b(?:abrirModulo|mostrarInicio|cargar\w*|mostrarFormulario\w*|editar\w*|mostrarFichaCliente|mostrarFichaCredito|mostrarComprobantePago|mostrarAlertasVencimiento|mostrarRespaldosCredito)\s*\(/.test(accion));
        if ((menu || volver) && !confirmarSalidaFormulario()) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    // Algunas pantallas tienen dos formularios. Guardar uno no debe borrar el borrador del otro sin avisar.
    document.addEventListener("submit", event => {
        const otros = formulariosConCambios().filter(formulario => formulario !== event.target);
        if (otros.length && !confirmarSalidaFormulario(otros)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    window.addEventListener("beforeunload", event => {
        if (!formulariosConCambios().length) return;
        event.preventDefault();
        // En recargar o cerrar, el navegador muestra su propio mensaje de confirmación.
        event.returnValue = "";
    });
}

// Bloqueamos el formulario mientras se envía, para no guardar dos veces por doble clic.
function protegerEnvioFormulario(guardar) {
    return async function (event, ...argumentos) {
        event.preventDefault();
        const formulario = event.currentTarget?.tagName === "FORM" ? event.currentTarget
            : event.target?.closest?.("form") || document.querySelector("#contenido form");
        if (!formulario || formulario.enviandoDatos) return;
        const boton = formulario.querySelector('[type="submit"]');
        if (!boton || boton.disabled || !formulario.reportValidity()) return;
        const controles = [...formulario.querySelectorAll("input,select,textarea,button")].map(campo => [campo, campo.disabled]);
        const texto = boton.textContent;
        const ocupado = formulario.getAttribute("aria-busy");
        formulario.enviandoDatos = true;
        formulario.setAttribute("aria-busy", "true");
        controles.forEach(([campo]) => { campo.disabled = true; });
        boton.textContent = "Guardando…";
        try {
            return await guardar(event, ...argumentos);
        } finally {
            // Si falla, dejamos los mismos datos y el botón listo para volver a intentar.
            formulario.enviandoDatos = false;
            controles.forEach(([campo, disabled]) => { campo.disabled = disabled; });
            boton.textContent = texto;
            if (ocupado === null) formulario.removeAttribute("aria-busy");
            else formulario.setAttribute("aria-busy", ocupado);
        }
    };
}

// Aquí revisamos qué opción del menú se escogió y abrimos esa pantalla.
function abrirModulo(modulo) {
    if (modulo === "clientes") {
        cargarClientes();
        return;
    }
    if (modulo === "creditos") {
        cargarCreditos();
        return;
    }
    if (modulo === "vehiculos") {
        cargarVehiculos();
        return;
    }
    if (modulo === "garantias") {
        cargarGarantias();
        return;
    }
    if (modulo === "pagos") {
        cargarPagos();
        return;
    }
    if (modulo === "cuotas") {
        cargarCuotas();
        return;
    }
    if (modulo === "vendedores") {
        cargarVendedores();
        return;
    }
    if (modulo === "deudores") {
        cargarDeudores();
        return;
    }
    if (modulo === "fiadores") {
        cargarFiadores();
        return;
    }
    if (modulo === "referencias") {
        cargarReferencias();
        return;
    }
    if (modulo === "catalogos") {
        cargarCatalogos();
        return;
    }
    if (modulo === "reportes") {
        cargarReportes();
        return;
    }
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>${ modulo.toUpperCase() }</h2>

        <p>
            Módulo seleccionado: ${ modulo }
        </p>
    `;
}


// Clientes
// Pedimos los clientes a la API y los mostramos en la tabla.
async function cargarClientes() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Clientes</h2>
        <p>Cargando clientes...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/personas`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los clientes");
        }
        const personas = await respuesta.json();
        let filas = "";
        personas.forEach(persona => {
            filas += `
        <tr>
            <td style="white-space:normal">
                <strong>${ magisEscape(nombreCompletoGestion(persona)) }</strong>
                <small class="cell-sub">Código: ${ magisEscape(persona.codigo_persona) }</small>
            </td>
            <td>
                <span>DPI: ${ magisEscape(persona.dpi || "Sin DPI") }</span>
                <small class="cell-sub">NIT: ${ magisEscape(persona.nit || "Sin NIT") }</small>
            </td>
            <td style="white-space:normal;overflow-wrap:anywhere">${ magisEscape(persona.correo_electronico || "Sin correo") }</td>

            <td>
                <button class="boton-editar" onclick="mostrarFichaCliente(${ persona.codigo_persona })">Ver ficha</button>
                <button
                    class="boton-editar"
                    onclick="editarCliente(${ persona.codigo_persona })">
                    Editar
                </button>

                <button
                    class="boton-eliminar"
                    onclick="eliminarCliente(${ persona.codigo_persona })">
                    Eliminar
                </button>
            </td>
        </tr>
    `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">
                <div>
                    <h2>Clientes</h2>
                    <p>Personas registradas en MAGIS-AUTO.</p>
                </div>

                <button class="boton-nuevo" onclick="mostrarFormularioCliente()">
                    + Nuevo cliente
                </button>
            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Identificación</th>
                            <th>Correo</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
        agregarFiltrosListado("clientes");
    } catch (error) {
        contenido.innerHTML = `
            <h2>Clientes</h2>

            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>

            <p>
                Verifica que Flask esté ejecutándose en
                http://127.0.0.1:5000
            </p>
        `;
        console.error(error);
    }
}


// Este es el formulario separado de teléfono. En Clientes ahora usamos el formulario que reúne todos los datos.
async function mostrarFormularioTelefono(codigoPersona, telefono = null) {
    document.getElementById("contenido").innerHTML = `
        <h2>${ telefono ? "Editar" : "Registrar" } teléfono</h2>
        <form id="formTelefono" class="formulario">
            <div class="campo">
                <label for="telefono_codigo_persona">Código de persona</label>
                <input type="number" id="telefono_codigo_persona" value="${ Number(codigoPersona) }" disabled>
            </div>
            <div class="campo">
                <label for="telefono_correlativo">Correlativo</label>
                <input type="number" id="telefono_correlativo" step="1" required ${ telefono ? "disabled" : "" }>
                <small>Identificador único del teléfono.</small>
            </div>
            <div class="campo">
                <label for="telefono_numero">Número de teléfono</label>
                <input type="tel" id="telefono_numero" required>
            </div>
            <div class="campo">
                <label for="telefono_tipo">Tipo de teléfono</label>
                <select id="telefono_tipo" required disabled><option value="">Cargando tipos...</option></select>
            </div>
            <div class="acciones-formulario">
                <button type="button" class="boton-cancelar" onclick="cargarTelefonos(${ Number(codigoPersona) })">Cancelar</button>
                <button type="submit" class="boton-guardar" disabled>Guardar teléfono</button>
            </div>
        </form>
    `;
    if (telefono) {
        document.getElementById("telefono_correlativo").value = telefono.correlativo;
        document.getElementById("telefono_numero").value = telefono.numero ?? "";
    }
    const formulario = document.getElementById("formTelefono");
    formulario.addEventListener("submit", event => telefono
        ? actualizarTelefono(event, telefono.correlativo, codigoPersona)
        : registrarTelefono(event, codigoPersona));
    await cargarOpcionesContacto("telefono", formulario, telefono);
}

async function registrarTelefono(event, codigoPersona) {
    return guardarContacto(event, "telefono", codigoPersona);
}

async function mostrarFormularioDireccion(codigoPersona, direccion = null) {
    document.getElementById("contenido").innerHTML = `
        <h2>${ direccion ? "Editar" : "Registrar" } dirección</h2>
        <form id="formDireccion" class="formulario">
            <div class="campo">
                <label for="direccion_codigo_persona">Código de persona</label>
                <input type="number" id="direccion_codigo_persona" value="${ Number(codigoPersona) }" disabled>
            </div>
            <div class="campo">
                <label for="direccion_correlativo">Correlativo</label>
                <input type="number" id="direccion_correlativo" step="1" required ${ direccion ? "disabled" : "" }>
                <small>Identificador único de la dirección.</small>
            </div>
            <div class="campo">
                <label for="direccion_calle">Calle</label>
                <input type="text" id="direccion_calle" required>
            </div>
            <div class="campo">
                <label for="direccion_avenida">Avenida</label>
                <input type="text" id="direccion_avenida" required>
            </div>
            <div class="campo">
                <label for="direccion_zona">Zona</label>
                <input type="number" id="direccion_zona" required>
            </div>
            <div class="campo">
                <label for="direccion_departamento">Departamento</label>
                <select id="direccion_departamento" required disabled><option value="">Cargando departamentos...</option></select>
            </div>
            <div class="campo">
                <label for="direccion_municipio">Municipio</label>
                <select id="direccion_municipio" required disabled><option value="">Seleccione primero un departamento</option></select>
            </div>
            <div class="campo">
                <label for="direccion_tipo">Tipo de dirección</label>
                <select id="direccion_tipo" required disabled><option value="">Cargando tipos...</option></select>
            </div>
            <div class="acciones-formulario">
                <button type="button" class="boton-cancelar" onclick="cargarDirecciones(${ Number(codigoPersona) })">Cancelar</button>
                <button type="submit" class="boton-guardar" disabled>Guardar dirección</button>
            </div>
        </form>
    `;
    if (direccion) {
        for (const campo of ["correlativo", "calle", "avenida", "zona"]) {
            document.getElementById(`direccion_${ campo }`).value = direccion[campo] ?? "";
        }
    }
    const formulario = document.getElementById("formDireccion");
    formulario.addEventListener("submit", event => direccion
        ? actualizarDireccion(event, direccion.correlativo, codigoPersona)
        : registrarDireccion(event, codigoPersona));
    await cargarOpcionesContacto("direccion", formulario, direccion);
}

async function registrarDireccion(event, codigoPersona) {
    return guardarContacto(event, "direccion", codigoPersona);
}

function actualizarTelefono(event, correlativo, codigoPersona) {
    return guardarContacto(event, "telefono", codigoPersona, correlativo);
}

function actualizarDireccion(event, correlativo, codigoPersona) {
    return guardarContacto(event, "direccion", codigoPersona, correlativo);
}

// Aquí mandamos un teléfono o una dirección a la API para guardarlo o cambiarlo.
async function guardarContacto(event, tipo, codigoPersona, correlativo = null) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const formulario = document.getElementById(tipo === "telefono" ? "formTelefono" : "formDireccion");
    const boton = formulario.querySelector('[type="submit"]');
    if (boton.disabled || !formulario.reportValidity()) return;
    const valor = campo => formulario.querySelector(`#${ tipo }_${ campo }`).value.trim();
    const datos = {
        correlativo: correlativo ?? Number(valor("correlativo")),
        codigo_persona: Number(codigoPersona)
    };
    if (tipo === "telefono") {
        datos.numero = valor("numero");
        datos.codigo_tipo_telefono = Number(valor("tipo"));
    } else {
        datos.calle = valor("calle");
        datos.avenida = valor("avenida");
        datos.zona = Number(valor("zona"));
        datos.codigo_departamento = Number(valor("departamento"));
        datos.codigo_municipio = Number(valor("municipio"));
        datos.codigo_tipo_direccion = Number(valor("tipo"));
    }
    boton.disabled = true;
    const editando = correlativo !== null;
    const nombre = tipo === "telefono" ? "teléfono" : "dirección";
    try {
        const ruta = tipo === "telefono" ? "telefonos" : "direcciones";
        const respuesta = await fetch(`${ API }/${ ruta }${ editando ? `/${ correlativo }` : "" }`, {
            method: editando ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || resultado.mensaje || `No se pudo guardar ${ nombre }`);
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert(`${ tipo === "telefono" ? "Teléfono" : "Dirección" } guardado correctamente`);
        if (document.getElementById(formulario.id) === formulario) {
            await cargarContactosCliente(tipo, codigoPersona);
        }
    } catch (error) {
        console.error(error);
        alert(`No fue posible guardar ${ nombre }. Verifica la conexión con la API.`);
    } finally {
        boton.disabled = false;
    }
}

async function consultarDatosContacto(ruta) {
    const respuesta = await fetch(`${ API }/${ ruta }`);
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || datos.mensaje || "No fue posible consultar los datos");
    return datos;
}

// Pedimos varias listas a la API y avisamos si alguna no se pudo cargar.
async function consultarListasContacto(rutas) {
    const resultados = await Promise.allSettled(rutas.map(async ruta => {
        const datos = await consultarDatosContacto(ruta);
        if (!Array.isArray(datos)) throw new Error(`Lista inválida: ${ ruta }`);
        return datos;
    }));
    const fallo = resultados.find(resultado => resultado.status === "rejected");
    if (fallo) throw fallo.reason;
    return resultados.map(resultado => resultado.value);
}

// Llenamos la lista de opciones. Mostramos el nombre, pero guardamos su código.
function opcionesContacto(selector, datos, campo, actual = "") {
    selector.innerHTML = '<option value="">Seleccione</option>' + datos.map(dato =>
        `<option value="${ magisEscape(dato[campo]) }">${ magisEscape(dato.descripcion ?? dato[campo]) }</option>`
    ).join("");
    selector.value = String(actual ?? "");
    selector.disabled = datos.length === 0;
}

// Cargamos los tipos y lugares que necesitamos para llenar los datos de contacto.
async function cargarOpcionesContacto(tipo, formulario, registro) {
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    estado.textContent = "Cargando opciones...";
    formulario.prepend(estado);
    const boton = formulario.querySelector('[type="submit"]');
    const direccion = tipo === "direccion";
    try {
        const [tipos, departamentos, municipios] = await consultarListasContacto(direccion
            ? ["tipos-direccion", "departamentos", "municipios"] : ["tipos-telefono"]);
        if (document.getElementById(formulario.id) !== formulario) return;
        const selectorTipo = formulario.querySelector(`#${ tipo }_tipo`);
        const campoTipo = direccion ? "codigo_tipo_direccion" : "codigo_tipo_telefono";
        opcionesContacto(selectorTipo, tipos, campoTipo, registro?.[campoTipo]);
        const avisos = [];
        if (!tipos.length) avisos.push("Registra primero un tipo en Catálogos.");
        if (registro && !tipos.some(dato => String(dato[campoTipo]) === String(registro[campoTipo]))) {
            avisos.push("El tipo anterior ya no está disponible. Selecciona otro.");
        }
        if (!direccion) {
            boton.disabled = !tipos.length;
            estado.textContent = avisos.join(" ") || "Selecciona el tipo de teléfono.";
            return;
        }
        const departamento = formulario.querySelector("#direccion_departamento");
        const municipio = formulario.querySelector("#direccion_municipio");
        opcionesContacto(departamento, departamentos, "codigo_departamento", registro?.codigo_departamento);
        if (!departamentos.length) avisos.push("Registra primero un departamento en Catálogos.");
        if (registro && !departamentos.some(dato => String(dato.codigo_departamento) === String(registro.codigo_departamento))) {
            avisos.push("El departamento anterior ya no está disponible. Selecciona otro.");
        }
        const filtrarMunicipios = (actual = "") => {
            const disponibles = departamento.value ? municipios.filter(dato =>
                String(dato.codigo_departamento) === departamento.value) : [];
            opcionesContacto(municipio, disponibles, "codigo_municipio", actual);
            const mensajes = [...avisos];
            if (!departamento.value) mensajes.push("Selecciona primero un departamento.");
            else if (!disponibles.length) mensajes.push("El departamento seleccionado no tiene municipios registrados.");
            else if (actual !== "" && !disponibles.some(dato => String(dato.codigo_municipio) === String(actual))) {
                mensajes.push("El municipio anterior ya no está disponible en este departamento. Selecciona otro.");
            }
            boton.disabled = !tipos.length || !departamentos.length || !disponibles.length;
            estado.textContent = mensajes.join(" ") || "Selecciona el tipo, departamento y municipio.";
        };
        departamento.addEventListener("change", () => filtrarMunicipios());
        filtrarMunicipios(registro?.codigo_municipio ?? "");
    } catch (error) {
        if (document.getElementById(formulario.id) !== formulario) return;
        console.error(error);
        estado.className = "mensaje-error";
        estado.textContent = "No fue posible cargar las opciones. Vuelve al listado e intenta nuevamente.";
    }
}

function cargarTelefonos(codigoPersona) {
    return cargarContactosCliente("telefono", codigoPersona);
}

function cargarDirecciones(codigoPersona) {
    return cargarContactosCliente("direccion", codigoPersona);
}

// Mostramos solamente los teléfonos o direcciones del cliente que escogimos.
async function cargarContactosCliente(tipo, codigoPersona) {
    const telefono = tipo === "telefono";
    const titulo = telefono ? "Teléfonos" : "Direcciones";
    const ruta = telefono ? "telefonos" : "direcciones";
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <div class="encabezado-modulo">
            <div><h2>${ titulo }</h2><p>Cliente: ${ Number(codigoPersona) }</p></div>
            <button class="boton-nuevo" onclick="${ telefono ? "mostrarFormularioTelefono" : "mostrarFormularioDireccion" }(${ Number(codigoPersona) })">+ ${ telefono ? "Nuevo teléfono" : "Nueva dirección" }</button>
        </div>
        <button class="boton-cancelar" onclick="cargarClientes()">Volver a Clientes</button>
        <div id="listaContactosCliente" aria-live="polite"><p>Cargando ${ titulo.toLowerCase() }...</p></div>
    `;
    const lista = document.getElementById("listaContactosCliente");
    try {
        const [registros, tipos, departamentos = [], municipios = []] = await consultarListasContacto(telefono
            ? [ruta, "tipos-telefono"] : [ruta, "tipos-direccion", "departamentos", "municipios"]);
        if (document.getElementById("listaContactosCliente") !== lista) return;
        const propios = registros.filter(dato => String(dato.codigo_persona) === String(codigoPersona));
        if (!propios.length) {
            lista.innerHTML = `<p>No hay ${ titulo.toLowerCase() } registrados para este cliente.</p>`;
            return;
        }
        const descripcion = (datos, campo, valor) => datos.find(dato => String(dato[campo]) === String(valor))?.descripcion ?? valor ?? "";
        const campoTipo = telefono ? "codigo_tipo_telefono" : "codigo_tipo_direccion";
        lista.innerHTML = `<div class="tabla-contenedor"><table>
            <thead><tr><th>Correlativo</th>${ telefono ? "<th>Número</th>" : "<th>Calle</th><th>Avenida</th><th>Zona</th><th>Departamento</th><th>Municipio</th>" }<th>Tipo</th><th>Acciones</th></tr></thead>
            <tbody>${ propios.map(dato => `<tr>
                <td>${ magisEscape(dato.correlativo) }</td>
                ${ telefono ? `<td>${ magisEscape(dato.numero) }</td>` : `
                    <td>${ magisEscape(dato.calle) }</td><td>${ magisEscape(dato.avenida) }</td><td>${ magisEscape(dato.zona) }</td>
                    <td>${ magisEscape(descripcion(departamentos, "codigo_departamento", dato.codigo_departamento)) }</td>
                    <td>${ magisEscape(descripcion(municipios, "codigo_municipio", dato.codigo_municipio)) }</td>` }
                <td>${ magisEscape(descripcion(tipos, campoTipo, dato[campoTipo])) }</td>
                <td>
                    <button class="boton-editar" onclick="${ telefono ? "editarTelefono" : "editarDireccion" }(${ Number(dato.correlativo) }, ${ Number(codigoPersona) })">Editar</button>
                    <button class="boton-eliminar" onclick="${ telefono ? "eliminarTelefono" : "eliminarDireccion" }(${ Number(dato.correlativo) }, ${ Number(codigoPersona) }, this)">Eliminar</button>
                </td>
            </tr>`).join("") }</tbody>
        </table></div>`;
    } catch (error) {
        if (document.getElementById("listaContactosCliente") !== lista) return;
        console.error(error);
        lista.innerHTML = '<p class="mensaje-error">No fue posible cargar los datos. Vuelve a Clientes e intenta nuevamente.</p>';
    }
}

function editarTelefono(correlativo, codigoPersona) {
    return editarContactoCliente("telefono", correlativo, codigoPersona);
}

function editarDireccion(correlativo, codigoPersona) {
    return editarContactoCliente("direccion", correlativo, codigoPersona);
}

// Antes de editar, revisamos que el contacto sea de este cliente.
async function editarContactoCliente(tipo, correlativo, codigoPersona) {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = '<p id="cargaContactoCliente" role="status">Cargando registro...</p>';
    const carga = document.getElementById("cargaContactoCliente");
    try {
        const registro = await consultarDatosContacto(`${ tipo === "telefono" ? "telefonos" : "direcciones" }/${ correlativo }`);
        if (document.getElementById("cargaContactoCliente") !== carga) return;
        if (String(registro.codigo_persona) !== String(codigoPersona)) throw new Error("El registro no pertenece al cliente seleccionado");
        await (tipo === "telefono" ? mostrarFormularioTelefono(codigoPersona, registro) : mostrarFormularioDireccion(codigoPersona, registro));
    } catch (error) {
        if (document.getElementById("cargaContactoCliente") !== carga) return;
        alert(error.message);
        await cargarContactosCliente(tipo, codigoPersona);
    }
}

function eliminarTelefono(correlativo, codigoPersona, boton) {
    return eliminarContactoCliente("telefono", correlativo, codigoPersona, boton);
}

function eliminarDireccion(correlativo, codigoPersona, boton) {
    return eliminarContactoCliente("direccion", correlativo, codigoPersona, boton);
}

// Preguntamos si se quiere borrar el contacto y después mandamos la solicitud.
async function eliminarContactoCliente(tipo, correlativo, codigoPersona, boton) {
    if (boton?.disabled) return;
    const nombre = tipo === "telefono" ? "teléfono" : "dirección";
    if (!confirm(`¿Seguro que deseas eliminar ${ nombre } ${ correlativo } del cliente ${ codigoPersona }?`)) return;
    if (boton) boton.disabled = true;
    const lista = document.getElementById("listaContactosCliente");
    try {
        const ruta = `${ tipo === "telefono" ? "telefonos" : "direcciones" }/${ correlativo }`;
        const registro = await consultarDatosContacto(ruta);
        if (String(registro.codigo_persona) !== String(codigoPersona)) throw new Error("El registro no pertenece al cliente seleccionado");
        const respuesta = await fetch(`${ API }/${ ruta }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) throw new Error(resultado.error || resultado.mensaje || `No se pudo eliminar ${ nombre }`);
        alert(`${ tipo === "telefono" ? "Teléfono" : "Dirección" } eliminado correctamente`);
        if (document.getElementById("listaContactosCliente") === lista) await cargarContactosCliente(tipo, codigoPersona);
    } catch (error) {
        console.error(error);
        alert(error.message || `No fue posible eliminar ${ nombre }`);
    } finally {
        if (boton) boton.disabled = false;
    }
}

// Aquí armamos el formulario con los datos del cliente, sus teléfonos y direcciones.
// Si estamos editando, llenamos los campos con lo que ya tenía guardado.
async function renderizarClienteCompleto(datos = null) {
    const editando = datos !== null;
    const persona = datos?.persona || {};
    const campos = [
        ["codigo_persona", "Código de persona", "number", true],
        ["primer_nombre", "Primer nombre", "text", true], ["segundo_nombre", "Segundo nombre", "text"],
        ["primer_apellido", "Primer apellido", "text", true], ["segundo_apellido", "Segundo apellido", "text"],
        ["correo_electronico", "Correo electrónico", "email"], ["dpi", "DPI", "text"], ["no_pasaporte", "Pasaporte", "text"],
        ["fecha_nacimiento", "Fecha de nacimiento", "date"], ["nit", "NIT", "text"]
    ];
    const id = editando ? "formEditarCliente" : "formCliente";
    document.getElementById("contenido").innerHTML = `<h2>${ editando ? "Editar cliente" : "Nuevo cliente" }</h2>
        <form id="${ id }" class="formulario" novalidate>
            ${ campos.map(([campo, etiqueta, tipo, obligatorio]) => `<div class="campo"><label for="${ campo }">${ etiqueta }</label>
                <input id="${ campo }" type="${ tipo }" ${ obligatorio ? "required" : "" } ${ campo === "codigo_persona" ? 'min="1" step="1"' : "" }
                ${ editando && campo === "codigo_persona" ? "disabled" : "" }></div>`).join("") }
            <div class="campo"><label for="genero">Género</label><select id="genero"><option value="">Seleccione</option><option value="H">Hombre</option><option value="M">Mujer</option></select></div>
            <div class="campo" style="grid-column:1/-1"><h3>Teléfonos</h3><p>Agrega los teléfonos del cliente. Puedes dejar esta sección vacía.</p>
                <div id="telefonosCliente"></div><button type="button" class="boton-nuevo" id="agregarTelefonoCliente" disabled>+ Agregar teléfono</button></div>
            <div class="campo" style="grid-column:1/-1"><h3>Direcciones</h3><p>Selecciona el departamento y después su municipio.</p>
                <div id="direccionesCliente"></div><button type="button" class="boton-nuevo" id="agregarDireccionCliente" disabled>+ Agregar dirección</button></div>
            <div class="campo" style="grid-column:1/-1"><p id="estadoClienteCompleto" role="status">Cargando opciones de contactos...</p>
                <button type="button" class="boton-cancelar" id="reintentarCatalogosCliente" hidden>Reintentar cargar opciones</button></div>
            <div class="acciones-formulario"><button type="button" class="boton-cancelar" onclick="cargarClientes()">Cancelar</button>
                <button type="submit" class="boton-guardar" disabled>${ editando ? "Guardar cambios" : "Guardar cliente y contactos" }</button></div>
        </form>`;
    const formulario = document.getElementById(id);
    prepararPasosCliente(formulario);
    for (const [campo] of campos) {
        formulario.querySelector(`#${ campo }`).value = campo === "fecha_nacimiento" ? formatearFecha(persona[campo]) : persona[campo] ?? "";
    }
    formulario.querySelector("#genero").value = persona.genero ?? "";
    formulario.contadorContactos = 0;
    formulario.clienteListo = false;
    formulario.addEventListener("submit", editando ? event => actualizarCliente(event, persona.codigo_persona) : registrarCliente);
    const cargar = async () => {
        const reintentar = formulario.querySelector("#reintentarCatalogosCliente");
        const estado = formulario.querySelector("#estadoClienteCompleto");
        reintentar.hidden = true;
        estado.className = "";
        estado.textContent = "Cargando opciones de contactos...";
        try {
            const [telefonos, direcciones, departamentos, municipios] = await listasGestion(["tipos-telefono", "tipos-direccion", "departamentos", "municipios"]);
            if (!formulario.isConnected) return;
            formulario.catalogosCliente = { telefonos, direcciones, departamentos, municipios };
            for (const registro of datos?.telefonos || []) agregarContactoCliente(formulario, "telefono", registro);
            for (const registro of datos?.direcciones || []) agregarContactoCliente(formulario, "direccion", registro);
            formulario.querySelector("#agregarTelefonoCliente").disabled = false;
            formulario.querySelector("#agregarDireccionCliente").disabled = false;
            formulario.clienteListo = true;
            formulario.querySelector('[type="submit"]').disabled = false;
            estado.textContent = "Los datos personales y contactos se guardarán juntos. Quitar un contacto existente se aplicará al guardar cambios.";
        } catch (error) {
            if (!formulario.isConnected) return;
            estado.className = "mensaje-error";
            estado.textContent = error.message;
            reintentar.hidden = false;
        }
    };
    formulario.querySelector("#agregarTelefonoCliente").addEventListener("click", () => agregarContactoCliente(formulario, "telefono"));
    formulario.querySelector("#agregarDireccionCliente").addEventListener("click", () => agregarContactoCliente(formulario, "direccion"));
    formulario.querySelector("#reintentarCatalogosCliente").addEventListener("click", cargar);
    await cargar();
}

// Mostramos una sección a la vez. Avanzar conserva los datos, pero todavía no los manda a la API.
function prepararPasosCliente(formulario) {
    const telefono = formulario.querySelector("#telefonosCliente").parentElement;
    const direccion = formulario.querySelector("#direccionesCliente").parentElement;
    const personales = [...formulario.children].filter(elemento => elemento.classList.contains("campo") &&
        elemento !== telefono && elemento !== direccion && !elemento.querySelector("#estadoClienteCompleto"));
    const secciones = [personales, [telefono], [direccion]];
    const titulos = ["Datos personales", "Teléfonos", "Direcciones"];
    const indicador = document.createElement("div");
    indicador.className = "campo";
    indicador.style.gridColumn = "1/-1";
    indicador.setAttribute("role", "status");
    indicador.setAttribute("tabindex", "-1");
    formulario.prepend(indicador);
    const acciones = formulario.querySelector(".acciones-formulario");
    const guardar = acciones.querySelector('[type="submit"]');
    const anterior = document.createElement("button");
    anterior.type = "button";
    anterior.className = "boton-cancelar";
    anterior.textContent = "Anterior";
    const siguiente = document.createElement("button");
    siguiente.type = "button";
    siguiente.className = "boton-guardar";
    acciones.insertBefore(anterior, guardar);
    acciones.insertBefore(siguiente, guardar);
    formulario.pasoCliente = 0;
    const mostrar = (paso, enfocar = true) => {
        formulario.pasoCliente = paso;
        secciones.forEach((elementos, indice) => elementos.forEach(elemento => {
            elemento.hidden = indice !== paso;
            // .campo usa display:flex; aplicamos display:none para ocultarlo también con ese estilo.
            elemento.style.display = indice === paso ? "" : "none";
        }));
        indicador.textContent = `Paso ${ paso + 1 } de 3: ${ titulos[paso] }. Los datos se guardarán al finalizar.`;
        anterior.hidden = paso === 0;
        anterior.style.display = paso === 0 ? "none" : "";
        siguiente.hidden = paso === 2;
        siguiente.style.display = paso === 2 ? "none" : "";
        siguiente.textContent = paso === 0 ? "Continuar a teléfonos" : "Confirmar teléfonos y continuar";
        guardar.hidden = paso !== 2;
        guardar.style.display = paso === 2 ? "" : "none";
        if (enfocar) {
            indicador.focus({ preventScroll: true });
            indicador.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    };
    const avanzar = () => {
        if (formulario.guardandoCliente || formulario.pasoCliente === 2) return;
        const actuales = secciones[formulario.pasoCliente];
        for (const elemento of actuales) {
            elemento.querySelectorAll("[data-contacto]").forEach(actualizarRequisitosContacto);
            for (const campo of elemento.querySelectorAll("input,select,textarea")) {
                if (!campo.disabled && !campo.reportValidity()) return;
            }
        }
        mostrar(formulario.pasoCliente + 1);
    };
    anterior.addEventListener("click", () => {
        if (!formulario.guardandoCliente) mostrar(Math.max(0, formulario.pasoCliente - 1));
    });
    siguiente.addEventListener("click", avanzar);
    // Enter avanza de sección; solo el último paso permite guardar.
    formulario.addEventListener("submit", event => {
        if (formulario.pasoCliente !== 2) {
            event.preventDefault();
            event.stopImmediatePropagation();
            avanzar();
        }
    }, true);
    // Si al guardar hay un campo inválido en otra sección, lo mostramos para poder corregirlo.
    formulario.addEventListener("invalid", event => {
        const paso = secciones.findIndex(elementos => elementos.some(elemento => elemento.contains(event.target)));
        if (paso >= 0 && paso !== formulario.pasoCliente) mostrar(paso);
    }, true);
    mostrar(0, false);
}

// Agregamos otro espacio para escribir un teléfono o una dirección.
// Todavía no se guarda: solo estamos agregando campos al formulario.
function agregarContactoCliente(formulario, tipo, registro = null) {
    if (formulario.guardandoCliente) return;
    const catalogos = formulario.catalogosCliente;
    const indice = ++formulario.contadorContactos;
    const grupo = document.createElement("fieldset");
    grupo.className = "formulario";
    grupo.dataset.contacto = tipo;
    if (registro) grupo.dataset.correlativo = String(registro.correlativo);
    const campos = tipo === "telefono" ? [["numero", "Número de teléfono", "tel"], ["codigo_tipo_telefono", "Tipo de teléfono", "select"]] : [
        ["calle", "Calle", "text"], ["avenida", "Avenida", "text"], ["zona", "Zona", "number"],
        ["codigo_departamento", "Departamento", "select"], ["codigo_municipio", "Municipio", "select"], ["codigo_tipo_direccion", "Tipo de dirección", "select"]
    ];
    grupo.innerHTML = `<legend>${ tipo === "telefono" ? "Teléfono" : "Dirección" }</legend>` + campos.map(([campo, etiqueta, control]) => {
        const id = `contacto-${ indice }-${ campo }`;
        return `<div class="campo"><label for="${ id }">${ etiqueta }</label>${ control === "select"
            ? `<select id="${ id }" data-campo="${ campo }"></select>`
            : `<input id="${ id }" data-campo="${ campo }" type="${ control }" ${ campo === "zona" ? 'min="0" step="1"' : "" }>` }</div>`;
    }).join("") + '<div class="acciones-formulario"><button type="button" class="boton-eliminar">Quitar contacto</button></div><p data-aviso-contacto role="status"></p>';
    const selector = campo => grupo.querySelector(`[data-campo="${ campo }"]`);
    if (tipo === "telefono") {
        opcionesContacto(selector("codigo_tipo_telefono"), catalogos.telefonos, "codigo_tipo_telefono", registro?.codigo_tipo_telefono);
    } else {
        opcionesContacto(selector("codigo_tipo_direccion"), catalogos.direcciones, "codigo_tipo_direccion", registro?.codigo_tipo_direccion);
        const departamento = selector("codigo_departamento");
        const municipio = selector("codigo_municipio");
        opcionesContacto(departamento, catalogos.departamentos, "codigo_departamento", registro?.codigo_departamento);
        const filtrar = (actual = "") => {
            const disponibles = catalogos.municipios.filter(m => String(m.codigo_departamento) === departamento.value);
            opcionesContacto(municipio, disponibles, "codigo_municipio", actual);
            grupo.querySelector("[data-aviso-contacto]").textContent = !departamento.value ? "Selecciona primero un departamento." : !disponibles.length
                ? "No hay municipios registrados para este departamento." : actual !== "" && !municipio.value
                    ? "El municipio anterior no corresponde a este departamento. Selecciona el municipio correcto." : "";
            actualizarRequisitosContacto(grupo);
        };
        departamento.addEventListener("change", () => filtrar());
        filtrar(registro?.codigo_municipio ?? "");
    }
    for (const [campo, , control] of campos) {
        if (control !== "select") selector(campo).value = registro?.[campo] ?? "";
    }
    const tipoCampo = tipo === "telefono" ? "codigo_tipo_telefono" : "codigo_tipo_direccion";
    if (selector(tipoCampo).disabled) grupo.querySelector("[data-aviso-contacto]").textContent = "No hay tipos disponibles. Regístralos en Catálogos antes de completar este contacto.";
    grupo.addEventListener("input", () => actualizarRequisitosContacto(grupo));
    grupo.addEventListener("change", () => actualizarRequisitosContacto(grupo));
    grupo.querySelector("button").addEventListener("click", () => {
        if (formulario.guardandoCliente) return;
        if (registro && !confirm("Este contacto se eliminará cuando guardes los cambios. ¿Deseas quitarlo del formulario?")) return;
        // Quitamos este espacio del formulario. El contacto se borra de la base hasta que guardemos los cambios.
        grupo.remove();
        marcarFormularioModificado(formulario);
    });
    actualizarRequisitosContacto(grupo);
    formulario.querySelector(tipo === "telefono" ? "#telefonosCliente" : "#direccionesCliente").append(grupo);
    if (!registro) marcarFormularioModificado(formulario);
}

// Si empezamos a llenar un contacto, hay que completarlo. Si es nuevo y está vacío, lo podemos dejar así.
function actualizarRequisitosContacto(grupo) {
    const campos = [...grupo.querySelectorAll("[data-campo]")];
    const usado = Boolean(grupo.dataset.correlativo) || campos.some(campo => campo.value.trim() !== "");
    campos.forEach(campo => { campo.required = usado; });
    return usado;
}

// Aquí tomamos lo que se escribió y lo juntamos en el objeto datos.
// El teléfono queda como texto para conservar los ceros del inicio.
function recogerClienteCompleto(formulario, codigoPersona = null) {
    const valor = id => formulario.querySelector(`#${ id }`).value.trim();
    const datos = { codigo_persona: codigoPersona ?? Number(valor("codigo_persona")), telefonos: [], direcciones: [] };
    for (const campo of ["primer_nombre", "segundo_nombre", "primer_apellido", "segundo_apellido", "correo_electronico", "dpi", "no_pasaporte", "fecha_nacimiento", "nit", "genero"]) datos[campo] = valor(campo);
    for (const grupo of formulario.querySelectorAll("[data-contacto]")) {
        if (!actualizarRequisitosContacto(grupo)) continue;
        const registro = {};
        if (grupo.dataset.correlativo) registro.correlativo = Number(grupo.dataset.correlativo);
        for (const campo of grupo.querySelectorAll("[data-campo]")) {
            if (campo.value.trim() === "" || campo.disabled) throw new Error("Completa todos los campos del teléfono o dirección que agregaste, o quita ese contacto del formulario.");
            registro[campo.dataset.campo] = campo.type === "number" || campo.tagName === "SELECT" ? Number(campo.value) : campo.value.trim();
        }
        datos[grupo.dataset.contacto === "telefono" ? "telefonos" : "direcciones"].push(registro);
    }
    return datos;
}

// Esta función se usa al guardar un cliente nuevo o sus cambios.
// Revisa el formulario y manda todos los datos juntos a la API.
async function guardarClienteFormulario(event, idFormulario, codigoPersona = null, alGuardar) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    // Evitamos que la página se recargue al presionar Guardar.
    event.preventDefault();
    const formulario = document.getElementById(idFormulario);
    if (!formulario?.clienteListo || formulario.guardandoCliente) return;
    const estado = formulario.querySelector("#estadoClienteCompleto");
    let datos;
    try {
        datos = recogerClienteCompleto(formulario, codigoPersona);
        if (!formulario.reportValidity()) return;
    } catch (error) {
        estado.className = "mensaje-error";
        estado.textContent = error.message;
        formulario.reportValidity();
        return;
    }
    formulario.guardandoCliente = true;
    // Guardamos cómo estaban los campos y los bloqueamos mientras se guarda.
    const controles = [...formulario.querySelectorAll("input,select,button")].map(campo => [campo, campo.disabled]);
    controles.forEach(([campo]) => { campo.disabled = true; });
    estado.className = "";
    estado.textContent = "Guardando cliente y contactos...";
    try {
        // Usamos POST para un cliente nuevo y PUT para cambiar uno que ya existe.
        // Convertimos datos a JSON para enviarlos. La API guarda el cliente y sus contactos juntos.
        const resultado = await solicitarGestion(codigoPersona === null ? "personas/completo" : `personas/${ codigoPersona }/completo`, {
            method: codigoPersona === null ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos)
        });
        confirmarFormularioGuardado(seguimientoGuardado);
        alert(resultado.mensaje || "Cliente y contactos guardados correctamente");
        // Si ya salimos de esta pantalla, no cambiamos la pantalla nueva.
        if (!formulario.isConnected) return;
        if (typeof alGuardar === "function") await alGuardar(datos.codigo_persona);
        else await cargarClientes();
    } catch (error) {
        if (!formulario.isConnected) return;
        estado.className = "mensaje-error";
        estado.textContent = `${ error.message } Tus datos siguen en el formulario. Verifica el registro antes de volver a guardar si se perdió la conexión.`;
    } finally {
        formulario.guardandoCliente = false;
        controles.forEach(([campo, disabled]) => { campo.disabled = disabled; });
    }
}

// Abrimos el formulario cuando presionamos Nuevo cliente.
function mostrarFormularioCliente() {
    return renderizarClienteCompleto();
}

// Cuando presionamos Guardar, llamamos a la función que envía el cliente y sus contactos.
async function registrarCliente(event, alGuardar) {
    return guardarClienteFormulario(event, "formCliente", null, alGuardar);
}

// Primero mostramos lo que se borraría. Solo lo borramos si la persona confirma.
// La API revisa si se puede borrar todo sin afectar a otros clientes.
async function eliminarCliente(codigoPersona) {
    const vista = crearVistaGestion("Eliminar cliente", "cargarClientes()");
    try {
        const resumen = await solicitarGestion(`personas/${ codigoPersona }/resumen-eliminacion`);
        if (!vista.isConnected) return;
        const etiquetas = { clientes: "Cliente", telefonos: "Teléfonos", direcciones: "Direcciones", deudores: "Deudores",
            vendedores: "Vendedores", referencias: "Referencias", fiadores: "Fiadores", creditos: "Créditos",
            cuotas: "Cuotas", pagos: "Pagos", vinculos_fiadores: "Vínculos con fiadores", vinculos_referencias: "Vínculos con referencias",
            garantias: "Garantías", vehiculos: "Vehículos" };
        const bloqueos = { creditos_como_vendedor: "Créditos de otras personas como vendedor", creditos_como_fiador: "Créditos de otras personas como fiador",
            creditos_como_referencia: "Créditos de otras personas como referencia", pagos_de_otros_creditos: "Pagos de otros créditos vinculados a sus cuotas" };
        const impedimentos = Object.entries(resumen.bloqueos || {}).filter(([, cantidad]) => cantidad > 0);
        vista.innerHTML = `<p>Cliente ${ Number(codigoPersona) }. Esta eliminación es permanente.</p>
            <h3>Registros que se eliminarían</h3>${ tablaGestion(["Registro", "Cantidad"], Object.entries(resumen.conteos).map(([nombre, cantidad]) => [etiquetas[nombre] || nombre, cantidad])) }
            <p>Se conservarán ${ Number(resumen.conservados.garantias) } garantías y ${ Number(resumen.conservados.vehiculos) } vehículos compartidos.</p>
            ${ impedimentos.length ? `<p class="mensaje-error">No se puede eliminar porque afecta operaciones de otras personas.</p>${ tablaGestion(["Relación", "Cantidad"], impedimentos.map(([nombre, cantidad]) => [bloqueos[nombre] || nombre, cantidad])) }` : "" }
            <p>Los datos se comprobarán nuevamente al confirmar.</p>
            ${ resumen.puede_eliminar === true && !impedimentos.length ? '<button type="button" class="boton-eliminar" id="confirmarEliminarCliente">Eliminar cliente y datos asociados</button>' : "" }`;
        vista.querySelector("#confirmarEliminarCliente")?.addEventListener("click", async event => {
            const boton = event.currentTarget;
            if (boton.disabled || !confirm(`Se eliminará permanentemente el cliente ${ codigoPersona } y los registros indicados. ¿Deseas continuar?`)) return;
            boton.disabled = true;
            try {
                const resultado = await solicitarGestion(`personas/${ codigoPersona }`, { method: "DELETE" });
                alert(resultado.mensaje || "Cliente y datos asociados eliminados");
                if (vista.isConnected) await cargarClientes();
            } catch (error) {
                alert(error.message);
                if (vista.isConnected) await eliminarCliente(codigoPersona);
            } finally { boton.disabled = false; }
        });
    } catch (error) {
        mostrarErrorGestion(vista, error);
    }
}


// Buscamos al cliente y sus contactos para mostrarlos en el formulario de edición.
async function editarCliente(codigoPersona) {
    const vista = crearVistaGestion("Editar cliente", "cargarClientes()");
    try {
        const datos = await solicitarGestion(`personas/${ codigoPersona }/completo`);
        if (vista.isConnected) await renderizarClienteCompleto(datos);
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Mandamos los cambios del cliente y los contactos que queremos conservar.
async function actualizarCliente(event, codigoPersona) {
    return guardarClienteFormulario(event, "formEditarCliente", codigoPersona);
}

// Acomodamos la fecha para que se pueda poner en el campo de fecha del formulario.
function formatearFecha(fecha) {
    if (!fecha) {
        return "";
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
        return fecha.substring(0, 10);
    }
    const meses = {
        Jan: "01",
        Feb: "02",
        Mar: "03",
        Apr: "04",
        May: "05",
        Jun: "06",
        Jul: "07",
        Aug: "08",
        Sep: "09",
        Oct: "10",
        Nov: "11",
        Dec: "12"
    };
    const partes = fecha.split(" ");
    if (partes.length >= 4) {
        const dia = partes[1].padStart(2, "0");
        const mes = meses[partes[2]];
        const anio = partes[3];
        if (dia && mes && anio) {
            return `${ anio }-${ mes }-${ dia }`;
        }
    }
    return "";
}



// Créditos
// Traemos los créditos de la API y los ponemos en la tabla.
async function cargarCreditos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos</h2>
        <p>Cargando créditos...</p>
    `;
    try {
        // El crédito guarda códigos de roles; buscamos sus personas para mostrar los nombres completos.
        const [creditos, deudores, vendedores, personas] = await listasGestion(["creditos", "deudores", "vendedores", "personas"]);
        const personasPorCodigo = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
        const deudoresPorCodigo = new Map(deudores.map(deudor => [String(deudor.codigo_deudor), deudor]));
        const vendedoresPorCodigo = new Map(vendedores.map(vendedor => [String(vendedor.codigo_vendedor), vendedor]));
        const nombreDelRol = (rol, nombreAnterior, alternativa) => {
            const persona = rol && personasPorCodigo.get(String(rol.codigo_persona));
            return (persona && nombreCompletoGestion(persona)) || rol?.nombre_persona || nombreAnterior || alternativa;
        };
        let filas = "";
        creditos.forEach(credito => {
            const nombreVendedor = nombreDelRol(vendedoresPorCodigo.get(String(credito.codigo_vendedor)), credito.nombre_vendedor, "Vendedor no disponible");
            const nombreDeudor = nombreDelRol(deudoresPorCodigo.get(String(credito.codigo_deudor)), credito.nombre_deudor, "Deudor no disponible");
            filas += `
                <tr>
                    <td>${ credito.codigo_credito ?? "" }</td>
                    <td>${ credito.numero_credito ?? "" }</td>
                    <td>${ formatearFechaMostrar(credito.fecha_credito) }</td>
                    <td>${ credito.estado ?? "" }</td>
                    <td>${ credito.monto ?? "" }</td>
                    <td>${ credito.plazo ?? "" }</td>
                    <td>${ credito.tasa_intereses ?? "" }</td>
                    <td>${ credito.porcentaje_comision ?? "" }</td>
                    <td>${ credito.nombre_garantia ?? credito.codigo_garantia ?? "" }</td>
                    <td style="white-space:normal">${ magisEscape(nombreVendedor) }</td>
                    <td style="white-space:normal">${ magisEscape(nombreDeudor) }</td>

                    <td>
                        <button class="boton-editar" onclick="mostrarFichaCredito(${ credito.codigo_credito })">Ver detalle</button>
                        <button class="boton-editar" onclick="mostrarPlanCuotas(${ credito.codigo_credito })">Plan de cuotas</button>
                        <button class="boton-editar" onclick="mostrarRespaldosCredito(${ credito.codigo_credito })">Referencias y fiadores</button>
                        <button
                            class="boton-editar"
                            onclick="editarCredito(${ credito.codigo_credito })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarCredito(${ credito.codigo_credito })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Créditos</h2>
                    <p>Créditos registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioCredito()">
                    + Nuevo crédito
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Número</th>
                            <th>Fecha</th>
                            <th>Estado</th>
                            <th>Monto</th>
                            <th>Plazo</th>
                            <th>Tasa</th>
                            <th>Comisión</th>
                            <th>Garantía</th>
                            <th>Vendedor</th>
                            <th>Deudor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
        agregarFiltrosListado("creditos");
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Créditos</h2>

            <p class="mensaje-error">
                No fue posible cargar los créditos.
            </p>
        `;
    }
}



// Cambiamos cómo se ve la fecha en la tabla para que sea más fácil leerla.
function formatearFechaMostrar(fecha) {
    if (!fecha) {
        return "";
    }
    const fechaFormateada = formatearFecha(fecha);
    if (!fechaFormateada) {
        return "";
    }
    const partes = fechaFormateada.split("-");
    return `${ partes[2] }/${ partes[1] }/${ partes[0] }`;
}


// Cargamos las listas para escoger por nombre en vez de escribir los códigos.
// Si estamos editando, intentamos dejar seleccionada la opción que ya tenía.
async function cargarOpcionesRelacionadas(idFormulario, opciones, valores = {}, incluirPersonas = false) {
    const formulario = document.getElementById(idFormulario);
    const boton = formulario.querySelector('[type="submit"]');
    boton.disabled = true;
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    estado.textContent = "Cargando opciones...";
    formulario.prepend(estado);
    try {
        const rutas = [...new Set(opciones.map(opcion => opcion.ruta))];
        if (incluirPersonas) rutas.push("personas");
        const resultados = await Promise.allSettled(rutas.map(async ruta => {
            const respuesta = await fetch(`${ API }/${ ruta }`);
            if (!respuesta.ok) throw new Error(`No se pudo cargar ${ ruta }`);
            const datos = await respuesta.json();
            if (!Array.isArray(datos)) throw new Error(`Lista inválida: ${ ruta }`);
            return datos;
        }));
        if (document.getElementById(idFormulario) !== formulario) return;
        const fallo = resultados.find(resultado => resultado.status === "rejected");
        if (fallo) throw fallo.reason;
        const listas = Object.fromEntries(rutas.map((ruta, indice) => [ruta, resultados[indice].value]));
        const personas = new Map((listas.personas || []).map(persona => [String(persona.codigo_persona), persona]));
        const pendientes = [];
        for (const opcion of opciones) {
            const selector = formulario.querySelector(`#${ opcion.campo }`);
            const datos = listas[opcion.ruta];
            selector.innerHTML = `<option value="">Seleccione ${ opcion.nombre }</option>` + datos.map(dato =>
                `<option value="${ magisEscape(dato[opcion.campo]) }">${ magisEscape(opcion.texto(dato, personas)) } (${ magisEscape(dato[opcion.campo]) })</option>`
            ).join("");
            const actual = valores[opcion.campo];
            if (actual !== undefined && actual !== null && actual !== "") {
                selector.value = String(actual);
                if (!datos.some(dato => String(dato[opcion.campo]) === String(actual))) {
                    pendientes.push(`La selección actual de ${ opcion.nombre } (${ actual }) ya no está disponible. Selecciona otra.`);
                }
            }
            selector.disabled = datos.length === 0;
            if (!datos.length) pendientes.push(`No hay ${ opcion.nombre } disponibles. Registra primero en ${ opcion.modulo }.`);
        }
        boton.disabled = opciones.some(opcion => !listas[opcion.ruta].length);
        estado.textContent = pendientes.length ? pendientes.join(" ") : "Selecciona los datos relacionados.";
    } catch (error) {
        if (document.getElementById(idFormulario) !== formulario) return;
        console.error(error);
        estado.className = "mensaje-error";
        estado.textContent = "No fue posible cargar las opciones. Vuelve al listado e intenta nuevamente.";
    }
}

// Buscamos el nombre de la persona para mostrarlo en la lista.
function nombrePersonaRelacionada(dato, personas) {
    const persona = personas.get(String(dato.codigo_persona));
    return dato.nombre_persona || (persona && [persona.primer_nombre, persona.segundo_nombre,
        persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" "))
        || `Persona ${ dato.codigo_persona ?? "sin nombre" }`;
}

// Preparamos las listas de garantías, vendedores y deudores del crédito.
function cargarOpcionesCredito(idFormulario, valores = {}) {
    return cargarOpcionesRelacionadas(idFormulario, [
        { campo: "codigo_garantia", ruta: "garantias", nombre: "garantía", modulo: "Garantías",
            texto: dato => dato.descripcion || dato.nombre_garantia || "Garantía" },
        { campo: "codigo_vendedor", ruta: "vendedores", nombre: "vendedor", modulo: "Vendedores", texto: nombrePersonaRelacionada },
        { campo: "codigo_deudor", ruta: "deudores", nombre: "deudor", modulo: "Deudores", texto: nombrePersonaRelacionada }
    ], valores, true);
}

// Cargamos el tipo de garantía por nombre y el vehículo por su placa y VIN.
function cargarOpcionesVehiculo(idFormulario, valores = {}) {
    return cargarOpcionesRelacionadas(idFormulario, [
        { campo: "codigo_tipo_garantia", ruta: "tipos-garantia", nombre: "tipo de garantía", modulo: "Catálogos",
            texto: dato => dato.descripcion || "Tipo de garantía" },
        { campo: "codigo_vehiculo", ruta: "vehiculos", nombre: "vehículo", modulo: "Vehículos",
            texto: dato => [dato.placa && `Placa: ${ dato.placa }`, (dato.VIN || dato.vin) && `VIN: ${ dato.VIN || dato.vin }`].filter(Boolean).join(" · ") || "Vehículo sin placa ni VIN" }
    ], valores);
}

// Aquí mostramos los campos que se necesitan para registrar un crédito.
function mostrarFormularioCredito() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo crédito</h2>

        <form id="formCredito" class="formulario">

            <div class="campo">
                <label>Código de crédito</label>
                <input type="number" id="codigo_credito" required>
            </div>

            <div class="campo">
                <label>Número de crédito</label>
                <input type="text" id="numero_credito" required>
            </div>

            <div class="campo">
                <label>Fecha de crédito</label>
                <input type="date" id="fecha_credito" required>
            </div>

            <div class="campo">
                <label>Estado</label>
                <select id="estado" required>
                    <option value="Activo">Activo</option>
                </select>
            </div>

            <div class="campo">
                <label>Monto</label>
                <input
                    type="number"
                    step="0.01"
                    id="monto"
                    required>
            </div>

            <div class="campo">
                <label>Plazo</label>
                <input
                    type="number"
                    id="plazo"
                    value="60"
                    required>
            </div>

            <div class="campo">
                <label>Tasa de interés</label>
                <input
                    type="number"
                    step="0.01"
                    id="tasa_intereses"
                    value="12.50"
                    required>
            </div>

            <div class="campo">
                <label>Porcentaje de comisión</label>
                <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    id="porcentaje_comision"
                    required>
            </div>

            <div class="campo">
                <label for="seguro_vehiculo_credito">Seguro mensual del vehículo</label>
                <input type="number" id="seguro_vehiculo_credito" min="0.01" max="99999999.99" step="0.01" required>
            </div>
            <div class="campo">
                <label for="seguro_vida_credito">Seguro mensual de vida</label>
                <input type="number" id="seguro_vida_credito" min="0" max="99999999.99" step="0.01" required>
            </div>
            <p style="grid-column:1/-1">El plazo determina la cantidad de cuotas mensuales. Manejo de cuenta: Q25.00 por mes.
                Tasa anual sobre saldos y capital fijo. Al guardar se genera todo el plan junto con el crédito.</p>
            <div class="campo">
                <label>Código de garantía</label>
                <select id="codigo_garantia" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="campo">
                <label>Vendedor</label>
                <select id="codigo_vendedor" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="campo">
                <label>Deudor</label>
                <select id="codigo_deudor" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <section id="previewPlanCredito" style="grid-column:1/-1" aria-live="polite"></section>
            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarCreditos()">
                    Cancelar
                </button>

                <button type="button" class="boton-editar" id="previsualizarPlanCredito">Ver plan antes de guardar</button>
                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar crédito y generar plan
                </button>

            </div>

        </form>
    `;
    document.getElementById("formCredito").addEventListener("submit", registrarCredito);
    cargarOpcionesCredito("formCredito");
    prepararVistaPreviaCredito(document.getElementById("formCredito"));
}


// Tomamos los datos del crédito y los mandamos a la API para registrarlo.
async function registrarCredito(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const credito = {
        codigo_credito: parseInt(document.getElementById("codigo_credito").value),
        numero_credito: document.getElementById("numero_credito").value,
        fecha_credito: document.getElementById("fecha_credito").value,
        estado: document.getElementById("estado").value,
        monto: parseFloat(document.getElementById("monto").value),
        plazo: parseInt(document.getElementById("plazo").value),
        tasa_intereses: parseFloat(document.getElementById("tasa_intereses").value),
        porcentaje_comision: parseFloat(document.getElementById("porcentaje_comision").value),
        codigo_garantia: parseInt(document.getElementById("codigo_garantia").value),
        codigo_vendedor: parseInt(document.getElementById("codigo_vendedor").value),
        codigo_deudor: parseInt(document.getElementById("codigo_deudor").value),
        seguro_vehiculo: document.getElementById("seguro_vehiculo_credito").value,
        seguro_vida: document.getElementById("seguro_vida_credito").value
    };
    try {
        const respuesta = await fetch(`${ API }/creditos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credito)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el crédito");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert(resultado.mensaje || "Crédito y plan guardados correctamente");
        await mostrarPlanCuotas(credito.codigo_credito);
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Buscamos el crédito y llenamos sus campos para poder cambiarlo.
async function editarCredito(codigoCredito) {
    try {
        const respuesta = await fetch(`${ API }/creditos/${ codigoCredito }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del crédito");
            return;
        }
        const credito = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar crédito</h2>

            <form id="formEditarCredito" class="formulario">

                <div class="campo">
                    <label>Código de crédito</label>
                    <input
                        type="number"
                        id="codigo_credito"
                        value="${ credito.codigo_credito ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Número de crédito</label>
                    <input
                        type="text"
                        id="numero_credito"
                        value="${ credito.numero_credito ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Fecha de crédito</label>
                    <input
                        type="date"
                        id="fecha_credito"
                        value="${ formatearFecha(credito.fecha_credito) }"
                        required>
                </div>

                <div class="campo">
                    <label>Estado</label>

                    <select id="estado" required>
                        <option value="Activo">Activo</option>
                        <option value="Finalizado">Finalizado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>

                <div class="campo">
                    <label>Monto</label>
                    <input
                        type="number"
                        step="0.01"
                        id="monto"
                        value="${ credito.monto ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Plazo</label>
                    <input
                        type="number"
                        id="plazo"
                        value="${ credito.plazo ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Tasa de interés</label>
                    <input
                        type="number"
                        step="0.01"
                        id="tasa_intereses"
                        value="${ credito.tasa_intereses ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Porcentaje de comisión</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        id="porcentaje_comision"
                        value="${ credito.porcentaje_comision ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Código de garantía</label>
                    <select id="codigo_garantia" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="campo">
                    <label>Vendedor</label>
                    <select id="codigo_vendedor" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="campo">
                    <label>Deudor</label>
                    <select id="codigo_deudor" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarCreditos()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("estado").value = credito.estado ?? "";
        document.getElementById("formEditarCredito").addEventListener("submit", function (event) {
            actualizarCredito(event, codigoCredito);
        });
        await cargarOpcionesCredito("formEditarCredito", credito);
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Enviamos los cambios al crédito que tiene este código.
async function actualizarCredito(event, codigoCredito) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const credito = {
        numero_credito: document.getElementById("numero_credito").value,
        fecha_credito: document.getElementById("fecha_credito").value,
        estado: document.getElementById("estado").value,
        monto: parseFloat(document.getElementById("monto").value),
        plazo: parseInt(document.getElementById("plazo").value),
        tasa_intereses: parseFloat(document.getElementById("tasa_intereses").value),
        porcentaje_comision: parseFloat(document.getElementById("porcentaje_comision").value),
        codigo_garantia: parseInt(document.getElementById("codigo_garantia").value),
        codigo_vendedor: parseInt(document.getElementById("codigo_vendedor").value),
        codigo_deudor: parseInt(document.getElementById("codigo_deudor").value)
    };
    try {
        const respuesta = await fetch(`${ API }/creditos/${ codigoCredito }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(credito)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el crédito");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Crédito actualizado correctamente");
        cargarCreditos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



// Preguntamos antes de pedir a la API que borre el crédito.
async function eliminarCredito(codigoCredito) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el crédito ${ codigoCredito }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/creditos/${ codigoCredito }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el crédito");
            return;
        }
        alert("Crédito eliminado correctamente");
        cargarCreditos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Vehículos
// Mostramos los vehículos y dejamos buscar por placa, VIN y otros datos.
async function cargarVehiculos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Vehículos</h2>
        <p>Cargando vehículos...</p>
    `;
    try {
        // Relacionamos los códigos del vehículo con los nombres de sus catálogos.
        const [vehiculos, marcas, lineas] = await listasGestion(["vehiculos", "marcas", "lineas"]);
        const marcasPorCodigo = new Map(marcas.map(marca => [String(marca.codigo_marca), marca]));
        const lineasPorCodigo = new Map(lineas.map(linea => [String(linea.codigo_linea), linea]));
        let filas = "";
        vehiculos.forEach(vehiculo => {
            const marca = marcasPorCodigo.get(String(vehiculo.codigo_marca));
            const linea = lineasPorCodigo.get(String(vehiculo.codigo_linea));
            const nombreMarca = marca?.descripcion || vehiculo.nombre_marca || "Marca no disponible";
            const nombreLinea = linea?.descripcion || vehiculo.nombre_linea || "Línea no disponible";
            filas += `
                <tr>
                    <td>${ vehiculo.codigo_vehiculo ?? "" }</td>
                    <td>${ magisEscape(vehiculo.VIN ?? vehiculo.vin ?? "") }</td>
                    <td>${ vehiculo.chasis ?? "" }</td>
                    <td>${ vehiculo.placa ?? "" }</td>
                    <td>${ vehiculo.serie ?? "" }</td>
                    <td>${ formatearFechaMostrar(vehiculo.anio_fabricacion) }</td>
                    <td>${ magisEscape(nombreMarca) }</td>
                    <td>${ magisEscape(nombreLinea) }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarVehiculo(${ vehiculo.codigo_vehiculo })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarVehiculo(${ vehiculo.codigo_vehiculo })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Vehículos</h2>
                    <p>Vehículos registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioVehiculo()">
                    + Nuevo vehículo
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>VIN</th>
                            <th>Chasis</th>
                            <th>Placa</th>
                            <th>Serie</th>
                            <th>Año fabricación</th>
                            <th>Marca</th>
                            <th>Línea</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
        agregarFiltrosListado("vehiculos");
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Vehículos</h2>

            <p class="mensaje-error">
                No fue posible cargar los vehículos.
            </p>
        `;
    }
}


function mostrarFormularioVehiculo() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo vehículo</h2>

        <form id="formVehiculo" class="formulario">

            <div class="campo">
                <label>Código de vehículo</label>
                <input type="number" id="codigo_vehiculo" required>
            </div>

            <div class="campo">
                <label>VIN</label>
                <input type="text" id="VIN" required>
            </div>

            <div class="campo">
                <label>Chasis</label>
                <input type="text" id="chasis" required>
            </div>

            <div class="campo">
                <label>Placa</label>
                <input type="text" id="placa">
            </div>

            <div class="campo">
                <label>Serie</label>
                <input type="text" id="serie">
            </div>

            <div class="campo">
                <label>Año de fabricación</label>
                <input type="date" id="anio_fabricacion" required>
            </div>

            <div class="campo">
                <label for="codigo_marca">Marca</label>
                <select id="codigo_marca" required disabled><option value="">Cargando marcas...</option></select>
            </div>

            <div class="campo">
                <label for="codigo_linea">Línea</label>
                <select id="codigo_linea" required disabled><option value="">Selecciona primero una marca</option></select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarVehiculos()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar vehículo
                </button>

            </div>

        </form>
    `;
    document.getElementById("formVehiculo").addEventListener("submit", registrarVehiculo);
    cargarCatalogosVehiculo(document.getElementById("formVehiculo"));
}

// Cargamos los nombres de marcas y solo las líneas que pertenecen a la marca elegida.
async function cargarCatalogosVehiculo(formulario, vehiculo = {}) {
    const marca = formulario.querySelector("#codigo_marca");
    const linea = formulario.querySelector("#codigo_linea");
    const guardar = formulario.querySelector('[type="submit"]');
    const aviso = document.createElement("div");
    aviso.className = "campo";
    aviso.style.gridColumn = "1/-1";
    const mensaje = document.createElement("p");
    mensaje.setAttribute("role", "status");
    const reintentar = document.createElement("button");
    reintentar.type = "button";
    reintentar.className = "boton-cancelar";
    reintentar.textContent = "Reintentar cargar marcas y líneas";
    aviso.append(mensaje, reintentar);
    formulario.insertBefore(aviso, formulario.querySelector(".acciones-formulario"));
    const filtrar = (seleccion = "") => {
        const disponibles = formulario.lineasVehiculo.filter(dato => String(dato.codigo_marca) === marca.value);
        opcionesContacto(linea, disponibles, "codigo_linea", seleccion);
        linea.disabled = !marca.value || !disponibles.length;
        guardar.disabled = !marca.value || !linea.value;
        mensaje.className = "";
        mensaje.textContent = !marca.value ? "Selecciona una marca para ver sus líneas." : !disponibles.length
            ? "Esta marca no tiene líneas disponibles. Puedes registrarlas en Catálogos."
            : seleccion !== "" && !linea.value
                ? "La línea anterior no está disponible para esta marca. Selecciona una línea válida."
                : "Selecciona la línea del vehículo.";
    };
    marca.addEventListener("change", () => filtrar());
    linea.addEventListener("change", () => { guardar.disabled = !marca.value || !linea.value; });
    const cargar = async () => {
        formulario.catalogosVehiculoListos = false;
        guardar.disabled = marca.disabled = linea.disabled = true;
        reintentar.hidden = true;
        mensaje.textContent = "Cargando marcas y líneas...";
        try {
            const [marcas, lineas] = await listasGestion(["marcas", "lineas"]);
            if (!formulario.isConnected) return;
            formulario.lineasVehiculo = lineas;
            opcionesContacto(marca, marcas, "codigo_marca", vehiculo.codigo_marca);
            formulario.catalogosVehiculoListos = true;
            filtrar(vehiculo.codigo_linea ?? "");
            if (!marcas.length) mensaje.textContent = "No hay marcas disponibles. Regístralas en Catálogos.";
        } catch (error) {
            if (!formulario.isConnected) return;
            mensaje.className = "mensaje-error";
            mensaje.textContent = error.message;
            reintentar.hidden = false;
        }
    };
    reintentar.addEventListener("click", cargar);
    await cargar();
}

// Antes de enviar comprobamos que los códigos seleccionados correspondan a la misma marca.
function seleccionVehiculoValida(formulario) {
    return Boolean(formulario?.catalogosVehiculoListos && formulario.lineasVehiculo.some(linea =>
        String(linea.codigo_marca) === formulario.querySelector("#codigo_marca").value &&
        String(linea.codigo_linea) === formulario.querySelector("#codigo_linea").value));
}



// Mandamos el vehículo con los códigos de su marca y línea.
async function registrarVehiculo(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    if (!seleccionVehiculoValida(document.getElementById("formVehiculo"))) {
        alert("Selecciona una marca y una línea válida antes de guardar.");
        return;
    }
    const vehiculo = {
        codigo_vehiculo: parseInt(document.getElementById("codigo_vehiculo").value),
        VIN: document.getElementById("VIN").value,
        chasis: document.getElementById("chasis").value,
        placa: document.getElementById("placa").value,
        serie: document.getElementById("serie").value,
        anio_fabricacion: document.getElementById("anio_fabricacion").value,
        codigo_marca: parseInt(document.getElementById("codigo_marca").value),
        codigo_linea: parseInt(document.getElementById("codigo_linea").value)
    };
    try {
        const respuesta = await fetch(`${ API }/vehiculos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vehiculo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el vehículo");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Vehículo registrado correctamente");
        cargarVehiculos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}
async function editarVehiculo(codigoVehiculo) {
    try {
        const respuesta = await fetch(`${ API }/vehiculos/${ codigoVehiculo }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del vehículo");
            return;
        }
        const vehiculo = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar vehículo</h2>

            <form id="formEditarVehiculo" class="formulario">

                <div class="campo">
                    <label>Código de vehículo</label>
                    <input
                        type="number"
                        id="codigo_vehiculo"
                        value="${ vehiculo.codigo_vehiculo ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>VIN</label>
                    <input
                        type="text"
                        id="VIN"
                        value="${ magisEscape(vehiculo.VIN ?? vehiculo.vin ?? "") }"
                        required>
                </div>

                <div class="campo">
                    <label>Chasis</label>
                    <input
                        type="text"
                        id="chasis"
                        value="${ vehiculo.chasis ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Placa</label>
                    <input
                        type="text"
                        id="placa"
                        value="${ vehiculo.placa ?? "" }">
                </div>

                <div class="campo">
                    <label>Serie</label>
                    <input
                        type="text"
                        id="serie"
                        value="${ vehiculo.serie ?? "" }">
                </div>

                <div class="campo">
                    <label>Año de fabricación</label>
                    <input
                        type="date"
                        id="anio_fabricacion"
                        value="${ formatearFecha(vehiculo.anio_fabricacion) }"
                        required>
                </div>

                <div class="campo">
                    <label for="codigo_marca">Marca</label>
                    <select id="codigo_marca" required disabled><option value="">Cargando marcas...</option></select>
                </div>

                <div class="campo">
                    <label for="codigo_linea">Línea</label>
                    <select id="codigo_linea" required disabled><option value="">Selecciona primero una marca</option></select>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarVehiculos()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarVehiculo").addEventListener("submit", function (event) {
            actualizarVehiculo(event, codigoVehiculo);
        });
        await cargarCatalogosVehiculo(document.getElementById("formEditarVehiculo"), vehiculo);
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



async function actualizarVehiculo(event, codigoVehiculo) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    if (!seleccionVehiculoValida(document.getElementById("formEditarVehiculo"))) {
        alert("Selecciona una marca y una línea válida antes de guardar.");
        return;
    }
    const vehiculo = {
        VIN: document.getElementById("VIN").value,
        chasis: document.getElementById("chasis").value,
        placa: document.getElementById("placa").value,
        serie: document.getElementById("serie").value,
        anio_fabricacion: document.getElementById("anio_fabricacion").value,
        codigo_marca: parseInt(document.getElementById("codigo_marca").value),
        codigo_linea: parseInt(document.getElementById("codigo_linea").value)
    };
    try {
        const respuesta = await fetch(`${ API }/vehiculos/${ codigoVehiculo }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vehiculo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el vehículo");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Vehículo actualizado correctamente");
        cargarVehiculos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}
async function eliminarVehiculo(codigoVehiculo) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el vehículo ${ codigoVehiculo }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/vehiculos/${ codigoVehiculo }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el vehículo");
            return;
        }
        alert("Vehículo eliminado correctamente");
        cargarVehiculos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



// Garantías
// Mostramos las garantías y el vehículo que tiene cada una.
async function cargarGarantias() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Garantías</h2>
        <p>Cargando garantías...</p>
    `;
    try {
        // Buscamos el nombre del tipo y la placa usando los códigos de cada garantía.
        const [garantias, tipos, vehiculos] = await listasGestion(["garantias", "tipos-garantia", "vehiculos"]);
        const tiposPorCodigo = new Map(tipos.map(tipo => [String(tipo.codigo_tipo_garantia), tipo]));
        const vehiculosPorCodigo = new Map(vehiculos.map(vehiculo => [String(vehiculo.codigo_vehiculo), vehiculo]));
        let filas = "";
        garantias.forEach(garantia => {
            const tipo = tiposPorCodigo.get(String(garantia.codigo_tipo_garantia));
            const vehiculo = vehiculosPorCodigo.get(String(garantia.codigo_vehiculo));
            const nombreTipo = tipo?.descripcion || garantia.nombre_tipo_garantia || "Tipo no disponible";
            const placa = vehiculo?.placa?.trim() || "Sin placa registrada";
            filas += `
                <tr>
                    <td>${ garantia.codigo_garantia ?? "" }</td>
                    <td>${ garantia.valor_comercial ?? "" }</td>
                    <td>${ garantia.descripcion ?? "" }</td>
                    <td>${ magisEscape(nombreTipo) }</td>
                    <td>${ magisEscape(placa) }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarGarantia(${ garantia.codigo_garantia })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarGarantia(${ garantia.codigo_garantia })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Garantías</h2>
                    <p>Garantías registradas en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioGarantia()">
                    + Nueva garantía
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Valor comercial</th>
                            <th>Descripción</th>
                            <th>Tipo de garantía</th>
                            <th>Placa del vehículo</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Garantías</h2>

            <p class="mensaje-error">
                No fue posible cargar las garantías.
            </p>
        `;
    }
}


function mostrarFormularioGarantia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nueva garantía</h2>

        <form id="formGarantia" class="formulario">

            <div class="campo">
                <label>Código de garantía</label>
                <input type="number" id="codigo_garantia" required>
            </div>

            <div class="campo">
                <label>Valor comercial</label>
                <input type="number" step="0.01" id="valor_comercial" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="campo">
                <label for="codigo_tipo_garantia">Tipo de garantía</label>
                <select id="codigo_tipo_garantia" required disabled><option value="">Cargando tipos de garantía...</option></select>
            </div>

            <div class="campo">
                <label>Código de vehículo</label>
                <select id="codigo_vehiculo" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarGarantias()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar garantía
                </button>

            </div>

        </form>
    `;
    document.getElementById("formGarantia").addEventListener("submit", registrarGarantia);
    cargarOpcionesVehiculo("formGarantia");
}


// Guardamos la garantía con el vehículo que escogimos.
async function registrarGarantia(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const garantia = {
        codigo_garantia: parseInt(document.getElementById("codigo_garantia").value),
        valor_comercial: parseFloat(document.getElementById("valor_comercial").value),
        descripcion: document.getElementById("descripcion").value,
        codigo_tipo_garantia: parseInt(document.getElementById("codigo_tipo_garantia").value),
        codigo_vehiculo: parseInt(document.getElementById("codigo_vehiculo").value)
    };
    try {
        const respuesta = await fetch(`${ API }/garantias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(garantia)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar la garantía");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Garantía registrada correctamente");
        cargarGarantias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarGarantia(codigoGarantia) {
    try {
        const respuesta = await fetch(`${ API }/garantias/${ codigoGarantia }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información de la garantía");
            return;
        }
        const garantia = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar garantía</h2>

            <form id="formEditarGarantia" class="formulario">

                <div class="campo">
                    <label>Código de garantía</label>
                    <input
                        type="number"
                        id="codigo_garantia"
                        value="${ garantia.codigo_garantia ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Valor comercial</label>
                    <input
                        type="number"
                        step="0.01"
                        id="valor_comercial"
                        value="${ garantia.valor_comercial ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ garantia.descripcion ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label for="codigo_tipo_garantia">Tipo de garantía</label>
                    <select id="codigo_tipo_garantia" required disabled><option value="">Cargando tipos de garantía...</option></select>
                </div>

                <div class="campo">
                    <label>Código de vehículo</label>
                    <select id="codigo_vehiculo" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarGarantias()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarGarantia").addEventListener("submit", function (event) {
            actualizarGarantia(event, codigoGarantia);
        });
        await cargarOpcionesVehiculo("formEditarGarantia", garantia);
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarGarantia(event, codigoGarantia) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const garantia = {
        valor_comercial: parseFloat(document.getElementById("valor_comercial").value),
        descripcion: document.getElementById("descripcion").value,
        codigo_tipo_garantia: parseInt(document.getElementById("codigo_tipo_garantia").value),
        codigo_vehiculo: parseInt(document.getElementById("codigo_vehiculo").value)
    };
    try {
        const respuesta = await fetch(`${ API }/garantias/${ codigoGarantia }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(garantia)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la garantía");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Garantía actualizada correctamente");
        cargarGarantias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarGarantia(codigoGarantia) {
    const confirmar = confirm(`¿Seguro que deseas eliminar la garantía ${ codigoGarantia }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/garantias/${ codigoGarantia }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar la garantía");
            return;
        }
        alert("Garantía eliminada correctamente");
        cargarGarantias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Pagos
// Traemos los pagos guardados y los mostramos en la tabla.
// Reunimos los abonos de cada crédito sin mezclar los distintos créditos de una misma persona.
function resumirPagosPorCredito(pagos, creditos, deudores, personas) {
    const porCredito = new Map(creditos.map(credito => [String(credito.codigo_credito), credito]));
    const porDeudor = new Map(deudores.map(deudor => [String(deudor.codigo_deudor), deudor]));
    const porPersona = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
    const grupos = new Map();
    for (const pago of pagos) {
        const clave = String(pago.codigo_credito);
        if (!grupos.has(clave)) {
            const credito = porCredito.get(clave);
            const deudor = credito && porDeudor.get(String(credito.codigo_deudor));
            const persona = deudor && porPersona.get(String(deudor.codigo_persona));
            grupos.set(clave, {
                codigo_credito: pago.codigo_credito,
                numero_credito: credito?.numero_credito || pago.numero_credito || "Número no disponible",
                nombre_cliente: (persona && nombreCompletoGestion(persona)) || deudor?.nombre_persona || credito?.nombre_deudor || "Cliente no disponible",
                codigo_persona: deudor?.codigo_persona, cantidad: 0, totalCentavos: 0,
                ultima_fecha: "", ultima_marca: -Infinity
            });
        }
        const grupo = grupos.get(clave);
        grupo.cantidad++;
        grupo.totalCentavos += centavosGestion(pago.monto_pagado);
        const marca = pago.fecha_hora_pago ? Date.parse(pago.fecha_hora_pago) : NaN;
        if (Number.isFinite(marca) && marca > grupo.ultima_marca) {
            grupo.ultima_marca = marca;
            grupo.ultima_fecha = pago.fecha_hora_pago;
        }
    }
    return [...grupos.values()].sort((a, b) => b.ultima_marca - a.ultima_marca || Number(a.codigo_credito) - Number(b.codigo_credito));
}

async function cargarPagos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = '<h2>Pagos</h2><p id="cargaResumenPagos">Cargando clientes e historiales de pagos...</p>';
    const carga = document.getElementById("cargaResumenPagos");
    try {
        const [pagos, creditos, deudores, personas] = await listasGestion(["pagos", "creditos", "deudores", "personas"]);
        if (!carga.isConnected) return;
        const resumenes = resumirPagosPorCredito(pagos, creditos, deudores, personas);
        contenido.innerHTML = `<div class="encabezado-modulo">
            <div><h2>Pagos</h2><p>Resumen de pagos registrados por cliente y crédito.</p></div>
            <button type="button" class="boton-nuevo" onclick="mostrarFormularioPago()">+ Nuevo pago</button>
        </div>
        <p>Una fila por crédito con pagos registrados. Abre su historial para consultar cada abono y su comprobante.</p>
        ${ resumenes.length ? `<div class="tabla-contenedor"><table>
            <thead><tr><th>Cliente</th><th>Número de crédito</th><th>Pagos registrados</th><th>Total recibido</th><th>Último pago</th><th>Acciones</th></tr></thead>
            <tbody>${ resumenes.map(resumen => `<tr>
                <td style="white-space:normal"><strong>${ magisEscape(resumen.nombre_cliente) }</strong>
                    ${ resumen.codigo_persona != null ? `<span class="cell-sub">Código de persona: ${ magisEscape(resumen.codigo_persona) }</span>` : "" }</td>
                <td>${ magisEscape(resumen.numero_credito) }</td>
                <td>${ resumen.cantidad }</td><td>${ magisMoney(resumen.totalCentavos / 100) }</td>
                <td>${ magisEscape(resumen.ultima_fecha ? formatearFechaHoraMostrar(resumen.ultima_fecha) : "Fecha no disponible") }</td>
                <td><button type="button" class="boton-editar" onclick="mostrarHistorialPagos(${ Number(resumen.codigo_credito) })">Ver historial</button></td>
            </tr>`).join("") }</tbody></table></div>` : '<p>No hay pagos registrados. Usa Nuevo pago para registrar el primero.</p>' }`;
        if (resumenes.length) agregarFiltrosListado("pagos");
    } catch (error) {
        if (!carga.isConnected) return;
        console.error(error);
        contenido.innerHTML = '<h2>Pagos</h2><p class="mensaje-error">No fue posible cargar el resumen de pagos.</p>';
    }
}

async function mostrarHistorialPagos(codigoCredito) {
    magisSelect("pagos");
    const vista = crearVistaGestion("Historial de pagos", "cargarPagos()");
    try {
        const [pagos, creditos, deudores, personas, cuotas, medios] = await listasGestion(["pagos", "creditos", "deudores", "personas", "cuotas", "medios-pago"]);
        if (!vista.isConnected) return;
        const propios = pagos.filter(pago => String(pago.codigo_credito) === String(codigoCredito));
        const credito = creditos.find(dato => String(dato.codigo_credito) === String(codigoCredito));
        const resumen = resumirPagosPorCredito(propios, creditos, deudores, personas)[0];
        const porCuota = new Map(cuotas.map(cuota => [String(cuota.codigo_cuota), cuota]));
        const porMedio = new Map(medios.map(medio => [String(medio.codigo_medio_pago), medio]));
        const fechaOrden = pago => {
            const marca = pago.fecha_hora_pago ? Date.parse(pago.fecha_hora_pago) : NaN;
            return Number.isFinite(marca) ? marca : -Infinity;
        };
        propios.sort((a, b) => fechaOrden(b) - fechaOrden(a) || Number(b.codigo_transaccion) - Number(a.codigo_transaccion));
        vista.innerHTML = `<div class="encabezado-modulo"><div>
                <h3>${ magisEscape(resumen?.nombre_cliente || credito?.nombre_deudor || "Cliente no disponible") }</h3>
                <p>Crédito: ${ magisEscape(resumen?.numero_credito || credito?.numero_credito || "Número no disponible") }</p>
            </div>${ credito?.estado === "Activo" ? `<button type="button" class="boton-nuevo" onclick="mostrarFormularioPago(${ Number(codigoCredito) })">+ Nuevo pago</button>` : "" }</div>
            <p>${ propios.length } pagos registrados · Total recibido: ${ magisMoney((resumen?.totalCentavos || 0) / 100) }. Los más recientes aparecen primero.</p>
            ${ propios.length ? `<div class="tabla-contenedor"><table>
                <thead><tr><th>Comprobante</th><th>Fecha y hora</th><th>Cuota</th><th>Monto</th><th>Medio de pago</th><th>Referencia bancaria</th><th>Acciones</th></tr></thead>
                <tbody>${ propios.map(pago => {
                    const cuota = porCuota.get(String(pago.codigo_cuota));
                    const numeroCuota = cuota && String(cuota.codigo_credito) === String(codigoCredito) ? cuota.numero_cuota : null;
                    const medio = porMedio.get(String(pago.codigo_medio_pago));
                    return `<tr>
                        <td>${ magisEscape(pago.numero_comprobante || "Sin comprobante") }<span class="cell-sub">Código: ${ magisEscape(pago.codigo_transaccion) }</span></td>
                        <td>${ magisEscape(pago.fecha_hora_pago && Number.isFinite(Date.parse(pago.fecha_hora_pago)) ? formatearFechaHoraMostrar(pago.fecha_hora_pago) : "Fecha no disponible") }</td>
                        <td>${ numeroCuota != null ? `Cuota ${ magisEscape(numeroCuota) }` : "Cuota no disponible" }</td>
                        <td>${ magisMoney(pago.monto_pagado) }</td>
                        <td style="white-space:normal">${ magisEscape(medio?.descripcion || pago.nombre_medio_pago || "Medio no disponible") }</td>
                        <td style="white-space:normal">${ magisEscape(textoBusquedaGestion(medio?.descripcion || pago.nombre_medio_pago || "").startsWith("efectivo") ? "No aplica" : pago.referencia_bancaria || "Sin referencia") }</td>
                        <td><button type="button" class="boton-editar" onclick="editarPago(${ Number(pago.codigo_transaccion) })">Editar</button>
                            <button type="button" class="boton-editar" onclick="mostrarComprobantePago(${ Number(pago.codigo_transaccion) })">Ver comprobante</button>
                            <button type="button" class="boton-eliminar" onclick="eliminarPago(${ Number(pago.codigo_transaccion) })">Eliminar</button></td>
                    </tr>`;
                }).join("") }</tbody></table></div>` : '<p>No hay pagos registrados para este crédito.</p>' }`;
        if (propios.length) agregarFiltrosListado("historialPagos");
    } catch (error) { mostrarErrorGestion(vista, error); }
}


// Aquí escogemos el crédito, la cuota pendiente y cómo se hará el pago.
async function mostrarFormularioPago(codigoCredito = "", codigoCuota = "") {
    magisSelect("pagos");
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo pago</h2>

        <form id="formPago" class="formulario">

            <div class="campo">
                <label for="codigo_transaccion">Código de transacción</label>
                <input type="text" id="codigo_transaccion" value="Se genera al guardar" readonly>
            </div>

            <div class="campo">
                <label for="numero_comprobante">Número de comprobante</label>
                <input type="text" id="numero_comprobante" value="Se genera al guardar" readonly>
            </div>

            <div class="campo">
                <label>Fecha y hora de pago</label>
                <input type="datetime-local" id="fecha_hora_pago" required>
            </div>

            <div class="campo">
                <label>Monto pagado</label>
                <input type="number" step="0.01" id="monto_pagado" min="0.01" required>
            </div>

            <div class="campo">
                <label for="referencia_bancaria">Referencia bancaria</label>
                <input type="text" id="referencia_bancaria" maxlength="100">
            </div>

            <div class="campo">
                <label>Crédito</label>
                <select id="codigo_credito" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="campo">
                <label>Cuota pendiente</label>
                <select id="codigo_cuota" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="campo">
                <label>Medio de pago</label>
                <select id="codigo_medio_pago" required disabled><option value="">Cargando opciones...</option></select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarPagos()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar pago
                </button>

            </div>

        </form>
    `;
    document.getElementById("formPago").addEventListener("submit", registrarPago);
    document.getElementById("formPago").dataset.solicitudPago = crypto.randomUUID();
    document.getElementById("fecha_hora_pago").value = fechaHoraGuatemalaPago();
    await cargarOpcionesPago(codigoCredito, codigoCuota);
}

// Mostramos la hora de Guatemala y dejamos el campo editable para registrar un pago anterior.
function fechaHoraGuatemalaPago(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit",
        day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(fecha);
    const valor = tipo => partes.find(parte => parte.type === tipo).value;
    return `${ valor("year") }-${ valor("month") }-${ valor("day") }T${ valor("hour") }:${ valor("minute") }`;
}

// La referencia viene del banco o de la tarjeta. Para efectivo no se inventa una referencia.
function prepararReferenciaPago(formulario, medios) {
    const medio = formulario.querySelector("#codigo_medio_pago");
    const referencia = formulario.querySelector("#referencia_bancaria");
    const etiqueta = referencia.parentElement.querySelector("label");
    const ayuda = document.createElement("p");
    ayuda.setAttribute("role", "status");
    ayuda.id = `${ formulario.id }-ayuda-referencia`;
    referencia.setAttribute("aria-describedby", ayuda.id);
    referencia.maxLength = 100;
    referencia.parentElement.append(ayuda);
    let anterior = medio.value;
    const borradores = new Map([[anterior, referencia.value]]);
    const actualizar = () => {
        if (anterior && !referencia.disabled) borradores.set(anterior, referencia.value);
        const seleccionado = medios.find(m => String(m.codigo_medio_pago) === medio.value);
        const nombre = textoBusquedaGestion(seleccionado?.descripcion || "");
        const efectivo = nombre.startsWith("efectivo");
        referencia.disabled = !seleccionado || efectivo;
        referencia.required = Boolean(seleccionado) && !efectivo;
        if (efectivo) {
            referencia.value = "No aplica";
            etiqueta.textContent = "Referencia bancaria";
            ayuda.textContent = "Los pagos en efectivo no necesitan referencia bancaria.";
        } else {
            referencia.value = borradores.get(medio.value) || "";
            etiqueta.textContent = nombre.includes("deposit") ? "Número de boleta de depósito"
                : nombre.includes("transfer") || nombre.includes("ach") ? "Referencia de transferencia"
                : nombre.includes("tarjeta") ? "Número de autorización de tarjeta" : "Referencia del pago";
            referencia.placeholder = seleccionado ? "Ingresa la referencia real del pago" : "Selecciona un medio de pago";
            ayuda.textContent = seleccionado ? "Copia el dato de la boleta, transferencia o autorización. Este número no lo genera MAGIS-AUTO."
                : "Selecciona primero el medio de pago.";
        }
        anterior = medio.value;
    };
    medio.addEventListener("change", actualizar);
    actualizar();
}


// Volvemos a revisar cuánto falta pagar antes de mandar el pago.
// El monto debe ser mayor que cero y no superar lo pendiente. La API también debe revisar estos datos.
async function registrarPago(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const formulario = document.getElementById("formPago");
    const boton = formulario.querySelector('[type="submit"]');
    if (boton.disabled || !formulario.reportValidity()) return;
    const pago = {
        id_solicitud: formulario.dataset.solicitudPago,
        fecha_hora_pago: document.getElementById("fecha_hora_pago").value,
        monto_pagado: parseFloat(document.getElementById("monto_pagado").value),
        referencia_bancaria: formulario.querySelector("#referencia_bancaria").disabled ? "" : formulario.querySelector("#referencia_bancaria").value,
        codigo_cuota: parseInt(document.getElementById("codigo_cuota").value),
        codigo_credito: parseInt(document.getElementById("codigo_credito").value),
        codigo_medio_pago: parseInt(document.getElementById("codigo_medio_pago").value)
    };
    const controles = [...formulario.querySelectorAll("input,select,button")].map(campo => [campo, campo.disabled]);
    controles.forEach(([campo]) => { campo.disabled = true; });
    try {
        // Un reintento con la misma solicitud llega a SQL aunque el primer pago ya haya liquidado la cuota.
        if (!formulario.solicitudPagoIntentada || !pago.id_solicitud) {
            const [creditos, cuotas, pagos] = await listasGestion(["creditos", "cuotas", "pagos"]);
            if (!formulario.isConnected) return;
            const credito = creditos.find(c => Number(c.codigo_credito) === pago.codigo_credito);
            const cuota = cuotasConSaldoGestion(cuotas, pagos).find(q => Number(q.codigo_cuota) === pago.codigo_cuota && Number(q.codigo_credito) === pago.codigo_credito);
            const importe = centavosGestion(pago.monto_pagado);
            if (!credito || textoBusquedaGestion(credito.estado) !== "activo") throw new Error("El crédito ya no está activo. Actualiza el formulario.");
            if (!cuota || cuota.saldoCentavos <= 0) throw new Error("La cuota no pertenece al crédito o ya está pagada. Actualiza el formulario.");
            if (importe <= 0 || importe > cuota.saldoCentavos) throw new Error(`El pago debe ser mayor que cero y no superar el saldo actual de ${ magisMoney(cuota.saldoCentavos / 100) }.`);
        }
        formulario.solicitudPagoIntentada = true;
        const respuesta = await fetch(`${ API }/pagos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pago)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el pago");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        if (formulario.isConnected) {
            formulario.querySelector("#codigo_transaccion").value = resultado.codigo_transaccion;
            formulario.querySelector("#numero_comprobante").value = resultado.numero_comprobante;
        }
        alert(resultado.mensaje || `Pago registrado correctamente. Código de transacción: ${ resultado.codigo_transaccion }.`);
        if (formulario.isConnected) await cargarPagos();
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible conectarse con la API");
    } finally {
        controles.forEach(([campo, disabled]) => { campo.disabled = disabled; });
    }
}


async function editarPago(codigoTransaccion) {
    const vista = crearVistaGestion("Editar pago", "cargarPagos()");
    try {
        const respuesta = await fetch(`${ API }/pagos/${ codigoTransaccion }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del pago");
            return;
        }
        const pago = await respuesta.json();
        if (!vista.isConnected) return;
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar pago</h2>

            <form id="formEditarPago" class="formulario">

                <div class="campo">
                    <label>Código de transacción</label>
                    <input
                        type="number"
                        id="codigo_transaccion"
                        value="${ pago.codigo_transaccion ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Número de comprobante</label>
                    <input
                        type="text"
                        id="numero_comprobante"
                        value="${ magisEscape(pago.numero_comprobante ?? "") }"
                        required>
                </div>

                <div class="campo">
                    <label>Fecha y hora de pago</label>
                    <input
                        type="datetime-local"
                        id="fecha_hora_pago"
                        required>
                </div>

                <div class="campo">
                    <label>Monto pagado</label>
                    <input
                        type="number"
                        step="0.01"
                        id="monto_pagado"
                        min="0.01"
                        value="${ magisEscape(pago.monto_pagado ?? "") }"
                        required>
                </div>

                <div class="campo">
                    <label>Referencia bancaria</label>
                    <input
                        type="text"
                        id="referencia_bancaria"
                        value="${ magisEscape(pago.referencia_bancaria ?? "") }">
                </div>

                <div class="campo">
                    <label>Crédito</label>
                    <select id="codigo_credito" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="campo">
                    <label>Cuota</label>
                    <select id="codigo_cuota" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="campo">
                    <label>Medio de pago</label>
                    <select id="codigo_medio_pago" required disabled><option value="">Cargando opciones...</option></select>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarPagos()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar" disabled>
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("fecha_hora_pago").value = formatearFechaHoraInput(pago.fecha_hora_pago);
        const formulario = document.getElementById("formEditarPago");
        formulario.addEventListener("submit", function (event) {
            actualizarPago(event, codigoTransaccion);
        });
        await cargarOpcionesEdicionPago(formulario, pago);
    } catch (error) {
        mostrarErrorGestion(vista, error);
    }
}
// Acomodamos la fecha y la hora para ponerlas en el formulario.
function formatearFechaHoraInput(fecha) {
    if (!fecha) {
        return "";
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(fecha)) {
        return fecha.substring(0, 16);
    }
    const meses = {
        Jan: "01",
        Feb: "02",
        Mar: "03",
        Apr: "04",
        May: "05",
        Jun: "06",
        Jul: "07",
        Aug: "08",
        Sep: "09",
        Oct: "10",
        Nov: "11",
        Dec: "12"
    };
    const partes = fecha.split(" ");
    if (partes.length >= 5) {
        const dia = partes[1].padStart(2, "0");
        const mes = meses[partes[2]];
        const anio = partes[3];
        const horaCompleta = partes[4].split(":");
        const hora = horaCompleta[0];
        const minuto = horaCompleta[1];
        if (dia && mes && anio && hora && minuto) {
            return `${ anio }-${ mes }-${ dia }T${ hora }:${ minuto }`;
        }
    }
    return "";
}


// Al editar dejamos fuera el pago actual para no restarlo dos veces del saldo.
async function cargarOpcionesEdicionPago(formulario, pagoActual) {
    const estado = document.createElement("p");
    estado.id = "estadoEdicionPago";
    estado.setAttribute("role", "status");
    estado.textContent = "Cargando créditos, cuotas y medios de pago...";
    formulario.prepend(estado);
    const boton = formulario.querySelector('[type="submit"]');
    formulario.opcionesPagoListas = false;
    try {
        const [creditos, cuotas, pagos, medios] = await listasGestion(["creditos", "cuotas", "pagos", "medios-pago"]);
        if (!formulario.isConnected) return;
        const otrosPagos = pagos.filter(p => String(p.codigo_transaccion) !== String(pagoActual.codigo_transaccion));
        const saldos = cuotasConSaldoGestion(cuotas, otrosPagos);
        const credito = formulario.querySelector("#codigo_credito");
        const cuota = formulario.querySelector("#codigo_cuota");
        const medio = formulario.querySelector("#codigo_medio_pago");
        const monto = formulario.querySelector("#monto_pagado");
        const disponibles = creditos.filter(c => textoBusquedaGestion(c.estado) === "activo" && saldos.some(q =>
            String(q.codigo_credito) === String(c.codigo_credito) && q.saldoCentavos > 0));
        credito.innerHTML = '<option value="">Seleccione un crédito activo</option>' + disponibles.map(c =>
            `<option value="${ magisEscape(c.codigo_credito) }">${ magisEscape(c.numero_credito || c.codigo_credito) } — ${ magisEscape(c.nombre_deudor || c.codigo_deudor) }</option>`).join("");
        credito.disabled = !disponibles.length;
        credito.value = String(pagoActual.codigo_credito);
        opcionesContacto(medio, medios, "codigo_medio_pago", pagoActual.codigo_medio_pago);
        prepararReferenciaPago(formulario, medios);
        // Conservamos el monto que estaba guardado. Solo cambiamos el máximo permitido.
        const actualizarSaldo = () => {
            const seleccionada = saldos.find(q => String(q.codigo_credito) === credito.value && String(q.codigo_cuota) === cuota.value);
            monto.max = seleccionada ? (seleccionada.saldoCentavos / 100).toFixed(2) : "";
            boton.disabled = !seleccionada || !medios.length;
            estado.textContent = !disponibles.length ? "No hay créditos activos con saldo disponible para este pago." : !medios.length
                ? "Registra un medio de pago en Catálogos." : seleccionada
                    ? `Puedes guardar hasta ${ magisMoney(seleccionada.saldoCentavos / 100) }. El pago que estás editando no se descuenta de este límite.`
                    : "Selecciona un crédito activo y una cuota que le pertenezca.";
        };
        const filtrarCuotas = (actual = "") => {
            const pendientes = saldos.filter(q => String(q.codigo_credito) === credito.value && q.saldoCentavos > 0);
            cuota.innerHTML = '<option value="">Seleccione una cuota</option>' + pendientes.map(q =>
                `<option value="${ magisEscape(q.codigo_cuota) }">Cuota ${ magisEscape(q.numero_cuota ?? q.codigo_cuota) } — disponible ${ magisMoney(q.saldoCentavos / 100) }</option>`).join("");
            cuota.disabled = !pendientes.length;
            cuota.value = String(actual);
            actualizarSaldo();
        };
        credito.addEventListener("change", () => filtrarCuotas());
        cuota.addEventListener("change", actualizarSaldo);
        filtrarCuotas(pagoActual.codigo_cuota);
        formulario.opcionesPagoListas = true;
    } catch (error) {
        if (!formulario.isConnected) return;
        estado.className = "mensaje-error";
        estado.textContent = `${ error.message } Vuelve a Pagos y abre el registro nuevamente.`;
    }
}

// Volvemos a consultar antes de guardar por si cambió el saldo mientras editábamos.
async function actualizarPago(event, codigoTransaccion) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const formulario = document.getElementById("formEditarPago");
    if (!formulario?.opcionesPagoListas || formulario.guardandoPago) return;
    const boton = formulario.querySelector('[type="submit"]');
    if (boton.disabled || !formulario.reportValidity()) return;
    const estado = formulario.querySelector("#estadoEdicionPago");
    const pago = {
        numero_comprobante: document.getElementById("numero_comprobante").value,
        fecha_hora_pago: document.getElementById("fecha_hora_pago").value,
        monto_pagado: parseFloat(document.getElementById("monto_pagado").value),
        referencia_bancaria: document.getElementById("referencia_bancaria").value,
        codigo_cuota: parseInt(document.getElementById("codigo_cuota").value),
        codigo_credito: parseInt(document.getElementById("codigo_credito").value),
        codigo_medio_pago: parseInt(document.getElementById("codigo_medio_pago").value)
    };
    formulario.guardandoPago = true;
    const controles = [...formulario.querySelectorAll("input,select,button")].map(campo => [campo, campo.disabled]);
    controles.forEach(([campo]) => { campo.disabled = true; });
    estado.className = "";
    estado.textContent = "Comprobando el saldo y guardando los cambios...";
    try {
        const [creditos, cuotas, pagos, medios] = await listasGestion(["creditos", "cuotas", "pagos", "medios-pago"]);
        if (!formulario.isConnected) return;
        if (!pagos.some(p => String(p.codigo_transaccion) === String(codigoTransaccion))) throw new Error("Este pago ya no existe. Vuelve al listado para actualizar los datos.");
        const credito = creditos.find(c => Number(c.codigo_credito) === pago.codigo_credito);
        const otrosPagos = pagos.filter(p => String(p.codigo_transaccion) !== String(codigoTransaccion));
        const cuota = cuotasConSaldoGestion(cuotas, otrosPagos).find(q => Number(q.codigo_credito) === pago.codigo_credito && Number(q.codigo_cuota) === pago.codigo_cuota);
        if (!credito || textoBusquedaGestion(credito.estado) !== "activo") throw new Error("El crédito debe estar activo para guardar este pago.");
        if (!cuota) throw new Error("La cuota seleccionada no pertenece al crédito.");
        const importe = centavosGestion(pago.monto_pagado);
        if (importe <= 0 || importe > cuota.saldoCentavos) throw new Error(`El monto debe ser mayor que cero y no superar ${ magisMoney(cuota.saldoCentavos / 100) } para esta cuota.`);
        if (!medios.some(m => Number(m.codigo_medio_pago) === pago.codigo_medio_pago)) throw new Error("El medio de pago seleccionado ya no está disponible.");
        const resultado = await solicitarGestion(`pagos/${ codigoTransaccion }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pago)
        });
        confirmarFormularioGuardado(seguimientoGuardado);
        alert(resultado.mensaje || "Pago actualizado correctamente");
        if (formulario.isConnected) await cargarPagos();
    } catch (error) {
        if (!formulario.isConnected) return;
        estado.className = "mensaje-error";
        estado.textContent = `${ error.message } Los datos que escribiste siguen en el formulario.`;
    } finally {
        formulario.guardandoPago = false;
        controles.forEach(([campo, disabled]) => { campo.disabled = disabled; });
    }
}
async function eliminarPago(codigoTransaccion) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el pago ${ codigoTransaccion }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/pagos/${ codigoTransaccion }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el pago");
            return;
        }
        alert("Pago eliminado correctamente");
        cargarPagos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



// Cuotas
// Pedimos las cuotas y las pasamos a la función que muestra la tabla.
// Agrupamos por crédito, no por persona: un mismo cliente puede tener varios planes.
function resumirPlanesCuotas(cuotas, creditos, deudores, personas) {
    const porCredito = new Map();
    for (const cuota of cuotas) {
        const clave = String(cuota.codigo_credito);
        if (!porCredito.has(clave)) porCredito.set(clave, { cantidad: 0, totalCentavos: 0 });
        const resumen = porCredito.get(clave);
        resumen.cantidad++;
        resumen.totalCentavos += centavosGestion(cuota.valor_total_cuota);
    }
    const porDeudor = new Map(deudores.map(deudor => [String(deudor.codigo_deudor), deudor]));
    const porPersona = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
    return creditos.filter(credito => porCredito.has(String(credito.codigo_credito))).map(credito => {
        const deudor = porDeudor.get(String(credito.codigo_deudor));
        const persona = deudor && porPersona.get(String(deudor.codigo_persona));
        return { ...credito, ...porCredito.get(String(credito.codigo_credito)),
            nombre_cliente: (persona && nombreCompletoGestion(persona)) || deudor?.nombre_persona || credito.nombre_deudor || "Cliente no disponible",
            codigo_persona: deudor?.codigo_persona
        };
    });
}

async function cargarCuotas() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = '<h2>Cuotas</h2><p id="cargaPlanesCuotas">Cargando clientes y planes de cuotas...</p>';
    const carga = document.getElementById("cargaPlanesCuotas");
    try {
        const [cuotas, creditos, deudores, personas] = await listasGestion(["cuotas", "creditos", "deudores", "personas"]);
        if (!carga.isConnected) return;
        const planes = resumirPlanesCuotas(cuotas, creditos, deudores, personas);
        contenido.innerHTML = `<div class="encabezado-modulo">
            <div><h2>Cuotas</h2><p>Clientes y créditos con planes de cuotas registrados.</p></div>
            <button type="button" class="boton-nuevo" onclick="mostrarPlanCuotas()">Consultar planes</button>
        </div>
        <p>Una fila por crédito con plan. El total incluye el capital, los intereses, el manejo de cuenta y los seguros de las cuotas registradas.</p>
        ${ planes.length ? `<div class="tabla-contenedor"><table>
            <thead><tr><th>Cliente</th><th>Número de crédito</th><th>Plazo</th><th>Cuotas registradas</th><th>Total del plan</th><th>Acciones</th></tr></thead>
            <tbody>${ planes.map(plan => `<tr>
                <td style="white-space:normal"><strong>${ magisEscape(plan.nombre_cliente) }</strong>
                    ${ plan.codigo_persona != null ? `<span class="cell-sub">Código de persona: ${ magisEscape(plan.codigo_persona) }</span>` : "" }</td>
                <td>${ magisEscape(plan.numero_credito || "Número no disponible") }</td>
                <td>${ magisEscape(plan.plazo) } meses</td>
                <td>${ plan.cantidad }${ plan.cantidad !== Number(plan.plazo) ? '<span class="cell-sub">Plan incompleto</span>' : "" }</td>
                <td>${ magisMoney(plan.totalCentavos / 100) }</td>
                <td><button type="button" class="boton-editar" onclick="mostrarPlanCuotas(${ Number(plan.codigo_credito) })">Ver plan de cuotas</button></td>
            </tr>`).join("") }</tbody></table></div>` : '<p>No hay créditos con cuotas registradas. Usa Consultar planes para revisar los créditos disponibles.</p>' }`;
        if (planes.length) agregarFiltrosListado("cuotas");
    } catch (error) {
        if (!carga.isConnected) return;
        console.error(error);
        contenido.innerHTML = '<h2>Cuotas</h2><p class="mensaje-error">No fue posible cargar los planes de cuotas.</p>';
    }
}


// Preparamos las cuotas, el filtro por crédito y la primera página de la tabla.
function mostrarTablaCuotas(cuotas) {
    const contenido = document.getElementById("contenido");
    window.cuotasCargadas = cuotas;
    window.cuotasFiltradas = cuotas;
    window.paginaActualCuotas = 1;
    window.cuotasPorPagina = 15;
    const creditosUnicos = [];
    cuotas.forEach(cuota => {
        const numeroCredito = cuota.numero_credito ?? cuota.codigo_credito;
        if (!creditosUnicos.includes(numeroCredito)) {
            creditosUnicos.push(numeroCredito);
        }
    });
    let opcionesCreditos = `
        <option value="">
            Todos los créditos
        </option>
    `;
    creditosUnicos.forEach(credito => {
        opcionesCreditos += `
            <option value="${ magisEscape(credito) }">
                ${ magisEscape(credito) }
            </option>
        `;
    });
    contenido.innerHTML = `
        <div class="encabezado-modulo">

            <div>
                <h2>Cuotas</h2>

                <p>
                    Cuotas registradas en MAGIS-AUTO.
                </p>
            </div>

            <button
                class="boton-nuevo"
                onclick="mostrarFormularioCuota()">
                Plan de cuotas
            </button>

        </div>


        <div class="filtro-cuotas">

            <div class="campo-filtro">

                <label for="filtroCreditoCuotas">
                    Filtrar por crédito
                </label>

                <select
                    id="filtroCreditoCuotas"
                    onchange="filtrarCuotasPorCredito()">

                    ${ opcionesCreditos }

                </select>

            </div>

            <div class="contador-cuotas">
                <span id="cantidadCuotas">
                    ${ cuotas.length }
                </span>

                cuotas encontradas
            </div>

        </div>


        <div class="tabla-contenedor">

            <table>

                <thead>

                    <tr>

                        <th>Código</th>
                        <th>Número</th>
                        <th>Fecha plan</th>
                        <th>Vencimiento</th>
                        <th>Capital</th>
                        <th>Intereses</th>
                        <th>Manejo cuenta</th>
                        <th>Seguro vehículo</th>
                        <th>Seguro vida</th>
                        <th>Total cuota</th>
                        <th>Cliente</th>
                        <th>Número de crédito</th>
                        <th>Acciones</th>

                    </tr>

                </thead>

                <tbody id="tbodyCuotas">
                </tbody>

            </table>

        </div>


        <div class="paginacion-cuotas">

            <div
                class="info-paginacion"
                id="infoPaginacionCuotas">
            </div>

            <div
                class="botones-paginacion"
                id="botonesPaginacionCuotas">
            </div>

        </div>
    `;
    renderizarPaginaCuotas();
}


// De las cuotas que ya cargamos, dejamos ver solo las del crédito escogido.
function filtrarCuotasPorCredito() {
    const filtro = document.getElementById("filtroCreditoCuotas").value;
    const cuotas = window.cuotasCargadas ?? [];
    let cuotasFiltradas = cuotas;
    if (filtro !== "") {
        cuotasFiltradas = cuotas.filter(cuota => {
            const numeroCredito = cuota.numero_credito ?? String(cuota.codigo_credito);
            return String(numeroCredito) === String(filtro);
        });
    }
    window.cuotasFiltradas = cuotasFiltradas;
    window.paginaActualCuotas = 1;
    document.getElementById("cantidadCuotas").textContent = cuotasFiltradas.length;
    renderizarPaginaCuotas();
}


// Mostramos las cuotas que corresponden a la página que estamos viendo.
function renderizarPaginaCuotas() {
    const cuotas = window.cuotasFiltradas ?? [];
    const paginaActual = window.paginaActualCuotas ?? 1;
    const cuotasPorPagina = window.cuotasPorPagina ?? 15;
    const totalCuotas = cuotas.length;
    const totalPaginas = Math.max(1, Math.ceil(totalCuotas / cuotasPorPagina));
    if (window.paginaActualCuotas > totalPaginas) {
        window.paginaActualCuotas = totalPaginas;
    }
    const inicio = (window.paginaActualCuotas - 1) * cuotasPorPagina;
    const fin = inicio + cuotasPorPagina;
    const cuotasPagina = cuotas.slice(inicio, fin);
    let filas = "";
    cuotasPagina.forEach(cuota => {
        filas += `
            <tr>

                <td>${ cuota.codigo_cuota ?? "" }</td>

                <td>${ cuota.numero_cuota ?? "" }</td>

                <td>
                    ${ formatearFechaMostrar(cuota.fecha_plan) }
                </td>

                <td>
                    ${ formatearFechaMostrar(cuota.fecha_vencimiento) }
                </td>

                <td>${ cuota.capital ?? "" }</td>

                <td>${ cuota.intereses ?? "" }</td>

                <td>${ cuota.manejo_cuenta ?? "" }</td>

                <td>${ cuota.seguro_vehiculo ?? "" }</td>

                <td>${ cuota.seguro_vida ?? "" }</td>

                <td>${ cuota.valor_total_cuota ?? "" }</td>

                <td style="white-space:normal">${ magisEscape(cuota.nombre_cliente || "Cliente no disponible") }</td>
                <td>
                    ${ magisEscape(cuota.numero_credito || "Número no disponible") }
                </td>

                <td>
                    ${ cuota.plan_generado ? `<button class="boton-editar" onclick="mostrarPlanCuotas(${ Number(cuota.codigo_credito) })">Ver plan</button>` : `
                    <button
                        class="boton-editar"
                        onclick="editarCuota(${ cuota.codigo_cuota })">
                        Editar
                    </button>

                    <button
                        class="boton-eliminar"
                        onclick="eliminarCuota(${ cuota.codigo_cuota })">
                        Eliminar
                    </button>` }

                </td>

            </tr>
        `;
    });
    const tbody = document.getElementById("tbodyCuotas");
    tbody.innerHTML = filas;
    actualizarInfoPaginacionCuotas(inicio, fin, totalCuotas);
    crearBotonesPaginacionCuotas(totalPaginas);
}


function actualizarInfoPaginacionCuotas(inicio, fin, total) {
    const info = document.getElementById("infoPaginacionCuotas");
    if (total === 0) {
        info.textContent = "No hay cuotas para mostrar";
        return;
    }
    const inicioMostrar = inicio + 1;
    const finMostrar = Math.min(fin, total);
    const paginaActual = window.paginaActualCuotas ?? 1;
    const cuotasPorPagina = window.cuotasPorPagina ?? 15;
    const totalPaginas = Math.max(1, Math.ceil(total / cuotasPorPagina));
    info.textContent = `Mostrando ${ inicioMostrar } - ${ finMostrar } de ${ total } | Página ${ paginaActual } de ${ totalPaginas }`;
}


// Creamos los botones para pasar de una página de cuotas a otra.
function crearBotonesPaginacionCuotas(totalPaginas) {
    const contenedor = document.getElementById("botonesPaginacionCuotas");
    let botones = "";
    botones += `
        <button
            onclick="cambiarPaginaCuotas(
                ${ window.paginaActualCuotas - 1 }
            )"
            ${ window.paginaActualCuotas === 1 ? "disabled" : "" }>
            Anterior
        </button>
    `;
    for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        botones += `
            <button
                class="${ pagina === window.paginaActualCuotas ? "pagina-activa" : "" }"
                onclick="cambiarPaginaCuotas(${ pagina })">
                ${ pagina }
            </button>
        `;
    }
    botones += `
        <button
            onclick="cambiarPaginaCuotas(
                ${ window.paginaActualCuotas + 1 }
            )"
            ${ window.paginaActualCuotas === totalPaginas ? "disabled" : "" }>
            Siguiente
        </button>
    `;
    contenedor.innerHTML = botones;
}


// Revisamos la página escogida y actualizamos las filas de la tabla.
function cambiarPaginaCuotas(pagina) {
    const cuotas = window.cuotasFiltradas ?? [];
    const cuotasPorPagina = window.cuotasPorPagina ?? 15;
    const totalPaginas = Math.max(1, Math.ceil(cuotas.length / cuotasPorPagina));
    if (pagina < 1 || pagina > totalPaginas) {
        return;
    }
    window.paginaActualCuotas = pagina;
    renderizarPaginaCuotas();
    const contenido = document.getElementById("contenido");
    contenido.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// Aquí solo mostramos el plan que calcula la API; las cuotas aún no se guardan en la vista previa.
function prepararVistaPreviaCredito(formulario) {
    for (const [campo, minimo, maximo] of [["monto", "0.01", "99999999.99"], ["plazo", "1", "1200"], ["tasa_intereses", "0", "999.99"]]) {
        formulario.querySelector(`#${ campo }`).min = minimo;
        formulario.querySelector(`#${ campo }`).max = maximo;
    }
    formulario.querySelector("#plazo").step = "1";
    const vista = formulario.querySelector("#previewPlanCredito");
    const boton = formulario.querySelector("#previsualizarPlanCredito");
    let revision = 0;
    const cambiar = () => {
        revision++;
        if (vista.textContent) vista.textContent = "Cambiaste los datos. Vuelve a consultar la vista previa para ver el plan actualizado.";
    };
    formulario.addEventListener("input", cambiar);
    formulario.addEventListener("change", cambiar);
    boton.addEventListener("click", async () => {
        if (formulario.enviandoDatos || !formulario.reportValidity()) return;
        const actual = revision;
        const guardar = formulario.querySelector('[type="submit"]');
        const estabaDeshabilitado = guardar.disabled;
        const valor = id => formulario.querySelector(`#${ id }`).value;
        const datos = Object.fromEntries(["codigo_credito", "numero_credito", "fecha_credito", "estado", "monto", "plazo",
            "tasa_intereses", "porcentaje_comision", "codigo_garantia", "codigo_vendedor", "codigo_deudor"].map(id => [id, valor(id)]));
        datos.seguro_vehiculo = valor("seguro_vehiculo_credito");
        datos.seguro_vida = valor("seguro_vida_credito");
        boton.disabled = true;
        guardar.disabled = true;
        vista.textContent = "Calculando el plan completo...";
        try {
            const plan = await solicitarGestion("creditos/plan/preview", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos)
            });
            if (!formulario.isConnected || actual !== revision) return;
            vista.innerHTML = '<h3>Vista previa: todavía no guardada</h3>' + htmlPlanCuotas(plan);
        } catch (error) {
            if (formulario.isConnected && actual === revision) mostrarErrorGestion(vista, error);
        } finally {
            if (formulario.isConnected && !formulario.enviandoDatos) {
                boton.disabled = false;
                guardar.disabled = estabaDeshabilitado;
            }
        }
    });
}

// La misma tabla sirve para la vista previa y para consultar el historial guardado.
function htmlPlanCuotas(plan) {
    const credito = plan.credito || {};
    const resumen = plan.resumen || { cantidad_cuotas: plan.cuotas.length, capital: credito.capital_plan,
        total_intereses: credito.intereses_plan, total_recaudable: credito.total_plan };
    const columnas = ["Cuota", "Fecha plan", "Vencimiento", "Capital", "Intereses", "Manejo", "Seguro vehículo", "Seguro vida", "Total"];
    const guardado = Boolean(plan.credito);
    if (guardado) columnas.push("Pagado", "Pendiente");
    return tablaGestion(["Concepto", "Importe"], [
        ["Cantidad de cuotas", resumen.cantidad_cuotas], ["Capital del plan", magisMoney(resumen.capital)],
        ["Intereses programados", magisMoney(resumen.total_intereses)], ["Total recaudable (incluye manejo y seguros)", magisMoney(resumen.total_recaudable)]
    ]) + tablaGestion(columnas, plan.cuotas.map(cuota => {
        const fila = [cuota.numero_cuota, formatearFechaMostrar(cuota.fecha_plan), formatearFechaMostrar(cuota.fecha_vencimiento),
            magisMoney(cuota.capital), magisMoney(cuota.intereses), magisMoney(cuota.manejo_cuenta),
            magisMoney(cuota.seguro_vehiculo), magisMoney(cuota.seguro_vida), magisMoney(cuota.valor_total_cuota)];
        if (guardado) fila.push(magisMoney(cuota.total_pagado), magisMoney(cuota.saldo_pendiente));
        return fila;
    }));
}

async function mostrarPlanCuotas(codigoCredito = "") {
    magisSelect("cuotas");
    const vista = crearVistaGestion("Plan de cuotas por crédito", "cargarCuotas()");
    try {
        const [creditos, deudores, personas] = await listasGestion(["creditos", "deudores", "personas"]);
        if (!vista.isConnected) return;
        const porDeudor = new Map(deudores.map(d => [String(d.codigo_deudor), d]));
        const porPersona = new Map(personas.map(p => [String(p.codigo_persona), p]));
        vista.innerHTML = `<div class="formulario"><div class="campo" style="grid-column:1/-1">
            <label for="creditoPlanCuotas">Crédito y cliente</label><select id="creditoPlanCuotas"><option value="">Selecciona un crédito</option>
            ${ creditos.map(c => {
                const deudor = porDeudor.get(String(c.codigo_deudor));
                const persona = deudor && porPersona.get(String(deudor.codigo_persona));
                const nombre = (persona && nombreCompletoGestion(persona)) || c.nombre_deudor || "Cliente no disponible";
                return `<option value="${ magisEscape(c.codigo_credito) }">${ magisEscape(c.numero_credito || c.codigo_credito) } · ${ magisEscape(nombre) }</option>`;
            }).join("") }</select></div><button type="button" class="boton-editar" id="consultarPlanCuotas">Consultar plan</button></div>
            <section id="resultadoPlanCuotas" aria-live="polite"><p>Selecciona el crédito cuyo plan deseas consultar.</p></section>`;
        const selector = vista.querySelector("#creditoPlanCuotas");
        const resultado = vista.querySelector("#resultadoPlanCuotas");
        let consulta = 0;
        let creditoMostrado = "";
        const cargar = async () => {
            const actual = ++consulta;
            const codigo = selector.value;
            if (!codigo) { resultado.textContent = "Selecciona un crédito."; return; }
            resultado.textContent = "Consultando cuotas y pagos...";
            try {
                const plan = await solicitarGestion(`creditos/${ codigo }/plan`);
                if (!vista.isConnected || actual !== consulta) return;
                const credito = plan.credito;
                creditoMostrado = codigo;
                resultado.innerHTML = `<h3>${ magisEscape(credito.numero_credito) }</h3>
                    <p>Estado: ${ magisEscape(credito.estado) }. Plazo: ${ magisEscape(credito.plazo) } meses.
                    Tasa anual: ${ magisEscape(credito.tasa_intereses) }%.</p>
                    <p>${ plan.completo ? "Plan completo registrado." : `Plan incompleto: ${ plan.cuotas.length } de ${ magisEscape(credito.plazo) } cuotas registradas.` }
                    ${ credito.plan_generado ? "Generado automáticamente al aprobar el crédito." : "Registro histórico: se conservan sus importes originales." }</p>
                    ${ htmlPlanCuotas(plan) }`;
                if (!plan.cuotas.length && String(credito.estado).trim().toLowerCase() === "activo") {
                    resultado.insertAdjacentHTML("beforeend", `<h3>Generar plan del crédito sin cuotas</h3>
                        <p>Se crearán ${ magisEscape(credito.plazo) } cuotas mensuales con capital fijo, tasa anual sobre saldos y manejo de Q25.00.</p>
                        <form id="formGenerarPlanCuotas" class="formulario">
                            <div class="campo"><label for="seguroVehiculoPlan">Seguro mensual del vehículo</label>
                                <input id="seguroVehiculoPlan" type="number" min="0.01" max="99999999.99" step="0.01" required></div>
                            <div class="campo"><label for="seguroVidaPlan">Seguro mensual de vida</label>
                                <input id="seguroVidaPlan" type="number" min="0" max="99999999.99" step="0.01" required></div>
                            <button type="submit" class="boton-guardar">Generar plan completo</button>
                            <p role="status" id="estadoGenerarPlanCuotas"></p>
                        </form>`);
                    const formulario = resultado.querySelector("#formGenerarPlanCuotas");
                    formulario.addEventListener("submit", protegerEnvioFormulario(async event => {
                        event.preventDefault();
                        const seguimiento = capturarFormularioParaGuardar();
                        const estado = formulario.querySelector("#estadoGenerarPlanCuotas");
                        estado.textContent = "Generando todas las cuotas...";
                        try {
                            await solicitarGestion(`creditos/${ codigo }/plan`, { method: "POST",
                                headers: { "Content-Type": "application/json" }, body: JSON.stringify({
                                    seguro_vehiculo: formulario.querySelector("#seguroVehiculoPlan").value,
                                    seguro_vida: formulario.querySelector("#seguroVidaPlan").value
                                }) });
                            confirmarFormularioGuardado(seguimiento);
                            if (vista.isConnected && actual === consulta) await cargar();
                        } catch (error) {
                            if (formulario.isConnected) { estado.className = "mensaje-error"; estado.textContent = error.message; }
                        }
                    }));
                } else if (!plan.completo && plan.cuotas.length) {
                    resultado.insertAdjacentHTML("beforeend", "<p class=\"mensaje-error\">Este crédito ya tiene un plan parcial. Se conserva su historial; no se genera otro plan encima.</p>");
                }
            } catch (error) { if (vista.isConnected && actual === consulta) mostrarErrorGestion(resultado, error); }
        };
        const consultar = () => {
            if (!confirmarSalidaFormulario()) { selector.value = creditoMostrado; return; }
            return cargar();
        };
        selector.addEventListener("change", consultar);
        vista.querySelector("#consultarPlanCuotas").addEventListener("click", consultar);
        if (codigoCredito !== "") { selector.value = String(codigoCredito); await cargar(); }
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Las cuotas nuevas se generan como plan completo; esta entrada abre su consulta.
function mostrarFormularioCuota() {
    return mostrarPlanCuotas();
}

// Sumamos en centavos para que operaciones como 0.10 + 0.20 den exactamente 0.30.
function calcularTotalCuota(importes) {
    let centavos = 0;
    for (const importe of importes) {
        if (String(importe ?? "").trim() === "") throw new Error("Completa los cinco importes. Escribe 0 en los cargos que no apliquen.");
        const numero = Number(importe);
        if (!Number.isFinite(numero) || numero < 0 || numero > 99999999.99) throw new Error("Los importes deben estar entre 0 y 99999999.99.");
        if (Number(numero.toFixed(2)) !== numero) throw new Error("Usa como máximo dos decimales en cada importe.");
        centavos += Math.round(numero * 100);
    }
    if (centavos > 9999999999) throw new Error("El total de la cuota no puede superar 99999999.99.");
    return (centavos / 100).toFixed(2);
}

// El total es de solo lectura: se calcula al escribir y se revisa otra vez antes de enviarlo.
function actualizarTotalAutomaticoCuota(formulario) {
    const total = formulario.querySelector("#valor_total_cuota");
    const aviso = formulario.querySelector("[data-total-cuota]");
    try {
        total.value = calcularTotalCuota(["capital", "intereses", "manejo_cuenta", "seguro_vehiculo", "seguro_vida"]
            .map(campo => formulario.querySelector(`#${ campo }`).value));
        aviso.className = "";
        aviso.textContent = "Total calculado: capital + intereses + manejo de cuenta + seguro del vehículo + seguro de vida.";
        return true;
    } catch (error) {
        total.value = "";
        aviso.textContent = error.message;
        aviso.className = "mensaje-error";
        return false;
    }
}

function prepararTotalAutomaticoCuota(formulario) {
    const total = formulario.querySelector("#valor_total_cuota");
    total.readOnly = true;
    const aviso = document.createElement("p");
    aviso.dataset.totalCuota = "";
    aviso.id = `${ formulario.id }-aviso-total`;
    aviso.setAttribute("role", "status");
    total.setAttribute("aria-describedby", aviso.id);
    total.parentElement.append(aviso);
    for (const nombre of ["capital", "intereses", "manejo_cuenta", "seguro_vehiculo", "seguro_vida"]) {
        const campo = formulario.querySelector(`#${ nombre }`);
        campo.min = "0";
        campo.max = "99999999.99";
        campo.addEventListener("input", () => actualizarTotalAutomaticoCuota(formulario));
        campo.addEventListener("change", () => actualizarTotalAutomaticoCuota(formulario));
    }
    actualizarTotalAutomaticoCuota(formulario);
}


async function registrarCuota(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    if (!actualizarTotalAutomaticoCuota(document.getElementById("formCuota"))) return;
    const cuota = {
        codigo_cuota: parseInt(document.getElementById("codigo_cuota").value),
        numero_cuota: parseInt(document.getElementById("numero_cuota").value),
        fecha_plan: document.getElementById("fecha_plan").value,
        fecha_vencimiento: document.getElementById("fecha_vencimiento").value,
        capital: parseFloat(document.getElementById("capital").value),
        intereses: parseFloat(document.getElementById("intereses").value),
        manejo_cuenta: parseFloat(document.getElementById("manejo_cuenta").value),
        seguro_vehiculo: parseFloat(document.getElementById("seguro_vehiculo").value),
        seguro_vida: parseFloat(document.getElementById("seguro_vida").value),
        valor_total_cuota: parseFloat(document.getElementById("valor_total_cuota").value),
        codigo_credito: parseInt(document.getElementById("codigo_credito").value)
    };
    try {
        const respuesta = await fetch(`${ API }/cuotas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuota)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar la cuota");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Cuota registrada correctamente");
        cargarCuotas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarCuota(codigoCuota) {
    try {
        const respuesta = await fetch(`${ API }/cuotas/${ codigoCuota }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información de la cuota");
            return;
        }
        const cuota = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar cuota</h2>

            <form id="formEditarCuota" class="formulario">

                <div class="campo">
                    <label>Código de cuota</label>
                    <input
                        type="number"
                        id="codigo_cuota"
                        value="${ cuota.codigo_cuota ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Número de cuota</label>
                    <input
                        type="number"
                        id="numero_cuota"
                        value="${ cuota.numero_cuota ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Fecha plan</label>
                    <input
                        type="date"
                        id="fecha_plan"
                        value="${ formatearFecha(cuota.fecha_plan) }"
                        required>
                </div>

                <div class="campo">
                    <label>Fecha vencimiento</label>
                    <input
                        type="date"
                        id="fecha_vencimiento"
                        value="${ formatearFecha(cuota.fecha_vencimiento) }"
                        required>
                </div>

                <div class="campo">
                    <label>Capital</label>
                    <input
                        type="number"
                        step="0.01"
                        id="capital"
                        value="${ cuota.capital ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Intereses</label>
                    <input
                        type="number"
                        step="0.01"
                        id="intereses"
                        value="${ cuota.intereses ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Manejo de cuenta</label>
                    <input
                        type="number"
                        step="0.01"
                        id="manejo_cuenta"
                        value="${ cuota.manejo_cuenta ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Seguro vehículo</label>
                    <input
                        type="number"
                        step="0.01"
                        id="seguro_vehiculo"
                        value="${ cuota.seguro_vehiculo ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Seguro vida</label>
                    <input
                        type="number"
                        step="0.01"
                        id="seguro_vida"
                        value="${ cuota.seguro_vida ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Valor total cuota</label>
                    <input
                        type="number"
                        step="0.01"
                        id="valor_total_cuota"
                        value="${ cuota.valor_total_cuota ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Código de crédito</label>
                    <input
                        type="number"
                        id="codigo_credito"
                        value="${ cuota.codigo_credito ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarCuotas()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarCuota").addEventListener("submit", function (event) {
            actualizarCuota(event, codigoCuota);
        });
        prepararTotalAutomaticoCuota(document.getElementById("formEditarCuota"));
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarCuota(event, codigoCuota) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    if (!actualizarTotalAutomaticoCuota(document.getElementById("formEditarCuota"))) return;
    const cuota = {
        numero_cuota: parseInt(document.getElementById("numero_cuota").value),
        fecha_plan: document.getElementById("fecha_plan").value,
        fecha_vencimiento: document.getElementById("fecha_vencimiento").value,
        capital: parseFloat(document.getElementById("capital").value),
        intereses: parseFloat(document.getElementById("intereses").value),
        manejo_cuenta: parseFloat(document.getElementById("manejo_cuenta").value),
        seguro_vehiculo: parseFloat(document.getElementById("seguro_vehiculo").value),
        seguro_vida: parseFloat(document.getElementById("seguro_vida").value),
        valor_total_cuota: parseFloat(document.getElementById("valor_total_cuota").value),
        codigo_credito: parseInt(document.getElementById("codigo_credito").value)
    };
    try {
        const respuesta = await fetch(`${ API }/cuotas/${ codigoCuota }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuota)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la cuota");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Cuota actualizada correctamente");
        cargarCuotas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarCuota(codigoCuota) {
    const confirmar = confirm(`¿Seguro que deseas eliminar la cuota ${ codigoCuota }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/cuotas/${ codigoCuota }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar la cuota");
            return;
        }
        alert("Cuota eliminada correctamente");
        cargarCuotas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Vendedores
// Mostramos los vendedores. Cada uno está relacionado con una persona.
async function cargarVendedores() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Vendedores</h2>
        <p>Cargando vendedores...</p>
    `;
    try {
        // Buscamos a la persona para mostrar su nombre completo junto al código.
        const [vendedores, personas] = await listasGestion(["vendedores", "personas"]);
        const personasPorCodigo = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
        let filas = "";
        vendedores.forEach(vendedor => {
            const persona = personasPorCodigo.get(String(vendedor.codigo_persona));
            const nombre = (persona && nombreCompletoGestion(persona)) || vendedor.nombre_persona || "Persona no disponible";
            filas += `
                <tr>
                    <td>${ vendedor.codigo_vendedor ?? "" }</td>
                    <td>${ vendedor.codigo_empleado ?? "" }</td>
                    <td style="white-space:normal"><strong>${ magisEscape(nombre) }</strong>
                        <span class="cell-sub">Código de persona: ${ magisEscape(vendedor.codigo_persona ?? "") }</span></td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarVendedor(${ vendedor.codigo_vendedor })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarVendedor(${ vendedor.codigo_vendedor })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Vendedores</h2>
                    <p>Vendedores registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioVendedor()">
                    + Nuevo vendedor
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código vendedor</th>
                            <th>Código empleado</th>
                            <th>Persona</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Vendedores</h2>

            <p class="mensaje-error">
                No fue posible cargar los vendedores.
            </p>
        `;
    }
}


// Escogemos a la persona que será vendedor o registramos una nueva.
async function mostrarFormularioVendedor(codigoPersona = "") {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo vendedor</h2>

        <form id="formVendedor" class="formulario">

            <div class="campo">
                <label>Código de vendedor</label>
                <input type="number" id="codigo_vendedor" required>
            </div>

            <div class="campo">
                <label>Código de empleado</label>
                <input type="text" id="codigo_empleado" required>
            </div>

            <div class="campo">
                <label for="codigo_persona">Persona</label>
                <select id="codigo_persona" required disabled><option value="">Cargando personas...</option></select>
                <button type="button" class="boton-nuevo" onclick="registrarPersonaDesdeRol('vendedor')">+ Registrar persona</button>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarVendedores()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar vendedor
                </button>

            </div>

        </form>
    `;
    document.getElementById("formVendedor").addEventListener("submit", registrarVendedor);
    await cargarPersonasParaRol("formVendedor", codigoPersona);
}


// Guardamos al vendedor usando el código de la persona que ya registramos.
async function registrarVendedor(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const vendedor = {
        codigo_vendedor: parseInt(document.getElementById("codigo_vendedor").value),
        codigo_empleado: document.getElementById("codigo_empleado").value,
        codigo_persona: parseInt(document.getElementById("codigo_persona").value)
    };
    try {
        const respuesta = await fetch(`${ API }/vendedores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vendedor)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el vendedor");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Vendedor registrado correctamente");
        cargarVendedores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarVendedor(codigoVendedor) {
    try {
        const respuesta = await fetch(`${ API }/vendedores/${ codigoVendedor }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del vendedor");
            return;
        }
        const vendedor = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar vendedor</h2>

            <form id="formEditarVendedor" class="formulario">

                <div class="campo">
                    <label>Código de vendedor</label>
                    <input
                        type="number"
                        id="codigo_vendedor"
                        value="${ vendedor.codigo_vendedor ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Código de empleado</label>
                    <input
                        type="text"
                        id="codigo_empleado"
                        value="${ vendedor.codigo_empleado ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Código de persona</label>
                    <input
                        type="number"
                        id="codigo_persona"
                        value="${ vendedor.codigo_persona ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarVendedores()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarVendedor").addEventListener("submit", function (event) {
            actualizarVendedor(event, codigoVendedor);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarVendedor(event, codigoVendedor) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const vendedor = {
        codigo_empleado: document.getElementById("codigo_empleado").value,
        codigo_persona: parseInt(document.getElementById("codigo_persona").value)
    };
    try {
        const respuesta = await fetch(`${ API }/vendedores/${ codigoVendedor }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(vendedor)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el vendedor");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Vendedor actualizado correctamente");
        cargarVendedores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarVendedor(codigoVendedor) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el vendedor ${ codigoVendedor }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/vendedores/${ codigoVendedor }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el vendedor");
            return;
        }
        alert("Vendedor eliminado correctamente");
        cargarVendedores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Deudores
// Mostramos a las personas registradas como deudores.
async function cargarDeudores() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Deudores</h2>
        <p>Cargando deudores...</p>
    `;
    try {
        // Relacionamos cada deudor con su persona para mostrar el nombre y no solo el código.
        const [deudores, personas] = await listasGestion(["deudores", "personas"]);
        if (!contenido.isConnected || document.getElementById("contenido") !== contenido || !contenido.querySelector("h2")?.textContent.includes("Deudores")) return;
        const personasPorCodigo = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
        let filas = "";
        deudores.forEach(deudor => {
            const persona = personasPorCodigo.get(String(deudor.codigo_persona));
            const nombre = (persona && nombreCompletoGestion(persona)) || deudor.nombre_persona || "Persona no disponible";
            filas += `
                <tr>
                    <td>${ deudor.codigo_deudor ?? "" }</td>
                    <td style="white-space:normal"><strong>${ magisEscape(nombre) }</strong>
                        <span class="cell-sub">Código de persona: ${ magisEscape(deudor.codigo_persona ?? "") }</span></td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarDeudor(${ deudor.codigo_deudor })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarDeudor(${ deudor.codigo_deudor })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Deudores</h2>
                    <p>Deudores registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioDeudor()">
                    + Nuevo deudor
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código deudor</th>
                            <th>Persona</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Deudores</h2>

            <p class="mensaje-error">
                No fue posible cargar los deudores.
            </p>
        `;
    }
}



// Escogemos a la persona que vamos a registrar como deudor.
async function mostrarFormularioDeudor(codigoPersona = "") {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo deudor</h2>

        <form id="formDeudor" class="formulario">

            <div class="campo">
                <label>Código de deudor</label>
                <input type="number" id="codigo_deudor" required>
            </div>

            <div class="campo">
                <label for="codigo_persona">Persona</label>
                <select id="codigo_persona" required disabled><option value="">Cargando personas...</option></select>
                <button type="button" class="boton-nuevo" onclick="registrarPersonaDesdeRol('deudor')">+ Registrar persona</button>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarDeudores()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar deudor
                </button>

            </div>

        </form>
    `;
    document.getElementById("formDeudor").addEventListener("submit", registrarDeudor);
    await cargarPersonasParaRol("formDeudor", codigoPersona);
}


// Enviamos el código del deudor y el de la persona a la API.
async function registrarDeudor(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const deudor = {
        codigo_deudor: parseInt(document.getElementById("codigo_deudor").value),
        codigo_persona: parseInt(document.getElementById("codigo_persona").value)
    };
    try {
        const respuesta = await fetch(`${ API }/deudores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deudor)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el deudor");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Deudor registrado correctamente");
        cargarDeudores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarDeudor(codigoDeudor) {
    try {
        const respuesta = await fetch(`${ API }/deudores/${ codigoDeudor }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del deudor");
            return;
        }
        const deudor = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar deudor</h2>

            <form id="formEditarDeudor" class="formulario">

                <div class="campo">
                    <label>Código de deudor</label>
                    <input
                        type="number"
                        id="codigo_deudor"
                        value="${ deudor.codigo_deudor ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Código de persona</label>
                    <input
                        type="number"
                        id="codigo_persona"
                        value="${ deudor.codigo_persona ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarDeudores()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarDeudor").addEventListener("submit", function (event) {
            actualizarDeudor(event, codigoDeudor);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarDeudor(event, codigoDeudor) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const deudor = { codigo_persona: parseInt(document.getElementById("codigo_persona").value) };
    try {
        const respuesta = await fetch(`${ API }/deudores/${ codigoDeudor }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deudor)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el deudor");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Deudor actualizado correctamente");
        cargarDeudores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarDeudor(codigoDeudor) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el deudor ${ codigoDeudor }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/deudores/${ codigoDeudor }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el deudor");
            return;
        }
        alert("Deudor eliminado correctamente");
        cargarDeudores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Fiadores
// Mostramos a las personas registradas como fiadores.
async function cargarFiadores() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Fiadores</h2>
        <p>Cargando fiadores...</p>
    `;
    try {
        // Relacionamos los fiadores con sus datos personales.
        const [fiadores, personas] = await listasGestion(["fiadores", "personas"]);
        const personasPorCodigo = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
        let filas = "";
        fiadores.forEach(fiador => {
            const persona = personasPorCodigo.get(String(fiador.codigo_persona));
            const nombre = (persona && nombreCompletoGestion(persona)) || fiador.nombre_persona || "Persona no disponible";
            filas += `
                <tr>
                    <td>${ fiador.codigo_fiador ?? "" }</td>
                    <td style="white-space:normal"><strong>${ magisEscape(nombre) }</strong>
                        <span class="cell-sub">Código de persona: ${ magisEscape(fiador.codigo_persona ?? "") }</span></td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarFiador(${ fiador.codigo_fiador })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarFiador(${ fiador.codigo_fiador })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Fiadores</h2>
                    <p>Fiadores registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioFiador()">
                    + Nuevo fiador
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código fiador</th>
                            <th>Persona</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Fiadores</h2>

            <p class="mensaje-error">
                No fue posible cargar los fiadores.
            </p>
        `;
    }
}



// Escogemos una persona para registrarla como fiador.
async function mostrarFormularioFiador(codigoPersona = "") {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo fiador</h2>

        <form id="formFiador" class="formulario">

            <div class="campo">
                <label>Código de fiador</label>
                <input type="number" id="codigo_fiador" required>
            </div>

            <div class="campo">
                <label for="codigo_persona">Persona</label>
                <select id="codigo_persona" required disabled><option value="">Cargando personas...</option></select>
                <button type="button" class="boton-nuevo" onclick="registrarPersonaDesdeRol('fiador')">+ Registrar persona</button>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarFiadores()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar fiador
                </button>

            </div>

        </form>
    `;
    document.getElementById("formFiador").addEventListener("submit", registrarFiador);
    await cargarPersonasParaRol("formFiador", codigoPersona);
}


// Guardamos al fiador. Después podemos asociarlo a un crédito.
async function registrarFiador(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const fiador = {
        codigo_fiador: parseInt(document.getElementById("codigo_fiador").value),
        codigo_persona: parseInt(document.getElementById("codigo_persona").value)
    };
    try {
        const respuesta = await fetch(`${ API }/fiadores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fiador)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el fiador");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Fiador registrado correctamente");
        cargarFiadores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarFiador(codigoFiador) {
    try {
        const respuesta = await fetch(`${ API }/fiadores/${ codigoFiador }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del fiador");
            return;
        }
        const fiador = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar fiador</h2>

            <form id="formEditarFiador" class="formulario">

                <div class="campo">
                    <label>Código de fiador</label>
                    <input
                        type="number"
                        id="codigo_fiador"
                        value="${ fiador.codigo_fiador ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Código de persona</label>
                    <input
                        type="number"
                        id="codigo_persona"
                        value="${ fiador.codigo_persona ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarFiadores()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarFiador").addEventListener("submit", function (event) {
            actualizarFiador(event, codigoFiador);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarFiador(event, codigoFiador) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const fiador = { codigo_persona: parseInt(document.getElementById("codigo_persona").value) };
    try {
        const respuesta = await fetch(`${ API }/fiadores/${ codigoFiador }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fiador)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el fiador");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Fiador actualizado correctamente");
        cargarFiadores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarFiador(codigoFiador) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el fiador ${ codigoFiador }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/fiadores/${ codigoFiador }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el fiador");
            return;
        }
        alert("Fiador eliminado correctamente");
        cargarFiadores();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Referencias
// Mostramos las referencias y su tipo. Aquí todavía no las asociamos a un crédito.
async function cargarReferencias() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Referencias</h2>
        <p>Cargando referencias...</p>
    `;
    try {
        // Mostramos el nombre de la persona registrada como referencia.
        const [referencias, personas, tipos] = await listasGestion(["referencias", "personas", "tipos-referencia"]);
        const personasPorCodigo = new Map(personas.map(persona => [String(persona.codigo_persona), persona]));
        const tiposPorCodigo = new Map(tipos.map(tipo => [String(tipo.codigo_tipo_referencia), tipo]));
        let filas = "";
        referencias.forEach(referencia => {
            const persona = personasPorCodigo.get(String(referencia.codigo_persona));
            const nombre = (persona && nombreCompletoGestion(persona)) || referencia.nombre_persona || "Persona no disponible";
            // Mostramos la descripción del catálogo en lugar del código del tipo.
            const tipo = tiposPorCodigo.get(String(referencia.codigo_tipo_referencia));
            const nombreTipo = tipo?.descripcion || referencia.nombre_tipo_referencia || "Tipo no disponible";
            filas += `
                <tr>
                    <td>${ referencia.codigo_referencia ?? "" }</td>
                    <td style="white-space:normal"><strong>${ magisEscape(nombre) }</strong>
                        <span class="cell-sub">Código de persona: ${ magisEscape(referencia.codigo_persona ?? "") }</span></td>
                    <td>${ magisEscape(nombreTipo) }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarReferencia(${ referencia.codigo_referencia })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarReferencia(${ referencia.codigo_referencia })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Referencias</h2>
                    <p>Referencias registradas en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioReferencia()">
                    + Nueva referencia
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código referencia</th>
                            <th>Persona</th>
                            <th>Tipo de referencia</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Referencias</h2>

            <p class="mensaje-error">
                No fue posible cargar las referencias.
            </p>
        `;
    }
}


// Cargamos las personas, los tipos y los códigos usados antes de registrar la referencia.
async function mostrarFormularioReferencia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nueva referencia</h2>

        <form id="formReferencia" class="formulario">

            <p id="estadoFormularioReferencia" role="status">Cargando personas, tipos y códigos de referencia...</p>

            <div class="campo">
                <label for="codigo_referencia">Código de referencia (único)</label>
                <input type="number" id="codigo_referencia" step="1" aria-describedby="ayudaCodigoReferencia codigosReferencia" required>
                <small id="ayudaCodigoReferencia">Ingresa un número entero que no esté registrado. Este código identifica la referencia y es distinto del código de persona.</small>
                <small id="codigosReferencia" role="status">Consultando códigos registrados...</small>
            </div>

            <div class="campo">
                <label for="codigo_persona">Persona</label>
                <select id="codigo_persona" required disabled>
                    <option value="">Seleccione una persona</option>
                </select>
            </div>

            <div class="campo">
                <label for="codigo_tipo_referencia">Tipo de referencia</label>
                <select id="codigo_tipo_referencia" required disabled>
                    <option value="">Seleccione un tipo de referencia</option>
                </select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReferencias()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar" disabled>
                    Guardar referencia
                </button>

            </div>

        </form>
    `;
    const formulario = document.getElementById("formReferencia");
    formulario.addEventListener("submit", registrarReferencia);
    const estado = document.getElementById("estadoFormularioReferencia");
    try {
        const resultados = await Promise.allSettled([
            fetch(`${ API }/personas`).then(async respuesta => {
                if (!respuesta.ok) throw new Error("No se pudieron cargar las personas");
                return respuesta.json();
            }),
            fetch(`${ API }/tipos-referencia`).then(async respuesta => {
                if (!respuesta.ok) throw new Error("No se pudieron cargar los tipos de referencia");
                return respuesta.json();
            }),
            fetch(`${ API }/referencias`).then(async respuesta => {
                if (!respuesta.ok) throw new Error("No se pudieron cargar los códigos de referencia");
                return respuesta.json();
            })
        ]);
        // Si ya salimos del formulario, no cambiamos la pantalla que estamos viendo.
        if (document.getElementById("formReferencia") !== formulario) return;
        const fallo = resultados.find(resultado => resultado.status === "rejected");
        if (fallo) throw fallo.reason;
        const [personas, tipos, referencias] = resultados.map(resultado => resultado.value);
        if (!Array.isArray(personas) || !Array.isArray(tipos) || !Array.isArray(referencias)) {
            throw new Error("La API no devolvió listas válidas");
        }
        mostrarCodigosReferencia(referencias);
        if (!personas.length || !tipos.length) {
            estado.textContent = !personas.length
                ? "Registra primero una persona en Clientes para agregar una referencia."
                : "Registra primero un tipo de referencia en Catálogos.";
            return;
        }
        const selectorPersona = document.getElementById("codigo_persona");
        const selectorTipo = document.getElementById("codigo_tipo_referencia");
        selectorPersona.innerHTML += personas.map(persona => {
            const nombre = [persona.primer_nombre, persona.segundo_nombre,
                persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" ");
            return `<option value="${ magisEscape(persona.codigo_persona) }">${ magisEscape(nombre || persona.nombre_persona || "Persona") } (${ magisEscape(persona.codigo_persona) })</option>`;
        }).join("");
        selectorTipo.innerHTML += tipos.map(tipo =>
            `<option value="${ magisEscape(tipo.codigo_tipo_referencia) }">${ magisEscape(tipo.descripcion || "Tipo de referencia") } (${ magisEscape(tipo.codigo_tipo_referencia) })</option>`
        ).join("");
        selectorPersona.disabled = false;
        selectorTipo.disabled = false;
        formulario.querySelector('[type="submit"]').disabled = false;
        estado.textContent = "Selecciona la persona y el tipo de referencia.";
    } catch (error) {
        if (document.getElementById("formReferencia") !== formulario) return;
        console.error(error);
        estado.className = "mensaje-error";
        estado.textContent = "No fue posible cargar las opciones. Vuelve a Referencias e intenta nuevamente.";
        document.getElementById("codigosReferencia").textContent = "No se pudieron verificar los códigos registrados.";
    }
}


// Mostramos los códigos que ya existen para no escoger uno repetido.
function mostrarCodigosReferencia(referencias) {
    const codigos = referencias.map(referencia => referencia.codigo_referencia)
        .sort((a, b) => Number(a) - Number(b));
    document.getElementById("codigosReferencia").textContent = codigos.length
        ? `Códigos registrados: ${ codigos.join(", ") }. Elige un código diferente.`
        : "Todavía no hay referencias registradas. Puedes elegir el primer código.";
}


// Revisamos otra vez si el código existe antes de guardar la referencia.
// La base de datos también tiene que impedir que se repita.
async function registrarReferencia(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const formulario = document.getElementById("formReferencia");
    const boton = formulario.querySelector('[type="submit"]');
    if (boton.disabled) return;
    const campoCodigo = document.getElementById("codigo_referencia");
    const codigo = Number(campoCodigo.value);
    if (!campoCodigo.value.trim() || !Number.isSafeInteger(codigo)) {
        alert("Ingresa un número entero válido como código de referencia.");
        campoCodigo.focus();
        return;
    }
    const referencia = {
        codigo_referencia: codigo,
        codigo_persona: parseInt(document.getElementById("codigo_persona").value),
        codigo_tipo_referencia: parseInt(document.getElementById("codigo_tipo_referencia").value)
    };
    boton.disabled = true;
    try {
        // Volvemos a consultar por si alguien ya registró ese código.
        const consulta = await fetch(`${ API }/referencias`);
        if (!consulta.ok) throw new Error("No se pudieron verificar los códigos de referencia");
        const referencias = await consulta.json();
        if (!Array.isArray(referencias)) throw new Error("La API no devolvió una lista válida");
        if (document.getElementById("formReferencia") !== formulario) return;
        mostrarCodigosReferencia(referencias);
        if (referencias.some(item => Number(item.codigo_referencia) === codigo)) {
            alert(`El código de referencia ${ codigo } ya está registrado. Ingresa uno diferente.`);
            campoCodigo.focus();
            return;
        }
        const respuesta = await fetch(`${ API }/referencias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(referencia)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar la referencia");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Referencia registrada correctamente");
        cargarReferencias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    } finally {
        boton.disabled = false;
    }
}


async function editarReferencia(codigoReferencia) {
    try {
        const respuesta = await fetch(`${ API }/referencias/${ codigoReferencia }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información de la referencia");
            return;
        }
        const referencia = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar referencia</h2>

            <form id="formEditarReferencia" class="formulario">

                <div class="campo">
                    <label>Código de referencia</label>
                    <input
                        type="number"
                        id="codigo_referencia"
                        value="${ referencia.codigo_referencia ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Código de persona</label>
                    <input
                        type="number"
                        id="codigo_persona"
                        value="${ referencia.codigo_persona ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Tipo de referencia</label>
                    <input
                        type="number"
                        id="codigo_tipo_referencia"
                        value="${ referencia.codigo_tipo_referencia ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarReferencias()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarReferencia").addEventListener("submit", function (event) {
            actualizarReferencia(event, codigoReferencia);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarReferencia(event, codigoReferencia) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const referencia = {
        codigo_persona: parseInt(document.getElementById("codigo_persona").value),
        codigo_tipo_referencia: parseInt(document.getElementById("codigo_tipo_referencia").value)
    };
    try {
        const respuesta = await fetch(`${ API }/referencias/${ codigoReferencia }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(referencia)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la referencia");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Referencia actualizada correctamente");
        cargarReferencias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarReferencia(codigoReferencia) {
    const confirmar = confirm(`¿Seguro que deseas eliminar la referencia ${ codigoReferencia }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/referencias/${ codigoReferencia }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar la referencia");
            return;
        }
        alert("Referencia eliminada correctamente");
        cargarReferencias();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Catálogos del sistema
// Aquí están los datos que usamos en las listas: marcas, tipos, lugares y medios de pago.
function cargarCatalogos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <div class="encabezado-modulo">
            <div>
                <h2>Catálogos</h2>
                <p>Selecciona el catálogo que deseas administrar.</p>
            </div>
        </div>

        <div class="grid-catalogos">

            <button onclick="cargarMarcas()">
                Marcas
            </button>

            <button onclick="cargarLineas()">
                Líneas
            </button>

            <button onclick="cargarTiposTelefono()">
                Tipos de teléfono
            </button>

            <button onclick="cargarTiposDireccion()">
                Tipos de dirección
            </button>

            <button onclick="cargarDepartamentos()">
                Departamentos
            </button>

            <button onclick="cargarMunicipios()">
                Municipios
            </button>

            <button onclick="cargarTiposReferencia()">
                Tipos de referencia
            </button>

            <button onclick="cargarTiposGarantia()">
                Tipos de garantía
            </button>

            <button onclick="cargarMediosPago()">
                Medios de pago
            </button>

        </div>
    `;
}


async function cargarMarcas() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Marcas</h2>
        <p>Cargando marcas...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/marcas`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las marcas");
        }
        const marcas = await respuesta.json();
        let filas = "";
        marcas.forEach(marca => {
            filas += `
                <tr>
                    <td>${ marca.codigo_marca ?? "" }</td>
                    <td>${ marca.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarMarca(${ marca.codigo_marca })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarMarca(${ marca.codigo_marca })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Marcas</h2>
                    <p>Marcas registradas en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioMarca()">
                    + Nueva marca
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Marcas</h2>
            <p class="mensaje-error">
                No fue posible cargar las marcas.
            </p>
        `;
    }
}


function mostrarFormularioMarca() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nueva marca</h2>

        <form id="formMarca" class="formulario">

            <div class="campo">
                <label>Código de marca</label>
                <input type="number" id="codigo_marca" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarMarcas()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar marca
                </button>

            </div>

        </form>
    `;
    document.getElementById("formMarca").addEventListener("submit", registrarMarca);
}


async function registrarMarca(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const marca = {
        codigo_marca: parseInt(document.getElementById("codigo_marca").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/marcas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(marca)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar la marca");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Marca registrada correctamente");
        cargarMarcas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarMarca(codigoMarca) {
    try {
        const respuesta = await fetch(`${ API }/marcas/${ codigoMarca }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información de la marca");
            return;
        }
        const marca = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar marca</h2>

            <form id="formEditarMarca" class="formulario">

                <div class="campo">
                    <label>Código de marca</label>
                    <input
                        type="number"
                        id="codigo_marca"
                        value="${ marca.codigo_marca ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ marca.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarMarcas()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarMarca").addEventListener("submit", function (event) {
            actualizarMarca(event, codigoMarca);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarMarca(event, codigoMarca) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const marca = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/marcas/${ codigoMarca }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(marca)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la marca");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Marca actualizada correctamente");
        cargarMarcas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



async function eliminarMarca(codigoMarca) {
    const confirmar = confirm(`¿Seguro que deseas eliminar la marca ${ codigoMarca }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/marcas/${ codigoMarca }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar la marca");
            return;
        }
        alert("Marca eliminada correctamente");
        cargarMarcas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarLineas() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Líneas</h2>
        <p>Cargando líneas...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/lineas`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar las líneas");
        }
        const lineas = await respuesta.json();
        let filas = "";
        lineas.forEach(linea => {
            filas += `
                <tr>
                    <td>${ linea.codigo_linea ?? "" }</td>
                    <td>${ linea.descripcion ?? "" }</td>
                    <td>${ linea.nombre_marca ?? linea.codigo_marca ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarLinea(${ linea.codigo_linea })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarLinea(${ linea.codigo_linea })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Líneas</h2>
                    <p>Líneas registradas en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioLinea()">
                    + Nueva línea
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Marca</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Líneas</h2>

            <p class="mensaje-error">
                No fue posible cargar las líneas.
            </p>
        `;
    }
}


function mostrarFormularioLinea() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nueva línea</h2>

        <form id="formLinea" class="formulario">

            <div class="campo">
                <label>Código de línea</label>
                <input type="number" id="codigo_linea" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="campo">
                <label>Código de marca</label>
                <input type="number" id="codigo_marca" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarLineas()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar línea
                </button>

            </div>

        </form>
    `;
    document.getElementById("formLinea").addEventListener("submit", registrarLinea);
}


async function registrarLinea(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const linea = {
        codigo_linea: parseInt(document.getElementById("codigo_linea").value),
        descripcion: document.getElementById("descripcion").value,
        codigo_marca: parseInt(document.getElementById("codigo_marca").value)
    };
    try {
        const respuesta = await fetch(`${ API }/lineas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(linea)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar la línea");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Línea registrada correctamente");
        cargarLineas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarLinea(codigoLinea) {
    try {
        const respuesta = await fetch(`${ API }/lineas/${ codigoLinea }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información de la línea");
            return;
        }
        const linea = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar línea</h2>

            <form id="formEditarLinea" class="formulario">

                <div class="campo">
                    <label>Código de línea</label>
                    <input
                        type="number"
                        id="codigo_linea"
                        value="${ linea.codigo_linea ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ linea.descripcion ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Código de marca</label>
                    <input
                        type="number"
                        id="codigo_marca"
                        value="${ linea.codigo_marca ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarLineas()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarLinea").addEventListener("submit", function (event) {
            actualizarLinea(event, codigoLinea);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarLinea(event, codigoLinea) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const linea = {
        descripcion: document.getElementById("descripcion").value,
        codigo_marca: parseInt(document.getElementById("codigo_marca").value)
    };
    try {
        const respuesta = await fetch(`${ API }/lineas/${ codigoLinea }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(linea)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar la línea");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Línea actualizada correctamente");
        cargarLineas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarLinea(codigoLinea) {
    const confirmar = confirm(`¿Seguro que deseas eliminar la línea ${ codigoLinea }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/lineas/${ codigoLinea }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar la línea");
            return;
        }
        alert("Línea eliminada correctamente");
        cargarLineas();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarTiposTelefono() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Tipos de teléfono</h2>
        <p>Cargando tipos de teléfono...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/tipos-telefono`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los tipos de teléfono");
        }
        const tipos = await respuesta.json();
        let filas = "";
        tipos.forEach(tipo => {
            filas += `
                <tr>
                    <td>${ tipo.codigo_tipo_telefono ?? "" }</td>
                    <td>${ tipo.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarTipoTelefono(${ tipo.codigo_tipo_telefono })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarTipoTelefono(${ tipo.codigo_tipo_telefono })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Tipos de teléfono</h2>
                    <p>Tipos de teléfono registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioTipoTelefono()">
                    + Nuevo tipo
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Tipos de teléfono</h2>

            <p class="mensaje-error">
                No fue posible cargar los tipos de teléfono.
            </p>
        `;
    }
}


function mostrarFormularioTipoTelefono() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo tipo de teléfono</h2>

        <form id="formTipoTelefono" class="formulario">

            <div class="campo">
                <label>Código</label>
                <input type="number" id="codigo_tipo_telefono" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarTiposTelefono()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar tipo
                </button>

            </div>

        </form>
    `;
    document.getElementById("formTipoTelefono").addEventListener("submit", registrarTipoTelefono);
}


async function registrarTipoTelefono(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = {
        codigo_tipo_telefono: parseInt(document.getElementById("codigo_tipo_telefono").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/tipos-telefono`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el tipo de teléfono");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de teléfono registrado correctamente");
        cargarTiposTelefono();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarTipoTelefono(codigoTipoTelefono) {
    try {
        const respuesta = await fetch(`${ API }/tipos-telefono/${ codigoTipoTelefono }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del tipo de teléfono");
            return;
        }
        const tipo = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar tipo de teléfono</h2>

            <form id="formEditarTipoTelefono" class="formulario">

                <div class="campo">
                    <label>Código</label>
                    <input
                        type="number"
                        id="codigo_tipo_telefono"
                        value="${ tipo.codigo_tipo_telefono ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ tipo.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarTiposTelefono()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarTipoTelefono").addEventListener("submit", function (event) {
            actualizarTipoTelefono(event, codigoTipoTelefono);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarTipoTelefono(event, codigoTipoTelefono) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/tipos-telefono/${ codigoTipoTelefono }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el tipo de teléfono");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de teléfono actualizado correctamente");
        cargarTiposTelefono();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarTipoTelefono(codigoTipoTelefono) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el tipo de teléfono ${ codigoTipoTelefono }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/tipos-telefono/${ codigoTipoTelefono }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el tipo de teléfono");
            return;
        }
        alert("Tipo de teléfono eliminado correctamente");
        cargarTiposTelefono();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarTiposDireccion() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Tipos de dirección</h2>
        <p>Cargando tipos de dirección...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/tipos-direccion`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los tipos de dirección");
        }
        const tipos = await respuesta.json();
        let filas = "";
        tipos.forEach(tipo => {
            filas += `
                <tr>
                    <td>${ tipo.codigo_tipo_direccion ?? "" }</td>
                    <td>${ tipo.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarTipoDireccion(${ tipo.codigo_tipo_direccion })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarTipoDireccion(${ tipo.codigo_tipo_direccion })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Tipos de dirección</h2>
                    <p>Tipos de dirección registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioTipoDireccion()">
                    + Nuevo tipo
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Tipos de dirección</h2>

            <p class="mensaje-error">
                No fue posible cargar los tipos de dirección.
            </p>
        `;
    }
}


function mostrarFormularioTipoDireccion() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo tipo de dirección</h2>

        <form id="formTipoDireccion" class="formulario">

            <div class="campo">
                <label>Código</label>
                <input type="number" id="codigo_tipo_direccion" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarTiposDireccion()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar tipo
                </button>

            </div>

        </form>
    `;
    document.getElementById("formTipoDireccion").addEventListener("submit", registrarTipoDireccion);
}


async function registrarTipoDireccion(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = {
        codigo_tipo_direccion: parseInt(document.getElementById("codigo_tipo_direccion").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/tipos-direccion`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el tipo de dirección");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de dirección registrado correctamente");
        cargarTiposDireccion();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarTipoDireccion(codigoTipoDireccion) {
    try {
        const respuesta = await fetch(`${ API }/tipos-direccion/${ codigoTipoDireccion }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del tipo de dirección");
            return;
        }
        const tipo = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar tipo de dirección</h2>

            <form id="formEditarTipoDireccion" class="formulario">

                <div class="campo">
                    <label>Código</label>
                    <input
                        type="number"
                        id="codigo_tipo_direccion"
                        value="${ tipo.codigo_tipo_direccion ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ tipo.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarTiposDireccion()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarTipoDireccion").addEventListener("submit", function (event) {
            actualizarTipoDireccion(event, codigoTipoDireccion);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarTipoDireccion(event, codigoTipoDireccion) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/tipos-direccion/${ codigoTipoDireccion }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el tipo de dirección");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de dirección actualizado correctamente");
        cargarTiposDireccion();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



async function eliminarTipoDireccion(codigoTipoDireccion) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el tipo de dirección ${ codigoTipoDireccion }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/tipos-direccion/${ codigoTipoDireccion }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el tipo de dirección");
            return;
        }
        alert("Tipo de dirección eliminado correctamente");
        cargarTiposDireccion();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarDepartamentos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Departamentos</h2>
        <p>Cargando departamentos...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/departamentos`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los departamentos");
        }
        const departamentos = await respuesta.json();
        let filas = "";
        departamentos.forEach(departamento => {
            filas += `
                <tr>
                    <td>${ departamento.codigo_departamento ?? "" }</td>
                    <td>${ departamento.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarDepartamento(${ departamento.codigo_departamento })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarDepartamento(${ departamento.codigo_departamento })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Departamentos</h2>
                    <p>Departamentos registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioDepartamento()">
                    + Nuevo departamento
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Departamentos</h2>

            <p class="mensaje-error">
                No fue posible cargar los departamentos.
            </p>
        `;
    }
}


function mostrarFormularioDepartamento() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo departamento</h2>

        <form id="formDepartamento" class="formulario">

            <div class="campo">
                <label>Código de departamento</label>
                <input type="number" id="codigo_departamento" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarDepartamentos()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar departamento
                </button>

            </div>

        </form>
    `;
    document.getElementById("formDepartamento").addEventListener("submit", registrarDepartamento);
}



async function registrarDepartamento(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const departamento = {
        codigo_departamento: parseInt(document.getElementById("codigo_departamento").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/departamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(departamento)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el departamento");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Departamento registrado correctamente");
        cargarDepartamentos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarDepartamento(codigoDepartamento) {
    try {
        const respuesta = await fetch(`${ API }/departamentos/${ codigoDepartamento }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del departamento");
            return;
        }
        const departamento = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar departamento</h2>

            <form id="formEditarDepartamento" class="formulario">

                <div class="campo">
                    <label>Código de departamento</label>
                    <input
                        type="number"
                        id="codigo_departamento"
                        value="${ departamento.codigo_departamento ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ departamento.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarDepartamentos()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarDepartamento").addEventListener("submit", function (event) {
            actualizarDepartamento(event, codigoDepartamento);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarDepartamento(event, codigoDepartamento) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const departamento = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/departamentos/${ codigoDepartamento }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(departamento)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el departamento");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Departamento actualizado correctamente");
        cargarDepartamentos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarDepartamento(codigoDepartamento) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el departamento ${ codigoDepartamento }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/departamentos/${ codigoDepartamento }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el departamento");
            return;
        }
        alert("Departamento eliminado correctamente");
        cargarDepartamentos();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarMunicipios() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Municipios</h2>
        <p>Cargando municipios...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/municipios`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los municipios");
        }
        const municipios = await respuesta.json();
        let filas = "";
        municipios.forEach(municipio => {
            filas += `
                <tr>
                    <td>${ municipio.codigo_municipio ?? "" }</td>
                    <td>${ municipio.descripcion ?? "" }</td>
                    <td>${ municipio.nombre_departamento ?? municipio.codigo_departamento ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarMunicipio(${ municipio.codigo_municipio })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarMunicipio(${ municipio.codigo_municipio })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Municipios</h2>
                    <p>Municipios registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioMunicipio()">
                    + Nuevo municipio
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Departamento</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Municipios</h2>

            <p class="mensaje-error">
                No fue posible cargar los municipios.
            </p>
        `;
    }
}


function mostrarFormularioMunicipio() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo municipio</h2>

        <form id="formMunicipio" class="formulario">

            <div class="campo">
                <label>Código de municipio</label>
                <input type="number" id="codigo_municipio" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="campo">
                <label>Código de departamento</label>
                <input type="number" id="codigo_departamento" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarMunicipios()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar municipio
                </button>

            </div>

        </form>
    `;
    document.getElementById("formMunicipio").addEventListener("submit", registrarMunicipio);
}


async function registrarMunicipio(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const municipio = {
        codigo_municipio: parseInt(document.getElementById("codigo_municipio").value),
        descripcion: document.getElementById("descripcion").value,
        codigo_departamento: parseInt(document.getElementById("codigo_departamento").value)
    };
    try {
        const respuesta = await fetch(`${ API }/municipios`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(municipio)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el municipio");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Municipio registrado correctamente");
        cargarMunicipios();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarMunicipio(codigoMunicipio) {
    try {
        const respuesta = await fetch(`${ API }/municipios/${ codigoMunicipio }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del municipio");
            return;
        }
        const municipio = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar municipio</h2>

            <form id="formEditarMunicipio" class="formulario">

                <div class="campo">
                    <label>Código de municipio</label>
                    <input
                        type="number"
                        id="codigo_municipio"
                        value="${ municipio.codigo_municipio ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ municipio.descripcion ?? "" }"
                        required>
                </div>

                <div class="campo">
                    <label>Código de departamento</label>
                    <input
                        type="number"
                        id="codigo_departamento"
                        value="${ municipio.codigo_departamento ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarMunicipios()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarMunicipio").addEventListener("submit", function (event) {
            actualizarMunicipio(event, codigoMunicipio);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarMunicipio(event, codigoMunicipio) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const municipio = {
        descripcion: document.getElementById("descripcion").value,
        codigo_departamento: parseInt(document.getElementById("codigo_departamento").value)
    };
    try {
        const respuesta = await fetch(`${ API }/municipios/${ codigoMunicipio }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(municipio)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el municipio");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Municipio actualizado correctamente");
        cargarMunicipios();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarMunicipio(codigoMunicipio) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el municipio ${ codigoMunicipio }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/municipios/${ codigoMunicipio }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el municipio");
            return;
        }
        alert("Municipio eliminado correctamente");
        cargarMunicipios();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarTiposReferencia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Tipos de referencia</h2>
        <p>Cargando tipos de referencia...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/tipos-referencia`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los tipos de referencia");
        }
        const tipos = await respuesta.json();
        let filas = "";
        tipos.forEach(tipo => {
            filas += `
                <tr>
                    <td>${ tipo.codigo_tipo_referencia ?? "" }</td>
                    <td>${ tipo.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarTipoReferencia(${ tipo.codigo_tipo_referencia })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarTipoReferencia(${ tipo.codigo_tipo_referencia })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Tipos de referencia</h2>
                    <p>Tipos de referencia registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioTipoReferencia()">
                    + Nuevo tipo
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Tipos de referencia</h2>

            <p class="mensaje-error">
                No fue posible cargar los tipos de referencia.
            </p>
        `;
    }
}


function mostrarFormularioTipoReferencia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo tipo de referencia</h2>

        <form id="formTipoReferencia" class="formulario">

            <div class="campo">
                <label>Código</label>
                <input type="number" id="codigo_tipo_referencia" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarTiposReferencia()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar tipo
                </button>

            </div>

        </form>
    `;
    document.getElementById("formTipoReferencia").addEventListener("submit", registrarTipoReferencia);
}


async function registrarTipoReferencia(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = {
        codigo_tipo_referencia: parseInt(document.getElementById("codigo_tipo_referencia").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/tipos-referencia`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el tipo de referencia");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de referencia registrado correctamente");
        cargarTiposReferencia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarTipoReferencia(codigoTipoReferencia) {
    try {
        const respuesta = await fetch(`${ API }/tipos-referencia/${ codigoTipoReferencia }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del tipo de referencia");
            return;
        }
        const tipo = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar tipo de referencia</h2>

            <form id="formEditarTipoReferencia" class="formulario">

                <div class="campo">
                    <label>Código</label>
                    <input
                        type="number"
                        id="codigo_tipo_referencia"
                        value="${ tipo.codigo_tipo_referencia ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ tipo.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarTiposReferencia()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarTipoReferencia").addEventListener("submit", function (event) {
            actualizarTipoReferencia(event, codigoTipoReferencia);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarTipoReferencia(event, codigoTipoReferencia) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/tipos-referencia/${ codigoTipoReferencia }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el tipo de referencia");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de referencia actualizado correctamente");
        cargarTiposReferencia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarTipoReferencia(codigoTipoReferencia) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el tipo de referencia ${ codigoTipoReferencia }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/tipos-referencia/${ codigoTipoReferencia }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el tipo de referencia");
            return;
        }
        alert("Tipo de referencia eliminado correctamente");
        cargarTiposReferencia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarTiposGarantia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Tipos de garantía</h2>
        <p>Cargando tipos de garantía...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/tipos-garantia`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los tipos de garantía");
        }
        const tipos = await respuesta.json();
        let filas = "";
        tipos.forEach(tipo => {
            filas += `
                <tr>
                    <td>${ tipo.codigo_tipo_garantia ?? "" }</td>
                    <td>${ tipo.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarTipoGarantia(${ tipo.codigo_tipo_garantia })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarTipoGarantia(${ tipo.codigo_tipo_garantia })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Tipos de garantía</h2>
                    <p>Tipos de garantía registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioTipoGarantia()">
                    + Nuevo tipo
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Tipos de garantía</h2>

            <p class="mensaje-error">
                No fue posible cargar los tipos de garantía.
            </p>
        `;
    }
}


function mostrarFormularioTipoGarantia() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo tipo de garantía</h2>

        <form id="formTipoGarantia" class="formulario">

            <div class="campo">
                <label>Código</label>
                <input type="number" id="codigo_tipo_garantia" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarTiposGarantia()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar tipo
                </button>

            </div>

        </form>
    `;
    document.getElementById("formTipoGarantia").addEventListener("submit", registrarTipoGarantia);
}


async function registrarTipoGarantia(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = {
        codigo_tipo_garantia: parseInt(document.getElementById("codigo_tipo_garantia").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/tipos-garantia`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el tipo de garantía");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de garantía registrado correctamente");
        cargarTiposGarantia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarTipoGarantia(codigoTipoGarantia) {
    try {
        const respuesta = await fetch(`${ API }/tipos-garantia/${ codigoTipoGarantia }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del tipo de garantía");
            return;
        }
        const tipo = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar tipo de garantía</h2>

            <form id="formEditarTipoGarantia" class="formulario">

                <div class="campo">
                    <label>Código</label>
                    <input
                        type="number"
                        id="codigo_tipo_garantia"
                        value="${ tipo.codigo_tipo_garantia ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ tipo.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarTiposGarantia()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarTipoGarantia").addEventListener("submit", function (event) {
            actualizarTipoGarantia(event, codigoTipoGarantia);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarTipoGarantia(event, codigoTipoGarantia) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const tipo = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/tipos-garantia/${ codigoTipoGarantia }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(tipo)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el tipo de garantía");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Tipo de garantía actualizado correctamente");
        cargarTiposGarantia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function eliminarTipoGarantia(codigoTipoGarantia) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el tipo de garantía ${ codigoTipoGarantia }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/tipos-garantia/${ codigoTipoGarantia }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el tipo de garantía");
            return;
        }
        alert("Tipo de garantía eliminado correctamente");
        cargarTiposGarantia();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function cargarMediosPago() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Medios de pago</h2>
        <p>Cargando medios de pago...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/medios-pago`);
        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los medios de pago");
        }
        const medios = await respuesta.json();
        let filas = "";
        medios.forEach(medio => {
            filas += `
                <tr>
                    <td>${ medio.codigo_medio_pago ?? "" }</td>
                    <td>${ medio.descripcion ?? "" }</td>

                    <td>
                        <button
                            class="boton-editar"
                            onclick="editarMedioPago(${ medio.codigo_medio_pago })">
                            Editar
                        </button>

                        <button
                            class="boton-eliminar"
                            onclick="eliminarMedioPago(${ medio.codigo_medio_pago })">
                            Eliminar
                        </button>
                    </td>
                </tr>
            `;
        });
        contenido.innerHTML = `
            <div class="encabezado-modulo">

                <div>
                    <h2>Medios de pago</h2>
                    <p>Medios de pago registrados en MAGIS-AUTO.</p>
                </div>

                <button
                    class="boton-nuevo"
                    onclick="mostrarFormularioMedioPago()">
                    + Nuevo medio
                </button>

            </div>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>

            <br>

            <button
                class="boton-cancelar"
                onclick="cargarCatalogos()">
                Volver a catálogos
            </button>
        `;
    } catch (error) {
        console.error(error);
        contenido.innerHTML = `
            <h2>Medios de pago</h2>

            <p class="mensaje-error">
                No fue posible cargar los medios de pago.
            </p>
        `;
    }
}


function mostrarFormularioMedioPago() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Nuevo medio de pago</h2>

        <form id="formMedioPago" class="formulario">

            <div class="campo">
                <label>Código</label>
                <input type="number" id="codigo_medio_pago" required>
            </div>

            <div class="campo">
                <label>Descripción</label>
                <input type="text" id="descripcion" required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarMediosPago()">
                    Cancelar
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Guardar medio
                </button>

            </div>

        </form>
    `;
    document.getElementById("formMedioPago").addEventListener("submit", registrarMedioPago);
}



async function registrarMedioPago(event) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const medio = {
        codigo_medio_pago: parseInt(document.getElementById("codigo_medio_pago").value),
        descripcion: document.getElementById("descripcion").value
    };
    try {
        const respuesta = await fetch(`${ API }/medios-pago`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medio)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo registrar el medio de pago");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Medio de pago registrado correctamente");
        cargarMediosPago();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function editarMedioPago(codigoMedioPago) {
    try {
        const respuesta = await fetch(`${ API }/medios-pago/${ codigoMedioPago }`);
        if (!respuesta.ok) {
            alert("No se pudo obtener la información del medio de pago");
            return;
        }
        const medio = await respuesta.json();
        const contenido = document.getElementById("contenido");
        contenido.innerHTML = `
            <h2>Editar medio de pago</h2>

            <form id="formEditarMedioPago" class="formulario">

                <div class="campo">
                    <label>Código</label>
                    <input
                        type="number"
                        id="codigo_medio_pago"
                        value="${ medio.codigo_medio_pago ?? "" }"
                        disabled>
                </div>

                <div class="campo">
                    <label>Descripción</label>
                    <input
                        type="text"
                        id="descripcion"
                        value="${ medio.descripcion ?? "" }"
                        required>
                </div>

                <div class="acciones-formulario">

                    <button
                        type="button"
                        class="boton-cancelar"
                        onclick="cargarMediosPago()">
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        class="boton-guardar">
                        Guardar cambios
                    </button>

                </div>

            </form>
        `;
        document.getElementById("formEditarMedioPago").addEventListener("submit", function (event) {
            actualizarMedioPago(event, codigoMedioPago);
        });
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


async function actualizarMedioPago(event, codigoMedioPago) {
    const seguimientoGuardado = capturarFormularioParaGuardar();
    event.preventDefault();
    const medio = { descripcion: document.getElementById("descripcion").value };
    try {
        const respuesta = await fetch(`${ API }/medios-pago/${ codigoMedioPago }`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(medio)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo actualizar el medio de pago");
            return;
        }
        confirmarFormularioGuardado(seguimientoGuardado);
        alert("Medio de pago actualizado correctamente");
        cargarMediosPago();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}



async function eliminarMedioPago(codigoMedioPago) {
    const confirmar = confirm(`¿Seguro que deseas eliminar el medio de pago ${ codigoMedioPago }?`);
    if (!confirmar) {
        return;
    }
    try {
        const respuesta = await fetch(`${ API }/medios-pago/${ codigoMedioPago }`, { method: "DELETE" });
        const resultado = await respuesta.json();
        if (!respuesta.ok) {
            alert(resultado.error || "No se pudo eliminar el medio de pago");
            return;
        }
        alert("Medio de pago eliminado correctamente");
        cargarMediosPago();
    } catch (error) {
        console.error(error);
        alert("No fue posible conectarse con la API");
    }
}


// Reportes
// Mostramos los reportes disponibles para que se pueda escoger uno.
function cargarReportes() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <div class="encabezado-modulo">

            <div>
                <h2>Reportes financieros</h2>

                <p>
                    Selecciona el reporte que deseas consultar.
                </p>
            </div>

        </div>


        <div class="grid-reportes">

            <button onclick="mostrarReporteCreditosPeriodo()">
                <strong>1. Créditos emitidos</strong>
                <span>Créditos otorgados dentro de un período.</span>
            </button>


            <button onclick="mostrarReporteCarteraMora()">
                <strong>2. Cartera en mora</strong>
                <span>Créditos con cuotas vencidas pendientes.</span>
            </button>


            <button onclick="mostrarReportePagosPorTipo()">
                <strong>3. Pagos por tipo</strong>
                <span>Pagos agrupados según el medio utilizado.</span>
            </button>


            <button onclick="mostrarReporteVentasVendedor()">
                <strong>4. Ventas por vendedor</strong>
                <span>Créditos colocados por cada vendedor.</span>
            </button>


            <button onclick="mostrarReporteCumpleanerosMes()">
                <strong>5. Cumpleañeros del mes</strong>
                <span>Personas que cumplen años en el mes seleccionado.</span>
            </button>


            <button onclick="mostrarReporteEstadoCuentaDeudor()">
                <strong>6. Estado de cuenta</strong>
                <span>Estado financiero correspondiente a un deudor.</span>
            </button>


            <button onclick="mostrarReportePlanPagosCredito()">
                <strong>7. Plan de pagos</strong>
                <span>Consulta el plan completo de un crédito.</span>
            </button>


            <button onclick="mostrarReporteCreditosActivos()">
                <strong>8. Créditos activos</strong>
                <span>Créditos que actualmente se encuentran activos.</span>
            </button>


            <button onclick="mostrarReporteCreditosPorMes()">
                <strong>9. Créditos por mes</strong>
                <span>Cantidad y monto financiado por mes.</span>
            </button>


            <button onclick="mostrarReporteCreditosPorEstado()">
                <strong>10. Créditos por estado</strong>
                <span>Créditos agrupados según su estado.</span>
            </button>


            <button onclick="mostrarReporteCreditosSobrePromedio()">
                <strong>11. Créditos sobre promedio</strong>
                <span>Financiamientos con monto superior al promedio.</span>
            </button>


            <button onclick="mostrarReporteCuotasVencidas()">
                <strong>12. Cuotas vencidas</strong>
                <span>Cuotas vencidas que aún poseen saldo pendiente.</span>
            </button>


            <button onclick="mostrarReportePagosParciales()">
                <strong>13. Pagos parciales</strong>
                <span>Cuotas con abonos y saldo pendiente.</span>
            </button>


            <button onclick="mostrarReporteRecaudacionMensual()">
                <strong>14. Recaudación mensual</strong>
                <span>Ingresos recibidos durante un mes específico.</span>
            </button>


            <button onclick="mostrarReporteUsoMediosPago()">
                <strong>15. Uso de medios de pago</strong>
                <span>Medios de pago utilizados con mayor frecuencia.</span>
            </button>


            <button onclick="mostrarReporteDeudoresConCreditos()">
                <strong>16. Deudores con créditos</strong>
                <span>Deudores que poseen financiamientos registrados.</span>
            </button>


            <button onclick="mostrarReporteCreditosConFiadores()">
                <strong>17. Créditos con fiadores</strong>
                <span>Créditos respaldados por uno o más fiadores.</span>
            </button>


            <button onclick="mostrarReporteVehiculosPorMarca()">
                <strong>18. Vehículos por marca</strong>
                <span>Vehículos financiados agrupados por marca.</span>
            </button>


            <button onclick="mostrarReporteInteresesPorCredito()">
                <strong>19. Intereses programados</strong>
                <span>Intereses programados dentro del plan de pagos.</span>
            </button>


            <button onclick="mostrarReporteComisionesVendedores()">
                <strong>20. Comisiones de vendedores</strong>
                <span>Comisiones generadas según los pagos recibidos.</span>
            </button>

        </div>
    `;
}


// Pedimos las fechas que se usarán para consultar este reporte.
function mostrarReporteCreditosPeriodo() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <div class="encabezado-modulo">

            <div>
                <h2>Créditos emitidos en un período</h2>

                <p>
                    Consulta los créditos registrados entre dos fechas.
                </p>
            </div>

        </div>


        <form
            id="formReporteCreditosPeriodo"
            class="formulario">

            <div class="campo">

                <label>
                    Fecha inicial
                </label>

                <input
                    type="date"
                    id="fecha_inicio"
                    required>

            </div>


            <div class="campo">

                <label>
                    Fecha final
                </label>

                <input
                    type="date"
                    id="fecha_fin"
                    required>

            </div>


            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>


                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>


        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteCreditosPeriodo").addEventListener("submit", consultarReporteCreditosPeriodo);
}


// Mandamos las fechas a la API y mostramos los resultados.
// Los otros reportes trabajan de forma parecida, pero usan otros filtros y columnas.
async function consultarReporteCreditosPeriodo(event) {
    event.preventDefault();
    const fechaInicio = document.getElementById("fecha_inicio").value;
    const fechaFin = document.getElementById("fecha_fin").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-periodo?fecha_inicio=${ fechaInicio }&fecha_fin=${ fechaFin }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(credito => {
            filas += `
                <tr>
                    <td>${ credito.codigo_credito ?? "" }</td>
                    <td>${ credito.numero_credito ?? "" }</td>
                    <td>${ formatearFechaMostrar(credito.fecha_credito) }</td>
                    <td>${ credito.estado ?? "" }</td>
                    <td>${ credito.monto ?? "" }</td>
                    <td>${ credito.nombre_vendedor ?? credito.codigo_vendedor ?? "" }</td>
                    <td>${ credito.nombre_deudor ?? credito.codigo_deudor ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Número</th>
                            <th>Fecha</th>
                            <th>Estado</th>
                            <th>Monto</th>
                            <th>Vendedor</th>
                            <th>Deudor</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteCarteraMora() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Cartera en mora</h2>

        <p>
            Consulta los créditos que presentan cuotas vencidas pendientes de pago.
        </p>

        <form id="formReporteCarteraMora" class="formulario">

            <div class="campo">
                <label>Fecha de corte</label>
                <input
                    type="date"
                    id="fecha_corte"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteCarteraMora").addEventListener("submit", consultarReporteCarteraMora);
}



async function consultarReporteCarteraMora(event) {
    event.preventDefault();
    const fechaCorte = document.getElementById("fecha_corte").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/cartera-mora?fecha_corte=${ fechaCorte }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_credito ?? "" }</td>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.CantidadCuotasVencidas ?? "" }</td>
                    <td>Q ${ Number(registro.TotalCuotasVencidas ?? 0).toFixed(2) }</td>
                    <td>Q ${ Number(registro.TotalPagado ?? 0).toFixed(2) }</td>
                    <td>Q ${ Number(registro.SaldoTotalMora ?? 0).toFixed(2) }</td>
                    <td>${ registro.MaximoDiasAtraso ?? "" }</td>
                </tr>
            `;
        });
        if (datos.length === 0) {
            filas = `
                <tr>
                    <td colspan="7">
                        No se encontraron créditos en mora.
                    </td>
                </tr>
            `;
        }
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Crédito</th>
                            <th>Cuotas vencidas</th>
                            <th>Total vencido</th>
                            <th>Total pagado</th>
                            <th>Saldo en mora</th>
                            <th>Días máximos de atraso</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReportePagosPorTipo() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Pagos por tipo de pago</h2>

        <p>
            Consulta los pagos recibidos en un período agrupados por medio de pago.
        </p>

        <form id="formReportePagosTipo" class="formulario">

            <div class="campo">
                <label>Fecha inicial</label>
                <input
                    type="date"
                    id="fecha_inicio_pago"
                    required>
            </div>

            <div class="campo">
                <label>Fecha final</label>
                <input
                    type="date"
                    id="fecha_fin_pago"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReportePagosTipo").addEventListener("submit", consultarReportePagosPorTipo);
}


async function consultarReportePagosPorTipo(event) {
    event.preventDefault();
    const fechaInicio = document.getElementById("fecha_inicio_pago").value;
    const fechaFin = document.getElementById("fecha_fin_pago").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/pagos-por-tipo?fecha_inicio=${ fechaInicio }&fecha_fin=${ fechaFin }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_medio_pago ?? "" }</td>
                    <td>${ registro.MedioPago ?? "" }</td>
                    <td>${ registro.CantidadPagos ?? "" }</td>
                    <td>${ registro.TotalPagado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Medio de pago</th>
                            <th>Cantidad de pagos</th>
                            <th>Total pagado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteVentasVendedor() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Ventas por vendedor</h2>

        <p>
            Consulta la cantidad de créditos colocados y el monto total financiado por cada vendedor.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteVentasVendedor()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}



async function consultarReporteVentasVendedor() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/ventas-vendedor`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_vendedor ?? "" }</td>

                    <td>
                        ${ registro.primer_nombre ?? "" } ${ registro.primer_apellido ?? "" }
                    </td>

                    <td>${ registro.CantidadCreditos ?? "" }</td>

                    <td>${ registro.TotalFinanciado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código vendedor</th>
                            <th>Vendedor</th>
                            <th>Créditos colocados</th>
                            <th>Total financiado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteCumpleanerosMes() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Cumpleañeros del mes</h2>

        <p>
            Consulta las personas que cumplen años en el mes seleccionado.
        </p>

        <form id="formReporteCumpleaneros" class="formulario">

            <div class="campo">
                <label>Mes</label>

                <select id="mes_cumple" required>
                    <option value="">Seleccione un mes</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteCumpleaneros").addEventListener("submit", consultarReporteCumpleanerosMes);
}


async function consultarReporteCumpleanerosMes(event) {
    event.preventDefault();
    const mes = document.getElementById("mes_cumple").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/cumpleaneros?mes=${ mes }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_persona ?? "" }</td>
                    <td>${ registro.primer_nombre ?? "" } ${ registro.segundo_nombre ?? "" }</td>
                    <td>${ registro.primer_apellido ?? "" } ${ registro.segundo_apellido ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_nacimiento) }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Nombres</th>
                            <th>Apellidos</th>
                            <th>Fecha de nacimiento</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteEstadoCuentaDeudor() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Estado de cuenta por deudor</h2>

        <p>
            Consulta las cuotas, pagos realizados y saldo pendiente de un deudor.
        </p>

        <form id="formReporteEstadoCuenta" class="formulario">

            <div class="campo">
                <label>Código del deudor</label>

                <input
                    type="number"
                    id="codigo_deudor_reporte"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteEstadoCuenta").addEventListener("submit", consultarReporteEstadoCuentaDeudor);
}



async function consultarReporteEstadoCuentaDeudor(event) {
    event.preventDefault();
    const codigoDeudor = document.getElementById("codigo_deudor_reporte").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/estado-cuenta-deudor?codigo_deudor=${ codigoDeudor }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.numero_cuota ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_vencimiento) }</td>
                    <td>${ registro.valor_total_cuota ?? "" }</td>
                    <td>${ registro.TotalPagado ?? "" }</td>
                    <td>${ registro.SaldoPendiente ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Crédito</th>
                            <th>Cuota</th>
                            <th>Fecha de vencimiento</th>
                            <th>Valor de cuota</th>
                            <th>Total pagado</th>
                            <th>Saldo pendiente</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReportePlanPagosCredito() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Plan de pagos por crédito</h2>

        <p>
            Consulta el calendario completo de cuotas de un crédito.
        </p>

        <form id="formReportePlanPagos" class="formulario">

            <div class="campo">
                <label>Código del crédito</label>

                <input
                    type="number"
                    id="codigo_credito_reporte"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReportePlanPagos").addEventListener("submit", consultarReportePlanPagosCredito);
}



async function consultarReportePlanPagosCredito(event) {
    event.preventDefault();
    const codigoCredito = document.getElementById("codigo_credito_reporte").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/plan-pagos-credito?codigo_credito=${ codigoCredito }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.numero_cuota ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_plan) }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_vencimiento) }</td>
                    <td>${ registro.capital ?? "" }</td>
                    <td>${ registro.intereses ?? "" }</td>
                    <td>${ registro.manejo_cuenta ?? "" }</td>
                    <td>${ registro.seguro_vehiculo ?? "" }</td>
                    <td>${ registro.seguro_vida ?? "" }</td>
                    <td>${ registro.valor_total_cuota ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Crédito</th>
                            <th>Cuota</th>
                            <th>Fecha plan</th>
                            <th>Vencimiento</th>
                            <th>Capital</th>
                            <th>Intereses</th>
                            <th>Manejo cuenta</th>
                            <th>Seguro vehículo</th>
                            <th>Seguro vida</th>
                            <th>Total cuota</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteCreditosActivos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos activos</h2>

        <p>
            Consulta todos los créditos que actualmente se encuentran activos.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteCreditosActivos()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}



async function consultarReporteCreditosActivos() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-activos`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_credito ?? "" }</td>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_credito) }</td>
                    <td>${ registro.monto ?? "" }</td>
                    <td>${ registro.plazo ?? "" }</td>
                    <td>${ registro.tasa_intereses ?? "" }</td>
                    <td>${ registro.codigo_vendedor ?? "" }</td>
                    <td>${ registro.codigo_deudor ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Crédito</th>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Plazo</th>
                            <th>Tasa</th>
                            <th>Vendedor</th>
                            <th>Deudor</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteCreditosPorMes() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos por mes</h2>

        <p>
            Consulta la cantidad de créditos y el total financiado en un mes específico.
        </p>

        <form id="formReporteCreditosMes" class="formulario">

            <div class="campo">
                <label>Año</label>

                <input
                    type="number"
                    id="anio_creditos_mes"
                    min="2000"
                    required>
            </div>

            <div class="campo">
                <label>Mes</label>

                <select id="mes_creditos_mes" required>
                    <option value="">Seleccione un mes</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteCreditosMes").addEventListener("submit", consultarReporteCreditosPorMes);
}



async function consultarReporteCreditosPorMes(event) {
    event.preventDefault();
    const anio = document.getElementById("anio_creditos_mes").value;
    const mes = document.getElementById("mes_creditos_mes").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-por-mes?anio=${ anio }&mes=${ mes }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.Anio ?? "" }</td>
                    <td>${ registro.Mes ?? "" }</td>
                    <td>${ registro.CantidadCreditos ?? "" }</td>
                    <td>${ registro.TotalFinanciado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Año</th>
                            <th>Mes</th>
                            <th>Cantidad de créditos</th>
                            <th>Total financiado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteCreditosPorEstado() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos por estado</h2>

        <p>
            Consulta la cantidad de créditos y el monto total agrupados por estado.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteCreditosPorEstado()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}


async function consultarReporteCreditosPorEstado() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-por-estado`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.estado ?? "" }</td>
                    <td>${ registro.CantidadCreditos ?? "" }</td>
                    <td>${ registro.TotalMonto ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Estado</th>
                            <th>Cantidad de créditos</th>
                            <th>Monto total</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteCreditosSobrePromedio() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos con monto mayor al promedio</h2>

        <p>
            Consulta los créditos cuyo monto financiado supera el promedio general.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteCreditosSobrePromedio()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}



async function consultarReporteCreditosSobrePromedio() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-sobre-promedio`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_credito ?? "" }</td>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_credito) }</td>
                    <td>${ registro.monto ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Crédito</th>
                            <th>Fecha</th>
                            <th>Monto</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteCuotasVencidas() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Cuotas vencidas con saldo pendiente</h2>

        <p>
            Consulta las cuotas vencidas que todavía tienen saldo pendiente de pago.
        </p>

        <form id="formReporteCuotasVencidas" class="formulario">

            <div class="campo">
                <label>Fecha de corte</label>

                <input
                    type="date"
                    id="fecha_corte_cuotas"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteCuotasVencidas").addEventListener("submit", consultarReporteCuotasVencidas);
}



async function consultarReporteCuotasVencidas(event) {
    event.preventDefault();
    const fechaCorte = document.getElementById("fecha_corte_cuotas").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/cuotas-vencidas?fecha_corte=${ fechaCorte }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.numero_cuota ?? "" }</td>
                    <td>${ formatearFechaMostrar(registro.fecha_vencimiento) }</td>
                    <td>${ registro.valor_total_cuota ?? "" }</td>
                    <td>${ registro.TotalPagado ?? "" }</td>
                    <td>${ registro.SaldoPendiente ?? "" }</td>
                    <td>${ registro.DiasAtraso ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Crédito</th>
                            <th>Cuota</th>
                            <th>Vencimiento</th>
                            <th>Valor cuota</th>
                            <th>Total pagado</th>
                            <th>Saldo pendiente</th>
                            <th>Días de atraso</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReportePagosParciales() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Pagos parciales</h2>

        <p>
            Consulta las cuotas que han recibido abonos y todavía tienen saldo pendiente.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReportePagosParciales()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}



async function consultarReportePagosParciales() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/pagos-parciales`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.numero_cuota ?? "" }</td>
                    <td>${ registro.valor_total_cuota ?? "" }</td>
                    <td>${ registro.CantidadAbonos ?? "" }</td>
                    <td>${ registro.TotalAbonado ?? "" }</td>
                    <td>${ registro.SaldoPendiente ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Crédito</th>
                            <th>Cuota</th>
                            <th>Valor cuota</th>
                            <th>Cantidad de abonos</th>
                            <th>Total abonado</th>
                            <th>Saldo pendiente</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteRecaudacionMensual() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Recaudación mensual</h2>

        <p>
            Consulta la cantidad de pagos y el total recaudado en un mes específico.
        </p>

        <form id="formReporteRecaudacion" class="formulario">

            <div class="campo">
                <label>Año</label>

                <input
                    type="number"
                    id="anio_recaudacion"
                    min="2000"
                    required>
            </div>

            <div class="campo">
                <label>Mes</label>

                <select id="mes_recaudacion" required>
                    <option value="">Seleccione un mes</option>
                    <option value="1">Enero</option>
                    <option value="2">Febrero</option>
                    <option value="3">Marzo</option>
                    <option value="4">Abril</option>
                    <option value="5">Mayo</option>
                    <option value="6">Junio</option>
                    <option value="7">Julio</option>
                    <option value="8">Agosto</option>
                    <option value="9">Septiembre</option>
                    <option value="10">Octubre</option>
                    <option value="11">Noviembre</option>
                    <option value="12">Diciembre</option>
                </select>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteRecaudacion").addEventListener("submit", consultarReporteRecaudacionMensual);
}



async function consultarReporteRecaudacionMensual(event) {
    event.preventDefault();
    const anio = document.getElementById("anio_recaudacion").value;
    const mes = document.getElementById("mes_recaudacion").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/recaudacion-mensual?anio=${ anio }&mes=${ mes }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.Anio ?? "" }</td>
                    <td>${ registro.Mes ?? "" }</td>
                    <td>${ registro.CantidadPagos ?? "" }</td>
                    <td>${ registro.TotalRecaudado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Año</th>
                            <th>Mes</th>
                            <th>Cantidad de pagos</th>
                            <th>Total recaudado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}



function mostrarReporteUsoMediosPago() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Uso de medios de pago</h2>

        <p>
            Consulta qué medios de pago son utilizados con mayor frecuencia.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteUsoMediosPago()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}


async function consultarReporteUsoMediosPago() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/uso-medios-pago`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_medio_pago ?? "" }</td>
                    <td>${ registro.MedioPago ?? "" }</td>
                    <td>${ registro.CantidadTransacciones ?? "" }</td>
                    <td>${ registro.TotalRecibido ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Medio de pago</th>
                            <th>Cantidad de transacciones</th>
                            <th>Total recibido</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteDeudoresConCreditos() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Deudores con créditos registrados</h2>

        <p>
            Consulta los deudores que tienen créditos y el total financiado de cada uno.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteDeudoresConCreditos()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}


async function consultarReporteDeudoresConCreditos() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/deudores-con-creditos`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_deudor ?? "" }</td>
                    <td>
                        ${ registro.primer_nombre ?? "" }
                        ${ registro.primer_apellido ?? "" }
                    </td>
                    <td>${ registro.CantidadCreditos ?? "" }</td>
                    <td>${ registro.TotalFinanciado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código deudor</th>
                            <th>Deudor</th>
                            <th>Cantidad de créditos</th>
                            <th>Total financiado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteCreditosConFiadores() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Créditos respaldados por fiadores</h2>

        <p>
            Consulta los créditos que cuentan con uno o más fiadores asociados.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteCreditosConFiadores()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}


async function consultarReporteCreditosConFiadores() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/creditos-con-fiadores`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_credito ?? "" }</td>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.monto ?? "" }</td>
                    <td>${ registro.CantidadFiadores ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Crédito</th>
                            <th>Monto</th>
                            <th>Cantidad de fiadores</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteVehiculosPorMarca() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Vehículos financiados por marca</h2>

        <p>
            Consulta cuántos créditos corresponden a vehículos de cada marca.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteVehiculosPorMarca()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}


async function consultarReporteVehiculosPorMarca() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/vehiculos-por-marca`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_marca ?? "" }</td>
                    <td>${ registro.Marca ?? "" }</td>
                    <td>${ registro.CantidadCreditos ?? "" }</td>
                    <td>${ registro.TotalFinanciado ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código marca</th>
                            <th>Marca</th>
                            <th>Cantidad de créditos</th>
                            <th>Total financiado</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteInteresesPorCredito() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Intereses programados por crédito</h2>

        <p>
            Consulta el total de intereses programados dentro del plan de pagos de cada crédito.
        </p>

        <div class="acciones-formulario">

            <button
                type="button"
                class="boton-cancelar"
                onclick="cargarReportes()">
                Volver
            </button>

            <button
                type="button"
                class="boton-guardar"
                onclick="consultarReporteInteresesPorCredito()">
                Consultar
            </button>

        </div>

        <div id="resultadoReporte"></div>
    `;
}



async function consultarReporteInteresesPorCredito() {
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/intereses-por-credito`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            filas += `
                <tr>
                    <td>${ registro.codigo_credito ?? "" }</td>
                    <td>${ registro.numero_credito ?? "" }</td>
                    <td>${ registro.monto ?? "" }</td>
                    <td>${ registro.tasa_intereses ?? "" }</td>
                    <td>${ registro.TotalInteresesProgramados ?? "" }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Crédito</th>
                            <th>Monto</th>
                            <th>Tasa de interés</th>
                            <th>Intereses programados</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


function mostrarReporteComisionesVendedores() {
    const contenido = document.getElementById("contenido");
    contenido.innerHTML = `
        <h2>Comisiones de vendedores</h2>

        <p>
            Consulta las comisiones generadas según los pagos recibidos en un período.
        </p>

        <form id="formReporteComisiones" class="formulario">

            <div class="campo">
                <label>Fecha inicial</label>

                <input
                    type="date"
                    id="fecha_inicio_comision"
                    required>
            </div>

            <div class="campo">
                <label>Fecha final</label>

                <input
                    type="date"
                    id="fecha_fin_comision"
                    required>
            </div>

            <div class="acciones-formulario">

                <button
                    type="button"
                    class="boton-cancelar"
                    onclick="cargarReportes()">
                    Volver
                </button>

                <button
                    type="submit"
                    class="boton-guardar">
                    Consultar
                </button>

            </div>

        </form>

        <div id="resultadoReporte"></div>
    `;
    document.getElementById("formReporteComisiones").addEventListener("submit", consultarReporteComisionesVendedores);
}


async function consultarReporteComisionesVendedores(event) {
    event.preventDefault();
    const fechaInicio = document.getElementById("fecha_inicio_comision").value;
    const fechaFin = document.getElementById("fecha_fin_comision").value;
    const resultado = document.getElementById("resultadoReporte");
    resultado.innerHTML = `
        <p>Consultando información...</p>
    `;
    try {
        const respuesta = await fetch(`${ API }/reportes/comisiones-vendedores?fecha_inicio=${ fechaInicio }&fecha_fin=${ fechaFin }`);
        const datos = await respuesta.json();
        if (!respuesta.ok) {
            resultado.innerHTML = `
                <p class="mensaje-error">
                    ${ datos.error || "No se pudo generar el reporte" }
                </p>
            `;
            return;
        }
        let filas = "";
        datos.forEach(registro => {
            const comision = parseFloat(registro.Comision ?? 0).toFixed(2);
            filas += `
                <tr>
                    <td>${ registro.codigo_vendedor ?? "" }</td>
                    <td>${ registro.codigo_empleado ?? "" }</td>
                    <td>
                        ${ registro.primer_nombre ?? "" }
                        ${ registro.primer_apellido ?? "" }
                    </td>
                    <td>${ registro.CantidadPagos ?? "" }</td>
                    <td>${ registro.TotalRecaudado ?? "" }</td>
                    <td>${ comision }</td>
                </tr>
            `;
        });
        resultado.innerHTML = `
            <br>

            <h3>Resultados</h3>

            <div class="tabla-contenedor">

                <table>

                    <thead>
                        <tr>
                            <th>Vendedor</th>
                            <th>Empleado</th>
                            <th>Nombre</th>
                            <th>Cantidad de pagos</th>
                            <th>Total recaudado</th>
                            <th>Comisión</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ filas }
                    </tbody>

                </table>

            </div>
        `;
    } catch (error) {
        console.error(error);
        resultado.innerHTML = `
            <p class="mensaje-error">
                No fue posible conectarse con la API.
            </p>
        `;
    }
}


// Acomodamos la fecha y la hora para mostrarlas en pantalla.
function formatearFechaHoraMostrar(fechaHora) {
    if (!fechaHora) {
        return "";
    }
    const fecha = new Date(fechaHora);
    const dia = String(fecha.getUTCDate()).padStart(2, "0");
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const anio = fecha.getUTCFullYear();
    const hora = String(fecha.getUTCHours()).padStart(2, "0");
    const minutos = String(fecha.getUTCMinutes()).padStart(2, "0");
    return `${ dia }/${ mes }/${ anio } ${ hora }:${ minutos }`;
}
// Esta función nos sirve para no repetir el fetch en cada pantalla.
// Recibe la ruta y las opciones, manda la solicitud y nos devuelve los datos.
async function solicitarGestion(ruta, opciones = {}) {
    // Aquí fetch manda la solicitud a la API y await espera la respuesta.
    const respuesta = await fetch(`${ API }/${ ruta }`, opciones);
    let datos;
    try { datos = await respuesta.json(); }
    catch { throw new Error("La API devolvió una respuesta inválida. Comprueba que Flask esté actualizado y en ejecución."); }
    // Revisamos ok para saber si la API aceptó la solicitud o devolvió un error.
    if (!respuesta.ok) throw new Error(datos.error || datos.mensaje || `No fue posible completar la operación (${ respuesta.status }).`);
    return datos;
}

// Pedimos varias listas al mismo tiempo y revisamos que todas lleguen bien.
async function listasGestion(rutas) {
    const resultados = await Promise.allSettled(rutas.map(async ruta => {
        const datos = await solicitarGestion(ruta);
        if (!Array.isArray(datos)) throw new Error(`La API no devolvió una lista válida: ${ ruta }`);
        return datos;
    }));
    const fallo = resultados.find(resultado => resultado.status === "rejected");
    if (fallo) throw fallo.reason;
    return resultados.map(resultado => resultado.value);
}

// Preparamos una pantalla con título, botón Volver y un mensaje de carga.
function crearVistaGestion(titulo, volver) {
    document.getElementById("contenido").innerHTML = `<div class="encabezado-modulo"><h2>${ magisEscape(titulo) }</h2>
        <button type="button" class="boton-cancelar" onclick="${ volver }">Volver</button></div>
        <section id="vistaGestion" aria-live="polite"><p>Cargando datos...</p></section>`;
    return document.getElementById("vistaGestion");
}

// Mostramos el mensaje del error como texto en la pantalla.
function mostrarErrorGestion(vista, error) {
    if (!vista.isConnected) return;
    vista.innerHTML = '<p class="mensaje-error" role="alert"></p>';
    vista.querySelector("p").textContent = error.message || "No fue posible conectar con la API.";
}

// Con esta función armamos tablas sin repetir todo el HTML cada vez.
function tablaGestion(columnas, filas) {
    if (!filas.length) return "<p>No hay registros.</p>";
    return `<div class="tabla-contenedor"><table><thead><tr>${ columnas.map(c => `<th>${ magisEscape(c) }</th>`).join("") }</tr></thead>
        <tbody>${ filas.map(fila => `<tr>${ fila.map(valor => `<td>${ magisEscape(valor) }</td>`).join("") }</tr>`).join("") }</tbody></table></div>`;
}

// Juntamos los nombres y apellidos que tenga la persona.
function nombreCompletoGestion(persona) {
    return [persona.primer_nombre, persona.segundo_nombre, persona.primer_apellido, persona.segundo_apellido].filter(Boolean).join(" ") || persona.nombre_persona || `Persona ${ persona.codigo_persona }`;
}

// Quitamos las tildes al comparar para que la búsqueda sea más fácil.
function textoBusquedaGestion(texto) {
    return String(texto ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Ocultamos las filas que no coinciden con la búsqueda. No se borra nada.
// En Créditos también revisamos el estado que se escogió.
function agregarFiltrosListado(modulo) {
    const tabla = document.querySelector("#contenido table");
    if (!tabla || document.getElementById("filtrosListado")) return;
    const filas = [...tabla.querySelectorAll("tbody tr")];
    const bloque = document.createElement("div");
    bloque.id = "filtrosListado";
    bloque.className = "formulario";
    const ejemplos = { clientes: "Nombre, DPI, NIT o código", vehiculos: "Placa, VIN, marca o código", creditos: "Número, cliente o código", pagos: "Nombre del cliente o número de crédito", historialPagos: "Comprobante, cuota, medio de pago o referencia", cuotas: "Nombre del cliente, número de crédito o código de persona" };
    bloque.innerHTML = `<div class="campo"><label for="buscarListado">Buscar</label><input type="search" id="buscarListado" placeholder="${ ejemplos[modulo] }"></div>
        ${ modulo === "creditos" ? '<div class="campo"><label for="estadoListado">Estado</label><select id="estadoListado"><option value="">Todos</option></select></div>' : "" }
        <p id="resultadoListado" role="status"></p>`;
    tabla.closest(".tabla-contenedor").before(bloque);
    const entrada = bloque.querySelector("#buscarListado");
    const estado = bloque.querySelector("#estadoListado");
    const contenido = filas.map(fila => textoBusquedaGestion([...fila.cells].slice(0, -1).map(celda => celda.textContent).join(" ")));
    if (estado) {
        const estados = [...new Set(filas.map(fila => fila.cells[3].textContent.trim()))].filter(Boolean);
        estado.innerHTML += estados.map(valor => `<option value="${ magisEscape(valor) }">${ magisEscape(valor) }</option>`).join("");
    }
    const paginacion = document.createElement("div");
    paginacion.className = "paginacion-cuotas";
    paginacion.innerHTML = `<div class="campo-filtro"><label for="tamanoPaginaListado">Filas por página</label>
        <select id="tamanoPaginaListado">${ [5, 10, 15, 25, 50].map(n => `<option value="${ n }" ${ n === 10 ? "selected" : "" }>${ n }</option>`).join("") }</select></div>
        <p class="info-paginacion" id="infoPaginaListado" role="status"></p>
        <nav class="botones-paginacion" id="botonesPaginaListado" aria-label="Páginas del listado"></nav>`;
    tabla.closest(".tabla-contenedor").after(paginacion);
    let paginaActual = 1;
    let filtradas = filas;
    const tamano = paginacion.querySelector("#tamanoPaginaListado");
    const dibujarPagina = () => {
        const pagina = calcularPaginaListado(filtradas.length, paginaActual, Number(tamano.value));
        paginaActual = pagina.actual;
        filas.forEach(fila => { fila.hidden = true; });
        filtradas.slice(pagina.inicio, pagina.fin).forEach(fila => { fila.hidden = false; });
        paginacion.querySelector("#infoPaginaListado").textContent = pagina.total
            ? `Mostrando ${ pagina.inicio + 1 }–${ pagina.fin } de ${ pagina.total } | Página ${ pagina.actual } de ${ pagina.paginas }`
            : "No se encontraron registros | 0 resultados";
        const botones = paginacion.querySelector("#botonesPaginaListado");
        botones.replaceChildren();
        const agregarBoton = (texto, destino, disabled = false, activo = false) => {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.textContent = texto;
            boton.disabled = disabled;
            if (activo) {
                boton.className = "pagina-activa";
                boton.setAttribute("aria-current", "page");
            }
            if (typeof texto === "number") boton.setAttribute("aria-label", `Página ${ texto }`);
            boton.addEventListener("click", () => { paginaActual = destino; dibujarPagina(); });
            botones.append(boton);
        };
        agregarBoton("Anterior", pagina.actual - 1, !pagina.total || pagina.actual <= 1);
        // Mostramos la primera, la última y las páginas cercanas para no llenar la pantalla de botones.
        const numeros = new Set(pagina.paginas ? [1, pagina.paginas] : []);
        for (let n = Math.max(1, pagina.actual - 2); n <= Math.min(pagina.paginas, pagina.actual + 2); n++) numeros.add(n);
        let anterior = 0;
        [...numeros].sort((a, b) => a - b).forEach(n => {
            if (anterior && n > anterior + 1) {
                const separador = document.createElement("span");
                separador.textContent = "…";
                botones.append(separador);
            }
            agregarBoton(n, n, n === pagina.actual, n === pagina.actual);
            anterior = n;
        });
        agregarBoton("Siguiente", pagina.actual + 1, !pagina.total || pagina.actual >= pagina.paginas);
    };
    const filtrar = () => {
        const termino = textoBusquedaGestion(entrada.value.trim());
        filtradas = filas.filter((fila, indice) => contenido[indice].includes(termino) && (!estado?.value || fila.cells[3].textContent.trim() === estado.value));
        paginaActual = 1;
        bloque.querySelector("#resultadoListado").textContent = `${ filtradas.length } de ${ filas.length } registros`;
        dibujarPagina();
    };
    entrada.addEventListener("input", filtrar);
    estado?.addEventListener("change", filtrar);
    tamano.addEventListener("change", () => { paginaActual = 1; dibujarPagina(); });
    filtrar();
}

// Calculamos qué filas van en la página. Al cambiar el filtro volvemos a la primera.
function calcularPaginaListado(total, actual, tamano) {
    const paginas = Math.ceil(total / tamano);
    const pagina = Math.min(Math.max(1, actual), Math.max(1, paginas));
    const inicio = (pagina - 1) * tamano;
    return { total, paginas, actual: pagina, inicio, fin: Math.min(inicio + tamano, total) };
}

// Mostramos nombres en la lista, pero usamos el código de la persona al guardar.
async function cargarPersonasParaRol(idFormulario, codigoPersona) {
    const formulario = document.getElementById(idFormulario);
    const boton = formulario.querySelector('[type="submit"]');
    const selector = formulario.querySelector("#codigo_persona");
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    formulario.prepend(estado);
    boton.disabled = true;
    try {
        const [personas] = await listasGestion(["personas"]);
        if (!formulario.isConnected) return;
        selector.innerHTML = '<option value="">Seleccione una persona</option>' + personas.map(persona =>
            `<option value="${ magisEscape(persona.codigo_persona) }">${ magisEscape(nombreCompletoGestion(persona)) } (${ magisEscape(persona.codigo_persona) })</option>`).join("");
        selector.value = String(codigoPersona ?? "");
        selector.disabled = !personas.length;
        boton.disabled = !personas.length;
        estado.textContent = personas.length ? "Selecciona una persona existente o registra una nueva." : "Registra primero una persona con el botón Registrar persona.";
    } catch (error) { if (formulario.isConnected) estado.textContent = error.message; }
}

// Guardamos lo que ya se escribió antes de abrir el formulario de una persona nueva.
// Al volver, recuperamos esos datos y seleccionamos a la persona que se registró.
function registrarPersonaDesdeRol(rol) {
    const funciones = { vendedor: mostrarFormularioVendedor, deudor: mostrarFormularioDeudor, fiador: mostrarFormularioFiador };
    const volver = funciones[rol];
    if (!volver) return;
    const formularioRol = document.querySelector("#contenido form");
    const borrador = [...formularioRol.querySelectorAll("input")].map(campo => [campo.id, campo.value]);
    const seleccionAnterior = formularioRol.querySelector("#codigo_persona").value;
    const habiaCambios = formularioTieneCambios(formularioRol);
    const restaurar = async codigo => {
        const carga = volver(codigo);
        const formulario = document.querySelector("#contenido form");
        await carga;
        if (!formulario.isConnected) return;
        for (const [id, valor] of borrador) {
            const campo = formulario.querySelector(`#${ id }`);
            if (campo) campo.value = valor;
        }
        if (habiaCambios) marcarFormularioModificado(formulario);
    };
    mostrarFormularioCliente();
    document.querySelector("#contenido h2").textContent = `Nueva persona para ${ rol }`;
    const formulario = document.getElementById("formCliente");
    formulario.querySelector('[type="submit"]').textContent = "Guardar persona";
    formulario.removeEventListener("submit", registrarCliente);
    formulario.addEventListener("submit", async event => {
        const boton = formulario.querySelector('[type="submit"]');
        event.preventDefault();
        if (boton.disabled || !formulario.reportValidity()) return;
        boton.disabled = true;
        try { await registrarCliente(event, codigo => formulario.isConnected ? restaurar(codigo) : undefined); }
        finally { boton.disabled = false; }
    });
    formulario.querySelector(".boton-cancelar").onclick = () => restaurar(seleccionAnterior);
}

// Pasamos el dinero a centavos para hacer las cuentas con números enteros.
function centavosGestion(valor) {
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(Number(valor)) || Number(valor) < 0) throw new Error("No se pudo calcular el saldo: la API contiene un monto inválido.");
    return Math.round(Number(valor) * 100);
}

// A cada cuota le restamos los pagos que ya recibió para saber cuánto falta.
// Esta cuenta solo prepara lo que mostramos en pantalla; no cambia la base de datos.
function cuotasConSaldoGestion(cuotas, pagos) {
    const abonado = new Map();
    pagos.forEach(pago => {
        const clave = `${ pago.codigo_credito }/${ pago.codigo_cuota }`;
        abonado.set(clave, (abonado.get(clave) || 0) + centavosGestion(pago.monto_pagado));
    });
    return cuotas.map(cuota => ({ ...cuota, saldoCentavos: Math.max(0,
        centavosGestion(cuota.valor_total_cuota) - (abonado.get(`${ cuota.codigo_credito }/${ cuota.codigo_cuota }`) || 0)) }));
}

// Mostramos los créditos activos que todavía tienen cuotas por pagar.
// Al escoger una cuota, ponemos lo que falta como monto sugerido.
async function cargarOpcionesPago(codigoCredito = "", codigoCuota = "") {
    const formulario = document.getElementById("formPago");
    const boton = formulario.querySelector('[type="submit"]');
    boton.disabled = true;
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    formulario.prepend(estado);
    try {
        const [creditos, cuotas, pagos, medios] = await listasGestion(["creditos", "cuotas", "pagos", "medios-pago"]);
        if (!formulario.isConnected) return;
        const saldos = cuotasConSaldoGestion(cuotas, pagos);
        const credito = formulario.querySelector("#codigo_credito");
        const cuota = formulario.querySelector("#codigo_cuota");
        const medio = formulario.querySelector("#codigo_medio_pago");
        const monto = formulario.querySelector("#monto_pagado");
        const disponibles = creditos.filter(c => textoBusquedaGestion(c.estado) === "activo" && saldos.some(q => String(q.codigo_credito) === String(c.codigo_credito) && q.saldoCentavos > 0));
        credito.innerHTML = '<option value="">Seleccione un crédito</option>' + disponibles.map(c =>
            `<option value="${ magisEscape(c.codigo_credito) }">${ magisEscape(c.numero_credito || c.codigo_credito) } — ${ magisEscape(c.nombre_deudor || c.codigo_deudor) }</option>`).join("");
        credito.disabled = !disponibles.length;
        credito.value = String(codigoCredito);
        opcionesContacto(medio, medios, "codigo_medio_pago");
        prepararReferenciaPago(formulario, medios);
        const actualizarMonto = () => {
            const seleccionada = saldos.find(q => String(q.codigo_cuota) === cuota.value && String(q.codigo_credito) === credito.value);
            monto.value = seleccionada ? (seleccionada.saldoCentavos / 100).toFixed(2) : "";
            monto.max = seleccionada ? (seleccionada.saldoCentavos / 100).toFixed(2) : "";
            boton.disabled = !seleccionada || !medios.length;
            estado.textContent = !disponibles.length ? "No hay créditos activos con cuotas pendientes." : !medios.length ? "Registra un medio de pago en Catálogos." : seleccionada
                ? `Saldo pendiente: ${ magisMoney(seleccionada.saldoCentavos / 100) }. Puedes registrar un pago parcial.` : "Selecciona un crédito y una cuota pendiente.";
        };
        const filtrar = (actual = "") => {
            const pendientes = saldos.filter(q => String(q.codigo_credito) === credito.value && q.saldoCentavos > 0);
            cuota.innerHTML = '<option value="">Seleccione una cuota pendiente</option>' + pendientes.map(q =>
                `<option value="${ magisEscape(q.codigo_cuota) }">Cuota ${ magisEscape(q.numero_cuota ?? q.codigo_cuota) } — ${ magisMoney(q.saldoCentavos / 100) }</option>`).join("");
            cuota.disabled = !pendientes.length;
            cuota.value = String(actual);
            actualizarMonto();
        };
        credito.addEventListener("change", () => filtrar());
        cuota.addEventListener("change", actualizarMonto);
        filtrar(codigoCuota);
    } catch (error) { if (formulario.isConnected) estado.textContent = error.message; }
}

// Reunimos los datos, contactos, créditos, cuotas y pagos de este cliente en una pantalla.
async function mostrarFichaCliente(codigoPersona) {
    const vista = crearVistaGestion("Ficha del cliente", "cargarClientes()");
    try {
        const resultados = await Promise.allSettled([
            solicitarGestion(`personas/${ codigoPersona }`),
            listasGestion(["telefonos", "direcciones", "deudores", "creditos", "cuotas", "pagos", "tipos-telefono", "tipos-direccion", "departamentos", "municipios"])
        ]);
        if (!vista.isConnected) return;
        const fallo = resultados.find(r => r.status === "rejected");
        if (fallo) throw fallo.reason;
        const persona = resultados[0].value;
        const [telefonos, direcciones, deudores, creditos, cuotas, pagos, tiposTelefono, tiposDireccion, departamentos, municipios] = resultados[1].value;
        const propios = registros => registros.filter(r => String(r.codigo_persona) === String(codigoPersona));
        const codigosDeudor = new Set(propios(deudores).map(d => String(d.codigo_deudor)));
        const creditosPropios = creditos.filter(c => codigosDeudor.has(String(c.codigo_deudor)));
        const codigosCredito = new Set(creditosPropios.map(c => String(c.codigo_credito)));
        const pagosPropios = pagos.filter(p => codigosCredito.has(String(p.codigo_credito)));
        const cuotasPropias = cuotasConSaldoGestion(cuotas.filter(q => codigosCredito.has(String(q.codigo_credito))), pagosPropios);
        const descripcion = (lista, campo, codigo) => lista.find(r => String(r[campo]) === String(codigo))?.descripcion ?? codigo ?? "";
        vista.innerHTML = `<h3>${ magisEscape(nombreCompletoGestion(persona)) }</h3>
            ${ tablaGestion(["Dato", "Valor"], [["Código", persona.codigo_persona], ["NIT", persona.nit], ["DPI", persona.dpi], ["Pasaporte", persona.no_pasaporte],
                ["Correo", persona.correo_electronico], ["Fecha de nacimiento", persona.fecha_nacimiento ? formatearFechaMostrar(persona.fecha_nacimiento) : ""], ["Género", persona.genero]]) }
            <h3>Teléfonos</h3>${ tablaGestion(["Número", "Tipo"], propios(telefonos).map(t => [t.numero, descripcion(tiposTelefono, "codigo_tipo_telefono", t.codigo_tipo_telefono)])) }
            <button class="boton-editar" onclick="editarCliente(${ Number(codigoPersona) })">Editar datos y contactos</button>
            <h3>Direcciones</h3>${ tablaGestion(["Calle", "Avenida", "Zona", "Departamento", "Municipio", "Tipo"], propios(direcciones).map(d => [d.calle, d.avenida, d.zona,
                descripcion(departamentos, "codigo_departamento", d.codigo_departamento), descripcion(municipios, "codigo_municipio", d.codigo_municipio), descripcion(tiposDireccion, "codigo_tipo_direccion", d.codigo_tipo_direccion)])) }
            
            <h3>Créditos</h3>${ tablaGestion(["Crédito", "Estado", "Monto", "Plazo"], creditosPropios.map(c => [c.numero_credito || c.codigo_credito, c.estado, magisMoney(Number(c.monto)), c.plazo])) }
            ${ creditosPropios.map(c => `<p>${ magisEscape(c.numero_credito || c.codigo_credito) }:
                <button class="boton-editar" onclick="mostrarFichaCredito(${ Number(c.codigo_credito) })">Ver detalle del crédito</button>
                <button class="boton-editar" onclick="mostrarRespaldosCredito(${ Number(c.codigo_credito) })">Referencias y fiadores</button>
                ${ textoBusquedaGestion(c.estado) === "activo" && cuotasPropias.some(q => String(q.codigo_credito) === String(c.codigo_credito) && q.saldoCentavos > 0)
                    ? `<button class="boton-nuevo" onclick="mostrarFormularioPago(${ Number(c.codigo_credito) })">Registrar pago</button>` : "" }</p>`).join("") }
            <h3>Cuotas</h3>${ tablaGestion(["Crédito", "Cuota", "Vencimiento", "Valor", "Saldo pendiente"], cuotasPropias.map(q => [q.numero_credito || q.codigo_credito,
                q.numero_cuota, formatearFechaMostrar(q.fecha_vencimiento), magisMoney(Number(q.valor_total_cuota)), magisMoney(q.saldoCentavos / 100)])) }
            <h3>Pagos</h3>${ tablaGestion(["Crédito", "Cuota", "Comprobante", "Fecha", "Monto", "Medio"], pagosPropios.map(p => [p.numero_credito || p.codigo_credito,
                p.codigo_cuota, p.numero_comprobante, formatearFechaMostrar(p.fecha_hora_pago), magisMoney(Number(p.monto_pagado)), p.nombre_medio_pago || p.codigo_medio_pago])) }`;
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Aquí agregamos o quitamos las referencias y los fiadores de un crédito.
// Quitar la asociación no borra a la persona ni su registro de fiador o referencia.
async function mostrarRespaldosCredito(codigoCredito) {
    magisSelect("creditos");
    const vista = crearVistaGestion("Referencias y fiadores del crédito", "cargarCreditos()");
    try {
        const resultados = await Promise.allSettled([
            solicitarGestion(`creditos/${ codigoCredito }`),
            listasGestion(["referencias", "fiadores", "personas", "referencias-credito", "creditos-fiadores"])
        ]);
        if (!vista.isConnected) return;
        const fallo = resultados.find(r => r.status === "rejected");
        if (fallo) throw fallo.reason;
        const credito = resultados[0].value;
        const [referencias, fiadores, personas, referenciasCredito, fiadoresCredito] = resultados[1].value;
        const porPersona = new Map(personas.map(p => [String(p.codigo_persona), p]));
        const opciones = [
            { tipo: "referencia", titulo: "Referencias", ruta: "referencias-credito", campo: "codigo_referencia", registros: referencias, relaciones: referenciasCredito },
            { tipo: "fiador", titulo: "Fiadores", ruta: "creditos-fiadores", campo: "codigo_fiador", registros: fiadores, relaciones: fiadoresCredito }
        ];
        const nombre = registro => registro.nombre_persona || (porPersona.has(String(registro.codigo_persona)) ? nombreCompletoGestion(porPersona.get(String(registro.codigo_persona))) : `Persona ${ registro.codigo_persona }`);
        vista.innerHTML = `<p>Crédito: ${ magisEscape(credito.numero_credito || credito.codigo_credito) }</p>` + opciones.map(opcion => {
            const vinculados = opcion.relaciones.filter(r => String(r.codigo_credito) === String(codigoCredito));
            const usados = new Set(vinculados.map(r => String(r[opcion.campo])));
            const disponibles = opcion.registros.filter(r => !usados.has(String(r[opcion.campo])));
            return `<h3>${ opcion.titulo }</h3>${ tablaGestion(["Código", "Persona"], vinculados.map(v => {
                const registro = opcion.registros.find(r => String(r[opcion.campo]) === String(v[opcion.campo]));
                return [v[opcion.campo], registro ? nombre(registro) : "Registro no disponible"];
            })) }
            ${ vinculados.map(v => `<button type="button" class="boton-eliminar" data-quitar-vinculo="${ opcion.tipo }" data-codigo="${ Number(v[opcion.campo]) }">Quitar ${ opcion.tipo } ${ Number(v[opcion.campo]) }</button>`).join(" ") }
            <form class="formulario" id="formVinculo-${ opcion.tipo }">
                <div class="campo"><label for="vinculo-${ opcion.tipo }">${ opcion.tipo === "fiador" ? "Fiador" : "Referencia" }</label>
                <select id="vinculo-${ opcion.tipo }" required ${ disponibles.length ? "" : "disabled" }><option value="">Seleccione</option>
                    ${ disponibles.map(r => `<option value="${ magisEscape(r[opcion.campo]) }">${ magisEscape(nombre(r)) } (${ magisEscape(r[opcion.campo]) })</option>`).join("") }</select></div>
                <p>${ disponibles.length ? "Selecciona un registro existente para asociarlo al crédito." : `No hay registros disponibles. Crea uno en ${ opcion.titulo } si lo necesitas.` }</p>
                <button type="submit" class="boton-guardar" ${ disponibles.length ? "" : "disabled" }>Asociar ${ opcion.tipo }</button>
            </form>`;
        }).join("");
        for (const opcion of opciones) {
            const formulario = vista.querySelector(`#formVinculo-${ opcion.tipo }`);
            formulario.addEventListener("submit", async event => {
                event.preventDefault();
                const boton = formulario.querySelector('[type="submit"]');
                if (boton.disabled || !formulario.reportValidity()) return;
                const codigo = Number(formulario.querySelector("select").value);
                boton.disabled = true;
                try {
                    const [actuales] = await listasGestion([opcion.ruta]);
                    if (!vista.isConnected) return;
                    if (actuales.some(r => String(r.codigo_credito) === String(codigoCredito) && Number(r[opcion.campo]) === codigo)) throw new Error("Este registro ya está asociado al crédito. Vuelve a abrir la pantalla para actualizar las listas.");
                    const datos = { codigo_credito: Number(codigoCredito), [opcion.campo]: codigo };
                    if (opcion.tipo === "referencia") datos.numero_credito = credito.numero_credito;
                    await solicitarGestion(opcion.ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
                    if (vista.isConnected) await mostrarRespaldosCredito(codigoCredito);
                } catch (error) { alert(error.message); }
                finally { boton.disabled = false; }
            });
        }
        vista.querySelectorAll("[data-quitar-vinculo]").forEach(boton => boton.addEventListener("click", async () => {
            if (boton.disabled || !confirm("¿Quitar esta asociación del crédito? La persona y su registro se conservarán.")) return;
            const opcion = opciones.find(o => o.tipo === boton.dataset.quitarVinculo);
            boton.disabled = true;
            try {
                await solicitarGestion(`${ opcion.ruta }/${ Number(codigoCredito) }/${ Number(boton.dataset.codigo) }`, { method: "DELETE" });
                if (vista.isConnected) await mostrarRespaldosCredito(codigoCredito);
            } catch (error) { alert(error.message); }
            finally { boton.disabled = false; }
        }));
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Estos son los nombres que aparecen arriba al abrir cada módulo.
// Usamos el día de Guatemala para que el vencimiento no cambie por la zona horaria del navegador.
function hoyGuatemala(fecha = new Date()) {
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fecha);
    const valor = tipo => partes.find(parte => parte.type === tipo).value;
    return `${ valor("year") }-${ valor("month") }-${ valor("day") }`;
}

function diaCalendario(fecha) {
    if (typeof fecha !== "string") return null;
    const texto = formatearFecha(fecha);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
    const [anio, mes, dia] = texto.split("-").map(Number);
    const numero = Date.UTC(anio, mes - 1, dia);
    const comprobacion = new Date(numero);
    return comprobacion.getUTCFullYear() === anio && comprobacion.getUTCMonth() === mes - 1 && comprobacion.getUTCDate() === dia ? numero / 86400000 : null;
}

function estadoCuotaDetalle(cuota, hoy = hoyGuatemala()) {
    if (cuota.saldoCentavos === 0) return "Pagada";
    const vencimiento = diaCalendario(cuota.fecha_vencimiento);
    const actual = diaCalendario(hoy);
    if (vencimiento === null || actual === null) return "Sin fecha válida";
    if (vencimiento < actual) return "Vencida";
    if (vencimiento === actual) return "Vence hoy";
    return vencimiento - actual <= 7 ? "Próxima a vencer" : "Pendiente";
}

// Las cuotas pagadas no deben aparecer como alertas, aunque su fecha ya haya pasado.
function calcularAlertasVencimiento(creditos, cuotas, pagos, hoy = hoyGuatemala()) {
    const activos = new Map(creditos.filter(c => textoBusquedaGestion(c.estado).trim() === "activo").map(c => [String(c.codigo_credito), c]));
    const saldos = cuotasConSaldoGestion(cuotas, pagos);
    const resultado = { vencidas: [], proximas: [], sinFecha: [] };
    for (const cuota of saldos) {
        const credito = activos.get(String(cuota.codigo_credito));
        if (!credito || cuota.saldoCentavos <= 0) continue;
        const estado = estadoCuotaDetalle(cuota, hoy);
        const registro = { ...cuota, credito, estado };
        if (estado === "Vencida") resultado.vencidas.push(registro);
        else if (estado === "Vence hoy" || estado === "Próxima a vencer") resultado.proximas.push(registro);
        else if (estado === "Sin fecha válida") resultado.sinFecha.push(registro);
    }
    for (const lista of [resultado.vencidas, resultado.proximas]) lista.sort((a, b) => diaCalendario(a.fecha_vencimiento) - diaCalendario(b.fecha_vencimiento));
    return resultado;
}

function mostrarResumenAlertasInicio(creditos, cuotas, pagos) {
    const panel = document.getElementById("magisAlertas");
    if (!panel) return;
    if (!creditos || !cuotas || !pagos) {
        panel.innerHTML = '<h2>Alertas de vencimiento</h2><p class="mensaje-error">No fue posible consultar todos los datos de las alertas.</p><button class="boton-cancelar" onclick="mostrarInicio()">Reintentar</button>';
        return;
    }
    try {
        const alertas = calcularAlertasVencimiento(creditos, cuotas, pagos);
        panel.innerHTML = `<h2>Alertas de vencimiento</h2><p>Cuotas pendientes de créditos activos. Fecha: ${ formatearFechaMostrar(hoyGuatemala()) }.</p>
            <p><strong>${ alertas.vencidas.length }</strong> cuotas vencidas · <strong>${ alertas.proximas.length }</strong> vencen hoy o en los próximos 7 días.</p>
            ${ alertas.sinFecha.length ? `<p class="mensaje-error">${ alertas.sinFecha.length } cuotas tienen una fecha que debe revisarse.</p>` : "" }
            <button class="boton-nuevo" onclick="mostrarAlertasVencimiento()">Ver alertas</button>`;
    } catch (error) {
        panel.innerHTML = '<h2>Alertas de vencimiento</h2><p class="mensaje-error"></p>';
        panel.querySelector("p").textContent = error.message;
    }
}

async function mostrarAlertasVencimiento() {
    if (!confirmarSalidaFormulario()) return;
    magisSelect("cuotas");
    const vista = crearVistaGestion("Alertas de vencimiento", "mostrarInicio()");
    try {
        const [creditos, cuotas, pagos] = await listasGestion(["creditos", "cuotas", "pagos"]);
        if (!vista.isConnected) return;
        const alertas = calcularAlertasVencimiento(creditos, cuotas, pagos);
        const tabla = lista => tablaGestion(["Crédito", "Deudor", "Cuota", "Vencimiento", "Estado", "Saldo pendiente"], lista.map(q => [
            q.credito.numero_credito || q.codigo_credito, q.credito.nombre_deudor || q.credito.codigo_deudor, q.numero_cuota ?? q.codigo_cuota,
            formatearFechaMostrar(q.fecha_vencimiento), q.estado, magisMoney(q.saldoCentavos / 100)]));
        vista.innerHTML = `<p>Cuotas pendientes de créditos activos al ${ formatearFechaMostrar(hoyGuatemala()) }.</p>
            <h3>Vencidas (${ alertas.vencidas.length })</h3>${ tabla(alertas.vencidas) }
            <h3>Vencen hoy o en los próximos 7 días (${ alertas.proximas.length })</h3>${ tabla(alertas.proximas) }
            ${ alertas.sinFecha.length ? `<p class="mensaje-error">Hay ${ alertas.sinFecha.length } cuotas pendientes sin fecha válida. Revísalas en Cuotas.</p>` : "" }
            <h3>Consultar crédito</h3>${ [...new Map([...alertas.vencidas, ...alertas.proximas, ...alertas.sinFecha].map(q => [q.codigo_credito, q.credito])).values()].map(c =>
                `<button class="boton-editar" onclick="mostrarFichaCredito(${ Number(c.codigo_credito) })">${ magisEscape(c.numero_credito || c.codigo_credito) }</button>`).join(" ") || "<p>No hay créditos con alertas.</p>" }`;
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Aquí reunimos toda la información de un crédito sin cambiar ningún registro.
async function mostrarFichaCredito(codigoCredito) {
    if (!confirmarSalidaFormulario()) return;
    magisSelect("creditos");
    const vista = crearVistaGestion("Detalle del crédito", "cargarCreditos()");
    try {
        const resultados = await Promise.allSettled([
            solicitarGestion(`creditos/${ codigoCredito }`),
            listasGestion(["personas", "deudores", "vendedores", "garantias", "vehiculos", "fiadores", "referencias", "creditos-fiadores", "referencias-credito", "cuotas", "pagos"])
        ]);
        if (!vista.isConnected) return;
        const fallo = resultados.find(r => r.status === "rejected");
        if (fallo) throw fallo.reason;
        const credito = resultados[0].value;
        const [personas, deudores, vendedores, garantias, vehiculos, fiadores, referencias, creditosFiadores, referenciasCredito, cuotas, pagos] = resultados[1].value;
        const personaDe = registro => personas.find(p => String(p.codigo_persona) === String(registro?.codigo_persona));
        const deudor = deudores.find(d => String(d.codigo_deudor) === String(credito.codigo_deudor));
        const vendedor = vendedores.find(v => String(v.codigo_vendedor) === String(credito.codigo_vendedor));
        const garantia = garantias.find(g => String(g.codigo_garantia) === String(credito.codigo_garantia));
        const vehiculo = vehiculos.find(v => String(v.codigo_vehiculo) === String(garantia?.codigo_vehiculo));
        const propios = lista => lista.filter(r => String(r.codigo_credito) === String(codigoCredito));
        const pagosPropios = propios(pagos);
        const cuotasPropias = cuotasConSaldoGestion(propios(cuotas), pagosPropios).sort((a, b) => Number(a.numero_cuota) - Number(b.numero_cuota));
        const nombreRol = (registro, fallback) => personaDe(registro) ? nombreCompletoGestion(personaDe(registro)) : registro?.nombre_persona || fallback;
        const respaldo = (vinculos, registros, campo) => propios(vinculos).map(vinculo => {
            const registro = registros.find(r => String(r[campo]) === String(vinculo[campo]));
            return [vinculo[campo], nombreRol(registro, "Persona no disponible")];
        });
        const saldo = cuotasPropias.reduce((total, q) => total + q.saldoCentavos, 0);
        const pagado = pagosPropios.reduce((total, p) => total + centavosGestion(p.monto_pagado), 0);
        vista.innerHTML = `<h3>${ magisEscape(credito.numero_credito || credito.codigo_credito) }</h3>
            ${ tablaGestion(["Dato", "Valor"], [["Código", credito.codigo_credito], ["Estado", credito.estado], ["Fecha", formatearFechaMostrar(credito.fecha_credito)],
                ["Monto del crédito", magisMoney(Number(credito.monto))], ["Plazo", credito.plazo], ["Tasa de interés (%)", credito.tasa_intereses], ["Comisión (%)", credito.porcentaje_comision],
                ["Deudor", nombreRol(deudor, credito.nombre_deudor || credito.codigo_deudor)], ["Vendedor", nombreRol(vendedor, credito.nombre_vendedor || credito.codigo_vendedor)],
                ["Pagos registrados", magisMoney(pagado / 100)], ["Saldo de las cuotas registradas", cuotasPropias.length ? magisMoney(saldo / 100) : "Sin cuotas registradas"]]) }
            <p>El saldo corresponde a las cuotas registradas y sus pagos, incluyendo los cargos que contiene cada cuota.</p>
            <h3>Garantía</h3>${ garantia ? tablaGestion(["Código", "Descripción", "Valor comercial"], [[garantia.codigo_garantia, garantia.descripcion, magisMoney(Number(garantia.valor_comercial))]]) : "<p>Garantía no disponible.</p>" }
            <h3>Vehículo</h3>${ vehiculo ? tablaGestion(["Código", "Placa", "VIN", "Marca", "Línea"], [[vehiculo.codigo_vehiculo, vehiculo.placa, vehiculo.VIN || vehiculo.vin, vehiculo.nombre_marca || vehiculo.codigo_marca, vehiculo.nombre_linea || vehiculo.codigo_linea]]) : "<p>Vehículo no disponible.</p>" }
            <h3>Fiadores</h3>${ tablaGestion(["Código", "Persona"], respaldo(creditosFiadores, fiadores, "codigo_fiador")) }
            <h3>Referencias</h3>${ tablaGestion(["Código", "Persona"], respaldo(referenciasCredito, referencias, "codigo_referencia")) }
            <button class="boton-editar" onclick="mostrarRespaldosCredito(${ Number(codigoCredito) })">Gestionar referencias y fiadores</button>
            <h3>Cuotas</h3>${ tablaGestion(["Cuota", "Vencimiento", "Estado", "Valor", "Saldo pendiente"], cuotasPropias.map(q => [q.numero_cuota ?? q.codigo_cuota,
                formatearFechaMostrar(q.fecha_vencimiento), estadoCuotaDetalle(q), magisMoney(Number(q.valor_total_cuota)), magisMoney(q.saldoCentavos / 100)])) }
            ${ textoBusquedaGestion(credito.estado).trim() === "activo" && saldo > 0 ? `<button class="boton-nuevo" onclick="mostrarFormularioPago(${ Number(codigoCredito) })">Registrar pago</button>` : "" }
            <h3>Pagos</h3>${ tablaGestion(["Transacción", "Comprobante", "Cuota", "Fecha", "Monto", "Medio"], pagosPropios.map(p => [p.codigo_transaccion,
                p.numero_comprobante, p.codigo_cuota, formatearFechaHoraMostrar(p.fecha_hora_pago), magisMoney(Number(p.monto_pagado)), p.nombre_medio_pago || p.codigo_medio_pago])) }
            ${ pagosPropios.map(p => `<button class="boton-editar" onclick="mostrarComprobantePago(${ Number(p.codigo_transaccion) })">Comprobante ${ magisEscape(p.numero_comprobante || p.codigo_transaccion) }</button>`).join(" ") }`;
    } catch (error) { mostrarErrorGestion(vista, error); }
}

async function mostrarComprobantePago(codigoTransaccion) {
    if (!confirmarSalidaFormulario()) return;
    magisSelect("pagos");
    const vista = crearVistaGestion("Comprobante de pago", "cargarPagos()");
    try {
        const resultados = await Promise.allSettled([
            solicitarGestion(`pagos/${ codigoTransaccion }`),
            listasGestion(["creditos", "deudores", "personas", "medios-pago"])
        ]);
        if (!vista.isConnected) return;
        const fallo = resultados.find(r => r.status === "rejected");
        if (fallo) throw fallo.reason;
        const pago = resultados[0].value;
        const [creditos, deudores, personas, medios] = resultados[1].value;
        const credito = creditos.find(c => String(c.codigo_credito) === String(pago.codigo_credito));
        if (!credito) throw new Error("No se encontró el crédito asociado a este pago.");
        const deudor = deudores.find(d => String(d.codigo_deudor) === String(credito.codigo_deudor));
        const persona = personas.find(p => String(p.codigo_persona) === String(deudor?.codigo_persona));
        const medio = medios.find(m => String(m.codigo_medio_pago) === String(pago.codigo_medio_pago));
        const monto = centavosGestion(pago.monto_pagado);
        vista.innerHTML = `<article id="comprobantePago"><h2>MAGIS-AUTO</h2><h3>Comprobante ${ magisEscape(pago.numero_comprobante || pago.codigo_transaccion) }</h3>
            ${ tablaGestion(["Dato", "Valor"], [["Código de transacción", pago.codigo_transaccion], ["Crédito", credito.numero_credito || credito.codigo_credito],
                ["Cliente", persona ? nombreCompletoGestion(persona) : credito.nombre_deudor || credito.codigo_deudor], ["Código de cuota", pago.codigo_cuota],
                ["Fecha y hora de pago", formatearFechaHoraMostrar(pago.fecha_hora_pago)], ["Monto recibido", magisMoney(monto / 100)],
                ["Medio de pago", medio?.descripcion || pago.nombre_medio_pago || pago.codigo_medio_pago], ["Referencia bancaria", pago.referencia_bancaria || "Sin referencia"]]) }
            <p>Comprobante del pago registrado en MAGIS-AUTO.</p></article>
            <p>Presiona Imprimir y elige tu impresora o Guardar como PDF en el navegador.</p>
            <button type="button" class="boton-nuevo" id="imprimirComprobantePago">Imprimir / Guardar PDF</button>`;
        vista.querySelector("#imprimirComprobantePago").addEventListener("click", () => imprimirComprobantePago(vista.querySelector("#comprobantePago").innerHTML));
    } catch (error) { mostrarErrorGestion(vista, error); }
}

// Imprimimos solo el comprobante, sin el menú ni los botones de la aplicación.
function imprimirComprobantePago(contenido) {
    const marco = document.createElement("iframe");
    marco.title = "Impresión del comprobante de pago";
    marco.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
    marco.onload = () => {
        const ventana = marco.contentWindow;
        ventana.addEventListener("afterprint", () => marco.remove(), { once: true });
        ventana.focus();
        ventana.print();
    };
    marco.srcdoc = `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>Comprobante MAGIS-AUTO</title>
        <style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;color:#252525;font-size:12pt}h2{color:#704c35}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{border:1px solid #ddd;padding:10px;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.tabla-contenedor{overflow:visible}</style></head><body>${ contenido }</body></html>`;
    document.body.append(marco);
}

// Guardamos las celdas entre comillas y evitamos que Excel interprete texto como fórmulas.
function crearCSVReporte(filas) {
    return "\uFEFF" + filas.map(fila => fila.map(valor => {
        let texto = String(valor ?? "");
        if (/^[\s\uFEFF]*[=+@-]/.test(texto) && !/^-\d+(?:[.,]\d+)?$/.test(texto)) texto = "'" + texto;
        return `"${ texto.replace(/"/g, '""') }"`;
    }).join(",")).join("\r\n");
}

function descargarTablaCSV(tabla, titulo) {
    if (!tabla.isConnected) return;
    const filas = [...tabla.rows].map(fila => [...fila.cells].map(celda => celda.textContent.trim()));
    const archivo = new Blob([crearCSVReporte(filas)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = url;
    const nombre = textoBusquedaGestion(titulo).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reporte";
    enlace.download = `${ nombre }-${ hoyGuatemala() }.csv`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function agregarExportacionReportes() {
    if (document.getElementById("magisPage")?.textContent !== "Reportes") return;
    document.querySelectorAll("#contenido table").forEach(tabla => {
        if (tabla.dataset.exportacionCsv) return;
        tabla.dataset.exportacionCsv = "true";
        const titulo = document.querySelector("#contenido h2")?.textContent || "Reporte";
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className = "boton-nuevo";
        boton.textContent = "Descargar CSV (Excel)";
        boton.setAttribute("aria-label", `Descargar ${ titulo } en CSV para Excel`);
        boton.addEventListener("click", () => descargarTablaCSV(tabla, titulo));
        tabla.closest(".tabla-contenedor").before(boton);
    });
}

const magisModules = {
    inicio: "Vista general",
    clientes: "Clientes",
    creditos: "Créditos",
    vehiculos: "Vehículos",
    garantias: "Garantías",
    pagos: "Pagos",
    cuotas: "Cuotas",
    vendedores: "Vendedores",
    deudores: "Deudores",
    fiadores: "Fiadores",
    referencias: "Referencias",
    catalogos: "Catálogos",
    reportes: "Reportes"
};
let magisDashboardController;


// Marcamos la opción del menú que está abierta y cambiamos el título de arriba.
function magisSelect(id) {
    document.querySelectorAll("[data-module]").forEach(b => {
        const active = b.dataset.module === id;
        b.classList.toggle("selected", active);
        if (active)
            b.setAttribute("aria-current", "page");
        else
            b.removeAttribute("aria-current");
    });
    document.getElementById("magisPage").textContent = magisModules[id] || "Gestión";
    document.body.classList.remove("nav-open");
    document.querySelector(".mobile-toggle").setAttribute("aria-expanded", "false");
}
// Guardamos la función anterior para seguir usándola y también actualizar el menú.
const magisOriginalOpen = abrirModulo;
abrirModulo = function (modulo) {
    if (!confirmarSalidaFormulario()) return;
    magisDashboardController?.abort();
    magisSelect(modulo);
    return magisOriginalOpen(modulo);
};


// Acomodamos los caracteres especiales para que los datos se vean como texto y no como etiquetas HTML.
function magisEscape(value) {
    return String(value ?? "\u2014").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[c]));
}
const magisMoney = value => new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ"
}).format(value);


// Aquí armamos el inicio y pedimos los datos de los indicadores.
// Si cambiamos de pantalla, cancelamos las consultas anteriores del inicio.
async function mostrarInicio() {
    if (!confirmarSalidaFormulario()) return;
    magisDashboardController?.abort();
    const controller = new AbortController();
    magisDashboardController = controller;
    magisSelect("inicio");
    const content = document.getElementById("contenido");
    content.innerHTML = `<section class="dashboard"><div class="dashboard-heading"><div><span class="eyebrow">EL PANORAMA COMPLETO</span><h1>Tu operación.<br><em>Una visión más clara.</em></h1><p>Créditos, recaudación y clientes en un solo espacio.</p></div><button class="boton-nuevo" onclick="abrirModulo('creditos')">Gestionar créditos ↗</button></div><div class="metrics">${ [
        [
            "cartera",
            "Cartera colocada",
            "Monto total de créditos"
        ],
        [
            "creditos",
            "Créditos registrados",
            "Operaciones de financiamiento"
        ],
        [
            "pagos",
            "Recaudación total",
            "Pagos registrados"
        ],
        [
            "clientes",
            "Clientes",
            "Personas registradas"
        ]
    ].map(([id, title, sub], i) => `<article class="metric ${ i === 0 ? "featured" : "" }"><div>${ title }<span aria-hidden="true">${ [
        "\u2197",
        "\u25C7",
        "\u2193",
        "\u25CE"
    ][i] }</span></div><strong id="magis-${ id }">—</strong><small>${ sub }</small></article>`).join("") }</div><div class="dashboard-columns"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">FINANCIAMIENTO</span><h2>Últimos créditos</h2></div><button class="text-button" onclick="abrirModulo('creditos')">Ver todos ↗</button></div><div id="magisRecent" aria-live="polite"><p class="empty-state">Consultando operaciones…</p></div></section><section class="panel quick-panel"><span class="eyebrow">TU DÍA A DÍA</span><h2>Continuar operando</h2><p>Accede a las tareas de tu equipo.</p><div class="quick-actions"><button onclick="abrirModulo('clientes')"><span>◎</span><div>Clientes<small>Consulta y registro de personas</small></div>↗</button><button onclick="abrirModulo('pagos')"><span>↓</span><div>Pagos<small>Gestiona la recaudación</small></div>↗</button><button onclick="abrirModulo('cuotas')"><span>≡</span><div>Cuotas<small>Revisa el plan de pagos</small></div>↗</button></div><div class="report-callout"><span>ANÁLISIS Y CONTROL</span><h3>Los detalles hacen<br>la diferencia.</h3><button onclick="abrirModulo('reportes')">Explorar reportes ↗</button></div></section></div><section class="panel" id="magisAlertas" aria-live="polite"><h2>Alertas de vencimiento</h2><p>Consultando cuotas pendientes...</p></section><div class="dashboard-note" id="magisDashboardStatus" role="status">Consultando información actual…</div></section>`;
    const results = await Promise.allSettled([
        "creditos",
        "pagos",
        "personas",
        "cuotas"
    ].map(async route => {
        const r = await fetch(`${ API }/${ route }`, { signal: controller.signal });
        if (!r.ok)
            throw new Error(route);
        const data = await r.json();
        if (!Array.isArray(data))
            throw new Error("Formato inesperado");
        return data;
    }));
    if (controller.signal.aborted || !document.getElementById("magisRecent"))
        return;
    const [credits, payments, people, cuotas] = results.map(r => r.status === "fulfilled" ? r.value : null);
    const numericTotal = (rows, key) => rows.every(r => r[key] !== null && r[key] !== "" && Number.isFinite(Number(r[key]))) ? rows.reduce((s, r) => s + Number(r[key]), 0) : null;
    if (credits) {
        const total = numericTotal(credits, "monto");
        document.getElementById("magis-cartera").textContent = total === null ? "No disponible" : magisMoney(total);
        document.getElementById("magis-creditos").textContent = credits.length;
        const recent = [...credits].sort((a, b) => (Date.parse(b.fecha_credito) || 0) - (Date.parse(a.fecha_credito) || 0)).slice(0, 5);
        document.getElementById("magisRecent").innerHTML = recent.length ? `<div class="tabla-contenedor"><table><thead><tr><th>Crédito / Cliente</th><th>Monto</th><th>Estado</th></tr></thead><tbody>${ recent.map(c => `<tr><td><strong>${ magisEscape(c.numero_credito || c.codigo_credito) }</strong><small class="cell-sub">${ magisEscape(c.nombre_deudor || c.codigo_deudor) }</small></td><td>${ Number.isFinite(Number(c.monto)) ? magisMoney(Number(c.monto)) : "\u2014" }</td><td><span class="status-badge">${ magisEscape(c.estado) }</span></td></tr>`).join("") }</tbody></table></div>` : "<p class=\"empty-state\">Aún no hay créditos registrados.</p>";
    } else
        document.getElementById("magisRecent").innerHTML = "<div class=\"empty-state\">No fue posible consultar los créditos.<br><button class=\"text-button\" onclick=\"mostrarInicio()\">Reintentar \u21BB</button></div>";
    if (payments) {
        const total = numericTotal(payments, "monto_pagado");
        document.getElementById("magis-pagos").textContent = total === null ? "No disponible" : magisMoney(total);
    }
    if (people)
        document.getElementById("magis-clientes").textContent = people.length;
    mostrarResumenAlertasInicio(credits, cuotas, payments);
    const ok = results.every(r => r.status === "fulfilled");
    document.getElementById("magisConnection").textContent = ok ? "Conexión verificada" : "Conexión incompleta";
    document.querySelector(".connection-dot").classList.toggle("connected", ok);
    document.getElementById("magisDashboardStatus").textContent = ok ? "Información consultada: " + new Date().toLocaleTimeString("es-GT", {
        hour: "2-digit",
        minute: "2-digit"
    }) + " \xB7 Totales de registros disponibles." : "Algunos datos no están disponibles. Verifica que la API esté en ejecución y vuelve a intentar.";
}


// Preparar el menú, las tablas y la pantalla de inicio al cargar la página
// Cuando termina de cargar el HTML, preparamos la fecha, el menú y el inicio.
// Usamos la misma protección en los formularios que todavía no bloqueaban el envío.
registrarCredito = protegerEnvioFormulario(registrarCredito);
actualizarCredito = protegerEnvioFormulario(actualizarCredito);
registrarVehiculo = protegerEnvioFormulario(registrarVehiculo);
actualizarVehiculo = protegerEnvioFormulario(actualizarVehiculo);
registrarGarantia = protegerEnvioFormulario(registrarGarantia);
actualizarGarantia = protegerEnvioFormulario(actualizarGarantia);
registrarCuota = protegerEnvioFormulario(registrarCuota);
actualizarCuota = protegerEnvioFormulario(actualizarCuota);
registrarVendedor = protegerEnvioFormulario(registrarVendedor);
actualizarVendedor = protegerEnvioFormulario(actualizarVendedor);
registrarDeudor = protegerEnvioFormulario(registrarDeudor);
actualizarDeudor = protegerEnvioFormulario(actualizarDeudor);
registrarFiador = protegerEnvioFormulario(registrarFiador);
actualizarFiador = protegerEnvioFormulario(actualizarFiador);
actualizarReferencia = protegerEnvioFormulario(actualizarReferencia);
registrarMarca = protegerEnvioFormulario(registrarMarca);
actualizarMarca = protegerEnvioFormulario(actualizarMarca);
registrarLinea = protegerEnvioFormulario(registrarLinea);
actualizarLinea = protegerEnvioFormulario(actualizarLinea);
registrarTipoTelefono = protegerEnvioFormulario(registrarTipoTelefono);
actualizarTipoTelefono = protegerEnvioFormulario(actualizarTipoTelefono);
registrarTipoDireccion = protegerEnvioFormulario(registrarTipoDireccion);
actualizarTipoDireccion = protegerEnvioFormulario(actualizarTipoDireccion);
registrarDepartamento = protegerEnvioFormulario(registrarDepartamento);
actualizarDepartamento = protegerEnvioFormulario(actualizarDepartamento);
registrarMunicipio = protegerEnvioFormulario(registrarMunicipio);
actualizarMunicipio = protegerEnvioFormulario(actualizarMunicipio);
registrarTipoReferencia = protegerEnvioFormulario(registrarTipoReferencia);
actualizarTipoReferencia = protegerEnvioFormulario(actualizarTipoReferencia);
registrarTipoGarantia = protegerEnvioFormulario(registrarTipoGarantia);
actualizarTipoGarantia = protegerEnvioFormulario(actualizarTipoGarantia);
registrarMedioPago = protegerEnvioFormulario(registrarMedioPago);
actualizarMedioPago = protegerEnvioFormulario(actualizarMedioPago);

document.addEventListener("DOMContentLoaded", () => {
    prepararAvisosFormulario();
    document.getElementById("magisDate").textContent = new Date().toLocaleDateString("es-GT", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    document.querySelector(".mobile-toggle").addEventListener("click", e => {
        const open = document.body.classList.toggle("nav-open");
        e.currentTarget.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            document.body.classList.remove("nav-open");
            document.querySelector(".mobile-toggle").setAttribute("aria-expanded", "false");
        }
    });
    const content = document.getElementById("contenido");
    // Revisamos las tablas que van apareciendo para ponerles desplazamiento y colores de estado.
    new MutationObserver(() => {
        content.querySelectorAll("table").forEach(table => {
            if (!table.parentElement.classList.contains("tabla-contenedor")) {
                const wrapper = document.createElement("div");
                wrapper.className = "tabla-contenedor";
                table.before(wrapper);
                wrapper.append(table);
            }
            const wrap = table.parentElement;
            if (!wrap.hasAttribute("tabindex")) {
                wrap.tabIndex = 0;
                wrap.setAttribute("role", "region");
                wrap.setAttribute("aria-label", "Tabla de datos; desplaza horizontalmente para ver todas las columnas");
            }
        });
        agregarExportacionReportes();
        content.querySelectorAll("td").forEach(td => {
            if (td.childElementCount || td.dataset.magisStatus)
                return;
            const value = td.textContent.trim();
            if (/^(activo|activa|inactivo|inactiva|pagada|pagado|pendiente|vencida|vencido|cancelado|cancelada)$/i.test(value)) {
                td.dataset.magisStatus = "true";
                const badge = document.createElement("span");
                badge.className = "status-badge " + (/vencid|inactiv|cancelad/i.test(value) ? "status-alert" : /pendiente/i.test(value) ? "status-pending" : "status-ok");
                badge.textContent = value;
                td.replaceChildren(badge);
            }
        });
    }).observe(content, {
        childList: true,
        subtree: true
    });
    mostrarInicio();
});
