import assert from "node:assert/strict";
import { compileExpression, roundSignificant, truncateSignificant } from "../math-engine.js";
import { bisection, falsePosition, fixedPoint, newton, secant } from "../numerical.js";

const close = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} no está cerca de ${expected}`);

close(compileExpression("2x + 3")(4), 11, 1e-12, "multiplicación implícita");
close(compileExpression("-x^2 + exp(-x)")(2), -4 + Math.exp(-2), 1e-12, "precedencia y exponencial");
close(compileExpression("sen(pi/2)")(0), 1, 1e-12, "funciones y constantes");
assert.equal(roundSignificant(7.34567, 4), 7.346);
assert.equal(truncateSignificant(7.34567, 4), 7.345);

const closedInput = { expression: "1/(x-8.5)-0.35*ln(x-2)", a: 8.6, b: 10, tolerance: .001, maxIterations: 100 };
const bis = bisection(closedInput);
assert.ok(bis.root > 8.5 && bis.root < 10 && Math.abs(bis.residual) < 1e-3);

const falsi = falsePosition({ expression: "45+12*x-20*exp(0.4*x)", a: 0, b: 5, tolerance: .001, maxIterations: 100 });
assert.ok(falsi.root > 0 && falsi.root < 5 && Math.abs(falsi.residual) < 1e-2);

const fixed = fixedPoint({ expression: "18+8*exp(-0.15*x)", x0: 20, tolerance: .001, maxIterations: 100 });
assert.ok(fixed.root > 18 && fixed.root < 26 && Math.abs(fixed.residual) < 1e-3);

const nr = newton({ expression: "x^3-7*x-5", x0: 3, tolerance: .0001, maxIterations: 50 });
close(nr.root, 2.948828, 1e-5, "Newton-Raphson");

const sec = secant({ expression: "exp(-x)-x^2+0.2", x0: .5, x1: 1, tolerance: .0001, maxIterations: 50 });
assert.ok(sec.root > .5 && sec.root < 1 && Math.abs(sec.residual) < 1e-5);

console.log("Pruebas numéricas superadas.");

