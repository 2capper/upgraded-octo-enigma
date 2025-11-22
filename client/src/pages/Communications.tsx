import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Send, MessageSquare, History, AlertCircle, CheckCircle, FileText, Edit, Trash2, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPhoneForDisplay } from "@shared/phoneUtils";
import type { Team } from "@shared/schema";

interface StaffMember {
  id: string; // unique identifier for this staff member
  teamId: string;
  teamName: string;
  name: string;
  phone: string | null;
  role: "Coach" | "Manager" | "Assistant";
  division?: string;
  tournamentId: string;
  tournamentName: string;
}

interface CommunicationTemplate {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  createdAt: string;
}

export default function Communications() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [messageBody, setMessageBody] = useState("");
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set());
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Template management state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");

  const { data: orgTournaments = [] } = useQuery({
    queryKey: [`/api/organizations/${orgId}/tournaments-with-teams`],
    enabled: !!orgId,
  });

  const { data: rateLimit } = useQuery({
    queryKey: [`/api/organizations/${orgId}/sms/rate-limit`],
    enabled: !!orgId,
  });

  const { data: messageHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/sms/messages`],
    enabled: !!orgId,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CommunicationTemplate[]>({
    queryKey: [`/api/organizations/${orgId}/templates`],
    enabled: !!orgId,
  });

  const staffMembers: StaffMember[] = [];
  orgTournaments.forEach((tournament: any) => {
    const tournamentTeams = tournament.teams || [];
    tournamentTeams.forEach((team: Team) => {
      // Add coach
      if (team.coachPhone) {
        staffMembers.push({
          id: `${team.id}-coach`,
          teamId: team.id,
          teamName: team.name,
          name: team.coachFirstName && team.coachLastName 
            ? `${team.coachFirstName} ${team.coachLastName}`
            : team.coach || "Unknown Coach",
          phone: team.coachPhone,
          role: "Coach",
          division: team.division || undefined,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
        });
      }
      // Add manager
      if (team.managerPhone && team.managerName) {
        staffMembers.push({
          id: `${team.id}-manager`,
          teamId: team.id,
          teamName: team.name,
          name: team.managerName,
          phone: team.managerPhone,
          role: "Manager",
          division: team.division || undefined,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
        });
      }
      // Add assistant
      if (team.assistantPhone && team.assistantName) {
        staffMembers.push({
          id: `${team.id}-assistant`,
          teamId: team.id,
          teamName: team.name,
          name: team.assistantName,
          phone: team.assistantPhone,
          role: "Assistant",
          division: team.division || undefined,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
        });
      }
    });
  });

  const filteredStaffMembers = staffMembers.filter(staff => {
    const matchesTournament = tournamentFilter === "all" || staff.tournamentId === tournamentFilter;
    const matchesSearch = searchQuery === "" || 
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTournament && matchesSearch;
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { recipients: any[]; messageBody: string; tournamentId?: string }) => {
      return apiRequest("POST", `/api/organizations/${orgId}/sms/send-bulk`, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/sms/messages`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/sms/rate-limit`] });
      toast({
        title: "Messages sent",
        description: `Successfully sent ${data.sent} message(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
      });
      setMessageBody("");
      setSelectedCoaches(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send messages",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (selectedCoaches.size === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one staff member to send the message to",
        variant: "destructive",
      });
      return;
    }

    if (!messageBody.trim()) {
      toast({
        title: "Empty message",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }

    if (selectedCoaches.size > 20 && !confirm(`You are about to send ${selectedCoaches.size} messages. Continue?`)) {
      return;
    }

    const recipients = filteredStaffMembers
      .filter(staff => selectedCoaches.has(staff.id))
      .map(staff => ({
        phone: staff.phone!,
        name: staff.name,
        teamId: staff.teamId,
      }));

    sendMutation.mutate({
      recipients,
      messageBody,
      tournamentId: tournamentFilter !== "all" ? tournamentFilter : undefined,
    });
  };

  const toggleStaff = (staffId: string) => {
    const newSelected = new Set(selectedCoaches);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedCoaches(newSelected);
  };

  const selectAll = () => {
    setSelectedCoaches(new Set(filteredStaffMembers.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedCoaches(new Set());
  };

  const characterCount = messageBody.length;
  const segmentCount = characterCount === 0 ? 0 : characterCount <= 160 ? 1 : Math.ceil(characterCount / 153);

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      return apiRequest("POST", `/api/organizations/${orgId}/templates`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/templates`] });
      toast({
        title: "Template Created",
        description: "Message template has been saved successfully",
      });
      setTemplateDialogOpen(false);
      setTemplateName("");
      setTemplateContent("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; content: string }) => {
      return apiRequest("PATCH", `/api/organizations/${orgId}/templates/${data.id}`, {
        name: data.name,
        content: data.content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/templates`] });
      toast({
        title: "Template Updated",
        description: "Message template has been updated successfully",
      });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      setTemplateName("");
      setTemplateContent("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update template",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return apiRequest("DELETE", `/api/organizations/${orgId}/templates/${templateId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/templates`] });
      toast({
        title: "Template Deleted",
        description: "Message template has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateContent("");
    setTemplateDialogOpen(true);
  };

  const handleEditTemplate = (template: CommunicationTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || !templateContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name and content are required",
        variant: "destructive",
      });
      return;
    }

    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        name: templateName,
        content: templateContent,
      });
    } else {
      createTemplateMutation.mutate({
        name: templateName,
        content: templateContent,
      });
    }
  };

  const handleUseTemplate = (template: CommunicationTemplate) => {
    setMessageBody(template.content);
    toast({
      title: "Template Applied",
      description: `"${template.name}" has been loaded into the message editor`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate(`/org/${orgId}/admin`)}
        className="mb-4"
        data-testid="button-back-home"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin Portal
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          SMS Communications
        </h1>
        <p className="text-muted-foreground mt-1">
          Send text messages to coaches, managers, and assistants
        </p>
      </div>

      {!rateLimit?.allowed && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {rateLimit?.error || "SMS sending is currently unavailable"}
          </AlertDescription>
        </Alert>
      )}

      {rateLimit?.allowed && rateLimit?.remaining !== undefined && (
        <Alert className="mb-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {rateLimit.remaining} messages remaining in current limit
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose">Compose Message</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Message History</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Recipients</CardTitle>
                <CardDescription>
                  Choose which coaches to send the message to
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tournament-filter">Filter by Tournament</Label>
                  <select
                    id="tournament-filter"
                    value={tournamentFilter}
                    onChange={(e) => setTournamentFilter(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    data-testid="select-tournament-filter"
                  >
                    <option value="all">All Tournaments</option>
                    {orgTournaments.map((tournament: any) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-staff">Search Staff</Label>
                  <Input
                    id="search-staff"
                    placeholder="Search by name, team, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-staff"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={filteredStaffMembers.length === 0}
                    data-testid="button-select-all"
                  >
                    Select All ({filteredStaffMembers.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedCoaches.size === 0}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 border rounded-md p-3">
                  {filteredStaffMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff members with phone numbers found
                    </p>
                  ) : (
                    filteredStaffMembers.map(staff => (
                      <div
                        key={staff.id}
                        className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => toggleStaff(staff.id)}
                        data-testid={`staff-item-${staff.id}`}
                      >
                        <Checkbox
                          checked={selectedCoaches.has(staff.id)}
                          onCheckedChange={() => toggleStaff(staff.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{staff.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {staff.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{staff.teamName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneForDisplay(staff.phone)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="text-sm text-muted-foreground">
                  {selectedCoaches.size} recipient{selectedCoaches.size !== 1 ? "s" : ""} selected
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Message</CardTitle>
                <CardDescription>
                  Compose your message to send
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="message-body">Message Body</Label>
                  <Textarea
                    id="message-body"
                    placeholder="Enter your message here..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    rows={10}
                    maxLength={480}
                    data-testid="textarea-message-body"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{characterCount} / 480 characters</span>
                    <span>{segmentCount} SMS segment{segmentCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sendMutation.isPending || selectedCoaches.size === 0 || !messageBody.trim() || !rateLimit?.allowed}
                  className="w-full"
                  data-testid="button-send-messages"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : `Send to ${selectedCoaches.size} Recipient${selectedCoaches.size !== 1 ? "s" : ""}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Message Templates
                  </CardTitle>
                  <CardDescription>
                    Create reusable message templates for common communications
                  </CardDescription>
                </div>
                <Button onClick={handleCreateTemplate} data-testid="button-create-template">
                  <Plus className="mr-2 h-4 w-4" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading templates...
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No templates yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create templates for messages you send frequently
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`template-${template.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{template.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                            {template.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUseTemplate(template)}
                            data-testid={`button-use-template-${template.id}`}
                          >
                            Use
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTemplate(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete template "${template.name}"?`)) {
                                deleteTemplateMutation.mutate(template.id);
                              }
                            }}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(template.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Message History
              </CardTitle>
              <CardDescription>
                View all sent messages and their delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading message history...
                </div>
              ) : messageHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages sent yet
                </div>
              ) : (
                <div className="space-y-2">
                  {messageHistory.map((message: any) => (
                    <div
                      key={message.id}
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`message-${message.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{message.recipientName || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPhoneForDisplay(message.recipientPhone)}
                          </p>
                        </div>
                        <Badge variant={
                          message.status === "delivered" ? "default" :
                          message.status === "sent" ? "secondary" :
                          message.status === "failed" ? "destructive" :
                          "outline"
                        }>
                          {message.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{message.messageBody}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {new Date(message.createdAt).toLocaleString()}
                        </span>
                        <span>
                          {message.segmentCount} segment{message.segmentCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {message.errorMessage && (
                        <Alert variant="destructive">
                          <AlertDescription className="text-xs">
                            {message.errorMessage}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Create/Edit Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the template name and content"
                : "Create a new message template for reuse"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Game Delay Notification"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-content">Message Content</Label>
              <Textarea
                id="template-content"
                placeholder="Enter the template message..."
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={8}
                data-testid="textarea-template-content"
              />
              <div className="text-xs text-muted-foreground">
                {templateContent.length} characters
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                setEditingTemplate(null);
                setTemplateName("");
                setTemplateContent("");
              }}
              data-testid="button-cancel-template"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              {editingTemplate ? "Update" : "Create"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
