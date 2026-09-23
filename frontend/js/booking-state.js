/* Estado temporal compartido por las etapas del registro de citas. */
const bookingStorageKey = "vitaVetBooking";

const readBookingState = () => {
  try {
    const state = JSON.parse(sessionStorage.getItem(bookingStorageKey));
    return state && typeof state === "object" ? state : {};
  } catch {
    return {};
  }
};

const saveBookingState = (updates) => {
  const nextState = { ...readBookingState(), ...updates };
  sessionStorage.setItem(bookingStorageKey, JSON.stringify(nextState));
  return nextState;
};

const petDetails = {
  milo: { name: "Oliver", image: "milo.jpg", description: "Perro · Golden Retriever · 4 años" },
  nala: { name: "Snow", image: "nala.jpg", description: "Gato · Gato Persa · 2 años" }
};

const veterinarianSpecialties = {
  "Dra. Valeria Torres": "Medicina General",
  "Dr. Sebastián Rojas": "Medicina Preventiva",
  "Dra. Andrea Mendoza": "Medicina Veterinaria",
  "Dr. Carlos Ramírez": "Cirugía Veterinaria"
};

const readChoiceText = (choice) => {
  const day = choice.querySelector(".booking-choice-day")?.textContent.trim();
  const date = choice.querySelector(".booking-choice-date")?.textContent.trim();
  return day && date ? `${date} septiembre 2026` : choice.textContent.trim();
};

const restoreRadio = (name, value) => {
  if (!value) return;
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = input.value === value;
    input.closest(".booking-option")?.classList.toggle("is-selected", input.checked);
  });
};

const updateBookingSummaries = (state) => {
  const pet = petDetails[state.petId || state.pet] || petDetails.milo;
  document.querySelectorAll(".booking-summary-pet").forEach((summary) => {
    const image = summary.querySelector(".booking-summary-image");
    const name = summary.querySelector(".booking-summary-pet-name");
    const details = summary.querySelector(".booking-summary-pet-details");
    if (image) {
      image.src = `../assets/images/mascotas/${pet.image}`;
      image.alt = `${pet.name}, ${pet.description}`;
    }
    if (name) name.textContent = pet.name;
    if (details && summary.closest(".booking-confirmation-card")) details.textContent = pet.description;
    else if (details && state.service) details.textContent = state.service;
  });

  document.querySelectorAll(".booking-summary-row").forEach((row) => {
    const label = row.querySelector(".booking-summary-label")?.textContent.trim();
    const value = row.querySelector(".booking-summary-value");
    if (!value) return;
    const values = {
      Servicio: state.service,
      Veterinario: state.veterinarian,
      Fecha: state.date,
      Hora: state.time,
      "Fecha y hora": state.date && state.time ? `${state.date}, ${state.time}` : undefined,
      Especialidad: veterinarianSpecialties[state.veterinarian],
      "Precio estimado": state.price
    };
    if (values[label]) value.textContent = values[label];
  });

  document.querySelectorAll(".booking-summary-total span:last-child").forEach((total) => {
    if (state.price) total.textContent = state.price;
  });
  const paymentButton = document.querySelector('a[href="registro-confirmacion.html"]');
  if (paymentButton && state.price) paymentButton.textContent = `Confirmar y pagar ${state.price}`;
  const confirmationText = document.querySelector(".booking-confirmation-text");
  if (confirmationText) confirmationText.textContent = `La cita de ${pet.name} ha sido registrada correctamente.`;
};

const syncBookingSelections = () => {
  let state = readBookingState();

  // La versión anterior guardaba "on" porque los radios no tenían value explícito.
  if (state.paymentMethod === "on") state = saveBookingState({ paymentMethod: "now" });

  // Migra la clave antigua una sola vez y la elimina para mantener una fuente principal.
  const legacyVeterinarian = localStorage.getItem("selectedVeterinarian");
  if (!state.veterinarian && legacyVeterinarian) state = saveBookingState({ veterinarian: legacyVeterinarian });
  if (legacyVeterinarian) localStorage.removeItem("selectedVeterinarian");

  restoreRadio("pet", state.petId || (petDetails[state.pet] ? state.pet : Object.keys(petDetails).find((id) => petDetails[id].name === state.pet)));
  restoreRadio("service", state.service);
  restoreRadio("payment", state.paymentMethod);
  restoreRadio("paymentType", state.paymentType);

  const selectedPet = document.querySelector('input[name="pet"]:checked');
  const selectedService = document.querySelector('input[name="service"]:checked');
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
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
  if (selectedPayment) updates.paymentMethod = selectedPayment.value;
  if (selectedPaymentType) updates.paymentType = selectedPaymentType.value;

  // En esta fase se conserva la opción inicial marcada en el HTML; no se infiere
  // una selección solo por la existencia de las cuadrículas.
  if (!state.date) {
    const choice = document.querySelector(".booking-date-grid .booking-choice.is-selected");
    if (choice) updates.date = readChoiceText(choice);
  }
  if (!state.time) {
    const choice = document.querySelector(".booking-time-grid .booking-choice.is-selected");
    if (choice) updates.time = choice.textContent.trim();
  }
  const paymentTypeButtons = document.querySelectorAll(".booking-payment-method");
  if (!state.paymentType && paymentTypeButtons.length) {
    const initiallySelectedType = Array.from(paymentTypeButtons).find((button) => button.classList.contains("btn-outline"));
    if (initiallySelectedType) updates.paymentType = initiallySelectedType.textContent.trim();
  }
  if (Object.keys(updates).length) state = saveBookingState(updates);

  document.querySelectorAll('input[name="pet"], input[name="service"], input[name="payment"], input[name="paymentType"]').forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.name === "pet" ? "pet" : input.name === "service" ? "service" : input.name === "payment" ? "paymentMethod" : "paymentType";
      const changed = input.name === "pet"
        ? { pet: petDetails[input.value]?.name || input.value, petId: input.value }
        : { [key]: input.value };
      if (input.name === "service" && input.dataset.price) changed.price = input.dataset.price;
      updateBookingSummaries(saveBookingState(changed));
    });
  });

  paymentTypeButtons.forEach((button) => {
    const selected = button.textContent.trim() === state.paymentType;
    button.classList.toggle("btn-outline", selected);
    button.classList.toggle("btn-secondary", !selected);
    button.addEventListener("click", () => {
      paymentTypeButtons.forEach((option) => {
        const isSelected = option === button;
        option.classList.toggle("btn-outline", isSelected);
        option.classList.toggle("btn-secondary", !isSelected);
      });
      updateBookingSummaries(saveBookingState({ paymentType: button.textContent.trim() }));
    });
  });

  updateBookingSummaries(state);
};

syncBookingSelections();
