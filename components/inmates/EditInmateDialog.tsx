"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { inmatesService } from "@/services/api"
import type { InmateOut } from "@/types"
import { mutate } from "swr"

interface EditInmateDialogProps {
  inmate: InmateOut
  open: boolean
  onOpenChange: (open: boolean) => void
  onInmateUpdated: (inmate: InmateOut) => void
}

export function EditInmateDialog({
  inmate,
  open,
  onOpenChange,
  onInmateUpdated,
}: EditInmateDialogProps) {
  const [name, setName] = useState("")
  const [cell, setCell] = useState("")
  const [crime, setCrime] = useState("")
  const [sentence, setSentence] = useState("")
  const [age, setAge] = useState<number | "">("")
  const [sex, setSex] = useState<"male" | "female" | "">("")
  const [legalStatus, setLegalStatus] = useState("")
  const [facilityName, setFacilityName] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (inmate) {
      setName(inmate.name)
      setCell(inmate.extra_info?.cell || "")
      setCrime(inmate.extra_info?.crime || "")
      setSentence(inmate.extra_info?.sentence || "")
      setAge(inmate.extra_info?.age ?? "")
      setSex((inmate.extra_info?.sex as "male" | "female" | "") || "")
      setLegalStatus(inmate.extra_info?.legal_status || "")
      setFacilityName(inmate.extra_info?.facility_name || "")
    }
  }, [inmate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      let parsedAge: number | undefined = undefined
      if (age !== "") {
        const num = Number(age)
        if (isNaN(num) || num < 0 || num > 120) {
          throw new Error("Please enter a valid age between 0 and 120")
        }
        parsedAge = num
      }

      const updatedExtraInfo = {
        ...inmate.extra_info,
        cell,
        crime,
        sentence,
        age: parsedAge,
        sex: sex || undefined,
        legal_status: legalStatus || undefined,
        facility_name: facilityName || undefined,
      }

      const updatedInmate = await inmatesService.updateInmate(inmate.inmate_id, {
        name,
        extra_info: updatedExtraInfo,
      })

      // ✅ SWR: update cache for this inmate
      mutate(`/inmates/${inmate.inmate_id}`, updatedInmate, false)

      // ✅ SWR: also update cache for inmate list if exists
      mutate(
        "/inmates",
        (data: InmateOut[] | undefined) =>
          data
            ? data.map((i) =>
                i.inmate_id === inmate.inmate_id ? updatedInmate : i
              )
            : data,
        false
      )

      onInmateUpdated(updatedInmate)
      onOpenChange(false)
    } catch (err: any) {
      setError(
        err.message ||
          err.response?.data?.detail ||
          "Failed to update inmate"
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Inmate</DialogTitle>
          <DialogDescription>
            Update the inmate&apos;s details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
            <Label htmlFor="age">Age</Label>
            <Input
              type="number"
              id="age"
              value={age}
              onChange={(e) =>
                setAge(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="Enter age"
              min={0}
              max={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex</Label>
            <select
              id="sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as "male" | "female" | "")}
              className="border rounded-md px-3 py-2 w-full"
              required
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cell">Cell Number</Label>
            <Input
              id="cell"
              value={cell}
              onChange={(e) => setCell(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="crime">Crime Committed</Label>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Inmate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
