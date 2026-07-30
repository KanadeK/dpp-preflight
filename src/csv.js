import { PreflightError } from "./util.js";

export function parseCsv(text, { source = "CSV input" } = {}) {
  const input = String(text).replace(/^\uFEFF/, "");
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      if (record.some((cell) => cell.length > 0)) records.push(record);
      record = [];
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new PreflightError(`${source} contains an unclosed quoted field`, {
      code: "INPUT_INVALID",
    });
  }
  record.push(field);
  if (record.some((cell) => cell.length > 0)) records.push(record);
  if (records.length === 0) return [];

  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header)) {
    throw new PreflightError(`${source} contains an empty header`, {
      code: "INPUT_INVALID",
    });
  }
  if (new Set(headers).size !== headers.length) {
    throw new PreflightError(`${source} contains duplicate headers`, {
      code: "INPUT_INVALID",
    });
  }

  return records.slice(1).map((cells, rowIndex) => {
    if (cells.length > headers.length) {
      throw new PreflightError(
        `${source} row ${rowIndex + 2} has ${cells.length} fields; expected ${headers.length}`,
        { code: "INPUT_INVALID" },
      );
    }
    return Object.fromEntries(
      headers.map((header, index) => [header, (cells[index] ?? "").trim()]),
    );
  });
}

export function stringifyCsv(rows, columns) {
  const selectedColumns =
    columns ??
    [...new Set(rows.flatMap((row) => Object.keys(row)))].sort((a, b) =>
      a.localeCompare(b),
    );
  const encode = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    selectedColumns.map(encode).join(","),
    ...rows.map((row) => selectedColumns.map((column) => encode(row[column])).join(",")),
  ].join("\n") + "\n";
}
