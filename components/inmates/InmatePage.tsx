"use client";
import React from "react";
import Link from "next/link";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AddInmateDialog } from "./AddInmateDialog";
import { EditInmateDialog } from "./EditInmateDialog";
import { inmatesService } from "@/services/api";
import { useInmates } from "@/hooks/useInmates";
import type { InmateOut } from "@/types";

export function InmatesPage() {
  const { data: inmates, error, isLoading, mutate } = useInmates();
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [editingInmate, setEditingInmate] = React.useState<InmateOut | null>(null);

  const handleDelete = async (inmateId: string) => {
    if (!confirm("Are you sure you want to delete this inmate?")) return;
    try {
      await inmatesService.deleteInmate(inmateId);
      // Optimistically update the cache
      mutate(inmates?.filter((i) => i.inmate_id !== inmateId), false);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to delete inmate");
    }
  };

  const handleInmateAdded = (newInmate: InmateOut) => {
    mutate([...(inmates || []), newInmate], false);
    setShowAddDialog(false);
  };

  const handleInmateUpdated = (upd: InmateOut) => {
    mutate(
      inmates?.map((i) => (i.id === upd.id ? upd : i)),
      false
    );
    setEditingInmate(null);
  };

  if (isLoading) return <div>Loading inmates…</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inmates</h1>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Inmate
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.response?.data?.detail || "Failed to load inmates"}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Inmates List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inmate ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Sex</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>Cell</TableHead>
                <TableHead>Crime</TableHead>
                <TableHead>Sentence</TableHead>
                <TableHead>Legal Status</TableHead>
                <TableHead>Facility Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inmates?.map((inmate) => (
                <TableRow key={inmate.id}>
                  <TableCell className="font-medium">{inmate.inmate_id}</TableCell>
                  <TableCell>{inmate.name}</TableCell>
                  <TableCell>{inmate.extra_info?.sex || "-"}</TableCell>
                  <TableCell>{inmate.extra_info?.age ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{inmate.images.length} image(s)</Badge>
                  </TableCell>
                  <TableCell>{inmate.extra_info?.cell || "-"}</TableCell>
                  <TableCell>{inmate.extra_info?.crime || "-"}</TableCell>
                  <TableCell>{inmate.extra_info?.sentence || "-"}</TableCell>
                  <TableCell>{inmate.extra_info?.legal_status || "-"}</TableCell>
                  <TableCell>{inmate.extra_info?.facility_name || "-"}</TableCell>
                  <TableCell>{new Date(inmate.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/inmates/${inmate.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingInmate(inmate)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(inmate.inmate_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddInmateDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onInmateAdded={handleInmateAdded}
      />

      {editingInmate && (
        <EditInmateDialog
          inmate={editingInmate}
          open={!!editingInmate}
          onOpenChange={(o) => !o && setEditingInmate(null)}
          onInmateUpdated={handleInmateUpdated}
        />
      )}
    </div>
  );
}
