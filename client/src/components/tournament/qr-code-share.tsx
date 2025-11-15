import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tournament } from '@shared/schema';

interface QRCodeShareProps {
  tournament: Tournament;
}

export function QRCodeShare({ tournament }: QRCodeShareProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const { toast } = useToast();
  const publicUrl = `https://www.dugoutdesk.ca/t/${tournament.id}`;

  useEffect(() => {
    const generateQRCode = async () => {
      if (!canvasRef.current) return;

      const qrOptions = {
        width: 200,
        margin: 2,
        color: {
          dark: tournament.primaryColor || '#22c55e',
          light: '#ffffff'
        }
      };

      try {
        QRCode.toCanvas(canvasRef.current, publicUrl, qrOptions, (error) => {
          if (error) {
            console.error('QR Code canvas generation error:', error);
            QRCode.toCanvas(
              canvasRef.current!,
              publicUrl,
              { ...qrOptions, color: { dark: '#22c55e', light: '#ffffff' } }
            );
          }
        });

        const dataUrl = await QRCode.toDataURL(publicUrl, qrOptions);
        setQrDataUrl(dataUrl);
      } catch (error) {
        console.error('QR Code data URL generation error:', error);
        try {
          const fallbackDataUrl = await QRCode.toDataURL(publicUrl, {
            ...qrOptions,
            color: { dark: '#22c55e', light: '#ffffff' }
          });
          setQrDataUrl(fallbackDataUrl);
        } catch (fallbackError) {
          console.error('QR Code fallback generation failed:', fallbackError);
        }
      }
    };

    generateQRCode();
  }, [publicUrl, tournament.primaryColor]);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.download = `${tournament.id}-qr-code.png`;
    link.href = qrDataUrl;
    link.click();

    toast({
      title: 'QR Code Downloaded',
      description: 'The QR code has been saved to your device.',
    });
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

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" style={{ color: tournament.primaryColor || '#22c55e' }} />
          Share Tournament
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg border-2 p-2"
            style={{ borderColor: tournament.primaryColor || '#22c55e' }}
            data-testid="canvas-qr-code"
          />
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">Scan to view tournament standings</p>
          <div className="bg-gray-100 p-2 rounded text-xs font-mono break-all">
            {publicUrl}
          </div>
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
