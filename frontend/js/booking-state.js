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
    const previousState = readBookingState();
    const petState = previousState.petId || previousState.pet
      ? { petId: previousState.petId, pet: previousState.pet }
      : {};
    sessionStorage.setItem(bookingStorageKey, JSON.stringify(petState));
    query.set("retomar", "1");
    window.history.replaceState(null, "", `?${query.toString()}`);
  }
};

const petDetails = {
  milo: { name: "Oliver", image: "milo.jpg", description: "Perro · Golden Retriever · 4 años" },
  nala: { name: "Snow", image: "nala.jpg", description: "Gata Persa · 2 años" }
};

const veterinarianSpecialties = {
  "Dra. Valeria Torres": "Medicina General",
  "Dr. Sebastián Rojas": "Medicina Preventiva",
  "Dra. Andrea Mendoza": "Medicina Veterinaria",
  "Dr. Carlos Ramírez": "Cirugía Veterinaria"
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

const getMissingBookingStep = (state) => {
  const petId = state.petId || Object.keys(petDetails).find((id) => petDetails[id].name === state.pet);
  if (!petId || !petDetails[petId]) return { label: "la mascota", href: "registro-cita.html?retomar=1" };
  if (!state.service || !state.price) return { label: "el servicio", href: "registro-servicio.html" };
  if (!veterinarianSpecialties[state.veterinarian]) return { label: "el veterinario", href: "registro-veterinario.html" };
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
  const pet = petDetails[state.petId || state.pet];
  document.querySelectorAll(".booking-summary-pet").forEach((summary) => {
    const image = summary.querySelector(".booking-summary-image");
    const name = summary.querySelector(".booking-summary-pet-name");
    const details = summary.querySelector(".booking-summary-pet-details");
    if (image && pet) {
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = `${pet.name}, ${pet.description}`;
    }
    if (image) image.hidden = !pet;
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
      Especialidad: veterinarianSpecialties[state.veterinarian],
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
  if (paymentButton && state.price) {
    paymentButton.textContent = state.paymentType === "clinic"
      ? `Confirmar cita ${state.price}`
      : `Confirmar y pagar ${state.price}`;
  }
  const confirmationText = document.querySelector(".booking-confirmation-text");
  if (confirmationText) confirmationText.textContent = `La cita de ${pet?.name || pending} ha sido registrada correctamente.`;
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

  restoreRadio("pet", state.petId || (petDetails[state.pet] ? state.pet : Object.keys(petDetails).find((id) => petDetails[id].name === state.pet)));
  restoreRadio("service", state.service);
  if (state.paymentType) restoreRadio("paymentType", state.paymentType);

  const selectedPet = document.querySelector('input[name="pet"]:checked');
  const selectedService = document.querySelector('input[name="service"]:checked');
  const selectedPaymentType = document.querySelector('input[name="paymentType"]:checked');
  const updates = {};
  if (selectedPet) {
    updates.petId = selectedPet.value;
    updates.pet = petDetails[selectedPet.value]?.name || selectedPet.value;
  }
  if (selectedService) {
    updates.service = selectedService.value;
    if (selectedService.dataset.price) updates.price = selectedService.dataset.price;
  }
  if (selectedPaymentType) updates.paymentType = selectedPaymentType.value;

  const dateGrid = document.querySelector(".booking-date-grid");
  const timeGrid = document.querySelector(".booking-time-grid");
  if (dateGrid && !isValidBookingDate(state.date)) updates.date = undefined;
  if (timeGrid && !validBookingTimes.includes(state.time)) updates.time = undefined;
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
        state = saveBookingState({ date: button.dataset.date });
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
      reflectCalendarSelection(saveBookingState({ time: button.dataset.time }));
    });
  });
  if (dateGrid || timeGrid) reflectCalendarSelection(state);

  document.querySelectorAll('input[name="pet"], input[name="service"], input[name="paymentType"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll(`input[name="${input.name}"]`).forEach((option) => {
        option.closest(".booking-option")?.classList.toggle("is-selected", option.checked);
      });
      const key = input.name === "pet" ? "pet" : input.name === "service" ? "service" : "paymentType";
      const changed = input.name === "pet"
        ? { pet: petDetails[input.value]?.name || input.value, petId: input.value }
        : { [key]: input.value };
      if (input.name === "service" && input.dataset.price) changed.price = input.dataset.price;
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

  if (paymentMethodButtons.length || onlinePaymentSection) syncPaymentInterface(state);

  updateBookingSummaries(state);
};

syncBookingSelections();

if (window.location.pathname.endsWith("/registro-confirmacion.html")) {
  const missingStep = getMissingBookingStep(readBookingState());
  if (missingStep) {
    window.alert(`Para confirmar la cita, completa ${missingStep.label}. Te llevaremos a ese paso.`);
    window.location.replace(missingStep.href);
  }
}
