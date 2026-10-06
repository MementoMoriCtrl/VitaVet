/* Estado temporal compartido por las etapas del registro de citas. */
const bookingStorageKey = "vitaVetBooking";

// Lee la reserva temporal compartida entre las etapas.
const readBookingState = () => {
  try {
    const state = JSON.parse(sessionStorage.getItem(bookingStorageKey));
    return state && typeof state === "object" ? state : {};
  } catch {
    return {};
  }
};

// Guarda en sessionStorage los cambios seleccionados en cada etapa.
const saveBookingState = (updates) => {
  const nextState = { ...readBookingState(), ...updates };
  sessionStorage.setItem(bookingStorageKey, JSON.stringify(nextState));
  return nextState;
};

const prepareBookingEntry = () => {
  // Una reserva nueva conserva la mascota; retomar conserva el estado existente.
  if (!window.location.pathname.endsWith("/registro-cita.html")) return;
  const query = new URLSearchParams(window.location.search);
  if (!query.has("retomar")) {
    sessionStorage.setItem(bookingStorageKey, JSON.stringify({}));
    query.set("retomar", "1");
    window.history.replaceState(null, "", `?${query.toString()}`);
  }
};

const calendarMonthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const calendarWeekdays = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
// Acepta fechas válidas del calendario en el formato usado por la reserva.
const parseBookingDate = (date) => {
  const match = /^(\d{2}) ([a-záéíóú]+) (\d{4})$/i.exec(date || "");
  if (!match) return null;
  const day = Number(match[1]);
  const month = calendarMonthNames.indexOf(match[2].toLocaleLowerCase("es"));
  const year = Number(match[3]);
  if (month < 0 || day < 1 || day > new Date(year, month + 1, 0).getDate()) return null;
  return { day, month, year };
};
const toApiBookingDate = (date) => {
  const parsed = parseBookingDate(date);
  return parsed
    ? `${parsed.year}-${String(parsed.month + 1).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`
    : undefined;
};
const toApiBookingTime = (time) => {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/i.exec(time || "");
  if (!match) return undefined;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === "PM" && hour < 12) hour += 12;
  if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${match[2]}:00`;
};
const isValidBookingDate = (date) => {
  const bookingDate = parseBookingDate(date);
  if (!bookingDate) return false;
  const today = new Date();
  const bookingDay = bookingDate.year * 10000 + (bookingDate.month + 1) * 100 + bookingDate.day;
  const currentDay = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return bookingDay >= currentDay;
};
// Limita la selección a los horarios ofrecidos en esta etapa.
const validBookingTimes = ["09:00 AM", "10:30 AM", "12:00 PM", "03:00 PM", "05:00 PM"];
const normalizePaymentMode = (value) => (["now", "clinic"].includes(value) ? value : undefined);
const normalizePaymentMethod = (value) => {
  if (["card", "yape"].includes(value)) return value;
  const normalized = (value || "").toLocaleLowerCase("es");
  if (normalized === "tarjeta" || normalized === "card") return "card";
  if (normalized.includes("yape") || normalized.includes("plin")) return "yape";
  return undefined;
};

const isValidBackendId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const bookingApiBase = "http://localhost:8080/api";
const requestBookingApi = async (token, endpoint, options = {}) => {
  const headers = { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) };
  const response = await fetch(`${bookingApiBase}${endpoint}`, { ...options, headers });
  const responseText = await response.text();
  let data = null;
  if (responseText.trim()) {
    try { data = JSON.parse(responseText); } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
};

const getMissingBookingStep = (state) => {
  if (!isValidBackendId(state.idMascota) || !state.petName) return { label: "la mascota", href: "registro-cita.html?retomar=1" };
  if (!isValidBackendId(state.idServicio) || !state.service || !Number.isFinite(Number(state.servicePrice))) {
    return { label: "el servicio", href: "registro-servicio.html" };
  }
  if (!isValidBackendId(state.idVeterinario) || !state.veterinarian || !state.veterinarianSpecialty) {
    return { label: "el veterinario", href: "registro-veterinario.html" };
  }
  if (!isValidBookingDate(state.date)) return { label: "la fecha", href: "registro-fecha-hora.html" };
  if (!validBookingTimes.includes(state.time)) return { label: "la hora", href: "registro-fecha-hora.html" };
  const paymentType = normalizePaymentMode(state.paymentType);
  if (!paymentType) return { label: "la modalidad de pago", href: "registro-pago.html" };
  if (paymentType === "now" && !normalizePaymentMethod(state.paymentMethod)) {
    return { label: "el método de pago", href: "registro-pago.html" };
  }
  return null;
};

const restoreRadio = (name, value) => {
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = Boolean(value && input.value === value);
    input.closest(".booking-option")?.classList.toggle("is-selected", input.checked);
  });
};

// Refleja en cada etapa los datos guardados de la reserva.
const updateBookingSummaries = (state) => {
  const pending = "Pendiente de selección";
  const pet = state.petName ? {
    name: state.petName,
    image: state.petImage,
    description: state.petDescription || "Mascota"
  } : null;
  document.querySelectorAll(".booking-summary-pet").forEach((summary) => {
    const image = summary.querySelector(".booking-summary-image");
    const name = summary.querySelector(".booking-summary-pet-name");
    const details = summary.querySelector(".booking-summary-pet-details");
    if (image && pet?.image) {
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = `${pet.name}, ${pet.description}`;
    }
    if (image) image.hidden = !pet?.image;
    if (name) name.textContent = pet?.name || pending;
    if (details) details.textContent = pet?.description || pending;
  });

  document.querySelectorAll(".booking-summary-row").forEach((row) => {
    const label = row.querySelector(".booking-summary-label")?.textContent.trim();
    const value = row.querySelector(".booking-summary-value");
    if (!value) return;
    const paymentType = normalizePaymentMode(state.paymentType);
    const paymentMethod = normalizePaymentMethod(state.paymentMethod);
    const values = {
      Servicio: state.service,
      Veterinario: state.veterinarian,
      Fecha: state.date,
      Hora: state.time,
      "Fecha y hora": state.date || state.time
        ? `${state.date || pending}, ${state.time || pending}`
        : pending,
      Especialidad: state.veterinarianSpecialty,
      "Modalidad de pago": paymentType === "now"
        ? "Pagar ahora"
        : paymentType === "clinic" ? "Pagar en la clínica" : undefined,
      "Método de pago": paymentType === "now"
        ? paymentMethod === "card" ? "Tarjeta" : paymentMethod === "yape" ? "Yape / Plin" : undefined
        : undefined,
      "Precio estimado": state.price
    };
    if (label === "Método de pago") row.style.display = paymentType === "clinic" ? "none" : "";
    if (Object.prototype.hasOwnProperty.call(values, label)) value.textContent = values[label] || pending;
  });

  document.querySelectorAll(".booking-summary-total span:last-child").forEach((total) => {
    total.textContent = state.price || pending;
  });
  const paymentButton = document.querySelector('a[href="registro-confirmacion.html"]');
  if (paymentButton && state.price) paymentButton.textContent = "Registrar cita y pago pendiente";
  const confirmationText = document.querySelector(".booking-confirmation-text");
  if (confirmationText && state.createdAppointment) {
    confirmationText.textContent = `La cita de ${pet?.name || pending} fue registrada correctamente.`;
  }
};

const syncBookingSelections = () => {
  prepareBookingEntry();
  let state = readBookingState();

  // Adapta la estructura anterior (modalidad en paymentMethod y tipo en paymentType)
  // a la estructura actual sin perder las selecciones ya guardadas.
  const previousMode = normalizePaymentMode(state.paymentMethod)
    || normalizePaymentMode(state.paymentType)
    || (state.paymentMethod === "on" ? "now" : undefined);
  const previousMethod = normalizePaymentMethod(state.paymentMethod) || normalizePaymentMethod(state.paymentType);
  const paymentMigration = {};
  if (previousMode && state.paymentType !== previousMode) paymentMigration.paymentType = previousMode;
  if (previousMethod && state.paymentMethod !== previousMethod) paymentMigration.paymentMethod = previousMethod;
  if (Object.keys(paymentMigration).length) state = saveBookingState(paymentMigration);

  restoreRadio("pet", state.idMascota);
  restoreRadio("service", state.idServicio);
  restoreRadio("veterinarian", state.idVeterinario);
  if (state.paymentType) restoreRadio("paymentType", state.paymentType);

  const selectedPet = document.querySelector('input[name="pet"]:checked');
  const selectedService = document.querySelector('input[name="service"]:checked');
  const selectedPaymentType = document.querySelector('input[name="paymentType"]:checked');
  const updates = {};
  if (selectedPet) {
    updates.idMascota = Number(selectedPet.value);
  }
  if (selectedService) {
    updates.idServicio = Number(selectedService.value);
  }
  if (selectedPaymentType) updates.paymentType = selectedPaymentType.value;

  const dateGrid = document.querySelector(".booking-date-grid");
  const timeGrid = document.querySelector(".booking-time-grid");
  if (dateGrid && !isValidBookingDate(state.date)) {
    updates.date = undefined;
    updates.fecha = undefined;
  } else if (dateGrid && state.fecha !== toApiBookingDate(state.date)) {
    updates.fecha = toApiBookingDate(state.date);
  }
  if (timeGrid && !validBookingTimes.includes(state.time)) {
    updates.time = undefined;
    updates.hora = undefined;
  } else if (timeGrid && state.hora !== toApiBookingTime(state.time)) {
    updates.hora = toApiBookingTime(state.time);
  }
  const paymentMethodButtons = document.querySelectorAll(".booking-payment-method");
  if (selectedPaymentType?.value === "clinic") {
    updates.paymentMethod = "";
  } else if (paymentMethodButtons.length && !normalizePaymentMethod(state.paymentMethod)) {
    const initiallySelectedMethod = Array.from(paymentMethodButtons).find((button) => button.getAttribute("aria-pressed") === "true")
      || paymentMethodButtons[0];
    updates.paymentMethod = initiallySelectedMethod.dataset.paymentMethod;
  }
  if (Object.keys(updates).length) state = saveBookingState(updates);

  let dateChoices = [];
  const timeChoices = document.querySelectorAll(".booking-time-grid [data-time]");
  const reflectCalendarSelection = (currentState) => {
    dateChoices.forEach((button) => {
      const selected = button.dataset.date === currentState.date;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    timeChoices.forEach((button) => {
      const selected = button.dataset.time === currentState.time;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    const selectedDateLabel = document.querySelector(".booking-date-summary .booking-option-description");
    if (selectedDateLabel) selectedDateLabel.textContent = currentState.date || "Pendiente de selección";
    updateBookingSummaries(currentState);
  };

  const monthTitle = document.querySelector("#bookingMonthTitle");
  const previousMonthButton = document.querySelector("#previousBookingMonth");
  const nextMonthButton = document.querySelector("#nextBookingMonth");
  const selectedCalendarDate = parseBookingDate(state.date);
  const today = new Date();
  let calendarYear = selectedCalendarDate?.year ?? today.getFullYear();
  let calendarMonth = selectedCalendarDate?.month ?? today.getMonth();

  // Genera el calendario del mes y restaura la selección guardada.
  const renderCalendar = () => {
    if (!dateGrid) return;
    if (monthTitle) {
      const monthTitleText = calendarMonthNames[calendarMonth];
      monthTitle.textContent = `${monthTitleText[0].toLocaleUpperCase("es")}${monthTitleText.slice(1)} ${calendarYear}`;
    }
    dateGrid.replaceChildren();
    const firstWeekday = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    for (let empty = 0; empty < firstWeekday; empty++) {
      const blank = document.createElement("span");
      blank.className = "booking-calendar-empty";
      blank.setAttribute("aria-hidden", "true");
      dateGrid.append(blank);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${String(day).padStart(2, "0")} ${calendarMonthNames[calendarMonth]} ${calendarYear}`;
      const button = document.createElement("button");
      button.className = "booking-choice booking-date-choice";
      button.type = "button";
      button.dataset.date = date;
      button.disabled = !isValidBookingDate(date);
      button.setAttribute("aria-label", date);
      button.setAttribute("aria-pressed", "false");
      const weekday = calendarWeekdays[(firstWeekday + day - 1) % 7];
      const weekdayLabel = document.createElement("span");
      weekdayLabel.className = "booking-choice-day";
      weekdayLabel.textContent = weekday;
      const dateLabel = document.createElement("span");
      dateLabel.className = "booking-choice-date";
      dateLabel.textContent = String(day).padStart(2, "0");
      button.append(weekdayLabel, dateLabel);
      button.addEventListener("click", () => {
        if (!isValidBookingDate(button.dataset.date)) return;
        state = saveBookingState({ date: button.dataset.date, fecha: toApiBookingDate(button.dataset.date) });
        reflectCalendarSelection(state);
      });
      dateGrid.append(button);
    }
    dateChoices = dateGrid.querySelectorAll("[data-date]");
    reflectCalendarSelection(readBookingState());
  };

  // Cambia el mes visible y vuelve a generar sus días.
  const changeCalendarMonth = (offset) => {
    const nextMonth = new Date(calendarYear, calendarMonth + offset, 1);
    calendarYear = nextMonth.getFullYear();
    calendarMonth = nextMonth.getMonth();
    renderCalendar();
  };

  previousMonthButton?.addEventListener("click", () => changeCalendarMonth(-1));
  nextMonthButton?.addEventListener("click", () => changeCalendarMonth(1));
  renderCalendar();

  timeChoices.forEach((button) => {
    button.addEventListener("click", () => {
      if (!validBookingTimes.includes(button.dataset.time)) return;
      reflectCalendarSelection(saveBookingState({ time: button.dataset.time, hora: toApiBookingTime(button.dataset.time) }));
    });
  });
  if (dateGrid || timeGrid) reflectCalendarSelection(state);

  document.querySelectorAll('input[name="paymentType"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll(`input[name="${input.name}"]`).forEach((option) => {
        option.closest(".booking-option")?.classList.toggle("is-selected", option.checked);
      });
      const changed = { paymentType: input.value };
      if (input.value === "clinic") changed.paymentMethod = "";
      updateBookingSummaries(saveBookingState(changed));
    });
  });

  const onlinePaymentSection = document.querySelector("#onlinePaymentSection");
  const cardPaymentFields = document.querySelector("#cardPaymentFields");
  const yapePaymentFields = document.querySelector("#yapePaymentFields");
  const clinicPaymentMessage = document.querySelector("#clinicPaymentMessage");
  const confirmBookingButton = document.querySelector("#confirmBookingButton");
  const syncPaymentInterface = (paymentState) => {
    const payingOnline = paymentState.paymentType !== "clinic";
    const usingCard = paymentState.paymentMethod === "card";
    if (onlinePaymentSection) onlinePaymentSection.hidden = !payingOnline;
    if (cardPaymentFields) cardPaymentFields.hidden = !payingOnline || !usingCard;
    if (yapePaymentFields) yapePaymentFields.hidden = !payingOnline || usingCard;
    if (clinicPaymentMessage) clinicPaymentMessage.hidden = payingOnline;
    paymentMethodButtons.forEach((button) => {
      const selected = button.dataset.paymentMethod === paymentState.paymentMethod;
      button.classList.toggle("btn-outline", selected);
      button.classList.toggle("btn-secondary", !selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    [cardPaymentFields, yapePaymentFields].forEach((fields) => {
      if (!fields || !fields.hidden) return;
      fields.querySelectorAll("input").forEach((input) => {
        input.removeAttribute("aria-invalid");
        const error = document.getElementById(`${input.id}-error`);
        if (error) { error.textContent = ""; error.hidden = true; }
      });
    });
    updateBookingSummaries(paymentState);
  };

  paymentMethodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state = saveBookingState({ paymentMethod: button.dataset.paymentMethod });
      syncPaymentInterface(state);
    });
  });
  document.querySelectorAll('input[name="paymentType"]').forEach((input) => {
    input.addEventListener("change", () => {
      const updates = { paymentType: input.value };
      if (input.value === "clinic") updates.paymentMethod = "";
      else if (!normalizePaymentMethod(state.paymentMethod)) {
        updates.paymentMethod = paymentMethodButtons[0]?.dataset.paymentMethod || "";
      }
      state = saveBookingState(updates);
      syncPaymentInterface(state);
    });
  });

  const cardInputs = {
    number: document.querySelector("#card-number"),
    holder: document.querySelector("#card-holder"),
    expiry: document.querySelector("#card-expiry"),
    cvv: document.querySelector("#card-cvv")
  };
  const yapePhoneInput = document.querySelector("#yape-phone");
  const showFieldError = (input, message) => {
    if (!input) return false;
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute("aria-invalid", "true");
    if (error) { error.textContent = message; error.hidden = false; }
    return true;
  };
  const clearFieldError = (input) => {
    if (!input) return;
    input.removeAttribute("aria-invalid");
    const error = document.getElementById(`${input.id}-error`);
    if (error) { error.textContent = ""; error.hidden = true; }
  };
  Object.values(cardInputs).concat(yapePhoneInput).filter(Boolean).forEach((input) => {
    input.addEventListener("input", () => clearFieldError(input));
  });

  // Valida los datos de pago de demostración; no realiza cobros.
  confirmBookingButton?.addEventListener("click", (event) => {
    const currentPayment = readBookingState();
    if (currentPayment.paymentType === "clinic") return;
    const errors = [];
    if (currentPayment.paymentMethod === "yape") {
      const phone = yapePhoneInput?.value.trim().replace(/[\s-]/g, "") || "";
      if (!phone) errors.push([yapePhoneInput, "Ingresa tu número de celular."]);
      else if (!/^9\d{8}$/.test(phone)) errors.push([yapePhoneInput, "Ingresa un número de celular válido de 9 dígitos."]);
    } else {
      const number = cardInputs.number?.value.trim() || "";
      const digits = number.replace(/\s/g, "");
      const holder = cardInputs.holder?.value.trim() || "";
      const expiry = cardInputs.expiry?.value.trim() || "";
      const cvv = cardInputs.cvv?.value.trim() || "";
      if (!number) errors.push([cardInputs.number, "Ingresa el número de tarjeta."]);
      else if (!/^[\d ]+$/.test(number) || !/^\d{13,19}$/.test(digits)) errors.push([cardInputs.number, "Ingresa entre 13 y 19 dígitos para la tarjeta."]);
      if (!holder) errors.push([cardInputs.holder, "Ingresa el nombre del titular."]);
      if (!expiry) errors.push([cardInputs.expiry, "Ingresa el vencimiento (MM/AA)."]);
      else if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) errors.push([cardInputs.expiry, "Usa el formato MM/AA."]);
      if (!cvv) errors.push([cardInputs.cvv, "Ingresa el CVV."]);
      else if (!/^\d{3,4}$/.test(cvv)) errors.push([cardInputs.cvv, "El CVV debe tener 3 o 4 dígitos."]);
    }
    if (errors.length) {
      event.preventDefault();
      errors.forEach(([input, message]) => showFieldError(input, message));
      errors[0][0]?.focus();
    }
  });

  let creatingAppointment = false;
  confirmBookingButton?.addEventListener("click", async (event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (creatingAppointment) return;

    const createMessage = document.querySelector("#bookingCreateMessage");
    const currentBooking = readBookingState();
    const missingStep = getMissingBookingStep(currentBooking);
    if (missingStep) {
      setBookingMessage(createMessage, `Completa primero ${missingStep.label}.`);
      return;
    }
    const token = sessionStorage.getItem("vitaVetToken");
    if (!token) {
      setBookingMessage(createMessage, "Tu sesión no es válida.", true);
      return;
    }

    const fecha = toApiBookingDate(currentBooking.date);
    const hora = toApiBookingTime(currentBooking.time);
    if (!fecha || !hora) {
      setBookingMessage(createMessage, "La fecha o la hora seleccionada no es válida.");
      return;
    }

    creatingAppointment = true;
    confirmBookingButton.setAttribute("aria-disabled", "true");
    confirmBookingButton.textContent = "Registrando cita y pago...";
    setBookingMessage(createMessage, "Registrando la cita y el pago pendiente...");
    let appointment = null;
    try {
      const services = await requestBookingApi(token, "/servicios");
      const service = Array.isArray(services)
        ? services.find((item) => Number(item.idServicio) === Number(currentBooking.idServicio))
        : null;
      const servicePrice = Number(service?.precio);
      if (!service || !Number.isFinite(servicePrice) || servicePrice < 0) {
        setBookingMessage(createMessage, "No se pudo verificar el precio actual del servicio. Inténtalo nuevamente.");
        return;
      }

      const savedBooking = readBookingState();
      const previousId = Number(savedBooking.createdAppointment?.idCita);
      if (Number.isInteger(previousId) && previousId > 0) {
        // Tras una recarga, valida con la API la cita devuelta por el POST anterior.
        appointment = await requestBookingApi(token, `/citas/${encodeURIComponent(previousId)}`);
      } else {
        appointment = await requestBookingApi(token, "/citas", {
          method: "POST",
          body: JSON.stringify({
            idMascota: Number(currentBooking.idMascota),
            idServicio: Number(currentBooking.idServicio),
            idVeterinario: Number(currentBooking.idVeterinario),
            fecha,
            hora
          })
        });
      }
      if (!appointment || !isValidBackendId(appointment.idCita)) {
        throw new Error("El servidor no devolvió una cita válida.");
      }
      if (Number(appointment.idMascota) !== Number(currentBooking.idMascota)
        || Number(appointment.idServicio) !== Number(currentBooking.idServicio)
        || Number(appointment.idVeterinario) !== Number(currentBooking.idVeterinario)) {
        throw new Error("La cita recuperada no coincide con las selecciones actuales.");
      }

      const bookingWithAppointment = saveBookingState({
        createdAppointment: appointment,
        idCita: Number(appointment.idCita),
        servicePrice,
        price: `S/ ${servicePrice.toFixed(2)}`,
        paymentError: undefined
      });
      const findExistingPayment = async () => {
        const payments = await requestBookingApi(token, "/pagos");
        if (!Array.isArray(payments)) throw new Error("Respuesta de pagos no válida.");
        return payments.find((payment) => Number(payment.idCita) === Number(appointment.idCita)) || null;
      };

      // También se consulta al reanudar tras recarga para no crear pagos duplicados.
      let payment = await findExistingPayment();
      if (!payment) {
        const paymentType = normalizePaymentMode(bookingWithAppointment.paymentType);
        const paymentMethod = normalizePaymentMethod(bookingWithAppointment.paymentMethod);
        const paymentPayload = {
          idCita: Number(appointment.idCita),
          modalidad: paymentType === "clinic" ? "presencial" : "online",
          metodo: paymentType === "clinic" ? "efectivo" : paymentMethod === "yape" ? "yape" : "tarjeta",
          monto: servicePrice,
          estado: "Pendiente"
        };
        try {
          payment = await requestBookingApi(token, "/pagos", {
            method: "POST",
            body: JSON.stringify(paymentPayload)
          });
        } catch (paymentError) {
          // Una respuesta perdida puede ocultar un guardado exitoso; reconcilia antes de reintentar.
          if ([400, 401, 403, 404, 409].includes(paymentError.status)) throw paymentError;
          try { payment = await findExistingPayment(); } catch { /* Mantiene el error original. */ }
          if (!payment) throw paymentError;
        }
        if (!payment || !isValidBackendId(payment.idPago)
          || Number(payment.idCita) !== Number(appointment.idCita)) {
          payment = await findExistingPayment();
        }
      }
      if (!payment || !isValidBackendId(payment.idPago)
        || Number(payment.idCita) !== Number(appointment.idCita)) {
        throw new Error("El servidor no confirmó el registro del pago.");
      }
      saveBookingState({ createdAppointment: appointment, createdPayment: payment, paymentError: undefined });
      window.location.href = "registro-confirmacion.html";
    } catch (error) {
      const errors = {
        400: "Los datos enviados no son válidos.",
        401: "Tu sesión ya no es válida.",
        403: "No tienes permisos para realizar esta operación.",
        404: "No se encontró la cita o alguno de los datos seleccionados.",
        409: "La solicitud entra en conflicto con el estado actual del registro.",
        500: "Ocurrió un error en el servidor. Inténtalo más tarde."
      };
      const errorMessage = errors[error.status]
        || (error instanceof TypeError ? "No se pudo conectar con el servidor. Inténtalo nuevamente." : error.message);
      if (appointment && isValidBackendId(appointment.idCita)) {
        saveBookingState({
          createdAppointment: appointment,
          idCita: Number(appointment.idCita),
          createdPayment: null,
          paymentError: errorMessage
        });
        setBookingMessage(createMessage,
          `La cita #${appointment.idCita} fue creada, pero no se pudo confirmar el registro del pago. ${errorMessage} Puedes volver a intentarlo; se verificará primero si el pago ya existe.`,
          error.status === 401);
      } else {
        setBookingMessage(createMessage, errorMessage, error.status === 401);
      }
    } finally {
      creatingAppointment = false;
      confirmBookingButton.removeAttribute("aria-disabled");
      confirmBookingButton.textContent = "Registrar cita y pago pendiente";
    }
  });
  if (paymentMethodButtons.length || onlinePaymentSection) syncPaymentInterface(state);

  updateBookingSummaries(state);
};

