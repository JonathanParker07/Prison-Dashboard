"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Camera, Play, StopCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { recognitionService } from "@/services/api";
import type { RecognitionResult } from "@/types";

/** Convert canvas dataURL → File */
function dataURLtoFile(dataurl: string, filename = "capture.jpg") {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

export default function LiveDetectionPage(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mode, setMode] = useState<"webcam" | "stream">("webcam");
  const [streamUrl, setStreamUrl] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1500);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [boxedImageUrl, setBoxedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const intervalIdRef = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    return () => {
      stopDetection();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** --- Stream/Webcam control --- */
  const startWebcam = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsRunning(true);
      startLoop();
    } catch (err: any) {
      setError("Unable to access webcam: " + (err?.message ?? err));
    }
  };

  const startStream = async (url: string) => {
    setError("");
    if (!videoRef.current) return;
    const isM3u8 = url.endsWith(".m3u8") || url.includes(".m3u8?");
    if (isM3u8 && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => {});
      });
    } else {
      videoRef.current.src = url;
      await videoRef.current.play().catch(() => {});
    }
    setIsRunning(true);
    startLoop();
  };

  const stopTracks = () => {
    if (!videoRef.current) return;
    const stream = videoRef.current.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    videoRef.current.srcObject = null;
    videoRef.current.src = "";
  };

  /** --- Capture Loop --- */
  const startLoop = () => {
    stopLoop();
    syncCanvasSize();
    intervalIdRef.current = window.setInterval(() => {
      captureAndRecognize();
    }, intervalMs);
  };

  const stopLoop = () => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  const stopDetection = () => {
    stopLoop();
    stopTracks();
    if (hlsRef.current) {
      hlsRef.current.stopLoad();
      hlsRef.current.detachMedia();
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    setIsRunning(false);
    setBoxedImageUrl(null);
  };

  /** --- Helpers --- */
  const syncCanvasSize = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
  };

  const captureAndRecognize = async () => {
    setError("");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    syncCanvasSize();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } catch {
      return;
    }

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.8)
    );
    if (!blob) return;

    try {
      const file = new File([blob], `frame-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const res: RecognitionResult = await recognitionService.recognizeImage(
        file
      );

      setResult(res);

      if (res.image_base64) {
        const dataUrl = `data:image/jpeg;base64,${res.image_base64}`;
        setBoxedImageUrl(dataUrl);
        await drawBoxedImageToCanvas(dataUrl);
      } else {
        setBoxedImageUrl(null);
        await drawBoxesFromResult(res);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Recognition failed");
      setResult(null);
      setBoxedImageUrl(null);
      clearOverlay();
    }
  };

  const clearOverlay = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  /** --- Drawing --- */
  const drawBoxedImageToCanvas = async (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const drawBoxesFromResult = async (res: RecognitionResult | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const boxes: any[] = (res as any)?.boxes || [];
    if (boxes.length > 0) {
      boxes.forEach((b) => {
        let { x, y, width: w, height: h } = b;
        const normalized = [x, y, w, h].every(
          (v: number) => typeof v === "number" && v <= 1
        );
        if (normalized) {
          x *= canvas.width;
          y *= canvas.height;
          w *= canvas.width;
          h *= canvas.height;
        }
        const recognized = b.recognized ?? Boolean(b.name);

        ctx.lineWidth = 3;
        ctx.strokeStyle = recognized
          ? "rgba(0,200,80,0.95)"
          : "rgba(220,40,40,0.95)";
        ctx.fillStyle = recognized
          ? "rgba(0,200,80,0.12)"
          : "rgba(220,40,40,0.12)";
        ctx.strokeRect(x, y, w, h);
        ctx.fillRect(x, y, w, h);

        const label = recognized
          ? `${b.name ?? "Unknown"}${
              typeof b.score === "number"
                ? ` · ${(b.score * 100).toFixed(1)}%`
                : ""
            }`
          : "Unknown";
        ctx.font = "16px Inter, sans-serif";
        const padding = 6;
        const metrics = ctx.measureText(label);
        const textW = metrics.width + padding * 2;
        const textH = 22;

        let lx = x;
        let ly = y - textH - 4;
        if (ly < 0) ly = y + 4;

        ctx.fillStyle = recognized
          ? "rgba(0,200,80,0.9)"
          : "rgba(220,40,40,0.9)";
        ctx.fillRect(lx, ly, textW, textH);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, lx + padding, ly + 16);
      });
    } else {
      drawOverlayLabel(res);
    }
  };

  const drawOverlayLabel = (res: RecognitionResult | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = 8;
    const name = res?.name ?? "No match";
    const score = typeof res?.score === "number" ? res.score : 0;
    const text = `${name} · ${(score * 100).toFixed(1)}%`;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.font = "16px Inter, sans-serif";
    const metrics = ctx.measureText(text);
    const w = metrics.width + padding * 2;
    const h = 28;
    ctx.fillRect(8, 8, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, 16, 28);
  };

  /** --- Handlers --- */
  const manualCapture = async () => {
    await captureAndRecognize();
  };

  const onStart = async () => {
    setResult(null);
    setBoxedImageUrl(null);
    setError("");
    if (mode === "webcam") {
      await startWebcam();
    } else {
      if (!streamUrl) {
        setError("Provide a stream URL (HLS / mp4).");
        return;
      }
      await startStream(streamUrl);
    }
  };

  const onStop = () => {
    stopDetection();
  };

  /** --- Render --- */
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Camera className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Live Detection</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Source & Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setMode("webcam")}
                className={`px-3 py-1 rounded ${
                  mode === "webcam"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100"
                }`}
              >
                Webcam
              </button>
              <button
                onClick={() => setMode("stream")}
                className={`px-3 py-1 rounded ${
                  mode === "stream"
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100"
                }`}
              >
                Network Stream
              </button>
            </div>

            {mode === "stream" && (
              <div className="mb-3">
                <label className="text-sm text-gray-600">Stream URL</label>
                <input
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  className="w-full rounded border p-2 mt-1"
                  placeholder="https://example.com/live/stream.m3u8"
                />
              </div>
            )}

            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-gray-600">Capture interval (ms)</label>
              <input
                type="number"
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                className="w-28 rounded border p-2"
                min={300}
              />
            </div>

            <div className="flex gap-3">
              {!isRunning ? (
                <Button onClick={onStart}>
                  <Play className="mr-2 h-4 w-4" />
                  Start
                </Button>
              ) : (
                <Button variant="destructive" onClick={onStop}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              )}

              <Button onClick={manualCapture} variant="outline">
                Capture Now
              </Button>
            </div>

            {error && (
              <div className="mt-3">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Video + Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Video Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-[360px] object-cover"
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-[360px] pointer-events-none"
              />
            </div>

            <div className="mt-4">
              <h3 className="text-sm text-gray-500">Latest Recognition</h3>
              {result ? (
                <div className="mt-2 flex items-center gap-3">
                  {boxedImageUrl && (
                    <img
                      src={boxedImageUrl}
                      alt={result.name ?? undefined}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium">
                      {result.name ?? "No match"}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {result.inmate_id ?? "—"}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <Badge className="bg-gray-900 text-white">
                      {typeof result.score === "number"
                        ? `${(result.score * 100).toFixed(1)}%`
                        : "—"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500">
                  No recognition yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
