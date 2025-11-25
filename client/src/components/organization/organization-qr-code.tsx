import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';
import { useMemo } from 'react';
import type { Organization } from '@shared/schema';

interface OrganizationQRCodeProps {
  organization: Organization;
  size?: number;
  showCard?: boolean;
}

export function OrganizationQRCode({ 
  organization, 
  size = 256,
  showCard = true 
}: OrganizationQRCodeProps) {
  const qrCodeId = useMemo(() => `org-qr-code-${organization.id}`, [organization.id]);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://dugoutdesk.ca';
  const targetUrl = `${baseUrl}/org/${organization.slug}`;

  const handleDownload = () => {
    const svg = document.getElementById(qrCodeId);
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${organization.slug}-qr-code.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  };

  const qrCodeContent = (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-lg shadow-sm border">
        <QRCodeSVG
          id={qrCodeId}
          value={targetUrl}
          size={size}
          level="H"
          includeMargin={true}
          imageSettings={organization.logoUrl ? {
            src: organization.logoUrl,
            x: undefined,
            y: undefined,
            height: Math.round(size * 0.23),
            width: Math.round(size * 0.23),
            excavate: true,
          } : undefined}
        />
      </div>
      
      <p className="text-sm text-muted-foreground text-center max-w-[280px]">
        Scan to visit your organization page or download for printing on flyers and signage.
      </p>
      
      <Button 
        onClick={handleDownload} 
        variant="outline" 
        className="w-full max-w-[280px]"
        data-testid="button-download-qr"
      >
        <Download className="w-4 h-4 mr-2" />
        Download PNG
      </Button>
    </div>
  );

  if (!showCard) {
    return qrCodeContent;
  }

  return (
    <Card className="w-full max-w-sm" data-testid="card-organization-qr">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="w-5 h-5" />
          Organization QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {qrCodeContent}
      </CardContent>
    </Card>
  );
}
