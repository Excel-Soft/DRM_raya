import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./customers.controller";

export const customersRouter = Router();

customersRouter.post("/check-duplicates", requireAuth, controller.checkDuplicates);
customersRouter.post("/", requireAuth, controller.createCustomer);
customersRouter.get("/", requireAuth, controller.listCustomers);
customersRouter.get("/import-template", controller.importTemplate);
customersRouter.get("/:id", requireAuth, controller.getCustomer);
customersRouter.post(
  "/import",
  requireAuth,
  controller.importUploadMiddleware,
  controller.importCustomers,
);

