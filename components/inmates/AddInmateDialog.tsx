"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { inmatesService } from "@/services/api";
import type { InmateOut } from "@/types";

interface AddInmateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInmateAdded: (inmate: InmateOut) => void;
}

export function AddInmateDialog({
  open,
  onOpenChange,
  onInmateAdded,
}: AddInmateDialogProps) {
  const [inmateId, setInmateId] = useState("");
  const [name, setName] = useState("");
  const [cell, setCell] = useState("");
  const [crime, setCrime] = useState("");
  const [sentence, setSentence] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<"male" | "female" | "">(""); // NEW FIELD
  const [legalStatus, setLegalStatus] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (images.length === 0) {
        throw new Error("At least one image is required");
      }

      if (images.length > 5) {
        throw new Error("Maximum 5 images allowed");
      }

      const newInmate = await inmatesService.createInmate({
        inmate_id: inmateId,
        name,
        extra_info: {
          cell,
          crime,
          sentence,
          age: age === "" ? undefined : Number(age),
          sex: sex || undefined,
          legal_status: legalStatus || undefined,
          facility_name: facilityName || undefined,
        },
        images,
      });

      onInmateAdded(newInmate);

      // Reset form
      setInmateId("");
      setName("");
      setCell("");
      setCrime("");
      setSentence("");
      setAge("");
      setSex("");
      setLegalStatus("");
      setFacilityName("");
      setImages([]);
      const inputEl = document.getElementById(
        "images"
      ) as HTMLInputElement | null;
      if (inputEl) inputEl.value = "";
      onOpenChange(false);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err?.message || "Failed to create inmate"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) {
      setError("Maximum 5 images allowed");
      return;
    }
    setImages(files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] p-0 overflow-hidden">
        <div className="border-b">
          <DialogHeader className="px-6 py-4">
            <DialogTitle>Add New Inmate</DialogTitle>
            <DialogDescription>
              Fill in the inmate details and upload 1–5 images.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div
            className="px-6 py-4 overflow-auto"
            style={{ maxHeight: "calc(80vh - 168px)" }}
          >
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inmateId">Inmate ID</Label>
                <Input
                  id="inmateId"
                  value={inmateId}
                  onChange={(e) => setInmateId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cell">Cell</Label>
                <Input
                  id="cell"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="crime">Crime</Label>
                <Input
                  id="crime"
                  value={crime}
                  onChange={(e) => setCrime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sentence">Sentence</Label>
                <Input
                  id="sentence"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  min="0"
                  value={age}
                  onChange={(e) =>
                    setAge(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              {/* NEW FIELD: Sex */}
              <div className="space-y-2">
                <Label htmlFor="sex">Sex</Label>
                <select
                  id="sex"
                  value={sex}
                  onChange={(e) =>
                    setSex(e.target.value as "male" | "female" | "")
                  }
                  className="border rounded-md px-3 py-2 w-full"
                  required
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalStatus">Legal Status</Label>
                <Input
                  id="legalStatus"
                  value={legalStatus}
                  onChange={(e) => setLegalStatus(e.target.value)}
                  placeholder="e.g. Parole, Sentenced, Released"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facilityName">Facility Name</Label>
                <Input
                  id="facilityName"
                  value={facilityName}
                  onChange={(e) => setFacilityName(e.target.value)}
                  placeholder="e.g. Central Prison"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="images">Images (1–5 files)</Label>
                <Input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  required
                />
                {images.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {images.length} image(s) selected
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t bg-white px-6 py-3 sticky bottom-0">
            <DialogFooter className="flex items-center justify-end gap-2 p-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Inmate"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
