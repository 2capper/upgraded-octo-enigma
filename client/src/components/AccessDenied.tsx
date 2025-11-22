import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

interface AccessDeniedProps {
  message?: string;
  showHomeButton?: boolean;
  showBackButton?: boolean;
}

export function AccessDenied({
  message = "You don't have permission to access this resource.",
  showHomeButton = true,
  showBackButton = true,
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Access Denied</CardTitle>
          <CardDescription className="text-base mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>If you believe this is a mistake, please contact your organization administrator.</p>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          {showBackButton && (
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          )}
          {showHomeButton && (
            <Link href="/">
              <Button data-testid="button-go-home">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
