// ===== CONFIG SUPABASE (SOLO LECTURA WSP) ===== 
const SUPABASE_URL = "https://ugeydxozfewzhldjbkat.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZeLC2rOxhhUXlQdvJ28JkA_qf802-pX";

(function () {
  // ===== DOM refs =====
  const elToggleCarga = document.getElementById("toggleCarga");
  const elBloqueCarga = document.getElementById("bloqueCargaOrdenes");
  const elImportBox = document.getElementById("importBox");
  const btnCargarOrdenes = document.getElementById("btnCargarOrdenes");

  const selTipo = document.getElementById("tipo");
  const selOrden = document.getElementById("orden");
  const selHorario = document.getElementById("horario");

  const divFinaliza = document.getElementById("finaliza");
  const divDetalles = document.getElementById("bloqueDetalles");

  const btnEnviar = document.getElementById("btnEnviar");

  // ===== Estado =====
  let ordenSeleccionada = null;
  let franjaSeleccionada = null;

  // ======================================================
  // ===== LECTURA DESDE SUPABASE (FUENTE REAL) ============
  // ======================================================
  async function syncOrdenesDesdeServidor() {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/ordenes_store?select=payload&order=updated_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY
        }
      }
    );

    if (!r.ok) return false;

    const data = await r.json();
    if (!Array.isArray(data) || !Array.isArray(data[0]?.payload)) return false;

    // ✅ payload ES el array de órdenes
    StorageApp.guardarOrdenes(data[0].payload);
    return true;

  } catch (e) {
    console.error("Error leyendo Supabase:", e);
    return false;
  }
}


  // ===== UI =====
  function toggleCargaOrdenes() {
    elBloqueCarga.classList.toggle("hidden", !elToggleCarga.checked);
  }

  function limpiarSeleccionOrden() {
    ordenSeleccionada = null;
    franjaSeleccionada = null;
    selOrden.value = "";
    selHorario.innerHTML = '<option value="">Seleccionar horario</option>';
  }

  function importarOrdenes() {
    const texto = elImportBox.value.trim();
    if (!texto) return;

    let data;
    try { data = JSON.parse(texto); }
    catch { return; }

    if (!Array.isArray(data)) return;

    StorageApp.guardarOrdenes(data);
    cargarOrdenesDisponibles();
    limpiarSeleccionOrden();
  }

  // ===== Guardia =====
  function getGuardiaInicio() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(6, 0, 0, 0);
    if (now < start) start.setDate(start.getDate() - 1);
    return start;
  }

  function extraerHoraInicio(h) {
    const m = String(h || "").match(/(\d{1,2})/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return (n >= 0 && n <= 23) ? n : null;
  }

  function franjaEnGuardia(h) {
    const hi = extraerHoraInicio(h);
    if (hi === null) return true;

    const inicio = getGuardiaInicio();
    const fin = new Date(inicio.getTime() + 86400000);
    const f = new Date(inicio);
    f.setHours(hi, 0, 0, 0);
    if (f < inicio) f.setDate(f.getDate() + 1);
    return f >= inicio && f < fin;
  }

  function cargarOrdenesDisponibles() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let ordenes = OrdersSync.filtrarCaducadas(StorageApp.cargarOrdenes());
    StorageApp.guardarOrdenes(ordenes);

    selOrden.innerHTML = '<option value="">Seleccionar</option>';

    ordenes.forEach((o, i) => {
      const v = Dates.parseVigenciaToDate(o.vigencia);
      if (!v || v > hoy) return;
      if (!o.franjas?.some(f => franjaEnGuardia(f.horario))) return;

      const op = document.createElement("option");
      op.value = i;
      op.text = `${o.num} ${o.textoRef || ""}`.trim();
      selOrden.appendChild(op);
    });
  }

  function cargarHorariosOrden() {
    ordenSeleccionada = null;
    franjaSeleccionada = null;

    const ordenes = StorageApp.cargarOrdenes();
    const idx = Number(selOrden.value);
    if (!ordenes[idx]) return;

    ordenSeleccionada = ordenes[idx];
    selHorario.innerHTML = '<option value="">Seleccionar horario</option>';

    ordenSeleccionada.franjas.forEach((f, i) => {
      if (franjaEnGuardia(f.horario)) {
        const o = document.createElement("option");
        o.value = i;
        o.text = f.horario;
        selHorario.appendChild(o);
      }
    });
  }

  function actualizarDatosFranja() {
    if (!ordenSeleccionada) return;
    franjaSeleccionada = ordenSeleccionada.franjas[Number(selHorario.value)] || null;
  }

  function actualizarTipo() {
    const fin = selTipo.value === "FINALIZA";
    divFinaliza.classList.toggle("hidden", !fin);
    divDetalles.classList.toggle("hidden", !fin);
  }

  // ======================================================
  // ===== FUNCIONES QUE FALTABAN (CLAVE) =================
  // ======================================================
  function seleccion(clase) {
    return Array.from(document.querySelectorAll("." + clase + ":checked"))
      .map(e => e.value)
      .join("\n");
  }

  function seleccionLinea(clase, sep) {
    const v = Array.from(document.querySelectorAll("." + clase + ":checked"))
      .map(e => e.value);
    return v.length ? v.join(" " + sep + " ") : "/";
  }

  // ===== ENVIAR A WHATSAPP =====
