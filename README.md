# NúmLab — Métodos numéricos interactivos

Aplicación web educativa para resolver y explorar los contenidos de las tres guías proporcionadas:

- teoría de errores: error absoluto y relativo, comparación de mediciones, error iterativo, criterio de Scarborough, sistema de punto flotante, Taylor, redondeo/truncamiento y cancelación catastrófica;
- métodos cerrados: bisección y falsa posición;
- métodos abiertos: punto fijo, Newton-Raphson y secante.

Cada método de raíces permite cambiar la función, los valores iniciales, la tolerancia y el máximo de iteraciones. La aplicación muestra el resultado, interpretación, tabla completa, gráfica de la función, convergencia del error y descarga CSV.

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

