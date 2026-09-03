import { compileExpression, roundSignificant, truncateSignificant } from "./math-engine.js";
import { bisection, falsePosition, fixedPoint, newton, secant } from "./numerical.js";

const app = document.querySelector("#app");
const homeTemplate = document.querySelector("#home-template");
const workspaceTemplate = document.querySelector("#workspace-template");
const state = { currentMethod: null, lastResult: null, lastTable: null };

const methods = [
  { id: "errores", index: "01", family: "Fundamentos", title: "Teoría de errores", description: "Ocho herramientas para error, precisión, punto flotante y series." },
  { id: "biseccion", index: "02", family: "Métodos cerrados", title: "Bisección", description: "Refina un intervalo que contiene una raíz mediante puntos medios." },
  { id: "falsa-posicion", index: "03", family: "Métodos cerrados", title: "Falsa posición", description: "Aproxima la raíz usando una recta entre los extremos del intervalo." },
  { id: "punto-fijo", index: "04", family: "Métodos abiertos", title: "Punto fijo", description: "Itera una función g(x) hasta alcanzar un valor estable." },
  { id: "newton", index: "05", family: "Métodos abiertos", title: "Newton-Raphson", description: "Usa la pendiente local para acercarse rápidamente a una raíz." },
  { id: "secante", index: "06", family: "Métodos abiertos", title: "Secante", description: "Aproxima la derivada con dos valores iniciales." },
];

const methodConfigs = {
  biseccion: {
    solver: bisection, functionLabel: "Función f(x)",
    presets: [
      { id: "enlace", label: "Enlace de red (PDF)", expression: "1/(x-8.5)-0.35*ln(x-2)", a: 8.6, b: 10, tolerance: .5, maxIterations: 50 },
      { id: "polinomio", label: "Polinomio de práctica", expression: "x^3-7*x-5", a: 2, b: 4, tolerance: .01, maxIterations: 50 },
    ],
    fields: [
      { name: "a", label: "Extremo a", type: "number", step: "any" }, { name: "b", label: "Extremo b", type: "number", step: "any" },
      { name: "tolerance", label: "Tolerancia (%)", type: "number", step: "any", min: "0" }, { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "500" },
    ],
    columns: [["i", "i"], ["a", "a"], ["b", "b"], ["f(a)", "fa"], ["f(b)", "fb"], ["xr", "x"], ["f(xr)", "fx"], ["Error (%)", "error"]],
  },
  "falsa-posicion": {
    solver: falsePosition, functionLabel: "Función f(x)",
    presets: [
      { id: "nube", label: "Migración a la nube (PDF)", expression: "45+12*x-20*exp(0.4*x)", a: 0, b: 5, tolerance: .5, maxIterations: 50 },
      { id: "polinomio", label: "Polinomio de práctica", expression: "x^3-7*x-5", a: 2, b: 4, tolerance: .01, maxIterations: 50 },
    ],
    fields: [
      { name: "a", label: "Extremo a", type: "number", step: "any" }, { name: "b", label: "Extremo b", type: "number", step: "any" },
      { name: "tolerance", label: "Tolerancia (%)", type: "number", step: "any", min: "0" }, { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "500" },
    ],
    columns: [["i", "i"], ["a", "a"], ["b", "b"], ["f(a)", "fa"], ["f(b)", "fb"], ["xr", "x"], ["f(xr)", "fx"], ["Error (%)", "error"]],
  },
  "punto-fijo": {
    solver: fixedPoint, functionLabel: "Función de iteración g(x)", help: "El método calcula x siguiente = g(x). Para la gráfica se usa f(x) = g(x) - x.",
    presets: [
      { id: "temperatura", label: "Temperatura de servidores (PDF)", expression: "18+8*exp(-0.15*x)", x0: 20, tolerance: .01, maxIterations: 50 },
      { id: "coseno", label: "Punto fijo clásico", expression: "cos(x)", x0: .5, tolerance: .001, maxIterations: 100 },
    ],
    fields: [
      { name: "x0", label: "Aproximación inicial x₀", type: "number", step: "any" }, { name: "tolerance", label: "Tolerancia (%)", type: "number", step: "any", min: "0" },
      { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "500", full: true },
    ],
    columns: [["i", "i"], ["xᵢ", "x"], ["g(xᵢ)", "gx"], ["g(xᵢ)-xᵢ", "fx"], ["Error (%)", "error"]],
  },
  newton: {
    solver: newton, functionLabel: "Función f(x)", help: "La derivada se estima automáticamente con diferencias centrales.",
    presets: [
      { id: "almacenamiento", label: "Sistema de almacenamiento (PDF)", expression: "x^3-7*x-5", x0: 3, tolerance: .01, maxIterations: 50 },
      { id: "trascendente", label: "Ecuación trascendente", expression: "cos(x)-x", x0: .7, tolerance: .001, maxIterations: 50 },
    ],
    fields: [
      { name: "x0", label: "Aproximación inicial x₀", type: "number", step: "any" }, { name: "tolerance", label: "Tolerancia (%)", type: "number", step: "any", min: "0" },
      { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "500", full: true },
    ],
    columns: [["i", "i"], ["xᵢ", "x"], ["f(xᵢ)", "fx"], ["f′(xᵢ)", "derivative"], ["xᵢ₊₁", "next"], ["Error (%)", "error"]],
  },
  secante: {
    solver: secant, functionLabel: "Función f(x)",
    presets: [
      { id: "servidor", label: "Rendimiento del servidor (PDF)", expression: "exp(-x)-x^2+0.2", x0: .5, x1: 1, tolerance: .01, maxIterations: 50 },
      { id: "polinomio", label: "Polinomio de práctica", expression: "x^3-7*x-5", x0: 2, x1: 4, tolerance: .01, maxIterations: 50 },
    ],
    fields: [
      { name: "x0", label: "Primer valor x₀", type: "number", step: "any" }, { name: "x1", label: "Segundo valor x₁", type: "number", step: "any" },
      { name: "tolerance", label: "Tolerancia (%)", type: "number", step: "any", min: "0" }, { name: "maxIterations", label: "Máx. iteraciones", type: "number", step: "1", min: "1", max: "500" },
    ],
    columns: [["i", "i"], ["xᵢ₋₁", "x0"], ["xᵢ", "x1"], ["f(xᵢ₋₁)", "f0"], ["f(xᵢ)", "f1"], ["xᵢ₊₁", "next"], ["Error (%)", "error"]],
  },
};

