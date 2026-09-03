import { compileExpression, roundSignificant, truncateSignificant } from "./math-engine.js";
import { bisection, falsePosition, fixedPoint, newton, scanForRoots, secant } from "./numerical.js";
import { analyzePolynomial } from "./polynomial.js";

const app = document.querySelector("#app");
const homeTemplate = document.querySelector("#home-template");
const workspaceTemplate = document.querySelector("#workspace-template");
const state = { currentMethod: null, lastResult: null, lastTable: null, lastInput: null, code: null };

const initialOptions = [
  ["manual", "Ingresar valores manualmente"],
  ["automatic", "Estimar mediante aislamiento automático"],
];
const stopOptions = [
  ["relative", "Error relativo porcentual εₐ (%)"],
  ["absolute", "Error absoluto |xₙ₊₁ − xₙ|"],
  ["residual", "Residuo |f(xₙ₊₁)|"],
  ["combined", "Combinado: error absoluto y residuo"],
];

const methods = [
  { id: "errores", index: "01", session: "Sesión 1", family: "Fundamentos", icon: "target", title: "Teoría de errores", description: "Error verdadero, Scarborough, punto flotante, redondeo, truncamiento y estabilidad." },
  { id: "aislamiento", index: "02", session: "Sesión 2", family: "Métodos cerrados", icon: "search", title: "Aislamiento gráfico", description: "Explora una función, detecta cambios de signo y propone intervalos para sus raíces." },
  { id: "biseccion", index: "03", session: "Sesión 2", family: "Métodos cerrados", icon: "split", title: "Bisección", description: "Refina un intervalo válido y calcula la cota de iteraciones cuando corresponde." },
  { id: "falsa-posicion", index: "04", session: "Sesión 2", family: "Métodos cerrados", icon: "line", title: "Falsa posición", description: "Aplica Regula Falsi estándar o su variante modificada contra el estancamiento." },
  { id: "punto-fijo", index: "05", session: "Sesión 3", family: "Métodos abiertos", icon: "repeat", title: "Punto fijo", description: "Itera g(x), analiza |g′(x)| y permite comparar otra forma de despeje." },
  { id: "newton", index: "06", session: "Sesión 3", family: "Métodos abiertos", icon: "tangent", title: "Newton-Raphson", description: "Usa derivada ingresada o numérica, con versión estándar o para raíces múltiples." },
  { id: "secante", index: "07", session: "Sesión 3", family: "Métodos abiertos", icon: "trend", title: "Secante", description: "Aproxima la pendiente con dos puntos y vigila denominadores inestables." },
  { id: "polinomios", index: "08", session: "Sesión 4", family: "Raíces de polinomios", icon: "polynomial", title: "Müller y polinomios", description: "Descartes, Lagrange, Horner, Müller, deflación, raíces complejas y estabilidad." },
];

