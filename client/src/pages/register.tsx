import { useState } from 'react';
import { Shield, UserPlus, Check, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useLocation } from "wouter";
import dugoutDeskLogo from "@assets/Gemini_Generated_Image_cj7rofcj7rofcj7r (1)_1764008382610.png";
import { apiRequest } from '@/lib/queryClient';

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest('POST', '/api/auth/register', {
        email,
        password,
        firstName,
        lastName,
      });
      // Redirect to home on success
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
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
            {/* Left Column - Registration Card */}
            <Card className="backdrop-blur-sm bg-white/95">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Create Your Account</CardTitle>
                <CardDescription className="text-base mt-2">
                  Join Dugout Desk and start managing tournaments
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription data-testid="text-error">{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        disabled={isLoading}
                        data-testid="input-firstname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        disabled={isLoading}
                        data-testid="input-lastname"
                      />
                    </div>
                  </div>
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
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters long
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      data-testid="input-confirmpassword"
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-register"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                  <div className="text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
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

            {/* Right Column - Info */}
            <div className="text-white space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-3 font-['Oswald']">
                  Start Managing Tournaments Today
                </h2>
                <p className="text-white/80 text-lg">
                  Create your free account and experience the most intuitive tournament management platform built specifically for baseball.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Quick Setup</h3>
                    <p className="text-white/70 text-sm">
                      Get your first tournament running in minutes. No training required - our intuitive interface guides you every step.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Free to Start</h3>
                    <p className="text-white/70 text-sm">
                      Create your account and explore all features. No credit card required to get started.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--field-green)]/20 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-[var(--field-green)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Built for Baseball</h3>
                    <p className="text-white/70 text-sm">
                      Designed by tournament directors for tournament directors. Every feature built to solve real problems.
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
