import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./auth.controller";

export const authRouter = Router();

authRouter.post("/signup", controller.signup);
authRouter.post("/login", controller.login);
authRouter.get("/me", requireAuth, controller.me);

