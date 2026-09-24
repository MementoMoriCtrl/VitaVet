/* Conserva la selección del veterinario dentro del estado temporal de la cita. */
const veterinarianOptions = document.querySelectorAll('input[name="veterinarian"]');
const veterinarianSummary = document.querySelector("#selectedVeterinarianSummary");

const updateSelectedVeterinarian = (selectedInput) => {
  veterinarianOptions.forEach((input) => {
    input.closest(".booking-veterinarian-option")?.classList.toggle("is-selected", input === selectedInput);
  });
  if (veterinarianSummary) veterinarianSummary.textContent = selectedInput.value;
  updateBookingSummaries(saveBookingState({ veterinarian: selectedInput.value }));
};

const savedBooking = readBookingState();
const initialVeterinarian = Array.from(veterinarianOptions).find(
  (input) => input.value === savedBooking.veterinarian
) || null;

veterinarianOptions.forEach((input) => {
  input.checked = input === initialVeterinarian;
  input.closest(".booking-veterinarian-option")?.classList.toggle("is-selected", input.checked);
});

if (initialVeterinarian) {
  updateSelectedVeterinarian(initialVeterinarian);
}

veterinarianOptions.forEach((input) => {
  input.addEventListener("change", () => updateSelectedVeterinarian(input));
});
