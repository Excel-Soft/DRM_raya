import type { Express } from "express";
import multer from "multer";
import { requireRole } from "../middleware/auth.middleware";
import {
  getAttendanceLastImportDate,
  processAttendanceExcelBuffer,
} from "../services/attendance-excel-import.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const ALLOWED = [".xlsx", ".xls"];

export function registerAttendanceImportRoutes(app: Express) {
  app.get(
    "/api/account/attendance/import-meta",
    requireRole("account_manager", "admin"),
    async (_req, res) => {
      try {
        const lastDate = await getAttendanceLastImportDate();
        res.json({ success: true, lastDate });
      } catch (err) {
        console.error("[attendance/import-meta]", err);
        res.status(500).json({ error: "Failed to load attendance import metadata" });
      }
    },
  );

  app.post(
    "/api/account/attendance/import-excel",
    requireRole("account_manager", "admin"),
    (req, res) => {
      upload.single("attentiondoc")(req, res, async (err: unknown) => {
        if (err) {
          console.error("[attendance/import-excel] upload error:", err);
          return res.status(400).json({ error: "File upload failed" });
        }
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No file uploaded (field: attentiondoc)" });
        }
        const ext = (file.originalname.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
        if (!ALLOWED.includes(ext)) {
          return res.status(400).json({ error: "Invalid file format. Use .xlsx or .xls" });
        }
        try {
          const result = await processAttendanceExcelBuffer(file.buffer);
          res.json({
            success: true,
            message: "Attendance processed from Excel",
            ...result,
          });
        } catch (processErr: any) {
          console.error("[attendance/import-excel] process error:", processErr);
          res.status(500).json({
            error: processErr?.message || "Failed to process attendance Excel",
          });
        }
      });
    },
  );
}
