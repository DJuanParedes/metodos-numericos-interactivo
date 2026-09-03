# NúmLab — Métodos numéricos interactivos

Aplicación web educativa adaptada a las guías teóricas, prácticas y de aprendizaje autónomo de las cuatro sesiones:

- teoría de errores: error absoluto y relativo, comparación de mediciones, error iterativo, criterio de Scarborough, sistema de punto flotante, Taylor, redondeo/truncamiento y cancelación catastrófica;
- aislamiento gráfico y tabular de raíces, detección de cambios de signo y advertencias sobre tangencias o discontinuidades;
- métodos cerrados: bisección, falsa posición estándar y falsa posición modificada;
- métodos abiertos: punto fijo con análisis de convergencia, Newton-Raphson estándar o modificado y secante;
- criterios de parada por error relativo, error absoluto, residuo o combinación de condiciones;
- raíces de polinomios: criterio de Descartes, cotas de Lagrange y Cauchy, método de Müller por etapas, evaluación de Horner, deflación y análisis de estabilidad en el círculo unitario.

Todos los campos comienzan vacíos. El usuario elige si ingresará los valores iniciales o si desea que el programa los estime. En el modo automático, el intervalo se obtiene mediante aislamiento de cambios de signo; para polinomios, los puntos de Müller se generan usando las cotas calculadas. La procedencia de cualquier estimación siempre se muestra en el resultado.

Después de cada cálculo se presenta el desarrollo paso a paso: planteamiento, fórmula, sustitución de la primera iteración, criterio de parada y conclusión. En polinomios se detallan `D(z)`, `D(-z)`, las variaciones de signo, la región global, los cocientes de cada deflación y el resto de Horner. Los módulos también generan código reproducible en Python y MATLAB usando los valores ingresados por el usuario.

## Sintaxis de funciones

Usa `x` como variable y punto decimal. Se aceptan operaciones como `+`, `-`, `*`, `/`, `^`, paréntesis y funciones como `sin`/`sen`, `cos`, `tan`, `exp`, `ln`, `log`, `sqrt` y `abs`. También se aceptan las constantes `pi` y `e`.

Ejemplos:

```text
x^3 - 7*x - 5
exp(-x) - x^2 + 0.2
1/(x-8.5) - 0.35*ln(x-2)
```

## Uso local

No requiere instalar dependencias. Sirve la carpeta con cualquier servidor HTTP, por ejemplo:

```bash
python -m http.server 4173
```

Luego abre `http://localhost:4173`.

## Comprobaciones

```bash
npm test
npm run build
```

El flujo incluido en `.github/workflows/pages.yml` publica automáticamente la carpeta generada en GitHub Pages al enviar cambios a `main`.

