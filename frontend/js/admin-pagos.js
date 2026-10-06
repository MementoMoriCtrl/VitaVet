(() => {
  if (new URLSearchParams(window.location.search).get("seccion") !== "pagos") return;

  const currentUser = window.VitaVetAuth?.getCurrentUser?.();
  if (!currentUser || currentUser.rol !== "ADMIN") return;
  const token = window.VitaVetAuth?.getToken?.();
  if (!token) return;

  const tableBody = document.querySelector("#paymentsTableBody");
  const feedback = document.querySelector("#paymentsFeedback");
  const dialog = document.querySelector("#paymentDialog");
  const form = document.querySelector("#paymentForm");
  const title = document.querySelector("#paymentDialogTitle");
  let payments = [];
  let appointments = [];
  let pets = [];
  let appointmentById = new Map();
  let petById = new Map();
  let editingId = null;

  const showFeedback = (message, isError = false) => {
    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.toggle("is-error", isError);
  };

  const errorMessage = (status) => ({
    403: "No tienes permisos para realizar esta acción.",
    404: "El pago o la cita seleccionada no existe.",
    409: "No se pudo completar la operación por un conflicto.",
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
      } catch { /* Algunas respuestas no incluyen JSON. */ }
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

  const formatAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? `S/ ${amount.toFixed(2)}` : "No disponible";
  };

  const methodsForModality = {
    online: ["tarjeta", "yape_plin"],
    presencial: ["efectivo"]
  };

  const methodLabels = {
    tarjeta: "Tarjeta",
    yape_plin: "Yape / Plin",
    efectivo: "Efectivo"
  };

  const updateMethodOptions = (currentMethod = null) => {
    const modality = form.elements.modalidad.value;
    const validMethods = methodsForModality[modality] || [];
    const options = validMethods.map((method) => new Option(methodLabels[method], method));
    form.elements.metodo.replaceChildren(...options);
    const selectedMethod = currentMethod === "yape" ? "yape_plin" : currentMethod;
    if (selectedMethod && validMethods.includes(selectedMethod)) {
      form.elements.metodo.value = selectedMethod;
    } else {
      form.elements.metodo.value = validMethods[0] || "";
    }
  };

  const setAppointmentOptions = (selectedId = null) => {
    const options = [new Option("Selecciona una cita", "")];
    appointments.forEach((appointment) => {
      const pet = petById.get(String(appointment.idMascota));
      const petName = pet?.nombre || "No disponible";
      const label = `Cita #${appointment.idCita} · ${petName}`;
      options.push(new Option(label, String(appointment.idCita)));
    });
    if (selectedId != null && !appointmentById.has(String(selectedId))) {
      options.push(new Option(`Cita #${selectedId} · No disponible`, String(selectedId)));
    }
    form.elements.idCita.replaceChildren(...options);
    form.elements.idCita.value = selectedId == null ? "" : String(selectedId);
  };

  const renderPayments = () => {
    if (!payments.length) {
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No hay pagos registrados.</td></tr>';
      return;
    }
    const rows = payments.map((payment) => {
      const row = document.createElement("tr");
      const appointment = appointmentById.get(String(payment.idCita));
      const pet = appointment ? petById.get(String(appointment.idMascota)) : null;
      [
        payment.idPago,
        appointment ? `Cita #${appointment.idCita}` : "No disponible",
        pet?.nombre || "No disponible",
        payment.modalidad,
        payment.metodo,
        formatAmount(payment.monto),
        payment.estado
      ].forEach((value) => addCell(row, value));
      const actions = document.createElement("td");
      actions.className = "admin-user-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "admin-user-action";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => editPayment(payment.idPago));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "admin-user-action is-danger";
      deleteButton.textContent = "Eliminar";
      deleteButton.addEventListener("click", () => deletePayment(payment));
      actions.append(editButton, deleteButton);
      row.append(actions);
      return row;
    });
    tableBody.replaceChildren(...rows);
  };

  const loadData = async () => {
    tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">Cargando pagos...</td></tr>';
    const [paymentsResult, appointmentsResult, petsResult] = await Promise.allSettled([
      request("pagos"),
      request("citas"),
      request("mascotas")
    ]);
    if (paymentsResult.status !== "fulfilled" || !Array.isArray(paymentsResult.value)) {
      const error = paymentsResult.status === "rejected"
        ? paymentsResult.reason
        : new Error("La respuesta de pagos no es válida.");
      tableBody.innerHTML = '<tr><td colspan="8" class="admin-table-message">No se pudieron cargar los pagos.</td></tr>';
      showFeedback(error.message, true);
      return;
    }
    payments = paymentsResult.value;
    appointments = appointmentsResult.status === "fulfilled" && Array.isArray(appointmentsResult.value)
      ? appointmentsResult.value : [];
    pets = petsResult.status === "fulfilled" && Array.isArray(petsResult.value) ? petsResult.value : [];
    appointmentById = new Map(appointments.map((appointment) => [String(appointment.idCita), appointment]));
    petById = new Map(pets.map((pet) => [String(pet.idMascota), pet]));
    const counter = document.querySelector("#countPagos");
    if (counter) counter.textContent = String(payments.length);
    setAppointmentOptions();
    renderPayments();
    if (appointmentsResult.status === "rejected" || petsResult.status === "rejected") {
      showFeedback("No se pudieron cargar todos los datos relacionados; algunas relaciones aparecen como No disponible.", true);
    }
  };

  const stateOptions = (currentState = null) => {
    const states = ["Pendiente", "Pagado", "Cancelado"];
    if (currentState && !states.includes(currentState)) states.push(currentState);
    const select = form.elements.estado;
    select.replaceChildren(...states.map((state) => new Option(state, state)));
    select.value = currentState && states.includes(currentState) ? currentState : "Pendiente";
  };

  const openForm = (payment = null) => {
    editingId = payment?.idPago ?? null;
    form.reset();
    title.textContent = editingId ? "Editar pago" : "Nuevo pago";
    setAppointmentOptions(payment?.idCita ?? null);
    form.elements.modalidad.value = payment?.modalidad || "online";
    updateMethodOptions(payment?.metodo || null);
    form.elements.monto.value = payment?.monto ?? "";
    stateOptions(payment?.estado ?? null);
    dialog.showModal();
  };

  const editPayment = async (id) => {
    try {
      const payment = await request(`pagos/${encodeURIComponent(id)}`);
      openForm(payment);
    } catch (error) {
      showFeedback(error.message, true);
    }
  };

  const deletePayment = async (payment) => {
    if (!window.confirm(`¿Deseas eliminar el pago de la cita #${payment.idCita}?`)) return;
    try {
      await request(`pagos/${encodeURIComponent(payment.idPago)}`, { method: "DELETE" });
      showFeedback("Pago eliminado correctamente.");
      await loadData();
    } catch (error) {
      if (error.status === 403) showFeedback("No tienes permisos para eliminar este pago.", true);
      else if (error.status === 404) showFeedback("El pago no existe.", true);
      else showFeedback(error.message, true);
    }
  };

  document.querySelector("#newPaymentButton").addEventListener("click", () => {
    if (!appointments.length) {
      showFeedback("No hay citas disponibles para asociar a un pago.", true);
      return;
    }
    openForm();
  });
  form.elements.modalidad.addEventListener("change", () => {
    updateMethodOptions(form.elements.metodo.value);
  });
  document.querySelector("#cancelPaymentButton").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = form.elements.monto.valueAsNumber;
    const appointmentId = Number(form.elements.idCita.value);
    const modality = form.elements.modalidad.value;
    const method = form.elements.metodo.value;
    if (!methodsForModality[modality]?.includes(method)) {
      showFeedback("El método de pago seleccionado no corresponde a la modalidad elegida.", true);
      return;
    }
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(appointmentId) || appointmentId <= 0) {
      showFeedback("Completa los campos obligatorios con valores válidos.", true);
      return;
    }
    const payload = {
      idCita: appointmentId,
      modalidad: modality,
      metodo: method,
      monto: amount,
      estado: form.elements.estado.value
    };
    const isEditing = Boolean(editingId);
    try {
      await request(isEditing ? `pagos/${encodeURIComponent(editingId)}` : "pagos", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      dialog.close();
      showFeedback(isEditing ? "Pago actualizado correctamente." : "Pago registrado correctamente.");
      await loadData();
    } catch (error) {
      showFeedback(error.message, true);
    }
  });

  loadData();
})();
