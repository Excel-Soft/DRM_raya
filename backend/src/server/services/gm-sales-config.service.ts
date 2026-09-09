// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Generic no-op proxy — any method call resolves to a warning + undefined instead of crashing.
function makeStub(label: string): any {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return makeStub(label + "." + String(prop));
    },
    apply(_target, _thisArg, args) {
      console.warn("[stub] " + label + "(...) called — real implementation is missing from this checkout.");
      return Promise.resolve(undefined);
    },
  });
}

export const getConfig = makeStub("getConfig");
