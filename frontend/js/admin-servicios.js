(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "servicios") return;

  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#servicesTableBody");
  const feedback = document.querySelector("#servicesFeedback");
  const dialog = document.querySelector("#serviceDialog");
  const form = document.querySelector("#serviceForm");
  const title = document.querySelector("#serviceDialogTitle");
  let services = [];
  let editingId = null;

  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "Servicio no encontrado.",
    409: "No se puede completar la operación porque el servicio tiene citas relacionadas o existe un conflicto.",
    400: "Los datos ingresados no son válidos.",
    500: "Ocurrió un error del servidor. Inténtalo más tarde."
  }[status] || "No se pudo completar la operación.");

  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`http://localhost:8080/api/servicios${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers
        }
      });
    } catch {
      throw new Error("No se pudo conectar con el servidor. Verifica que el backend esté activo.");
    }
    if (response.status === 401) {
      window.VitaVetAuth.logout();
      throw new Error("Sesión expirada. Inicia sesión nuevamente.");
    }
    if (!response.ok) {
      let message = errorMessage(response.status);
      try {
        const payload = await response.json();
        const backendMessage = [payload.message, payload.detail, payload.error]
          .find((value) => typeof value === "string" && value.trim());
        if (backendMessage) message = backendMessage;
      } catch { /* Algunas respuestas de error no incluyen JSON. */ }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    return contentType.includes("application/json") ? response.json() : null;
  };

  const addCell = (row, value) => {
    const cell = document.createElement("td");
    cell.textContent = value == null || value === "" ? "No disponible" : String(value);
    row.append(cell);
  };

  const formatPrice = (price) => {
    const amount = Number(price);
    return Number.isFinite(amount) ? `S/ ${amount.toFixed(2)}` : "No disponible";
  };

  const renderServices = () => {
    if (!services.length) {
      tableBody.innerHTML = '<tr><td colspan="6" class="admin-table-message">No hay servicios registrados.</td></tr>';
      return;
    }
    const rows = services.map((service) => {
      const row = document.createElement("tr");
      [
        service.idServicio,
        service.nombre,
        service.descripcion,
        formatPrice(service.precio),
        Number.isFinite(Number(service.duracionMinutos)) ? `${service.duracionMinutos} min` : "No disponible"
      ].forEach((value) => addCell(row, value));
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editService(service.idServicio));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deleteService(service));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const loadServices = async () => {
    tableBody.innerHTML = '<tr><td colspan="6" class="admin-table-message">Cargando servicios...</td></tr>';
    try {
      const data = await request("");
      if (!Array.isArray(data)) throw new Error("La respuesta de servicios no es válida.");
      services = data;
      const counter = document.querySelector("#countServicios");
      if (counter) counter.textContent = String(services.length);
      renderServices();
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="6" class="admin-table-message">No se pudieron cargar los servicios.</td></tr>';
      showFeedback(error.message, true);
    }
  };

  const openForm = (service = null) => {
    editingId = service?.idServicio ?? null;
    form.reset();
    title.textContent = editingId ? "Editar servicio" : "Nuevo servicio";
    form.elements.nombre.value = service?.nombre || "";
    form.elements.descripcion.value = service?.descripcion || "";
    form.elements.precio.value = service?.precio ?? "";
    form.elements.duracionMinutos.value = service?.duracionMinutos ?? "";
    dialog.showModal();
  };

  const editService = async (id) => {
    try {
      const service = await request(`/${encodeURIComponent(id)}`);
      openForm(service);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  const deleteService = async (service) => {
    if (!window.confirm(`¿Deseas eliminar el servicio ${service.nombre}?`)) return;
    try {
      await request(`/${encodeURIComponent(service.idServicio)}`, { method: "DELETE" });
      showFeedback("Servicio eliminado correctamente.");
      await loadServices();
    } catch (error) {
      const relatedFailure = error.status === 409 || /foreign.?key|constraint|integrity|cita|relacionad/i.test(error.message);
      showFeedback(relatedFailure
        ? "No se puede eliminar este servicio porque tiene citas relacionadas."
        : error.message, true);
    }
  };

  document.querySelector("#newServiceButton").addEventListener("click", () => openForm());
  document.querySelector("#cancelServiceButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const price = form.elements.precio.valueAsNumber;
    const duration = form.elements.duracionMinutos.valueAsNumber;
    if (!Number.isFinite(price) || price < 0) {
      showFeedback("El precio debe ser un número igual o mayor que cero.", true);
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      showFeedback("La duración debe ser un número entero mayor que cero.", true);
      return;
    }
    const payload = {
      nombre: form.elements.nombre.value.trim(),
      descripcion: form.elements.descripcion.value.trim(),
      precio: price,
      duracionMinutos: duration
    };
    const isEditing = Boolean(editingId);
    try {
      await request(isEditing ? `/${encodeURIComponent(editingId)}` : "", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(isEditing ? "Servicio actualizado correctamente." : "Servicio registrado correctamente.");
      await loadServices();
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  loadServices();
})();
