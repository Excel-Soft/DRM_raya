# Penalty — Schema & Permission Sign-off (PEN-001)

Date: 2026-06-30. Documents the penalty module's validation schemas and permission
model exactly as implemented, with **runtime** re-verification. **No schema,
permission, or route change was made** this stage. Validators:
`server/validators/penalty.validators.ts`; permission source:
`server/middleware/penalty-permission.ts`; routes: `server/penalty-routes.ts`.

## Validation schemas (Zod)

- **create** (`penaltyCreateSchema`): requires `employeeId`, `penaltyHead`,
  `reason`, `amount`, and a valid `penaltyDate`. Invalid input → **400** with a
  field-specific message. Validation runs **after** the create-permission check.
- **update** (`penaltyUpdateSchema`): every field optional, validated only when
  present, in order `amount → penaltyDate → penaltyHead → reason`. `amount` must be
  `>= 0`; `penaltyDate` must parse; `penaltyHead`/`reason` cannot be empty. The
  route enforces 404 (not-found) and the owner/role checks **before** the Zod
  parse, so a 400 means the caller was authorized and the body was the problem.
- **decision** (`penaltyDecisionSchema`): normalizes `{approvalStatus|decision|
  status}` to `APPROVED`/`REJECTED`; **rejection requires `hodRemarks`** (else 400).
- **void** (`penaltyVoidSchema`): a trimmed, non-empty `reason` is mandatory (else
  400).

## Permission model (single, row-aware source)

Decided by `penalty-permission.ts` — intentionally **not** the flat report matrix,
because penalty rules are row-aware:

- **create**: full-access (`admin`/`super_hod`), `hod`, managerial roles
  (`isManagerialRole`).
- **decide (approve/reject)** and **void**: full-access and `hod` only.
- **view**: full-access, `hod`, HR (`hr`/`hr_manager`/`*hr*`).
- **row-scope** (`getAllowedEmployeeIds`): full-access / HR → all; `hod` /
  managerial → their **department** (+ self); everyone else → **self only**.
  `acknowledge` is restricted to the penalised employee.

## No export surface — by design

Penalty has **no export endpoint or button**. This is intentional and **not a
dead control**; "add penalty export" is **not required** and would need management
confirmation (out-of-scope here).

## Runtime verification (executed)

| Check | Scenario | Expected | Observed |
|---|---|---|---|
| S12 | `admin` PATCH penalty with `amount: -5` | 400 `amount must be >= 0` | **400, exact message** |
| S13 | `sales_executive` POST penalty | 403 (no create right) | **403** |
| S13 | `admin` GET penalties | 200 | **200** |

The invalid-update check used a **real** penalty row; the request was rejected at
the Zod boundary, so **no data was mutated**. The forbidden-create check is
rejected before any insert. All penalty mutations are audited
(`recordAuditLog`).

## Pending management confirmation

None specific to penalty schema/permission — behaviour is intended and verified.
The only standing note is that penalty has **no export** (intentional, above).