const setBookingMessage = (element, text, loginLink = false) => {
  if (!element) return;
  element.replaceChildren(document.createTextNode(text));
  if (loginLink) {
    element.append(" ");
    const link = document.createElement("a");
    link.href = "login.html";
    link.textContent = "Iniciar sesión";
    element.append(link);
  }
  element.hidden = false;
};

const petPresentation = (pet) => {
  const type = String(pet.tipo || "");
  const isCat = type.toLocaleLowerCase("es").includes("gato");
  const image = isCat ? "nala.jpg" : "milo.jpg";
  const description = [type, pet.raza, Number.isFinite(Number(pet.edad)) ? `${pet.edad} años` : ""]
    .filter(Boolean).join(" · ");
  return { image, description };
};

const attachRealSelection = (input, payload) => {
  input.addEventListener("change", () => {
    document.querySelectorAll(`input[name="${input.name}"]`).forEach((option) => {
      option.closest(".booking-option")?.classList.toggle("is-selected", option.checked);
    });
    updateBookingSummaries(saveBookingState({ ...payload, createdAppointment: null, createdPayment: null, idCita: undefined }));
  });
};

const renderPetOptions = (pets) => {
  const grid = document.querySelector("#petOptions");
  if (!grid) return;
  const previous = readBookingState();
  grid.replaceChildren();
  pets.forEach((pet) => {
    const id = Number(pet.idMascota);
    if (!Number.isInteger(id) || id <= 0 || typeof pet.nombre !== "string") return;
    const presentation = petPresentation(pet);
    const label = document.createElement("label");
    label.className = "booking-option booking-pet-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "pet";
    input.value = String(id);
    const image = document.createElement("img");
    image.className = "booking-pet-image";
    image.src = `../assets/images/mascotas/${presentation.image}`;
    image.alt = `${pet.nombre}, ${presentation.description}`;
    const info = document.createElement("span");
    const name = document.createElement("span");
    name.className = "booking-pet-name";
    name.textContent = pet.nombre;
    const description = document.createElement("span");
    description.className = "booking-pet-details";
    description.textContent = presentation.description;
    info.append(name, description);
    label.append(input, image, info);
    grid.append(label);
    attachRealSelection(input, {
      idMascota: id,
      petId: id,
      pet: pet.nombre,
      petName: pet.nombre,
      petType: pet.tipo || "",
      petBreed: pet.raza || "",
      petSex: pet.sexo || "",
      petAge: pet.edad,
      petImage: presentation.image,
      petDescription: presentation.description,
      createdAppointment: null,
      createdPayment: null,
      idCita: undefined
    });
  });
  const selected = grid.querySelector(`input[name="pet"][value="${previous.idMascota}"]`);
  if (selected) {
    selected.checked = true;
    selected.closest(".booking-option")?.classList.add("is-selected");
    selected.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (previous.idMascota) {
    saveBookingState({ idMascota: undefined, petId: undefined, pet: undefined, petName: undefined,
      petType: undefined, petBreed: undefined, petSex: undefined, petAge: undefined,
      petImage: undefined, petDescription: undefined, createdAppointment: null, createdPayment: null, idCita: undefined });
  }
  grid.hidden = grid.children.length === 0;
  updateBookingSummaries(readBookingState());
};

const renderServiceOptions = (services) => {
  const grid = document.querySelector("#serviceOptions");
  if (!grid) return;
  const previous = readBookingState();
  grid.replaceChildren();
  services.forEach((service) => {
    const id = Number(service.idServicio);
    const price = Number(service.precio);
    if (!Number.isInteger(id) || id <= 0 || typeof service.nombre !== "string" || !Number.isFinite(price)) return;
    const label = document.createElement("label");
    label.className = "booking-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "service";
    input.value = String(id);
    const header = document.createElement("span");
    header.className = "booking-option-header";
    const title = document.createElement("span");
    title.className = "booking-option-title";
    title.textContent = service.nombre;
    const priceLabel = document.createElement("span");
    priceLabel.className = "booking-option-price";
    priceLabel.textContent = `S/ ${price.toFixed(2)}`;
    header.append(title, priceLabel);
    const description = document.createElement("span");
    description.className = "booking-option-description";
    const duration = Number(service.duracionMinutos);
    description.textContent = [service.descripcion, Number.isFinite(duration) && duration > 0
      ? `${duration} min` : ""].filter(Boolean).join(" · ");
    label.append(input, header, description);
    grid.append(label);
    attachRealSelection(input, {
      idServicio: id,
      service: service.nombre,
      serviceDescription: service.descripcion || "",
      servicePrice: price,
      serviceDuration: service.duracionMinutos,
      price: `S/ ${price.toFixed(2)}`,
      createdAppointment: null,
      createdPayment: null,
      idCita: undefined
    });
  });
  const selected = grid.querySelector(`input[name="service"][value="${previous.idServicio}"]`);
  if (selected) {
    selected.checked = true;
    selected.closest(".booking-option")?.classList.add("is-selected");
    selected.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (previous.idServicio) {
    saveBookingState({ idServicio: undefined, service: undefined, serviceDescription: undefined,
      servicePrice: undefined, serviceDuration: undefined, price: undefined, createdAppointment: null, createdPayment: null, idCita: undefined });
  }
  grid.hidden = grid.children.length === 0;
  updateBookingSummaries(readBookingState());
};

const renderVeterinarianOptions = (veterinarians) => {
  const grid = document.querySelector("#veterinarianOptions");
  if (!grid) return;
  const previous = readBookingState();
  grid.replaceChildren();
  veterinarians.forEach((veterinarian) => {
    const id = Number(veterinarian.idVeterinario);
    if (!Number.isInteger(id) || id <= 0 || typeof veterinarian.nombre !== "string"
      || typeof veterinarian.apellido !== "string") return;
    const fullName = `${veterinarian.nombre} ${veterinarian.apellido}`.trim();
    const label = document.createElement("label");
    label.className = "booking-option booking-veterinarian-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "veterinarian";
    input.value = String(id);
    const selection = document.createElement("span");
    selection.className = "booking-veterinarian-selection";
    selection.setAttribute("aria-hidden", "true");
    selection.textContent = "✓";
    const photo = document.createElement("span");
    photo.className = "booking-veterinarian-photo";
    photo.setAttribute("aria-hidden", "true");
    photo.textContent = `${veterinarian.nombre[0] || ""}${veterinarian.apellido[0] || ""}`;
    const info = document.createElement("span");
    info.className = "booking-veterinarian-info";
    const name = document.createElement("span");
    name.className = "booking-option-title";
    name.textContent = fullName;
    const specialty = document.createElement("span");
    specialty.className = "booking-option-description";
    specialty.textContent = veterinarian.especialidad || "";
    info.append(name, specialty);
    label.append(input, selection, photo, info);
    grid.append(label);
    attachRealSelection(input, {
      idVeterinario: id,
      veterinarian: fullName,
      veterinarianSpecialty: veterinarian.especialidad || "",
      createdAppointment: null,
      createdPayment: null,
      idCita: undefined
    });
  });
  const selected = grid.querySelector(`input[name="veterinarian"][value="${previous.idVeterinario}"]`);
  if (selected) {
    selected.checked = true;
    selected.closest(".booking-option")?.classList.add("is-selected");
    selected.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (previous.idVeterinario) {
    saveBookingState({ idVeterinario: undefined, veterinarian: undefined,
      veterinarianSpecialty: undefined, createdAppointment: null, createdPayment: null, idCita: undefined });
  }
  grid.hidden = grid.children.length === 0;
  updateBookingSummaries(readBookingState());
};

const loadBookingCatalog = async (endpoint, gridSelector, messageSelector, render, emptyMessage, allowPetRegistration = false) => {
  const grid = document.querySelector(gridSelector);
  const message = document.querySelector(messageSelector);
  if (!grid || !message) return;
  const token = sessionStorage.getItem("vitaVetToken");
  if (!token) {
    setBookingMessage(message, "Tu sesión no es válida.", true);
    return;
  }
  try {
    const response = await fetch(`http://localhost:8080/api/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      const errors = {
        401: "Tu sesión ya no es válida.",
        403: "No tienes permisos para consultar estos datos.",
        404: "No se encontraron los datos solicitados.",
        500: "Ocurrió un error en el servidor. Inténtalo más tarde."
      };
      setBookingMessage(message, errors[response.status] || "No se pudieron cargar los datos.", response.status === 401);
      return;
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      setBookingMessage(message, "El servidor devolvió una respuesta no válida.");
      return;
    }
    if (!data.length) {
      grid.replaceChildren();
      grid.hidden = true;
      if (allowPetRegistration) {
        message.replaceChildren(document.createTextNode(emptyMessage + " "));
        const link = document.createElement("a");
        link.href = "registro-mascota.html";
        link.textContent = "Registrar mascota";
        message.append(link);
        message.hidden = false;
      } else {
        setBookingMessage(message, emptyMessage);
      }
      return;
    }
    message.hidden = true;
    render(data);
    if (!grid.children.length) {
      grid.hidden = true;
      if (allowPetRegistration) {
        message.replaceChildren(document.createTextNode(emptyMessage + " "));
        const link = document.createElement("a");
        link.href = "registro-mascota.html";
        link.textContent = "Registrar mascota";
        message.append(link);
        message.hidden = false;
      } else {
        setBookingMessage(message, emptyMessage);
      }
      return;
    }
    message.hidden = false;
    message.textContent = "Selecciona una opción para continuar.";
  } catch {
    setBookingMessage(message, "No se pudo conectar con el servidor. Inténtalo nuevamente.");
  }
};

const bindBookingContinue = () => {
  const path = window.location.pathname;
  const rules = [
    ["/registro-cita.html", 'a[href="registro-servicio.html"]', (state) => isValidBackendId(state.idMascota)],
    ["/registro-servicio.html", 'a[href="registro-veterinario.html"]', (state) => isValidBackendId(state.idServicio)],
    ["/registro-veterinario.html", "#continueVeterinarian", (state) => isValidBackendId(state.idVeterinario)],
    ["/registro-fecha-hora.html", 'a[href="registro-pago.html"]', (state) => isValidBookingDate(state.date) && validBookingTimes.includes(state.time)]
  ];
  const rule = rules.find(([page]) => path.endsWith(page));
  if (!rule) return;
  const [page, selector, isValid] = rule;
  const button = document.querySelector(selector);
  const messageSelector = page.includes("registro-cita") ? "#petCatalogMessage"
    : page.includes("registro-servicio") ? "#serviceCatalogMessage"
      : page.includes("registro-veterinario") ? "#veterinarianCatalogMessage" : null;
  button?.addEventListener("click", (event) => {
    if (isValid(readBookingState())) return;
    event.preventDefault();
    const message = messageSelector ? document.querySelector(messageSelector) : null;
    setBookingMessage(message, "Completa la selección antes de continuar.");
  });
};

const formatApiDate = (value, fallback) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return fallback;
  return `${Number(match[3])} ${calendarMonthNames[Number(match[2]) - 1]} ${match[1]}`;
};

const formatApiTime = (value, fallback) => {
  const match = /^(\d{2}):(\d{2})/.exec(value || "");
  if (!match) return fallback;
  const hour24 = Number(match[1]);
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${match[2]} ${suffix}`;
};

const renderCreatedConfirmation = async () => {
  if (!window.location.pathname.endsWith("/registro-confirmacion.html")) return;
  const state = readBookingState();
  const section = document.querySelector(".booking-confirmation");
  const message = document.querySelector("#bookingConfirmationMessage");
  if (!section || !message) return;

  const showFailure = (text, href, linkText) => {
    section.hidden = true;
    message.replaceChildren(document.createTextNode(`${text} `));
    const link = document.createElement("a");
    link.href = href;
    link.textContent = linkText;
    message.append(link);
    message.hidden = false;
  };
  const appointmentId = Number(state.createdAppointment?.idCita);
  const paymentId = Number(state.createdPayment?.idPago);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    showFailure("No hay una cita registrada para confirmar.", "registro-cita.html", "Iniciar un registro de cita");
    return;
  }
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    showFailure(`La cita #${appointmentId} fue creada, pero el pago no está confirmado.`, "registro-pago.html", "Volver al registro del pago");
    return;
  }

  try {
    const token = sessionStorage.getItem("vitaVetToken");
    if (!token) {
      const error = new Error("Sesión inválida");
      error.status = 401;
      throw error;
    }
    const [appointment, payment, pets, services, veterinarians] = await Promise.all([
      requestBookingApi(token, `/citas/${encodeURIComponent(appointmentId)}`),
      requestBookingApi(token, `/pagos/${encodeURIComponent(paymentId)}`),
      requestBookingApi(token, "/mascotas"),
      requestBookingApi(token, "/servicios"),
      requestBookingApi(token, "/veterinarios")
    ]);
    if (!appointment || Number(appointment.idCita) !== appointmentId
      || !payment || Number(payment.idPago) !== paymentId
      || Number(payment.idCita) !== appointmentId) {
      throw new Error("La cita y el pago no coinciden.");
    }
    if (!Array.isArray(pets) || !Array.isArray(services) || !Array.isArray(veterinarians)) {
      throw new Error("No se pudieron verificar los catálogos de la cita.");
    }

    saveBookingState({ createdAppointment: appointment, createdPayment: payment });
    const pet = pets.find((item) => Number(item.idMascota) === Number(appointment.idMascota));
    const service = services.find((item) => Number(item.idServicio) === Number(appointment.idServicio));
    const veterinarian = veterinarians.find((item) => Number(item.idVeterinario) === Number(appointment.idVeterinario));
    const petName = pet?.nombre || "No disponible";
    const petDetails = pet
      ? [pet.tipo, pet.raza, pet.edad !== undefined && pet.edad !== null ? `${pet.edad} años` : ""].filter(Boolean).join(" · ") || "Mascota"
      : "No disponible";
    const date = formatApiDate(appointment.fecha, "No disponible");
    const time = formatApiTime(appointment.hora, "No disponible");
    const amount = Number(payment.monto);
    const amountLabel = Number.isFinite(amount) ? `S/ ${amount.toFixed(2)}` : "No disponible";
    const vetName = veterinarian
      ? [veterinarian.nombre, veterinarian.apellido].filter(Boolean).join(" ") || "No disponible"
      : "No disponible";
    const modalityLabels = { online: "Pagar ahora", presencial: "Pagar en la clínica" };
    const methodLabels = { tarjeta: "Tarjeta", yape: "Yape / Plin", efectivo: "Efectivo" };
    const modality = modalityLabels[String(payment.modalidad || "").toLocaleLowerCase("es")] || "No disponible";
    const method = methodLabels[String(payment.metodo || "").toLocaleLowerCase("es")] || "No disponible";

    const title = document.querySelector("#confirmation-title");
    if (title) title.textContent = "Cita registrada";
    const confirmationText = section.querySelector(".booking-confirmation-text");
    if (confirmationText) {
      confirmationText.textContent = `La cita #${appointment.idCita} de ${petName} fue registrada. El pago #${payment.idPago} figura como ${payment.estado || "No disponible"}. No se procesó ningún cobro real.`;
    }
    const petImage = section.querySelector(".booking-summary-image");
    if (petImage) {
      petImage.hidden = !pet;
      if (pet) {
        const name = String(pet.nombre || "").toLocaleLowerCase("es");
        petImage.src = `../assets/images/mascotas/${name === "snow" ? "nala.jpg" : "milo.jpg"}`;
        petImage.alt = `${petName}, ${petDetails}`;
      }
    }
    const nameElement = section.querySelector(".booking-summary-pet-name");
    if (nameElement) nameElement.textContent = petName;
    const detailsElement = section.querySelector(".booking-summary-pet-details");
    if (detailsElement) detailsElement.textContent = petDetails;
    const appointmentStatus = section.querySelector(".booking-summary-pet .confirmed");
    if (appointmentStatus) appointmentStatus.textContent = appointment.estado || "No disponible";

    const normalizeLabel = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
    const values = {
      "id de cita": String(appointment.idCita),
      servicio: service?.nombre || "No disponible",
      veterinario: vetName,
      especialidad: veterinarian?.especialidad || "No disponible",
      "fecha y hora": `${date}, ${time}`,
      "monto registrado": amountLabel,
      "modalidad de pago": modality,
      "metodo de pago": method,
      "id de pago": String(payment.idPago),
      "estado del pago": payment.estado || "No disponible"
    };
    section.querySelectorAll(".booking-summary-row").forEach((row) => {
      const label = normalizeLabel(row.querySelector(".booking-summary-label")?.textContent || "");
      const value = row.querySelector(".booking-summary-value");
      row.hidden = false;
      row.style.display = "";
      if (value && Object.prototype.hasOwnProperty.call(values, label)) value.textContent = values[label];
    });

    message.hidden = true;
    section.hidden = false;
  } catch (error) {
    const messages = {
      400: "La respuesta de confirmación no es válida.",
      401: "Tu sesión no es válida. Inicia sesión nuevamente.",
      403: "No tienes permiso para consultar esta cita o pago.",
      404: "No se encontró la cita o el pago registrado.",
      409: "La cita y el pago no coinciden.",
      500: "Ocurrió un error en el servidor al cargar la confirmación."
    };
    showFailure(messages[error.status] || "No se pudo verificar la confirmación con el servidor.", "citas.html", "Ver mis citas");
  }
};
syncBookingSelections();
bindBookingContinue();

if (window.location.pathname.endsWith("/registro-cita.html")) {
  loadBookingCatalog("mascotas", "#petOptions", "#petCatalogMessage", renderPetOptions,
    "No tienes mascotas registradas.", true);
} else if (window.location.pathname.endsWith("/registro-servicio.html")) {
  loadBookingCatalog("servicios", "#serviceOptions", "#serviceCatalogMessage", renderServiceOptions,
    "No hay servicios disponibles.");
} else if (window.location.pathname.endsWith("/registro-veterinario.html")) {
  loadBookingCatalog("veterinarios", "#veterinarianOptions", "#veterinarianCatalogMessage", renderVeterinarianOptions,
    "No hay veterinarios disponibles.");
}

renderCreatedConfirmation();
