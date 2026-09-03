import { compileExpression, numericalDerivative } from "./math-engine.js";

const EXACT_EPSILON = 1e-12;
const CRITERIA = new Set(["relative", "absolute", "residual", "combined"]);

const relativeError = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  const change = Math.abs(current - previous);
  return current === 0 ? change * 100 : change / Math.abs(current) * 100;
};

const absoluteError = (current, previous) => previous === null || previous === undefined ? null : Math.abs(current - previous);

function validateCommon(tolerance, maxIterations, criterion) {
  if (!CRITERIA.has(criterion)) throw new Error("Selecciona un criterio de parada.");
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error("La tolerancia debe ser mayor que cero.");
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) throw new Error("Usa entre 1 y 1000 iteraciones.");
}

function stopData(current, previous, residual, criterion, tolerance) {
  const absolute = absoluteError(current, previous);
  const relative = relativeError(current, previous);
  let value;
  let meets;
  if (criterion === "absolute") {
    value = absolute;
    meets = absolute !== null && absolute <= tolerance;
  } else if (criterion === "residual") {
    value = residual;
    meets = residual <= tolerance;
  } else if (criterion === "combined") {
    value = Math.max(absolute ?? Infinity, residual);
    meets = absolute !== null && absolute <= tolerance && residual <= tolerance;
  } else {
    value = relative;
    meets = relative !== null && relative <= tolerance;
  }
  if (residual <= EXACT_EPSILON) meets = true;
  return { absoluteError: absolute, error: relative, residual, stopValue: value, meets };
}

function finish(method, fn, rows, root, criterion, extra = {}) {
  const residual = Math.abs(fn(root));
  const last = rows.at(-1) ?? {};
  return {
    method,
    rows,
    root,
    residual,
    lastError: last.error ?? null,
    lastAbsoluteError: last.absoluteError ?? null,
    stopValue: last.stopValue ?? null,
    criterion,
    converged: Boolean(last.meets || residual <= EXACT_EPSILON),
    ...extra,
  };
}

export function isolateRootFunction(fn) {
  const radii = [1, 10, 100, 1000, 10000, 100000, 1000000];
  const samples = 320;
  for (const radius of radii) {
    const candidates = [];
    let previous = null;
    for (let index = 0; index <= samples; index += 1) {
      const x = -radius + 2 * radius * index / samples;
      let fx;
      try { fx = fn(x); } catch { fx = NaN; }
      if (!Number.isFinite(fx)) { previous = null; continue; }
      if (Math.abs(fx) <= EXACT_EPSILON) {
        return { a: x, b: x, exact: true, radius, samples, source: "aislamiento automático" };
      }
      if (previous && previous.fx * fx < 0) {
        const midpoint = (previous.x + x) / 2;
        let midpointValue;
        try { midpointValue = fn(midpoint); } catch { midpointValue = NaN; }
        if (Number.isFinite(midpointValue)) candidates.push({ a: previous.x, b: x, midpoint });
      }
      previous = { x, fx };
    }
    if (candidates.length) {
      candidates.sort((first, second) => Math.abs(first.midpoint) - Math.abs(second.midpoint));
      return { ...candidates[0], exact: false, radius, samples, source: "aislamiento automático" };
    }
  }
  throw new Error("No se encontró un cambio de signo alrededor del origen. Usa valores iniciales manuales o el módulo de aislamiento gráfico.");
}

function resolveBracket(fn, a, b, initialMode) {
  if (initialMode === "automatic") {
    const found = isolateRootFunction(fn);
    return {
      ...found,
      message: found.exact
        ? `El aislamiento automático encontró una raíz exacta en x = ${found.a}.`
        : `El aislamiento automático encontró cambio de signo en [${found.a}, ${found.b}] al ampliar la búsqueda hasta ±${found.radius}.`,
    };
  }
  if (initialMode !== "manual") throw new Error("Selecciona cómo se obtendrán los valores iniciales.");
  const left = Number(a), right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("En modo manual debes ingresar ambos extremos.");
  if (!(left < right)) throw new Error("El extremo a debe ser menor que b.");
  const fLeft = fn(left), fRight = fn(right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) throw new Error("La función no está definida en uno de los extremos.");
  if (fLeft * fRight > 0) throw new Error("El intervalo no encierra una raíz: f(a) y f(b) tienen el mismo signo.");
  return { a: left, b: right, exact: fLeft === 0 || fRight === 0, source: "valores manuales", message: `Se usó el intervalo manual [${left}, ${right}].` };
}

