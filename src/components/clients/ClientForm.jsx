
import React, { useState, useEffect } from 'react';
import { Device } from '@/entities/Device';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { XCircle, CheckCircle, Settings2, PlusCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DeviceForm from './DeviceForm';

export default function ClientForm({ client, onSubmit, onCancel }) {
  const [activeTab, setActiveTab] = useState("details");
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    ...client
  });
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client && client.id) {
      loadExistingDevices(client.id);
    }
  }, [client]);

  const loadExistingDevices = async (clientId) => {
    try {
      setLoading(true);
      const deviceList = await Device.filter({ client_id: clientId });

      const devicesWithTempId = deviceList.map(device => ({
        ...device,
        tempId: Date.now() + Math.random()
      }));

      setDevices(devicesWithTempId);
    } catch (error) {
      console.error("Error loading devices:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = () => {
    setCurrentDevice({
      name: '',
      type: '',
      model: '',
      serial_number: '',
      installation_date: '',
      location: '',
      notes: '',
      parts: []
    });
    setActiveTab("device");
  };

  const handleDeviceSubmit = (deviceData) => {
    if (currentDevice && currentDevice.tempId) {
      setDevices(prev =>
        prev.map(d => d.tempId === currentDevice.tempId ? { ...deviceData, tempId: currentDevice.tempId, id: currentDevice.id } : d)
      );
    } else {
      setDevices(prev => [...prev, { ...deviceData, tempId: Date.now() }]);
    }
    setCurrentDevice(null);
    setActiveTab("devices");
  };

  const handleEditDevice = (device) => {
    setCurrentDevice(device);
    setActiveTab("device");
  };

  const handleRemoveDevice = (device) => {
    if (device.id) {
      setDevices(prev => prev.map(d =>
        d.tempId === device.tempId ? { ...d, _markForDeletion: true } : d
      ));
    } else {
      setDevices(prev => prev.filter(d => d.tempId !== device.tempId));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const result = await onSubmit(formData);
    
    if (result && result.id) {
      const clientId = result.id;
      
      if (result.createDevices) {
        const devicesToSave = devices.filter(device => !device._markForDeletion);
        const devicesToDelete = devices.filter(device => device.id && device._markForDeletion);
        
        await result.createDevices(devicesToSave);
        
        for (const device of devicesToDelete) {
          await Device.delete(device.id);
        }
      }
    }
  };

  if (activeTab === "device") {
    return (
      <DeviceForm
        device={currentDevice}
        onSubmit={handleDeviceSubmit}
        onCancel={() => {
          setCurrentDevice(null);
          setActiveTab("devices");
        }}
      />
    );
  }

  const visibleDevices = devices.filter(device => !device._markForDeletion);

  return (
    <Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <CardHeader>
          <CardTitle>{client ? 'Edit Client' : 'New Client'}</CardTitle>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Client Details</TabsTrigger>
            <TabsTrigger value="devices">
              Devices {visibleDevices.length > 0 && `(${visibleDevices.length})`}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <TabsContent value="details">
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter client name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Service Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter service address"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any additional notes about the client"
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="devices">
            <CardContent>
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Settings2 className="w-5 h-5" />
                  Client Devices
                </h3>
                <Button
                  type="button"
                  onClick={handleAddDevice}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Device
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <p>Loading devices...</p>
                  </div>
                </div>
              ) : visibleDevices.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border rounded-lg">
                  No devices added yet. Click the button above to add a device.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleDevices.map((device) => (
                    <div key={device.tempId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">
                              {device.type === 'Astronaut_A3' ? '🐮' : 
                               device.type === 'Astronaut_A3N' ? '🐮' : 
                               device.type === 'Astronaut_A4' ? '🐮' : 
                               device.type === 'Delaval_2008' ? '🐮' : 
                               device.type === 'Delaval_2011' ? '🐮' : 
                               device.type === 'Milk_tank' ? '❄️' : 
                               device.type === 'CRS+' ? '📟' : 
                               device.type === 'Juno_100' ? '💯' : 
                               device.type === 'Juno_150' ? '🔴' :
                               device.type === 'Luna' ? '𖦹' : '⚙️'}
                            </span>
                            <div>
                              <h4 className="font-medium">{device.name}</h4>
                              <p className="text-sm text-gray-500">
                                {device.type === 'Astronaut_A3' ? 'Astronaut A3' : 
                                 device.type === 'Astronaut_A3N' ? 'Astronaut A3N' : 
                                 device.type === 'Astronaut_A4' ? 'Astronaut A4' : 
                                 device.type === 'Delaval_2008' ? 'Delaval 2008' : 
                                 device.type === 'Delaval_2011' ? 'Delaval 2011' : 
                                 device.type === 'Milk_tank' ? 'מיכל חלב' : 
                                 device.type === 'CRS+' ? 'CRS+' : 
                                 device.type === 'Juno_100' ? 'Juno 100' : 
                                 device.type === 'Juno_150' ? 'Juno 150' : 
                                 device.type === 'Luna' ? 'Luna' : 'אחר'}
                              </p>
                            </div>
                          </div>
                          {device.serial_number && (
                            <p className="text-sm text-gray-500 mt-1">
                              מס' סידורי: {device.serial_number}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditDevice(device)}
                          >
                            עריכה
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleRemoveDevice(device)}
                            className="text-red-600 hover:text-red-700"
                          >
                            הסרה
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </TabsContent>

          <CardFooter className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {client ? 'Update' : 'Create'} Client
            </Button>
          </CardFooter>
        </form>
      </Tabs>
    </Card>
  );
}
