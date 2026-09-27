/* Limpia el estado temporal al cerrar sesión y presenta perfiles de mascota. */
(() => {
  const logout = (event) => {
    event?.preventDefault();
    // Elimina la reserva y selección temporales; conserva las citas confirmadas.
    sessionStorage.removeItem("vitaVetBooking");
    sessionStorage.removeItem("vitaVetSelectedAppointment");
    window.location.href = "../index.html";
  };

  document.querySelector("#logoutButton")?.addEventListener("click", logout);
  document.querySelectorAll(".dashboard-logout-item").forEach((link) => {
    link.addEventListener("click", logout);
  });

  const profileLayout = document.querySelector(".pet-detail-layout");
  if (!profileLayout) return;

  // Usa los datos existentes de Oliver o Snow según el parámetro de la URL.
  const profiles = {
    oliver: {
      name: "Oliver",
      image: "milo.jpg",
      type: "Perro",
      breed: "Golden Retriever",
      age: "4 años",
      status: "Saludable",
      alt: "Oliver, perro Golden Retriever"
    },
    snow: {
      name: "Snow",
      image: "nala.jpg",
      type: "Gato",
      breed: "Gata Persa",
      sex: "Hembra",
      age: "2 años",
      status: "Saludable",
      alt: "Snow, gata Persa"
    }
  };
  // Selecciona el perfil indicado por ?mascota=; si falta, muestra Oliver.
  const requestedPet = new URLSearchParams(window.location.search).get("mascota")?.toLowerCase();
  const pet = profiles[requestedPet] || profiles.oliver;
  const isSnow = requestedPet === "snow";

  const title = document.querySelector(".pet-detail-intro .page-title");
  const name = document.querySelector(".pet-detail-name");
  const image = document.querySelector(".pet-detail-image");
  const summary = document.querySelector(".pet-detail-summary");
  if (title) title.textContent = `Perfil de ${pet.name}`;
  if (name) name.textContent = pet.name;
  if (image) {
    image.src = `../assets/images/mascotas/${pet.image}`;
    image.alt = pet.alt;
  }
  if (summary) summary.textContent = isSnow ? `${pet.breed} · ${pet.age}` : `${pet.type} · ${pet.breed} · ${pet.age}`;
  document.title = `Perfil de ${pet.name} | VitaVet`;

  const valuesByLabel = { Tipo: pet.type, Raza: pet.breed, Sexo: pet.sex, Edad: pet.age, Estado: pet.status };
  profileLayout.querySelectorAll(".pet-detail-data-grid > div").forEach((row) => {
    const label = row.querySelector(".pet-detail-label")?.textContent.trim();
    const value = row.querySelector(".pet-detail-value");
    if (label === "Sexo" && isSnow) row.hidden = false;
    if (value && valuesByLabel[label]) value.textContent = valuesByLabel[label];
  });

  if (!isSnow) return;

  document.querySelector(".pet-appointment-card")?.setAttribute("hidden", "");
  document.querySelector(".pet-health-section")?.setAttribute("hidden", "");
  document.querySelector(".pet-history-section")?.setAttribute("hidden", "");

  const careCards = document.querySelectorAll(".pet-care-card");
  if (careCards[0]) {
    careCards[0].querySelector(".pet-care-label").textContent = "Vacunación anual";
    careCards[0].querySelector(".pet-care-name").textContent = pet.name;
    careCards[0].querySelector(".pet-care-date").textContent = "Octubre 2026";
  }
  careCards[1]?.setAttribute("hidden", "");
})();
