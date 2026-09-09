import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModuleData } from "@/hooks/use-module-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Phone, Mail, MessageCircle, User } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type SupportTicket = {
  id: string;
  customerId?: string;
  channel: "whatsapp" | "web" | "email" | "phone";
  subject: string;
  status: "Open" | "InProgress" | "Resolved" | "Failed";
  priority: "Low" | "Medium" | "High";
  assignedToUserId?: string;
  dataSend: number;
  externalReference?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    companyName: string;
    accountName: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
};

const createTicketSchema = z.object({
  customerId: z.string().optional(),
  channel: z.enum(["whatsapp", "web", "email", "phone"]),
  subject: z.string().min(1, "Subject is required"),
  priority: z.enum(["Low", "Medium", "High"]),
});

type CreateTicketFormData = z.infer<typeof createTicketSchema>;

export default function SupportTickets() {
  useModuleData("/support/tickets");
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  const { data: tickets = [], isLoading: isLoadingTickets } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/tickets"],
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketFormData) => {
      return apiRequest("POST", "/api/support/tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Success",
        description: "Support ticket created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      return apiRequest("POST", `/api/support/tickets/${ticketId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({
        title: "Success",
        description: "Ticket status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateTicketFormData>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      channel: "web",
      subject: "",
      priority: "Medium",
    },
  });

  const onSubmit = (data: CreateTicketFormData) => {
    createTicketMutation.mutate(data);
  };

  const getChannelIcon = (channel: string, ticketId: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageCircle className="h-4 w-4" data-testid={`icon-channel-whatsapp-${ticketId}`} />;
      case "phone":
        return <Phone className="h-4 w-4" data-testid={`icon-channel-phone-${ticketId}`} />;
      case "email":
        return <Mail className="h-4 w-4" data-testid={`icon-channel-email-${ticketId}`} />;
      case "web":
      default:
        return <MessageSquare className="h-4 w-4" data-testid={`icon-channel-web-${ticketId}`} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "InProgress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "Resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "Failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "Medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "Low":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      default:
        return "";
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const statusMatch = selectedStatus === "all" || ticket.status === selectedStatus;
    const channelMatch = selectedChannel === "all" || ticket.channel === selectedChannel;
    return statusMatch && channelMatch;
  });

  if (isLoadingTickets) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="w-full">
          <div className="text-muted-foreground" data-testid="text-loading">Loading tickets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Support Tickets</h1>
            <p className="text-muted-foreground" data-testid="text-page-description">
              Manage customer support requests and inquiries
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-ticket">
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-ticket">
              <DialogHeader>
                <DialogTitle data-testid="text-dialog-title">Create Support Ticket</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-subject">Subject</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Brief description of the issue" data-testid="input-subject" />
                        </FormControl>
                        <FormMessage data-testid="error-subject" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="channel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-channel">Channel</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-channel">
                              <SelectValue placeholder="Select channel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="web" data-testid="select-item-channel-web">Web Chat</SelectItem>
                            <SelectItem value="whatsapp" data-testid="select-item-channel-whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="email" data-testid="select-item-channel-email">Email</SelectItem>
                            <SelectItem value="phone" data-testid="select-item-channel-phone">Phone</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage data-testid="error-channel" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-priority">Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Low" data-testid="select-item-priority-low">Low</SelectItem>
                            <SelectItem value="Medium" data-testid="select-item-priority-medium">Medium</SelectItem>
                            <SelectItem value="High" data-testid="select-item-priority-high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage data-testid="error-priority" />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-submit">
                      {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-48" data-testid="select-filter-status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="select-item-status-all">All Status</SelectItem>
              <SelectItem value="Open" data-testid="select-item-status-open">Open</SelectItem>
              <SelectItem value="InProgress" data-testid="select-item-status-inprogress">In Progress</SelectItem>
              <SelectItem value="Resolved" data-testid="select-item-status-resolved">Resolved</SelectItem>
              <SelectItem value="Failed" data-testid="select-item-status-failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger className="w-48" data-testid="select-filter-channel">
              <SelectValue placeholder="Filter by channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="select-item-channel-all">All Channels</SelectItem>
              <SelectItem value="web" data-testid="select-item-channel-filter-web">Web</SelectItem>
              <SelectItem value="whatsapp" data-testid="select-item-channel-filter-whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email" data-testid="select-item-channel-filter-email">Email</SelectItem>
              <SelectItem value="phone" data-testid="select-item-channel-filter-phone">Phone</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTickets.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12" data-testid="text-no-tickets">
              No tickets found
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="hover-elevate" data-testid={`card-ticket-${ticket.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(ticket.channel, ticket.id)}
                      <CardTitle className="text-base" data-testid={`text-subject-${ticket.id}`}>
                        {ticket.subject}
                      </CardTitle>
                    </div>
                    <Badge className={getStatusColor(ticket.status)} data-testid={`badge-status-${ticket.id}`}>
                      {ticket.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className={getPriorityColor(ticket.priority)} data-testid={`badge-priority-${ticket.id}`}>
                      {ticket.priority}
                    </Badge>
                    <span className="text-muted-foreground" data-testid={`text-channel-${ticket.id}`}>
                      {ticket.channel.charAt(0).toUpperCase() + ticket.channel.slice(1)}
                    </span>
                  </div>

                  {ticket.customer && (
                    <div className="text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span data-testid={`text-customer-${ticket.id}`}>{ticket.customer.companyName}</span>
                      </div>
                    </div>
                  )}

                  {ticket.assignedTo && (
                    <div className="text-sm text-muted-foreground" data-testid={`text-assigned-${ticket.id}`}>
                      Assigned to: {ticket.assignedTo.name}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Link href={`/support/tickets/${ticket.id}`}>
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-${ticket.id}`}>
                        View Details
                      </Button>
                    </Link>
                    {ticket.status !== "Resolved" && (
                      <Select
                        value={ticket.status}
                        onValueChange={(status) => updateStatusMutation.mutate({ ticketId: ticket.id, status })}
                      >
                        <SelectTrigger className="w-full h-8" data-testid={`select-status-${ticket.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open" data-testid={`select-item-status-open-${ticket.id}`}>Open</SelectItem>
                          <SelectItem value="InProgress" data-testid={`select-item-status-inprogress-${ticket.id}`}>In Progress</SelectItem>
                          <SelectItem value="Resolved" data-testid={`select-item-status-resolved-${ticket.id}`}>Resolved</SelectItem>
                          <SelectItem value="Failed" data-testid={`select-item-status-failed-${ticket.id}`}>Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
