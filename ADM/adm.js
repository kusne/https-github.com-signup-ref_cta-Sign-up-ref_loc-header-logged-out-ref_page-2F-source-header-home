// ===== CONFIG SUPABASE (SOLO ADM) =====
const SUPABASE_URL = "https://ugeydxozfewzhldjbkat.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZeLC2rOxhhUXlQdvJ28JkA_qf802-pX";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
// ===== COMPATIBILIDAD ONCLICK (evita "is not defined") =====
window.agregarOrden = window.agregarOrden || function () {
  alert("ADM aún no inicializó. Recargá con Ctrl+F5.");
};
window.publicarOrdenes = window.publicarOrdenes || function () {
  alert("ADM aún no inicializó. Recargá con Ctrl+F5.");
};

// ======================================================
// TODO EL CÓDIGO DEPENDIENTE DEL DOM VA ACÁ
// ======================================================
document.addEventListener("DOMContentLoaded", async () => {

  // ===== CONTENEDORES LOGIN / ADM =====
  const loginContainer = document.getElementById("loginContainer");
  const admContainer = document.getElementById("admContainer");

  // ===== LOGIN ELEMENTS =====
  const btnLogin = document.getElementById("btnLogin");
  const btnForgot = document.getElementById("btnForgot");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginError = document.getElementById("loginError");

  // ===== ADM ELEMENTS =====
  const chkFinalizar = document.getElementById("aFinalizarCheckbox");
  const fechaCaducidadInput = document.getElementById("fechaCaducidad");
  const numOrdenEl = document.getElementById("numOrden");
  const textoRefEl = document.getElementById("textoRef");
  const franjasEl = document.getElementById("franjas");
  const fechaVigenciaEl = document.getElementById("fechaVigencia");
  const selectOrdenExistente = document.getElementById("ordenExistente");
  const btnPublicar = document.getElementById("btnPublicarOrdenes");

  // ===== EXPORT / IMPORT TOGGLE (TU CÓDIGO, SE RESPETA) =====
  const toggleExportImport = document.getElementById("toggleExportImport");
  const exportImportContainer = document.getElementById("exportImportContainer");
  if (toggleExportImport && exportImportContainer) {
    toggleExportImport.addEventListener("change", () => {
      if (toggleExportImport.checked) {
        exportImportContainer.classList.remove("hidden");
      } else {
        exportImportContainer.classList.add("hidden");
      }
    });
  }

  // ===== LOGOUT (TU CÓDIGO, SE RESPETA) =====
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();

      // volver al login
      admContainer.style.display = "none";
      loginContainer.style.display = "block";
    });
  }

  // ======================================================
  // ESTADO DE CAMBIOS / PUBLICACIÓN (TU CÓDIGO, SE RESPETA)
  // + RESTAURACIÓN DE DISPARADORES
  // ======================================================
  let cambiosId = 0;
  let ultimoPublicadoId = 0;
  let ordenSeleccionadaIdx = null;

  function marcarCambio() {
    cambiosId++;
    actualizarEstadoPublicar();
  }

  function puedePublicar() {
    return cambiosId > ultimoPublicadoId;
  }

  function actualizarEstadoPublicar() {
    if (btnPublicar) {
      btnPublicar.disabled = !puedePublicar();
    }
  }

  // ======================================================
  // FINALIZAR / CADUCIDAD (TU CÓDIGO, SE RESPETA)
  // ======================================================
  if (typeof CaducidadFinalizar !== "undefined") {
    CaducidadFinalizar.bindAFinalizar({
      checkboxEl: chkFinalizar,
      inputEl: fechaCaducidadInput
    });
  }

  // ======================================================
  // PARSEO DE FRANJAS (RESTAURADO)
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
      if (!m) return { ok: false, error: `Error en franja ${i + 1}` };
      out.push({ horario: m[1].trim(), lugar: m[2].trim(), titulo: m[3].trim() });
    }

    return out.length ? { ok: true, franjas: out } : { ok: false, error: "Sin franjas" };
  }

  // ======================================================
  // SELECTOR: ACTUALIZAR LISTA DE ÓRDENES (RESTAURADO)
  // ======================================================
  function actualizarSelector() {
    if (!selectOrdenExistente) return;

    // defensivo: si StorageApp no está cargado, no rompemos todo
    if (typeof StorageApp === "undefined" || !StorageApp.cargarOrdenes) {
      console.error("StorageApp no está disponible: no se puede cargar el selector de órdenes.");
      return;
    }

    const ordenes = StorageApp.cargarOrdenes();
    selectOrdenExistente.innerHTML = "";

    const optVacio = document.createElement("option");
    optVacio.value = "";
    optVacio.text = "";
    selectOrdenExistente.appendChild(optVacio);

    ordenes.forEach((o, i) => {
      if (!o || !o.num) return;
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.text = `${o.num} ${o.textoRef || ""}`.trim();
      selectOrdenExistente.appendChild(opt);
    });

    selectOrdenExistente.value = "";
  }

  // ======================================================
  // LIMPIAR CAMPOS (TU CÓDIGO, SE RESPETA)
  // ======================================================
  function limpiarCampos() {
    if (numOrdenEl) numOrdenEl.value = "";
    if (textoRefEl) textoRefEl.value = "";
    if (franjasEl) franjasEl.value = "";
    if (fechaVigenciaEl) fechaVigenciaEl.value = "";
    if (fechaCaducidadInput) fechaCaducidadInput.value = "";
    if (chkFinalizar) chkFinalizar.checked = false;
    ordenSeleccionadaIdx = null;
    if (selectOrdenExistente) selectOrdenExistente.value = "";
  }

  // ======================================================
  // LIMPIAR ÓRDENES CADUCADAS (RESTAURADO, DEFENSIVO)
  // ======================================================
  function limpiarOrdenesCaducadas() {
    if (typeof StorageApp === "undefined" || !StorageApp.cargarOrdenes || !StorageApp.guardarOrdenes) {
      console.error("StorageApp no está disponible: no se puede limpiar caducadas.");
      return;
    }
    if (typeof OrdersSync === "undefined" || !OrdersSync.filtrarCaducadas) {
      console.error("OrdersSync no está disponible: no se puede filtrar caducadas.");
      return;
    }

    const ordenes = StorageApp.cargarOrdenes();
    const filtradas = OrdersSync.filtrarCaducadas(ordenes);
    StorageApp.guardarOrdenes(filtradas);
  }

  // ======================================================
  // AGREGAR / ACTUALIZAR ORDEN (RESTAURADO)
  // ======================================================
  function agregarOrden() {
    window.agregarOrden = agregarOrden;

    // defensivo
    if (typeof StorageApp === "undefined" || !StorageApp.cargarOrdenes || !StorageApp.guardarOrdenes) {
      alert("Error: StorageApp no está disponible. Revisá que se cargue el script de Storage.");
      return;
    }

    const num = (numOrdenEl?.value || "").trim();
    const textoRef = (textoRefEl?.value || "").trim();
    const vigencia = (fechaVigenciaEl?.value || "").trim();
    const caducidad = (fechaCaducidadInput?.value || "").trim();
    const franjasRaw = franjasEl?.value || "";

    // campos obligatorios mínimos (mantiene la idea original)
    if (!num || !vigencia || !String(franjasRaw).trim()) {
      alert("Complete los campos obligatorios (Número, Vigencia y Franjas).");
      return;
    }

    const parsed = parseFranjas(franjasRaw);
    if (!parsed.ok) {
      alert(parsed.error || "Error en franjas");
      return;
    }

    const ordenes = StorageApp.cargarOrdenes();

    const nuevaOrden = {
      num,
      textoRef,
      vigencia,
      caducidad,
      franjas: parsed.franjas
    };

    if (ordenSeleccionadaIdx !== null && ordenSeleccionadaIdx !== undefined) {
      ordenes[ordenSeleccionadaIdx] = nuevaOrden;
    } else {
      ordenes.push(nuevaOrden);
    }

    StorageApp.guardarOrdenes(ordenes);

    marcarCambio();
    actualizarSelector();
    limpiarCampos();
  }

  // ======================================================
  // SELECT ORDEN EXISTENTE (TU CÓDIGO, SE RESPETA)
  // ======================================================
  if (selectOrdenExistente) {
    selectOrdenExistente.addEventListener("change", () => {
      const v = selectOrdenExistente.value;

      if (v === "") {
        limpiarCampos();
        return;
      }

      const idx = Number(v);
      if (isNaN(idx)) return;

      if (typeof StorageApp === "undefined" || !StorageApp.cargarOrdenes) {
        alert("Error: StorageApp no está disponible para cargar órdenes.");
        return;
      }

      const ordenes = StorageApp.cargarOrdenes();
      const o = ordenes[idx];
      if (!o) return;

      ordenSeleccionadaIdx = idx;

      if (numOrdenEl) numOrdenEl.value = o.num || "";
      if (textoRefEl) textoRefEl.value = o.textoRef || "";
      if (fechaVigenciaEl) fechaVigenciaEl.value = o.vigencia || "";
      if (fechaCaducidadInput) fechaCaducidadInput.value = o.caducidad || "";

      if (franjasEl) {
        franjasEl.value = (o.franjas || [])
          .map(f => `${f.horario} - ${f.lugar} - ${f.titulo}`)
          .join("\n");
      }
    });
  }

  // ======================================================
  // PUBLICAR ÓRDENES (TU CÓDIGO, SE RESPETA)
  // ======================================================
  async function publicarOrdenes() {
    window.publicarOrdenes = publicarOrdenes;

    if (!puedePublicar()) {
      alert("Primero cargue una orden");
      return;
    }

    if (typeof StorageApp === "undefined" || !StorageApp.cargarOrdenes) {
      alert("Error: StorageApp no está disponible para publicar.");
      return;
    }

    const ordenes = StorageApp.cargarOrdenes();

    await fetch(`${SUPABASE_URL}/rest/v1/ordenes_store?id=eq.1`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: "Bearer " + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ payload: ordenes })
    });

    ultimoPublicadoId = cambiosId;
    actualizarEstadoPublicar();
  }

  // ======================================================
  // DISPARADORES DE CAMBIO (RESTAURADO)
  // ======================================================
  // Cuando el usuario edita campos, el ADM original marcaba cambios.
  // Esto vuelve a habilitar "Publicar" cuando corresponde.
  const changeEls = [numOrdenEl, textoRefEl, franjasEl, fechaVigenciaEl, fechaCaducidadInput, chkFinalizar];
  changeEls.forEach(el => {
    if (!el) return;
    const ev = (el.type === "checkbox") ? "change" : "input";
    el.addEventListener(ev, () => marcarCambio());
  });

  // ======================================================
  // CONTROL DE SESIÓN (TU CÓDIGO, SE RESPETA)
  // + INTEGRACIÓN CON INIT RESTAURADO
  // ======================================================
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error || !session) {
    loginContainer.style.display = "block";
    admContainer.style.display = "none";
  } else {
    loginContainer.style.display = "none";
    admContainer.style.display = "block";
  }

  // ======================================================
  // LOGIN (TU CÓDIGO, SE RESPETA)
  // + AL LOGUEAR: EJECUTA INIT RESTAURADO
  // ======================================================
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      loginError.style.display = "none";

      const email = loginEmail.value.trim();
      const password = loginPassword.value.trim();

      if (!email || !password) {
        loginError.textContent = "Complete email y contraseña";
        loginError.style.display = "block";
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        loginError.textContent = "Credenciales inválidas";
        loginError.style.display = "block";
        return;
      }

      // Login OK
      loginContainer.style.display = "none";
      admContainer.style.display = "block";

      // INIT ADM (restaurado)
      initAdm();
    });
  }

  // ======================================================
  // OLVIDÉ MI CONTRASEÑA (TU CÓDIGO, SE RESPETA)
  // ======================================================
  if (btnForgot) {
    btnForgot.addEventListener("click", async () => {
      const email = loginEmail.value.trim();

      if (!email) {
        alert("Escribí tu email primero.");
        return;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: "https://kusne.github.io/operativos-wsp-adm/reset.html"
      });

      if (error) {
        alert("Error enviando mail de recuperación: " + error.message);
        return;
      }

      alert("Te enviamos un correo para restablecer la contraseña.");
    });
  }

  // ======================================================
  // INIT RESTAURADO (CORAZÓN DEL ADM ORIGINAL)
  // ======================================================
  function initAdm() {
    // 1) limpieza
    limpiarOrdenesCaducadas();

    // 2) selector
    actualizarSelector();

    // 3) reset contadores como el original
    cambiosId = 0;
    ultimoPublicadoId = 0;
    actualizarEstadoPublicar();
  }

  // Si ya había sesión al cargar la página, inicializamos el ADM de entrada
  if (!error && session) {
    initAdm();
  }

  // ======================================================
  // EXPOSICIÓN GLOBAL (COMPATIBILIDAD CON HTML ONCLICK)
  // ======================================================
  // Si tu HTML llama onclick="agregarOrden()" / onclick="publicarOrdenes()", esto lo mantiene funcionando.
  window.agregarOrden = agregarOrden;
  window.publicarOrdenes = publicarOrdenes;

  // (Opcional por compatibilidad, sin romper nada)
  window.actualizarSelector = actualizarSelector;
  window.limpiarCampos = limpiarCampos;

});
















