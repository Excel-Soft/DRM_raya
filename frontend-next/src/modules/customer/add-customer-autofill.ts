import type { CustomerFormData } from "./add-customer-constants";

/** Dev/QA helper — mirrors legacy `handleAutoFill` on Vite Add Customer. */
export function generateAddCustomerTestData(): {
  form: CustomerFormData;
  emails: string[];
  mobiles: string[];
  services: string[];
} {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const testCompanyName = `Testing Enterprise ${randomNum}`;
  const testPhone = `0300${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testEmail = `info${randomNum}@testenterprise.com`;
  const testMobile = `0321${Math.floor(1000000 + Math.random() * 9000000)}`;
  const testCnic = `35201${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testNtn = `1234${Math.floor(100000 + Math.random() * 900000)}`;
  const services = ["Mobile Responsive Website", "Alibaba Services"];

  const form: CustomerFormData = {
    companyName: testCompanyName,
    country: "Pakistan",
    city: "Lahore",
    address: "Suite 404, Business Complex, Gulberg III",
    crmId: `CRM-${randomNum}`,
    crmDate: new Date().toISOString().split("T")[0],
    phone: testPhone,
    companyType: "Private Limited",
    title: "Mr",
    personName: "Hanan Raza",
    accountName: "Hanan Textiles",
    cnic: testCnic,
    ntn: testNtn,
    website: `https://www.testenterprise${randomNum}.com`,
    email: testEmail,
    emails: [testEmail],
    mobile: testMobile,
    mobiles: [testMobile],
    designation: "Managing Director",
    comment: "Auto-filled test customer record for rapid validation testing.",
    rcLink: `https://rc.webexcels.com/lead/${randomNum}`,
    source: "WebExcels",
    grade: "A",
    status: "New",
    serviceTypes: services,
    businessLine: "Manufacturing",
    abType: "GS",
    region: "Pakistan",
  };

  return { form, emails: [testEmail], mobiles: [testMobile], services };
}
