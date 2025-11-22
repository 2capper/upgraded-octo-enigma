import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Copy, Download, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CalendarSubscriptionProps {
  type: 'team' | 'organization';
  entityId: string;
  organizationId: string;
  currentToken?: string | null;
  entityName: string;
}

export function CalendarSubscription({
  type,
  entityId,
  organizationId,
  currentToken,
  entityName,
}: CalendarSubscriptionProps) {
  const { toast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === 'team'
        ? `/api/organizations/${organizationId}/house-league-teams/${entityId}/generate-calendar-token`
        : `/api/organizations/${organizationId}/generate-calendar-token`;
      
      return await apiRequest('POST', endpoint, {});
    },
    onSuccess: () => {
      if (type === 'team') {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/house-league-teams`] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}`] });
      }
      toast({
        title: "Calendar token generated",
        description: "You can now share your calendar subscription link",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate calendar token",
      });
    },
  });

  const subscriptionUrl = currentToken
    ? `${window.location.origin}/api/calendar/${type}/${currentToken}`
    : null;

  const handleCopy = async () => {
    if (!subscriptionUrl) return;
    
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      toast({
        title: "Link copied",
        description: "Calendar subscription link copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy link to clipboard",
      });
    }
  };

  const handleDownload = () => {
    if (!subscriptionUrl) return;
    window.open(subscriptionUrl, '_blank');
  };

  return (
    <Card data-testid="calendar-subscription-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Calendar Subscription
        </CardTitle>
        <CardDescription>
          Subscribe to {entityName}'s schedule in your calendar app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentToken ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Generate a calendar subscription link to automatically sync your schedule to Google Calendar, Apple Calendar, or Outlook.
            </p>
            <Button
              onClick={() => generateTokenMutation.mutate()}
              disabled={generateTokenMutation.isPending}
              data-testid="button-generate-token"
            >
              {generateTokenMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Calendar Link
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription URL</label>
              <div className="flex gap-2">
                <Input
                  value={subscriptionUrl}
                  readOnly
                  className="font-mono text-sm"
                  data-testid="input-subscription-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  data-testid="button-copy-url"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDownload}
                  data-testid="button-download-calendar"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInstructions(!showInstructions)}
                data-testid="button-toggle-instructions"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {showInstructions ? 'Hide' : 'Show'} Setup Instructions
              </Button>

              {showInstructions && (
                <div className="space-y-3 p-4 bg-muted rounded-lg text-sm" data-testid="setup-instructions">
                  <div>
                    <h4 className="font-semibold mb-2">Google Calendar</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open Google Calendar</li>
                      <li>Click the "+" next to "Other calendars"</li>
                      <li>Select "From URL"</li>
                      <li>Paste the subscription URL above</li>
                      <li>Click "Add calendar"</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Apple Calendar (Mac/iOS)</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open Calendar app</li>
                      <li>Go to File → New Calendar Subscription (Mac) or Settings → Accounts → Add Account (iOS)</li>
                      <li>Paste the subscription URL above</li>
                      <li>Click "Subscribe"</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Outlook</h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Open Outlook Calendar</li>
                      <li>Click "Add calendar" → "Subscribe from web"</li>
                      <li>Paste the subscription URL above</li>
                      <li>Name your calendar and click "Import"</li>
                    </ol>
                  </div>

                  <p className="text-xs text-muted-foreground italic mt-3">
                    Note: Calendar apps typically update subscriptions every few hours. Changes to your schedule will automatically sync.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateTokenMutation.mutate()}
                disabled={generateTokenMutation.isPending}
                data-testid="button-regenerate-token"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Link
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Regenerating will invalidate the old link. Anyone using it will need the new URL.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
