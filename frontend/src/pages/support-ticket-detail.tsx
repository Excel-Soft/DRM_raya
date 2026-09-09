import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModuleData } from "@/hooks/use-module-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MessageSquare, Phone, Mail, MessageCircle, User } from "lucide-react";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Link, useParams } from "wouter";
import { RouteLoading, RouteInvalidId, RouteNotFound } from "@/components/route-states";
import { PageBreadcrumb } from "@/components/page-breadcrumb";

type SupportMessage = {
  id: string;
  ticketId: string;
  from: "customer" | "agent" | "system";
  body: string;
  sentAt: string;
};

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

const createMessageSchema = z.object({
  body: z.string().min(1, "Message cannot be empty"),
});

type CreateMessageFormData = z.infer<typeof createMessageSchema>;

export default function SupportTicketDetail() {
  const params = useParams();
  const ticketId = params.id;
  useModuleData(`/support/tickets/${ticketId}`);
  const { toast } = useToast();

  const { data: ticket, isLoading: isLoadingTicket } = useQuery<SupportTicket>({
    queryKey: ["/api/support/tickets", ticketId],
    enabled: !!ticketId,
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<SupportMessage[]>({
    queryKey: ["/api/support/tickets", ticketId, "messages"],
    enabled: !!ticketId,
  });

  const createMessageMutation = useMutation({
    mutationFn: async (data: CreateMessageFormData) => {
      return apiRequest("POST", "/api/support/messages", {
        ticketId,
        from: "agent",
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets", ticketId, "messages"] });
      form.reset();
      toast({
        title: "Success",
        description: "Message sent",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateMessageFormData>({
    resolver: zodResolver(createMessageSchema),
    defaultValues: {
      body: "",
    },
  });

  const onSubmit = (data: CreateMessageFormData) => {
    createMessageMutation.mutate(data);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageCircle className="h-4 w-4" data-testid="icon-channel-whatsapp" />;
      case "phone":
        return <Phone className="h-4 w-4" data-testid="icon-channel-phone" />;
      case "email":
        return <Mail className="h-4 w-4" data-testid="icon-channel-email" />;
      case "web":
      default:
        return <MessageSquare className="h-4 w-4" data-testid="icon-channel-web" />;
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

  const getMessageBgColor = (from: string) => {
    switch (from) {
      case "customer":
        return "bg-muted";
      case "agent":
        return "bg-primary/10";
      case "system":
        return "bg-accent/20";
      default:
        return "bg-muted";
    }
  };

  if (!ticketId) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <RouteInvalidId
          message="This ticket link is missing a valid id. Open it from the Tickets list."
          actionLabel="Back to Tickets"
          actionHref="/support/tickets"
        />
      </div>
    );
  }

  if (isLoadingTicket || isLoadingMessages) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <RouteLoading label="Loading ticket details…" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <RouteNotFound
          message="This ticket could not be found. It may have been removed."
          actionLabel="Back to Tickets"
          actionHref="/support/tickets"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <PageBreadcrumb
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Support" },
            { label: "Tickets", href: "/support/tickets" },
            { label: ticket.subject },
          ]}
          title={ticket.subject}
        />
        <div className="flex items-center gap-4">
          <Link href="/support/tickets">
            <Button variant="outline" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold" data-testid="text-ticket-subject">{ticket.subject}</h1>
          </div>
        </div>

        <Card data-testid="card-ticket-info">
          <CardHeader>
            <CardTitle data-testid="text-ticket-info-title">Ticket Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-status">Status</div>
                <Badge className={getStatusColor(ticket.status)} data-testid="badge-status">
                  {ticket.status}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-priority">Priority</div>
                <Badge className={getPriorityColor(ticket.priority)} data-testid="badge-priority">
                  {ticket.priority}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-channel">Channel</div>
                <div className="flex items-center gap-2" data-testid="text-channel">
                  {getChannelIcon(ticket.channel)}
                  <span>{ticket.channel.charAt(0).toUpperCase() + ticket.channel.slice(1)}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-created">Created</div>
                <div className="text-sm" data-testid="text-created">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {ticket.customer && (
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-customer">Customer</div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span data-testid="text-customer-name">{ticket.customer.companyName}</span>
                  <span className="text-muted-foreground text-sm" data-testid="text-customer-email">
                    ({ticket.customer.email})
                  </span>
                </div>
              </div>
            )}

            {ticket.assignedTo && (
              <div>
                <div className="text-sm text-muted-foreground" data-testid="label-assigned">Assigned To</div>
                <div className="text-sm" data-testid="text-assigned-name">{ticket.assignedTo.name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-messages">
          <CardHeader>
            <CardTitle data-testid="text-messages-title">Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8" data-testid="text-no-messages">
                No messages yet
              </div>
            ) : (
              <div className="space-y-3">
                {messages.slice().reverse().map((message) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${getMessageBgColor(message.from)}`}
                    data-testid={`message-${message.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" data-testid={`badge-from-${message.id}`}>
                          {message.from === "customer" ? "Customer" : message.from === "agent" ? "Agent" : "System"}
                        </Badge>
                        <span className="text-xs text-muted-foreground" data-testid={`text-time-${message.id}`}>
                          {new Date(message.sentAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap" data-testid={`text-body-${message.id}`}>
                      {message.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {ticket.status !== "Resolved" && (
          <Card data-testid="card-reply">
            <CardHeader>
              <CardTitle data-testid="text-reply-title">Send Reply</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel data-testid="label-message">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Type your response..."
                            rows={4}
                            data-testid="textarea-message"
                          />
                        </FormControl>
                        <FormMessage data-testid="error-message" />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={createMessageMutation.isPending} data-testid="button-send">
                      <Send className="mr-2 h-4 w-4" />
                      {createMessageMutation.isPending ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