const errorTools = [
  { id: "basic", label: "Error absoluto y relativo", description: "Compara un valor medido con el valor verdadero." },
  { id: "compare", label: "Comparar mediciones", description: "Decide cuál medición es más precisa usando el error relativo." },
  { id: "iterative", label: "Error iterativo", description: "Calcula εₐ entre dos aproximaciones y prueba una tolerancia." },
  { id: "scarborough", label: "Cifras significativas", description: "Obtén las cifras garantizadas a partir de εₐ." },
  { id: "floating", label: "Sistema de punto flotante", description: "Máximo, mínimo, cardinalidad, overflow y underflow." },
  { id: "taylor", label: "Serie de Taylor de sen(x)", description: "Mide el error de truncamiento al limitar los términos." },
  { id: "rounding", label: "Redondeo y truncamiento", description: "Compara ambos procesos a una cantidad de cifras significativas." },
  { id: "cancellation", label: "Cancelación catastrófica", description: "Observa la pérdida de precisión al restar números cercanos." },
];

const errorDefaults = {
  basic: [{ name: "trueValue", label: "Valor verdadero", value: 25, type: "number", step: "any" }, { name: "approxValue", label: "Valor medido", value: 24.7, type: "number", step: "any" }],
  compare: [
    { name: "true1", label: "Valor real 1", value: 300000, type: "number", step: "any" }, { name: "approx1", label: "Medición 1", value: 299800, type: "number", step: "any" },
    { name: "true2", label: "Valor real 2", value: 2, type: "number", step: "any" }, { name: "approx2", label: "Medición 2", value: 1.95, type: "number", step: "any" },
  ],
  iterative: [
    { name: "previous", label: "Aproximación anterior x₀", value: 2.718, type: "number", step: "any" }, { name: "current", label: "Aproximación actual x₁", value: 2.7183, type: "number", step: "any" },
    { name: "digits", label: "Cifras significativas objetivo", value: 4, type: "number", step: "1", min: "1", max: "15", full: true },
  ],
  scarborough: [{ name: "knownError", label: "Error aproximado εₐ (%)", value: .0008, type: "number", step: "any", min: "0", full: true }],
  floating: [
    { name: "base", label: "Base β", value: 10, type: "number", step: "1", min: "2" }, { name: "digits", label: "Cifras de mantisa t", value: 3, type: "number", step: "1", min: "1" },
    { name: "lower", label: "Exponente mínimo L", value: -4, type: "number", step: "1" }, { name: "upper", label: "Exponente máximo U", value: 4, type: "number", step: "1" },
    { name: "testValue", label: "Número a clasificar", value: 100000, type: "number", step: "any", full: true, help: "Se usa la forma normalizada 0.d₁d₂…dₜ × βᵉ." },
  ],
  taylor: [{ name: "x", label: "x en radianes", value: .5, type: "number", step: "any" }, { name: "terms", label: "Número de términos", value: 2, type: "number", step: "1", min: "1", max: "20" }],
  rounding: [{ name: "value", label: "Número original", value: 7.34567, type: "number", step: "any" }, { name: "digits", label: "Cifras significativas", value: 4, type: "number", step: "1", min: "1", max: "15" }],
  cancellation: [
    { name: "a", label: "Primer radicando a", value: 4.0003, type: "number", step: "any" }, { name: "b", label: "Segundo radicando b", value: 4, type: "number", step: "any" },
    { name: "digits", label: "Cifras de la calculadora", value: 5, type: "number", step: "1", min: "1", max: "15", full: true },
  ],
};