function enviar() {
  
  if (!ordenSeleccionada || !franjaSeleccionada) return;

  const fecha = new Date().toLocaleDateString("es-AR");

  let bloqueResultados = "";
  let textoDetalles = "";
  // ⬇️ SOLO si es FINALIZA agregamos los numerales
  if (selTipo.value === "FINALIZA") {
    const vehiculos = document.getElementById("vehiculos")?.value || 0;
    const personas = document.getElementById("personas")?.value || 0;
    const testalom = document.getElementById("testalom")?.value || 0;
    const alco = document.getElementById("Alcotest")?.value || 0;
    const posSan = document.getElementById("positivaSancionable")?.value || 0;
    const posNo = document.getElementById("positivaNoSancionable")?.value || 0;
    const actas = document.getElementById("actas")?.value || 0;
    const requisa = document.getElementById("Requisa")?.value || 0;
    const qrz = document.getElementById("qrz")?.value || 0;
    const dominio = document.getElementById("dominio")?.value || 0;

    const remision = document.getElementById("Remision")?.value || 0;
    const retencion = document.getElementById("Retencion")?.value || 0;
    const prohibicion = document.getElementById("Prohibicion")?.value || 0;
    const cesion = document.getElementById("Cesion")?.value || 0;
    
    
    
    
    bloqueResultados =
`Resultados:
Vehículos fiscalizados: (${vehiculos})
Personas identificadas: (${personas})
Test de Alómetro: (${testalom})
Test de Alcoholímetro: (${alco})
Positiva sancionable: (${posSan})
Positiva no sancionable: (${posNo})
Actas labradas: (${actas})
Requisas: (${requisa})
QRZ: (${qrz})
Dominio: (${dominio})
Medidas cautelares:
Remisión: (${remision})
Retención: (${retencion})
Prohibición de circulación: (${prohibicion})
Cesión de conducción: (${cesion})

`;
 const detallesTexto = document.getElementById("detalles")?.value?.trim();

 if (detallesTexto) {
    textoDetalles =
`Detalles:
${detallesTexto}
`;
  }
}
  const texto =
`POLICÍA DE LA PROVINCIA DE SANTA FE - GUARDIA PROVINCIAL
BRIGADA MOTORIZADA CENTRO NORTE

TERCIO CHARLIE

${selTipo.value} ${franjaSeleccionada.titulo} ${ordenSeleccionada.num}

Fecha: ${fecha}
Horario: ${franjaSeleccionada.horario}
Lugar: ${franjaSeleccionada.lugar}

Personal Policial:
${seleccion("personal")}

Móviles: ${seleccionLinea("movil", "/")}

${bloqueResultados}
${textoDetalles}
    
Observaciones:
${document.getElementById("obs")?.value || "Sin novedad"}

Se adjunta vista fotográfica`;

  window.location.href =
    "https://wa.me/?text=" + encodeURIComponent(texto);
}


  // ===== Eventos =====
  elToggleCarga.addEventListener("change", toggleCargaOrdenes);
  btnCargarOrdenes.addEventListener("click", importarOrdenes);
  selOrden.addEventListener("change", cargarHorariosOrden);
  selHorario.addEventListener("change", actualizarDatosFranja);
  selTipo.addEventListener("change", actualizarTipo);
  btnEnviar.addEventListener("click", enviar);

  // ===== Init =====
  (async function init() {
    toggleCargaOrdenes();
    actualizarTipo();
    await syncOrdenesDesdeServidor();
    cargarOrdenesDisponibles();
  })();
})();




















