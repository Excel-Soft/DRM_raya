import { Router } from "express";
import { UsersController } from "../controllers/users.controller";
import { requireActionPermission } from "../middleware/action-permission";

const router = Router();

const requireUserAdmin = requireActionPermission("user.manage", {
    roles: ["admin"],
    message: "You are not authorized to manage users.",
});

// Users
router.get("/", UsersController.listUsers);
router.post("/", requireUserAdmin, UsersController.createUser);
router.get("/groups", UsersController.getGroups);
router.post("/groups", requireUserAdmin, UsersController.createGroup);
router.patch("/groups/:id", requireUserAdmin, UsersController.updateGroup);
router.delete("/groups/:id", requireUserAdmin, UsersController.deleteGroup);
router.get("/:id", UsersController.getUser);
router.patch("/:id", requireUserAdmin, UsersController.updateUser);
router.patch("/:id/status", requireUserAdmin, UsersController.updateStatus);
router.delete("/:id", requireUserAdmin, UsersController.deleteUser);

// Team Members
router.get("/:id/team-members", UsersController.getTeamMembers);
router.post("/:id/team-members", requireUserAdmin, UsersController.addTeamMember);
router.delete("/:id/team-members/:memberId", requireUserAdmin, UsersController.removeTeamMember);

// Impersonate
router.post("/:id/impersonate", requireUserAdmin, UsersController.impersonateUser);

export default router;
