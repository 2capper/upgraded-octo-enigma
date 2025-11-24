import { useState } from 'react';
import { Shield, Mail, ArrowRight, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import dugoutDeskLogo from "@assets/tinywow_Gemini_Generated_Image_cj7rofcj7rofcj7r_85636863_1761934089236.png";
import { apiRequest } from '@/lib/queryClient';

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setIsLoading(true);

    try {
      await apiRequest('POST', '/api/auth/request-password-reset', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--deep-navy)' }}>
      {/* Header */}
      <header className="border-b border-white/10 py-4">
        <div className="container mx-auto px-4">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src={dugoutDeskLogo} alt="Dugout Desk" className="h-10 w-auto" />
              <h1 className="text-xl md:text-2xl font-bold text-white font-['Oswald']">
                Dugout Desk
              </h1>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full">
          <Card className="backdrop-blur-sm bg-white/95">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Reset Your Password</CardTitle>
              <CardDescription className="text-base mt-2">
                Enter your email address and we'll send you a link to reset your password
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription data-testid="text-error">{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="border-green-200 bg-green-50 text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription data-testid="text-success">
                      Password reset link sent! Check your email for instructions.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || success}
                    data-testid="input-email"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading || success}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : success ? (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Email Sent
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5 mr-2" />
                      Send Reset Link
                    </>
                  )}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto font-semibold"
                    onClick={() => setLocation('/login')}
                    data-testid="link-login"
                  >
                    Sign in
                  </Button>
                </div>
              </CardFooter>
            </form>
          </Card>

          <div className="text-center mt-6">
            <Link href="/">
              <Button
                variant="link"
                className="text-white hover:text-white/80 p-0"
                data-testid="link-back-home"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="container mx-auto px-4 text-center text-white/60 text-sm">
          <p>&copy; 2025 Dugout Desk. Professional tournament management for Ontario Baseball.</p>
        </div>
      </footer>
    </div>
  );
}
