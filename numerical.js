import { compileExpression, numericalDerivative } from "./math-engine.js";

const approximateError = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  return current === 0 ? Math.abs(current - previous) * 100 : Math.abs((current - previous) / current) * 100;
};

function validateCommon(tolerance, maxIterations) {
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new Error("La tolerancia debe ser mayor que cero.");
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 500) throw new Error("Usa entre 1 y 500 iteraciones.");
}

function finish(method, fn, rows, root, tolerance, extra = {}) {
  const residual = fn(root);
  const lastError = rows.at(-1)?.error ?? null;
  const converged = Math.abs(residual) <= 1e-10 || (lastError !== null && lastError <= tolerance);
  return { method, rows, root, residual, lastError, converged, ...extra };
}

export function bisection({ expression, a, b, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations);
  const fn = compileExpression(expression);
  let left = Number(a), right = Number(b);
  if (!(left < right)) throw new Error("El extremo a debe ser menor que b.");
  let fLeft = fn(left), fRight = fn(right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) throw new Error("La función no está definida en uno de los extremos.");
  if (fLeft * fRight > 0) throw new Error("El intervalo no encierra una raíz: f(a) y f(b) tienen el mismo signo.");
  const rows = [];
  let previous = null;
  let root = fLeft === 0 ? left : right;
  for (let i = 1; i <= maxIterations && fLeft !== 0 && fRight !== 0; i += 1) {
    root = (left + right) / 2;
    const fRoot = fn(root);
    const error = approximateError(root, previous);
    rows.push({ i, a: left, b: right, fa: fLeft, fb: fRight, x: root, fx: fRoot, error });
    if (fRoot === 0 || (error !== null && error <= tolerance)) break;
    if (fLeft * fRoot < 0) { right = root; fRight = fRoot; }
    else { left = root; fLeft = fRoot; }
    previous = root;
  }
  if (!rows.length) rows.push({ i: 1, a: left, b: right, fa: fLeft, fb: fRight, x: root, fx: fn(root), error: 0 });
  return finish("biseccion", fn, rows, root, tolerance, { domain: [Number(a), Number(b)], expression });
}

export function falsePosition({ expression, a, b, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations);
  const fn = compileExpression(expression);
  let left = Number(a), right = Number(b);
  if (!(left < right)) throw new Error("El extremo a debe ser menor que b.");
  let fLeft = fn(left), fRight = fn(right);
  if (!Number.isFinite(fLeft) || !Number.isFinite(fRight)) throw new Error("La función no está definida en uno de los extremos.");
  if (fLeft * fRight > 0) throw new Error("El intervalo no encierra una raíz: f(a) y f(b) tienen el mismo signo.");
  const rows = [];
  let previous = null;
  let root = left;
  for (let i = 1; i <= maxIterations; i += 1) {
    const denominator = fLeft - fRight;
    if (Math.abs(denominator) < Number.EPSILON) throw new Error("La fórmula encontró una división entre cero.");
    root = right - fRight * (left - right) / denominator;
    const fRoot = fn(root);
    const error = approximateError(root, previous);
    rows.push({ i, a: left, b: right, fa: fLeft, fb: fRight, x: root, fx: fRoot, error });
    if (fRoot === 0 || (error !== null && error <= tolerance)) break;
    if (fLeft * fRoot < 0) { right = root; fRight = fRoot; }
    else { left = root; fLeft = fRoot; }
    previous = root;
  }
  return finish("falsa-posicion", fn, rows, root, tolerance, { domain: [Number(a), Number(b)], expression });
}

export function fixedPoint({ expression, x0, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations);
  const g = compileExpression(expression);
  const fn = (x) => g(x) - x;
  let current = Number(x0);
  if (!Number.isFinite(current)) throw new Error("La aproximación inicial no es válida.");
  const rows = [];
  for (let i = 1; i <= maxIterations; i += 1) {
    const next = g(current);
    if (!Number.isFinite(next)) throw new Error(`La iteración ${i} produjo un valor no definido.`);
    const error = approximateError(next, current);
    rows.push({ i, x: current, gx: next, fx: fn(current), error });
    current = next;
    if (error <= tolerance || Math.abs(fn(current)) <= 1e-10) break;
  }
  const slope = numericalDerivative(g, current);
  return finish("punto-fijo", fn, rows, current, tolerance, { domain: [Math.min(Number(x0), current) - 1, Math.max(Number(x0), current) + 1], expression: `(${expression})-x`, iterationExpression: expression, convergenceFactor: Math.abs(slope) });
}

export function newton({ expression, x0, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations);
  const fn = compileExpression(expression);
  let current = Number(x0);
  if (!Number.isFinite(current)) throw new Error("La aproximación inicial no es válida.");
  const rows = [];
  const visited = [current];
  for (let i = 1; i <= maxIterations; i += 1) {
    const fx = fn(current);
    const derivative = numericalDerivative(fn, current);
    if (!Number.isFinite(fx) || !Number.isFinite(derivative)) throw new Error(`La función no está definida en la iteración ${i}.`);
    if (Math.abs(derivative) < 1e-13) throw new Error(`La derivada es casi cero en x = ${current}. Prueba otro valor inicial.`);
    const next = current - fx / derivative;
    const error = approximateError(next, current);
    rows.push({ i, x: current, fx, derivative, next, error });
    current = next;
    visited.push(current);
    if (error <= tolerance || Math.abs(fn(current)) <= 1e-10) break;
  }
  return finish("newton", fn, rows, current, tolerance, { domain: [Math.min(...visited) - 1, Math.max(...visited) + 1], expression });
}

export function secant({ expression, x0, x1, tolerance, maxIterations }) {
  validateCommon(tolerance, maxIterations);
  const fn = compileExpression(expression);
  let previous = Number(x0), current = Number(x1);
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous === current) throw new Error("Los dos valores iniciales deben ser distintos y válidos.");
  const rows = [];
  const visited = [previous, current];
  for (let i = 1; i <= maxIterations; i += 1) {
    const fPrevious = fn(previous), fCurrent = fn(current);
    const denominator = fPrevious - fCurrent;
    if (!Number.isFinite(fPrevious) || !Number.isFinite(fCurrent)) throw new Error(`La función no está definida en la iteración ${i}.`);
    if (Math.abs(denominator) < 1e-14) throw new Error("La secante encontró una división entre cero. Prueba otros valores iniciales.");
    const next = current - fCurrent * (previous - current) / denominator;
    const error = approximateError(next, current);
    rows.push({ i, x0: previous, x1: current, f0: fPrevious, f1: fCurrent, next, error });
    previous = current;
    current = next;
    visited.push(current);
    if (error <= tolerance || Math.abs(fn(current)) <= 1e-10) break;
  }
  return finish("secante", fn, rows, current, tolerance, { domain: [Math.min(...visited) - 1, Math.max(...visited) + 1], expression });
}

