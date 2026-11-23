/**
 * Streaming line iterator for phpMyAdmin mysqldump INSERT sections.
 * Phase 2B: implement without loading full file into memory.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

export type DumpLineKind = "create_table" | "insert" | "other";

export async function* iterateDumpLines(path: string): AsyncGenerator<{ lineNo: number; kind: DumpLineKind; text: string }> {
  const insertRe = /^INSERT INTO `/;
  const createRe = /^CREATE TABLE `/;
  let lineNo = 0;
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const text of rl) {
    lineNo += 1;
    let kind: DumpLineKind = "other";
    if (createRe.test(text)) kind = "create_table";
    else if (insertRe.test(text)) kind = "insert";
    yield { lineNo, kind, text };
  }
}
