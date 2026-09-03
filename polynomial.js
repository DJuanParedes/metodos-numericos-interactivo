const C = (re = 0, im = 0) => ({ re: Number(re), im: Number(im) });
const asComplex = (value) => typeof value === "number" ? C(value) : C(value.re, value.im);
const add = (a, b) => { a = asComplex(a); b = asComplex(b); return C(a.re + b.re, a.im + b.im); };
const sub = (a, b) => { a = asComplex(a); b = asComplex(b); return C(a.re - b.re, a.im - b.im); };
const mul = (a, b) => { a = asComplex(a); b = asComplex(b); return C(a.re*b.re-a.im*b.im, a.re*b.im+a.im*b.re); };
const scale = (a, value) => C(a.re*value, a.im*value);
const abs = (a) => Math.hypot(a.re, a.im);
const div = (a, b) => {
  a = asComplex(a); b = asComplex(b);
  const denominator = b.re*b.re + b.im*b.im;
  if (denominator < 1e-30) throw new Error("Se produjo una división entre cero durante el cálculo.");
  return C((a.re*b.re+a.im*b.im)/denominator, (a.im*b.re-a.re*b.im)/denominator);
};
const sqrtComplex = (value) => {
  const z = asComplex(value);
  const magnitude = abs(z);
  const real = Math.sqrt(Math.max(0, (magnitude+z.re)/2));
  const imaginary = Math.sign(z.im || 1)*Math.sqrt(Math.max(0, (magnitude-z.re)/2));
  return C(real, imaginary);
};

export function parseCoefficients(source) {
  const parts = String(source).trim().split(/[,;\s]+/).filter(Boolean);
  if (parts.length < 2) throw new Error("Ingresa al menos dos coeficientes, desde el término de mayor grado hasta el término independiente.");
  const coefficients = parts.map(Number);
  if (coefficients.some((value) => !Number.isFinite(value))) throw new Error("Todos los coeficientes deben ser números reales.");
  if (coefficients[0] === 0) throw new Error("El coeficiente principal debe ser distinto de cero.");
  return coefficients;
}

export function evaluatePolynomial(coefficients, value) {
  const z = asComplex(value);
  return coefficients.map(asComplex).reduce((accumulator, coefficient) => add(mul(accumulator, z), coefficient), C(0));
}

function signVariations(values) {
  const signs = values.filter((value) => value !== 0).map(Math.sign);
  let variations = 0;
  for (let index = 1; index < signs.length; index += 1) if (signs[index] !== signs[index-1]) variations += 1;
  return variations;
}

function possibleCounts(variations) {
  const counts = [];
  for (let value = variations; value >= 0; value -= 2) counts.push(value);
  return counts;
}

export function descartesAnalysis(coefficients) {
  const positiveVariations = signVariations(coefficients);
  const negativeCoefficients = coefficients.map((value, index) => value*((coefficients.length-1-index)%2 ? -1 : 1));
  const negativeVariations = signVariations(negativeCoefficients);
  return {
    positiveVariations,
    negativeVariations,
    positiveCounts: possibleCounts(positiveVariations),
    negativeCounts: possibleCounts(negativeVariations),
  };
}

export function lagrangeBound(coefficients) {
  const leading = Math.abs(coefficients[0]);
  return 1 + Math.max(...coefficients.slice(1).map((value) => Math.abs(value)/leading));
}

function positiveLagrangeBound(coefficients) {
  const normalized = coefficients[0] < 0 ? coefficients.map((value) => -value) : coefficients;
  const firstNegative = normalized.findIndex((value, index) => index > 0 && value < 0);
  if (firstNegative < 0) return null;
  const largestNegative = Math.max(...normalized.filter((value, index) => index > 0 && value < 0).map((value) => Math.abs(value)));
  return 1 + (largestNegative/normalized[0])**(1/firstNegative);
}

export function lagrangeBounds(coefficients) {
  const positiveUpper = positiveLagrangeBound(coefficients);
  const transformed = coefficients.map((value, index) => value*((coefficients.length-1-index)%2 ? -1 : 1));
  const negativeMagnitude = positiveLagrangeBound(transformed);
  const cauchy = lagrangeBound(coefficients);
  return {
    positiveUpper,
    negativeLower: negativeMagnitude === null ? null : -negativeMagnitude,
    cauchy,
    global: Math.max(cauchy, positiveUpper ?? 0, negativeMagnitude ?? 0),
  };
}

