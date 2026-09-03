/*
  Archivo: registro-veterinario.js
  Propósito: controla la selección del veterinario y la conserva
  para las siguientes etapas del registro de cita.
*/

// =====================================================
// Selección del veterinario
// =====================================================
// Obtiene todas las opciones de veterinario y el elemento donde se resume la selección.
const veterinarianOptions = document.querySelectorAll('input[name="veterinarian"]');
const veterinarianSummary = document.querySelector("#selectedVeterinarianSummary");

// Marca visualmente la opción recibida, actualiza el resumen y guarda su valor.
const updateSelectedVeterinarian = (selectedInput) => {
  // Recorre la lista de opciones y aplica la clase solo a la seleccionada.
  veterinarianOptions.forEach((input) => {
    input.closest(".booking-veterinarian-option").classList.toggle("is-selected", input === selectedInput);
  });

  veterinarianSummary.textContent = selectedInput.value;
  localStorage.setItem("selectedVeterinarian", selectedInput.value);
};

// Recupera una selección anterior o utiliza la opción marcada inicialmente en HTML.
const savedVeterinarian = localStorage.getItem("selectedVeterinarian");
const initialVeterinarian = Array.from(veterinarianOptions).find(
  (input) => input.value === savedVeterinarian
) || document.querySelector('input[name="veterinarian"]:checked');

initialVeterinarian.checked = true;
updateSelectedVeterinarian(initialVeterinarian);

// Escucha cambios de opción y actualiza el estado visible y almacenado.
veterinarianOptions.forEach((input) => {
  input.addEventListener("change", () => updateSelectedVeterinarian(input));
});
