import React, { useState, useEffect } from "react";
import { ServiceCall } from "@/entities/ServiceCall";
import { Client } from "@/entities/Client";
import { Device } from "@/entities/Device";
import { User } from "@/entities/User";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import ServiceCallList from "../components/serviceCalls/ServiceCallList";
import ServiceCallForm from "../components/serviceCalls/ServiceCallForm";

export default function ServiceCalls() {
  const [serviceCalls, setServiceCalls] = useState([]);
  const [clients, setClients] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [callsData, clientsData, devicesData, usersData, userData] = await Promise.all([
        ServiceCall.list(),
        Client.list(),
        Device.list(),
        User.list(),
        User.me().catch(() => null)
      ]);

      // Sort calls by call_number descending (newest first)
      const sortedCalls = (callsData || []).sort((a, b) => {
        if (!a?.call_number && !b?.call_number) return 0;
        if (!a?.call_number) return -1;
        if (!b?.call_number) return 1;
        return b.call_number - a.call_number;
      });

      setServiceCalls(sortedCalls);
      setClients(clientsData || []);
      setDevices(devicesData || []);
      setUsers(usersData || []);
      setCurrentUser(userData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בטעינת נתונים",
        description: "אנא נסה שנית"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingCall(null);
    setShowForm(true);
  };

  const handleEdit = (call) => {
    setEditingCall(call);
    setShowForm(true);
  };

  const handleDelete = async (callId) => {
    if (confirm("האם אתה בטוח שברצונך למחוק קריאה זו?")) {
      try {
        await ServiceCall.delete(callId);
        toast({ title: "הקריאה נמחקה בהצלחה" });
        loadData();
      } catch (error) {
        console.error("Error deleting service call:", error);
        toast({
          variant: "destructive",
          title: "שגיאה במחיקת הקריאה"
        });
      }
    }
  };

  const handleSubmit = async (callData) => {
    try {
      if (editingCall) {
        await ServiceCall.update(editingCall.id, callData);
        toast({ title: "הקריאה עודכנה בהצלחה" });
      } else {
        await ServiceCall.create(callData);
        toast({ title: "קריאה חדשה נוצרה בהצלחה" });
      }
      setShowForm(false);
      setEditingCall(null);
      loadData();
    } catch (error) {
      console.error("Error saving service call:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת הקריאה"
      });
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">קריאות שירות</h1>
          {currentUser?.role === 'admin' && (
            <Button onClick={handleAddNew} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              קריאה חדשה
            </Button>
          )}
        </div>

        <ServiceCallList
          serviceCalls={serviceCalls}
          clients={clients}
          devices={devices}
          users={users}
          currentUser={currentUser}
          onEdit={handleEdit}
          onDelete={handleDelete}
          loading={loading}
        />
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingCall ? 'עריכת קריאת שירות' : 'קריאת שירות חדשה'}
            </DialogTitle>
          </DialogHeader>
          <ServiceCallForm
            call={editingCall}
            clients={clients}
            devices={devices}
            users={users}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCall(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}