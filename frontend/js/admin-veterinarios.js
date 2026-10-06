(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "veterinarios") return;

  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#veterinariansTableBody");
  const feedback = document.querySelector("#veterinariansFeedback");
  const dialog = document.querySelector("#veterinarianDialog");
  const form = document.querySelector("#veterinarianForm");
  const title = document.querySelector("#veterinarianDialogTitle");
  let veterinarians = [];
  let editingId = null;

  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "Veterinario no encontrado.",
    409: "No se pudo completar la operación porque hay registros relacionados o en conflicto.",
    400: "Los datos ingresados no son válidos.",
    500: "Ocurrió un error del servidor. Inténtalo más tarde."
  }[status] || "No se pudo completar la operación.");

  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`http://localhost:8080/api/veterinarios${path}`, {
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

  const renderVeterinarians = () => {
    if (!veterinarians.length) {
      tableBody.innerHTML = '<tr><td colspan="7" class="admin-table-message">No hay veterinarios registrados.</td></tr>';
      return;
    }
    const rows = veterinarians.map((veterinarian) => {
      const row = document.createElement("tr");
      [
        veterinarian.idVeterinario,
        veterinarian.nombre,
        veterinarian.apellido,
        veterinarian.especialidad,
        veterinarian.correo,
        veterinarian.telefono
      ].forEach((value) => addCell(row, value));
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editVeterinarian(veterinarian.idVeterinario));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deleteVeterinarian(veterinarian));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const loadVeterinarians = async () => {
    tableBody.innerHTML = '<tr><td colspan="7" class="admin-table-message">Cargando veterinarios...</td></tr>';
    try {
      const data = await request("");
      if (!Array.isArray(data)) throw new Error("La respuesta de veterinarios no es válida.");
      veterinarians = data;
      const counter = document.querySelector("#countVeterinarios");
      if (counter) counter.textContent = String(veterinarians.length);
      renderVeterinarians();
    } catch (error) {
      tableBody.innerHTML = '<tr><td colspan="7" class="admin-table-message">No se pudieron cargar los veterinarios.</td></tr>';
      showFeedback(error.message, true);
    }
  };

  const openForm = (veterinarian = null) => {
    editingId = veterinarian?.idVeterinario ?? null;
    form.reset();
    title.textContent = editingId ? "Editar veterinario" : "Nuevo veterinario";
    form.elements.nombre.value = veterinarian?.nombre || "";
    form.elements.apellido.value = veterinarian?.apellido || "";
    form.elements.especialidad.value = veterinarian?.especialidad || "";
    form.elements.correo.value = veterinarian?.correo || "";
    form.elements.telefono.value = veterinarian?.telefono || "";
    dialog.showModal();
  };

  const editVeterinarian = async (id) => {
    try {
      const veterinarian = await request(`/${encodeURIComponent(id)}`);
      openForm(veterinarian);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  const deleteVeterinarian = async (veterinarian) => {
    const fullName = [veterinarian.nombre, veterinarian.apellido].filter(Boolean).join(" ");
    if (!window.confirm(`¿Deseas eliminar al veterinario ${fullName}?`)) return;
    try {
      await request(`/${encodeURIComponent(veterinarian.idVeterinario)}`, { method: "DELETE" });
      showFeedback("Veterinario eliminado correctamente.");
      await loadVeterinarians();
    } catch (error) {
      const relatedFailure = error.status === 409 || /foreign.?key|constraint|integrity|cita|relacionad/i.test(error.message);
      showFeedback(relatedFailure
        ? "No se puede eliminar este veterinario porque tiene citas relacionadas."
        : error.message, true);
    }
  };

  document.querySelector("#newVeterinarianButton").addEventListener("click", () => openForm());
  document.querySelector("#cancelVeterinarianButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      nombre: form.elements.nombre.value.trim(),
      apellido: form.elements.apellido.value.trim(),
      especialidad: form.elements.especialidad.value.trim(),
      correo: form.elements.correo.value.trim(),
      telefono: form.elements.telefono.value.trim()
    };
    const isEditing = Boolean(editingId);
    try {
      await request(isEditing ? `/${encodeURIComponent(editingId)}` : "", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(isEditing ? "Veterinario actualizado correctamente." : "Veterinario registrado correctamente.");
      await loadVeterinarians();
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  loadVeterinarians();
})();
