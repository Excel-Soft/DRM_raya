const fs = require('fs');

// 1. Update shared/schema.ts
let schema = fs.readFileSync('shared/schema.ts', 'utf8');
if (!schema.includes('export const SOFTWARE_PHASE_KEYS')) {
  const ppKeys = schema.match(/export const PRODUCT_POSTING_PHASE_KEYS = \[\s*[\s\S]*?\] as const;/s)[0];
  const ppLabels = schema.match(/export const PRODUCT_POSTING_PHASE_LABELS.*?\};/s)[0];
  
  const swKeys = ppKeys.replace(/PRODUCT_POSTING/g, 'SOFTWARE');
  const swLabels = ppLabels.replace(/PRODUCT_POSTING/g, 'SOFTWARE');
  
  const swPhaseTable = `
export const softwarePhaseDefinitions = drmSchema.table("software_phase_definitions", {
  phaseKey: varchar("phase_key", { length: 64 }).primaryKey(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isTerminal: boolean("is_terminal").notNull().default(false),
  canReturn: boolean("can_return").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSoftwarePhaseDefinitionSchema = createInsertSchema(softwarePhaseDefinitions);
export type SoftwarePhaseDefinition = typeof softwarePhaseDefinitions.$inferSelect;
`;
  
  schema = schema + '\n' + swKeys + '\n' + swLabels + '\n' + swPhaseTable;
  
  // also add types
  schema = schema + `\nexport type SoftwareWorkflow = typeof softwareWorkflows.$inferSelect;
export type SoftwareEvidenceLink = typeof softwareEvidenceLinks.$inferSelect;
export type SoftwareReworkHistory = typeof softwareReworkHistory.$inferSelect;
`;

  fs.writeFileSync('shared/schema.ts', schema);
}

// 2. Create service
let service = fs.readFileSync('server/services/product-posting-workflow.service.ts', 'utf8');
service = service.replace(/product_posting_/g, 'software_');
service = service.replace(/productPosting/g, 'software');
service = service.replace(/ProductPosting/g, 'Software');
service = service.replace(/PRODUCT_POSTING/g, 'SOFTWARE');
fs.writeFileSync('server/services/software-workflow.service.ts', service);

// 3. Create routes
let routes = fs.readFileSync('server/routes/product-posting-workflow-routes.ts', 'utf8');
routes = routes.replace(/product_posting_/g, 'software_');
routes = routes.replace(/productPosting/g, 'software');
routes = routes.replace(/ProductPosting/g, 'Software');
routes = routes.replace(/PRODUCT_POSTING/g, 'SOFTWARE');
routes = routes.replace(/\"\/product-posting\/manager\"/g, '\"/dashboard/software-manager\"');
routes = routes.replace(/\"\/product-posting\/executive\"/g, '\"/dashboard/software-executive\"');
routes = routes.replace(/dd_manager/g, 'software_manager'); 
routes = routes.replace(/dd_executive/g, 'software_executive'); 
routes = routes.replace(/d_d_executive/g, 'software_executive');
routes = routes.replace(/d_d_manager/g, 'software_manager');
routes = routes.replace(/"product_posting_manager"/g, '"software_manager"');
routes = routes.replace(/"product_posting_executive"/g, '"software_executive"');
routes = routes.replace(/"posting_executive"/g, '"software_executive"');
fs.writeFileSync('server/routes/software-workflow-routes.ts', routes);

console.log('Files generated successfully.');
