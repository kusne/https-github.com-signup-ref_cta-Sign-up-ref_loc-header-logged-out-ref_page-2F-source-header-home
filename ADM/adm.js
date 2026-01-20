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

  // ===== Bind A FINALIZAR =====
  if (typeof CaducidadFinalizar !== "undefined") {
    CaducidadFinalizar.bindAFinalizar({
      checkboxEl: chkFinalizar,
      inputEl: fechaCaducidadInput
    });
  }

  // ======================================================
  // ===== EVENTO SELECT ORDEN (SOLO ESTO) =================
  // ======================================================
  selectOrdenExistente.addEventListener("change", () => {
    const idx = Number(selectOrdenExistente.value);
    if (isNaN(idx)) return;

    const ordenes = StorageApp.cargarOrdenes();
    const o = ordenes[idx];
    if (!o) return;

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

    ordenes.forEach((o, i) => {
      if (!o || !o.num) return;
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.text = `${o.num} ${o.textoRef || ""}`.trim();
      selectOrdenExistente.appendChild(opt);
    });

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
  }

  function limpiarOrdenesCaducadas() {
    const ordenes = StorageApp.cargarOrdenes();
    const filtradas = OrdersSync.filtrarCaducadas(ordenes);
    StorageApp.guardarOrdenes(filtradas);
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
  async function publicarOrdenes() {
    try {
      const ordenes = StorageApp.cargarOrdenes();

      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_store?id=eq.1`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Prefer": "return=minimal"
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

      alert("ÓRDENES PUBLICADAS CORRECTAMENTE");
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
    const idx = ordenes.findIndex(o => o && o.num === num);

    if (idx >= 0) ordenes[idx] = nueva;
    else ordenes.push(nueva);

    StorageApp.guardarOrdenes(ordenes);
    actualizarSelector();
    limpiarCampos();
    alert("Orden guardada");
  };

  window.eliminarOrden = function () {
    const idx = Number(selectOrdenExistente.value);
    if (isNaN(idx)) return;

    const ordenes = StorageApp.cargarOrdenes();
    if (!ordenes[idx]) return;

    ordenes.splice(idx, 1);
    StorageApp.guardarOrdenes(ordenes);
    actualizarSelector();
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
  };

  // ======================================================
  // ===== INIT ===========================================
  // ======================================================
  (function init() {
    limpiarOrdenesCaducadas();
    actualizarSelector();
  })();
})();









