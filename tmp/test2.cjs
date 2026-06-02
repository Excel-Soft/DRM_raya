const { Pool } = require('pg');
require('dotenv').config();

const ROLES = {
  ADMIN: "admin",
  SALES_MANAGER: "sales_manager",
  SALES_ASSISTANT_MANAGER: "sales_assistant_manager",
  SALES_EXECUTIVE: "sales_executive",
  ACCOUNT_MANAGER: "account_manager",
  DEVELOPER: "developer",
  HOD: "hod",
  SUPER_HOD: "super_hod",
  SERVICE_MANAGER: "service_manager",
};

function normalizeRole(role) {
  if (!role) return ROLES.SALES_EXECUTIVE;
  const normalized = role.toLowerCase().trim().replace(/\s+/g, '_');
  return normalized.replace(/[^a-z0-9_]/g, '');
}

function isManagerialRole(role) {
  if (!role) return false;
  const n = normalizeRole(role);
  const managerTerms = ["manager", "admin", "hod", "head", "supervisor"];
  return (
    [
      ROLES.ADMIN,
      ROLES.SALES_MANAGER,
      ROLES.SALES_ASSISTANT_MANAGER,
      ROLES.HOD,
      ROLES.SERVICE_MANAGER,
      ROLES.SUPER_HOD,
    ].includes(n) || managerTerms.some(term => n.includes(term))
  );
}

console.log("Is sales_executive a manager?", isManagerialRole('sales_executive'));
console.log("Is sale executive a manager?", isManagerialRole('sale executive'));
