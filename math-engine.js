const FUNCTIONS = {
  sin: Math.sin,
  sen: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
  log10: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

function normalize(source) {
  return String(source)
    .trim()
    .replaceAll("−", "-")
    .replaceAll("–", "-")
    .replaceAll("×", "*")
    .replaceAll("·", "*")
    .replaceAll("÷", "/")
    .replaceAll("π", "pi")
    .replaceAll("Math.", "");
}

function tokenize(source) {
  const input = normalize(source);
  if (!input) throw new Error("Escribe una función.");
  const raw = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) { index += 1; continue; }
    if (/[0-9.]/.test(char)) {
      const match = input.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (!match) throw new Error(`Número inválido cerca de “${input.slice(index, index + 8)}”.`);
      raw.push({ type: "number", value: Number(match[0]) });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = input.slice(index).match(/^[A-Za-z_][A-Za-z_0-9]*/);
      raw.push({ type: "id", value: match[0].toLowerCase() });
      index += match[0].length;
      continue;
    }
    if ("()+-*/^,".includes(char)) {
      raw.push({ type: char, value: char });
      index += 1;
      continue;
    }
    throw new Error(`Símbolo no permitido: “${char}”.`);
  }

  const tokens = [];
  const canEnd = (token) => token && (token.type === "number" || token.type === "id" || token.type === ")");
  const canStart = (token) => token && (token.type === "number" || token.type === "id" || token.type === "(");
  raw.forEach((token) => {
    const previous = tokens.at(-1);
    const functionCall = previous?.type === "id" && token.type === "(" && Object.hasOwn(FUNCTIONS, previous.value);
    if (canEnd(previous) && canStart(token) && !functionCall) tokens.push({ type: "*", value: "*" });
    tokens.push(token);
  });
  tokens.push({ type: "eof", value: null });
  return tokens;
}

export function compileExpression(source) {
  const tokens = tokenize(source);
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = (type) => {
    const token = peek();
    if (token.type !== type) throw new Error(`Se esperaba “${type}” y se encontró “${token.value ?? "fin"}”.`);
    cursor += 1;
    return token;
  };

  function parseExpression() {
    let left = parseTerm();
    while (peek().type === "+" || peek().type === "-") {
      const operator = take(peek().type).type;
      const right = parseTerm();
      const previous = left;
      left = (x) => operator === "+" ? previous(x) + right(x) : previous(x) - right(x);
    }
    return left;
  }

  function parseTerm() {
    let left = parseUnary();
    while (peek().type === "*" || peek().type === "/") {
      const operator = take(peek().type).type;
      const right = parseUnary();
      const previous = left;
      left = (x) => operator === "*" ? previous(x) * right(x) : previous(x) / right(x);
    }
    return left;
  }

  function parseUnary() {
    if (peek().type === "+") { take("+"); return parseUnary(); }
    if (peek().type === "-") { take("-"); const value = parseUnary(); return (x) => -value(x); }
    return parsePower();
  }

  function parsePower() {
    let base = parsePrimary();
    if (peek().type === "^") {
      take("^");
      const exponent = parseUnary();
      const previous = base;
      base = (x) => previous(x) ** exponent(x);
    }
    return base;
  }

  function parsePrimary() {
    if (peek().type === "number") {
      const value = take("number").value;
      return () => value;
    }
    if (peek().type === "(") {
      take("(");
      const value = parseExpression();
      take(")");
      return value;
    }
    if (peek().type === "id") {
      const name = take("id").value;
      if (name === "x") return (x) => x;
      if (Object.hasOwn(CONSTANTS, name)) return () => CONSTANTS[name];
      if (!Object.hasOwn(FUNCTIONS, name)) throw new Error(`No se reconoce “${name}”. Usa x y funciones como sin, cos, exp, ln o sqrt.`);
      take("(");
      const args = [parseExpression()];
      while (peek().type === ",") { take(","); args.push(parseExpression()); }
      take(")");
      return (x) => FUNCTIONS[name](...args.map((arg) => arg(x)));
    }
    throw new Error(`Expresión incompleta cerca de “${peek().value ?? "fin"}”.`);
  }

  const evaluator = parseExpression();
  take("eof");
  return (x) => {
    const result = evaluator(Number(x));
    return Number(result);
  };
}

export function numericalDerivative(fn, x) {
  const h = Math.cbrt(Number.EPSILON) * Math.max(1, Math.abs(x));
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

export function roundSignificant(value, digits) {
  if (!Number.isFinite(value) || value === 0) return value;
  const scale = 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.round(value * scale) / scale;
}

export function truncateSignificant(value, digits) {
  if (!Number.isFinite(value) || value === 0) return value;
  const scale = 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(value))));
  return Math.trunc(value * scale) / scale;
}

