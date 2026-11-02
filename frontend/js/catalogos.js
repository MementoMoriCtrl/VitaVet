/* Catálogos compartidos por los desplegables de tipo de mascota y sexo. */
(() => {
  const cargar = async (select, recurso, actual = "") => {
    select.disabled = true;
    select.replaceChildren(new Option("Cargando opciones…", ""));
    try {
      const token = window.VitaVetAuth.getToken();
      if (!token) throw new Error("La sesión no es válida.");
      const response = await fetch(`http://localhost:8080/api/catalogos/${recurso}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.status === 401) window.VitaVetAuth.logout();
      if (!response.ok) throw new Error("No se pudo consultar el catálogo.");
      const opciones = await response.json();
      if (!Array.isArray(opciones) || !opciones.length
          || opciones.some((opcion) => !Number.isInteger(opcion.id)
            || typeof opcion.etiqueta !== "string" || !opcion.etiqueta.trim())) {
        throw new Error("El catálogo está vacío o su respuesta no es válida.");
      }
      const inicial = new Option("Selecciona una opción", "");
      inicial.disabled = true;
      select.replaceChildren(inicial, ...opciones.map((opcion) => {
        const option = new Option(opcion.etiqueta, opcion.etiqueta);
        option.dataset.id = String(opcion.id);
        return option;
      }));
      if (actual) {
        // MySQL usa una collation sin distinción de mayúsculas/tildes.
        const elegida = opciones.find((opcion) => opcion.etiqueta === actual)
          || opciones.find((opcion) => opcion.etiqueta.localeCompare(actual, "es", { sensitivity: "base" }) === 0);
        if (!elegida) throw new Error("El valor anterior no figura en el catálogo. Revisa la migración antes de editar.");
        select.value = elegida.etiqueta;
      } else select.value = "";
      select.disabled = false;
    } catch (error) {
      select.replaceChildren(new Option("No se pudieron cargar las opciones", ""));
      throw new Error(`No se pudieron cargar las opciones. Comprueba la conexión y la instalación de los catálogos. ${error.message}`);
    }
  };
  window.VitaVetCatalogos = { cargar };
})();
