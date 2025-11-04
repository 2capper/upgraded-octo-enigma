import { MessageSquare } from 'lucide-react';
import { ComingSoonPage } from '@/components/coming-soon-page';

export default function TournamentCommsComingSoon() {
  return (
    <ComingSoonPage
      featureName="Tournament Communications"
      description="Keep everyone informed with multi-channel communication tools. Send updates, schedule changes, and announcements via email, SMS, or in-app notifications."
      icon={<MessageSquare className="w-12 h-12" />}
      comingSoonText="Keep everyone informed with multi-channel communication tools. Send updates, schedule changes, and announcements via email, SMS, or in-app notifications."
      benefits={[
        "Multi-channel messaging: Email, SMS, and in-app chat",
        "Broadcast messages to all teams or specific groups",
        "Pre-built message templates for common scenarios",
        "Schedule change notifications with automatic alerts",
        "Weather delay and cancellation announcements",
        "Message history and read receipts",
        "Direct messaging between organizers and coaches",
        "SMS integration via Twilio",
      ]}
    />
  );
}
