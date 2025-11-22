import { Shield, LogIn, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import dugoutDeskLogo from "@assets/tinywow_Gemini_Generated_Image_cj7rofcj7rofcj7r_85636863_1761934089236.png";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
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
              <CardContent className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Secure Replit Authentication
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    We use Replit's secure authentication system to protect your account. Your credentials are never stored on our servers.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Industry-standard OAuth 2.0 security</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>No password required - use your Replit account</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Automatic session management and token refresh</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="w-full"
                  data-testid="button-sign-in-replit"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In with Replit
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  By signing in, you'll be securely redirected to Replit's authentication service.
                </p>
              </CardFooter>
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
