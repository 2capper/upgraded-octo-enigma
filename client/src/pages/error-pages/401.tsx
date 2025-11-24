import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Authentication Required</CardTitle>
          <CardDescription className="text-base mt-2">
            You need to sign in to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Sign in to continue using Dugout Desk.</p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={handleLogin} size="lg" data-testid="button-sign-in">
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
