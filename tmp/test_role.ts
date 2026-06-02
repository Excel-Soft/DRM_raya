import { normalizeRole, isManagerialRole } from '../server/utils/role-utils'; console.log('normal:', normalizeRole('sales_executive')); console.log('manager:', isManagerialRole('sales_executive'));
