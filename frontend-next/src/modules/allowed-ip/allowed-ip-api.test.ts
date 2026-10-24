import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSettingsError } from "./allowed-ip-api";

describe("readSettingsError", () => {
  it("reads error string from JSON body", async () => {
    const res = new Response(JSON.stringify({ error: "Duplicate IP" }), { status: 400 });
    assert.equal(await readSettingsError(res, "fallback"), "Duplicate IP");
  });

  it("falls back when body is not JSON", async () => {
    const res = new Response("not json", { status: 500 });
    assert.equal(await readSettingsError(res, "fallback"), "fallback");
  });
});
