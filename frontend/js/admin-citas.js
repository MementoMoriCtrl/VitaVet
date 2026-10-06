(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "citas") return;

  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#appointmentsTableBody");
  const feedback = document.querySelector("#appointmentsFeedback");
  const dialog = document.querySelector("#appointmentDialog");
  const form = document.querySelector("#appointmentForm");
  const title = document.querySelector("#appointmentDialogTitle");
  const statusField = document.querySelector("#appointmentStatusField");
  const newStatusNote = document.querySelector("#newAppointmentStatus");
  let appointments = [];
  let pets = [];
  let veterinarians = [];
  let services = [];
  let editingId = null;

  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "Cita o registro relacionado no encontrado.",
    409: "No se pudo completar la operación por un conflicto o estado no permitido.",
    400: "Los datos ingresados no son válidos.",
    500: "Ocurrió un error del servidor. Inténtalo más tarde."
  }[status] || "No se pudo completar la operación.");

  const request = async (resource, options = {}) => {
    let response;
    try {
      response = await fetch(`http://localhost:8080/api/${resource}`, {
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
          .find((value) => typeof value === "string"
            && value.trim()
            && value.length <= 240
            && !/(?:\n\s*at\s|org\.springframework|java\.lang|Exception:)/i.test(value));
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

  const formatDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return "No disponible";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  };

  const formatTime = (value) => {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
    if (!match) return "No disponible";
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${String(hour % 12 || 12).padStart(2, "0")}:${minute} ${suffix}`;
  };

  const mapById = (collection, idKey) => new Map(collection.map((item) => [String(item[idKey]), item]));

  const renderAppointments = () => {
    if (!appointments.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No hay citas registradas.</td></tr>';
      return;
    }
    const petById = mapById(pets, "idMascota");
    const veterinarianById = mapById(veterinarians, "idVeterinario");
    const serviceById = mapById(services, "idServicio");
    const rows = appointments.map((appointment) => {
      const row = document.createElement("tr");
      const pet = petById.get(String(appointment.idMascota));
      const veterinarian = veterinarianById.get(String(appointment.idVeterinario));
      const service = serviceById.get(String(appointment.idServicio));
      const veterinarianName = veterinarian
        ? [veterinarian.nombre, veterinarian.apellido].filter((part) => typeof part === "string" && part.trim()).join(" ")
        : "";
      [
        appointment.idCita,
        pet?.nombre || "No disponible",
        veterinarianName || "No disponible",
        service?.nombre || "No disponible",
        formatDate(appointment.fecha),
        formatTime(appointment.hora),
        appointment.estado || "No disponible"
      ].forEach((value) => addCell(row, value));
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editAppointment(appointment.idCita));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deleteAppointment(appointment));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const setOptions = (select, items, idKey, labelFor, placeholder) => {
    const options = [new Option(placeholder, "")];
    items.forEach((item) => options.push(new Option(labelFor(item), String(item[idKey]))));
    select.replaceChildren(...options);
  };

  const loadData = async () => {
    tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">Cargando citas...</td></tr>';
    const results = await Promise.allSettled([
      request("citas"),
      request("mascotas"),
      request("veterinarios"),
      request("servicios")
    ]);
    const [appointmentsResult, petsResult, veterinariansResult, servicesResult] = results;
    if (appointmentsResult.status !== "fulfilled" || !Array.isArray(appointmentsResult.value)) {
      const error = appointmentsResult.status === "rejected"
        ? appointmentsResult.reason
        : new Error("La respuesta de citas no es válida.");
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No se pudieron cargar las citas.</td></tr>';
      showFeedback(error.message, true);
      return;
    }
    appointments = appointmentsResult.value;
    pets = petsResult.status === "fulfilled" && Array.isArray(petsResult.value) ? petsResult.value : [];
    veterinarians = veterinariansResult.status === "fulfilled" && Array.isArray(veterinariansResult.value)
      ? veterinariansResult.value : [];
    services = servicesResult.status === "fulfilled" && Array.isArray(servicesResult.value) ? servicesResult.value : [];
    const counter = document.querySelector("#countCitas");
    if (counter) counter.textContent = String(appointments.length);
    setOptions(form.elements.idMascota, pets, "idMascota", (pet) => pet.nombre || "No disponible", "Selecciona una mascota");
    setOptions(form.elements.idVeterinario, veterinarians, "idVeterinario", (vet) => {
      const name = [vet.nombre, vet.apellido].filter((part) => typeof part === "string" && part.trim()).join(" ");
      return name || "No disponible";
    }, "Selecciona un veterinario");
    setOptions(form.elements.idServicio, services, "idServicio", (service) => service.nombre || "No disponible", "Selecciona un servicio");
    renderAppointments();
    const catalogErrors = [petsResult, veterinariansResult, servicesResult]
      .filter((result) => result.status === "rejected");
    if (catalogErrors.length) showFeedback("No se pudieron cargar todos los catálogos; algunas relaciones pueden mostrarse como No disponible.", true);
  };

  const statusOptions = (currentStatus = null) => {
    const knownStates = ["Programada", "Completada", "Cancelada"];
    form.elements.estado.replaceChildren(...knownStates.map((state) => new Option(state, state)));
    if (currentStatus && knownStates.includes(currentStatus)) form.elements.estado.value = currentStatus;
  };

  const openForm = (appointment = null) => {
    editingId = appointment?.idCita ?? null;
    form.reset();
    title.textContent = editingId ? "Editar cita" : "Nueva cita";
    form.elements.idMascota.value = appointment?.idMascota == null ? "" : String(appointment.idMascota);
    form.elements.idVeterinario.value = appointment?.idVeterinario == null ? "" : String(appointment.idVeterinario);
    form.elements.idServicio.value = appointment?.idServicio == null ? "" : String(appointment.idServicio);
    form.elements.fecha.value = appointment?.fecha || "";
    form.elements.hora.value = appointment?.hora ? String(appointment.hora).slice(0, 5) : "";
    statusOptions(appointment?.estado || null);
    if (editingId) {
      if (appointment.estado && ["Programada", "Completada", "Cancelada"].includes(appointment.estado)) {
        form.elements.estado.value = appointment.estado;
      } else {
        form.elements.estado.value = "";
      }
      statusField.hidden = false;
      newStatusNote.hidden = true;
    } else {
      statusField.hidden = true;
      newStatusNote.hidden = false;
    }
    dialog.showModal();
  };

  const editAppointment = async (id) => {
    try {
      const appointment = await request(`citas/${encodeURIComponent(id)}`);
      openForm(appointment);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  const deleteAppointment = async (appointment) => {
    if (!window.confirm(`¿Deseas eliminar la cita #${appointment.idCita}?`)) return;
    try {
      await request(`citas/${encodeURIComponent(appointment.idCita)}`, { method: "DELETE" });
      showFeedback("Cita eliminada correctamente.");
      await loadData();
    } catch (error) {
      if (error.status === 403) {
        showFeedback("No tienes permisos para eliminar esta cita.", true);
      } else if (error.status === 409) {
        showFeedback("No se puede eliminar esta cita porque tiene información relacionada.", true);
      } else {
        showFeedback(error.message, true);
      }
    }
  };

  document.querySelector("#newAppointmentButton").addEventListener("click", () => {
    if (!pets.length || !veterinarians.length || !services.length) {
      showFeedback("No se pudieron cargar los catálogos necesarios para registrar una cita.", true);
      return;
    }
    openForm();
  });
  document.querySelector("#cancelAppointmentButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const time = form.elements.hora.value;
    const payload = {
      idMascota: Number(form.elements.idMascota.value),
      idVeterinario: Number(form.elements.idVeterinario.value),
      idServicio: Number(form.elements.idServicio.value),
      fecha: form.elements.fecha.value,
      hora: time.length === 5 ? `${time}:00` : time
    };
    const isEditing = Boolean(editingId);
    if (isEditing) payload.estado = form.elements.estado.value;
    try {
      await request(isEditing ? `citas/${encodeURIComponent(editingId)}` : "citas", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(isEditing ? "Cita actualizada correctamente." : "Cita registrada correctamente.");
      await loadData();
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  loadData();
})();
