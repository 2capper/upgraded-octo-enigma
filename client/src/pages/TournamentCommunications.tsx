import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Send, Users, UserCheck, MessageSquare, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

const messageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  recipientType: z.enum(["coaches_only", "all_staff"]),
  templateId: z.string().optional(),
});

type MessageForm = z.infer<typeof messageSchema>;

interface CommunicationTemplate {
  id: string;
  name: string;
  content: string;
  organizationId: string;
  createdAt: string;
}

interface TournamentMessage {
  id: string;
  tournamentId: string;
  sentBy: string;
  content: string;
  recipientType: "coaches_only" | "all_staff";
  recipientCount: number;
  sentAt: string;
}

export default function TournamentCommunications() {
  const { orgId, tournamentId } = useParams<{ orgId: string; tournamentId: string }>();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Fetch templates
  const { data: templates, isLoading: templatesLoading } = useQuery<CommunicationTemplate[]>({
    queryKey: [`/api/organizations/${orgId}/templates`],
    enabled: !!orgId,
  });

  // Fetch message history
  const { data: messages, isLoading: messagesLoading } = useQuery<TournamentMessage[]>({
    queryKey: [`/api/organizations/${orgId}/tournaments/${tournamentId}/messages`],
    enabled: !!orgId && !!tournamentId,
  });

  const form = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      content: "",
      recipientType: "coaches_only",
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: MessageForm) => {
      return await apiRequest("POST", `/api/organizations/${orgId}/tournaments/${tournamentId}/send-message`, {
        content: data.content,
        recipientType: data.recipientType,
      });
    },
    onSuccess: (response: any) => {
      toast({
        title: "Message Sent!",
        description: `Successfully sent to ${response.sentCount} recipient(s)`,
      });
      form.reset({
        content: "",
        recipientType: "coaches_only",
      });
      setSelectedTemplate("");
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/tournaments/${tournamentId}/messages`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const requestContactsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/organizations/${orgId}/tournaments/${tournamentId}/request-staff-contacts`, {});
    },
    onSuccess: (response: any) => {
      toast({
        title: "Requests Sent!",
        description: `Staff contact requests sent to ${response.sentCount} coach(es)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send requests",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: MessageForm) {
    sendMutation.mutate(values);
  }

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
    if (templateId) {
      const template = templates?.find(t => t.id === templateId);
      if (template) {
        form.setValue("content", template.content);
      }
    } else {
      form.setValue("content", "");
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tournament Communications</h1>
          <p className="text-muted-foreground">Send messages to coaches and staff</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Message Composer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Compose Message
            </CardTitle>
            <CardDescription>
              Send a message to tournament participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Template Selector */}
                {templates && templates.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Use Template (Optional)</label>
                    <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None - Write custom message</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Recipient Type */}
                <FormField
                  control={form.control}
                  name="recipientType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Send To</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-recipient-type">
                            <SelectValue placeholder="Select recipients" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="coaches_only">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4" />
                              <span>Coaches Only</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="all_staff">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>All Staff (Coaches + Managers + Assistants)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose who will receive this message
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Message Content */}
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Game 3 delayed 30 minutes due to weather..."
                          className="min-h-[120px]"
                          {...field}
                          data-testid="textarea-message"
                        />
                      </FormControl>
                      <FormDescription>
                        Tournament name will be prepended automatically
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendMutation.isPending}
                  data-testid="button-send"
                >
                  {sendMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => requestContactsMutation.mutate()}
                disabled={requestContactsMutation.isPending}
                data-testid="button-request-contacts"
              >
                {requestContactsMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Users className="mr-2 h-4 w-4" />
                Request Staff Contacts from Coaches
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Send SMS to all coaches asking them to add their team manager and assistant coach contacts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Message History
            </CardTitle>
            <CardDescription>
              Recent messages sent for this tournament
            </CardDescription>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="p-4 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {message.recipientType === "coaches_only" ? (
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Users className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">
                          {message.recipientType === "coaches_only" ? "Coaches" : "All Staff"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(message.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                    <div className="text-xs text-muted-foreground">
                      Sent to {message.recipientCount} recipient(s)
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  No messages sent yet. Use the form to send your first message.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
