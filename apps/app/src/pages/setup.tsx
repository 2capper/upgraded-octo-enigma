import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SetupFormData = {
  password: string;
  confirmPassword: string;
};

export default function Setup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<SetupFormData>();
  const password = watch("password");

  // Check if admin already exists
  const { data: adminExists, isLoading } = useQuery({
    queryKey: ["/api/auth/check-admin"],
    queryFn: async () => {
      const response = await fetch("/api/auth/check");
      const data = await response.json();
      // If authenticated, admin exists
      return data.authenticated;
    },
  });

  useEffect(() => {
    if (adminExists && !isLoading) {
      toast({
        title: "Setup Complete",
        description: "Admin user already exists. Redirecting to login...",
      });
      setLocation("/login");
    }
  }, [adminExists, isLoading, toast, setLocation]);

  const setupMutation = useMutation({
    mutationFn: async (data: SetupFormData) => {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ password: data.password }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Setup failed");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Setup Complete",
        description: "Admin user created successfully. Please login.",
      });
      setLocation("/login");
    },
    onError: (error: any) => {
      setError(error.message || "Setup failed. Please try again.");
    },
  });

  const onSubmit = (data: SetupFormData) => {
    if (data.password !== data.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setupMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[var(--falcons-green)] mx-auto mb-4" />
          <p className="text-gray-600">Checking setup status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-[var(--falcons-green)]" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Admin Setup</CardTitle>
          <CardDescription className="text-center">
            Create the admin account to manage the tournament system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter admin password"
                {...register("password", { 
                  required: "Password is required",
                  minLength: {
                    value: 6,
                    message: "Password must be at least 6 characters"
                  }
                })}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm admin password"
                {...register("confirmPassword", { 
                  required: "Please confirm your password",
                  validate: value => value === password || "Passwords do not match"
                })}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? "Creating admin..." : "Create Admin Account"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>The admin username will be: <strong>admin</strong></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}