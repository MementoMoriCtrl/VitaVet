/*
  Archivo: perfil.js
  Propósito: limpia los datos temporales al cerrar la sesión del usuario.
*/

// =====================================================
// Cierre de sesión
// =====================================================
// Obtiene el botón que inicia el cierre de sesión.
const logoutButton = document.querySelector("#logoutButton");

// Al hacer clic, elimina los datos temporales y vuelve a la página de inicio.
logoutButton.addEventListener("click", () => {
  // Borra la información de la reserva y del veterinario seleccionado.
  sessionStorage.removeItem("vitaVetBooking");
  localStorage.removeItem("selectedVeterinarian");
  // Cambia la ubicación del navegador a la página principal.
  window.location.href = "../index.html";
});
