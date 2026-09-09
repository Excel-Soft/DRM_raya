import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Lead {
  id: string;
  company: string;
  accountId: string;
  email: string;
  phone: string;
  status: "Expired" | "Unassigned" | "External";
}

//todo: remove mock functionality
const publicLeads: Lead[] = [
  {
    id: "1",
    company: "Import Solutions Ltd",
    accountId: "IS-890",
    email: "contact@importsol.com",
    phone: "+1-555-0201",
    status: "Expired",
  },
  {
    id: "2",
    company: "Export Masters",
    accountId: "EM-445",
    email: "info@exportmasters.com",
    phone: "+1-555-0202",
    status: "Unassigned",
  },
  {
    id: "3",
    company: "Trade Bridge Co",
    accountId: "TB-667",
    email: "sales@tradebridge.com",
    phone: "+1-555-0203",
    status: "External",
  },
];

export function PublicPool() {
  return (
    <Card data-testid="card-public-pool">
      <CardHeader>
        <CardTitle className="text-base">Public Pool</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-3">
            {publicLeads.map((lead) => (
              <Card key={lead.id} className="hover-elevate" data-testid={`lead-${lead.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-sm">{lead.company}</CardTitle>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {lead.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground">
                    ID: {lead.accountId}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {lead.email}
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {lead.phone}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => console.log("Claim lead:", lead.id)}
                    data-testid={`button-claim-${lead.id}`}
                  >
                    Claim Lead
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
