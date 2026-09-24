/* Persistencia y presentación de las citas confirmadas en esta sesión. */
(() => {
  const appointmentsKey = "vitaVetAppointments";
  const selectedAppointmentKey = "vitaVetSelectedAppointment";
  const pets = {
    milo: { name: "Oliver", image: "milo.jpg", description: "Perro · Golden Retriever · 4 años" },
    nala: { name: "Snow", image: "nala.jpg", description: "Gato · Gato Persa · 2 años" }
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
    if (!booking || !booking.petId || !booking.service || !booking.veterinarian || !booking.date || !booking.time || !booking.price) return;
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

  const bindDashboardAppointment = () => {
    const card = document.querySelector(".appointment-card");
    const detailsLink = card?.querySelector('a[href="detalle-cita.html"]');
    if (!card || !detailsLink) return;

    const values = {};
    card.querySelectorAll(".appointment-detail").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value")?.textContent.trim();
      if (label && value) values[label] = value;
    });
    const pet = card.querySelector(".appointment-patient-name")?.textContent.trim();
    if (!pet || !values.Servicio || !values.Veterinario || !values.Fecha || !values.Hora) return;
    const dashboardAppointment = {
      petId: petIdForName(pet),
      service: values.Servicio,
      veterinarian: values.Veterinario,
      date: values.Fecha,
      time: values.Hora
    };
    const identity = appointmentIdentity(dashboardAppointment);

    detailsLink.addEventListener("click", () => {
      const savedAppointment = readAppointments().find((item) => appointmentIdentity(item) === identity);
      sessionStorage.setItem(selectedAppointmentKey, savedAppointment?.id || identity);
    });
  };

  const renderAppointmentDetail = () => {
    const layout = document.querySelector("#appointmentDetailLayout");
    if (!layout) return;
    const emptyState = document.querySelector("#appointmentDetailEmptyState");
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
      Precio: appointment.price
    };
    layout.querySelectorAll(".appointment-detail-info > div").forEach((row) => {
      const label = row.querySelector(".appointment-detail-label")?.textContent.trim();
      const value = row.querySelector(".appointment-detail-value");
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
  bindDashboardAppointment();
  renderAppointmentDetail();
})();
