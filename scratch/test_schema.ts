import { insertLoanRequestSchema } from "../shared/schema";

console.log(insertLoanRequestSchema.safeParse({
  amount: "100",
  installmentAmount: "50",
  remainingAmount: "100",
  detail: "test",
  status: "Pending",
  userId: "123e4567-e89b-12d3-a456-426614174000"
}));
