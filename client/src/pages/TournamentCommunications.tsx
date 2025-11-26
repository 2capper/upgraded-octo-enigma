import { useState, useMemo } from "react";
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
import { ArrowLeft, Send, MessageSquare, History, AlertCircle, CheckCircle, FileText, Edit, Trash2, Plus, Inbox, Mail, MailOpen, Target, Cloud, Calendar, Users, Zap, UserCheck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhoneForDisplay } from "@shared/phoneUtils";
import { format } from "date-fns";
import { useTournamentData } from "@/hooks/use-tournament-data";
import { CommunicationsComposeSkeleton } from "@/components/tournament/skeletons";
import type { Team } from "@shared/schema";

interface StaffMember {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  phone: string | null;
  role: "Coach" | "Manager" | "Assistant";
  division?: string;
  poolName?: string;
}

interface CommunicationTemplate {
  id: string;
  organizationId: string;
  name: string;
  content: string;
  category?: string;
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
  status?: string;
}

const QUICK_TEMPLATES = {
  weather: [
    { name: "Rain Delay - 1 Hour", content: "WEATHER UPDATE: All games are delayed by 1 hour due to rain. Please check back for updates. Thank you for your patience!" },
    { name: "Lightning Delay", content: "SAFETY ALERT: Lightning detected in the area. All games are suspended until 30 minutes after the last detected strike. Please seek shelter immediately." },
    { name: "Games Cancelled", content: "WEATHER CANCELLATION: Today's games have been cancelled due to weather conditions. We will communicate rescheduling information soon." },
    { name: "Heat Advisory", content: "HEAT ADVISORY: Due to extreme heat, all games will include extended water breaks. Please ensure players stay hydrated and watch for signs of heat exhaustion." },
  ],
  schedule: [
    { name: "Field Change", content: "FIELD CHANGE: Your next game has been moved to a different diamond. Please check the tournament dashboard for updated field assignment." },
    { name: "Time Change", content: "SCHEDULE UPDATE: Your game time has been adjusted. Please check the tournament dashboard for the new start time." },
    { name: "Playoff Seeding", content: "PLAYOFFS ANNOUNCED: Pool play is complete! Please check the tournament dashboard for playoff seedings and your next game time." },
  ],
  general: [
    { name: "Welcome Message", content: "Welcome to the tournament! Check the tournament dashboard for your schedule, standings, and real-time updates. Good luck!" },
    { name: "Parking Update", content: "PARKING INFO: Please note parking instructions for today's games. [Add details]" },
    { name: "Tournament Update", content: "TOURNAMENT UPDATE: [Your message here]" },
  ],
};

