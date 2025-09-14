"use client";
import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditInmateDialog } from "@/components/inmates/EditInmateDialog";
import { useInmate } from "@/hooks/useInmates";
import type { InmateOut } from "@/types";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function InmateDetailPage() {
  const params = useParams();
  const idParam = params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const { data: inmate, error, isLoading, mutate } = useInmate(id);
  const [showEditDialog, setShowEditDialog] = React.useState(false);

  const handleInmateUpdated = (updated: InmateOut) => {
    // Optimistically update cache
    mutate(updated, { revalidate: false });
    setShowEditDialog(false);
  };

  if (isLoading) return <div>Loading inmate details…</div>;
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {(error as any)?.response?.data?.detail ||
            (error as any)?.message ||
            "Failed to load inmate"}
        </AlertDescription>
      </Alert>
    );
  if (!inmate) return <div>Inmate not found</div>;

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" asChild>
              <Link href="/inmates">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Inmates
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">{inmate.name}</h1>
          </div>
          <Button onClick={() => setShowEditDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Inmate ID
                </label>
                <p className="text-lg">{inmate.inmate_id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Name</label>
                <p className="text-lg">{inmate.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Created
                </label>
                <p className="text-lg">
                  {new Date(inmate.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Last Updated
                </label>
                <p className="text-lg">
                  {inmate.updated_at
                    ? new Date(inmate.updated_at).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Extra Information</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-auto">
                {JSON.stringify(inmate.extra_info, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Badge variant="secondary">
                  {inmate.images.length} image(s)
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {inmate.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-square bg-gray-100 rounded-md flex items-center justify-center"
                  >
                    <img
                      src={img.filename || "/placeholder.svg"}
                      alt={`${inmate.name} — Image ${idx + 1}`}
                      className="w-full h-full object-cover rounded-md"
                      onError={(e) => {
                        e.currentTarget.src =
                          "/placeholder.svg?height=200&width=200";
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {showEditDialog && (
          <EditInmateDialog
            inmate={inmate}
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            onInmateUpdated={handleInmateUpdated}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
