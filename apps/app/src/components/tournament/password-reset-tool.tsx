import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";

export function PasswordResetTool() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error", 
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await apiRequest('POST', '/api/auth/reset-admin-password', {
        newPassword,
        confirmPassword
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Success",
          description: "Admin password reset successfully. You can now log in with the new password.",
        });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        throw new Error(result.error || "Password reset failed");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to reset password: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  const getDiagnosticInfo = async () => {
    try {
      const response = await apiRequest('GET', '/api/auth/diagnostic');
      const result = await response.json();
      
      toast({
        title: "System Diagnostic",
        description: `Environment: ${result.environment}, Users: ${result.userCount}, Session Store: ${result.sessionStore}`,
      });
      
      console.log("Full diagnostic info:", result);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get diagnostic information",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Authentication Troubleshooting
        </CardTitle>
        <CardDescription>
          If you're having login issues in the deployed version, use this tool to reset the admin password and troubleshoot authentication problems.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This tool resets the admin user password. Only use this if you cannot log in with your current credentials.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              disabled={isResetting}
            />
          </div>
          
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isResetting}
            />
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleReset}
              disabled={isResetting || !newPassword || !confirmPassword}
              className="flex items-center gap-2"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Reset Admin Password
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? "Hide" : "Show"} Advanced Tools
            </Button>
          </div>

          {showAdvanced && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium">Advanced Troubleshooting</h4>
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  onClick={getDiagnosticInfo}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Run System Diagnostic
                </Button>
              </div>
              
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Common deployment issues:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Cookie security settings incompatible with HTTPS</li>
                  <li>Session store not connecting to PostgreSQL</li>
                  <li>Environment variables not set correctly</li>
                  <li>CORS issues with cross-origin requests</li>
                </ul>
                <p className="mt-2">
                  Check browser developer console for additional error details.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}