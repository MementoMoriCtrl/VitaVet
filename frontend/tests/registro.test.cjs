const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(path.join(__dirname, "../js/registro.js"), "utf8");

test("placeholders exactos sin valores precargados ni nombre de usuario público", () => {
  const html = fs.readFileSync(path.join(__dirname, "../pages/registro.html"), "utf8");
  const ejemplos = {
    nombre: "Ej. Juan", apellido: "Ej. Pérez García", dni: "99999999",
    email: "ejemplo@gmail.com", phone: "987654321",
    password: "Mínimo 8 caracteres", passwordConfirmation: "Repita su contraseña"
  };
  for (const [id, placeholder] of Object.entries(ejemplos)) {
    const input = html.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`))[0];
    assert.ok(input.includes(`placeholder="${placeholder}"`));
    assert.doesNotMatch(input, /\bvalue\s*=/);
    assert.ok(html.includes(`for="${id}"`));
  }
  assert.doesNotMatch(html, /(?:id|name)="nombreUsuario"/);
});

function formulario(fetch) {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      value: "dato", checked: true, disabled: false, textContent: "", listeners: {},
      addEventListener(event, callback) { this.listeners[event] = callback; },
      setAttribute() {}, setCustomValidity() {}, focus() {},
      checkValidity() { return true; }, reportValidity() {},
      querySelector: element
    });
    return elements.get(selector);
  };
  const window = { location: { href: "registro.html" } };
  vm.runInNewContext(script, { document: { querySelector: element }, window, fetch, TextEncoder });
  element("#password").value = element("#passwordConfirmation").value = "clave-segura";
  return {
    element, window,
    submit: () => element("#registerForm").listeners.submit({ preventDefault() {} })
  };
}

test("espera la creación antes de redirigir y envía solo los campos públicos", async () => {
  let resolve;
  let sent;
  const form = formulario((url, options) => {
    sent = { url, options };
    return new Promise((done) => { resolve = done; });
  });
  const pending = form.submit();
  assert.equal(form.window.location.href, "registro.html");
  assert.equal(form.element('[type="submit"]').disabled, true);
  await form.submit(); // Un segundo clic no crea otra solicitud.
  assert.equal(sent.url, "http://localhost:8080/api/auth/registro");
  assert.equal(sent.options.method, "POST");
  assert.deepEqual(Object.keys(JSON.parse(sent.options.body)).sort(),
    ["nombre", "apellido", "dni", "correo", "telefono", "password"].sort());
  resolve({ status: 201 });
  await pending;
  assert.equal(form.window.location.href, "login.html");
  assert.equal(form.element('[type="submit"]').disabled, false);
});

for (const status of [400, 409, 500]) {
  test(`HTTP ${status} muestra error y conserva el formulario`, async () => {
    const form = formulario(async () => ({ status, json: async () => ({ message: "Revisa tus datos" }) }));
    await form.submit();
    assert.equal(form.window.location.href, "registro.html");
    assert.ok(form.element("#registerFormMessage").textContent);
    assert.equal(form.element('[type="submit"]').disabled, false);
  });
}

test("error de conexión permite volver a intentar sin redirigir", async () => {
  const form = formulario(async () => { throw new Error("Network error"); });
  await form.submit();
  assert.equal(form.window.location.href, "registro.html");
  assert.match(form.element("#registerFormMessage").textContent, /conectar/);
  assert.equal(form.element('[type="submit"]').disabled, false);
});

test("contraseñas distintas no envían la solicitud", async () => {
  const form = formulario(() => assert.fail("No debe enviar datos"));
  form.element("#passwordConfirmation").value = "otra-clave";
  await form.submit();
  assert.equal(form.window.location.href, "registro.html");
});
