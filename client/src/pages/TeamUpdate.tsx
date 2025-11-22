import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, Users, Phone, User } from "lucide-react";

// Form validation schema
const teamUpdateSchema = z.object({
  managerName: z.string().optional(),
  managerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number with country code (e.g., +15551234567)").optional().or(z.literal("")),
  assistantName: z.string().optional(),
  assistantPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Please enter a valid phone number with country code (e.g., +15551234567)").optional().or(z.literal("")),
});

type TeamUpdateForm = z.infer<typeof teamUpdateSchema>;

interface TeamData {
  id: string;
  name: string;
  division: string;
  coachFirstName: string;
  coachLastName: string;
  coachPhone: string;
  managerName: string | null;
  managerPhone: string | null;
  assistantName: string | null;
  assistantPhone: string | null;
  tournament: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

export default function TeamUpdate() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch team data by token
  const { data: teamData, isLoading, error } = useQuery<TeamData>({
    queryKey: [`/api/team/update/${token}`],
    enabled: !!token && !isSubmitted,
  });

  const form = useForm<TeamUpdateForm>({
    resolver: zodResolver(teamUpdateSchema),
    defaultValues: {
      managerName: "",
      managerPhone: "",
      assistantName: "",
      assistantPhone: "",
    },
  });

  // Update form values when team data loads
  useEffect(() => {
    if (teamData) {
      form.reset({
        managerName: teamData.managerName || "",
        managerPhone: teamData.managerPhone || "",
        assistantName: teamData.assistantName || "",
        assistantPhone: teamData.assistantPhone || "",
      });
    }
  }, [teamData, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: TeamUpdateForm) => {
      return await apiRequest("POST", `/api/team/update/${token}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Team staff contacts updated successfully.",
      });
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: [`/api/team/update/${token}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update team contacts",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: TeamUpdateForm) {
    updateMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading team information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !teamData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
            <CardDescription>
              This team update link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    const shareUrl = `${window.location.origin}/team/update/${token}`;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-500">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-green-700 dark:text-green-400">Success!</CardTitle>
            <CardDescription>
              Team staff contacts have been updated successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium mb-2">Share this link with your staff:</p>
              <p className="text-xs text-muted-foreground break-all mb-3">{shareUrl}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast({
                    title: "Copied!",
                    description: "Link copied to clipboard",
                  });
                }}
                data-testid="button-copy-link"
              >
                Copy Link
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsSubmitted(false)}
              data-testid="button-edit-again"
            >
              Edit Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Update Team Staff Contacts</CardTitle>
              <CardDescription>{teamData.organization.name}</CardDescription>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm">
              <span className="font-medium">Tournament:</span> {teamData.tournament.name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Team:</span> {teamData.name} {teamData.division && `(${teamData.division})`}
            </p>
            <p className="text-sm">
              <span className="font-medium">Head Coach:</span> {teamData.coachFirstName} {teamData.coachLastName}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Team Manager</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="managerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Smith"
                          {...field}
                          data-testid="input-manager-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="managerPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager Phone</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder="+15551234567"
                            {...field}
                            data-testid="input-manager-phone"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Include country code (e.g., +1 for US/Canada)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assistant Coach</span>
                </div>

                <FormField
                  control={form.control}
                  name="assistantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assistant Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Jane Doe"
                          {...field}
                          data-testid="input-assistant-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="assistantPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assistant Phone</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="tel"
                            placeholder="+15551234567"
                            {...field}
                            data-testid="input-assistant-phone"
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Include country code (e.g., +1 for US/Canada)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={updateMutation.isPending}
                data-testid="button-submit"
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Contacts
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
