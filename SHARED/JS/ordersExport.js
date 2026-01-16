// shared/js/ordersExport.js
(function (global) {
  function buildExportPayload() {
    const ordenes = StorageApp.cargarOrdenes();
    const eliminaciones = Deletions.cargarEliminaciones();
    return [...ordenes, ...eliminaciones];
  }

  function exportToTextarea(textareaEl) {
    if (!textareaEl) return;
    const payload = buildExportPayload();
    textareaEl.value = JSON.stringify(payload, null, 2);
    Deletions.resetEliminaciones(); // reset luego de exportar
  }

  /**
   * Importa un array JSON con órdenes + __ELIMINAR__
   * - aplica __ELIMINAR__ sobre órdenes actuales
   * - upsert órdenes por num
   * - NO pisa eliminacionesPendientes locales (eso es de “salida”)
   */
  function importFromText(text) {
    let data;
    try { data = JSON.parse(String(text || "").trim()); }
    catch { return { ok: false, error: "Formato inválido" }; }

    if (!Array.isArray(data)) return { ok: false, error: "Formato inválido" };

    const actuales = StorageApp.cargarOrdenes();
    const merged = OrdersSync.mergeImportedOrders(actuales, data);
    StorageApp.guardarOrdenes(merged);
    return { ok: true, ordenes: merged };
  }

  global.OrdersExport = { buildExportPayload, exportToTextarea, importFromText };
})(window);
