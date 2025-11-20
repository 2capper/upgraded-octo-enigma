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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Cloud, CloudRain, Wind, Zap, Thermometer, AlertTriangle } from "lucide-react";

const weatherSettingsSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  isEnabled: z.boolean().default(true),
  lightningRadiusMiles: z.number().int().min(1).max(50).default(10),
  heatIndexThresholdF: z.number().int().min(70).max(120).default(94),
  windSpeedThresholdMph: z.number().int().min(10).max(60).default(25),
  precipitationThresholdPct: z.number().int().min(10).max(100).default(70),
});

type WeatherSettingsForm = z.infer<typeof weatherSettingsSchema>;

export default function WeatherSettings() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/weather-settings`],
    enabled: !!orgId,
  });

  const form = useForm<WeatherSettingsForm>({
    resolver: zodResolver(weatherSettingsSchema),
    values: settings ? {
      apiKey: "",
      isEnabled: settings.isEnabled ?? true,
      lightningRadiusMiles: settings.lightningRadiusMiles ?? 10,
      heatIndexThresholdF: settings.heatIndexThresholdF ?? 94,
      windSpeedThresholdMph: settings.windSpeedThresholdMph ?? 25,
      precipitationThresholdPct: settings.precipitationThresholdPct ?? 70,
    } : {
      apiKey: "",
      isEnabled: true,
      lightningRadiusMiles: 10,
      heatIndexThresholdF: 94,
      windSpeedThresholdMph: 25,
      precipitationThresholdPct: 70,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: WeatherSettingsForm) => {
      return apiRequest(`/api/organizations/${orgId}/weather-settings`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/weather-settings`] });
      toast({
        title: "Settings saved",
        description: "Weather configuration has been updated successfully",
      });
      form.reset({ ...form.getValues(), apiKey: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save weather settings",
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
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/booking/${orgId}`)}
        className="mb-4"
        data-testid="button-back-home"
      >
        ← Back to Home
      </Button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Cloud className="h-8 w-8" />
          Weather Settings
        </h1>
        <p className="text-muted-foreground">
          Configure weather forecasts and safety alerts for your games using WeatherAPI.com
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>WeatherAPI.com Configuration</CardTitle>
            <CardDescription>
              Get your free API key at{" "}
              <a
                href="https://www.weatherapi.com/signup.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                weatherapi.com
              </a>{" "}
              (1 million calls/month free)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            type={showApiKey ? "text" : "password"}
                            placeholder={settings?.apiKeyConfigured ? "Enter new API key to update" : "Enter your WeatherAPI.com API key"}
                            {...field}
                            data-testid="input-api-key"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowApiKey(!showApiKey)}
                          data-testid="button-toggle-api-key"
                        >
                          {showApiKey ? "Hide" : "Show"}
                        </Button>
                      </div>
                      {settings?.apiKeyConfigured && (
                        <FormDescription className="text-green-600 dark:text-green-400">
                          ✓ API key configured
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Weather Forecasts</FormLabel>
                        <FormDescription>
                          Automatically fetch weather forecasts for all games with location coordinates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-enable-weather"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/booking/${orgId}`)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-save-settings"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety Alert Thresholds</CardTitle>
            <CardDescription>
              Configure when weather alerts should be triggered (based on baseball safety guidelines)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-6">
                <FormField
                  control={form.control}
                  name="lightningRadiusMiles"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        Lightning Alert Radius (miles)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-lightning-radius"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when lightning detected within this radius (NCAA guideline: 6-10 miles)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="heatIndexThresholdF"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-red-500" />
                        Heat Index Threshold (°F)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={70}
                          max={120}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-heat-threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when heat index exceeds this value (NATA guideline: 94°F+)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="windSpeedThresholdMph"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-blue-500" />
                        Wind Speed Threshold (mph)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={60}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-wind-threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when wind gusts exceed this speed (affects play quality)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="precipitationThresholdPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CloudRain className="h-4 w-4 text-indigo-500" />
                        Precipitation Probability (%)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={10}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-precip-threshold"
                        />
                      </FormControl>
                      <FormDescription>
                        Alert when rain probability exceeds this percentage
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending}
                    data-testid="button-save-thresholds"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Thresholds"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              Baseball Weather Safety Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>⚡ Lightning:</strong> Evacuate immediately when lightning within 10 miles. Wait 30 minutes after last flash before resuming play.
            </div>
            <div>
              <strong>🌡️ Heat:</strong> Heat index 94°F+ increases heat illness risk. Increase hydration breaks every 15-20 minutes.
            </div>
            <div>
              <strong>💨 Wind:</strong> Winds 25+ mph affect pitch control and fly ball judgment. Consider delays for safety.
            </div>
            <div>
              <strong>🌧️ Rain:</strong> Monitor field conditions. Standing water creates injury risk and poor game quality.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
