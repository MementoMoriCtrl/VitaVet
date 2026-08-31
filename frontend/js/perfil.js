const logoutButton = document.querySelector("#logoutButton");

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem("vitaVetBooking");
  localStorage.removeItem("selectedVeterinarian");
  window.location.href = "../index.html";
});