function renderHome() {
  state.currentMethod = null; state.lastResult = null;
  app.replaceChildren(homeTemplate.content.cloneNode(true));
  const grid = app.querySelector("#method-grid");
  methods.forEach((method) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "method-card"; button.dataset.method = method.id;
    button.innerHTML = `<span class="card-index">${method.index}</span><h2>${method.title}</h2><p>${method.description}</p><span class="open-label">Abrir método →</span>`;
    grid.append(button);
  });
  history.replaceState({}, "", location.pathname); app.focus({ preventScroll: true });
}

function createField(config) {
  const wrap = document.createElement("div"); wrap.className = `field${config.full ? " full" : ""}`;
  const label = document.createElement("label"); label.htmlFor = config.name; label.textContent = config.label;
  const input = document.createElement("input"); input.id = config.name; input.name = config.name; input.type = config.type || "text"; input.value = config.value ?? ""; input.required = config.required !== false;
  ["step", "min", "max"].forEach((key) => { if (config[key] !== undefined) input.setAttribute(key, config[key]); });
  wrap.append(label, input);
  if (config.help) { const help = document.createElement("small"); help.textContent = config.help; wrap.append(help); }
  return wrap;
}

function loadPreset(form, preset, config) {
  form.replaceChildren();
  form.append(createField({ name: "expression", label: config.functionLabel, value: preset.expression, full: true, help: config.help || "Usa x como variable. Se aceptan ^, sin, cos, exp, ln, sqrt, pi y e." }));
  config.fields.forEach((item) => form.append(createField({ ...item, value: preset[item.name] })));
}

function renderMethod(methodId) {
  if (methodId === "errores") return renderErrors();
  const method = methods.find((item) => item.id === methodId); const config = methodConfigs[methodId];
  if (!method || !config) return renderHome();
  state.currentMethod = methodId; state.lastResult = null;
  app.replaceChildren(workspaceTemplate.content.cloneNode(true));
  app.querySelector("#crumb-method").textContent = method.title; app.querySelector("#method-family").textContent = method.family; app.querySelector("#method-title").textContent = method.title; app.querySelector("#method-description").textContent = method.description;
  const select = app.querySelector("#preset-select"); config.presets.forEach((preset, index) => select.add(new Option(preset.label, String(index))));
  const form = app.querySelector("#method-form"); loadPreset(form, config.presets[0], config);
  select.addEventListener("change", () => { loadPreset(form, config.presets[Number(select.value)], config); runMethod(methodId); });
  form.addEventListener("submit", (event) => { event.preventDefault(); runMethod(methodId); });
  app.querySelector("#download-csv").addEventListener("click", downloadCsv);
  history.replaceState({}, "", `#${methodId}`); runMethod(methodId); app.focus({ preventScroll: true });
}

function readMethodParameters(form) {
  const data = Object.fromEntries(new FormData(form));
  Object.keys(data).forEach((key) => { if (key !== "expression") data[key] = Number(data[key]); });
  return data;
}

function runMethod(methodId) {
  const config = methodConfigs[methodId]; const form = app.querySelector("#method-form"); const message = app.querySelector("#form-message"); message.textContent = "";
  try {
    const result = config.solver(readMethodParameters(form)); state.lastResult = result;
    state.lastTable = { columns: config.columns, rows: result.rows, method: methods.find((item) => item.id === methodId).title };
    renderNumericalResult(result, config); return result;
  } catch (error) {
    state.lastResult = null; app.querySelector("#download-csv").disabled = true; message.textContent = error.message; app.querySelector("#result-status").textContent = "No se pudo completar el cálculo."; return null;
  }
}

