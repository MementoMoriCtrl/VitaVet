const veterinarianOptions = document.querySelectorAll('input[name="veterinarian"]');
const veterinarianSummary = document.querySelector("#selectedVeterinarianSummary");

const updateSelectedVeterinarian = (selectedInput) => {
  veterinarianOptions.forEach((input) => {
    input.closest(".booking-veterinarian-option").classList.toggle("is-selected", input === selectedInput);
  });

  veterinarianSummary.textContent = selectedInput.value;
  localStorage.setItem("selectedVeterinarian", selectedInput.value);
};

const savedVeterinarian = localStorage.getItem("selectedVeterinarian");
const initialVeterinarian = Array.from(veterinarianOptions).find(
  (input) => input.value === savedVeterinarian
) || document.querySelector('input[name="veterinarian"]:checked');

initialVeterinarian.checked = true;
updateSelectedVeterinarian(initialVeterinarian);

veterinarianOptions.forEach((input) => {
  input.addEventListener("change", () => updateSelectedVeterinarian(input));
});
