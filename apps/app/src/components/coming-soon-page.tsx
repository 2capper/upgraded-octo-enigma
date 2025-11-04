import { Link } from 'wouter';
import { Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ComingSoonPageProps {
  featureName: string;
  description: string;
  icon: React.ReactNode;
  benefits: string[];
  comingSoonText?: string;
}

export const ComingSoonPage = ({
  featureName,
  description,
  icon,
  benefits,
  comingSoonText,
}: ComingSoonPageProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="container mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-[var(--forest-green)]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Coming Soon Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full">
              <Lock className="w-4 h-4" />
              <span className="font-semibold text-sm">COMING SOON</span>
            </div>
          </div>

          {/* Feature Icon & Title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="bg-[var(--forest-green)] text-white p-6 rounded-2xl">
                {icon}
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {featureName}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* Coming Soon Text */}
          {comingSoonText && (
            <Card className="mb-8 border-2 border-[var(--forest-green)]">
              <CardContent className="p-6">
                <p className="text-lg text-gray-700 italic">
                  {comingSoonText}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Benefits List */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">What's Included</h2>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[var(--forest-green)] flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gradient-to-r from-[var(--forest-green)] to-green-700 rounded-xl shadow-lg p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">This Feature is Under Development</h2>
            <p className="text-lg mb-6 opacity-90">
              We're working hard to bring this feature to you. Check back soon!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button 
                  size="lg" 
                  className="bg-white text-[var(--forest-green)] hover:bg-gray-100"
                  data-testid="button-back-dashboard"
                >
                  Return to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
