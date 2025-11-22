import { ServerCrash, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function ServerErrorPage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ServerCrash className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Server Error</CardTitle>
          <CardDescription className="text-base mt-2">
            Something went wrong on our end. We're working to fix it.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Try refreshing the page or come back in a few minutes. If the problem persists, please contact support.</p>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={handleRefresh}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/">
            <Button data-testid="button-go-home">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
