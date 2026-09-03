import assert from "node:assert/strict";
import { compileExpression, roundSignificant, truncateSignificant } from "../math-engine.js";
import { bisection, falsePosition, fixedPoint, newton, scanForRoots, secant } from "../numerical.js";
import { analyzePolynomial } from "../polynomial.js";

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} no está cerca de ${expected}`);

close(compileExpression("2x + 3")(4), 11, 1e-12, "multiplicación implícita");
close(compileExpression("-x^2 + exp(-x)")(2), -4 + Math.exp(-2), 1e-12, "precedencia y exponencial");
close(compileExpression("sen(pi/2)")(0), 1, 1e-12, "funciones y constantes");
assert.equal(roundSignificant(7.34567, 4), 7.346);
assert.equal(truncateSignificant(7.34567, 4), 7.345);

const closedInput = { expression: "1/(x-8.5)-0.35*ln(x-2)", a: 8.6, b: 10, initialMode: "manual", criterion: "relative", tolerance: .001, maxIterations: 100 };
const bis = bisection(closedInput);
assert.ok(bis.root > 8.5 && bis.root < 10 && Math.abs(bis.residual) < 1e-3);

const falsi = falsePosition({ expression: "45+12*x-20*exp(0.4*x)", a: 0, b: 5, initialMode: "manual", variant: "modified", criterion: "relative", tolerance: .001, maxIterations: 100 });
assert.ok(falsi.root > 0 && falsi.root < 5 && Math.abs(falsi.residual) < 1e-2);

const fixed = fixedPoint({ expression: "18+8*exp(-0.15*x)", fExpression: "18+8*exp(-0.15*x)-x", x0: 20, initialMode: "manual", criterion: "relative", tolerance: .001, maxIterations: 100 });
assert.ok(fixed.root > 18 && fixed.root < 26 && Math.abs(fixed.residual) < 1e-3);

const nr = newton({ expression: "x^3-7*x-5", derivativeExpression: "3*x^2-7", x0: 3, initialMode: "manual", variant: "standard", criterion: "residual", tolerance: 1e-10, maxIterations: 50 });
close(nr.root, 2.948828, 1e-5, "Newton-Raphson");

const sec = secant({ expression: "exp(-x)-x^2+0.2", x0: .5, x1: 1, initialMode: "manual", criterion: "residual", tolerance: 1e-8, maxIterations: 50 });
assert.ok(sec.root > .5 && sec.root < 1 && Math.abs(sec.residual) < 1e-5);

const isolated = scanForRoots({ expression: "x^3-x-1", a: 1, b: 2, samples: 100 });
assert.equal(isolated.intervals.length, 1);

const automatic = bisection({ expression: "x^3-x-1", initialMode: "automatic", criterion: "residual", tolerance: 1e-8, maxIterations: 200 });
close(automatic.root, 1.3247179572, 1e-6, "Bisección con aislamiento automático");

const modified = falsePosition({ expression: "x^10-1", a: 0, b: 1.3, initialMode: "manual", variant: "modified", criterion: "residual", tolerance: 1e-8, maxIterations: 100 });
close(modified.root, 1, 1e-6, "Falsa posición modificada");

const polynomial = analyzePolynomial({ coefficients: "8,-6,-3,3,-1", z0: 0, z1: .5, z2: 1, initialMode: "manual", tolerance: 1e-5, maxIterations: 100 });
assert.equal(polynomial.degree, 4);
assert.equal(polynomial.roots.length, 4);
assert.equal(polynomial.descartes.positiveVariations, 3);
assert.equal(polynomial.descartes.negativeVariations, 1);
assert.equal(polynomial.bounds.cauchy, 1.75);
assert.equal(polynomial.stages.length, 4);
assert.ok(polynomial.stages.every((stage) => Array.isArray(stage.quotient)));
assert.ok(polynomial.roots.every((root) => root.residual < 1e-4));
assert.ok(polynomial.roots.every((root) => root.remainder < 1e-3));

const automaticPolynomial = analyzePolynomial({ coefficients: "8,-6,-3,3,-1", initialMode: "lagrange", tolerance: 1e-5, maxIterations: 100 });
assert.equal(automaticPolynomial.roots.length, 4);
assert.ok(automaticPolynomial.roots.every((root) => root.residual < 1e-4));

console.log("Pruebas numéricas superadas.");

