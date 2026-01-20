// ===== CONFIG SUPABASE (SOLO ADM - SIMPLE) =====
const SUPABASE_URL = "https://ugeydxozfewzhldjbkat.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZeLC2rOxhhUXlQdvJ28JkA_qf802-pX";

(function () {
  // ===== DOM refs =====
  const chkFinalizar = document.getElementById("aFinalizarCheckbox");
  const fechaCaducidadInput = document.getElementById("fechaCaducidad");

  const numOrdenEl = document.getElementById("numOrden");
  const textoRefEl = document.getElementById("textoRef");
  const franjasEl = document.getElementById("franjas");
  const fechaVigenciaEl = document.getElementById("fechaVigencia");

  const selectOrdenExistente = document.getElementById("ordenExistente");
  const infoOrdenEl = document.getElementById("infoOrden");

  const exportBoxEl = document.getElementById("exportBox");
  const importBoxEl = document.getElementById("importBox");
  const toggleExportImport = document.getElementById("toggleExportImport");
  const exportImportContainer = document.getElementById("exportImportContainer");


  // Botón publicar (visual). Si no existe o el id es distinto, el bloqueo igual se aplica por función.
  const btnPublicar = document.getElementById("btnPublicarOrdenes");
  
  // ===== Estado de publicación por ciclo =====
  // Reglas:
  // - Solo se puede publicar si hubo AL MENOS 1 cambio desde la última publicación.
  // - Al publicar OK, queda bloqueado otra vez hasta que exista un nuevo cambio.
  let cambiosId = 0;
  let ultimoPublicadoId = 0;
  // ===== Estado edición =====
  let ordenSeleccionadaIdx = null;
  
  function marcarCambio() {
    cambiosId += 1;
    actualizarEstadoPublicar();
  }

  function puedePublicar() {
    return cambiosId > ultimoPublicadoId;
  }

  function actualizarEstadoPublicar() {
    if (!btnPublicar) return;
    btnPublicar.disabled = !puedePublicar();
  }

  // ===== Bind A FINALIZAR =====
  if (typeof CaducidadFinalizar !== "undefined") {
    CaducidadFinalizar.bindAFinalizar({
      checkboxEl: chkFinalizar,
      inputEl: fechaCaducidadInput
    });
  }

  // ======================================================
  // ===== EVENTO SELECT ORDEN =============================
  // ======================================================
  selectOrdenExistente.addEventListener("change", () => {
    const v = selectOrdenExistente.value;

    // ✅ si el usuario dejó "sin selección" => nueva orden
    if (v === "") {
      limpiarCampos();
      return;
    }

    const idx = Number(v);
    if (isNaN(idx)) return;

    const ordenes = StorageApp.cargarOrdenes();
    const o = ordenes[idx];
    if (!o) return;
    // ✅ entra en modo edición
    ordenSeleccionadaIdx = idx;
    
    numOrdenEl.value = o.num || "";
    textoRefEl.value = o.textoRef || "";
    fechaVigenciaEl.value = o.vigencia || "";
    fechaCaducidadInput.value = o.caducidad || "";

    franjasEl.value = (o.franjas || [])
      .map(f => `${f.horario} - ${f.lugar} - ${f.titulo}`)
      .join("\n");
  });

  // ======================================================
  // ===== UTIL UI ========================================
  // ======================================================
  function actualizarSelector() {
    const ordenes = StorageApp.cargarOrdenes();
    selectOrdenExistente.innerHTML = "";
    // ✅ opción vacía para permitir "sin selección"
    const optVacio = document.createElement("option");
    optVacio.value = "";
    optVacio.text = ""; // si querés ver texto, poné: "-- nueva orden --"
    selectOrdenExistente.appendChild(optVacio);

    ordenes.forEach((o, i) => {
      if (!o || !o.num) return;
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.text = `${o.num} ${o.textoRef || ""}`.trim();
      selectOrdenExistente.appendChild(opt);
    });
    // ✅ dejar el select sin selección (modo nueva orden)
    selectOrdenExistente.value = "";

    if (!selectOrdenExistente.options.length && infoOrdenEl) {
      infoOrdenEl.innerHTML = "";
    }
  }

  function limpiarCampos() {
    numOrdenEl.value = "";
    textoRefEl.value = "";
    franjasEl.value = "";
    fechaVigenciaEl.value = "";
    fechaCaducidadInput.readOnly = false;
    fechaCaducidadInput.value = "";
    chkFinalizar.checked = false;
    // 🔴 salir del modo edición
    ordenSeleccionadaIdx = null;
    selectOrdenExistente.value = "";
  }
  

  function limpiarOrdenesCaducadas() {
    const ordenes = StorageApp.cargarOrdenes();
    const filtradas = OrdersSync.filtrarCaducadas(ordenes);
    StorageApp.guardarOrdenes(filtradas);
    // Ojo: esto NO cuenta como “cargar orden” para habilitar publicar.
  }

  // ======================================================
  // ===== PARSE FRANJAS ==================================
  // ======================================================
  function parseFranjas(raw) {
    const lines = String(raw || "")
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean);

    const out = [];
    const re = /^(.*?)\s*[-–—]\s*(.*?)\s*[-–—]\s*(.*?)$/;

    for (let i = 0; i < lines.length; i++) {
      const m = re.exec(lines[i]);
      if (!m) {
        return { ok: false, error: `Error en franja ${i + 1}: HORARIO - LUGAR - TÍTULO` };
      }

      const horario = m[1].trim();
      const lugar = m[2].trim();
      const titulo = m[3].trim();

      if (!horario || !lugar || !titulo) {
        return { ok: false, error: `Error en franja ${i + 1}: campos vacíos` };
      }

      out.push({ horario, lugar, titulo });
    }

    return out.length
      ? { ok: true, franjas: out }
      : { ok: false, error: "Debe existir al menos una franja válida" };
  }

  // ======================================================
  // ===== PUBLICAR A SUPABASE =============================
  // ======================================================
  async function publicarOrdenes(modo) {
    // ✅ Bloqueo real (aunque el botón no esté deshabilitado o el id sea distinto)
    if (!puedePublicar()) {
      alert("primero cargue orden");
      return;
    }

    try {
      const ordenes = StorageApp.cargarOrdenes();

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_store?id=eq.1`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer " + SUPABASE_ANON_KEY,
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            payload: ordenes,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!r.ok) {
        const t = await r.text();
        alert("ERROR al publicar:\n" + t);
        return;
      }
      if (modo === "eliminar") {
        alert("ORDEN ELIMINADA CORRECTAMENTE!");
      } else {
        alert("ÓRDENES PUBLICADAS CORRECTAMENTE!");
      }
      

      // ✅ Vuelve a estado inicial: bloqueado hasta nuevo cambio
      ultimoPublicadoId = cambiosId;
      actualizarEstadoPublicar();

    } catch (e) {
      alert("ERROR PUBLICAR:\n" + e.message);
    }
  }

  window.publicarOrdenes = publicarOrdenes;

  // ======================================================
  // ===== ACCIONES =======================================
  // ======================================================
  window.agregarOrden = function () {
    const num = numOrdenEl.value.trim();
    const textoRef = textoRefEl.value.trim();
    const franjasRaw = franjasEl.value.trim();
    const caducidad = fechaCaducidadInput.value.trim();
    const vigencia = fechaVigenciaEl.value;

    if (!num || !franjasRaw || !caducidad || !vigencia) {
      alert("Complete todos los campos obligatorios");
      return;
    }

    if (caducidad.toUpperCase() !== "A FINALIZAR") {
      const fin = Dates.parseDDMMYYYYToDate(caducidad);
      if (!fin) {
        alert("Caducidad inválida");
        return;
      }
    }

    const pf = parseFranjas(franjasRaw);
    if (!pf.ok) {
      alert(pf.error);
      return;
    }

    const nueva = { num, textoRef, franjas: pf.franjas, caducidad, vigencia };
    const ordenes = StorageApp.cargarOrdenes();
    if (ordenSeleccionadaIdx !== null) {
      ordenes[ordenSeleccionadaIdx] = nueva;
    } else {
      ordenes.push(nueva);
    }

    StorageApp.guardarOrdenes(ordenes);
    actualizarSelector();
    limpiarCampos();
    // 🔴 salir del modo edición
    ordenSeleccionadaIdx = null;
    // ✅ habilita publicar (nuevo cambio)
    marcarCambio();

    alert("Orden guardada");
  };

  window.eliminarOrden = async function () {
    const idx = Number(selectOrdenExistente.value);
    if (isNaN(idx)) return;

    const ordenes = StorageApp.cargarOrdenes();
    if (!ordenes[idx]) return;

    const ok = confirm("¿Está seguro que desea eliminar?");
    if (!ok) return;

    ordenes.splice(idx, 1);
    StorageApp.guardarOrdenes(ordenes);
    actualizarSelector();

    // ✅ cambio => habilita publicar, pero como tu requerimiento original era publicar automático al eliminar:
    marcarCambio();
    await publicarOrdenes("eliminar");
  };

  window.exportarOrdenes = () =>
    OrdersExport.exportToTextarea(exportBoxEl);

  window.importarOrdenes = function () {
    const txt = importBoxEl.value.trim();
    if (!txt) return;

    const r = OrdersExport.importFromText(txt);
    if (!r.ok) {
      alert("Error: " + r.error);
      return;
    }

    limpiarOrdenesCaducadas();
    actualizarSelector();
    importBoxEl.value = "";

    // ✅ importar cuenta como “cargar orden” => habilita publicar
    marcarCambio();
  };
  if (toggleExportImport && exportImportContainer) {
    toggleExportImport.addEventListener("change", () => {
      exportImportContainer.classList.toggle("hidden", !toggleExportImport.checked);
    });
  }
  document.addEventListener("pointerdown", (e) => {
    // si el click fue dentro del select, no hacemos nada
    if (e.target.closest("#ordenExistente")) return;

    // si hay algo seleccionado o estamos en edición => salir a nueva orden
    if (selectOrdenExistente.value !== "" || ordenSeleccionadaIdx !== null) {
      limpiarCampos();
    }
  }, true);



  // ======================================================
  // ===== INIT ===========================================
  // ======================================================
  (function init() {
    limpiarOrdenesCaducadas();
    actualizarSelector();

    // ✅ Estado inicial bloqueado aunque existan órdenes guardadas
    cambiosId = 0;
    ultimoPublicadoId = 0;
    actualizarEstadoPublicar();
    // Estado inicial exportar / importar
    if (toggleExportImport && exportImportContainer) {
      toggleExportImport.checked = false;
      exportImportContainer.classList.add("hidden");
    }
  })();
})();






















