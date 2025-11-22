import { FileQuestion, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <FileQuestion className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
          <CardDescription className="text-base mt-2">
            The page you're looking for doesn't exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>Double-check the URL or head back to explore our tournament management tools.</p>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            data-testid="button-go-back"
          >
            Go Back
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