function renderNumericalResult(result, config) {
  const status = result.converged ? "Convergió con el criterio indicado." : "Se alcanzó el máximo de iteraciones.";
  app.querySelector("#result-status").textContent = `${status} ${result.rows.length} iteraciones.`;
  app.querySelector("#metric-row").innerHTML = `<div class="metric"><span>Raíz aproximada</span><strong>${format(result.root)}</strong></div><div class="metric"><span>f(raíz)</span><strong>${format(result.residual, 6)}</strong></div><div class="metric"><span>Error aproximado</span><strong>${result.lastError === null ? "—" : `${format(result.lastError, 6)} %`}</strong></div>`;
  const presetId = methodConfigs[result.method].presets[Number(app.querySelector("#preset-select").value)]?.id;
  app.querySelector("#interpretation").textContent = interpretResult(result, presetId);
  renderTable(config.columns, result.rows); drawFunctionChart(result); drawErrorChart(result.rows); app.querySelector("#download-csv").disabled = false;
}

function interpretResult(result, presetId) {
  const root = format(result.root, 8);
  if (presetId === "enlace") return `Interpretación: el modelo alcanza T(C)=0 cerca de C = ${root} Mbps. En una contratación real conviene redondear la capacidad hacia arriba.`;
  if (presetId === "nube") return `Interpretación: los costos del sistema local y de la nube se igualan aproximadamente a los ${root} años; antes y después de ese punto debe compararse qué alternativa queda por debajo.`;
  if (presetId === "temperatura") return `Interpretación: la temperatura de equilibrio estimada es ${root} °C. Factor local |g′(x)| ≈ ${format(result.convergenceFactor, 5)} (${result.convergenceFactor < 1 ? "compatible con convergencia" : "puede divergir"}).`;
  if (presetId === "almacenamiento") return `Interpretación: la raíz positiva ${root} representa el tiempo de respuesta del modelo, expresado en milisegundos.`;
  if (presetId === "servidor") return `Interpretación: x ≈ ${root} es el nivel de carga normalizado que satisface el punto de operación del servidor.`;
  return `La raíz aproximada ${root} hace que el residuo f(x) sea ${format(result.residual, 6)}.`;
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

function drawErrorChart(rows) {
  const svg = app.querySelector("#error-chart"); const width = 720, height = 260, pad = 44;
  const points = rows.filter((row) => row.error !== null && row.error > 0 && Number.isFinite(row.error)).map((row) => ({ x: row.i, y: Math.log10(row.error) }));
  if (!points.length) { svg.innerHTML = svgText(width / 2, height / 2, "No hay suficientes iteraciones para graficar el error"); return; }
  const minX = 1, maxX = Math.max(2, ...points.map((p) => p.x)); let minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  if (minY === maxY) { minY -= 1; maxY += 1; }
  const sx = (x) => pad + ((x - minX) / (maxX - minX)) * (width - 2 * pad); const sy = (y) => height - pad - ((y - minY) / (maxY - minY)) * (height - 2 * pad);
  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x)},${sy(p.y)}`).join(" "); const yTicks = Array.from({ length: 4 }, (_, i) => minY + (i / 3) * (maxY - minY));
  svg.innerHTML = `${yTicks.map((y) => `<line class="chart-grid" x1="${pad}" y1="${sy(y)}" x2="${width-pad}" y2="${sy(y)}"/>${svgText(pad-7, sy(y)+4, format(10**y, 3), "end")}`).join("")}<line class="chart-axis" x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}"/><path class="error-curve" d="${path}"/>${points.map((p) => `<circle class="error-point" cx="${sx(p.x)}" cy="${sy(p.y)}" r="4"/>`).join("")}${svgText(pad, height-14, "1", "start")}${svgText(width-pad, height-14, String(maxX), "end")}`;
}

