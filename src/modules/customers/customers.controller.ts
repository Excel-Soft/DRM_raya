import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { badRequest, unauthorized } from "../../utils/errors";
import { buildCsvTemplate, parseCsvBuffer } from "../../utils/csv";
import {
  createCustomerSchema,
  duplicateCheckSchema,
  listCustomersQuerySchema,
} from "./customers.validators";
import { customersService } from "./customers.service";

const upload = multer({ storage: multer.memoryStorage() });
export const importUploadMiddleware = upload.single("file");

function authCtx(req: Request) {
  if (!req.authUser) throw unauthorized();
  return { userId: req.authUser.id, role: req.authUser.role };
}

export async function checkDuplicates(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = duplicateCheckSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid request data", parsed.error.issues);

    const result = await customersService.checkDuplicates(authCtx(req), parsed.data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createCustomerSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid request data", parsed.error.issues);

    const result = await customersService.createCustomer(authCtx(req), parsed.data);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listCustomersQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest("Invalid query params", parsed.error.issues);

    const result = await customersService.listCustomers(authCtx(req), parsed.data);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customerId = z.string().uuid().parse(req.params.id);
    const result = await customersService.getCustomerById(authCtx(req), customerId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function importCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw badRequest("Missing file field 'file'");

    const auth = authCtx(req);
    const records = parseCsvBuffer(req.file.buffer);

    const errors: unknown[] = [];
    let created = 0;
    let skipped = 0;

    for (let index = 0; index < records.length; index++) {
      const row = records[index];

      try {
        const companyName = row.companyName || row.company_name || "";
        const email = row.email || "";
        const accountHolderName = row.accountHolderName || row.account_holder_name || "";
        const phone = row.phone || "";

        if (!companyName || !email || !accountHolderName) {
          skipped++;
          errors.push({
            row: index + 1,
            code: "INVALID_ROW",
            message: "Missing required fields (companyName, email, accountHolderName)",
          });
          continue;
        }

        const dup = await customersService.checkDuplicates(auth, { companyName, email, phone });
        if (dup.isDuplicate) {
          skipped++;
          errors.push({
            row: index + 1,
            code: "DUPLICATE",
            message: "Duplicate detected",
            matches: dup.matches,
          });
          continue;
        }

        await customersService.createCustomer(auth, {
          companyName,
          country: row.country || undefined,
          city: row.city || undefined,
          address: row.address || undefined,
          website: row.website || undefined,
          region: row.region || undefined,
          lead: {
            source: row.source || undefined,
            grade: row.grade || undefined,
            status: row.status || undefined,
            rcLink: row.rcLink || row.rc_link || undefined,
          },
          primaryContact: {
            title: row.title || undefined,
            personName: row.personName || row.person_name || undefined,
            accountHolderName,
            email,
            phone: phone || undefined,
            cnic: row.cnic || undefined,
            ntn: row.ntn || undefined,
          },
          forceCreate: true,
        });

        created++;
      } catch (error) {
        skipped++;
        errors.push({
          row: index + 1,
          code: "ROW_ERROR",
          message: "Failed to import row",
          details: String((error as any)?.message ?? error),
        });
      }
    }

    return res.json({
      totalRows: records.length,
      created,
      skipped,
      errors,
    });
  } catch (err) {
    return next(err);
  }
}

export function importTemplate(_req: Request, res: Response) {
  const headers = [
    "companyName",
    "country",
    "city",
    "address",
    "website",
    "region",
    "status",
    "source",
    "grade",
    "rcLink",
    "title",
    "personName",
    "accountHolderName",
    "cnic",
    "ntn",
    "email",
    "phone",
  ];

  const sampleRow = {
    companyName: "ABC Pvt Ltd",
    country: "Pakistan",
    city: "Lahore",
    address: "Street 1",
    website: "https://example.com",
    region: "Central",
    status: "New",
    source: "Facebook",
    grade: "A",
    rcLink: "https://...",
    title: "Mr",
    personName: "Ali",
    accountHolderName: "Ali",
    cnic: "35202-1234567-1",
    ntn: "1234567",
    email: "ali@example.com",
    phone: "03001234567",
  };

  const csv = buildCsvTemplate(headers, sampleRow);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="customers_import_template.csv"');
  return res.status(200).send(csv);
}
