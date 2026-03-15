import { inspect } from "node:util";

export function renderResult(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (typeof value === "string") {
    console.log(value);
    return;
  }

  console.log(inspect(value, { depth: null, colors: false, compact: false, sorted: true }));
}
