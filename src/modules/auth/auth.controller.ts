import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authService } from "./auth.service";
import { badRequest, unauthorized } from "../../utils/errors";

const signupSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  password: z.string().min(6).max(200),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid request data", parsed.error.issues);

    const result = await authService.signup(parsed.data);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid request data", parsed.error.issues);

    const result = await authService.login(parsed.data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.authUser) throw unauthorized();
    const result = await authService.me(req.authUser.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}
