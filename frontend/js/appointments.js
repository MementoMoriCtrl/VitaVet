/* Carga las citas de la API y conserva vitaVetAppointments para compatibilidad. */
(() => {
  const API = "http://localhost:8080/api";
  const appointmentsKey = "vitaVetAppointments";
  const selectedAppointmentKey = "vitaVetSelectedAppointment";
  const token = sessionStorage.getItem("vitaVetToken");
  const currentUser = window.VitaVetAuth?.getCurrentUser?.();
  let detailAppointment = null;
  let detailPayment = null;

  const readAppointments = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(appointmentsKey));
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  };

  const registerBooking = (booking) => {
    const id = Number(booking?.createdAppointment?.idCita);
    if (!Number.isInteger(id) || id <= 0) return;
    const saved = readAppointments();
    if (saved.some((item) => Number(item.idCita) === id)) return;
    saved.push({
      id: String(id), idCita: id, idMascota: Number(booking.idMascota),
      pet: booking.petName, petName: booking.petName, petImage: booking.petImage,
      petDescription: booking.petDescription, idServicio: Number(booking.idServicio),
      service: booking.service, idVeterinario: Number(booking.idVeterinario),
      veterinarian: booking.veterinarian, date: booking.date, time: booking.time,
      price: booking.price, paymentMethod: booking.paymentMethod || "",
      paymentType: booking.paymentType || "", status: booking.createdAppointment.estado || "Programada"
    });
    sessionStorage.setItem(appointmentsKey, JSON.stringify(saved));
  };

  const authHeaders = () => ({ Authorization: `Bearer ${token}` });
  const fetchJson = async (path) => {
    const response = await fetch(`${API}${path}`, { headers: authHeaders() });
    const responseText = await response.text();
    if (!response.ok) {
      let message = "";
      try {
        const body = JSON.parse(responseText);
        message = typeof body === "string" ? body : body.message || body.detail || body.error || "";
      } catch {
        if (responseText.trim() && !responseText.trim().startsWith("<")) message = responseText.trim();
      }
      const error = new Error(message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return responseText.trim() ? JSON.parse(responseText) : null;
  };

  const dateLabel = (value) => {
    if (!value) return "No disponible";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) return String(value);
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric" }).format(date);
  };

  const timeLabel = (value) => {
    if (!value) return "No disponible";
    const match = /^(\d{2}):(\d{2})/.exec(String(value));
    if (!match) return String(value);
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      .format(new Date(2000, 0, 1, Number(match[1]), Number(match[2])));
  };

  const petDescription = (pet) => [pet?.tipo, pet?.raza, pet?.edad != null ? `${pet.edad} años` : ""]
    .filter((part) => typeof part === "string" && part.trim()).join(" · ") || "Mascota";
  const petImage = (pet) => {
    const name = String(pet?.nombre || "").toLocaleLowerCase("es");
    if (name === "oliver") return "milo.jpg";
    if (name === "snow") return "nala.jpg";
    return "milo.jpg";
  };
  const nameById = (catalog, id, key) => catalog.find((item) => Number(item[key]) === Number(id));
  const formatPrice = (price) => {
    const amount = Number(price);
    return price === null || price === undefined || price === "" || !Number.isFinite(amount)
      ? "No disponible"
      : `S/ ${amount.toFixed(2)}`;
  };

  const showMessage = (element, message, link) => {
    if (!element) return;
    element.hidden = false;
    const body = element.querySelector(".card-body") || element;
    body.replaceChildren(document.createTextNode(message));
    if (link) {
      body.append(document.createTextNode(" "));
      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.text;
      body.append(anchor);
    }
  };

  const renderAppointments = (appointments, pets, services, vets) => {
    const grid = document.querySelector(".appointments-grid");
    const emptyState = document.querySelector("#appointmentsEmptyState");
    const errorState = document.querySelector("#appointmentsErrorState");
    if (!grid) return;
    const template = grid.querySelector(".appointment-list-card");
    grid.replaceChildren();
    if (errorState) errorState.hidden = true;
    if (!appointments.length) {
      if (emptyState) emptyState.hidden = false;
      const emptyMessage = document.querySelector("#appointmentsEmptyMessage");
      if (emptyMessage) emptyMessage.textContent = currentUser?.rol === "ADMIN" ? "No hay citas registradas." : "No tienes citas registradas.";
      return;
    }
    if (emptyState) emptyState.hidden = true;

    appointments.forEach((appointment) => {
      const pet = nameById(pets, appointment.idMascota, "idMascota");
      const service = nameById(services, appointment.idServicio, "idServicio");
      const vet = nameById(vets, appointment.idVeterinario, "idVeterinario");
      const card = template.cloneNode(true);
      const image = card.querySelector(".appointment-list-pet-image");
      const petName = pet?.nombre || "No disponible";
      const description = pet ? petDescription(pet) : "No disponible";
      image.hidden = !pet;
      image.src = `../assets/images/mascotas/${petImage(pet)}`;
      image.alt = pet ? `${petName}, ${description}` : "Mascota no disponible";
      card.querySelector(".appointment-list-pet-name").textContent = petName;
      card.querySelector(".appointment-list-pet-details").textContent = description;
      const vetName = vet ? [
        [vet.nombre, vet.apellido].filter(Boolean).join(" "),
        vet.especialidad
      ].filter(Boolean).join(" · ") : "";
      const values = card.querySelectorAll(".appointment-list-detail-value");
      [service?.nombre || "No disponible", vetName || "No disponible", dateLabel(appointment.fecha), timeLabel(appointment.hora), formatPrice(service?.precio)]
        .forEach((value, index) => { if (values[index]) values[index].textContent = value; });
      const badge = card.querySelector(".confirmed, .scheduled");
      if (badge) {
        badge.textContent = appointment.estado || "No disponible";
        badge.className = ["Programada", "Confirmada"].includes(appointment.estado) ? "scheduled" : "confirmed";
      }
      const detailsLink = card.querySelector('a[href="detalle-cita.html"]');
      if (detailsLink) detailsLink.href = `detalle-cita.html?id=${encodeURIComponent(appointment.idCita)}`;
      card.hidden = false;
      grid.append(card);
    });
  };

  const showRequestError = (error) => {
    const emptyState = document.querySelector("#appointmentsEmptyState");
    const errorState = document.querySelector("#appointmentsErrorState");
    const messages = {
      401: ["Tu sesión no es válida. ", { href: "login.html", text: "Iniciar sesión" }],
      403: ["No tienes permisos para consultar estas citas."],
      500: ["Ocurrió un error en el servidor. Inténtalo más tarde."]
    };
    const [message, link] = messages[error.status] || ["No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente."];
    if (emptyState) emptyState.hidden = true;
    showMessage(errorState, message, link);
  };

  // El dashboard conserva la compatibilidad con el registro local de la cita recién creada.
  const renderDashboardAppointment = () => {
    const card = document.querySelector(".appointment-card");
    if (!card) return;
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const upcoming = readAppointments().map((appointment) => {
      const dateMatch = /^(\d{1,2}) ([a-záéíóú]+) (\d{4})$/i.exec(appointment.date || "");
      const timeMatch = /^(\d{1,2}):(\d{2}) (AM|PM)$/i.exec(appointment.time || "");
      if (!dateMatch || !timeMatch || !appointment.service || !appointment.veterinarian) return null;
      const month = monthNames.indexOf(dateMatch[2].toLocaleLowerCase("es"));
      let hour = Number(timeMatch[1]);
      if (timeMatch[3].toUpperCase() === "PM" && hour < 12) hour += 12;
      if (timeMatch[3].toUpperCase() === "AM" && hour === 12) hour = 0;
      const date = new Date(Number(dateMatch[3]), month, Number(dateMatch[1]), hour, Number(timeMatch[2]));
      if (month < 0 || date <= new Date() || !["programada", "confirmada"].includes(String(appointment.status || "").toLocaleLowerCase("es"))) return null;
      return { appointment, date };
    }).filter(Boolean).sort((a, b) => a.date - b.date)[0]?.appointment;
    const topLine = card.querySelector(".appointment-topline");
    const meta = card.querySelector(".appointment-meta");
    const message = card.querySelector(".appointment-actions .appointment-detail-value");
    const detailsLink = card.querySelector('a[href="detalle-cita.html"]');
    if (!upcoming) {
      if (topLine) topLine.style.display = "none";
      if (meta) meta.style.display = "none";
      if (message) message.textContent = "No tienes próximas citas.";
      if (detailsLink) detailsLink.style.display = "none";
      card.hidden = false;
      card.style.display = "";
      return;
    }
    if (topLine) topLine.style.display = "";
    if (meta) meta.style.display = "";
    const patient = card.querySelector(".appointment-patient-name");
    const patientType = card.querySelector(".appointment-patient-type");
    const image = card.querySelector(".pet-avatar-image");
    if (patient) patient.textContent = upcoming.petName || upcoming.pet || "No disponible";
    if (patientType) patientType.textContent = upcoming.petDescription || "Mascota";
    if (image) {
      image.src = `../assets/images/mascotas/${upcoming.petImage || "milo.jpg"}`;
      image.alt = patient?.textContent || "Mascota";
    }
    const badge = card.querySelector(".appointment-topline .confirmed");
    if (badge) badge.textContent = upcoming.status || "Programada";
    const values = { Servicio: upcoming.service, Veterinario: upcoming.veterinarian, Fecha: upcoming.date, Hora: upcoming.time };
    card.querySelectorAll(".appointment-detail").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value");
      if (value && values[label]) value.textContent = values[label];
    });
    if (message) message.textContent = `Tu próxima visita está lista. Precio: ${upcoming.price || "No disponible"}.`;
    if (detailsLink) detailsLink.href = `detalle-cita.html?id=${encodeURIComponent(upcoming.idCita || upcoming.id || "")}`;
    card.hidden = false;
    card.style.display = "";
  };

  const normalizeLabel = (value) => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

  const detailInfoRow = (label) => {
    const info = document.querySelector("#appointmentDetailLayout .appointment-detail-info");
    if (!info) return null;
    const existing = Array.from(info.querySelectorAll(":scope > div"))
      .find((row) => normalizeLabel(row.querySelector(".appointment-detail-label")?.textContent) === normalizeLabel(label));
    if (existing) return existing;
    const row = document.createElement("div");
    const labelElement = document.createElement("span");
    labelElement.className = "appointment-detail-label";
    labelElement.textContent = label;
    const value = document.createElement("span");
    value.className = "appointment-detail-value";
    row.append(labelElement, value);
    info.append(row);
    return row;
  };

  const setInfoRow = (label, valueText, control = null) => {
    const row = detailInfoRow(label);
    if (!row) return;
    row.hidden = false;
    row.style.display = "";
    const value = row.querySelector(".appointment-detail-value");
    if (!value) return;
    value.replaceChildren(control || document.createTextNode(valueText));
  };

  const setPaymentMessage = (message, isError = false) => {
    const info = document.querySelector("#appointmentDetailLayout .appointment-detail-info");
    if (!info) return;
    let element = document.querySelector("#appointmentPaymentMessage");
    if (!element) {
      element = document.createElement("p");
      element.id = "appointmentPaymentMessage";
      element.className = "appointment-note";
      element.setAttribute("role", "status");
      info.insertAdjacentElement("afterend", element);
    }
    element.hidden = !message;
    element.textContent = message || "";
    element.setAttribute("aria-live", isError ? "assertive" : "polite");
  };

  const paymentModalityLabel = (value) => ({
    online: "Pagar ahora",
    presencial: "Pagar en la clínica"
  }[String(value || "").toLocaleLowerCase("es")] || (value ? String(value) : "No disponible"));

  const paymentMethodLabel = (value) => ({
    tarjeta: "Tarjeta",
    yape: "Yape / Plin",
    efectivo: "Efectivo"
  }[String(value || "").toLocaleLowerCase("es")] || (value ? String(value) : "No disponible"));

  const renderPaymentDetails = (payment, loadError = null) => {
    const layout = document.querySelector("#appointmentDetailLayout");
    const actions = layout?.querySelector(".appointment-detail-actions");
    if (!layout || !actions) return;
    document.querySelector("#savePaymentChangesButton")?.remove();
    const paymentMessage = document.querySelector("#appointmentPaymentMessage");
    if (paymentMessage) paymentMessage.hidden = true;

    if (loadError) {
      const errors = {
        401: "Tu sesión o token ya no es válido para consultar el pago.",
        403: "No tienes permiso para consultar el pago.",
        404: "No se encontró el pago de esta cita.",
        409: loadError.message || "No se pudo consultar el pago por el estado actual.",
        500: "Ocurrió un error del servidor al consultar el pago."
      };
      const fallback = loadError instanceof TypeError
        ? "No se pudo conectar con el servidor para consultar el pago."
        : "No se pudieron cargar los datos del pago.";
      setInfoRow("Estado del pago", errors[loadError.status] || fallback);
      setInfoRow("ID de pago", "No disponible");
      setPaymentMessage(errors[loadError.status] || fallback, true);
      detailPayment = null;
      return;
    }

    if (!payment) {
      setInfoRow("Estado del pago", "Pago no registrado");
      setInfoRow("Modalidad de pago", "No disponible");
      setInfoRow("Método de pago", "No disponible");
      setInfoRow("ID de pago", "No disponible");
      detailPayment = null;
      return;
    }

    detailPayment = payment;
    setInfoRow("Estado del pago", payment.estado || "No disponible");
    setInfoRow("Modalidad de pago", paymentModalityLabel(payment.modalidad));
    setInfoRow("Método de pago", paymentMethodLabel(payment.metodo));
    setInfoRow("ID de pago", String(payment.idPago ?? "No disponible"));
    const priceRow = Array.from(layout.querySelectorAll(".appointment-detail-info > div"))
      .find((row) => normalizeLabel(row.querySelector(".appointment-detail-label")?.textContent) === "precio");
    const priceValue = priceRow?.querySelector(".appointment-detail-value");
    if (priceValue) priceValue.textContent = formatPrice(payment.monto);

    if (currentUser?.rol !== "CLIENTE") return;
    const makeSelect = (label, entries, selected) => {
      const select = document.createElement("select");
      select.className = "form-control";
      select.setAttribute("aria-label", label);
      entries.forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.append(option);
      });
      if (selected && !entries.some(([value]) => value === selected)) {
        const option = document.createElement("option");
        option.value = selected;
        option.textContent = selected;
        select.append(option);
      }
      select.value = selected || "";
      return select;
    };
    const modalitySelect = makeSelect("Modalidad de pago", [
      ["online", "Pagar ahora"], ["presencial", "Pagar en la clínica"]
    ], String(payment.modalidad || ""));
    const methodSelect = makeSelect("Método de pago", [
      ["tarjeta", "Tarjeta"], ["yape", "Yape / Plin"], ["efectivo", "Efectivo"]
    ], String(payment.metodo || ""));
    setInfoRow("Modalidad de pago", "", modalitySelect);
    setInfoRow("Método de pago", "", methodSelect);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.id = "savePaymentChangesButton";
    saveButton.className = "btn btn-secondary";
    saveButton.textContent = "Guardar cambios del pago";
    saveButton.addEventListener("click", () => savePaymentChanges(payment, modalitySelect, methodSelect, saveButton));
    actions.append(saveButton);
  };

  const savePaymentChanges = async (payment, modalitySelect, methodSelect, button) => {
    if (!token || !payment || button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Guardando...";
    setPaymentMessage("Guardando modalidad y método...");
    const payload = {
      idCita: payment.idCita,
      modalidad: modalitySelect.value,
      metodo: methodSelect.value,
      monto: payment.monto,
      estado: payment.estado
    };
    try {
      const response = await fetch(`${API}/pagos/${encodeURIComponent(payment.idPago)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const responseText = await response.text();
      let updatedPayment = null;
      if (responseText.trim()) {
        try { updatedPayment = JSON.parse(responseText); } catch { updatedPayment = null; }
      }
      if (!response.ok) {
        let backendMessage = "";
        try {
          const errorBody = JSON.parse(responseText);
          backendMessage = typeof errorBody === "string"
            ? errorBody
            : errorBody.message || errorBody.detail || errorBody.error || "";
        } catch {
          const plainMessage = responseText.trim();
          if (plainMessage && !plainMessage.startsWith("<")) backendMessage = plainMessage;
        }
        const error = new Error(backendMessage || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      if (!updatedPayment || updatedPayment.idPago === undefined) {
        updatedPayment = await fetchJson(`/pagos/${encodeURIComponent(payment.idPago)}`);
      }
      const sameAmount = updatedPayment.monto === payment.monto
        || (updatedPayment.monto !== null && updatedPayment.monto !== undefined
          && payment.monto !== null && payment.monto !== undefined
          && Number(updatedPayment.monto) === Number(payment.monto));
      const immutableFieldsMatch = Number(updatedPayment.idPago) === Number(payment.idPago)
        && Number(updatedPayment.idCita) === Number(payment.idCita)
        && sameAmount
        && updatedPayment.estado === payment.estado;
      if (!immutableFieldsMatch) throw new Error("El servidor devolvió datos de pago distintos a los originales.");
      detailPayment = updatedPayment;
      renderPaymentDetails(updatedPayment);
      setPaymentMessage("Modalidad y método de pago actualizados correctamente.");
    } catch (error) {
      const messages = {
        401: "Tu sesión o token ya no es válido. Inicia sesión nuevamente.",
        403: "No tienes permiso para actualizar el pago.",
        404: "No se encontró el pago solicitado.",
        409: error.message && !error.message.startsWith("HTTP ") ? error.message : "La actualización entra en conflicto con el estado actual.",
        500: "Ocurrió un error en el servidor al actualizar el pago."
      };
      const message = messages[error.status] || (error instanceof TypeError
        ? "No se pudo conectar con el servidor. Inténtalo nuevamente."
        : error.message || "No se pudo actualizar el pago.");
      setPaymentMessage(message, true);
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  const loadAppointments = async () => {
    const grid = document.querySelector(".appointments-grid");
    if (!grid) return;
    if (!token) {
      showRequestError({ status: 401 });
      return;
    }
    try {
      const appointments = await fetchJson("/citas");
      if (!Array.isArray(appointments)) throw new Error("Respuesta no válida");
      const [pets, services, vets] = await Promise.all(["mascotas", "servicios", "veterinarios"].map(async (endpoint) => {
        try {
          const result = await fetchJson(`/${endpoint}`);
          return Array.isArray(result) ? result : [];
        } catch {
          return [];
        }
      }));
      renderAppointments(appointments, pets, services, vets);
    } catch (error) {
      showRequestError(error);
    }
  };

  const updateCachedAppointmentStatus = (id, status) => {
    const saved = readAppointments();
    let changed = false;
    saved.forEach((appointment) => {
      if (Number(appointment.idCita) === Number(id)) {
        appointment.status = status;
        changed = true;
      }
    });
    if (changed) sessionStorage.setItem(appointmentsKey, JSON.stringify(saved));
  };

  const cancelAppointment = async () => {
    if (!detailAppointment || !token) return;
    if (!window.confirm("¿Estás seguro de que deseas cancelar esta cita?")) return;

    const button = document.querySelector(".appointment-cancel");
    const statusText = document.querySelector(".appointment-status-text");
    if (!button || button.disabled) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "Cancelando...";
    if (statusText) statusText.textContent = "Procesando la cancelación...";

    const isAdmin = currentUser?.rol === "ADMIN";
    const payload = isAdmin
      ? {
        idMascota: detailAppointment.idMascota,
        idVeterinario: detailAppointment.idVeterinario,
        idServicio: detailAppointment.idServicio,
        fecha: detailAppointment.fecha,
        hora: detailAppointment.hora,
        estado: "Cancelada"
      }
      : { idMascota: detailAppointment.idMascota, estado: "Cancelada" };

    try {
      const response = await fetch(`${API}/citas/${encodeURIComponent(detailAppointment.idCita)}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const responseText = await response.text();
      let updatedAppointment;
      if (responseText.trim()) {
        try { updatedAppointment = JSON.parse(responseText); } catch { updatedAppointment = null; }
      }
      if (!updatedAppointment || updatedAppointment.estado !== "Cancelada") {
        updatedAppointment = await fetchJson(`/citas/${encodeURIComponent(detailAppointment.idCita)}`);
      }
      if (updatedAppointment.estado !== "Cancelada") {
        throw new Error("El servidor no confirmó la cancelación.");
      }

      updateCachedAppointmentStatus(updatedAppointment.idCita, updatedAppointment.estado);
      await renderAppointmentDetail(updatedAppointment);
      if (statusText) statusText.textContent = "La cita fue cancelada correctamente.";
    } catch (error) {
      const messages = {
        400: "La cita no puede cancelarse en su estado actual.",
        401: "Tu sesión no es válida. Inicia sesión nuevamente.",
        403: "No tienes permiso para cancelar esta cita.",
        404: "No se encontró la cita o no pertenece a tu cuenta.",
        409: "La cita no puede cancelarse en su estado actual.",
        500: "Ocurrió un error en el servidor. Inténtalo más tarde."
      };
      if (statusText) statusText.textContent = messages[error.status] || "No se pudo conectar con el servidor. Inténtalo nuevamente.";
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  const renderAppointmentDetail = async (appointmentFromServer = null, paymentFromServer = undefined) => {
    const layout = document.querySelector("#appointmentDetailLayout");
    if (!layout) return;
    const emptyState = document.querySelector("#appointmentDetailEmptyState");
    const errorState = document.querySelector("#appointmentDetailErrorState");
    const id = new URLSearchParams(window.location.search).get("id")
      || sessionStorage.getItem(selectedAppointmentKey);
    if (!id || !token) {
      layout.hidden = true;
      showMessage(errorState || emptyState, !token ? "Tu sesión no es válida." : "No se seleccionó una cita.", !token ? { href: "login.html", text: "Iniciar sesión" } : null);
      return;
    }
    try {
      const [appointment, pets, services, vets] = await Promise.all([
        appointmentFromServer || fetchJson(`/citas/${encodeURIComponent(id)}`),
        ...["mascotas", "servicios", "veterinarios"].map(async (endpoint) => {
          try {
            const result = await fetchJson(`/${endpoint}`);
            return Array.isArray(result) ? result : [];
          } catch {
            return [];
          }
        })
      ]);
      detailAppointment = appointment;
      if (errorState) errorState.hidden = true;
      if (emptyState) emptyState.hidden = true;
      layout.hidden = false;
      const pet = nameById(pets, appointment.idMascota, "idMascota");
      const service = nameById(services, appointment.idServicio, "idServicio");
      const vet = nameById(vets, appointment.idVeterinario, "idVeterinario");
      const petName = pet?.nombre || "No disponible";
      const description = pet ? petDescription(pet) : "No disponible";
      const image = layout.querySelector(".appointment-detail-pet-image");
      image.hidden = !pet;
      image.src = `../assets/images/mascotas/${petImage(pet)}`;
      image.alt = pet ? `${petName}, ${description}` : "Mascota no disponible";
      layout.querySelector(".appointment-detail-pet-name").textContent = petName;
      layout.querySelector(".appointment-detail-pet-description").textContent = description;
      const values = {
        Servicio: service?.nombre || "No disponible",
        Veterinario: vet ? [vet.nombre, vet.apellido].filter(Boolean).join(" ") || "No disponible" : "No disponible",
        Especialidad: vet?.especialidad || "No disponible",
        Fecha: dateLabel(appointment.fecha), Hora: timeLabel(appointment.hora), Precio: formatPrice(service?.precio)
      };
      layout.querySelectorAll(".appointment-detail-info > div").forEach((row) => {
        const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
        const value = row.querySelector(".appointment-detail-value");
        if (label === "Modalidad de pago" || label === "Método de pago") { row.hidden = true; return; }
        if (value && values[label]) value.textContent = values[label];
      });
      const about = layout.querySelector(".appointment-about-text");
      if (about) about.textContent = `${values.Servicio} para ${petName}.`;
      const status = appointment.estado || "No disponible";
      const badge = layout.querySelector(".appointment-detail-header .confirmed, .appointment-detail-header .scheduled");
      if (badge) { badge.textContent = status; badge.className = ["Programada", "Confirmada"].includes(status) ? "scheduled" : "confirmed"; }
      const statusText = layout.querySelector(".appointment-status-text");
      if (statusText) statusText.textContent = `Estado de la cita: ${status}.`;
      const cancelButton = layout.querySelector(".appointment-cancel");
      if (cancelButton) {
        cancelButton.onclick = cancelAppointment;
        const canCancel = status === "Programada";
        cancelButton.hidden = !canCancel;
        cancelButton.style.display = canCancel ? "" : "none";
        cancelButton.disabled = false;
        cancelButton.textContent = "Cancelar cita";
      }
      const summary = { Mascota: petName, Servicio: values.Servicio, Fecha: values.Fecha, Hora: values.Hora };
      layout.querySelectorAll(".appointment-summary-row").forEach((row) => {
        const label = row.querySelector(".appointment-summary-label")?.textContent.trim();
        const value = row.querySelector(".appointment-summary-value");
        if (value && summary[label]) value.textContent = summary[label];
      });
      const total = layout.querySelector(".appointment-summary-total span:last-child");
      if (total) total.textContent = values.Precio;

      let payment = paymentFromServer;
      let paymentError = null;
      if (paymentFromServer === undefined) {
        try {
          const payments = await fetchJson("/pagos");
          if (!Array.isArray(payments)) throw new Error("Respuesta de pagos no válida.");
          payment = payments.find((item) => Number(item.idCita) === Number(appointment.idCita)) || null;
        } catch (error) {
          paymentError = error;
        }
      }
      renderPaymentDetails(payment, paymentError);
    } catch (error) {
      layout.hidden = true;
      const messages = {
        401: ["Tu sesión no es válida. ", { href: "login.html", text: "Iniciar sesión" }],
        403: ["No tienes permisos para consultar esta cita."],
        404: ["No se encontró la cita solicitada."],
        500: ["Ocurrió un error en el servidor. Inténtalo más tarde."]
      };
      const [message, link] = messages[error.status] || ["No se pudo conectar con el servidor."];
      showMessage(errorState || emptyState, message, link);
    }
  };

  if (document.querySelector(".booking-confirmation") && typeof readBookingState === "function") registerBooking(readBookingState());
  loadAppointments();
  renderDashboardAppointment();
  renderAppointmentDetail();
})();
