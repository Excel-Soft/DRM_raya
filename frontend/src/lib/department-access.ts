import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Services save "Allowed Department(s)" as department CODES from /api/drm/departments
// (old-DRM departments were migrated as codes like "LEGACY-2" = "Sales Department").
// The invoice/quotation gate compares departments with the user's role, so codes must
// first be turned into names, then names into the role keyword they cover.

/** code -> department name (all departments, active or not). */
export function useDepartmentCodeNames(): Map<string, string> {
    const { data } = useQuery<Array<{ code: string; name: string }>>({
        queryKey: ["/api/drm/departments", "code-names"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/departments");
            const body = await res.json();
            return (body.data ?? body ?? []).map((d: any) => ({ code: String(d.code ?? ""), name: String(d.name ?? "") }));
        },
        staleTime: 5 * 60_000,
    });
    return new Map((data ?? []).filter((d) => d.code).map((d) => [d.code, d.name]));
}

/** Role-key fragments that belong to a department name. */
const DEPARTMENT_ROLE_HINTS: Array<[RegExp, string[]]> = [
    [/^super\s*hod$/, ["super_hod"]],
    [/^head of department$|^hod$/, ["hod"]],
    [/^sales$/, ["sales"]],
    [/^service$|^support$/, ["service", "support"]],
    [/^product posting$|^posting$/, ["posting"]],
    [/^d\s*&\s*d$|^dnd$|^dd$/, ["dd_", "dnd"]],
    [/^accounts?$/, ["account"]],
    [/^it$/, ["it_"]],
    [/^seo\s*\/\s*smm$/, ["seo"]],
    [/^marketing$/, ["marketing"]],
    [/^qa$/, ["qa"]],
    [/^verification$/, ["verification"]],
    [/^software$/, ["software", "developer"]],
    [/^lead$/, ["lead"]],
    [/^reception$/, ["reception"]],
    [/^media$/, ["media"]],
    [/^complaint$/, ["complaint"]],
    [/^project$/, ["project"]],
    [/^internship\s*&\s*trainee$/, ["internship", "trainee"]],
    [/^trade assurance$/, ["ta_"]],
    [/^welc$|^wecl$|^web excels$/, ["wecl"]],
    [/^admin$/, ["admin"]],
    [/^manager$/, ["manager"]],
    [/^(human resource|hr)$/, ["hr"]],
    [/^training$/, ["training"]],
];

export function isDepartmentAllowedFor(
    userRole: string,
    allowedDeps: string[] | null | undefined,
    codeNames?: Map<string, string>,
): boolean {
    const role = (userRole || "").toLowerCase();
    if (role.includes("admin") || role.includes("super_hod")) return true;
    if (!allowedDeps || allowedDeps.length === 0) return false;
    return allowedDeps.some((dep) => {
        const name = (codeNames?.get(dep) ?? dep ?? "").toLowerCase().trim();
        const base = name.replace(/\s+department$/, "").trim();
        for (const [re, hints] of DEPARTMENT_ROLE_HINTS) {
            if (re.test(base)) return hints.some((h) => role.includes(h));
        }
        return !!base && role.includes(base.replace(/[^a-z0-9]+/g, "_"));
    });
}

/** Display name for a stored department value (code or name). */
export function departmentLabel(value: string | null | undefined, codeNames?: Map<string, string>): string {
    if (!value) return "";
    return codeNames?.get(value) ?? value;
}
