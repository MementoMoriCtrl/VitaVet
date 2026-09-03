/*
  Archivo: booking-state.js
  Propósito: conserva las selecciones del flujo de registro de citas
  mientras el usuario avanza entre sus diferentes pantallas.
*/

// =====================================================
// Gestión del estado de la reserva
// =====================================================
// Constante con la clave utilizada para guardar temporalmente
// la información de la cita en sessionStorage.
const bookingStorageKey = "vitaVetBooking";

// Lee el estado guardado de la reserva y lo convierte desde JSON
// a un objeto JavaScript. Si no existe o está dañado, devuelve un objeto vacío.
const readBookingState = () => {
  try {
    return JSON.parse(sessionStorage.getItem(bookingStorageKey)) || {};
  } catch {
    return {};
  }
};

// Combina la información anterior con las nuevas selecciones recibidas
// y guarda el resultado actualizado en sessionStorage.
const saveBookingState = (updates) => {
  const nextState = { ...readBookingState(), ...updates };
  sessionStorage.setItem(bookingStorageKey, JSON.stringify(nextState));
  return nextState;
};

// =====================================================
// Sincronización de las selecciones del usuario
// =====================================================
// Busca las opciones seleccionadas en la pantalla actual y conserva
// sus valores para que estén disponibles entre las etapas de la cita.
const syncBookingSelections = () => {
  // querySelector obtiene el primer control seleccionado de cada tipo.
  const selectedPet = document.querySelector('input[name="pet"]:checked');
  const selectedService = document.querySelector('input[name="service"]:checked');
  const selectedPayment = document.querySelector('input[name="payment"]:checked');
  // El veterinario se conserva en localStorage para reutilizarlo en el flujo.
  const savedVeterinarian = localStorage.getItem("selectedVeterinarian");

  // Objeto temporal que reúne únicamente los datos disponibles en esta pantalla.
  const updates = {};
  if (selectedPet) updates.pet = selectedPet.value;
  if (selectedService) updates.service = selectedService.value;
  if (selectedPayment) updates.paymentMethod = selectedPayment.value;
  if (savedVeterinarian) updates.veterinarian = savedVeterinarian;

  if (document.querySelector(".booking-date-grid")) updates.date = "03 septiembre 2026";
  if (document.querySelector(".booking-time-grid")) updates.time = "05:00 PM";
  if (selectedService?.dataset.price) updates.price = selectedService.dataset.price;

  if (Object.keys(updates).length > 0) saveBookingState(updates);

  // Escucha cambios en las opciones y guarda la nueva selección inmediatamente.
  document.querySelectorAll('input[name="pet"], input[name="service"], input[name="payment"]').forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.name === "pet" ? "pet" : input.name === "service" ? "service" : "paymentMethod";
      saveBookingState({ [key]: input.value, ...(input.dataset.price ? { price: input.dataset.price } : {}) });
    });
  });
};

// Ejecuta la sincronización cuando se carga el archivo en la página.
syncBookingSelections();