export function scanForRoots({ expression, a, b, samples }) {
  const fn = compileExpression(expression);
  const left = Number(a), right = Number(b), count = Number(samples);
  if (!Number.isFinite(left) || !Number.isFinite(right) || !(left < right)) throw new Error("Ingresa un rango válido con a menor que b.");
  if (!Number.isInteger(count) || count < 10 || count > 5000) throw new Error("Usa entre 10 y 5000 divisiones.");
  const rows = [];
  const intervals = [];
  const exactRoots = [];
  for (let index = 0; index <= count; index += 1) {
    const x = left + (right - left) * index / count;
    let fx;
    try { fx = fn(x); } catch { fx = NaN; }
    const finite = Number.isFinite(fx);
    rows.push({ i: index, x, fx: finite ? fx : null, finite });
    if (finite && Math.abs(fx) <= EXACT_EPSILON) exactRoots.push(x);
    const previous = rows.at(-2);
    if (finite && previous?.finite && previous.fx * fx < 0) intervals.push({ a: previous.x, b: x, fa: previous.fx, fb: fx });
  }
  const tangencies = [];
  for (let index = 1; index < rows.length - 1; index += 1) {
    const before = rows[index - 1], current = rows[index], after = rows[index + 1];
    if (!before.finite || !current.finite || !after.finite) continue;
    const localMinimum = Math.abs(current.fx) < Math.abs(before.fx) && Math.abs(current.fx) < Math.abs(after.fx);
    const nearAxis = Math.abs(current.fx) <= Math.max(1e-8, .03 * Math.min(Math.abs(before.fx), Math.abs(after.fx)));
    if (localMinimum && nearAxis && before.fx * after.fx > 0) tangencies.push({ x: current.x, fx: current.fx });
  }
  return { expression, domain: [left, right], rows, intervals, exactRoots, tangencies };
}

export function bisection({ expression, a, b, initialMode, criterion, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations, criterion);
  const fn = compileExpression(expression);
  const initialization = resolveBracket(fn, a, b, initialMode);
  let left = initialization.a, right = initialization.b;
  let fLeft = fn(left), fRight = fn(right);
  const originalDomain = left === right ? [left - 1, right + 1] : [left, right];
  const rows = [];
  let previous = null;
  let root = fLeft === 0 ? left : fRight === 0 ? right : (left + right) / 2;
  if (fLeft !== 0 && fRight !== 0) {
    for (let i = 1; i <= maxIterations; i += 1) {
      root = (left + right) / 2;
      const fRoot = fn(root);
      if (!Number.isFinite(fRoot)) throw new Error(`La función no está definida en x = ${root}.`);
      const stop = stopData(root, previous, Math.abs(fRoot), criterion, tolerance);
      rows.push({ i, a: left, b: right, fa: fLeft, fb: fRight, x: root, fx: fRoot, intervalWidth: Math.abs(right - left), ...stop });
      if (stop.meets) break;
      if (fLeft * fRoot < 0) { right = root; fRight = fRoot; }
      else { left = root; fLeft = fRoot; }
      previous = root;
    }
  }
  if (!rows.length) rows.push({ i: 1, a: left, b: right, fa: fLeft, fb: fRight, x: root, fx: fn(root), intervalWidth: 0, ...stopData(root, null, 0, criterion, tolerance) });
  const predictedIterations = criterion === "absolute" && originalDomain[1] > originalDomain[0]
    ? Math.max(0, Math.ceil(Math.log2((originalDomain[1] - originalDomain[0]) / tolerance)))
    : null;
  return finish("biseccion", fn, rows, root, criterion, { domain: originalDomain, expression, initialization, predictedIterations });
}

export function falsePosition({ expression, a, b, initialMode, variant, criterion, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations, criterion);
  if (!new Set(["standard", "modified"]).has(variant)) throw new Error("Selecciona la variante de falsa posición.");
  const fn = compileExpression(expression);
  const initialization = resolveBracket(fn, a, b, initialMode);
  let left = initialization.a, right = initialization.b;
  let fLeft = fn(left), fRight = fn(right), usedLeft = fLeft, usedRight = fRight;
  const originalDomain = left === right ? [left - 1, right + 1] : [left, right];
  const rows = [];
  let previous = null;
  let root = fLeft === 0 ? left : fRight === 0 ? right : left;
  let stagnantLeft = 0, stagnantRight = 0;
  if (fLeft !== 0 && fRight !== 0) {
    for (let i = 1; i <= maxIterations; i += 1) {
      const denominator = usedLeft - usedRight;
      if (Math.abs(denominator) < Number.EPSILON) throw new Error("La fórmula encontró una división entre cero.");
      root = right - usedRight * (left - right) / denominator;
      const fRoot = fn(root);
      if (!Number.isFinite(fRoot)) throw new Error(`La función no está definida en x = ${root}.`);
      const stop = stopData(root, previous, Math.abs(fRoot), criterion, tolerance);
      rows.push({ i, a: left, b: right, fa: fLeft, fb: fRight, faUsed: usedLeft, fbUsed: usedRight, x: root, fx: fRoot, ...stop });
      if (stop.meets) break;
      if (fLeft * fRoot < 0) {
        right = root; fRight = fRoot; usedRight = fRoot; stagnantRight = 0; stagnantLeft += 1;
        if (variant === "modified" && stagnantLeft >= 2) usedLeft /= 2;
      } else {
        left = root; fLeft = fRoot; usedLeft = fRoot; stagnantLeft = 0; stagnantRight += 1;
        if (variant === "modified" && stagnantRight >= 2) usedRight /= 2;
      }
      previous = root;
    }
  }
  if (!rows.length) rows.push({ i: 1, a: left, b: right, fa: fLeft, fb: fRight, faUsed: usedLeft, fbUsed: usedRight, x: root, fx: fn(root), ...stopData(root, null, 0, criterion, tolerance) });
  return finish("falsa-posicion", fn, rows, root, criterion, { domain: originalDomain, expression, initialization, variant });
}

