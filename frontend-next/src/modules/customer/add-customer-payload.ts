import type { CustomerFormData } from "./add-customer-constants";

export function buildCreateCustomerPayload(
  data: CustomerFormData,
  emailsList: string[],
  mobilesList: string[],
  selectedServices: string[],
  editCustomerId: string | null,
) {
  const validEmails = emailsList.map((e) => e.trim().toLowerCase()).filter(Boolean);
  const validMobiles = mobilesList.map((m) => m.trim()).filter(Boolean);

  return {
    company: data.companyName,
    accountHolder: data.accountName,
    email: validEmails[0] || data.email,
    emails: validEmails,
    phone: data.phone,
    ntn: data.ntn,
    cnic: data.cnic,
    mobile: validMobiles[0] || data.mobile,
    mobiles: validMobiles,
    crmId: data.crmId,
    crmDate: data.crmDate,
    grade: data.grade,
    stage: data.status || "New",
    lastNote: data.comment,
    serviceTypes: selectedServices,
    region: data.region,
    source: data.source,
    companyType: data.companyType,
    personName: data.personName,
    designation: data.designation,
    rcLink: data.rcLink,
    businessLine: data.businessLine,
    title: data.title,
    website: data.website,
    address: data.address,
    city: data.city,
    country: data.country,
    abType: data.abType,
    id: editCustomerId,
  };
}