export function deflate(coefficients, root) {
  const values = coefficients.map(asComplex);
  if (values.length < 2) throw new Error("No se puede deflactar un polinomio constante.");
  const quotient = [values[0]];
  for (let index = 1; index < values.length-1; index += 1) quotient.push(add(values[index], mul(quotient.at(-1), root)));
  const remainder = add(values.at(-1), mul(quotient.at(-1), root));
  return { quotient, remainder };
}

export function muller(coefficients, z0, z1, z2, tolerance, maxIterations) {
  let x0 = asComplex(z0), x1 = asComplex(z1), x2 = asComplex(z2);
  const rows = [];
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const f0 = evaluatePolynomial(coefficients, x0);
    const f1 = evaluatePolynomial(coefficients, x1);
    const f2 = evaluatePolynomial(coefficients, x2);
    const h1 = sub(x1, x0), h2 = sub(x2, x1);
    const delta1 = div(sub(f1, f0), h1);
    const delta2 = div(sub(f2, f1), h2);
    const d = div(sub(delta2, delta1), add(h2, h1));
    const b = add(delta2, mul(h2, d));
    const discriminant = sqrtComplex(sub(mul(b, b), scale(mul(f2, d), 4)));
    const ePlus = add(b, discriminant), eMinus = sub(b, discriminant);
    const denominator = abs(ePlus) >= abs(eMinus) ? ePlus : eMinus;
    if (abs(denominator) < 1e-15) throw new Error("Müller encontró un denominador casi cero. Prueba otros tres puntos iniciales.");
    const h = div(scale(f2, -2), denominator);
    const next = add(x2, h);
    const error = abs(h)/Math.max(abs(next), 1);
    const residual = abs(evaluatePolynomial(coefficients, next));
    rows.push({ i: iteration, z0: x0, z1: x1, z2: x2, next, error, residual });
    x0 = x1; x1 = x2; x2 = next;
    if (error <= tolerance || residual <= tolerance) break;
  }
  return { root: cleanComplex(x2, tolerance), rows, converged: rows.at(-1)?.error <= tolerance || rows.at(-1)?.residual <= tolerance };
}

function automaticSeeds(coefficients, firstStage = false) {
  const values = coefficients.map(asComplex);
  const leading = abs(values[0]);
  const radius = 1 + Math.max(...values.slice(1).map((value) => abs(value)/leading));
  if (firstStage && values.every((value) => Math.abs(value.im) < 1e-14)) return [C(-radius), C(0), C(radius)];
  return [C(radius), C(-radius/2, radius*Math.sqrt(3)/2), C(-radius/2, -radius*Math.sqrt(3)/2)];
}

function durandKerner(coefficients, tolerance) {
  const values = coefficients.map(asComplex);
  const degree = values.length-1;
  if (degree === 0) return [];
  if (degree === 1) return [div(scale(values[1], -1), values[0])];
  const normalized = values.map((value) => div(value, values[0]));
  const radius = 1 + Math.max(...normalized.slice(1).map(abs));
  let roots = Array.from({ length: degree }, (_, index) => {
    const angle = 2*Math.PI*(index+.37)/degree;
    return C(radius*Math.cos(angle), radius*Math.sin(angle));
  });
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    let maxChange = 0;
    const nextRoots = roots.map((root, index) => {
      let denominator = C(1);
      roots.forEach((other, otherIndex) => { if (otherIndex !== index) denominator = mul(denominator, sub(root, other)); });
      if (abs(denominator) < 1e-18) denominator = add(denominator, C(1e-12, 1e-12));
      const change = div(evaluatePolynomial(normalized, root), denominator);
      maxChange = Math.max(maxChange, abs(change));
      return sub(root, change);
    });
    roots = nextRoots;
    if (maxChange <= Math.max(tolerance*.1, 1e-12)) break;
  }
  return roots.map((root) => cleanComplex(root, tolerance));
}

function derivativeCoefficients(coefficients) {
  const degree = coefficients.length-1;
  return coefficients.slice(0, -1).map((value, index) => scale(asComplex(value), degree-index));
}

