const bookingStorageKey = "vitaVetBooking";

const readBookingState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(bookingStorageKey)) || {};
  } catch {
    return {};
  }
};

const saveBookingState = (updates) => {
  const nextState = { ...readBookingState(), ...updates };
  sessionStorage.setItem(bookingStorageKey, JSON.stringify(nextState));
  return nextState;
};

const syncBookingSelections = () => {
  const selectedPet = document.querySelector('input[name="pet"]:checked');
  const selectedService = document.querySelector('input[name="service"]:checked');
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  const savedVeterinarian = localStorage.getItem("selectedVeterinarian");

  const updates = {};
  if (selectedPet) updates.pet = selectedPet.value;
  if (selectedService) updates.service = selectedService.value;
  if (selectedPayment) updates.paymentMethod = selectedPayment.value;
  if (savedVeterinarian) updates.veterinarian = savedVeterinarian;

  if (document.querySelector(".booking-date-grid")) updates.date = "03 septiembre 2026";
  if (document.querySelector(".booking-time-grid")) updates.time = "05:00 PM";
  if (selectedService?.dataset.price) updates.price = selectedService.dataset.price;

  if (Object.keys(updates).length > 0) saveBookingState(updates);

  document.querySelectorAll('input[name="pet"], input[name="service"], input[name="payment"]').forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.name === "pet" ? "pet" : input.name === "service" ? "service" : "paymentMethod";
      saveBookingState({ [key]: input.value, ...(input.dataset.price ? { price: input.dataset.price } : {}) });
    });
  });
};

syncBookingSelections();