function resolveSingleInitial(fn, x0, initialMode, method) {
  if (initialMode === "automatic") {
    const bracket = isolateRootFunction(fn);
    let value = bracket.exact ? bracket.a : (bracket.a + bracket.b) / 2;
    if (method === "newton" && !bracket.exact) {
      const secondDerivative = (x) => {
        const h = Math.sqrt(Math.cbrt(Number.EPSILON)) * Math.max(1, Math.abs(x));
        return (fn(x + h) - 2 * fn(x) + fn(x - h)) / (h * h);
      };
      const candidates = [bracket.a, bracket.b].filter((candidate) => {
        const derivative = numericalDerivative(fn, candidate);
        return Number.isFinite(derivative) && Math.abs(derivative) > 1e-12 && fn(candidate) * secondDerivative(candidate) > 0;
      });
      if (candidates.length) value = candidates[0];
    }
    return { value, source: "aislamiento automático", interval: [bracket.a, bracket.b], message: `Se estimó x₀ = ${value} desde el intervalo [${bracket.a}, ${bracket.b}].` };
  }
  if (initialMode !== "manual") throw new Error("Selecciona cómo se obtendrá el valor inicial.");
  const value = Number(x0);
  if (!Number.isFinite(value)) throw new Error("En modo manual debes ingresar x₀.");
  return { value, source: "valor manual", message: `Se usó x₀ = ${value}.` };
}

export function fixedPoint({ expression, fExpression, alternativeExpression, x0, initialMode, criterion, tolerance, maxIterations, analysisA, analysisB }) {
  validateCommon(tolerance, maxIterations, criterion);
  const g = compileExpression(expression);
  const fn = String(fExpression ?? "").trim() ? compileExpression(fExpression) : (x) => g(x) - x;
  const initialization = resolveSingleInitial(fn, x0, initialMode, "fixed");
  let current = initialization.value;
  const rows = [];
  const visited = [current];
  for (let i = 1; i <= maxIterations; i += 1) {
    const next = g(current);
    if (!Number.isFinite(next)) throw new Error(`La iteración ${i} produjo un valor no definido.`);
    const residual = Math.abs(fn(next));
    const stop = stopData(next, current, residual, criterion, tolerance);
    rows.push({ i, x: current, gx: next, fx: fn(current), gprime: numericalDerivative(g, current), ...stop });
    current = next;
    visited.push(current);
    if (stop.meets) break;
  }
  let intervalAnalysis = null;
  const hasA = Number.isFinite(analysisA), hasB = Number.isFinite(analysisB);
  if (hasA !== hasB) throw new Error("Para analizar el intervalo de punto fijo, ingresa tanto a como b.");
  if (hasA && hasB) {
    if (!(analysisA < analysisB)) throw new Error("En el intervalo de análisis, a debe ser menor que b.");
    const samples = Array.from({ length: 101 }, (_, index) => analysisA + (analysisB - analysisA) * index / 100);
    const values = samples.map((x) => g(x));
    const slopes = samples.map((x) => Math.abs(numericalDerivative(g, x)));
    intervalAnalysis = {
      a: analysisA,
      b: analysisB,
      mapsInside: values.every((value) => Number.isFinite(value) && value >= analysisA && value <= analysisB),
      maxSlope: Math.max(...slopes.filter(Number.isFinite)),
    };
  }
  let alternativeAnalysis = null;
  if (String(alternativeExpression ?? "").trim()) {
    const alternative = compileExpression(alternativeExpression);
    alternativeAnalysis = { expression: alternativeExpression, factor: Math.abs(numericalDerivative(alternative, current)) };
  }
  const slope = numericalDerivative(g, current);
  const minVisited = Math.min(...visited), maxVisited = Math.max(...visited);
  return finish("punto-fijo", fn, rows, current, criterion, {
    domain: [minVisited - Math.max(1, (maxVisited - minVisited) * .2), maxVisited + Math.max(1, (maxVisited - minVisited) * .2)],
    expression: String(fExpression ?? "").trim() || `(${expression})-x`,
    iterationExpression: expression,
    convergenceFactor: Math.abs(slope),
    initialization,
    intervalAnalysis,
    alternativeAnalysis,
  });
}

