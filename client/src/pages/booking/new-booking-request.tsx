import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewBookingRequest() {
  const { orgId } = useParams<{ orgId: string }>();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-2xl font-bold">New Diamond Booking Request</h1>
          <p className="text-gray-300 mt-1">Request a diamond for your team</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Booking form will appear here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
