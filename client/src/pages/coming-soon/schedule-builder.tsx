import { Calendar } from 'lucide-react';
import { ComingSoonPage } from '@/components/coming-soon-page';

export default function ScheduleBuilderComingSoon() {
  return (
    <ComingSoonPage
      featureName="Visual Schedule Builder"
      description="Create optimal game schedules with our visual drag-and-drop builder. Automatically detect conflicts and optimize field usage."
      icon={<Calendar className="w-12 h-12" />}
      comingSoonText="Create optimal game schedules with our visual drag-and-drop builder. Automatically detect conflicts and optimize field usage."
      benefits={[
        "Drag-and-drop interface for easy game scheduling",
        "Automatic conflict detection (double-bookings, back-to-back games)",
        "Rest time enforcement between games for teams",
        "Field availability management",
        "Constraint-based scheduling engine",
        "Auto-generate schedules based on pool structure",
        "Export to printable PDF and Excel formats",
        "Real-time updates visible to teams and officials",
      ]}
    />
  );
}
