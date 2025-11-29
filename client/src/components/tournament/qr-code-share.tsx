import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMemo, useRef, useEffect, useState } from 'react';
import type { Tournament } from '@shared/schema';

interface QRCodeShareProps {
  tournament: Tournament;
  organizationLogoUrl?: string | null;
}

export function QRCodeShare({ tournament, organizationLogoUrl }: QRCodeShareProps) {
  const { toast } = useToast();
  const qrCodeId = useMemo(() => `tournament-qr-code-${tournament.id}`, [tournament.id]);
  const downloadQrId = useMemo(() => `tournament-qr-download-${tournament.id}`, [tournament.id]);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dugoutdesk.ca';
  const publicUrl = `${baseUrl}/tournament/${tournament.id}`;
  
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationLogoUrl) {
      setLogoDataUrl(null);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        setLogoDataUrl(canvas.toDataURL('image/png'));
      } catch {
        setLogoDataUrl(null);
      }
    };
    img.onerror = () => setLogoDataUrl(null);
    img.src = organizationLogoUrl;
  }, [organizationLogoUrl]);

  const handleDownload = () => {
    const svg = document.getElementById(downloadQrId);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      try {
        const pngUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${tournament.id}-qr-code.png`;
        link.href = pngUrl;
        link.click();

        toast({
          title: 'QR Code Downloaded',
          description: 'The QR code has been saved to your device.',
        });
      } catch (error) {
        console.error('Canvas export failed:', error);
        toast({
          title: 'Download Failed',
          description: 'Could not generate QR code image.',
          variant: 'destructive',
        });
      }
    };

    img.onerror = () => {
      toast({
        title: 'Download Failed',
        description: 'Could not generate QR code image.',
        variant: 'destructive',
      });
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({
        title: 'Link Copied',
        description: 'Tournament link copied to clipboard!',
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: 'Copy Failed',
        description: 'Could not copy link to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const primaryColor = tournament.primaryColor || '#22c55e';

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" style={{ color: primaryColor }} />
          Share Tournament
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <div 
            className="rounded-lg border-2 p-2 bg-card"
            style={{ borderColor: primaryColor }}
          >
            <QRCodeSVG
              id={qrCodeId}
              value={publicUrl}
              size={200}
              level="H"
              includeMargin={true}
              fgColor={primaryColor}
              imageSettings={logoDataUrl ? {
                src: logoDataUrl,
                height: 40,
                width: 40,
                excavate: true,
              } : undefined}
              data-testid="svg-qr-code"
            />
          </div>
        </div>

        {/* Hidden QR for download (plain without logo for reliable export) */}
        <div className="hidden">
          <QRCodeSVG
            id={downloadQrId}
            value={publicUrl}
            size={400}
            level="M"
            includeMargin={true}
            fgColor={primaryColor}
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">Scan to view tournament standings</p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            variant="outline"
            className="flex-1"
            data-testid="button-download-qr"
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="flex-1"
            data-testid="button-copy-link"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
