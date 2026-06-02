import { Router } from "express";
import { itAssetsRepository } from "./repositories/it-assets.repository";
import { insertItServerSchema, insertItDomainSchema, insertItBackupSchema } from "@shared/schema";

const router = Router();

// /api/it/*

// Servers
router.get("/servers", async (req, res) => {
  const list = await itAssetsRepository.listServers();
  res.json(list);
});

router.post("/servers", async (req, res) => {
  const result = insertItServerSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const server = await itAssetsRepository.createServer(result.data);
  res.json(server);
});

router.delete("/servers/:id", async (req, res) => {
  await itAssetsRepository.deleteServer(req.params.id);
  res.json({ success: true });
});

// Registries
router.get("/registries", async (req, res) => {
  const list = await itAssetsRepository.listRegistries();
  res.json(list);
});

router.delete("/registries/:id", async (req, res) => {
  await itAssetsRepository.deleteRegistry(req.params.id);
  res.json({ success: true });
});

// Hosting Packages
router.get("/hosting-packages", async (req, res) => {
  const list = await itAssetsRepository.listHostingPackages();
  res.json(list);
});

router.delete("/hosting-packages/:id", async (req, res) => {
  await itAssetsRepository.deleteHostingPackage(req.params.id);
  res.json({ success: true });
});

// Domains
router.get("/domains", async (req, res) => {
  const list = await itAssetsRepository.listDomains();
  res.json(list);
});

router.post("/domains", async (req, res) => {
  const result = insertItDomainSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const domain = await itAssetsRepository.createDomain(result.data);
  res.json(domain);
});

// Backups
router.get("/backups", async (req, res) => {
  const list = await itAssetsRepository.listBackups();
  res.json(list);
});

router.post("/backups", async (req, res) => {
  const result = insertItBackupSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const backup = await itAssetsRepository.createBackup(result.data);
  res.json(backup);
});

router.get("/system-report", async (req, res) => {
  const report = await itAssetsRepository.getSystemReport();
  res.json(report);
});

export default router;
