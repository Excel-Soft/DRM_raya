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

export const PENALTY_STATUSES = makeStub("PENALTY_STATUSES");
export const PENALTY_HEADS = makeStub("PENALTY_HEADS");
export const listPenalties = makeStub("listPenalties");
export const getPenaltyById = makeStub("getPenaltyById");
export const getPenaltyRaw = makeStub("getPenaltyRaw");
export const createPenalty = makeStub("createPenalty");
export const updatePenalty = makeStub("updatePenalty");
export const decidePenalty = makeStub("decidePenalty");
export const acknowledgePenalty = makeStub("acknowledgePenalty");
export const softDeletePenalty = makeStub("softDeletePenalty");
export const voidPenalty = makeStub("voidPenalty");
export const monthlyReport = makeStub("monthlyReport");
