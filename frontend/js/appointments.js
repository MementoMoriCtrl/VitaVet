/* Persistencia y presentación de las citas confirmadas en esta sesión. */
(() => {
  const appointmentsKey = "vitaVetAppointments";
  const selectedAppointmentKey = "vitaVetSelectedAppointment";
  const pets = {
    milo: { name: "Oliver", image: "milo.jpg", description: "Perro · Golden Retriever · 4 años" },
    nala: { name: "Snow", image: "nala.jpg", description: "Gata Persa · 2 años" }
  };
  const specialties = {
    "Dra. Valeria Torres": "Medicina General",
    "Dr. Sebastián Rojas": "Medicina Preventiva",
    "Dra. Andrea Mendoza": "Medicina Veterinaria",
    "Dr. Carlos Ramírez": "Cirugía Veterinaria"
  };

  const readAppointments = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(appointmentsKey));
      return Array.isArray(stored) ? stored.filter((item) => item && typeof item === "object") : [];
    } catch {
      return [];
    }
  };

  const appointmentIdentity = (appointment) => JSON.stringify([
    appointment.petId || appointment.pet,
    appointment.service,
    appointment.veterinarian,
    appointment.date,
    appointment.time
  ]);

  const petIdForName = (name) => Object.keys(pets).find((id) => pets[id].name === name) || name;

  const appointmentMonths = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const parseAppointmentDateTime = (appointment) => {
    const dateMatch = /^(\d{1,2}) ([a-záéíóú]+) (\d{4})$/i.exec(appointment.date || "");
    const timeMatch = /^(\d{1,2}):(\d{2}) (AM|PM)$/i.exec(appointment.time || "");
    if (!dateMatch || !timeMatch) return null;
    const day = Number(dateMatch[1]);
    const month = appointmentMonths.indexOf(dateMatch[2].toLocaleLowerCase("es"));
    const year = Number(dateMatch[3]);
    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (month < 0 || day < 1 || hour < 1 || hour > 12 || minute > 59) return null;
    if (timeMatch[3].toLocaleUpperCase("es") === "PM" && hour < 12) hour += 12;
    if (timeMatch[3].toLocaleUpperCase("es") === "AM" && hour === 12) hour = 0;
    const dateTime = new Date(year, month, day, hour, minute);
    if (dateTime.getFullYear() !== year || dateTime.getMonth() !== month || dateTime.getDate() !== day) return null;
    return dateTime;
  };

  const getNextAppointment = () => {
    const now = new Date();
    return readAppointments()
      .map((appointment) => {
        const petId = pets[appointment.petId] ? appointment.petId : petIdForName(appointment.pet);
        const scheduledAt = parseAppointmentDateTime(appointment);
        const status = appointment.status?.toLocaleLowerCase("es");
        const isValid = pets[petId]
          && appointment.service
          && appointment.veterinarian
          && appointment.price
          && scheduledAt
          && (!status || ["confirmada", "programada"].includes(status));
        return isValid ? { appointment, petId, scheduledAt } : null;
      })
      .filter((item) => item && item.scheduledAt > now)
      .sort((first, second) => first.scheduledAt - second.scheduledAt)[0] || null;
  };

  const readStaticDetailIdentity = () => {
    const layout = document.querySelector("#appointmentDetailLayout");
    if (!layout) return "";
    const details = {};
    layout.querySelectorAll(".appointment-detail-info > div").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value")?.textContent.trim();
      if (label && value) details[label] = value;
    });
    const pet = layout.querySelector(".appointment-detail-pet-name")?.textContent.trim();
    if (!pet || !details.Servicio || !details.Veterinario || !details.Fecha || !details.Hora) return "";
    return appointmentIdentity({
      petId: petIdForName(pet),
      service: details.Servicio,
      veterinarian: details.Veterinario,
      date: details.Fecha,
      time: details.Hora
    });
  };

  const registerBooking = (booking) => {
    if (!booking || (typeof getMissingBookingStep === "function" && getMissingBookingStep(booking))) return;
    const pet = pets[booking.petId];
    const appointment = {
      id: appointmentIdentity(booking),
      pet: pet?.name || booking.pet || booking.petId,
      petId: booking.petId,
      service: booking.service,
      veterinarian: booking.veterinarian,
      date: booking.date,
      time: booking.time,
      price: booking.price,
      paymentMethod: booking.paymentMethod || "",
      paymentType: booking.paymentType || "",
      status: "Confirmada"
    };
    const appointments = readAppointments();
    const identity = appointmentIdentity(appointment);
    // Evita guardar dos veces la misma cita confirmada.
    if (!appointments.some((saved) => appointmentIdentity(saved) === identity)) {
      appointments.push(appointment);
      sessionStorage.setItem(appointmentsKey, JSON.stringify(appointments));
    }
  };

  const renderAppointments = () => {
    const grid = document.querySelector(".appointments-grid");
    if (!grid) return;
    const template = grid.querySelector(".appointment-list-card");
    const emptyState = document.querySelector("#appointmentsEmptyState");
    // La lista se construye con las citas confirmadas guardadas en la sesión.
    const appointments = readAppointments();
    grid.replaceChildren();
    if (!appointments.length || !template) {
      if (emptyState) emptyState.hidden = false;
      return;
    }
    if (emptyState) emptyState.hidden = true;

    appointments.forEach((appointment, index) => {
      const card = template.cloneNode(true);
      const pet = pets[appointment.petId] || { name: appointment.pet || "Mascota", image: "milo.jpg", description: "Mascota" };
      const image = card.querySelector(".appointment-list-pet-image");
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = `${pet.name}, ${pet.description}`;
      card.querySelector(".appointment-list-pet-name").textContent = pet.name;
      card.querySelector(".appointment-list-pet-details").textContent = pet.description;
      const values = card.querySelectorAll(".appointment-list-detail-value");
      [appointment.service, appointment.veterinarian, appointment.date, appointment.time, appointment.price].forEach((value, valueIndex) => {
        if (values[valueIndex]) values[valueIndex].textContent = value || "—";
      });
      const status = card.querySelector(".confirmed, .scheduled");
      if (status) status.textContent = appointment.status || "Confirmada";
      const detailsLink = card.querySelector('a[href="detalle-cita.html"]');
      if (detailsLink) detailsLink.addEventListener("click", () => {
        sessionStorage.setItem(selectedAppointmentKey, appointment.id || appointmentIdentity(appointment));
      });
      card.hidden = false;
      card.dataset.appointmentIndex = String(index);
      grid.append(card);
    });
  };

  const renderDashboardAppointment = () => {
    const card = document.querySelector(".appointment-card");
    if (!card) return;
    const patient = card.querySelector(".appointment-patient-name");
    const patientType = card.querySelector(".appointment-patient-type");
    const image = card.querySelector(".pet-avatar-image");
    const status = card.querySelector(".appointment-topline .confirmed");
    const topLine = card.querySelector(".appointment-topline");
    const meta = card.querySelector(".appointment-meta");
    const message = card.querySelector(".appointment-actions .appointment-detail-value");
    const detailsLink = card.querySelector('a[href="detalle-cita.html"]');
    const nextAppointment = getNextAppointment();

    if (!nextAppointment) {
      if (topLine) topLine.style.display = "none";
      if (meta) meta.style.display = "none";
      if (message) message.textContent = "No tienes próximas citas.";
      if (detailsLink) detailsLink.style.display = "none";
      card.style.display = "";
      card.hidden = false;
      return;
    }

    const { appointment, petId } = nextAppointment;
    const pet = pets[petId];
    if (topLine) topLine.style.display = "";
    if (meta) meta.style.display = "";
    if (patient) patient.textContent = pet.name;
    if (patientType) patientType.textContent = pet.description;
    if (image) {
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = `${pet.name}, ${pet.description}`;
    }
    if (status) status.textContent = appointment.status || "Confirmada";
    const values = {
      Servicio: appointment.service,
      Veterinario: appointment.veterinarian,
      Fecha: appointment.date,
      Hora: appointment.time
    };
    card.querySelectorAll(".appointment-detail").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value");
      if (value && values[label]) value.textContent = values[label];
    });
    if (message) message.textContent = `Tu próxima visita está lista. Precio: ${appointment.price}.`;
    if (detailsLink) {
      detailsLink.style.display = "";
      // Guarda la cita del dashboard que se abrirá en la página de detalle.
      detailsLink.addEventListener("click", () => {
        sessionStorage.setItem(selectedAppointmentKey, appointment.id || appointmentIdentity(appointment));
      });
    }
    card.style.display = "";
    card.hidden = false;
  };

  const renderAppointmentDetail = () => {
    const layout = document.querySelector("#appointmentDetailLayout");
    if (!layout) return;
    const emptyState = document.querySelector("#appointmentDetailEmptyState");
    // Recupera la cita seleccionada para completar la vista de detalle.
    const selectedId = sessionStorage.getItem(selectedAppointmentKey);
    const appointment = readAppointments().find((item) => (item.id || appointmentIdentity(item)) === selectedId);
    if (!appointment) {
      if (selectedId && selectedId === readStaticDetailIdentity()) {
        layout.hidden = false;
        if (emptyState) emptyState.hidden = true;
        return;
      }
      layout.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }
    layout.hidden = false;
    if (emptyState) emptyState.hidden = true;
    const pet = pets[appointment.petId] || { name: appointment.pet || "Mascota", image: "milo.jpg", description: "Mascota" };
    const image = layout.querySelector(".appointment-detail-pet-image");
    image.src = `../assets/images/mascotas/${pet.image}`;
    image.alt = `${pet.name}, ${pet.description}`;
    layout.querySelector(".appointment-detail-pet-name").textContent = pet.name;
    layout.querySelector(".appointment-detail-pet-description").textContent = pet.description;

    const details = {
      Servicio: appointment.service,
      Veterinario: appointment.veterinarian,
      Especialidad: specialties[appointment.veterinarian] || "—",
      Fecha: appointment.date,
      Hora: appointment.time,
      Precio: appointment.price,
      "Modalidad de pago": appointment.paymentType === "now"
        ? "Pagar ahora"
        : appointment.paymentType === "clinic" ? "Pagar en la clínica" : "",
      "Método de pago": appointment.paymentMethod === "card"
        ? "Tarjeta"
        : appointment.paymentMethod === "yape" ? "Yape / Plin" : ""
    };
    layout.querySelectorAll(".appointment-detail-info > div").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value");
      if (label === "Modalidad de pago") row.hidden = !details[label];
      if (label === "Método de pago") row.hidden = appointment.paymentType !== "now" || !details[label];
      if (value && details[label]) value.textContent = details[label];
    });
    const about = layout.querySelector(".appointment-about-text");
    if (about) about.textContent = `${appointment.service} para evaluar el estado de salud de ${pet.name} y cuidar su bienestar.`;
    const statusText = layout.querySelector(".appointment-status-text");
    if (statusText) statusText.textContent = `Tu cita está ${appointment.status?.toLocaleLowerCase("es") || "confirmada"} y lista para atención.`;

    const summary = {
      Mascota: pet.name,
      Servicio: appointment.service,
      Fecha: appointment.date,
      Hora: appointment.time
    };
    layout.querySelectorAll(".appointment-summary-row").forEach((row) => {
      const label = row.querySelector(".appointment-summary-label")?.textContent.trim();
      const value = row.querySelector(".appointment-summary-value");
      if (value && summary[label]) value.textContent = summary[label];
    });
    const total = layout.querySelector(".appointment-summary-total span:last-child");
    if (total) total.textContent = appointment.price;
  };

  if (document.querySelector(".booking-confirmation") && typeof readBookingState === "function") {
    registerBooking(readBookingState());
  }
  renderAppointments();
  renderDashboardAppointment();
  renderAppointmentDetail();
})();
