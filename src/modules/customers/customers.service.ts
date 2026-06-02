import { and, count, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "../../db";
import { customerContacts, customers } from "../../db/schema";
import { ApiError, conflict, notFound } from "../../utils/errors";

export type AuthContext = { userId: string; role: string };

export type DuplicateMatch = {
  customerId: string;
  companyName: string;
  primaryEmail: string | null;
  phone: string | null;
  matchReasons: string[];
};

function normalizeRole(role: string): string {
  return role.trim().toLowerCase();
}

function isSalesExecutive(role: string): boolean {
  const r = normalizeRole(role);
  return r === "sales executive" || r === "sales_executive" || r === "sales-executive";
}

function isManagerOrAdmin(role: string): boolean {
  const r = normalizeRole(role);
  return r === "admin" || r === "sales manager" || r === "sales_manager" || r === "manager";
}

function scopedCustomerWhere(auth: AuthContext) {
  const conditions = [eq(customers.is_deleted, false)];
  if (isSalesExecutive(auth.role)) {
    conditions.push(eq(customers.created_by, auth.userId));
  }
  return and(...conditions);
}

function textIncludesCI(haystack: string | null | undefined, needle: string | null | undefined) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function mapCustomer(row: typeof customers.$inferSelect) {
  return {
    id: row.id,
    companyName: row.company_name,
    country: row.country,
    city: row.city,
    address: row.address,
    website: row.website,
    region: row.region,
    status: row.status,
    source: row.source,
    grade: row.grade,
    rcLink: row.rc_link,
    createdBy: row.created_by,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContact(row: typeof customerContacts.$inferSelect) {
  return {
    id: row.id,
    customerId: row.customer_id,
    isPrimary: row.is_primary,
    title: row.title,
    personName: row.person_name,
    accountHolderName: row.account_holder_name,
    cnic: row.cnic,
    ntn: row.ntn,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomersService {
  async checkDuplicates(
    auth: AuthContext,
    input: {
      companyName?: string;
      email?: string;
      phone?: string;
      cnic?: string;
      ntn?: string;
    },
  ): Promise<{ isDuplicate: boolean; matches: DuplicateMatch[] }> {
    const hasAny =
      !!input.companyName || !!input.email || !!input.phone || !!input.cnic || !!input.ntn;
    if (!hasAny) {
      return { isDuplicate: false, matches: [] };
    }

    const customerIds = new Set<string>();
    const contactMatchConditions = [];

    if (input.email) contactMatchConditions.push(eq(customerContacts.email, input.email));
    if (input.phone) contactMatchConditions.push(eq(customerContacts.phone, input.phone));
    if (input.cnic) contactMatchConditions.push(eq(customerContacts.cnic, input.cnic));
    if (input.ntn) contactMatchConditions.push(eq(customerContacts.ntn, input.ntn));

    if (contactMatchConditions.length > 0) {
      const rows = await db
        .select({ customerId: customerContacts.customer_id })
        .from(customerContacts)
        .innerJoin(customers, eq(customers.id, customerContacts.customer_id))
        .where(and(scopedCustomerWhere(auth), or(...contactMatchConditions)));

      for (const row of rows) customerIds.add(row.customerId);
    }

    if (input.companyName) {
      const rows = await db
        .select({ customerId: customers.id })
        .from(customers)
        .where(and(scopedCustomerWhere(auth), ilike(customers.company_name, `%${input.companyName}%`)));

      for (const row of rows) customerIds.add(row.customerId);
    }

    if (customerIds.size === 0) {
      return { isDuplicate: false, matches: [] };
    }

    const ids = Array.from(customerIds);
    const customerRows = await db
      .select({
        id: customers.id,
        company_name: customers.company_name,
      })
      .from(customers)
      .where(and(scopedCustomerWhere(auth), inArray(customers.id, ids)));

    const primaryContacts = await db
      .select({
        customer_id: customerContacts.customer_id,
        email: customerContacts.email,
        phone: customerContacts.phone,
        cnic: customerContacts.cnic,
        ntn: customerContacts.ntn,
        is_primary: customerContacts.is_primary,
      })
      .from(customerContacts)
      .where(inArray(customerContacts.customer_id, ids));

    const contactsByCustomer = new Map<string, typeof primaryContacts>();
    for (const contact of primaryContacts) {
      const existing = contactsByCustomer.get(contact.customer_id) ?? [];
      existing.push(contact);
      contactsByCustomer.set(contact.customer_id, existing);
    }

    const matches: DuplicateMatch[] = [];
    for (const c of customerRows) {
      const contacts = contactsByCustomer.get(c.id) ?? [];
      const preferred = contacts.find((x) => x.is_primary) ?? contacts[0];

      const reasons: string[] = [];
      if (input.companyName && textIncludesCI(c.company_name, input.companyName)) {
        reasons.push("companyName");
      }
      if (input.email && contacts.some((x) => x.email === input.email)) reasons.push("email");
      if (input.phone && contacts.some((x) => x.phone === input.phone)) reasons.push("phone");
      if (input.cnic && contacts.some((x) => x.cnic === input.cnic)) reasons.push("cnic");
      if (input.ntn && contacts.some((x) => x.ntn === input.ntn)) reasons.push("ntn");

      matches.push({
        customerId: c.id,
        companyName: c.company_name,
        primaryEmail: preferred?.email ?? null,
        phone: preferred?.phone ?? null,
        matchReasons: Array.from(new Set(reasons)),
      });
    }

    return { isDuplicate: matches.length > 0, matches };
  }

  async createCustomer(
    auth: AuthContext,
    input: {
      companyName: string;
      country?: string;
      city?: string;
      address?: string;
      website?: string;
      region?: string;
      lead?: { rcLink?: string; source?: string; grade?: string; status?: string };
      primaryContact: {
        title?: string;
        personName?: string;
        accountHolderName: string;
        cnic?: string;
        ntn?: string;
        email: string;
        phone?: string;
      };
      forceCreate: boolean;
    },
  ) {
    const dup = await this.checkDuplicates(auth, {
      companyName: input.companyName,
      email: input.primaryContact.email,
      phone: input.primaryContact.phone,
      cnic: input.primaryContact.cnic,
      ntn: input.primaryContact.ntn,
    });

    if (dup.isDuplicate && !input.forceCreate) {
      throw conflict("Duplicate customer found", dup.matches as unknown[]);
    }

    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .insert(customers)
        .values({
          company_name: input.companyName,
          country: input.country,
          city: input.city,
          address: input.address,
          website: input.website,
          region: input.region,
          status: input.lead?.status ?? "New",
          source: input.lead?.source,
          grade: input.lead?.grade,
          rc_link: input.lead?.rcLink,
          created_by: auth.userId,
          is_deleted: false,
        })
        .returning();

      const [primaryContact] = await tx
        .insert(customerContacts)
        .values({
          customer_id: customer.id,
          is_primary: true,
          title: input.primaryContact.title,
          person_name: input.primaryContact.personName,
          account_holder_name: input.primaryContact.accountHolderName,
          cnic: input.primaryContact.cnic,
          ntn: input.primaryContact.ntn,
          email: input.primaryContact.email,
          phone: input.primaryContact.phone,
        })
        .returning();

      return { customer: mapCustomer(customer), primaryContact: mapContact(primaryContact) };
    });

    return result;
  }

  async listCustomers(
    auth: AuthContext,
    input: { search?: string; status?: string; page: number; limit: number },
  ) {
    const offset = (input.page - 1) * input.limit;
    const conditions = [scopedCustomerWhere(auth)];

    if (input.status) {
      conditions.push(eq(customers.status, input.status));
    }
    if (input.search) {
      conditions.push(ilike(customers.company_name, `%${input.search}%`));
    }

    const where = and(...conditions);

    const [{ total }] = await db
      .select({ total: count() })
      .from(customers)
      .where(where);

    const items = await db
      .select({
        id: customers.id,
        company_name: customers.company_name,
        country: customers.country,
        city: customers.city,
        region: customers.region,
        status: customers.status,
        created_at: customers.created_at,
        updated_at: customers.updated_at,
        primary_email: customerContacts.email,
        primary_phone: customerContacts.phone,
      })
      .from(customers)
      .leftJoin(
        customerContacts,
        and(eq(customerContacts.customer_id, customers.id), eq(customerContacts.is_primary, true)),
      )
      .where(where)
      .limit(input.limit)
      .offset(offset);

    return {
      items: items.map((row) => ({
        id: row.id,
        companyName: row.company_name,
        country: row.country,
        city: row.city,
        region: row.region,
        status: row.status,
        primaryEmail: row.primary_email ?? null,
        phone: row.primary_phone ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      page: input.page,
      limit: input.limit,
      total: Number(total),
    };
  }

  async getCustomerById(auth: AuthContext, customerId: string) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(scopedCustomerWhere(auth), eq(customers.id, customerId)))
      .limit(1);

    if (!customer) {
      throw notFound("Customer not found");
    }

    const contacts = await db
      .select()
      .from(customerContacts)
      .where(eq(customerContacts.customer_id, customerId));

    return { customer: mapCustomer(customer), contacts: contacts.map(mapContact) };
  }

  assertCanListAll(auth: AuthContext) {
    if (isSalesExecutive(auth.role)) return;
    if (isManagerOrAdmin(auth.role)) return;
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

export const customersService = new CustomersService();

