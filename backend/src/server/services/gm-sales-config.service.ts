import { GM_SALES_CONFIG_DEFAULTS } from "../../shared/gm-sales-constants";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Generic no-op proxy — any method call resolves to a warning + undefined instead of crashing.
function makeStub(label: string, returnValue: any = undefined): any {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return makeStub(label + "." + String(prop), returnValue);
    },
    apply(_target, _thisArg, args) {
      console.warn("[stub] " + label + "(...) called — real implementation is missing from this checkout.");
      return Promise.resolve(returnValue);
    },
  });
}

export const getConfig = makeStub("getConfig", { config: GM_SALES_CONFIG_DEFAULTS });
export const patchConfig = makeStub("patchConfig", { config: GM_SALES_CONFIG_DEFAULTS });
