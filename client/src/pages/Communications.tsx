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
import { ArrowLeft, Send, MessageSquare, History, AlertCircle, CheckCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPhoneForDisplay } from "@shared/phoneUtils";
import type { Team } from "@shared/schema";

interface Coach {
  teamId: string;
  teamName: string;
  coachName: string;
  coachPhone: string | null;
  division?: string;
  tournamentId: string;
  tournamentName: string;
}

export default function Communications() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [messageBody, setMessageBody] = useState("");
  const [selectedCoaches, setSelectedCoaches] = useState<Set<string>>(new Set());
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const coaches: Coach[] = [];
  orgTournaments.forEach((tournament: any) => {
    const tournamentTeams = tournament.teams || [];
    tournamentTeams.forEach((team: Team) => {
      if (team.coachPhone) {
        coaches.push({
          teamId: team.id,
          teamName: team.name,
          coachName: team.coachFirstName && team.coachLastName 
            ? `${team.coachFirstName} ${team.coachLastName}`
            : team.coach || "Unknown Coach",
          coachPhone: team.coachPhone,
          division: team.division || undefined,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
        });
      }
    });
  });

  const filteredCoaches = coaches.filter(coach => {
    const matchesTournament = tournamentFilter === "all" || coach.tournamentId === tournamentFilter;
    const matchesSearch = searchQuery === "" || 
      coach.coachName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coach.teamName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTournament && matchesSearch;
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { recipients: any[]; messageBody: string; tournamentId?: string }) => {
      return apiRequest(`/api/organizations/${orgId}/sms/send-bulk`, {
        method: "POST",
        body: JSON.stringify(data),
      });
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
        description: "Please select at least one coach to send the message to",
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

    const recipients = filteredCoaches
      .filter(coach => selectedCoaches.has(coach.teamId))
      .map(coach => ({
        phone: coach.coachPhone!,
        name: coach.coachName,
        teamId: coach.teamId,
      }));

    sendMutation.mutate({
      recipients,
      messageBody,
      tournamentId: tournamentFilter !== "all" ? tournamentFilter : undefined,
    });
  };

  const toggleCoach = (teamId: string) => {
    const newSelected = new Set(selectedCoaches);
    if (newSelected.has(teamId)) {
      newSelected.delete(teamId);
    } else {
      newSelected.add(teamId);
    }
    setSelectedCoaches(newSelected);
  };

  const selectAll = () => {
    setSelectedCoaches(new Set(filteredCoaches.map(c => c.teamId)));
  };

  const clearSelection = () => {
    setSelectedCoaches(new Set());
  };

  const characterCount = messageBody.length;
  const segmentCount = characterCount === 0 ? 0 : characterCount <= 160 ? 1 : Math.ceil(characterCount / 153);

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
          Send text messages to coaches and team managers
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
                  <Label htmlFor="search-coaches">Search Coaches</Label>
                  <Input
                    id="search-coaches"
                    placeholder="Search by name or team..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-coaches"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={filteredCoaches.length === 0}
                    data-testid="button-select-all"
                  >
                    Select All ({filteredCoaches.length})
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
                  {filteredCoaches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No coaches with phone numbers found
                    </p>
                  ) : (
                    filteredCoaches.map(coach => (
                      <div
                        key={coach.teamId}
                        className="flex items-start space-x-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                        onClick={() => toggleCoach(coach.teamId)}
                        data-testid={`coach-item-${coach.teamId}`}
                      >
                        <Checkbox
                          checked={selectedCoaches.has(coach.teamId)}
                          onCheckedChange={() => toggleCoach(coach.teamId)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{coach.coachName}</p>
                          <p className="text-xs text-muted-foreground truncate">{coach.teamName}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneForDisplay(coach.coachPhone)}
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
    </div>
  );
}
