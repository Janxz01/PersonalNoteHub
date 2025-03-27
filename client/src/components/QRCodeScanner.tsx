import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCodeIcon, X } from "lucide-react";

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QRCodeScanner({ isOpen, onClose }: QRCodeScannerProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  useEffect(() => {
    if (isOpen && !scannerRef.current) {
      // Initialize the scanner instance
      scannerRef.current = new Html5Qrcode(scannerContainerId);
    }

    return () => {
      stopScanner();
      if (scannerRef.current) {
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  const startScanner = async () => {
    if (!scannerRef.current) return;

    setScanning(true);
    setScannedResult(null);

    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Error starting QR scanner:", err);
      toast({
        title: "Scanner Error",
        description: "Could not access the camera. Please check permissions.",
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        setScanning(false);
      } catch (err) {
        console.error("Error stopping QR scanner:", err);
      }
    }
  };

  const onScanSuccess = (decodedText: string) => {
    setScannedResult(decodedText);
    stopScanner();
  };

  const onScanFailure = (error: any) => {
    // Handle scan failures - we can ignore most as they're just frames without QR codes
    console.debug(`QR scan error: ${error}`);
  };

  const resetScanner = () => {
    setScannedResult(null);
  };

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      // Extract a title (first line or first few words)
      let title = text.split('\n')[0] || "Scanned Note";
      if (title.length > 50) {
        title = title.substring(0, 47) + "...";
      }

      const data = {
        title,
        content: text
      };

      const res = await apiRequest("POST", "/api/notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note Created",
        description: "QR code content has been saved as a new note.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to create note",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const saveAsNote = () => {
    if (!scannedResult) return;
    createNoteMutation.mutate(scannedResult);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <Card className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-bold">Scan QR Code</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* QR Code scanner container */}
            <div id={scannerContainerId} className="w-full h-64 overflow-hidden bg-gray-100 rounded-md"></div>
            
            {/* Scanned result area */}
            {scannedResult && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <h3 className="text-sm font-medium text-green-800 mb-1">Scanned Content:</h3>
                <p className="text-sm text-green-700 break-words">{scannedResult}</p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {!scanning && !scannedResult ? (
            <Button 
              className="w-full"
              onClick={startScanner}
            >
              <QrCodeIcon className="mr-2 h-4 w-4" />
              Start Scanning
            </Button>
          ) : scanning ? (
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={stopScanner}
            >
              Stop Scanning
            </Button>
          ) : (
            <div className="flex w-full space-x-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={resetScanner}
              >
                Scan Again
              </Button>
              <Button 
                className="flex-1"
                onClick={saveAsNote}
                disabled={createNoteMutation.isPending}
              >
                {createNoteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save as Note"
                )}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}