export function newton({ expression, derivativeExpression, x0, initialMode, variant, multiplicity, criterion, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations, criterion);
  if (!new Set(["standard", "modified"]).has(variant)) throw new Error("Selecciona la variante de Newton-Raphson.");
  const fn = compileExpression(expression);
  const derivativeSource = String(derivativeExpression ?? "").trim();
  const derivativeFn = derivativeSource ? compileExpression(derivativeSource) : (x) => numericalDerivative(fn, x);
  const factor = variant === "modified" ? Number(multiplicity) : 1;
  if (variant === "modified" && (!Number.isInteger(factor) || factor < 2 || factor > 100)) throw new Error("Para Newton modificado ingresa una multiplicidad entera entre 2 y 100.");
  const initialization = resolveSingleInitial(fn, x0, initialMode, "newton");
  let current = initialization.value;
  const rows = [];
  const visited = [current];
  for (let i = 1; i <= maxIterations; i += 1) {
    const fx = fn(current);
    const derivative = derivativeFn(current);
    if (!Number.isFinite(fx) || !Number.isFinite(derivative)) throw new Error(`La función o la derivada no está definida en la iteración ${i}.`);
    if (Math.abs(derivative) < 1e-13) throw new Error(`La derivada es casi cero en x = ${current}. Prueba otro valor inicial.`);
    const next = current - factor * fx / derivative;
    const residual = Math.abs(fn(next));
    const stop = stopData(next, current, residual, criterion, tolerance);
    rows.push({ i, x: current, fx, derivative, next, ...stop });
    current = next;
    visited.push(current);
    if (!Number.isFinite(current)) throw new Error(`La iteración ${i} salió del dominio numérico.`);
    if (stop.meets) break;
  }
  return finish("newton", fn, rows, current, criterion, {
    domain: [Math.min(...visited) - 1, Math.max(...visited) + 1],
    expression,
    initialization,
    variant,
    multiplicity: factor,
    derivativeSource: derivativeSource ? "analítica ingresada" : "numérica por diferencias centrales",
  });
}

export function secant({ expression, x0, x1, initialMode, criterion, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations, criterion);
  const fn = compileExpression(expression);
  let previous, current, initialization;
  if (initialMode === "automatic") {
    const bracket = isolateRootFunction(fn);
    if (bracket.exact) {
      previous = bracket.a - Math.max(1, Math.abs(bracket.a) * .1);
      current = bracket.a;
    } else {
      previous = bracket.a;
      current = bracket.b;
    }
    initialization = { source: "aislamiento automático", interval: [bracket.a, bracket.b], message: `Se estimaron x₀ = ${previous} y x₁ = ${current}.` };
  } else {
    if (initialMode !== "manual") throw new Error("Selecciona cómo se obtendrán los valores iniciales.");
    previous = Number(x0); current = Number(x1);
    if (!Number.isFinite(previous) || !Number.isFinite(current)) throw new Error("En modo manual debes ingresar x₀ y x₁.");
    initialization = { source: "valores manuales", message: `Se usaron x₀ = ${previous} y x₁ = ${current}.` };
  }
  if (previous === current) throw new Error("Los dos valores iniciales deben ser distintos.");
  const rows = [];
  const visited = [previous, current];
  for (let i = 1; i <= maxIterations; i += 1) {
    const fPrevious = fn(previous), fCurrent = fn(current);
    const denominator = fPrevious - fCurrent;
    if (!Number.isFinite(fPrevious) || !Number.isFinite(fCurrent)) throw new Error(`La función no está definida en la iteración ${i}.`);
    if (Math.abs(denominator) < 1e-14) throw new Error("f(xₙ) y f(xₙ₋₁) son demasiado cercanos; la secante sería numéricamente inestable.");
    const next = current - fCurrent * (previous - current) / denominator;
    const residual = Math.abs(fn(next));
    const stop = stopData(next, current, residual, criterion, tolerance);
    rows.push({ i, x0: previous, x1: current, f0: fPrevious, f1: fCurrent, next, ...stop });
    previous = current;
    current = next;
    visited.push(current);
    if (!Number.isFinite(current)) throw new Error(`La iteración ${i} salió del dominio numérico.`);
    if (stop.meets) break;
  }
  return finish("secante", fn, rows, current, criterion, { domain: [Math.min(...visited) - 1, Math.max(...visited) + 1], expression, initialization });
}

