import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ message = "Loading...", className = "" }: LoadingScreenProps) {
  return (
    <div className={`min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center ${className}`}>
      <div className="text-center animate-in fade-in duration-500">
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto">
            <Loader2 className="w-full h-full text-green-600 animate-spin" strokeWidth={2.5} />
          </div>
          <div className="absolute inset-0 w-16 h-16 mx-auto">
            <div className="w-full h-full rounded-full border-4 border-green-100 animate-pulse"></div>
          </div>
        </div>
        <p className="text-lg font-medium text-slate-700 animate-pulse">
          {message}
        </p>
        <div className="mt-4 flex justify-center gap-1">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}
