"use client";

import React, { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera, Upload as UploadIcon, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { recognitionService } from "@/services/api";
import type { RecognitionResult } from "@/types";

/** helper: convert dataURL to File so backend receives same multipart/form-data */
function dataURLtoFile(dataurl: string, filename = "capture.jpg") {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/** Extend the backend result with optional fields */
type ExtendedRecognitionResult = RecognitionResult & {
  method?: string | null;
  image_base64?: string;
  boxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    recognized?: boolean;
    name?: string;
    score?: number;
  }>;
};

export default function RecognitionPage(): JSX.Element {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ExtendedRecognitionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [webcamActive, setWebcamActive] = useState(false);
  const webcamRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const blazefaceModelRef = useRef<any | null>(null);

  const [useClientDetect, setUseClientDetect] = useState<boolean>(true);
  const [clientDetectBusy, setClientDetectBusy] = useState<boolean>(false);

  const handleFileSelected = (file?: File) => {
    if (!file) return;
    setResult(null);
    setError("");
    setSelectedImage(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);

      setTimeout(() => drawImageToCanvas(dataUrl), 0);

      if (useClientDetect) {
        runClientDetect(dataUrl).catch((err) => {
          console.warn("client detect failed", err);
        });
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const startCamera = () => {
    setError("");
    setWebcamActive(true);
    setResult(null);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const stopCamera = () => {
    setWebcamActive(false);
  };

  const captureFromWebcam = useCallback(() => {
    setError("");
    if (!webcamRef.current) {
      setError("Webcam not available");
      return;
    }
    const imageSrc: string | null = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setError("Failed to capture image. Make sure camera permission is allowed.");
      return;
    }
    const file = dataURLtoFile(imageSrc, `webcam-${Date.now()}.jpg`);
    handleFileSelected(file);
  }, [useClientDetect]);

  const handleRecognize = async () => {
    if (!selectedImage) {
      setError("Please upload or capture an image first");
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const res = await recognitionService.recognizeImage(selectedImage);
      setResult(res as ExtendedRecognitionResult);

      if ((res as ExtendedRecognitionResult).image_base64) {
        // if backend sent already-annotated image, show that
        const annotated = `data:image/jpeg;base64,${(res as ExtendedRecognitionResult).image_base64}`;
        setImagePreview(annotated);
        drawImageToCanvas(annotated);
      } else if ((res as any).boxes && Array.isArray((res as any).boxes) && imagePreview) {
        drawImageToCanvas(imagePreview, (res as any).boxes);
      } else if (useClientDetect && imagePreview) {
        await runClientDetect(imagePreview);
      }
    } catch (err: any) {
      const respData = err?.response?.data;
      if (respData && (respData.inmate_id === null || respData.name === null || err?.response?.status === 404)) {
        const friendly = {
          inmate_id: respData?.inmate_id ?? "—",
          name: respData?.name ?? "No match found",
          score: typeof respData?.score === "number" ? respData.score : 0,
          method: respData?.method ?? "none",
        } as ExtendedRecognitionResult;
        setResult(friendly);
        if (useClientDetect && imagePreview) {
          await runClientDetect(imagePreview);
        }
      } else {
        setError(err?.response?.data?.detail || "Recognition failed");
        setResult(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setError("");
  };

  const newScan = () => {
    setResult(null);
    setSelectedImage(null);
    setImagePreview(null);
    setError("");
    if (!webcamActive) {
      setWebcamActive(true);
    }
  };

  // ---------------- Canvas drawing ----------------
  const drawImageToCanvas = async (imageSrc: string, boxes?: ExtendedRecognitionResult["boxes"]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej();
    }).catch(() => {
      return;
    });

    canvas.width = img.naturalWidth || img.width || 640;
    canvas.height = img.naturalHeight || img.height || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!boxes || boxes.length === 0) return;

    boxes.forEach((b) => {
      let x = b.x ?? 0;
      let y = b.y ?? 0;
      let w = b.width ?? 0;
      let h = b.height ?? 0;

      const normalized =
        [x, y, w, h].every((v) => typeof v === "number" && v >= 0 && v <= 1);
      if (normalized) {
        x = x * canvas.width;
        y = y * canvas.height;
        w = w * canvas.width;
        h = h * canvas.height;
      }

      const recognized = b.recognized ?? Boolean(b.name);

      ctx.lineWidth = 3;
      ctx.strokeStyle = recognized ? "rgba(0,200,80,0.95)" : "rgba(220,40,40,0.95)";
      ctx.fillStyle = recognized ? "rgba(0,200,80,0.12)" : "rgba(220,40,40,0.12)";
      ctx.strokeRect(x, y, w, h);
      ctx.fillRect(x, y, w, h);

      const label = recognized
        ? `${b.name ?? "Known"}${typeof b.score === "number" ? ` · ${(b.score * 100).toFixed(1)}%` : ""}`
        : `Unknown${typeof b.score === "number" ? ` · ${(b.score * 100).toFixed(1)}%` : ""}`;

      const padding = 6;
      ctx.font = "16px Inter, sans-serif";
      ctx.textBaseline = "top";
      const metrics = ctx.measureText(label);
      const textW = metrics.width + padding * 2;
      const textH = 20 + padding;

      let lx = x;
      let ly = y - textH - 4;
      if (ly < 0) ly = y + 4;

      ctx.fillStyle = recognized ? "rgba(0,200,80,0.95)" : "rgba(220,40,40,0.95)";
      ctx.fillRect(lx, ly, textW, textH);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + padding, ly + padding / 2);
    });
  };

  // ---------------- Client-side BlazeFace detection ----------------
  const runClientDetect = async (imageDataUrl: string) => {
    if (clientDetectBusy) return;
    setClientDetectBusy(true);
    try {
      if (!blazefaceModelRef.current) {
        await import("@tensorflow/tfjs-backend-webgl");
        const blazeface = await import("@tensorflow-models/blazeface");
        blazefaceModelRef.current = await blazeface.load();
      }

      const model = blazefaceModelRef.current;
      if (!model) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageDataUrl;

      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
      }).catch(() => {
        return;
      });

      const predictions: any[] = await model.estimateFaces(img, false);

      const boxes = predictions.map((p) => {
        const tl = p.topLeft as [number, number];
        const br = p.bottomRight as [number, number];
        const imgW = img.naturalWidth || img.width || 1;
        const imgH = img.naturalHeight || img.height || 1;

        const x = tl[0] / imgW;
        const y = tl[1] / imgH;
        const w = (br[0] - tl[0]) / imgW;
        const h = (br[1] - tl[1]) / imgH;
        const score = Array.isArray(p.probability) ? p.probability[0] : p.probability ?? 0;

        return { x, y, width: w, height: h, recognized: false, score };
      });

      await drawImageToCanvas(imageDataUrl, boxes);
    } catch (err) {
      console.warn("BlazeFace detect error:", err);
    } finally {
      setClientDetectBusy(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "High Confidence";
    if (score >= 0.6) return "Medium Confidence";
    return "Low Confidence";
  };

  const getMethodLabel = (method?: string | null) => {
    if (!method) return "No match";
    if (method.toLowerCase() === "cosine") return "Cosine";
    if (method.toLowerCase() === "euclidean") return "Euclidean";
    return method;
  };

  const getMethodBadgeClass = (method?: string | null) => {
    if (!method || method === "none") return "bg-gray-500";
    if (method.toLowerCase() === "cosine") return "bg-indigo-600";
    if (method.toLowerCase() === "euclidean") return "bg-pink-600";
    return "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Camera className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Face Verification</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Capture or Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Capture or Upload Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[300px] rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
              {imagePreview ? (
                <canvas
                  ref={canvasRef}
                  className="object-cover w-full h-full"
                  style={{ width: "100%", height: "100%" }}
                />
              ) : webcamActive ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    mirrored
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <Button size="sm" onClick={captureFromWebcam} className="flex items-center gap-2">
                      <Play className="w-4 h-4" /> Capture
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400 p-6">
                  <p className="font-medium">No image selected</p>
                  <p className="text-sm mt-1">Start webcam or upload an image</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <label className="text-sm text-gray-600 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={useClientDetect}
                  onChange={(e) => setUseClientDetect(e.target.checked)}
                />
                <span>Enable client-side face detection (BlazeFace)</span>
              </label>
              {clientDetectBusy && <div className="text-xs text-gray-500">Detecting faces…</div>}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => (webcamActive ? stopCamera() : startCamera())}
                className="flex-1"
                variant={webcamActive ? "secondary" : "default"}
              >
                <Play className="mr-2 h-4 w-4" />
                {webcamActive ? "Stop Camera" : "Start Camera"}
              </Button>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              <Button onClick={onUploadClick} className="flex-1" variant="outline">
                <UploadIcon className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                onClick={handleRecognize}
                disabled={isLoading || !selectedImage}
                className={`flex-1 ${isLoading ? "opacity-80" : ""}`}
              >
                {isLoading ? "Matching..." : "Match Face"}
              </Button>
              {result && (
                <Button onClick={newScan} variant="outline" className="w-36">
                  New Scan
                </Button>
              )}
            </div>

            {error && (
              <div className="mt-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Verification Result */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-md">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Inmate ID</p>
                      <p className="text-lg font-semibold">{result.inmate_id ?? "—"}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-lg font-semibold">{result.name ?? "No match found"}</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">Confidence Score</p>
                        <Badge className={`text-white ${getMethodBadgeClass(result.method)}`}>
                          {getMethodLabel(result.method)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${getScoreColor(result.score ?? 0)}`}
                            style={{ width: `${(result.score ?? 0) * 100}%` }}
                          />
                        </div>
                        <div className="w-20 text-right font-medium text-sm">
                          {((result.score ?? 0) * 100).toFixed(1)}%
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{getScoreLabel(result.score ?? 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recognition performed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