function downloadCsv() {
  if (!state.lastTable) return; const { columns, rows, method } = state.lastTable;
  const lines = [columns.map(([label]) => label).join(","), ...rows.map((row) => columns.map(([, key]) => row[key] ?? "").join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${method.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-iteraciones.csv`; anchor.click(); URL.revokeObjectURL(url);
}

function renderErrors() {
  state.currentMethod = "errores"; state.lastResult = null;
  app.innerHTML = `<section class="workspace-shell error-shell"><nav class="crumbs"><button type="button" class="text-button" data-action="home">← Todos los métodos</button><span>/</span><strong>Teoría de errores</strong></nav><div class="workspace-heading"><div><p class="eyebrow">Fundamentos</p><h1>Teoría de errores</h1><p>Resuelve los nueve tipos de ejercicios incluidos en la guía de la sesión 1.</p></div></div><div class="error-layout"><aside class="error-menu" id="error-menu" aria-label="Herramientas de errores"></aside><section class="panel error-calculator"><div class="panel-heading"><span class="step-number">1</span><div><h2 id="error-tool-title"></h2><p id="error-tool-description"></p></div></div><form id="error-form" class="field-grid"></form><div class="form-message" id="error-message" role="alert"></div><button type="submit" form="error-form" class="primary-button">Calcular</button></section><section class="panel error-output"><div class="panel-heading"><span class="step-number">2</span><div><h2>Resultado</h2><p>Valores calculados y explicación.</p></div></div><div id="error-result" class="error-result"></div></section></div></section>`;
  const menu = app.querySelector("#error-menu");
  errorTools.forEach((tool, index) => { const button = document.createElement("button"); button.type = "button"; button.dataset.errorTool = tool.id; button.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span><strong>${tool.label}</strong>`; menu.append(button); });
  menu.addEventListener("click", (event) => { const id = event.target.closest("[data-error-tool]")?.dataset.errorTool; if (id) renderErrorTool(id); });
  history.replaceState({}, "", "#errores"); renderErrorTool("basic"); app.focus({ preventScroll: true });
}

function renderErrorTool(toolId) {
  const tool = errorTools.find((item) => item.id === toolId);
  app.querySelectorAll("[data-error-tool]").forEach((button) => button.classList.toggle("active", button.dataset.errorTool === toolId));
  app.querySelector("#error-tool-title").textContent = tool.label; app.querySelector("#error-tool-description").textContent = tool.description;
  const form = app.querySelector("#error-form"); form.replaceChildren(); errorDefaults[toolId].forEach((item) => form.append(createField(item)));
  form.onsubmit = (event) => { event.preventDefault(); calculateErrorTool(toolId, new FormData(form)); }; calculateErrorTool(toolId, new FormData(form));
}

function metric(label, value) { return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`; }

function calculateErrorTool(toolId, formData) {
  const data = Object.fromEntries([...formData].map(([key, value]) => [key, Number(value)])); const output = app.querySelector("#error-result"); const message = app.querySelector("#error-message"); message.textContent = "";
  try {
    let metrics = "", explanation = "", table = "";
    if (toolId === "basic") {
      const absolute = Math.abs(data.trueValue - data.approxValue); const relative = data.trueValue === 0 ? null : absolute / Math.abs(data.trueValue) * 100;
      metrics = metric("Error absoluto", format(absolute)) + metric("Error relativo", relative === null ? "No definido" : `${format(relative)} %`);
      explanation = "El error absoluto conserva las unidades del problema; el relativo expresa el tamaño del error respecto al valor verdadero.";
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
      if (!Number.isInteger(beta) || beta < 2 || !Number.isInteger(t) || t < 1 || !Number.isInteger(lower) || !Number.isInteger(upper) || lower > upper) throw new Error("β y t deben ser enteros válidos, y L no puede ser mayor que U.");
      const max = (1-beta**(-t))*beta**(upper+1); const min = beta**(lower-1); const cardinality = 2*(beta-1)*beta**(t-1)*(upper-lower+1)+1; const absValue = Math.abs(data.testValue);
      const classification = absValue === 0 ? "Cero representable" : absValue > max ? "Overflow" : absValue < min ? "Underflow" : "Dentro del rango";
      metrics = metric("Mayor positivo", format(max)) + metric("Menor positivo", format(min)) + metric("Cardinalidad", format(cardinality)) + metric("Clasificación", classification); explanation = "Se usa la convención normalizada 0.d₁d₂…dₜ × βᵉ, se incluyen números positivos, negativos y el cero.";
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
    output.innerHTML = `<div class="metric-row error-metrics">${metrics}</div>${table}<div class="explanation">${explanation}</div>`; state.lastResult = { tool: toolId, summary: explanation };
  } catch (error) { message.textContent = error.message; output.innerHTML = `<div class="empty-result">Corrige los datos para ver el resultado.</div>`; }
}

function registerWebMcp() {
  const context = document.modelContext; if (!context?.registerTool) return; const controller = new AbortController();
  try {
    Promise.resolve(context.registerTool({
      name: "calculate_numerical_method", title: "Calcular método numérico", description: "Abre un método de raíces, aplica una función y parámetros, actualiza la interfaz y devuelve la raíz calculada.",
      inputSchema: { type: "object", properties: { method: { type: "string", enum: ["biseccion", "falsa-posicion", "punto-fijo", "newton", "secante"] }, expression: { type: "string" }, a: { type: "number" }, b: { type: "number" }, x0: { type: "number" }, x1: { type: "number" }, tolerance: { type: "number", exclusiveMinimum: 0 }, maxIterations: { type: "integer", minimum: 1, maximum: 500 } }, required: ["method", "expression", "tolerance", "maxIterations"], additionalProperties: false },
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

