import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";

const bookingFormSchema = z.object({
  houseLeagueTeamId: z.string().min(1, "Please select a team"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  diamondId: z.string().min(1, "Please select a diamond"),
  purpose: z.enum(["practice", "game"], {
    required_error: "Please select a purpose",
  }),
  opponentName: z.string().optional(),
  requiresUmpire: z.boolean().default(false),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((data) => {
  if (data.purpose === "game" && !data.opponentName?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Opponent name is required for games",
  path: ["opponentName"],
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

interface HouseLeagueTeam {
  id: string;
  name: string;
  division: string;
}

interface Diamond {
  id: string;
  name: string;
  location?: string;
}

interface DiamondRestriction {
  id: string;
  division: string;
  allowedDiamonds: string[];
  reason?: string;
}

export default function NewBookingRequest() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: teams, isLoading: teamsLoading } = useQuery<HouseLeagueTeam[]>({
    queryKey: [`/api/organizations/${orgId}/house-league-teams`],
  });

  const { data: diamonds, isLoading: diamondsLoading } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${orgId}/diamonds`],
  });

  const { data: restrictions } = useQuery<DiamondRestriction[]>({
    queryKey: [`/api/organizations/${orgId}/diamond-restrictions`],
  });

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      houseLeagueTeamId: "",
      date: "",
      startTime: "",
      endTime: "",
      diamondId: "",
      purpose: "practice",
      opponentName: "",
      requiresUmpire: false,
      notes: "",
    },
  });

  const selectedTeamId = form.watch("houseLeagueTeamId");
  const selectedTeam = teams?.find(t => t.id === selectedTeamId);
  const purpose = form.watch("purpose");
  
  const getRestrictionForDivision = (division: string | undefined) => {
    if (!division || !restrictions) return null;
    return restrictions.find(r => r.division === division);
  };

  const isDiamondAllowed = (diamond: Diamond) => {
    if (!selectedTeam) return true;
    
    const restriction = getRestrictionForDivision(selectedTeam.division);
    if (!restriction) return true;
    
    return restriction.allowedDiamonds.includes(diamond.name);
  };

  const getFilteredDiamonds = () => {
    if (!diamonds) return [];
    if (!selectedTeam) return diamonds;
    
    const restriction = getRestrictionForDivision(selectedTeam.division);
    if (!restriction) return diamonds;
    
    return diamonds.filter(d => restriction.allowedDiamonds.includes(d.name));
  };

  const restrictionMessage = selectedTeam ? (() => {
    const restriction = getRestrictionForDivision(selectedTeam.division);
    if (!restriction) return null;
    
    return `${selectedTeam.division} teams can only use: ${restriction.allowedDiamonds.join(', ')}${restriction.reason ? ` (${restriction.reason})` : ''}`;
  })() : null;

  // Clear diamond selection if it becomes invalid when team changes
  useEffect(() => {
    const currentDiamondId = form.getValues("diamondId");
    if (currentDiamondId && diamonds) {
      const currentDiamond = diamonds.find(d => d.id === currentDiamondId);
      if (currentDiamond && !isDiamondAllowed(currentDiamond)) {
        form.setValue("diamondId", "");
      }
    }
  }, [selectedTeamId, diamonds, restrictions]);

  // Auto-check requiresUmpire when purpose is "game"
  useEffect(() => {
    if (purpose === "game") {
      form.setValue("requiresUmpire", true);
    }
  }, [purpose, form]);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const startTime = new Date(`2000-01-01T${data.startTime}`);
      const endTime = new Date(`2000-01-01T${data.endTime}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      return await apiRequest(`/api/organizations/${orgId}/booking-requests`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          bookingType: data.purpose,
          durationMinutes,
          status: "draft",
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Draft saved",
        description: "Your booking request has been saved as a draft.",
      });
      setLocation(`/booking/${orgId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      let draftRequestId: string | null = null;
      
      const startTime = new Date(`2000-01-01T${data.startTime}`);
      const endTime = new Date(`2000-01-01T${data.endTime}`);
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      try {
        const request = await apiRequest(`/api/organizations/${orgId}/booking-requests`, {
          method: "POST",
          body: JSON.stringify({
            ...data,
            bookingType: data.purpose,
            durationMinutes,
            status: "draft",
          }),
        });
        
        draftRequestId = request.id;
        
        return await apiRequest(`/api/organizations/${orgId}/booking-requests/${request.id}/submit`, {
          method: "POST",
        });
      } catch (error) {
        // Clean up draft if submission failed
        if (draftRequestId) {
          try {
            await apiRequest(`/api/organizations/${orgId}/booking-requests/${draftRequestId}/cancel`, {
              method: "POST",
            });
          } catch (cleanupError) {
            console.error("Failed to clean up draft:", cleanupError);
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Request submitted",
        description: "Your booking request has been submitted for approval.",
      });
      setLocation(`/booking/${orgId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveDraft = (data: BookingFormData) => {
    saveDraftMutation.mutate(data);
  };

  const handleSubmit = (data: BookingFormData) => {
    submitMutation.mutate(data);
  };

  if (teamsLoading || diamondsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-3xl mx-auto px-4">
          <Link href={`/booking/${orgId}`}>
            <Button variant="ghost" className="text-white hover:text-gray-200 mb-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">New Diamond Booking Request</h1>
          <p className="text-gray-300 mt-1">Request a diamond for your team</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-6">
                <FormField
                  control={form.control}
                  name="houseLeagueTeamId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-team">
                            <SelectValue placeholder="Select your team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teams?.map((team) => (
                            <SelectItem key={team.id} value={team.id} data-testid={`option-team-${team.id}`}>
                              {team.name} ({team.division})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input type="date" className="pl-10" {...field} data-testid="input-date" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="diamondId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Diamond *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-diamond">
                              <SelectValue placeholder="Select diamond" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getFilteredDiamonds().map((diamond) => (
                              <SelectItem key={diamond.id} value={diamond.id} data-testid={`option-diamond-${diamond.id}`}>
                                {diamond.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {restrictionMessage && (
                          <FormDescription className="text-blue-600 font-medium">
                            {restrictionMessage}
                          </FormDescription>
                        )}
                        {!selectedTeam && (
                          <FormDescription>
                            Please select a team first to see available diamonds
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-start-time">
                              <SelectValue placeholder="Select start time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 29 }, (_, i) => {
                              const hour = Math.floor(i / 2) + 8;
                              const minute = i % 2 === 0 ? '00' : '30';
                              const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
                              const hour12 = hour > 12 ? hour - 12 : hour;
                              const ampm = hour >= 12 ? 'PM' : 'AM';
                              const display = `${hour12}:${minute} ${ampm}`;
                              return (
                                <SelectItem key={time24} value={time24} data-testid={`option-start-time-${time24}`}>
                                  {display}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-end-time">
                              <SelectValue placeholder="Select end time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[200px]">
                            {Array.from({ length: 29 }, (_, i) => {
                              const hour = Math.floor(i / 2) + 8;
                              const minute = i % 2 === 0 ? '00' : '30';
                              const time24 = `${hour.toString().padStart(2, '0')}:${minute}`;
                              const hour12 = hour > 12 ? hour - 12 : hour;
                              const ampm = hour >= 12 ? 'PM' : 'AM';
                              const display = `${hour12}:${minute} ${ampm}`;
                              return (
                                <SelectItem key={time24} value={time24} data-testid={`option-end-time-${time24}`}>
                                  {display}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purpose *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-purpose">
                            <SelectValue placeholder="Select purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="practice" data-testid="option-purpose-practice">
                            Practice
                          </SelectItem>
                          <SelectItem value="game" data-testid="option-purpose-game">
                            Game
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {purpose === "game" && (
                  <FormField
                    control={form.control}
                    name="opponentName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opponent *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter opponent team name" {...field} data-testid="input-opponent-name" />
                        </FormControl>
                        <FormDescription>
                          Enter the name of the team you'll be playing against
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="requiresUmpire"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-requires-umpire"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Requires Umpire</FormLabel>
                        <FormDescription>
                          {purpose === "game" 
                            ? "Umpires are required for games" 
                            : "Check this if you need an umpire for this booking"}
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional information for coordinators"
                          className="resize-none"
                          rows={4}
                          {...field}
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={form.handleSubmit(handleSaveDraft)}
                    disabled={saveDraftMutation.isPending || submitMutation.isPending}
                    data-testid="button-save-draft"
                  >
                    {saveDraftMutation.isPending ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button
                    type="button"
                    onClick={form.handleSubmit(handleSubmit)}
                    disabled={saveDraftMutation.isPending || submitMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit-request"
                  >
                    {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
