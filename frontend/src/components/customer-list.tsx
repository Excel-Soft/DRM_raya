import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Calendar, Phone, Mail } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type LeadGrade = "A+" | "A-" | "B+" | "B-" | "C+" | "C" | "D";
type ProjectStage = "Lead" | "Payment Done" | "Verification" | "Membership Active";

interface Customer {
  id: string;
  company: string;
  accountId: string;
  email: string;
  phone: string;
  grade: LeadGrade;
  nextFollowUp: string;
  stage: ProjectStage;
}

//todo: remove mock functionality
const mockCustomers: Customer[] = [
  {
    id: "1",
    company: "Acme Corp",
    accountId: "AC-001",
    email: "contact@acme.com",
    phone: "+1-555-0101",
    grade: "A+",
    nextFollowUp: "2024-01-15",
    stage: "Payment Done",
  },
  {
    id: "2",
    company: "TechStart Inc",
    accountId: "TS-042",
    email: "info@techstart.com",
    phone: "+1-555-0102",
    grade: "B+",
    nextFollowUp: "2024-01-16",
    stage: "Lead",
  },
  {
    id: "3",
    company: "Global Trade Co",
    accountId: "GT-123",
    email: "sales@globaltrade.com",
    phone: "+1-555-0103",
    grade: "A-",
    nextFollowUp: "2024-01-14",
    stage: "Verification",
  },
];

const gradeColors: Record<LeadGrade, string> = {
  "A+": "bg-chart-2 text-white",
  "A-": "bg-chart-2/80 text-white",
  "B+": "bg-chart-1 text-white",
  "B-": "bg-chart-1/80 text-white",
  "C+": "bg-chart-3 text-white",
  "C": "bg-chart-3/80 text-white",
  "D": "bg-destructive text-white",
};

const stageColors: Record<ProjectStage, "default" | "secondary" | "outline"> = {
  "Lead": "outline",
  "Payment Done": "secondary",
  "Verification": "default",
  "Membership Active": "default",
};

export function CustomerList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [customers] = useState<Customer[]>(mockCustomers);

  const filteredCustomers = customers.filter(
    (c) =>
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.accountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card data-testid="card-customer-list">
      <CardHeader>
        <CardTitle>Customer Follow-up & Grading</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by company or account ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-customers"
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Account ID</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                  <TableCell className="font-medium">{customer.company}</TableCell>
                  <TableCell className="font-mono text-sm">{customer.accountId}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {customer.email}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", gradeColors[customer.grade])}>
                      {customer.grade}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {customer.nextFollowUp}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stageColors[customer.stage]}>{customer.stage}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => console.log("View customer:", customer.id)}
                      data-testid={`button-view-${customer.id}`}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