export default function TournamentCommunications() {
  const { orgId, tournamentId } = useParams<{ orgId: string; tournamentId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [messageBody, setMessageBody] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [poolFilter, setPoolFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickTemplateCategory, setQuickTemplateCategory] = useState<"weather" | "schedule" | "general">("weather");
  
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  const { teams, pools, currentTournament, isLoading: tournamentLoading } = useTournamentData(tournamentId || '');

  const { data: rateLimit } = useQuery({
    queryKey: [`/api/organizations/${orgId}/sms/rate-limit`],
    enabled: !!orgId,
  });

  const { data: messageHistory = [], isLoading: historyLoading } = useQuery<TournamentMessage[]>({
    queryKey: [`/api/organizations/${orgId}/tournaments/${tournamentId}/messages`],
    enabled: !!orgId && !!tournamentId,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CommunicationTemplate[]>({
    queryKey: [`/api/organizations/${orgId}/templates`],
    enabled: !!orgId,
  });

  const { data: inboundMessages = [], isLoading: inboxLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/sms/inbound`],
    enabled: !!orgId,
  });

  const staffMembers: StaffMember[] = useMemo(() => {
    const members: StaffMember[] = [];
    
    teams.forEach((team: Team) => {
      const pool = pools.find(p => p.id === team.poolId);
      const poolName = pool?.name || undefined;
      
      if (team.coachPhone) {
        members.push({
          id: `${team.id}-coach`,
          teamId: team.id,
          teamName: team.name,
          name: team.coachFirstName && team.coachLastName 
            ? `${team.coachFirstName} ${team.coachLastName}`
            : team.coach || "Unknown Coach",
          phone: team.coachPhone,
          role: "Coach",
          division: team.division || undefined,
          poolName,
        });
      }
      if (team.managerPhone && team.managerName) {
        members.push({
          id: `${team.id}-manager`,
          teamId: team.id,
          teamName: team.name,
          name: team.managerName,
          phone: team.managerPhone,
          role: "Manager",
          division: team.division || undefined,
          poolName,
        });
      }
      if (team.assistantPhone && team.assistantName) {
        members.push({
          id: `${team.id}-assistant`,
          teamId: team.id,
          teamName: team.name,
          name: team.assistantName,
          phone: team.assistantPhone,
          role: "Assistant",
          division: team.division || undefined,
          poolName,
        });
      }
    });
    
    return members;
  }, [teams, pools]);

  const availableDivisions = useMemo(() => {
    const divisions = new Set<string>();
    staffMembers.forEach(staff => {
      if (staff.division) divisions.add(staff.division);
    });
    return Array.from(divisions).sort();
  }, [staffMembers]);

  const availablePools = useMemo(() => {
    const poolNames = new Set<string>();
    staffMembers.forEach(staff => {
      if (staff.poolName) poolNames.add(staff.poolName);
    });
    return Array.from(poolNames).sort();
  }, [staffMembers]);

  const filteredStaffMembers = staffMembers.filter(staff => {
    const matchesPool = poolFilter === "all" || staff.poolName === poolFilter;
    const matchesDivision = divisionFilter === "all" || staff.division === divisionFilter;
    const matchesRole = roleFilter === "all" || staff.role.toLowerCase() === roleFilter;
    const matchesSearch = searchQuery === "" || 
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPool && matchesDivision && matchesRole && matchesSearch;
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { recipients: any[]; messageBody: string }) => {
      return apiRequest("POST", `/api/organizations/${orgId}/sms/send-bulk`, {
        ...data,
        tournamentId,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/tournaments/${tournamentId}/messages`] });
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/sms/rate-limit`] });
      toast({
        title: "Messages sent",
        description: `Successfully sent ${data.sent} message(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`,
      });
      setMessageBody("");
      setSelectedStaff(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send messages",
        variant: "destructive",
      });
    },
  });

  const requestContactsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/organizations/${orgId}/tournaments/${tournamentId}/request-staff-contacts`, {});
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

  const handleSend = () => {
    if (selectedStaff.size === 0) {
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

    setConfirmSendOpen(true);
  };
  
  const handleConfirmedSend = () => {
    if (!messageBody.trim() || selectedStaff.size === 0) {
      setConfirmSendOpen(false);
      return;
    }
    
    const recipients = filteredStaffMembers
      .filter(staff => selectedStaff.has(staff.id) && staff.phone)
      .map(staff => ({
        phone: staff.phone!,
        name: staff.name,
        teamId: staff.teamId,
      }));

    if (recipients.length === 0) {
      toast({
        title: "No valid recipients",
        description: "No staff members with valid phone numbers selected. Please ensure selected contacts have phone numbers.",
        variant: "destructive",
      });
      setConfirmSendOpen(false);
      return;
    }

    sendMutation.mutate({
      recipients,
      messageBody,
    });
    
    setConfirmSendOpen(false);
  };

  const toggleStaff = (staffId: string) => {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
  };

  const selectAll = () => {
    setSelectedStaff(new Set(filteredStaffMembers.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedStaff(new Set());
  };

  const characterCount = messageBody.length;
  const segmentCount = characterCount === 0 ? 0 : characterCount <= 160 ? 1 : Math.ceil(characterCount / 153);

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

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest("POST", `/api/organizations/${orgId}/sms/inbound/${messageId}/mark-read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/sms/inbound`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark message as read",
        variant: "destructive",
      });
    },
  });

  const unreadCount = inboundMessages.filter((msg: any) => !msg.isRead).length;

  if (tournamentLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <CommunicationsComposeSkeleton />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate(`/org/${orgId}/admin/tournaments/${tournamentId}`)}
        className="mb-4"
        data-testid="button-back"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Tournament
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          Tournament Communications
        </h1>
        <p className="text-muted-foreground mt-1">
          {currentTournament?.name ? `Send messages to ${currentTournament.name} participants` : 'Send messages to coaches, managers, and assistants'}
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
          <TabsTrigger value="compose" data-testid="tab-compose">Compose Message</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Message History</TabsTrigger>
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <div className="flex items-center gap-2">
              Inbox
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Recipients</CardTitle>
                <CardDescription>
                  Choose which staff members to send the message to
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Target className="h-4 w-4" />
                    Smart Targeting
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Pool</Label>
                      <Select value={poolFilter} onValueChange={setPoolFilter}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-pool-filter">
                          <SelectValue placeholder="All Pools" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Pools</SelectItem>
                          {availablePools.map((pool) => (
                            <SelectItem key={pool} value={pool}>
                              {pool}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Division</Label>
                      <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-division-filter">
                          <SelectValue placeholder="All Divisions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Divisions</SelectItem>
                          {availableDivisions.map((division) => (
                            <SelectItem key={division} value={division}>
                              {division}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Role</Label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="h-8 text-xs" data-testid="select-role-filter">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          <SelectItem value="coach">Coaches</SelectItem>
                          <SelectItem value="manager">Managers</SelectItem>
                          <SelectItem value="assistant">Assistants</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {(poolFilter !== "all" || divisionFilter !== "all" || roleFilter !== "all") && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        Filtering: {filteredStaffMembers.length} of {staffMembers.length} contacts
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-xs"
                        onClick={() => {
                          setPoolFilter("all");
                          setDivisionFilter("all");
                          setRoleFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
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
                    disabled={selectedStaff.size === 0}
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
                          checked={selectedStaff.has(staff.id)}
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
                  {selectedStaff.size} recipient{selectedStaff.size !== 1 ? "s" : ""} selected
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => requestContactsMutation.mutate()}
                    disabled={requestContactsMutation.isPending}
                    data-testid="button-request-contacts"
                  >
                    {requestContactsMutation.isPending ? (
                      <>Sending requests...</>
                    ) : (
                      <>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Request Staff Contacts from Coaches
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Send SMS asking coaches to add manager/assistant contacts
                  </p>
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
                <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4" />
                    Quick Templates
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant={quickTemplateCategory === "weather" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setQuickTemplateCategory("weather")}
                      data-testid="button-category-weather"
                    >
                      <Cloud className="h-3 w-3 mr-1" />
                      Weather
                    </Button>
                    <Button
                      variant={quickTemplateCategory === "schedule" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setQuickTemplateCategory("schedule")}
                      data-testid="button-category-schedule"
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Schedule
                    </Button>
                    <Button
                      variant={quickTemplateCategory === "general" ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setQuickTemplateCategory("general")}
                      data-testid="button-category-general"
                    >
                      <Users className="h-3 w-3 mr-1" />
                      General
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {QUICK_TEMPLATES[quickTemplateCategory].map((template, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        className="h-auto py-1 px-2 text-xs"
                        onClick={() => {
                          setMessageBody(template.content);
                          toast({
                            title: "Template Applied",
                            description: `"${template.name}" loaded into message editor`,
                          });
                        }}
                        data-testid={`quick-template-${quickTemplateCategory}-${index}`}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message-body">Message Body</Label>
                  <Textarea
                    id="message-body"
                    placeholder="Enter your message here..."
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    rows={8}
                    maxLength={480}
                    data-testid="textarea-message-body"
                    className={characterCount > 160 ? "border-amber-400 focus-visible:ring-amber-400" : ""}
                  />
                  <div className="flex justify-between text-xs">
                    <span className={`font-medium ${
                      characterCount > 160 
                        ? characterCount > 320 
                          ? "text-red-600" 
                          : "text-amber-600" 
                        : "text-muted-foreground"
                    }`}>
                      {characterCount}/480 characters
                      {characterCount > 160 && (
                        <span className="ml-1">
                          ({160 - (characterCount % 160) || 160} left in segment)
                        </span>
                      )}
                    </span>
                    <span className={`font-medium ${segmentCount > 1 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {segmentCount} SMS segment{segmentCount !== 1 ? "s" : ""}
                      {segmentCount > 1 && (
                        <span className="text-muted-foreground ml-1">(multi-part message)</span>
                      )}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sendMutation.isPending || selectedStaff.size === 0 || !messageBody.trim() || !rateLimit?.allowed}
                  className="w-full"
                  data-testid="button-send-messages"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendMutation.isPending
                    ? "Sending..."
                    : `Send to ${selectedStaff.size} Recipient${selectedStaff.size !== 1 ? "s" : ""}`}
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
                  {messageHistory.map((message) => (
                    <div
                      key={message.id}
                      className="border rounded-lg p-4 space-y-2"
                      data-testid={`message-${message.id}`}
                    >
                      <div className="flex justify-between items-start">
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
                        <Badge variant={
                          message.status === "delivered" ? "default" :
                          message.status === "sent" ? "secondary" :
                          message.status === "failed" ? "destructive" :
                          "outline"
                        }>
                          {message.status || "sent"}
                        </Badge>
                      </div>
                      <p className="text-sm">{message.content}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {format(new Date(message.sentAt), "MMM d, h:mm a")}
                        </span>
                        <span>
                          {message.recipientCount} recipient{message.recipientCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Smart Concierge Inbox
              </CardTitle>
              <CardDescription>
                Messages received from coaches via SMS auto-reply system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inboxLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading inbox...
                </div>
              ) : inboundMessages.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No messages yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    When coaches text your Twilio number, their messages will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inboundMessages.map((message: any) => (
                    <div
                      key={message.id}
                      className={`border rounded-lg p-4 space-y-2 ${
                        !message.isRead ? "bg-muted/50" : ""
                      }`}
                      data-testid={`inbound-message-${message.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {message.isRead ? (
                              <MailOpen className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Mail className="h-4 w-4 text-primary" />
                            )}
                            <span className="font-medium">
                              {message.senderName || formatPhoneForDisplay(message.fromPhone)}
                            </span>
                            {message.teamName && (
                              <Badge variant="outline" className="text-xs">
                                {message.teamName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm mt-2">{message.messageBody}</p>
                        </div>
                        {!message.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markReadMutation.mutate(message.id)}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(message.createdAt), "MMM d, h:mm a")}</span>
                        {!message.senderName && (
                          <span className="text-amber-600">
                            Unknown sender - sent fallback message
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
            <DialogDescription>
              You are about to send this message to {selectedStaff.size} recipient{selectedStaff.size !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-3 rounded-md text-sm max-h-32 overflow-y-auto">
            {messageBody}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmedSend} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? "Sending..." : "Send Messages"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Update your message template" : "Create a reusable message template"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Rain Delay Notification"
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-content">Message Content</Label>
              <Textarea
                id="template-content"
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                placeholder="Enter your template message..."
                rows={5}
                data-testid="textarea-template-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {editingTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
