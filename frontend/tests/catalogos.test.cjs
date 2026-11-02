const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = (name) => fs.readFileSync(path.join(__dirname, "../js", name), "utf8");

test("especialidad es texto obligatorio de máximo 100 caracteres", () => {
  const html = fs.readFileSync(path.join(__dirname, "../pages/admin.html"), "utf8");
  const input = html.match(/<input\b[^>]*name="especialidad"[^>]*>/)[0];
  assert.match(input, /type="text"/);
  assert.match(input, /maxlength="100"/);
  assert.match(input, /\brequired\b/);
  assert.doesNotMatch(html, /<select\b[^>]*name="especialidad"/);
});
class Option {
  constructor(text, value) { this.textContent = text; this.value = value; this.dataset = {}; }
}
function node() {
  return {
    value: "", disabled: false, children: [], listeners: {}, classList: { toggle() {} },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    showModal() {}, close() {}, reportValidity() { return true; }
  };
}
function cargarHelper(fetch) {
  const window = { VitaVetAuth: { getToken: () => "jwt", logout() {} } };
  const context = vm.createContext({ window, fetch, Option });
  vm.runInContext(source("catalogos.js"), context);
  return { window, context };
}

test("catálogo remoto carga opciones y selecciona el dato histórico", async () => {
  let resolver;
  const { window } = cargarHelper((url, options) => {
    assert.equal(url, "http://localhost:8080/api/catalogos/sexos");
    assert.equal(options.headers.Authorization, "Bearer jwt");
    return new Promise((resolve) => { resolver = resolve; });
  });
  const select = node();
  const pending = window.VitaVetCatalogos.cargar(select, "sexos", "No determinado");
  assert.equal(select.disabled, true);
  assert.match(select.children[0].textContent, /Cargando/);
  resolver({ ok: true, json: async () => [{ id: 25, etiqueta: "No determinado" }] });
  await pending;
  assert.equal(select.disabled, false);
  assert.equal(select.value, "No determinado");
  assert.equal(select.children[1].dataset.id, "25");
});

test("alta inicia sin selección y no inventa valores si falta un dato histórico", async () => {
  const { window } = cargarHelper(async () => ({ ok: true,
    json: async () => [{ id: 1, etiqueta: "Perro" }] }));
  const select = node();
  await window.VitaVetCatalogos.cargar(select, "tipos-animal");
  assert.equal(select.value, "");
  assert.equal(select.children[0].textContent, "Selecciona una opción");
  await assert.rejects(window.VitaVetCatalogos.cargar(select, "tipos-animal", "Histórico ausente"));
  assert.equal(select.disabled, true);
});

for (const fetch of [async () => { throw new Error("sin conexión"); },
  async () => ({ ok: false, status: 500 }), async () => ({ ok: true, json: async () => [] })]) {
  test("fallo de catálogo mantiene el select bloqueado", async () => {
    const { window } = cargarHelper(fetch);
    const select = node();
    await assert.rejects(window.VitaVetCatalogos.cargar(select, "sexos"));
    assert.equal(select.disabled, true);
    assert.match(select.children[0].textContent, /No se pudieron/);
  });
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
for (const esMascota of [true, false]) {
  test(`gestión de ${esMascota ? "mascotas" : "veterinarios"}: alta y edición conservan contrato`, async () => {
    const recurso = esMascota ? "mascotas" : "veterinarios";
    const ids = esMascota
      ? { form: "petForm", table: "petsTableBody", nuevo: "newPetButton", mensaje: "petCatalogMessage" }
      : { form: "veterinarianForm", table: "veterinariansTableBody", nuevo: "newVeterinarianButton", mensaje: "veterinarianCatalogMessage" };
    const existente = esMascota
      ? { idMascota: 1, idUsuario: 8, nombre: "Luna", tipo: "Perro", raza: "Mestiza", sexo: "Hembra", edad: 4 }
      : { idVeterinario: 1, nombre: "Ana", apellido: "Vega", especialidad: "Medicina interna", correo: "ana@example.com", telefono: "987654321" };
    const requests = [];
    const fetch = async (url, options = {}) => {
      requests.push({ url, options });
      let data;
      if (url.includes("/catalogos/")) {
        const etiqueta = url.endsWith("tipos-animal") ? "Perro" : url.endsWith("sexos") ? "Hembra" : "Medicina interna";
        data = [{ id: 1, etiqueta }];
      } else if (url.endsWith("/usuarios")) data = [{ idUsuario: 8, rol: "CLIENTE", nombre: "Cliente" }];
      else data = url.endsWith("/1") ? existente : [existente];
      return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => data };
    };
    const { window, context } = cargarHelper(fetch);
    if (!esMascota) delete window.VitaVetCatalogos;
    window.location = { search: `?seccion=${recurso}` };
    const elements = new Map();
    const select = (key) => {
      if (!elements.has(key)) elements.set(key, node());
      return elements.get(key);
    };
    const form = select(`#${ids.form}`);
    form.elements = Object.fromEntries(["nombre", "apellido", "tipo", "sexo", "raza", "edad", "idUsuario", "especialidad", "correo", "telefono"].map((key) => [key, node()]));
    form.querySelector = select;
    form.reset = () => Object.values(form.elements).forEach((input) => { input.value = ""; });
    context.document = { querySelector: select, createElement: node };
    context.URLSearchParams = URLSearchParams;
    vm.runInContext(source(`admin-${recurso}.js`), context);
    await tick();
    select(`#${ids.nuevo}`).listeners.click();
    await tick();
    assert.equal(form.querySelector('[type="submit"]').disabled, false);
    Object.entries(existente).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = String(value);
    });
    form.elements.edad.valueAsNumber = 4;
    await form.listeners.submit({ preventDefault() {} });
    assert.ok(requests.some((r) => r.options.method === "POST" && r.url.endsWith(`/${recurso}`)));
    const descendants = (item) => [item, ...(item.children || []).flatMap(descendants)];
    const edit = descendants(select(`#${ids.table}`)).find((item) => item.textContent === "Editar");
    await edit.listeners.click();
    await tick();
    assert.equal(form.elements[esMascota ? "tipo" : "especialidad"].value, esMascota ? "Perro" : "Medicina interna");
    if (!esMascota) form.elements.especialidad.value = "Texto libre fuera del catalogo";
    await form.listeners.submit({ preventDefault() {} });
    const put = requests.find((r) => r.options.method === "PUT");
    assert.ok(put.url.endsWith(`/${recurso}/1`));
    assert.equal(JSON.parse(put.options.body)[esMascota ? "sexo" : "especialidad"], esMascota ? "Hembra" : "Texto libre fuera del catalogo");
    if (!esMascota) assert.equal(requests.filter((r) => r.url.includes("/catalogos/")).length, 0);
  });
}