const methodConfigs = {
  biseccion: {
    solver: bisection, functionLabel: "Función f(x)", formula: "xᵣ = (a + b) / 2", condition: "Requiere continuidad y f(a)·f(b) < 0.",
    fields: [
      { name: "initialMode", label: "Valores iniciales", type: "select", options: initialOptions, full: true },
      { name: "a", label: "Extremo a", type: "number", step: "any", required: false }, { name: "b", label: "Extremo b", type: "number", step: "any", required: false, help: "Solo son obligatorios en modo manual." },
      { name: "criterion", label: "Criterio de parada", type: "select", options: stopOptions, full: true },
      { name: "tolerance", label: "Tolerancia", type: "number", step: "any", min: "0" }, { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000" },
    ],
    columns: [["i", "i"], ["a", "a"], ["b", "b"], ["xᵣ", "x"], ["f(xᵣ)", "fx"], ["Ancho", "intervalWidth"], ["|Δx|", "absoluteError"], ["εₐ (%)", "error"]],
  },
  "falsa-posicion": {
    solver: falsePosition, functionLabel: "Función f(x)", formula: "xᵣ = b − f(b)(a−b) / [f(a)−f(b)]", condition: "La variante modificada reduce el peso del extremo estancado.",
    fields: [
      { name: "variant", label: "Variante", type: "select", options: [["standard", "Falsa posición estándar"], ["modified", "Falsa posición modificada"]], full: true },
      { name: "initialMode", label: "Valores iniciales", type: "select", options: initialOptions, full: true },
      { name: "a", label: "Extremo a", type: "number", step: "any", required: false }, { name: "b", label: "Extremo b", type: "number", step: "any", required: false, help: "Solo son obligatorios en modo manual." },
      { name: "criterion", label: "Criterio de parada", type: "select", options: stopOptions, full: true },
      { name: "tolerance", label: "Tolerancia", type: "number", step: "any", min: "0" }, { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000" },
    ],
    columns: [["i", "i"], ["a", "a"], ["b", "b"], ["f(a)", "fa"], ["f(b)", "fb"], ["xᵣ", "x"], ["f(xᵣ)", "fx"], ["|Δx|", "absoluteError"], ["εₐ (%)", "error"]],
  },
  "punto-fijo": {
    solver: fixedPoint, functionLabel: "Función de iteración g(x)", help: "El método calcula xₙ₊₁ = g(xₙ). Usa x como variable.", formula: "xₙ₊₁ = g(xₙ)", condition: "La convergencia local requiere |g′(x)| < 1.",
    fields: [
      { name: "fExpression", label: "Función original f(x)", required: false, full: true, help: "Opcional. Si se deja vacía, se verifica con f(x)=g(x)−x." },
      { name: "alternativeExpression", label: "Otra forma g₂(x) para comparar", required: false, full: true },
      { name: "initialMode", label: "Valor inicial", type: "select", options: initialOptions, full: true },
      { name: "x0", label: "Aproximación inicial x₀", type: "number", step: "any", required: false, full: true, help: "Obligatoria solo en modo manual." },
      { name: "analysisA", label: "Intervalo de análisis a", type: "number", step: "any", required: false }, { name: "analysisB", label: "Intervalo de análisis b", type: "number", step: "any", required: false, help: "Opcional: permite comprobar g([a,b])⊂[a,b] y el máximo de |g′|." },
      { name: "criterion", label: "Criterio de parada", type: "select", options: stopOptions, full: true },
      { name: "tolerance", label: "Tolerancia", type: "number", step: "any", min: "0" },
      { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000" },
    ],
    columns: [["i", "i"], ["xₙ", "x"], ["g(xₙ)", "gx"], ["f(xₙ)", "fx"], ["g′(xₙ)", "gprime"], ["|Δx|", "absoluteError"], ["εₐ (%)", "error"]],
  },
  newton: {
    solver: newton, functionLabel: "Función f(x)", formula: "xₙ₊₁ = xₙ − m·f(xₙ)/f′(xₙ)", condition: "m=1 en Newton estándar; m>1 para una raíz múltiple conocida.",
    fields: [
      { name: "derivativeExpression", label: "Derivada f′(x)", required: false, full: true, help: "Opcional. Si se deja vacía, se estima con diferencias centrales." },
      { name: "variant", label: "Variante", type: "select", options: [["standard", "Newton-Raphson estándar"], ["modified", "Newton modificado para raíz múltiple"]], full: true },
      { name: "multiplicity", label: "Multiplicidad m", type: "number", step: "1", min: "2", max: "100", required: false, full: true, help: "Solo se usa con Newton modificado." },
      { name: "initialMode", label: "Valor inicial", type: "select", options: initialOptions, full: true },
      { name: "x0", label: "Aproximación inicial x₀", type: "number", step: "any", required: false, full: true, help: "Obligatoria solo en modo manual." },
      { name: "criterion", label: "Criterio de parada", type: "select", options: stopOptions, full: true },
      { name: "tolerance", label: "Tolerancia", type: "number", step: "any", min: "0" },
      { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000" },
    ],
    columns: [["i", "i"], ["xₙ", "x"], ["f(xₙ)", "fx"], ["f′(xₙ)", "derivative"], ["xₙ₊₁", "next"], ["|f(xₙ₊₁)|", "residual"], ["|Δx|", "absoluteError"], ["εₐ (%)", "error"]],
  },
  secante: {
    solver: secant, functionLabel: "Función f(x)", formula: "xₙ₊₁ = xₙ − f(xₙ)(xₙ−xₙ₋₁)/[f(xₙ)−f(xₙ₋₁)]", condition: "No necesita derivada, pero exige dos puntos distintos.",
    fields: [
      { name: "initialMode", label: "Valores iniciales", type: "select", options: initialOptions, full: true },
      { name: "x0", label: "Primer valor x₀", type: "number", step: "any", required: false }, { name: "x1", label: "Segundo valor x₁", type: "number", step: "any", required: false, help: "Solo son obligatorios en modo manual." },
      { name: "criterion", label: "Criterio de parada", type: "select", options: stopOptions, full: true },
      { name: "tolerance", label: "Tolerancia", type: "number", step: "any", min: "0" },
      { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000" },
    ],
    columns: [["i", "i"], ["xₙ₋₁", "x0"], ["xₙ", "x1"], ["f(xₙ₋₁)", "f0"], ["f(xₙ)", "f1"], ["xₙ₊₁", "next"], ["|f(xₙ₊₁)|", "residual"], ["|Δx|", "absoluteError"], ["εₐ (%)", "error"]],
  },
};

const errorTools = [
  { id: "basic", icon: "target", label: "Error absoluto y relativo", description: "Compara un valor medido con el valor verdadero." },
  { id: "compare", icon: "trend", label: "Comparar mediciones", description: "Decide cuál medición es más precisa usando el error relativo." },
  { id: "iterative", icon: "repeat", label: "Error iterativo", description: "Calcula εₐ entre dos aproximaciones y prueba una tolerancia." },
  { id: "scarborough", icon: "search", label: "Cifras significativas", description: "Obtén las cifras garantizadas a partir de εₐ." },
  { id: "floating", icon: "polynomial", label: "Sistema de punto flotante", description: "Normalización, cardinalidad, límites, overflow y underflow." },
  { id: "taylor", icon: "line", label: "Serie de Taylor de sen(x)", description: "Mide el error de truncamiento al limitar los términos." },
  { id: "rounding", icon: "split", label: "Redondeo y truncamiento", description: "Compara ambos procesos a una cantidad de cifras significativas." },
  { id: "cancellation", icon: "tangent", label: "Cancelación catastrófica", description: "Observa la pérdida de precisión al restar números cercanos." },
];

const errorDefaults = {
  basic: [{ name: "trueValue", label: "Valor verdadero", type: "number", step: "any" }, { name: "approxValue", label: "Valor medido", type: "number", step: "any" }],
  compare: [
    { name: "true1", label: "Valor real 1", type: "number", step: "any" }, { name: "approx1", label: "Medición 1", type: "number", step: "any" },
    { name: "true2", label: "Valor real 2", type: "number", step: "any" }, { name: "approx2", label: "Medición 2", type: "number", step: "any" },
  ],
  iterative: [
    { name: "previous", label: "Aproximación anterior x₀", type: "number", step: "any" }, { name: "current", label: "Aproximación actual x₁", type: "number", step: "any" },
    { name: "digits", label: "Cifras significativas objetivo", type: "number", step: "1", min: "1", max: "15", full: true },
  ],
  scarborough: [{ name: "knownError", label: "Error aproximado εₐ (%)", type: "number", step: "any", min: "0", full: true }],
  floating: [
    { name: "base", label: "Base β", type: "number", step: "1", min: "2", max: "36" }, { name: "digits", label: "Cifras de mantisa t", type: "number", step: "1", min: "1", max: "15" },
    { name: "lower", label: "Exponente mínimo L", type: "number", step: "1" }, { name: "upper", label: "Exponente máximo U", type: "number", step: "1" },
    { name: "testValue", label: "Número a clasificar", type: "number", step: "any", full: true, help: "Se usa la forma normalizada 0.d₁d₂…dₜ × βᵉ." },
  ],
  taylor: [{ name: "x", label: "x en radianes", type: "number", step: "any" }, { name: "terms", label: "Número de términos", type: "number", step: "1", min: "1", max: "20" }],
  rounding: [{ name: "value", label: "Número original", type: "number", step: "any" }, { name: "digits", label: "Cifras significativas", type: "number", step: "1", min: "1", max: "15" }],
  cancellation: [
    { name: "a", label: "Primer radicando a", type: "number", step: "any" }, { name: "b", label: "Segundo radicando b", type: "number", step: "any" },
    { name: "digits", label: "Cifras de la calculadora", type: "number", step: "1", min: "1", max: "15", full: true },
  ],
};

function icon(name) {
  const paths = {
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M18 6l3-3M18 3h3v3"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L21 21M3 18h5m2 0h5"/>',
    split: '<path d="M4 6h6m4 0h6M12 3v18M7 18l5 3 5-3"/>',
    line: '<path d="M3 18L20 5M4 12h16M8 9v9"/><circle cx="8" cy="12" r="2"/>',
    repeat: '<path d="M20 7h-9a5 5 0 000 10h2M4 17h9a5 5 0 000-10h-2M17 4l3 3-3 3M7 14l-3 3 3 3"/>',
    tangent: '<path d="M3 19C7 18 8 5 14 5c3 0 4 4 7 4M4 15L20 5"/><circle cx="11" cy="10" r="2"/>',
    trend: '<path d="M3 18L9 12l4 3 8-10M16 5h5v5"/>',
    polynomial: '<path d="M3 17C7 4 10 4 13 12s5 9 8-5"/><circle cx="5" cy="12" r="1.5"/><circle cx="13" cy="12" r="1.5"/><circle cx="20" cy="9" r="1.5"/>',
    home: '<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/>',
    edit: '<path d="M4 20h4l11-11-4-4L4 16v4zM13.5 6.5l4 4"/>',
    calculator: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 7h10v3H7zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><path d="M3 7l5-3 5 4 7-5"/>',
    table: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M9 5v15M15 5v15"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4V8z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16.5 8"/>',
    warning: '<path d="M12 3L2.7 20h18.6L12 3z"/><path d="M12 9v5M12 17.5h.01"/>',
    book: '<path d="M4 5.5A3.5 3.5 0 017.5 2H11v17H7.5A3.5 3.5 0 004 22V5.5zM20 5.5A3.5 3.5 0 0016.5 2H13v17h3.5A3.5 3.5 0 0120 22V5.5z"/>',
    settings: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    layers: '<path d="M12 3L3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.target}</svg>`;
}

function actionLabel(iconName, text) { return `<span class="button-icon">${icon(iconName)}</span><span>${text}</span>`; }
function stepBadge(number, iconName) { return `${icon(iconName)}<small>${number}</small>`; }
function backLink() { return `<button type="button" class="text-button" data-action="home"><span class="back-icon">${icon("home")}</span><span>Todos los métodos</span></button>`; }
function titleBlock(iconName, eyebrow, title, description) { return `<div class="method-title-row"><span class="method-hero-icon">${icon(iconName)}</span><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${description}</p></div></div>`; }
function formulaBlock(label, formula, description) { return `<span class="formula-label"><i>${icon("book")}</i>${label}</span><strong>${formula}</strong><p>${description}</p>`; }
function emptyState(text, iconName = "chart") { return `<div class="empty-state-content"><span class="empty-icon">${icon(iconName)}</span><span>${text}</span></div>`; }
function safe(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function procedureStep(number, title, formula, description) { return `<article class="procedure-step"><span>${number}</span><div><h3>${safe(title)}</h3>${formula ? `<code>${safe(formula)}</code>` : ""}<p>${safe(description)}</p></div></article>`; }
function codePanelMarkup(step = "5") { return `<div class="panel-heading code-heading"><span class="step-number">${stepBadge(step, "code")}</span><div><h2>Código reproducible</h2><p>Usa exactamente los datos que ingresaste.</p></div><div class="code-actions"><button type="button" class="language-button active" data-code-language="python">Python</button><button type="button" class="language-button" data-code-language="matlab">MATLAB</button><button type="button" class="secondary-button" data-download-code>${actionLabel("download", "Descargar")}</button></div></div><pre><code data-code-output></code></pre>`; }

function setupCodePanel(panel, codes, name, step = "5") {
  if (!panel) return;
  state.code = { ...codes, current: "python", name };
  panel.hidden = false; panel.innerHTML = codePanelMarkup(step);
  const output = panel.querySelector("[data-code-output]");
  const show = (language) => {
    state.code.current = language; output.textContent = codes[language];
    panel.querySelectorAll("[data-code-language]").forEach((button) => button.classList.toggle("active", button.dataset.codeLanguage === language));
  };
  panel.onclick = (event) => {
    const language = event.target.closest("[data-code-language]")?.dataset.codeLanguage;
    if (language) show(language);
    if (event.target.closest("[data-download-code]")) downloadCode();
  };
  show("python");
}

function downloadCode() {
  if (!state.code) return;
  const language = state.code.current; const extension = language === "python" ? "py" : "m";
  const blob = new Blob([state.code[language]], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${state.code.name}.${extension}`; anchor.click(); URL.revokeObjectURL(url);
}

function renderHome() {
  state.currentMethod = null; state.lastResult = null; state.lastInput = null; state.code = null;
  app.replaceChildren(homeTemplate.content.cloneNode(true));
  app.querySelector("#journey-strip").innerHTML = `<div><span>${icon("edit")}</span><p><b>1. Ingresa</b><small>Tu función y tus datos</small></p></div><i>${icon("chevron")}</i><div><span>${icon("calculator")}</span><p><b>2. Calcula</b><small>Con el método de clase</small></p></div><i>${icon("chevron")}</i><div><span>${icon("chart")}</span><p><b>3. Interpreta</b><small>Tablas, error y gráfica</small></p></div>`;
  const grid = app.querySelector("#method-grid");
  ["Sesión 1", "Sesión 2", "Sesión 3", "Sesión 4"].forEach((session) => {
    const section = document.createElement("section"); section.className = "session-block";
    const sessionMethods = methods.filter((method) => method.session === session);
    section.innerHTML = `<div class="session-heading"><div><i class="session-icon">${icon(sessionMethods[0].icon)}</i><span>${session}</span><h2>${sessionMethods[0].family}</h2></div><small>${sessionMethods.length} ${sessionMethods.length === 1 ? "módulo" : "módulos"}</small></div><div class="method-grid"></div>`;
    const cards = section.querySelector(".method-grid");
    sessionMethods.forEach((method) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = `method-card session-${session.at(-1)}`; button.dataset.method = method.id;
      button.innerHTML = `<div class="card-top"><span class="method-icon">${icon(method.icon)}</span><span class="card-index">${method.index}</span></div><p class="card-family">${method.family}</p><h3>${method.title}</h3><p>${method.description}</p><span class="open-label">Abrir método <b>${icon("chevron")}</b></span>`;
      cards.append(button);
    });
    grid.append(section);
  });
  history.replaceState({}, "", location.pathname); app.focus({ preventScroll: true });
}

function createField(config) {
  const wrap = document.createElement("div"); wrap.className = `field${config.full ? " full" : ""}`;
  const label = document.createElement("label"); label.htmlFor = config.name; label.textContent = config.label;
  let control;
  if (config.type === "select") {
    control = document.createElement("select");
    const placeholder = document.createElement("option"); placeholder.value = ""; placeholder.textContent = "Selecciona una opción"; placeholder.selected = true; placeholder.disabled = true;
    control.append(placeholder);
    config.options.forEach(([value, text]) => control.add(new Option(text, value)));
  } else {
    control = document.createElement("input"); control.type = config.type || "text";
    ["step", "min", "max"].forEach((key) => { if (config[key] !== undefined) control.setAttribute(key, config[key]); });
  }
  control.id = config.name; control.name = config.name; control.required = config.required !== false;
  wrap.append(label, control);
  if (config.help) { const help = document.createElement("small"); help.textContent = config.help; wrap.append(help); }
  return wrap;
}

function loadBlankForm(form, config) {
  form.replaceChildren();
  form.append(createField({ name: "expression", label: config.functionLabel, full: true, help: config.help || "Usa x como variable. Se aceptan ^, sin, cos, exp, ln, sqrt, pi y e." }));
  config.fields.forEach((item) => form.append(createField(item)));
}

function renderMethod(methodId) {
  if (methodId === "errores") return renderErrors();
  if (methodId === "aislamiento") return renderIsolation();
  if (methodId === "polinomios") return renderPolynomials();
  const method = methods.find((item) => item.id === methodId); const config = methodConfigs[methodId];
  if (!method || !config) return renderHome();
  state.currentMethod = methodId; state.lastResult = null; state.lastInput = null; state.code = null;
  app.replaceChildren(workspaceTemplate.content.cloneNode(true));
  app.querySelector("#crumb-method").textContent = method.title; app.querySelector("#method-family").textContent = method.family; app.querySelector("#method-title").textContent = method.title; app.querySelector("#method-description").textContent = method.description;
  app.querySelector("#back-icon").innerHTML = icon("home"); app.querySelector("#method-hero-icon").innerHTML = icon(method.icon);
  app.querySelector("#method-theory").innerHTML = formulaBlock("Fórmula de clase", config.formula, config.condition);
  app.querySelector('[data-step="1"]').innerHTML = stepBadge("1", "settings"); app.querySelector('[data-step="2"]').innerHTML = stepBadge("2", "chart"); app.querySelector('[data-step="3"]').innerHTML = stepBadge("3", "book"); app.querySelector('[data-step="4"]').innerHTML = stepBadge("4", "table");
  app.querySelector("#calculate-button").innerHTML = actionLabel("play", "Calcular"); app.querySelector("#download-csv").innerHTML = actionLabel("download", "Descargar CSV");
  app.querySelector("#function-chart-icon").innerHTML = icon("trend"); app.querySelector("#error-chart-icon").innerHTML = icon("chart");
  const form = app.querySelector("#method-form"); loadBlankForm(form, config);
  form.addEventListener("submit", (event) => { event.preventDefault(); runMethod(methodId); });
  app.querySelector("#download-csv").addEventListener("click", downloadCsv);
  app.querySelector("#function-chart").innerHTML = svgText(360, 160, "Completa todos los campos y presiona Calcular");
  app.querySelector("#error-chart").innerHTML = svgText(360, 130, "La convergencia aparecerá después del cálculo");
  history.replaceState({}, "", `#${methodId}`); app.focus({ preventScroll: true });
}

function readMethodParameters(form) {
  const data = {};
  [...form.elements].filter((element) => element.name).forEach((element) => {
    const value = String(element.value).trim();
    if (element.required && value === "") throw new Error("Completa los campos obligatorios antes de calcular.");
    data[element.name] = element.type === "number" ? (value === "" ? undefined : Number(value)) : value;
  });
  return data;
}

function runMethod(methodId) {
  const config = methodConfigs[methodId]; const form = app.querySelector("#method-form"); const message = app.querySelector("#form-message"); message.textContent = "";
  try {
    const input = readMethodParameters(form); const result = config.solver(input); state.lastResult = result; state.lastInput = input;
    state.lastTable = { columns: config.columns, rows: result.rows, method: methods.find((item) => item.id === methodId).title };
    renderNumericalResult(result, config); renderNumericalProcedure(methodId, result, input, config); setupCodePanel(app.querySelector("#code-panel"), generateNumericalCode(methodId, input, result), `${methodId}-calculo`); return result;
  } catch (error) {
    state.lastResult = null; app.querySelector("#download-csv").disabled = true; app.querySelector("#procedure-panel").hidden = true; app.querySelector("#code-panel").hidden = true; message.textContent = error.message; app.querySelector("#result-status").className = "result-status danger"; app.querySelector("#result-status").textContent = "No se pudo completar el cálculo."; return null;
  }
}

function renderNumericalResult(result, config) {
  const status = result.converged ? "Convergió con el criterio indicado." : "Se alcanzó el máximo de iteraciones.";
  app.querySelector("#result-status").className = `result-status ${result.converged ? "success" : "warning"}`; app.querySelector("#result-status").textContent = `${status} ${result.rows.length} iteraciones.`;
  const stopUnit = result.criterion === "relative" ? " %" : "";
  app.querySelector("#metric-row").innerHTML = `${metric("Raíz aproximada", format(result.root))}${metric("Residuo |f(x)|", format(result.residual, 6))}${metric(criterionLabel(result.criterion), result.stopValue === null ? "—" : `${format(result.stopValue, 6)}${stopUnit}`)}`;
  const initialization = app.querySelector("#initialization-note");
  initialization.innerHTML = result.initialization ? `<span>${icon("search")}</span><div><strong>Valores iniciales</strong><p>${result.initialization.message}</p></div>` : "";
  app.querySelector("#interpretation").textContent = interpretResult(result);
  app.querySelector("#error-chart-label").textContent = criterionLabel(result.criterion);
  renderTable(config.columns, result.rows); drawFunctionChart(result); drawErrorChart(result.rows); app.querySelector("#download-csv").disabled = false;
}

function renderNumericalProcedure(methodId, result, input, config) {
  const panel = app.querySelector("#procedure-panel"); const content = app.querySelector("#procedure-content"); const first = result.rows[0]; const last = result.rows.at(-1);
  let substitution = "", detail = "";
  if (methodId === "biseccion") {
    substitution = `xᵣ = (${format(first.a)} + ${format(first.b)}) / 2 = ${format(first.x)}`;
    detail = `f(a)=${format(first.fa)}, f(b)=${format(first.fb)} y f(xᵣ)=${format(first.fx)}. El signo de f(xᵣ) determina qué mitad conserva la raíz.`;
  } else if (methodId === "falsa-posicion") {
    substitution = `xᵣ = ${format(first.b)} − (${format(first.fb)})(${format(first.a)}−${format(first.b)}) / (${format(first.fa)}−${format(first.fb)}) = ${format(first.x)}`;
    detail = `La primera interpolación produce f(xᵣ)=${format(first.fx)}. Después se conserva el subintervalo con cambio de signo.`;
  } else if (methodId === "punto-fijo") {
    substitution = `x₁ = g(${format(first.x)}) = ${format(first.gx)}`;
    detail = `En el primer paso, g′(x₀)≈${format(first.gprime)} y el residuo utilizado por el método es ${format(first.residual, 7)}.`;
  } else if (methodId === "newton") {
    substitution = `x₁ = ${format(first.x)} − ${result.multiplicity}(${format(first.fx)})/${format(first.derivative)} = ${format(first.next)}`;
    detail = `Se utilizó una derivada ${result.derivativeSource}. El residuo después de la primera actualización es ${format(first.residual, 7)}.`;
  } else {
    substitution = `x₂ = ${format(first.x1)} − f(${format(first.x1)})(${format(first.x0)}−${format(first.x1)})/[f(${format(first.x0)})−f(${format(first.x1)})] = ${format(first.next)}`;
    detail = `f(x₀)=${format(first.f0)} y f(x₁)=${format(first.f1)}. La pendiente se aproxima sin calcular una derivada.`;
  }
  const unit = result.criterion === "relative" ? " %" : "";
  const stopValue = last.stopValue === null ? "no disponible en la primera iteración" : `${format(last.stopValue, 7)}${unit}`;
  content.innerHTML = procedureStep("1", "Planteamiento", `${methodId === "punto-fijo" ? "g" : "f"}(x) = ${input.expression}`, `Se aplicará ${methods.find((item) => item.id === methodId).title} con un máximo de ${input.maxIterations} iteraciones.`)
    + procedureStep("2", "Inicialización", config.formula, `${result.initialization.message} Tolerancia ingresada: ${input.tolerance}.`)
    + procedureStep("3", "Primera sustitución", substitution, detail)
    + procedureStep("4", "Criterio de parada", `${criterionLabel(result.criterion)} = ${stopValue}`, `${result.converged ? "El criterio se cumplió" : "Se agotó el máximo de iteraciones"} después de ${result.rows.length} iteraciones.`)
    + procedureStep("5", "Conclusión", `x ≈ ${format(result.root, 10)} ; |f(x)| ≈ ${format(result.residual, 7)}`, interpretResult(result));
  panel.hidden = false;
}

function codeExpression(source, language) {
  let value = String(source ?? "").trim().replaceAll("−", "-").replaceAll("×", "*").replaceAll("·", "*").replaceAll("÷", "/").replaceAll("π", "pi").replaceAll(/\bsen\s*\(/gi, "sin(").replaceAll(/\bln\s*\(/gi, "log(");
  value = value.replace(/(\d|x|\))\s*(?=x|\()/gi, "$1*");
  return language === "python" ? value.replaceAll("^", "**") : value.replaceAll("**", "^");
}

function pythonStop(criterion) {
  return ({ relative: "ea <= tol", absolute: "abs_err <= tol", residual: "residuo <= tol", combined: "abs_err <= tol and residuo <= tol" })[criterion] ?? "residuo <= tol";
}

function matlabStop(criterion) {
  return ({ relative: "ea <= tol", absolute: "abs_err <= tol", residual: "residuo <= tol", combined: "abs_err <= tol && residuo <= tol" })[criterion] ?? "residuo <= tol";
}

function generateNumericalCode(methodId, input, result) {
  const pyExpression = codeExpression(input.expression, "python"); const mlExpression = codeExpression(input.expression, "matlab");
  const pyStop = pythonStop(input.criterion); const mlStop = matlabStop(input.criterion); const first = result.rows[0];
  const pyHeader = `from math import *\n\nf = lambda x: ${pyExpression}\ntol = ${input.tolerance}\nmax_iter = ${input.maxIterations}\n`;
  const mlHeader = `f = @(x) ${mlExpression};\ntol = ${input.tolerance};\nmax_iter = ${input.maxIterations};\n`;
  let python = "", matlab = "";
  if (methodId === "biseccion") {
    python = `${pyHeader}a, b = ${first.a}, ${first.b}\nprev = None\nfor i in range(1, max_iter + 1):\n    xr = (a + b) / 2\n    residuo = abs(f(xr))\n    abs_err = inf if prev is None else abs(xr - prev)\n    ea = inf if prev is None else abs_err / max(abs(xr), 1e-15) * 100\n    print(i, a, b, xr, f(xr), ea)\n    if ${pyStop}: break\n    if f(a) * f(xr) < 0: b = xr\n    else: a = xr\n    prev = xr\nprint("Raiz =", xr, "Residuo =", residuo)\n`;
    matlab = `${mlHeader}a = ${first.a}; b = ${first.b}; prev = NaN;\nfor i = 1:max_iter\n    xr = (a+b)/2; residuo = abs(f(xr));\n    if isnan(prev), abs_err=Inf; ea=Inf; else, abs_err=abs(xr-prev); ea=abs_err/max(abs(xr),1e-15)*100; end\n    fprintf('%d  %.12g  %.12g  %.12g  %.4e\\n',i,a,b,xr,ea);\n    if ${mlStop}, break; end\n    if f(a)*f(xr)<0, b=xr; else, a=xr; end\n    prev=xr;\nend\nfprintf('Raiz = %.12g, residuo = %.4e\\n',xr,residuo);\n`;
  } else if (methodId === "falsa-posicion") {
    python = `${pyHeader}a, b = ${first.a}, ${first.b}\nprev = None\nfor i in range(1, max_iter + 1):\n    xr = b - f(b) * (a-b) / (f(a)-f(b))\n    residuo = abs(f(xr)); abs_err = inf if prev is None else abs(xr-prev)\n    ea = inf if prev is None else abs_err/max(abs(xr),1e-15)*100\n    print(i, a, b, xr, f(xr), ea)\n    if ${pyStop}: break\n    if f(a)*f(xr)<0: b=xr\n    else: a=xr\n    prev=xr\nprint("Raiz =",xr,"Residuo =",residuo)\n`;
    matlab = `${mlHeader}a=${first.a}; b=${first.b}; prev=NaN;\nfor i=1:max_iter\n    xr=b-f(b)*(a-b)/(f(a)-f(b)); residuo=abs(f(xr));\n    if isnan(prev), abs_err=Inf; ea=Inf; else, abs_err=abs(xr-prev); ea=abs_err/max(abs(xr),1e-15)*100; end\n    fprintf('%d  %.12g  %.12g  %.12g  %.4e\\n',i,a,b,xr,ea);\n    if ${mlStop}, break; end\n    if f(a)*f(xr)<0, b=xr; else, a=xr; end\n    prev=xr;\nend\nfprintf('Raiz = %.12g, residuo = %.4e\\n',xr,residuo);\n`;
  } else if (methodId === "punto-fijo") {
    const pyG = codeExpression(input.expression, "python"); const mlG = codeExpression(input.expression, "matlab"); const pyF = codeExpression(input.fExpression || `(${input.expression})-x`, "python"); const mlF = codeExpression(input.fExpression || `(${input.expression})-x`, "matlab");
    python = `from math import *\n\ng=lambda x: ${pyG}\nf=lambda x: ${pyF}\nx=${first.x}; tol=${input.tolerance}; max_iter=${input.maxIterations}\nfor i in range(1,max_iter+1):\n    xn=g(x); abs_err=abs(xn-x); ea=abs_err/max(abs(xn),1e-15)*100; residuo=abs(f(xn))\n    print(i,x,xn,residuo,ea)\n    if ${pyStop}: x=xn; break\n    x=xn\nprint("Raiz =",x,"Residuo =",abs(f(x)))\n`;
    matlab = `g=@(x) ${mlG};\nf=@(x) ${mlF};\nx=${first.x}; tol=${input.tolerance}; max_iter=${input.maxIterations};\nfor i=1:max_iter\n    xn=g(x); abs_err=abs(xn-x); ea=abs_err/max(abs(xn),1e-15)*100; residuo=abs(f(xn));\n    fprintf('%d  %.12g  %.12g  %.4e\\n',i,x,xn,ea);\n    if ${mlStop}, x=xn; break; end\n    x=xn;\nend\nfprintf('Raiz = %.12g, residuo = %.4e\\n',x,abs(f(x)));\n`;
  } else if (methodId === "newton") {
    const pyDerivative = input.derivativeExpression ? `df=lambda x: ${codeExpression(input.derivativeExpression, "python")}` : "df=lambda x: (f(x+1e-6)-f(x-1e-6))/(2e-6)";
    const mlDerivative = input.derivativeExpression ? `df=@(x) ${codeExpression(input.derivativeExpression, "matlab")};` : "df=@(x) (f(x+1e-6)-f(x-1e-6))/(2e-6);";
    python = `${pyHeader}${pyDerivative}\nx=${first.x}; m=${result.multiplicity}\nfor i in range(1,max_iter+1):\n    xn=x-m*f(x)/df(x); abs_err=abs(xn-x); ea=abs_err/max(abs(xn),1e-15)*100; residuo=abs(f(xn))\n    print(i,x,f(x),df(x),xn,ea)\n    if ${pyStop}: x=xn; break\n    x=xn\nprint("Raiz =",x,"Residuo =",abs(f(x)))\n`;
    matlab = `${mlHeader}${mlDerivative}\nx=${first.x}; m=${result.multiplicity};\nfor i=1:max_iter\n    xn=x-m*f(x)/df(x); abs_err=abs(xn-x); ea=abs_err/max(abs(xn),1e-15)*100; residuo=abs(f(xn));\n    fprintf('%d  %.12g  %.12g  %.12g  %.4e\\n',i,x,f(x),xn,ea);\n    if ${mlStop}, x=xn; break; end\n    x=xn;\nend\nfprintf('Raiz = %.12g, residuo = %.4e\\n',x,abs(f(x)));\n`;
  } else {
    python = `${pyHeader}x0, x1 = ${first.x0}, ${first.x1}\nfor i in range(1,max_iter+1):\n    x2=x1-f(x1)*(x0-x1)/(f(x0)-f(x1)); abs_err=abs(x2-x1); ea=abs_err/max(abs(x2),1e-15)*100; residuo=abs(f(x2))\n    print(i,x0,x1,x2,residuo,ea)\n    if ${pyStop}: x1=x2; break\n    x0,x1=x1,x2\nprint("Raiz =",x1,"Residuo =",abs(f(x1)))\n`;
    matlab = `${mlHeader}x0=${first.x0}; x1=${first.x1};\nfor i=1:max_iter\n    x2=x1-f(x1)*(x0-x1)/(f(x0)-f(x1)); abs_err=abs(x2-x1); ea=abs_err/max(abs(x2),1e-15)*100; residuo=abs(f(x2));\n    fprintf('%d  %.12g  %.12g  %.12g  %.4e\\n',i,x0,x1,x2,ea);\n    if ${mlStop}, x1=x2; break; end\n    x0=x1; x1=x2;\nend\nfprintf('Raiz = %.12g, residuo = %.4e\\n',x1,abs(f(x1)));\n`;
  }
  return { python, matlab };
}

function interpretResult(result) {
  const root = format(result.root, 8);
  if (result.method === "biseccion" && result.predictedIterations !== null) return `La raíz aproximada es ${root}. Con la tolerancia absoluta ingresada, la cota previa de bisección fue de ${result.predictedIterations} iteraciones; el cálculo necesitó ${result.rows.length}.`;
  if (result.method === "falsa-posicion") return `La raíz aproximada es ${root}. Se aplicó la variante ${result.variant === "modified" ? "modificada, que corrige el estancamiento de un extremo" : "estándar de Regula Falsi"}.`;
  if (result.method === "newton") return `La raíz aproximada es ${root}. Se usó Newton ${result.variant === "modified" ? `modificado con multiplicidad m=${result.multiplicity}` : "estándar"} y una derivada ${result.derivativeSource}.`;
  if (result.method === "punto-fijo") {
    let text = `La raíz aproximada es ${root}. El factor local |g′(x)| ≈ ${format(result.convergenceFactor, 5)} ${result.convergenceFactor < 1 ? "es compatible con convergencia" : "advierte una posible divergencia"}.`;
    if (result.intervalAnalysis) text += ` En [${format(result.intervalAnalysis.a)}, ${format(result.intervalAnalysis.b)}], ${result.intervalAnalysis.mapsInside ? "g conserva el intervalo" : "g sale del intervalo"} y máx|g′| ≈ ${format(result.intervalAnalysis.maxSlope, 5)}.`;
    if (result.alternativeAnalysis) text += ` Para la segunda forma ingresada, |g₂′(x)| ≈ ${format(result.alternativeAnalysis.factor, 5)}; ${result.alternativeAnalysis.factor < result.convergenceFactor ? "su factor local es menor" : "su factor local no mejora el de g₁"}.`;
    return text;
  }
  return `La raíz aproximada ${root} hace que el residuo f(x) sea ${format(result.residual, 6)}.`;
}

function criterionLabel(criterion) {
  return ({ relative: "Error relativo εₐ (%)", absolute: "Error absoluto |Δx|", residual: "Residuo |f(x)|", combined: "Máximo del criterio combinado" })[criterion] ?? "Criterio de parada";
}

function renderTable(columns, rows) {
  const table = app.querySelector("#iterations-table");
  table.innerHTML = `<thead><tr>${columns.map(([label]) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([, key]) => `<td>${key === "i" ? row[key] : format(row[key], 9)}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function format(value, digits = 9) {
  if (value === null || value === undefined) return "—"; if (!Number.isFinite(Number(value))) return "No definido";
  const number = Number(value); if (number === 0) return "0";
  if (Math.abs(number) >= 1e7 || Math.abs(number) < 1e-5) return number.toExponential(Math.max(2, digits - 3));
  return Number(number.toPrecision(digits)).toString();
}

function svgText(x, y, text, anchor = "middle") { return `<text class="chart-label" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`; }

function drawFunctionChart(result) {
  const svg = app.querySelector("#function-chart"); const fn = compileExpression(result.expression); const width = 720, height = 320, pad = 44;
  let [minX, maxX] = result.domain;
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX === maxX) { minX = result.root - 2; maxX = result.root + 2; }
  const margin = Math.max((maxX - minX) * .08, .1); minX -= margin; maxX += margin;
  const samples = [];
  for (let i = 0; i <= 260; i += 1) { const x = minX + (i / 260) * (maxX - minX); const y = fn(x); samples.push({ x, y: Number.isFinite(y) ? y : null }); }
  const finiteYs = samples.filter((point) => point.y !== null).map((point) => point.y).sort((a, b) => a - b);
  let minY = finiteYs[Math.floor(finiteYs.length * .04)] ?? -1; let maxY = finiteYs[Math.floor(finiteYs.length * .96)] ?? 1; minY = Math.min(minY, 0); maxY = Math.max(maxY, 0);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const yMargin = (maxY - minY) * .08; minY -= yMargin; maxY += yMargin;
  const sx = (x) => pad + ((x - minX) / (maxX - minX)) * (width - 2 * pad); const sy = (y) => height - pad - ((y - minY) / (maxY - minY)) * (height - 2 * pad);
  let path = "", drawing = false;
  samples.forEach((point) => {
    if (point.y === null || point.y < minY * 4 - Math.abs(maxY) || point.y > maxY * 4 + Math.abs(minY)) { drawing = false; return; }
    path += `${drawing ? "L" : "M"}${sx(point.x).toFixed(2)},${sy(Math.max(minY, Math.min(maxY, point.y))).toFixed(2)} `; drawing = true;
  });
  const xTicks = Array.from({ length: 5 }, (_, i) => minX + (i / 4) * (maxX - minX)); const yTicks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));
  const grid = [...xTicks.map((x) => `<line class="chart-grid" x1="${sx(x)}" y1="${pad}" x2="${sx(x)}" y2="${height-pad}"/>${svgText(sx(x), height - 14, format(x, 4))}`), ...yTicks.map((y) => `<line class="chart-grid" x1="${pad}" y1="${sy(y)}" x2="${width-pad}" y2="${sy(y)}"/>${svgText(pad - 7, sy(y) + 4, format(y, 4), "end")}`)].join("");
  const points = getIterationPoints(result).slice(-12).map((x) => { const y = fn(x); return Number.isFinite(y) && y >= minY && y <= maxY ? `<circle class="chart-point" cx="${sx(x)}" cy="${sy(y)}" r="4"/>` : ""; }).join("");
  svg.innerHTML = `${grid}<line class="chart-axis" x1="${pad}" y1="${sy(Math.max(minY, Math.min(maxY, 0)))}" x2="${width-pad}" y2="${sy(Math.max(minY, Math.min(maxY, 0)))}"/><line class="chart-axis" x1="${sx(Math.max(minX, Math.min(maxX, 0)))}" y1="${pad}" x2="${sx(Math.max(minX, Math.min(maxX, 0)))}" y2="${height-pad}"/><path class="chart-curve" d="${path.trim()}"/>${points}`;
  app.querySelector("#chart-range").textContent = `x: ${format(minX, 4)} a ${format(maxX, 4)}`;
}

function getIterationPoints(result) {
  if (result.method === "biseccion" || result.method === "falsa-posicion") return result.rows.map((row) => row.x);
  if (result.method === "punto-fijo") return result.rows.map((row) => row.gx);
  return result.rows.map((row) => row.next);
}

function drawErrorChart(rows, selector = "#error-chart", key = "stopValue") {
  const svg = app.querySelector(selector); const width = 720, height = 260, pad = 44;
  const points = rows.filter((row) => row[key] !== null && row[key] > 0 && Number.isFinite(row[key])).map((row) => ({ x: row.i, y: Math.log10(row[key]) }));
  if (!points.length) { svg.innerHTML = svgText(width / 2, height / 2, "No hay suficientes iteraciones para graficar el error"); return; }
  const minX = 1, maxX = Math.max(2, ...points.map((p) => p.x)); let minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const sx = (x) => pad + ((x - minX) / (maxX - minX)) * (width - 2 * pad); const sy = (y) => height - pad - ((y - minY) / (maxY - minY)) * (height - 2 * pad);
  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x)},${sy(p.y)}`).join(" "); const yTicks = Array.from({ length: 4 }, (_, i) => minY + (i / 3) * (maxY - minY));
  svg.innerHTML = `${yTicks.map((y) => `<line class="chart-grid" x1="${pad}" y1="${sy(y)}" x2="${width-pad}" y2="${sy(y)}"/>${svgText(pad-7, sy(y)+4, format(10**y, 3), "end")}`).join("")}<line class="chart-axis" x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"/><path class="error-curve" d="${path}"/>${points.map((p) => `<circle class="error-point" cx="${sx(p.x)}" cy="${sy(p.y)}" r="4"/>`).join("")}${svgText(pad, height-14, "1", "start")}${svgText(width-pad, height-14, String(maxX), "end")}`;
}

function renderIsolation() {
  state.currentMethod = "aislamiento"; state.lastResult = null; state.lastInput = null; state.code = null;
  app.innerHTML = `<section class="workspace-shell isolation-shell">
    <nav class="crumbs">${backLink()}<span>/</span><strong>Aislamiento gráfico</strong></nav>
    <div class="workspace-heading">${titleBlock("search", "Sesión 2 · método gráfico", "Aislamiento de raíces", "Evalúa la función en un rango y localiza intervalos con cambio de signo antes de aplicar un método iterativo.")}<aside class="formula-card">${formulaBlock("Teorema de Bolzano", "f(a)·f(b) &lt; 0", "Garantiza al menos una raíz si f es continua en [a,b].")}</aside></div>
    <div class="workspace-grid">
      <section class="panel controls-panel"><div class="panel-heading"><span class="step-number">${stepBadge("1", "settings")}</span><div><h2>Rango de exploración</h2><p>Todos los valores deben ser ingresados.</p></div></div><form id="isolation-form" class="field-grid"></form><div class="form-message" id="isolation-message" role="alert"></div><button type="submit" form="isolation-form" class="primary-button">${actionLabel("search", "Explorar función")}</button></section>
      <section class="panel results-panel"><div class="panel-heading"><span class="step-number">${stepBadge("2", "chart")}</span><div><h2>Intervalos encontrados</h2><p id="isolation-status">Completa los datos para comenzar.</p></div></div><div id="isolation-summary" class="empty-result">${emptyState("Aquí aparecerán los cambios de signo y posibles tangencias.", "search")}</div><div class="chart-card isolation-chart-card"><div class="chart-heading"><h3><i>${icon("chart")}</i>Gráfica y puntos evaluados</h3><span id="isolation-range"></span></div><svg id="isolation-chart" viewBox="0 0 720 340" role="img" aria-label="Gráfica para aislamiento de raíces"></svg></div></section>
    </div>
    <section class="panel procedure-panel" id="isolation-procedure" hidden><div class="panel-heading"><span class="step-number">${stepBadge("3", "book")}</span><div><h2>Desarrollo paso a paso</h2><p>Malla, evaluación, cambios de signo y conclusión.</p></div></div><div class="procedure-grid" data-procedure-content></div></section>
    <section class="panel table-panel"><div class="panel-heading table-heading"><span class="step-number">${stepBadge("4", "table")}</span><div><h2>Tabla de evaluación</h2><p>Los saltos de signo proponen intervalos para bisección o falsa posición.</p></div><button type="button" class="secondary-button" id="download-csv" disabled>${actionLabel("download", "Descargar CSV")}</button></div><div class="table-wrap"><table id="isolation-table"></table></div></section>
    <section class="panel code-panel" id="isolation-code" hidden></section>
  </section>`;
  const form = app.querySelector("#isolation-form");
  [
    { name: "expression", label: "Función f(x)", full: true, help: "Usa x como variable. Se aceptan ^, sin, cos, exp, ln, sqrt, pi y e." },
    { name: "a", label: "Inicio del rango a", type: "number", step: "any" },
    { name: "b", label: "Fin del rango b", type: "number", step: "any" },
    { name: "samples", label: "Número de divisiones", type: "number", step: "1", min: "10", max: "5000", full: true },
  ].forEach((field) => form.append(createField(field)));
  app.querySelector("#isolation-chart").innerHTML = svgText(360, 170, "La gráfica aparecerá después de explorar");
  form.addEventListener("submit", (event) => { event.preventDefault(); calculateIsolation(form); });
  app.querySelector("#download-csv").addEventListener("click", downloadCsv);
  history.replaceState({}, "", "#aislamiento"); app.focus({ preventScroll: true });
}

function calculateIsolation(form) {
  const message = app.querySelector("#isolation-message"); message.textContent = "";
  try {
    const input = readMethodParameters(form); const result = scanForRoots(input); state.lastResult = result; state.lastInput = input;
    const total = result.intervals.length + result.exactRoots.length;
    app.querySelector("#isolation-status").className = "result-status success"; app.querySelector("#isolation-status").textContent = `${total} hallazgo${total === 1 ? "" : "s"} directo${total === 1 ? "" : "s"} en el rango.`;
    const intervals = result.intervals.length ? result.intervals.map((item, index) => `<li><span>${index+1}</span><div><strong>[${format(item.a, 7)}, ${format(item.b, 7)}]</strong><small>f(a)=${format(item.fa, 5)} · f(b)=${format(item.fb, 5)}</small></div></li>`).join("") : `<li class="muted-list-item">No se detectaron cambios de signo.</li>`;
    const exact = result.exactRoots.length ? `<p class="root-chip-row">Raíces sobre la malla: ${result.exactRoots.map((value) => `<b>x=${format(value, 8)}</b>`).join("")}</p>` : "";
    const tangencies = result.tangencies.length ? `<div class="warning-note"><strong>Posibles raíces por tangencia</strong><p>${result.tangencies.map((item) => `x≈${format(item.x, 7)}`).join(", ")}. Revísalas con una malla más fina: una raíz múltiple puede no cambiar de signo.</p></div>` : "";
    app.querySelector("#isolation-summary").className = "isolation-results";
    app.querySelector("#isolation-summary").innerHTML = `<ol class="interval-list">${intervals}</ol>${exact}${tangencies}<p class="continuity-note">Un cambio de signo no basta si existe una discontinuidad o asíntota; confirma el dominio y la continuidad.</p>`;
    app.querySelector("#isolation-table").innerHTML = `<thead><tr><th>i</th><th>x</th><th>f(x)</th><th>Estado</th></tr></thead><tbody>${result.rows.map((row) => `<tr><td>${row.i}</td><td>${format(row.x, 9)}</td><td>${row.finite ? format(row.fx, 9) : "No definido"}</td><td>${row.finite ? "Evaluado" : "Fuera del dominio"}</td></tr>`).join("")}</tbody>`;
    state.lastTable = { columns: [["i", "i"], ["x", "x"], ["f(x)", "fx"]], rows: result.rows, method: "aislamiento-grafico" };
    app.querySelector("#download-csv").disabled = false;
    drawIsolationChart(result); renderIsolationProcedure(result, input); setupCodePanel(app.querySelector("#isolation-code"), generateIsolationCode(input), "aislamiento-raices");
  } catch (error) {
    message.textContent = error.message; app.querySelector("#download-csv").disabled = true; app.querySelector("#isolation-procedure").hidden = true; app.querySelector("#isolation-code").hidden = true;
  }
}

function renderIsolationProcedure(result, input) {
  const panel = app.querySelector("#isolation-procedure"); const content = panel.querySelector("[data-procedure-content]"); const step = (input.b-input.a)/input.samples; const first = result.intervals[0];
  const check = first ? `f(${format(first.a)})·f(${format(first.b)}) = ${format(first.fa)}·${format(first.fb)} = ${format(first.fa*first.fb)}` : "No apareció un producto negativo entre puntos consecutivos.";
  content.innerHTML = procedureStep("1", "Definir la malla", `Δx = (${input.b} − ${input.a}) / ${input.samples} = ${format(step, 9)}`, `Se evaluaron ${result.rows.length} puntos desde a=${input.a} hasta b=${input.b}.`)
    + procedureStep("2", "Evaluar la función", `f(x) = ${input.expression}`, "Cada punto se clasificó como evaluado o fuera del dominio antes de comparar signos.")
    + procedureStep("3", "Aplicar Bolzano", check, first ? "El producto negativo confirma al menos una raíz en ese subintervalo, suponiendo continuidad." : "No se puede garantizar una raíz por cambio de signo con esta malla.")
    + procedureStep("4", "Revisar raíces especiales", `${result.exactRoots.length} exactas en la malla · ${result.tangencies.length} posibles tangencias`, "Las raíces múltiples pueden tocar el eje sin cambiar de signo; por eso se revisan mínimos locales cercanos a cero.")
    + procedureStep("5", "Conclusión", `${result.intervals.length} intervalos con cambio de signo`, "Los intervalos encontrados pueden usarse como datos iniciales para bisección o falsa posición.");
  panel.hidden = false;
}

function generateIsolationCode(input) {
  const py = codeExpression(input.expression, "python"); const ml = codeExpression(input.expression, "matlab");
  return {
    python: `from math import *\n\nf=lambda x: ${py}\na=${input.a}; b=${input.b}; divisiones=${input.samples}\ndx=(b-a)/divisiones\nanterior=(a,f(a))\nfor i in range(1,divisiones+1):\n    x=a+i*dx; actual=(x,f(x))\n    if anterior[1]*actual[1] < 0:\n        print("Cambio de signo:",anterior[0],actual[0])\n    anterior=actual\n`,
    matlab: `f=@(x) ${ml};\na=${input.a}; b=${input.b}; divisiones=${input.samples};\ndx=(b-a)/divisiones; xa=a; fa=f(a);\nfor i=1:divisiones\n    x=a+i*dx; fx=f(x);\n    if fa*fx<0, fprintf('Cambio de signo: [%.12g, %.12g]\\n',xa,x); end\n    xa=x; fa=fx;\nend\n`,
  };
}

function drawIsolationChart(result) {
  const svg = app.querySelector("#isolation-chart"); const width = 720, height = 340, pad = 44;
  const finite = result.rows.filter((row) => row.finite);
  if (!finite.length) { svg.innerHTML = svgText(width/2, height/2, "La función no está definida en el rango"); return; }
  const sorted = finite.map((row) => row.fx).sort((a,b) => a-b);
  let minY = Math.min(0, sorted[Math.floor(sorted.length*.03)]); let maxY = Math.max(0, sorted[Math.floor(sorted.length*.97)]);
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const margin = (maxY-minY)*.08; minY -= margin; maxY += margin;
  const [minX,maxX] = result.domain; const sx = (x) => pad+(x-minX)/(maxX-minX)*(width-2*pad); const sy = (y) => height-pad-(y-minY)/(maxY-minY)*(height-2*pad);
  let path = "", drawing = false;
  result.rows.forEach((row) => { if (!row.finite || row.fx < minY || row.fx > maxY) { drawing=false; return; } path += `${drawing ? "L" : "M"}${sx(row.x)},${sy(row.fx)} `; drawing=true; });
  const marks = result.intervals.map((item) => `<rect class="root-band" x="${sx(item.a)}" y="${pad}" width="${Math.max(3,sx(item.b)-sx(item.a))}" height="${height-2*pad}"/>`).join("");
  svg.innerHTML = `${marks}<line class="chart-axis" x1="${pad}" y1="${sy(0)}" x2="${width-pad}" y2="${sy(0)}"/><line class="chart-axis" x1="${sx(Math.max(minX,Math.min(maxX,0)))}" y1="${pad}" x2="${sx(Math.max(minX,Math.min(maxX,0)))}" y2="${height-pad}"/><path class="chart-curve" d="${path.trim()}"/>${finite.filter((_,index)=>index%Math.max(1,Math.floor(finite.length/80))===0).map((row)=>`<circle class="sample-point" cx="${sx(row.x)}" cy="${sy(Math.max(minY,Math.min(maxY,row.fx)))}" r="2"/>`).join("")}`;
  app.querySelector("#isolation-range").textContent = `x: ${format(minX)} a ${format(maxX)}`;
}

function downloadCsv() {
  if (!state.lastTable) return; const { columns, rows, method } = state.lastTable;
  const lines = [columns.map(([label]) => label).join(","), ...rows.map((row) => columns.map(([, key]) => row[key] ?? "").join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${method.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-iteraciones.csv`; anchor.click(); URL.revokeObjectURL(url);
}

function renderErrors() {
  state.currentMethod = "errores"; state.lastResult = null; state.lastInput = null; state.code = null;
  app.innerHTML = `<section class="workspace-shell error-shell"><nav class="crumbs">${backLink()}<span>/</span><strong>Teoría de errores</strong></nav><div class="workspace-heading">${titleBlock("target", "Sesión 1 · fundamentos", "Teoría de errores", "Resuelve los nueve tipos de ejercicios y analiza cómo la representación finita afecta la confiabilidad numérica.")}<aside class="formula-card">${formulaBlock("Relación fundamental", "Valor verdadero = aproximado + error", "El error relativo permite comparar magnitudes de escalas distintas.")}</aside></div><div class="error-layout"><aside class="error-menu" id="error-menu" aria-label="Herramientas de errores"></aside><section class="panel error-calculator"><div class="panel-heading"><span class="step-number">${stepBadge("1", "settings")}</span><div><h2 id="error-tool-title"></h2><p id="error-tool-description"></p></div></div><form id="error-form" class="field-grid"></form><div class="form-message" id="error-message" role="alert"></div><button type="submit" form="error-form" class="primary-button">${actionLabel("play", "Calcular")}</button></section><section class="panel error-output"><div class="panel-heading"><span class="step-number">${stepBadge("2", "check")}</span><div><h2>Resultado</h2><p>Valores calculados y explicación.</p></div></div><div id="error-result" class="error-result"></div></section></div><section class="panel procedure-panel" id="error-procedure" hidden><div class="panel-heading"><span class="step-number">${stepBadge("3", "book")}</span><div><h2>Desarrollo paso a paso</h2><p>Fórmula, sustitución y lectura del resultado.</p></div></div><div class="procedure-grid" data-procedure-content></div></section><section class="panel code-panel" id="error-code" hidden></section></section>`;
  const menu = app.querySelector("#error-menu");
  errorTools.forEach((tool, index) => { const button = document.createElement("button"); button.type = "button"; button.dataset.errorTool = tool.id; button.innerHTML = `<span class="menu-icon">${icon(tool.icon)}</span><strong>${tool.label}</strong><small>${String(index + 1).padStart(2, "0")}</small>`; menu.append(button); });
  menu.addEventListener("click", (event) => { const id = event.target.closest("[data-error-tool]")?.dataset.errorTool; if (id) renderErrorTool(id); });
  history.replaceState({}, "", "#errores"); renderErrorTool("basic"); app.focus({ preventScroll: true });
}

function renderErrorTool(toolId) {
  const tool = errorTools.find((item) => item.id === toolId);
  app.querySelectorAll("[data-error-tool]").forEach((button) => button.classList.toggle("active", button.dataset.errorTool === toolId));
  app.querySelector("#error-tool-title").textContent = tool.label; app.querySelector("#error-tool-description").textContent = tool.description;
  const form = app.querySelector("#error-form"); form.replaceChildren(); errorDefaults[toolId].forEach((item) => form.append(createField(item)));
  form.onsubmit = (event) => { event.preventDefault(); calculateErrorTool(toolId, new FormData(form)); };
  app.querySelector("#error-message").textContent = "";
  app.querySelector("#error-result").innerHTML = `<div class="empty-result">${emptyState("Completa todos los campos para ver el resultado.", "calculator")}</div>`;
  app.querySelector("#error-procedure").hidden = true; app.querySelector("#error-code").hidden = true; state.code = null;
}

function metric(label, value) { return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`; }

function floatingApproximation(value, base, digits, mode) {
  if (value === 0) return { value: 0, exponent: 0, mantissa: "0".repeat(digits), representation: `0.${"0".repeat(digits)} × ${base}^0` };
  const sign = Math.sign(value); const magnitude = Math.abs(value);
  let exponent = Math.floor(Math.log(magnitude) / Math.log(base)) + 1;
  const scale = base**(digits - exponent);
  let integer = mode === "round" ? Math.round(magnitude * scale) : Math.floor(magnitude * scale + Number.EPSILON);
  if (integer >= base**digits) { integer = Math.floor(integer/base); exponent += 1; }
  const approximated = sign * integer / base**(digits - exponent);
  const mantissa = integer.toString(base).toUpperCase().padStart(digits, "0");
  return { value: approximated, exponent, mantissa, representation: `${sign < 0 ? "−" : ""}0.${mantissa} × ${base}^${exponent}` };
}

function calculateErrorTool(toolId, formData) {
  const entries = [...formData];
  const output = app.querySelector("#error-result"); const message = app.querySelector("#error-message"); message.textContent = "";
  try {
    if (entries.some(([, value]) => String(value).trim() === "")) throw new Error("Completa todos los campos antes de calcular.");
    const data = Object.fromEntries(entries.map(([key, value]) => [key, Number(value)]));
    let metrics = "", explanation = "", table = "";
    if (toolId === "basic") {
      const trueError = data.trueValue - data.approxValue; const absolute = Math.abs(trueError); const relative = data.trueValue === 0 ? null : absolute / Math.abs(data.trueValue) * 100;
      metrics = metric("Error verdadero Eₜ", format(trueError)) + metric("|Error absoluto|", format(absolute)) + metric("Error relativo", relative === null ? "No definido" : `${format(relative)} %`);
      explanation = "Eₜ conserva el signo de valor verdadero − valor aproximado; su magnitud es el error absoluto. El error relativo lo compara con la escala del valor verdadero.";
    } else if (toolId === "compare") {
      const rows = [["Medición 1", data.true1, data.approx1], ["Medición 2", data.true2, data.approx2]].map(([name, truth, approx]) => ({ name, absolute: Math.abs(truth-approx), relative: truth === 0 ? null : Math.abs(truth-approx)/Math.abs(truth)*100 }));
      table = `<div class="table-wrap"><table><thead><tr><th>Medición</th><th>Error absoluto</th><th>Error relativo</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.name}</td><td>${format(row.absolute)}</td><td>${row.relative === null ? "No definido" : `${format(row.relative)} %`}</td></tr>`).join("")}</tbody></table></div>`;
      const comparable = rows.every((row) => row.relative !== null); explanation = comparable ? `${rows[0].relative < rows[1].relative ? "La medición 1" : "La medición 2"} es más precisa en términos relativos. El error relativo permite comparar escalas y unidades diferentes.` : "No se puede comparar el error relativo cuando un valor verdadero es cero.";
    } else if (toolId === "iterative") {
      if (data.current === 0) throw new Error("La aproximación actual debe ser distinta de cero para usar el error relativo porcentual.");
      const error = Math.abs((data.current-data.previous)/data.current)*100; const tolerance = .5 * 10 ** (2-data.digits);
      metrics = metric("εₐ", `${format(error)} %`) + metric(`εₛ para ${data.digits} cifras`, `${format(tolerance)} %`) + metric("¿Cumple?", error <= tolerance ? "Sí" : "No");
      explanation = `El criterio de Scarborough exige εₐ ≤ εₛ. En este caso ${format(error)} % ${error <= tolerance ? "sí" : "no"} está dentro del límite.`;
    } else if (toolId === "scarborough") {
      if (data.knownError <= 0) throw new Error("El error debe ser mayor que cero."); const digits = Math.max(0, Math.floor(2-Math.log10(data.knownError/.5) + 1e-12)); const nextTolerance = .5 * 10 ** (2-(digits+1));
      metrics = metric("Cifras garantizadas", String(digits)) + metric(`Límite para ${digits+1} cifras`, `${format(nextTolerance)} %`); explanation = `Con εₐ = ${format(data.knownError)} %, se garantizan ${digits} cifras significativas; no alcanza el límite más estricto necesario para ${digits+1}.`;
    } else if (toolId === "floating") {
      const beta = data.base, t = data.digits, lower = data.lower, upper = data.upper;
      if (!Number.isInteger(beta) || beta < 2 || beta > 36 || !Number.isInteger(t) || t < 1 || t > 15 || !Number.isInteger(lower) || !Number.isInteger(upper) || lower > upper) throw new Error("Usa una base entera entre 2 y 36, una mantisa entre 1 y 15 cifras y exponentes válidos.");
      const max = (1-beta**(-t))*beta**upper; const min = beta**(lower-1); const cardinality = 2*(beta-1)*beta**(t-1)*(upper-lower+1)+1; const absValue = Math.abs(data.testValue);
      const classification = absValue === 0 ? "Cero representable" : absValue > max ? "Overflow" : absValue < min ? "Underflow" : "Dentro del rango";
      const truncated = floatingApproximation(data.testValue, beta, t, "truncate"); const rounded = floatingApproximation(data.testValue, beta, t, "round");
      const truncError = data.testValue === 0 ? 0 : Math.abs((data.testValue-truncated.value)/data.testValue)*100; const roundError = data.testValue === 0 ? 0 : Math.abs((data.testValue-rounded.value)/data.testValue)*100;
      metrics = metric("Mayor positivo", format(max)) + metric("Menor positivo", format(min)) + metric("Cardinalidad", format(cardinality)) + metric("Clasificación", classification);
      table = `<div class="floating-representations"><div><span>Truncamiento</span><strong>${truncated.representation}</strong><small>${format(truncated.value)} · error ${format(truncError,6)} %</small></div><div><span>Redondeo</span><strong>${rounded.representation}</strong><small>${format(rounded.value)} · error ${format(roundError,6)} %</small></div></div>`;
      explanation = "Se aplicó la convención normalizada 0.d₁d₂…dₜ × βᵉ. Los límites usan el exponente ingresado; todo valor no nulo menor que el mínimo produce underflow y todo valor mayor que el máximo produce overflow.";
    } else if (toolId === "taylor") {
      if (!Number.isInteger(data.terms) || data.terms < 1 || data.terms > 20) throw new Error("Usa entre 1 y 20 términos."); let approximation = 0, factorial = 1;
      for (let k=0; k<data.terms; k+=1) { if (k > 0) factorial *= (2*k)*(2*k+1); approximation += (-1)**k * data.x**(2*k+1) / factorial; }
      const truth = Math.sin(data.x); const absolute = Math.abs(truth-approximation);
      metrics = metric("Aproximación", format(approximation)) + metric("sen(x) real", format(truth)) + metric("Error de truncamiento", format(absolute)); explanation = `La aproximación conserva ${data.terms} término${data.terms === 1 ? "" : "s"} no nulo${data.terms === 1 ? "" : "s"} de la serie de Taylor.`;
    } else if (toolId === "rounding") {
      if (!Number.isInteger(data.digits) || data.digits < 1 || data.digits > 15) throw new Error("Usa entre 1 y 15 cifras significativas."); const rounded = roundSignificant(data.value, data.digits); const truncated = truncateSignificant(data.value, data.digits);
      const roundError = data.value === 0 ? 0 : Math.abs((data.value-rounded)/data.value)*100; const truncError = data.value === 0 ? 0 : Math.abs((data.value-truncated)/data.value)*100;
      metrics = metric("Redondeado", format(rounded)) + metric("Truncado", format(truncated)) + metric("ER redondeo", `${format(roundError)} %`) + metric("ER truncamiento", `${format(truncError)} %`);
      explanation = roundError <= .5*truncError + Number.EPSILON ? "En este caso se verifica |ER redondeo| ≤ 0.5 × |ER truncamiento|." : "Para estos datos la relación propuesta no se cumple exactamente; sí se observa cuál procedimiento produce el menor error.";
    } else if (toolId === "cancellation") {
      if (data.a < 0 || data.b < 0) throw new Error("Los radicandos deben ser no negativos."); if (!Number.isInteger(data.digits) || data.digits < 1 || data.digits > 15) throw new Error("Usa entre 1 y 15 cifras significativas.");
      const exact = Math.sqrt(data.a)-Math.sqrt(data.b); const ra = roundSignificant(Math.sqrt(data.a), data.digits); const rb = roundSignificant(Math.sqrt(data.b), data.digits); const naive = ra-rb; const stable = (data.a-data.b)/(Math.sqrt(data.a)+Math.sqrt(data.b)); const relative = exact === 0 ? null : Math.abs((exact-naive)/exact)*100;
      metrics = metric("Resta con raíces redondeadas", format(naive)) + metric("Resultado estable", format(stable)) + metric("Error relativo", relative === null ? "No definido" : `${format(relative)} %`); explanation = "Al restar raíces casi iguales se cancelan cifras útiles. La forma racionalizada (a-b)/(√a+√b) evita esa pérdida de precisión.";
    }
    output.innerHTML = `<div class="metric-row error-metrics">${metrics}</div>${table}<div class="explanation">${explanation}</div>`; state.lastResult = { tool: toolId, summary: explanation }; state.lastInput = data;
    renderErrorProcedure(toolId, data, explanation); setupCodePanel(app.querySelector("#error-code"), generateErrorCode(toolId, data), `${toolId}-errores`, "4");
  } catch (error) { message.textContent = error.message; output.innerHTML = `<div class="empty-result">${emptyState("Corrige los datos para ver el resultado.", "warning")}</div>`; app.querySelector("#error-procedure").hidden = true; app.querySelector("#error-code").hidden = true; }
}

function errorProcedureData(toolId, data) {
  if (toolId === "basic") return { formula: "Eₜ = valor verdadero − valor aproximado; Eᵣ = |Eₜ/valor verdadero|·100", substitution: `Eₜ = ${data.trueValue} − ${data.approxValue} = ${format(data.trueValue-data.approxValue)}`, check: `|Eₜ|=${format(Math.abs(data.trueValue-data.approxValue))}` };
  if (toolId === "compare") return { formula: "Eᵣ = |verdadero − aproximado| / |verdadero| · 100", substitution: `Eᵣ₁=${format(Math.abs(data.true1-data.approx1)/Math.abs(data.true1)*100)} %; Eᵣ₂=${format(Math.abs(data.true2-data.approx2)/Math.abs(data.true2)*100)} %`, check: "La medición con menor error relativo es la más precisa." };
  if (toolId === "iterative") return { formula: "εₐ = |(x actual − x anterior)/x actual|·100; εₛ=0.5·10^(2−n)", substitution: `εₐ=|(${data.current}−${data.previous})/${data.current}|·100=${format(Math.abs((data.current-data.previous)/data.current)*100)} %`, check: `Se compara con εₛ=${format(.5*10**(2-data.digits))} %.` };
  if (toolId === "scarborough") return { formula: "εₛ = 0.5·10^(2−n) %", substitution: `Con εₐ=${data.knownError} %, se despeja el mayor entero n que satisface εₐ≤εₛ.`, check: "El resultado indica las cifras significativas garantizadas." };
  if (toolId === "floating") return { formula: "xmax=(1−β^(−t))β^U; xmin=β^(L−1); N=2(β−1)β^(t−1)(U−L+1)+1", substitution: `β=${data.base}, t=${data.digits}, L=${data.lower}, U=${data.upper}`, check: `El número ${data.testValue} se compara con el intervalo representable.` };
  if (toolId === "taylor") return { formula: "sen(x) ≈ Σ (-1)^k x^(2k+1)/(2k+1)!", substitution: `x=${data.x}; se conservan ${data.terms} términos no nulos.`, check: "El error de truncamiento es |sen(x) real − aproximación|." };
  if (toolId === "rounding") return { formula: "Redondeo: observa la siguiente cifra; truncamiento: elimina las restantes", substitution: `Se conservan ${data.digits} cifras significativas de ${data.value}.`, check: "Se calcula el error relativo producido por cada procedimiento." };
  return { formula: "√a−√b = (a−b)/(√a+√b)", substitution: `√${data.a}−√${data.b}; cálculo con ${data.digits} cifras significativas.`, check: "La forma racionalizada evita la cancelación de cifras cercanas." };
}

function renderErrorProcedure(toolId, data, explanation) {
  const panel = app.querySelector("#error-procedure"); const details = errorProcedureData(toolId, data);
  panel.querySelector("[data-procedure-content]").innerHTML = procedureStep("1", "Datos ingresados", Object.entries(data).map(([key, value]) => `${key}=${value}`).join("; "), "El programa utiliza únicamente los valores escritos en el formulario.")
    + procedureStep("2", "Fórmula aplicada", details.formula, "Esta es la relación usada para resolver el ejercicio.")
    + procedureStep("3", "Sustitución", details.substitution, details.check)
    + procedureStep("4", "Interpretación", "Resultado calculado", explanation);
  panel.hidden = false;
}

function generateErrorCode(toolId, data) {
  let python = "from math import *\n\n", matlab = "";
  if (toolId === "basic") {
    python += `verdadero=${data.trueValue}; aproximado=${data.approxValue}\net=verdadero-aproximado\nea=abs(et)\ner=ea/abs(verdadero)*100 if verdadero!=0 else float('nan')\nprint(et,ea,er)\n`;
    matlab = `verdadero=${data.trueValue}; aproximado=${data.approxValue};\net=verdadero-aproximado; ea=abs(et); er=ea/abs(verdadero)*100;\nfprintf('Et=%g, Ea=%g, Er=%g%%\\n',et,ea,er);\n`;
  } else if (toolId === "compare") {
    python += `datos=[(${data.true1},${data.approx1}),(${data.true2},${data.approx2})]\nfor i,(v,a) in enumerate(datos,1):\n    print(i,abs(v-a),abs(v-a)/abs(v)*100)\n`;
    matlab = `v=[${data.true1},${data.true2}]; a=[${data.approx1},${data.approx2}];\nea=abs(v-a); er=ea./abs(v)*100; disp([ea' er']);\n`;
  } else if (toolId === "iterative") {
    python += `anterior=${data.previous}; actual=${data.current}; n=${data.digits}\nea=abs((actual-anterior)/actual)*100\nes=0.5*10**(2-n)\nprint(ea,es,ea<=es)\n`;
    matlab = `anterior=${data.previous}; actual=${data.current}; n=${data.digits};\nea=abs((actual-anterior)/actual)*100; es=0.5*10^(2-n); disp([ea es ea<=es]);\n`;
  } else if (toolId === "scarborough") {
    python += `ea=${data.knownError}\nn=max(0,int(2-log10(ea/0.5)+1e-12))\nprint("Cifras garantizadas =",n)\n`;
    matlab = `ea=${data.knownError}; n=max(0,floor(2-log10(ea/0.5)+1e-12)); fprintf('Cifras garantizadas = %d\\n',n);\n`;
  } else if (toolId === "floating") {
    python += `beta=${data.base}; t=${data.digits}; L=${data.lower}; U=${data.upper}; x=${data.testValue}\nxmax=(1-beta**(-t))*beta**U\nxmin=beta**(L-1)\nN=2*(beta-1)*beta**(t-1)*(U-L+1)+1\nestado="overflow" if abs(x)>xmax else "underflow" if 0<abs(x)<xmin else "representable"\nprint(xmin,xmax,N,estado)\n`;
    matlab = `beta=${data.base}; t=${data.digits}; L=${data.lower}; U=${data.upper}; x=${data.testValue};\nxmax=(1-beta^(-t))*beta^U; xmin=beta^(L-1); N=2*(beta-1)*beta^(t-1)*(U-L+1)+1;\nfprintf('xmin=%g, xmax=%g, N=%g\\n',xmin,xmax,N);\n`;
  } else if (toolId === "taylor") {
    python += `x=${data.x}; terminos=${data.terms}\naprox=sum((-1)**k*x**(2*k+1)/factorial(2*k+1) for k in range(terminos))\nprint(aprox,sin(x),abs(sin(x)-aprox))\n`;
    matlab = `x=${data.x}; terminos=${data.terms}; aprox=0;\nfor k=0:terminos-1, aprox=aprox+(-1)^k*x^(2*k+1)/factorial(2*k+1); end\nfprintf('Aproximacion=%g, error=%g\\n',aprox,abs(sin(x)-aprox));\n`;
  } else if (toolId === "rounding") {
    python += `x=${data.value}; n=${data.digits}\nescala=10**(n-1-floor(log10(abs(x)))) if x!=0 else 1\nredondeado=round(x*escala)/escala\ntruncado=trunc(x*escala)/escala\nprint(redondeado,truncado)\n`;
    matlab = `x=${data.value}; n=${data.digits}; escala=10^(n-1-floor(log10(abs(x))));\nredondeado=round(x*escala)/escala; truncado=fix(x*escala)/escala; disp([redondeado truncado]);\n`;
  } else {
    python += `a=${data.a}; b=${data.b}; n=${data.digits}\nforma_directa=sqrt(a)-sqrt(b)\nforma_estable=(a-b)/(sqrt(a)+sqrt(b))\nprint(forma_directa,forma_estable)\n`;
    matlab = `a=${data.a}; b=${data.b}; n=${data.digits};\nforma_directa=sqrt(a)-sqrt(b); forma_estable=(a-b)/(sqrt(a)+sqrt(b)); disp([forma_directa forma_estable]);\n`;
  }
  return { python, matlab };
}

function renderPolynomials() {
  state.currentMethod = "polinomios"; state.lastResult = null; state.lastInput = null; state.code = null;
  app.innerHTML = `<section class="workspace-shell polynomial-shell">
    <nav class="crumbs">${backLink()}<span>/</span><strong>Raíces de polinomios</strong></nav>
    <div class="workspace-heading">${titleBlock("polynomial", "Sesión 4 · raíces polinomiales", "Müller y polinomios", "Aplica métodos convencionales y Müller con deflación, incluyendo raíces complejas y estabilidad en el círculo unitario.")}<aside class="formula-card">${formulaBlock("Método de Müller", "Interpolación cuadrática con z₀, z₁ y z₂", "Si faltan puntos, las cotas de Lagrange y Cauchy delimitan la búsqueda.")}</aside></div>
    <div class="polynomial-input-grid">
      <section class="panel controls-panel"><div class="panel-heading"><span class="step-number">${stepBadge("1", "settings")}</span><div><h2>Datos del polinomio</h2><p>No hay valores precargados.</p></div></div><form id="polynomial-form" class="field-grid"></form><div class="form-message" id="polynomial-message" role="alert"></div><button type="submit" form="polynomial-form" class="primary-button">${actionLabel("play", "Analizar y calcular raíces")}</button></section>
      <section class="panel polynomial-summary"><div class="panel-heading"><span class="step-number">${stepBadge("2", "search")}</span><div><h2>Análisis previo</h2><p>Descartes, cotas e inicialización.</p></div></div><div id="polynomial-theory" class="empty-result">${emptyState("Completa los datos para ver el análisis.", "search")}</div></section>
    </div>
    <section class="panel procedure-panel" id="polynomial-procedure" hidden><div class="panel-heading"><span class="step-number">${stepBadge("3", "book")}</span><div><h2>Desarrollo completo</h2><p>Descartes, cotas, primera iteración y cada deflación.</p></div></div><div class="procedure-grid" data-procedure-content></div><div class="deflation-grid" data-deflation-content></div></section>
    <section class="panel polynomial-roots"><div class="panel-heading"><span class="step-number">${stepBadge("4", "layers")}</span><div><h2>Raíces y deflación</h2><p>Horner verifica el residuo y la deflación de cada raíz.</p></div></div><div id="polynomial-roots" class="empty-result">${emptyState("Las raíces aparecerán después del cálculo.", "polynomial")}</div></section>
    <div class="polynomial-charts">
      <section class="panel chart-panel"><div class="panel-heading"><span class="step-number">${stepBadge("5", "target")}</span><div><h2>Plano complejo</h2><p>El círculo unitario permite evaluar la estabilidad.</p></div></div><div class="chart-card"><svg id="complex-chart" viewBox="0 0 620 420" role="img" aria-label="Raíces en el plano complejo"></svg></div></section>
      <section class="panel chart-panel"><div class="panel-heading"><span class="step-number">${stepBadge("6", "chart")}</span><div><h2>Convergencia de Müller</h2><p>Error relativo estimado por iteración.</p></div></div><div class="chart-card"><svg id="poly-error-chart" viewBox="0 0 720 260" role="img" aria-label="Convergencia de Müller"></svg></div></section>
    </div>
    <section class="panel table-panel"><div class="panel-heading"><span class="step-number">${stepBadge("7", "table")}</span><div><h2>Iteraciones de Müller y deflación</h2><p>Cada etapa reduce el grado del polinomio hasta obtener todas las raíces.</p></div></div><div class="table-wrap"><table id="muller-table"></table></div></section>
    <section class="panel code-panel" id="polynomial-code" hidden></section>
  </section>`;
  const form = app.querySelector("#polynomial-form");
  [
    { name: "coefficients", label: "Coeficientes", full: true, help: "Escríbelos de mayor a menor grado, separados por comas. Ejemplo de formato: aₙ, aₙ₋₁, …, a₀" },
    { name: "initialMode", label: "Puntos iniciales", type: "select", options: [["manual", "Ingresar z₀, z₁ y z₂ manualmente"], ["lagrange", "Generar con cotas de Lagrange/Cauchy"]], full: true },
    { name: "z0", label: "Punto inicial z₀", type: "number", step: "any", required: false },
    { name: "z1", label: "Punto inicial z₁", type: "number", step: "any", required: false },
    { name: "z2", label: "Punto inicial z₂", type: "number", step: "any", required: false, help: "Solo son obligatorios en modo manual." },
    { name: "tolerance", label: "Tolerancia ε", type: "number", step: "any", min: "0" },
    { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "1000", full: true },
  ].forEach((field) => form.append(createField(field)));
  app.querySelector("#complex-chart").innerHTML = svgText(310, 210, "Completa los datos para ubicar las raíces");
  app.querySelector("#poly-error-chart").innerHTML = svgText(360, 130, "La convergencia aparecerá después del cálculo");
  form.addEventListener("submit", (event) => { event.preventDefault(); calculatePolynomial(new FormData(form)); });
  history.replaceState({}, "", "#polinomios"); app.focus({ preventScroll: true });
}

function calculatePolynomial(formData) {
  const message = app.querySelector("#polynomial-message"); message.textContent = "";
  try {
    const form = app.querySelector("#polynomial-form");
    const input = readMethodParameters(form);
    const result = analyzePolynomial(input); state.lastResult = result; state.lastInput = input; renderPolynomialResult(result); renderPolynomialProcedure(result, input); setupCodePanel(app.querySelector("#polynomial-code"), generatePolynomialCode(input, result), "muller-polinomio", "8"); return result;
  } catch (error) {
    state.lastResult = null; message.textContent = error.message;
    app.querySelector("#polynomial-theory").className = "empty-result"; app.querySelector("#polynomial-theory").innerHTML = emptyState("Corrige los datos para ver el análisis.", "warning");
    app.querySelector("#polynomial-procedure").hidden = true; app.querySelector("#polynomial-code").hidden = true; app.querySelector("#polynomial-roots").className = "empty-result"; app.querySelector("#polynomial-roots").innerHTML = emptyState("Corrige los datos para volver a calcular.", "warning");
    return null;
  }
}

function formatComplex(value, digits = 8) {
  const real = Math.abs(value.re) < 1e-12 ? 0 : value.re; const imaginary = Math.abs(value.im) < 1e-12 ? 0 : value.im;
  if (imaginary === 0) return format(real, digits);
  if (real === 0) return `${format(imaginary, digits)}i`;
  return `${format(real, digits)} ${imaginary >= 0 ? "+" : "-"} ${format(Math.abs(imaginary), digits)}i`;
}

function polynomialText(coefficients, variable = "z") {
  const degree = coefficients.length-1; const terms = [];
  coefficients.forEach((coefficient, index) => {
    const value = Number(coefficient); if (value === 0) return; const power = degree-index; const magnitude = Math.abs(value); const body = power === 0 ? `${magnitude}` : power === 1 ? `${magnitude === 1 ? "" : magnitude}${variable}` : `${magnitude === 1 ? "" : magnitude}${variable}^${power}`;
    terms.push(`${terms.length ? (value < 0 ? " − " : " + ") : (value < 0 ? "−" : "")}${body}`);
  });
  return terms.join("") || "0";
}

function signSequence(coefficients) { return coefficients.filter((value) => value !== 0).map((value) => value > 0 ? "+" : "−").join(" → "); }
function complexCoefficientList(coefficients) { return coefficients.map((value) => formatComplex(value, 9)).join(", "); }

function renderPolynomialProcedure(result, input) {
  const panel = app.querySelector("#polynomial-procedure"); const content = panel.querySelector("[data-procedure-content]"); const coefficients = result.coefficients; const degree = result.degree;
  const negative = coefficients.map((value, index) => value*((degree-index)%2 ? -1 : 1)); const firstStage = result.stages[0]; const firstRow = firstStage?.rows?.[0];
  const firstFormula = firstRow ? `z₃=${formatComplex(firstRow.next)}; εₐ=${format(firstRow.error*100, 7)} %; |D(z₃)|=${format(firstRow.residual, 7)}` : `Primera raíz: ${formatComplex(result.roots[0].root)}`;
  const firstDescription = firstRow ? `Se partió de z₀=${formatComplex(firstRow.z0)}, z₁=${formatComplex(firstRow.z1)} y z₂=${formatComplex(firstRow.z2)}.` : `La etapa se resolvió mediante ${firstStage?.method ?? "solución directa"}.`;
  content.innerHTML = procedureStep("1", "Criterio de Descartes en D(z)", `D(z)=${polynomialText(coefficients)}; signos: ${signSequence(coefficients)}`, `${result.descartes.positiveVariations} variaciones: raíces reales positivas posibles = ${result.descartes.positiveCounts.join(" o ")}.`)
    + procedureStep("2", "Criterio de Descartes en D(−z)", `D(−z)=${polynomialText(negative)}; signos: ${signSequence(negative)}`, `${result.descartes.negativeVariations} variaciones: raíces reales negativas posibles = ${result.descartes.negativeCounts.join(" o ")}.`)
    + procedureStep("3", "Cotas y región global", `Cauchy=${format(result.bounds.cauchy)}; L+ = ${result.bounds.positiveUpper === null ? "no aplica" : format(result.bounds.positiveUpper)}; L− = ${result.bounds.negativeLower === null ? "no aplica" : format(result.bounds.negativeLower)}`, `Todas las raíces quedan dentro de |z|≤${format(result.bounds.global)}; para raíces reales, la región global es [−${format(result.bounds.global)}, ${format(result.bounds.global)}].`)
    + procedureStep("4", "Primera iteración de Müller", firstFormula, firstDescription)
    + procedureStep("5", "Criterio de estabilidad", "Filtro estable ⇔ |zᵢ| < 1 para todas las raíces", result.stable ? "Todas las raíces cumplen la condición: el filtro es estable." : "Al menos una raíz no cumple la condición: el filtro es inestable.");
  panel.querySelector("[data-deflation-content]").innerHTML = `<h3>Deflación polinomial, etapa por etapa</h3>${result.stages.map((stage, index) => `<article class="deflation-card"><span>Etapa ${index+1}</span><div><strong>Raíz: ${safe(formatComplex(stage.root))}</strong><code>Coeficientes del cociente: [${safe(complexCoefficientList(stage.quotient))}]</code><small>Resto por Horner: ${safe(format(stage.remainder, 7))} · Procedimiento: ${safe(stage.method)}</small></div></article>`).join("")}`;
  panel.hidden = false;
}

function generatePolynomialCode(input, result) {
  const coefficients = result.coefficients.join(", "); const stageSeeds = result.stages[0]?.seeds ?? []; const seeds = stageSeeds.length ? stageSeeds : [{ re: 0 }, { re: .5 }, { re: 1 }]; const z = seeds.map((value) => value.re ?? value).join(", ");
  const python = `import cmath\n\ncoef=[${coefficients}]\ntol=${input.tolerance}\nmax_iter=${input.maxIterations}\nseeds=[complex(v) for v in [${z}]]\n\ndef horner(p,x):\n    y=0j\n    for a in p: y=y*x+a\n    return y\n\ndef cambios(valores):\n    signos=[1 if v>0 else -1 for v in valores if v!=0]\n    return sum(a!=b for a,b in zip(signos,signos[1:]))\n\ndef deflactar(p,r):\n    q=[p[0]]\n    for a in p[1:-1]: q.append(a+q[-1]*r)\n    resto=p[-1]+q[-1]*r\n    return q,resto\n\ndef muller(p,z0,z1,z2):\n    historial=[]\n    for i in range(1,max_iter+1):\n        f0,f1,f2=horner(p,z0),horner(p,z1),horner(p,z2)\n        h1,h2=z1-z0,z2-z1\n        d1,d2=(f1-f0)/h1,(f2-f1)/h2\n        d=(d2-d1)/(h2+h1); b=d2+h2*d\n        D=cmath.sqrt(b*b-4*f2*d)\n        E=b+D if abs(b+D)>=abs(b-D) else b-D\n        h=-2*f2/E; z3=z2+h\n        ea=abs(h)/max(abs(z3),1)*100; residuo=abs(horner(p,z3))\n        historial.append((i,z0,z1,z2,z3,ea,residuo))\n        z0,z1,z2=z1,z2,z3\n        if ea<=tol or residuo<=tol: break\n    return z2,historial\n\nprint("Variaciones D(z):",cambios(coef))\ngr=len(coef)-1\ncoef_menos=[a*((-1)**(gr-i)) for i,a in enumerate(coef)]\nprint("Variaciones D(-z):",cambios(coef_menos))\ncota=1+max(abs(a/coef[0]) for a in coef[1:])\nprint("Region global: |z| <=",cota)\n\np=[complex(a) for a in coef]; raices=[]\nwhile len(p)>1:\n    if len(p)==2:\n        raiz=-p[1]/p[0]; historial=[]\n    else:\n        raiz,historial=muller(p,*seeds)\n    p,resto=deflactar(p,raiz)\n    raices.append(raiz)\n    print("raiz",raiz,"modulo",abs(raiz),"resto",abs(resto),"cociente",p)\n    radio=1+max((abs(a/p[0]) for a in p[1:]),default=1)\n    seeds=[-radio+0j,0j,radio+0j]\nprint("ESTABLE" if all(abs(r)<1 for r in raices) else "INESTABLE")\n`;
  const matlab = `coef=[${coefficients}]; tol=${input.tolerance}; max_iter=${input.maxIterations}; seeds=[${z}];\ngr=length(coef)-1; coef_menos=coef.*((-1).^(gr:-1:0));\nfprintf('Variaciones D(z): %d\\n',cambios(coef));\nfprintf('Variaciones D(-z): %d\\n',cambios(coef_menos));\ncota=1+max(abs(coef(2:end)/coef(1))); fprintf('Region global: |z| <= %g\\n',cota);\np=coef; raices=[];\nwhile length(p)>1\n    if length(p)==2, raiz=-p(2)/p(1); else, raiz=muller_poly(p,seeds,tol,max_iter); end\n    [p,resto]=deflactar(p,raiz); raices(end+1)=raiz;\n    fprintf('raiz=%g%+gi, modulo=%g, resto=%g\\n',real(raiz),imag(raiz),abs(raiz),abs(resto));\n    radio=1+max(abs(p(2:end)/p(1))); seeds=[-radio,0,radio];\nend\nif all(abs(raices)<1), disp('ESTABLE'); else, disp('INESTABLE'); end\n\nfunction v=cambios(a)\n    s=sign(a(a~=0)); v=sum(s(1:end-1)~=s(2:end));\nend\nfunction [q,r]=deflactar(p,x)\n    q=zeros(1,length(p)-1); q(1)=p(1);\n    for k=2:length(q), q(k)=p(k)+q(k-1)*x; end\n    r=p(end)+q(end)*x;\nend\nfunction raiz=muller_poly(p,s,tol,max_iter)\n    z0=s(1); z1=s(2); z2=s(3);\n    for i=1:max_iter\n        f0=polyval(p,z0); f1=polyval(p,z1); f2=polyval(p,z2);\n        h1=z1-z0; h2=z2-z1; d1=(f1-f0)/h1; d2=(f2-f1)/h2; d=(d2-d1)/(h2+h1);\n        b=d2+h2*d; disc=sqrt(complex(b^2-4*f2*d));\n        if abs(b+disc)>=abs(b-disc), E=b+disc; else, E=b-disc; end\n        h=-2*f2/E; z3=z2+h; ea=abs(h)/max(abs(z3),1)*100;\n        z0=z1; z1=z2; z2=z3;\n        if ea<=tol || abs(polyval(p,z3))<=tol, break; end\n    end\n    raiz=z2;\nend\n`;
  return { python, matlab };
}

function renderPolynomialResult(result) {
  const theory = app.querySelector("#polynomial-theory"); theory.className = "polynomial-theory-grid";
  const positiveBound = result.bounds.positiveUpper === null ? "No aplica" : format(result.bounds.positiveUpper);
  const negativeBound = result.bounds.negativeLower === null ? "No aplica" : format(result.bounds.negativeLower);
  theory.innerHTML = `${metric("Grado", result.degree)}${metric("Positivas posibles", result.descartes.positiveCounts.join(" o "))}${metric("Negativas posibles", result.descartes.negativeCounts.join(" o "))}${metric("Cota de Cauchy", format(result.bounds.cauchy))}${metric("Lagrange positiva", positiveBound)}${metric("Lagrange negativa", negativeBound)}<div class="initialization-note polynomial-init"><span>${icon("search")}</span><div><strong>Inicialización</strong><p>${result.initialization.message}</p></div></div><div class="stability-card ${result.stable ? "stable" : "unstable"}"><span>Conclusión del filtro</span><strong>${result.stable ? "ESTABLE" : "INESTABLE"}</strong><p>${result.stable ? "Todas las raíces están dentro del círculo unitario." : "Al menos una raíz tiene módulo mayor o igual que 1."}</p></div>`;
  const roots = app.querySelector("#polynomial-roots"); roots.className = "table-wrap";
  roots.innerHTML = `<table><thead><tr><th>Raíz</th><th>Valor z</th><th>|z|</th><th>|D(z)| por Horner</th><th>Resto de deflación</th><th>Procedimiento</th><th>|z| &lt; 1</th></tr></thead><tbody>${result.roots.map((item, index) => `<tr><td>z${index+1}</td><td>${formatComplex(item.root)}</td><td>${format(item.modulus)}</td><td>${format(item.residual, 5)}</td><td>${format(item.remainder, 5)}</td><td>${item.method}</td><td><span class="root-status ${item.stable ? "yes" : "no"}">${item.stable ? "Sí" : "No"}</span></td></tr>`).join("")}</tbody></table>`;
  const allRows = result.stages.flatMap((stage) => stage.rows.map((row) => ({ ...row, stage: stage.stage })));
  app.querySelector("#muller-table").innerHTML = `<thead><tr><th>Etapa</th><th>i</th><th>z₀</th><th>z₁</th><th>z₂</th><th>z nuevo</th><th>Error relativo</th><th>|D(z)|</th></tr></thead><tbody>${allRows.map((row) => `<tr><td>${row.stage}</td><td>${row.i}</td><td>${formatComplex(row.z0)}</td><td>${formatComplex(row.z1)}</td><td>${formatComplex(row.z2)}</td><td>${formatComplex(row.next)}</td><td>${format(row.error, 6)}</td><td>${format(row.residual, 6)}</td></tr>`).join("") || `<tr><td colspan="8">Las etapas restantes se resolvieron directamente o mediante respaldo numérico.</td></tr>`}</tbody>`;
  const chartRows = allRows.map((row, index) => ({ ...row, i: index+1 }));
  drawComplexPlane(result.roots); drawErrorChart(chartRows, "#poly-error-chart", "error");
}

function drawComplexPlane(roots) {
  const svg = app.querySelector("#complex-chart"); const width = 620, height = 420, pad = 46;
  const extent = Math.max(1.2, ...roots.map((item) => item.modulus*1.2)); const size = Math.min(width-2*pad, height-2*pad);
  const centerX = width/2, centerY = height/2; const scaleValue = size/(2*extent); const sx = (value) => centerX+value*scaleValue; const sy = (value) => centerY-value*scaleValue;
  const ticks = [-extent, -extent/2, 0, extent/2, extent];
  svg.innerHTML = `${ticks.map((value) => `<line class="chart-grid" x1="${sx(value)}" y1="${pad}" x2="${sx(value)}" y2="${height-pad}"/><line class="chart-grid" x1="${pad}" y1="${sy(value)}" x2="${width-pad}" y2="${sy(value)}"/>`).join("")}<line class="chart-axis" x1="${pad}" y1="${centerY}" x2="${width-pad}" y2="${centerY}"/><line class="chart-axis" x1="${centerX}" y1="${pad}" x2="${centerX}" y2="${height-pad}"/><circle class="unit-circle" cx="${centerX}" cy="${centerY}" r="${scaleValue}"/>${roots.map((item,index) => `<circle class="complex-root ${item.stable ? "inside" : "outside"}" cx="${sx(item.root.re)}" cy="${sy(item.root.im)}" r="6"/>${svgText(sx(item.root.re)+10, sy(item.root.im)-10, `z${index+1}`, "start")}`).join("")}${svgText(width-pad,centerY-8,"Re","end")}${svgText(centerX+8,pad+10,"Im","start")}`;
}

function registerWebMcp() {
  const context = document.modelContext; if (!context?.registerTool) return; const controller = new AbortController();
  try {
    Promise.resolve(context.registerTool({
      name: "calculate_numerical_method", title: "Calcular método numérico", description: "Abre un método de raíces, aplica una función y parámetros, actualiza la interfaz y devuelve la raíz calculada.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["biseccion", "falsa-posicion", "punto-fijo", "newton", "secante"] }, expression: { type: "string" }, fExpression: { type: "string" }, derivativeExpression: { type: "string" }, initialMode: { type: "string", enum: ["manual", "automatic"] }, variant: { type: "string", enum: ["standard", "modified"] }, multiplicity: { type: "integer" }, criterion: { type: "string", enum: ["relative", "absolute", "residual", "combined"] }, a: { type: "number" }, b: { type: "number" }, x0: { type: "number" }, x1: { type: "number" }, tolerance: { type: "number", exclusiveMinimum: 0 }, maxIterations: { type: "integer", minimum: 1, maximum: 1000 } }, required: ["method", "expression", "initialMode", "criterion", "tolerance", "maxIterations"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!methodConfigs[input?.method]) throw new Error("Método no válido."); renderMethod(input.method); const form = app.querySelector("#method-form");
        Object.entries(input).forEach(([key, value]) => { const control = form.elements.namedItem(key); if (control) control.value = value; });
        const result = runMethod(input.method); if (!result) throw new Error(app.querySelector("#form-message").textContent || "No se pudo calcular.");
        return { method: input.method, root: result.root, residual: result.residual, iterations: result.rows.length, converged: result.converged };
      },
    }, { signal: controller.signal })).catch(() => {});
  } catch { /* Navegadores sin WebMCP continúan normalmente. */ }
}

document.addEventListener("click", (event) => { if (event.target.closest("[data-action='home']")) return renderHome(); const method = event.target.closest("[data-method]")?.dataset.method; if (method) renderMethod(method); });
window.addEventListener("hashchange", () => { const method = location.hash.slice(1); if (method && method !== state.currentMethod) renderMethod(method); });
const initialMethod = location.hash.slice(1); if (methods.some((method) => method.id === initialMethod)) renderMethod(initialMethod); else renderHome(); registerWebMcp();

