"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Edit, Trash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { staffService, CreateOfficerRequest } from "@/services/staffService";
import { logsService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import type { Officer } from "@/services/staffService";

function useFiltered(list: Officer[], q: string) {
  return useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list.filter((o) => {
      if (!qq) return true;
      return (
        o.name.toLowerCase().includes(qq) ||
        (o.email ?? "").toLowerCase().includes(qq) ||
        ((o as any).prison_name ?? "").toLowerCase().includes(qq)
      );
    });
  }, [list, q]);
}

export default function StaffManagementPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  // counts & current-user recognitions
  const [officerCount, setOfficerCount] = useState<number | null>(null);
  const [myRecognitions, setMyRecognitions] = useState<number | null>(null);

  // modal / form state
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Officer | null>(null);

  // form fields (when creating → include password and prison_name)
  const [form, setForm] = useState<{
    name: string;
    email: string;
    password?: string;
    prison_name?: string;
  }>({ name: "", email: "", password: "", prison_name: "" });

  useEffect(() => {
    load();
    // fetch officer-related stats (total officers + recognitions for current user)
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await staffService.getAll();
      setStaff(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      // total officers (optional backend-driven)
      try {
        const total = await staffService.getTotalOfficers?.();
        if (typeof total === "number") setOfficerCount(total);
      } catch (e) {
        // ignore; keep officerCount null -> UI fallback to staff.length
      }

      // recognitions by officer (attempt to find current user's count)
      try {
        const res = await logsService.getRecognitionsByOfficer();
        const arr = res?.by_officer ?? [];
        if (user && user.name) {
          const me = arr.find((x: any) => String(x.officer) === String(user.name));
          if (me) {
            setMyRecognitions(Number(me.count ?? 0));
            return;
          }
        }
        // fallback: if the endpoint returns a row keyed by user id or email, try matching common fields
        if (user && user.id) {
          const meById = arr.find((x: any) => String(x._id) === String(user.id));
          if (meById) {
            setMyRecognitions(Number(meById.count ?? 0));
            return;
          }
        }
      } catch (e) {
        // ignore; we'll fallback
        console.error("Could not fetch recognitions-by-officer:", e);
      }
    } catch (e) {
      console.error("fetchCounts error:", e);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", email: "", password: "", prison_name: "" });
    setShowModal(true);
    setError("");
  };

  const openEdit = (o: Officer) => {
    setEditing(o);
    setForm({
      name: o.name,
      email: o.email,
      // do not pre-fill password on edit
      password: "",
      prison_name: (o as any).prison_name ?? "",
    });
    setShowModal(true);
    setError("");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setError("");
  };

  const submit = async () => {
    try {
      setError("");
      if (!form.name || !form.email) {
        setError("Name and Email are required");
        return;
      }

      let createdOrUpdated: Officer;

      if (editing) {
        // include prison_name in update payload
        const updatePayload: Partial<Officer & { prison_name?: string }> = {
          name: form.name,
          email: form.email,
        };
        if (form.prison_name !== undefined) updatePayload.prison_name = form.prison_name;

        createdOrUpdated = await staffService.update(editing.id, updatePayload as Partial<Officer>);
        setStaff((s) =>
          s.map((x) => (x.id === editing.id ? createdOrUpdated : x))
        );
      } else {
        if (!form.password) {
          setError("Password is required for new staff");
          return;
        }
        // Create payload — cast to any to allow extra prison_name field if your service typing doesn't include it
        const payload: any = {
          name: form.name,
          email: form.email,
          password: form.password,
        };
        if (form.prison_name) payload.prison_name = form.prison_name;

        createdOrUpdated = await staffService.create(payload as CreateOfficerRequest);
        setStaff((s) => [createdOrUpdated, ...s]);
      }

      closeModal();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to save staff");
    }
  };

  const remove = async (o: Officer) => {
    if (!confirm(`Delete ${o.name}? This cannot be undone.`)) return;
    try {
      await staffService.remove(o.id);
      setStaff((s) => s.filter((x) => x.id !== o.id));
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Delete failed");
    }
  };

  const filtered = useFiltered(staff, query);

  // Calculate total recognitions for today — fallback: sum of staff.recognitions_today
  const fallbackTotalRecognitions = useMemo(() => {
    return staff.reduce((sum, s) => sum + (s.recognitions_today ?? 0), 0);
  }, [staff]);

  // choose display value: prefer myRecognitions (from backend), else fallback
  const totalRecognitionsTodayDisplay = myRecognitions ?? fallbackTotalRecognitions;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff Management</h1>
        <div>
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus /> Add New Staff
          </Button>
        </div>
      </div>

      {/* top summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{officerCount ?? staff.length}</div>
            <div className="text-sm text-gray-500">Overall staff count</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Recognitions Current Officer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalRecognitionsTodayDisplay}</div>
            <div className="text-sm text-gray-500">
              {myRecognitions != null
                ? `Recognitions by ${user?.name ?? "you"}`
                : "Sum of recognitions_today (fallback)"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* directory header */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex gap-3 items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
                placeholder="Search staff by name, email or prison..."
              />
            </div>
          </div>

          {/* table header */}
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-sm text-gray-500">
                <tr>
                  <th className="py-3">Name</th>
                  <th>Email</th>
                  <th>Prison</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                      Loading staff...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Link
                          href={`/staff-management/${o.id}`}
                          className="font-medium hover:underline"
                        >
                          {o.name}
                        </Link>
                      </td>
                      <td>{o.email}</td>
                      <td>{(o as any).prison_name ?? "—"}</td>
                      <td className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(o)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => remove(o)}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                      No staff found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-md w-[480px] max-w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {editing ? "Edit Staff" : "Add New Staff"}
            </h3>

            {error && (
              <div className="mb-3">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <label className="space-y-1">
                <div className="text-sm">Full name</div>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, name: e.target.value }))
                  }
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm">Email</div>
                <Input
                  value={form.email}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, email: e.target.value }))
                  }
                />
              </label>

              <label className="space-y-1">
                <div className="text-sm">Prison / Facility name</div>
                <Input
                  value={form.prison_name ?? ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, prison_name: e.target.value }))
                  }
                />
              </label>

              {!editing && (
                <label className="space-y-1">
                  <div className="text-sm">Password</div>
                  <Input
                    type="password"
                    value={form.password ?? ""}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, password: e.target.value }))
                    }
                  />
                </label>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={loading}>
                {editing ? "Save changes" : "Create staff"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
