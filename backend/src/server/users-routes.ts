import { Router } from "express";
import { UsersController } from "./controllers/users.controller";

const router = Router();

// Specific/static paths first — Express would otherwise let the generic
// "/:id" routes below swallow these (e.g. GET /groups matching GET /:id
// with id="groups").
router.get("/groups", UsersController.getGroups);
router.post("/groups", UsersController.createGroup);
router.patch("/groups/:id", UsersController.updateGroup);
router.delete("/groups/:id", UsersController.deleteGroup);

router.get("/:id/team-members", UsersController.getTeamMembers);
router.post("/:id/team-members", UsersController.addTeamMember);
router.delete("/:id/team-members/:memberId", UsersController.removeTeamMember);

router.post("/:id/impersonate", UsersController.impersonateUser);
router.patch("/:id/status", UsersController.updateStatus);

router.get("/", UsersController.listUsers);
router.post("/", UsersController.createUser);
router.get("/:id", UsersController.getUser);
router.patch("/:id", UsersController.updateUser);
router.delete("/:id", UsersController.deleteUser);

export default router;
