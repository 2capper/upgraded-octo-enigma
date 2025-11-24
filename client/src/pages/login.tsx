import { useState } from 'react';
import { Shield, LogIn, Check, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import dugoutDeskLogo from "@assets/Gemini_Generated_Image_cj7rofcj7rofcj7r (1)_1764008382610.png";
import { apiRequest } from '@/lib/queryClient';

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/auth/login', { email, password });
      const data = await response.json();
      
      // Smart redirect based on user role
      const user = data.user;
      if (user?.isAdmin) {
        // Super admins can access all orgs, so show org selector
        if (user.isSuperAdmin) {
          window.location.href = '/select-organization';
        } else {
          // Regular admins: fetch their organizations
          const orgsResponse = await apiRequest('GET', '/api/users/me/organizations');
          const orgs = await orgsResponse.json();
          
          if (orgs.length === 0) {
            // No organizations - redirect to onboarding to create one
            window.location.href = '/onboarding/create-organization';
          } else if (orgs.length === 1) {
            // Single org admin - go directly to their org admin page
            window.location.href = `/org/${orgs[0].id}/admin`;
          } else {
            // Multiple orgs - show selector
            window.location.href = '/select-organization';
          }
        }
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
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
        <div className="max-w-4xl w-full">
          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left Column - Sign In Card */}
            <Card className="backdrop-blur-sm bg-white/95">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription className="text-base mt-2">
                  Sign in to access your tournament dashboard
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      data-testid="input-password"
                    />
                  </div>
                  <div className="text-right">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm p-0 h-auto"
                      onClick={() => setLocation('/forgot-password')}
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto font-semibold"
                      onClick={() => setLocation('/register')}
                      data-testid="link-register"
                    >
                      Sign up
                    </Button>
                  </div>
                  <div className="text-center text-xs text-muted-foreground/80 pt-2 border-t">
                    <p className="leading-relaxed">
                      <strong className="text-muted-foreground">Invited by a coach?</strong><br />
                      Create a free account first, then accept your invitation to access diamond booking.
                    </p>
                  </div>
                </CardFooter>
              </form>
            </Card>

            {/* Right Column - Info */}
            <div className="text-white space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-3 font-['Oswald']">
                  Your Tournament Command Center
                </h2>
                <p className="text-white/80 text-lg">
                  Manage tournaments, track scores, and update standings in real-time. Built for baseball tournament directors and coaches on the go.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Real-Time Updates</h3>
                    <p className="text-white/70 text-sm">
                      Update scores and standings instantly from any device. Changes sync across all users immediately.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Mobile-First Design</h3>
                    <p className="text-white/70 text-sm">
                      Optimized for coaches managing tournaments from the dugout. Get in, get it done, get back to the game.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Complete Bracket Management</h3>
                    <p className="text-white/70 text-sm">
                      From pool play to playoffs, manage every aspect of your tournament with automatic seeding and bracket generation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
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
