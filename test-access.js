const DEPT_NAME_TO_ROLES = {
  "Report": ["admin", "super_hod", "hod", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "it_manager", "reception_manager"],
};

function hasAccess(
  menuPermissions,
  permKey,
  userRoleName,
  userAllRoles,
) {
  if (!permKey) return true;

  const entry = menuPermissions.find(
    (p) => p.name.trim().toLowerCase() === permKey.trim().toLowerCase()
  );

  if (entry && !entry.isActive) return false;

  const baseRoles = [
    ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
    ...userAllRoles.map(r => r.toLowerCase().replace(/\s+/g, "_")),
  ];

  const rolesSet = new Set(baseRoles);
  const roles = Array.from(rolesSet);

  if (entry && Array.isArray(entry.allowedRoleIds) && entry.allowedRoleIds.length > 0) {
    const allowed = entry.allowedRoleIds.map(r => r.toLowerCase().trim().replace(/\s+/g, "_"));
    return roles.some(r => allowed.includes(r));
  }

  if (roles.some(r => ["admin", "super_admin", "administrator", "adm"].includes(r))) return true;

  const hardcodedAllowed = DEPT_NAME_TO_ROLES[permKey];
  if (hardcodedAllowed !== undefined) {
    return roles.some(r => hardcodedAllowed.includes(r));
  }

  if (entry) {
    const entryPerms = entry.permissions || []; 
    if (entryPerms.length === 0) return true;   

    for (const dept of entryPerms) {
      const allowedRoles = DEPT_NAME_TO_ROLES[dept.name] || [];
      if (roles.some(r => allowedRoles.includes(r))) return true;
    }
  }

  return false;
}

const dbData = [
  {
    name: "Report",
    isActive: true,
    allowedRoleIds: ["service_manager", "service_executive"],
    permissions: [{ name: "Service Department", type: "default" }]
  }
];

console.log("hasAccess = ", hasAccess(dbData, "Report", "service_executive", []));
