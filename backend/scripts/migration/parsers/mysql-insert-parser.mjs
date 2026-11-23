/** @typedef {{ table: string, columns: string[], rows: (string|null)[][] }} InsertStatement */

/** @param {string} s @param {number} i */
function skipWs(s, i) {
  while (i < s.length && " \t\r\n".includes(s[i])) i++;
  return i;
}

/** @param {string} s @param {number} i */
function readIdentBacktick(s, i) {
  if (s[i] !== "`") throw new Error("expected backtick");
  i++;
  const start = i;
  while (i < s.length && s[i] !== "`") i++;
  if (i >= s.length) throw new Error("unterminated ident");
  const name = s.slice(start, i);
  i++;
  return { name, i };
}

/** @param {string} s @param {number} i */
function readValue(s, i) {
  i = skipWs(s, i);
  if (i >= s.length) throw new Error("eof value");
  if (s.slice(i, i + 4).toUpperCase() === "NULL" && (i + 4 >= s.length || ",)".includes(s[i + 4])))
    return { val: null, i: i + 4 };
  if (s.slice(i, i + 2).toLowerCase() === "0x") {
    let j = i + 2;
    while (j < s.length && /[0-9a-fA-F]/.test(s[j])) j++;
    return { val: s.slice(i, j), i: j };
  }
  if (s[i] === "'") {
    i++;
    let out = "";
    while (i < s.length) {
      const c = s[i];
      if (c === "'") {
        if (i + 1 < s.length && s[i + 1] === "'") {
          out += "'";
          i += 2;
          continue;
        }
        i++;
        break;
      }
      if (c === "\\" && i + 1 < s.length) {
        const map = { 0: "\0", b: "\b", n: "\n", r: "\r", t: "\t", Z: "\x1a", "'": "'", '"': '"', "\\": "\\" };
        out += map[s[i + 1]] ?? s[i + 1];
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    return { val: out, i };
  }
  let j = i;
  while (j < s.length && !",)".includes(s[j])) j++;
  return { val: s.slice(i, j).trim(), i: j };
}

/** @param {string} s @param {number} i */
function readRow(s, i) {
  i = skipWs(s, i);
  if (s[i] !== "(") throw new Error("expected (");
  i++;
  /** @type {(string|null)[]} */
  const values = [];
  for (;;) {
    i = skipWs(s, i);
    if (s[i] === ")") return { row: values, i: i + 1 };
    const { val, i: ni } = readValue(s, i);
    values.push(val);
    i = skipWs(s, ni);
    if (s[i] === ",") {
      i++;
      continue;
    }
    if (s[i] === ")") return { row: values, i: i + 1 };
    throw new Error("bad row");
  }
}

/** @param {string} sql */
export function parseInsertStatement(sql) {
  let s = sql.trim();
  if (!s.endsWith(";")) s += ";";
  let i = skipWs(s, 0);
  const iu = s.toUpperCase();
  if (!iu.startsWith("INSERT")) throw new Error("not insert");
  let pos = iu.indexOf("INTO", i);
  if (pos < 0) throw new Error("no INTO");
  i = pos + 4;
  i = skipWs(s, i);
  const { name: table, i: i2 } = readIdentBacktick(s, i);
  i = skipWs(s, i2);
  if (s[i] !== "(") throw new Error("no cols");
  i++;
  /** @type {string[]} */
  const columns = [];
  for (;;) {
    i = skipWs(s, i);
    if (s[i] === ")") {
      i++;
      break;
    }
    const { name: col, i: ic } = readIdentBacktick(s, i);
    columns.push(col);
    i = skipWs(s, ic);
    if (s[i] === ",") {
      i++;
      continue;
    }
    if (s[i] === ")") {
      i++;
      break;
    }
    throw new Error("col list");
  }
  i = skipWs(s, i);
  if (!s.slice(i).toUpperCase().startsWith("VALUES")) throw new Error("no VALUES");
  i += 6;
  /** @type {(string|null)[][]} */
  const rows = [];
  for (;;) {
    i = skipWs(s, i);
    if (i >= s.length || s[i] === ";") break;
    const { row, i: ir } = readRow(s, i);
    rows.push(row);
    i = skipWs(s, ir);
    if (i < s.length && s[i] === ",") {
      i++;
      continue;
    }
    if (i < s.length && s[i] === ";") break;
  }
  return /** @type {InsertStatement} */ ({ table, columns, rows });
}

/** @param {string} path @param {(lineNo: number, ins: InsertStatement) => void|Promise<void>} onInsert */
export async function streamInsertStatements(path, onInsert) {
  const { createReadStream } = await import("node:fs");
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let lineNo = 0;
  /** @type {string[]} */
  let buf = [];
  let inInsert = false;
  let startLine = 0;
  for await (const line of rl) {
    lineNo++;
    const stripped = line.trimStart();
    if (!inInsert) {
      if (stripped.toUpperCase().startsWith("INSERT INTO")) {
        inInsert = true;
        startLine = lineNo;
        buf = [line];
        if (stripped.endsWith(";")) {
          await onInsert(startLine, parseInsertStatement(buf.join("")));
          inInsert = false;
          buf = [];
        }
      }
      continue;
    }
    buf.push(line);
    if (stripped.endsWith(";")) {
      await onInsert(startLine, parseInsertStatement(buf.join("")));
      inInsert = false;
      buf = [];
    }
  }
}
