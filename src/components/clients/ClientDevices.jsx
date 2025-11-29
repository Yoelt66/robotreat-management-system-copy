import React, { useState, useEffect } from 'react';
import { Device } from '@/entities/Device';
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";

const deviceTypeLabels = {
    Astronaut_A3: "Astronaut A3",
    Astronaut_A3N: "Astronaut A3N",
    Astronaut_A4: "Astronaut A4",
    Delaval_2008: "Delaval 2008",
    Delaval_2011: "Delaval 2011",
    Milk_tank: "מיכל חלב",
    CRS: "CRS+",
    Juno_100: "Juno 100",
    Juno_150: "Juno 150",
    Luna: "Luna",
    other: "מערכת אחרת"
  };

export default function ClientDevices({ clientId, onDeviceUpdate }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  useEffect(() => {
    if (clientId) {
      loadDevices();
    }
  }, [clientId]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const deviceList = await Device.filter({ client_id: clientId });
      setDevices(deviceList || []);
    } catch (error) {
      console.error("Error loading devices:", error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data) => {
    try {
      if (editingDevice) {
        await Device.update(editingDevice.id, { ...data, client_id: clientId });
      } else {
        await Device.create({ ...data, client_id: clientId });
      }
      setShowForm(false);
      setEditingDevice(null);
      loadDevices();
      if (onDeviceUpdate) onDeviceUpdate();
    } catch (error) {
      console.error("Error saving device:", error);
      alert("שגיאה בשמירת המערכת. אנא נסה שנית.");
    }
  };

  const handleDelete = async (device) => {
    if (!window.confirm("האם אתה בטוח שברצונך למחוק את המערכת הזו?")) return;
    try {
      await Device.delete(device.id);
      loadDevices();
      if (onDeviceUpdate) onDeviceUpdate();
    } catch (error) {
      console.error("Error deleting device:", error);
      alert("שגיאה במחיקת המערכת. אנא נסה שנית.");
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setShowForm(true);
  };

  const getDeviceTypeLabel = (type) => {
    return deviceTypeLabels[type] || type || "לא צוין";
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">מערכות</h2>
        <Button
          onClick={() => {
            setEditingDevice(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 flex items-center"
        >
          <PlusCircle className="w-4 h-4 ml-2" />
          הוסף מערכת
        </Button>
      </div>

      {showForm ? (
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              handleSubmit({
                name: formData.get('name'),
                type: formData.get('type'),
                serial_number: formData.get('serial_number'),
                location: formData.get('location')
              });
            }}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    שם המערכת
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    defaultValue={editingDevice?.name || ''}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                    סוג מערכת
                  </label>
                  <select
                    name="type"
                    id="type"
                    required
                    defaultValue={editingDevice?.type || 'other'}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    {Object.entries(deviceTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="serial_number" className="block text-sm font-medium text-gray-700">
                    מספר סידורי
                  </label>
                  <input
                    type="text"
                    name="serial_number"
                    id="serial_number"
                    required
                    defaultValue={editingDevice?.serial_number || ''}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    מיקום
                  </label>
                  <input
                    type="text"
                    name="location"
                    id="location"
                    defaultValue={editingDevice?.location || ''}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingDevice(null);
                  }}
                >
                  ביטול
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {editingDevice ? 'עדכן מערכת' : 'הוסף מערכת'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם מערכת</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>מספר סידורי</TableHead>
              <TableHead>מיקום</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell>{device.name}</TableCell>
                <TableCell>{getDeviceTypeLabel(device.type)}</TableCell>
                <TableCell>{device.serial_number}</TableCell>
                <TableCell>{device.location || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(device)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(device)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  אין מערכות להצגה
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}