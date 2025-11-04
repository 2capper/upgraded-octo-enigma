import { UserPlus } from 'lucide-react';
import { ComingSoonPage } from '@/components/coming-soon-page';

export default function TournamentRegistrationComingSoon() {
  return (
    <ComingSoonPage
      featureName="Tournament Registration Portal"
      description="Streamline your tournament registration process with online team signups, roster management, and integrated payment processing."
      icon={<UserPlus className="w-12 h-12" />}
      comingSoonText="Streamline your tournament registration process with online team signups, roster management, and integrated payment processing."
      benefits={[
        "Online team registration forms with customizable fields",
        "Integrated payment processing via Stripe",
        "Roster submission with player details and validation",
        "Automatic email confirmations to registered teams",
        "Registration deadline enforcement",
        "Admin approval workflow for team registrations",
        "Early bird pricing and discount codes",
        "Waitlist management for full tournaments",
      ]}
    />
  );
}