function polishRoot(coefficients, initial, tolerance) {
  const derivative = derivativeCoefficients(coefficients);
  let root = asComplex(initial);
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const denominator = evaluatePolynomial(derivative, root);
    if (abs(denominator) < 1e-16) break;
    const change = div(evaluatePolynomial(coefficients, root), denominator);
    root = sub(root, change);
    if (abs(change) <= Math.max(tolerance*.1, 1e-13)) break;
  }
  return cleanComplex(root, tolerance);
}

function cleanComplex(value, tolerance = 1e-12) {
  const threshold = Math.max(tolerance*10, 1e-10);
  return C(Math.abs(value.re) < threshold ? 0 : value.re, Math.abs(value.im) < threshold ? 0 : value.im);
}

export function analyzePolynomial({ coefficients, z0, z1, z2, initialMode, tolerance, maxIterations }) {
  const realCoefficients = parseCoefficients(coefficients);
  if (!new Set(["manual", "lagrange"]).has(initialMode)) throw new Error("Selecciona cómo se obtendrán los puntos iniciales.");
  if (![tolerance,maxIterations].every(Number.isFinite)) throw new Error("Completa la tolerancia y el máximo de iteraciones.");
  if (initialMode === "manual" && ![z0,z1,z2].every(Number.isFinite)) throw new Error("En modo manual debes ingresar z₀, z₁ y z₂.");
  if (initialMode === "manual" && new Set([z0,z1,z2]).size < 3) throw new Error("Los tres puntos iniciales deben ser distintos.");
  if (tolerance <= 0) throw new Error("La tolerancia debe ser mayor que cero.");
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 1000) throw new Error("Usa entre 1 y 1000 iteraciones.");
  const complexCoefficients = realCoefficients.map((value) => C(value));
  const bounds = lagrangeBounds(realCoefficients);
  let current = complexCoefficients;
  const stages = [];
  const stageRoots = [];
  while (current.length > 1) {
    const stageNumber = stages.length + 1;
    if (current.length === 2) {
      const root = div(scale(current[1], -1), current[0]);
      const step = deflate(current, root);
      stages.push({ stage: stageNumber, root, rows: [], remainder: abs(step.remainder), quotient: step.quotient, method: "solución lineal", seeds: [] });
      stageRoots.push(root);
      current = step.quotient;
      continue;
    }
    const seeds = stageNumber === 1 && initialMode === "manual"
      ? [C(z0), C(z1), C(z2)]
      : automaticSeeds(current, stageNumber === 1);
    let calculation;
    try {
      calculation = muller(current, seeds[0], seeds[1], seeds[2], tolerance, maxIterations);
      if (!calculation.converged) throw new Error("Müller no alcanzó la tolerancia.");
    } catch {
      const fallbackRoot = durandKerner(current, tolerance)[0];
      calculation = { root: fallbackRoot, rows: [], converged: true, fallback: true };
    }
    const root = polishRoot(current, calculation.root, tolerance);
    const step = deflate(current, root);
    stages.push({
      stage: stageNumber,
      root,
      rows: calculation.rows,
      remainder: abs(step.remainder),
      quotient: step.quotient,
      method: calculation.fallback ? "respaldo numérico" : "Müller",
      seeds,
    });
    stageRoots.push(root);
    current = step.quotient;
  }
  const roots = stageRoots.map((root) => polishRoot(complexCoefficients, root, tolerance));
  const rootDetails = roots.map((root, index) => ({
    root,
    modulus: abs(root),
    residual: abs(evaluatePolynomial(complexCoefficients, root)),
    remainder: stages[index].remainder,
    stable: abs(root) < 1,
    method: stages[index].method,
  }));
  const firstSeeds = stages[0]?.seeds ?? [];
  return {
    coefficients: realCoefficients,
    degree: realCoefficients.length-1,
    descartes: descartesAnalysis(realCoefficients),
    bound: bounds.global,
    bounds,
    first: { rows: stages[0]?.rows ?? [], root: roots[0], converged: true },
    stages,
    roots: rootDetails,
    stable: rootDetails.every((item) => item.stable),
    initialization: {
      mode: initialMode,
      seeds: firstSeeds,
      message: initialMode === "manual"
        ? "La primera raíz usó los tres puntos ingresados; las deflaciones siguientes generaron puntos a partir de la cota del polinomio reducido."
        : `Los puntos iniciales se generaron automáticamente dentro de la cota global |z| ≤ ${bounds.global}.`,
    },
  };
}

