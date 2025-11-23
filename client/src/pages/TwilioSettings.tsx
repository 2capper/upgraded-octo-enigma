import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Shield, MessageCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const twilioSettingsSchema = z.object({
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth Token is required"),
  phoneNumber: z.string().min(1, "Phone number is required").regex(/^\+\d{10,15}$/, "Must be in E.164 format (+1234567890)"),
  dailyLimit: z.number().min(1).max(1000).default(100),
  rateLimit: z.number().min(1).max(500).default(100),
  autoReplyMessage: z.string().optional(),
});

type TwilioSettingsForm = z.infer<typeof twilioSettingsSchema>;

export default function TwilioSettings() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAuthToken, setShowAuthToken] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/twilio-settings`],
    enabled: !!orgId,
  });

  const form = useForm<TwilioSettingsForm>({
    resolver: zodResolver(twilioSettingsSchema),
    defaultValues: {
      accountSid: settings?.accountSid || "",
      authToken: "",
      phoneNumber: settings?.phoneNumber || "",
      dailyLimit: settings?.dailyLimit || 100,
      rateLimit: settings?.rateLimit || 100,
      autoReplyMessage: settings?.autoReplyMessage || "",
    },
    values: settings ? {
      accountSid: settings.accountSid,
      authToken: "",
      phoneNumber: settings.phoneNumber,
      dailyLimit: settings.dailyLimit,
      rateLimit: settings.rateLimit,
      autoReplyMessage: settings.autoReplyMessage || "",
    } : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: TwilioSettingsForm) => {
      return apiRequest("POST", `/api/organizations/${orgId}/twilio-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/twilio-settings`] });
      toast({
        title: "Settings saved",
        description: "Twilio configuration has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Twilio settings",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/org/${orgId}/admin`)}
        className="mb-4"
        data-testid="button-back-home"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Admin Portal
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SMS Communications Settings
          </CardTitle>
          <CardDescription>
            Configure Twilio credentials to enable SMS notifications for coaches and team managers.
            These settings are encrypted and stored securely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
              <FormField
                control={form.control}
                name="accountSid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account SID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        data-testid="input-account-sid"
                      />
                    </FormControl>
                    <FormDescription>
                      Find this in your Twilio Console dashboard
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auth Token</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showAuthToken ? "text" : "password"}
                          placeholder={settings?.authTokenConfigured ? "••••••••••••••••" : "Enter new auth token"}
                          data-testid="input-auth-token"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowAuthToken(!showAuthToken)}
                        >
                          {showAuthToken ? "Hide" : "Show"}
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {settings?.authTokenConfigured
                        ? "Leave blank to keep existing token, or enter a new one to update"
                        : "Find this in your Twilio Console (click the eye icon to view)"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Twilio Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="+15551234567"
                        data-testid="input-phone-number"
                      />
                    </FormControl>
                    <FormDescription>
                      Must be in E.164 format (e.g., +15551234567). This is the number messages will be sent from.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoReplyMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Smart Concierge Auto-Reply (Optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="This is an automated system. Please contact your Tournament Director directly."
                        rows={3}
                        maxLength={320}
                        data-testid="textarea-auto-reply-message"
                      />
                    </FormControl>
                    <FormDescription>
                      This message is sent when someone texts your Twilio number but we can't identify them.
                      If blank, a default message will be used. Coaches we recognize automatically receive their tournament dashboard link.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dailyLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Limit</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-daily-limit"
                        />
                      </FormControl>
                      <FormDescription>
                        Max messages per day
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rateLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Limit</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-rate-limit"
                        />
                      </FormControl>
                      <FormDescription>
                        Max per 15 minutes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full"
                data-testid="button-save-settings"
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Getting Your Twilio Credentials</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.twilio.com</a></li>
            <li>Sign in to your account (or create one if needed)</li>
            <li>Find your Account SID and Auth Token on the dashboard</li>
            <li>Purchase a phone number from Twilio (Phone Numbers → Buy a Number)</li>
            <li>Copy the number in E.164 format (+1 followed by area code and number)</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
