import React, { useState, useEffect } from 'react';
import { Client } from '@/entities/Client';
import { getParts } from "@/functions/getParts";
import { User } from "@/entities/User";
import { Device } from "@/entities/Device";
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  XCircle, 
  CheckCircle, 
  Loader2, 
  Building2, 
  Phone, 
  MapPin, 
  Clock, 
  Calendar as CalendarIcon, 
  Plus, 
  X, 
  Check, 
  User as UserIcon, 
  Wrench 
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

const formatTime = (time) => {
  if (!time) return '--:--';
  return time.padStart(5, '0');
};

export default function ServiceCallForm({ initialData, onSubmit, onCancel }) {
  const getDefaultTimes = () => {
    if (initialData?.start_time && initialData?.end_time) {
      return { start_time: initialData.start_time, end_time: initialData.end_time };
    }
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const roundedMinutes = minutes < 30 ? 0 : 30;
    
    const startHours = hours.toString().padStart(2, '0');
    const startMinutes = roundedMinutes.toString().padStart(2, '0');
    const startTime = `${startHours}:${startMinutes}`;
    
    let endHours = hours + 1;
    if (endHours >= 24) endHours = 23;
    const endHoursStr = endHours.toString().padStart(2, '0');
    const endTime = `${endHoursStr}:${startMinutes}`;
    
    return { start_time: startTime, end_time: endTime };
  };
  
  const defaultTimes = getDefaultTimes();

  const [formData, setFormData] = useState({
    client_name: '',
    device_id: '',
    service_type: 'repair',
    description: '',
    status: 'pending',
    scheduled_date: initialData?.scheduled_date || new Date().toISOString().split('T')[0],
    start_time: defaultTimes.start_time,
    end_time: defaultTimes.end_time,
    assigned_to: '',
    assigned_to_nickname: '',
    notes: '',
    device: '',
    no_travel: false,
    no_work_hours: false,
    is_draft: initialData?.status === 'pending' || false,
    ...initialData
  });

  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableParts, setAvailableParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState(initialData?.parts_used || []);
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [partsSearch, setPartsSearch] = useState('');
  const [duration, setDuration] = useState('');
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');

  useEffect(() => {
    loadClients();
    loadParts();
    loadUsers();
    loadCurrentUser();
  }, []);

  useEffect(() => {
    calculateDuration();
  }, [formData.start_time, formData.end_time, formData.no_work_hours]);

  useEffect(() => {
    if (formData.client_name) {
      loadClientDevices();
    } else {
      setDevices([]);
    }
  }, [formData.client_name]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientList = await Client.list();
      setClients(clientList || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const loadParts = async () => {
    try {
      const parts = await Part.list();
      setAvailableParts(parts || []);
    } catch (error) {
      console.error("Error loading parts:", error);
      setAvailableParts([]);
    }
  };

  const loadUsers = async () => {
    try {
      const usersList = await User.list();
      setUsers(usersList || []);
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      if (!initialData) {
        setFormData(prev => ({
          ...prev,
          assigned_to: user.email,
          assigned_to_nickname: user.nickname || user.full_name
        }));
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadClientDevices = async () => {
    try {
      const clientsList = await Client.list();
      const client = clientsList.find(c => c.name === formData.client_name);
      
      if (client) {
        const devicesList = await Device.list();
        const clientDevices = devicesList.filter(device => device.client_id === client.id);
        setDevices(clientDevices);
      }
    } catch (error) {
      console.error("Error loading client devices:", error);
      setDevices([]);
    }
  };

  const calculateDuration = () => {
    if (formData.no_work_hours) {
      setDuration('ללא שעות עבודה');
      return;
    }
    
    const { start_time, end_time } = formData;
    if (!start_time || !end_time) {
      setDuration('');
      return;
    }

    try {
      const [startHours, startMinutes] = start_time.split(':').map(Number);
      const [endHours, endMinutes] = end_time.split(':').map(Number);

      let diffHours = endHours - startHours;
      let diffMinutes = endMinutes - startMinutes;

      if (diffHours < 0 || (diffHours === 0 && diffMinutes < 0)) {
        diffHours += 24;
      }

      if (diffMinutes < 0) {
        diffHours -= 1;
        diffMinutes += 60;
      }

      setDuration(`${diffHours} שעות ${diffMinutes} דקות`);
    } catch (e) {
      console.error("Error calculating duration:", e);
      setDuration('פורמט זמן לא תקין');
    }
  };

  const handleChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    
    if (field === 'no_work_hours' && value === true) {
      newFormData.end_time = newFormData.start_time;
    }
    
    setFormData(newFormData);
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    const formattedDate = format(date, "yyyy-MM-dd");
    handleChange('scheduled_date', formattedDate);
  };

  const handleDateDoubleClick = (date) => {
    if (!date) return;
    handleDateSelect(date);
    document.querySelector('[role="dialog"]')?.parentElement?.click();
    setTimeout(() => {
      document.getElementById('start_time')?.focus();
    }, 100);
  };

  const handleClientSelect = (client) => {
    setFormData(prev => ({
      ...prev,
      client_name: client.name,
      location: client.address || '',
      phone: client.phone || ''
    }));
    setShowClientDialog(false);
  };

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.name?.toLowerCase().includes(searchLower) ||
      client.company?.toLowerCase().includes(searchLower) ||
      client.phone?.includes(searchTerm) ||
      client.email?.toLowerCase().includes(searchLower)
    );
  });

  const filteredUsers = users.filter(user => {
    const searchTerm = userSearch.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchTerm) ||
      user.nickname?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm)
    );
  });

  const formattedDate = formData.scheduled_date 
    ? format(new Date(formData.scheduled_date), "dd/MM/yyyy") 
    : '';

  const handlePartAdd = (part) => {
    const existingPart = selectedParts.find(p => p.part_id === part.id);
    if (existingPart) {
      setSelectedParts(selectedParts.map(p => 
        p.part_id === part.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      setSelectedParts([...selectedParts, {
        part_id: part.id,
        part_number: part.sku,
        name: part.name,
        quantity: 1
      }]);
    }
  };

  const handlePartRemove = (partId) => {
    setSelectedParts(selectedParts.filter(p => p.part_id !== partId));
  };

  const handlePartQuantityChange = (partId, newQuantity) => {
    if (newQuantity < 1) return;
    setSelectedParts(selectedParts.map(p => 
      p.part_id === partId 
        ? { ...p, quantity: newQuantity }
        : p
    ));
  };

  const handleUserSelect = (user) => {
    setFormData(prev => ({
      ...prev,
      assigned_to: user.email,
      assigned_to_nickname: user.nickname || user.full_name
    }));
    setShowUserDialog(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const finalFormData = {
      ...formData,
      status: formData.is_draft ? 'pending' : 'assigned'
    };
    
    onSubmit(finalFormData);
  };

  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      const formattedHour = hour.toString().padStart(2, '0');
      options.push(`${formattedHour}:00`);
      options.push(`${formattedHour}:30`);
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  const serviceTypeLabels = {
    repair: "תקלה",
    inspection: "תקלה חוזרת",
    maintenance: "טיפול",
    parts: "חלקים",
    emergency: "חירום",
    installation: "התקנה",
    other: "אחר"
  };

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader>
        <CardTitle>{initialData ? 'עריכת קריאת שירות' : 'קריאת שירות חדשה'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="assigned_to">טכנאי מטפל</Label>
              <div className="flex gap-2">
                <Input
                  id="assigned_to_display"
                  value={formData.assigned_to_nickname || formData.assigned_to || ""}
                  readOnly
                  placeholder="בחר טכנאי"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowUserDialog(true)}
                  className="gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  בחר טכנאי
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled_date">תאריך מתוכנן</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-right font-normal"
                  >
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formData.scheduled_date ? format(new Date(formData.scheduled_date), "dd/MM/yyyy") : "בחר תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.scheduled_date ? new Date(formData.scheduled_date) : undefined}
                    onSelect={handleDateSelect}
                    onDayDoubleClick={handleDateDoubleClick}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name">לקוח</Label>
              <div className="flex gap-2">
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => handleChange('client_name', e.target.value)}
                  placeholder="הכנס שם לקוח"
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowClientDialog(true)}
                  className="gap-2"
                >
                  <UserIcon className="w-4 h-4" />
                  בחר לקוח
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_type">סוג שירות</Label>
              <Select
                value={formData.service_type}
                onValueChange={(value) => handleChange('service_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר סוג שירות" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="repair">תקלה</SelectItem>
                  <SelectItem value="inspection">תקלה חוזרת</SelectItem>
                  <SelectItem value="maintenance">טיפול</SelectItem>
                  <SelectItem value="parts">חלקים</SelectItem>
                  <SelectItem value="emergency">חירום</SelectItem>
                  <SelectItem value="installation">התקנה</SelectItem>
                  <SelectItem value="other">אחר</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device">מכשיר</Label>
              <div className="flex gap-2">
                <Input
                  id="device"
                  value={formData.device || ''}
                  onChange={(e) => handleChange('device', e.target.value)}
                  placeholder="בחר מכשיר"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDeviceDialog(true)}
                  className="gap-2"
                  disabled={!formData.client_name}
                >
                  <Wrench className="w-4 h-4" />
                  בחר מכשיר
                </Button>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="no_travel"
                    checked={formData.no_travel}
                    onChange={(e) => handleChange('no_travel', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <Label htmlFor="no_travel" className="cursor-pointer">ללא נסיעה</Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="no_work_hours"
                    checked={formData.no_work_hours}
                    onChange={(e) => handleChange('no_work_hours', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <Label htmlFor="no_work_hours" className="cursor-pointer">ללא שעות עבודה</Label>
                </div>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="is_draft"
                    checked={formData.is_draft || false}
                    onChange={(e) => handleChange('is_draft', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <Label htmlFor="is_draft" className="cursor-pointer">טיוטה</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">שעת סיום</Label>
              <Select
                value={formData.end_time || ""}
                onValueChange={(value) => handleChange('end_time', value)}
                disabled={formData.no_work_hours}
              >
                <SelectTrigger id="end_time" className={`font-mono ${formData.no_work_hours ? "opacity-60" : ""}`}>
                  <SelectValue placeholder="בחר שעת סיום" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={`end-${time}`} value={time} className="font-mono">
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.start_time && (
                <p className="text-xs text-gray-500 mt-1">שעת התחלה: {formData.start_time}</p>
              )}
              {duration && <p className="text-xs text-gray-500">משך: {duration}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_time">שעת תחילה</Label>
              <Select
                value={formData.start_time || ""}
                onValueChange={(value) => handleChange('start_time', value)}
                disabled={formData.no_work_hours}
              >
                <SelectTrigger id="start_time" className={`font-mono ${formData.no_work_hours ? "opacity-60" : ""}`}>
                  <SelectValue placeholder="בחר שעת התחלה" />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={`start-${time}`} value={time} className="font-mono">
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between items-center">
                <Label>חלקים</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPartsDialog(true)}
                >
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף חלקים
                </Button>
              </div>
              {selectedParts.length > 0 && (
                <div className="border rounded-lg mt-2">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">מק"ט</th>
                        <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">שם</th>
                        <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">כמות</th>
                        <th className="py-2 px-4 text-right text-sm font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedParts.map((part) => (
                        <tr key={part.part_id}>
                          <td className="py-2 px-4">{part.part_number}</td>
                          <td className="py-2 px-4">{part.name}</td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePartQuantityChange(part.part_id, part.quantity - 1)}
                              >-</Button>
                              <span>{part.quantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePartQuantityChange(part.part_id, part.quantity + 1)}
                              >+</Button>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-left">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePartRemove(part.part_id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="תאר את השירות הנדרש"
                required
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">הערות נוספות</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="הוסף הערות נוספות"
                className="min-h-[100px]"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            <XCircle className="w-4 h-4" />
            ביטול
          </Button>
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <CheckCircle className="w-4 h-4" />
            {initialData ? 'עדכן' : 'צור'} קריאת שירות
          </Button>
        </CardFooter>
      </form>

      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>בחר לקוח</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חפש לקוחות..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <div className="border rounded-lg divide-y">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    טוען לקוחות...
                  </div>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  לא נמצאו לקוחות.
                </div>
              ) : (
                filteredClients.map(client => (
                  <div
                    key={client.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleClientSelect(client)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {client.name?.[0]?.toUpperCase() || "C"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{client.name}</h3>
                            {client.company && (
                              <Badge variant="outline" className="mt-1">
                                <Building2 className="w-3 h-3 mr-1" />
                                {client.company}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-gray-500">
                          {client.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-2" />
                              {client.phone}
                            </div>
                          )}
                          {client.address && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-2" />
                              {client.address}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPartsDialog} onOpenChange={setShowPartsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>בחר חלקים</DialogTitle>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setShowPartsDialog(false)}
            >
              סגור
            </Button>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="חפש חלקים..."
              value={partsSearch}
              onChange={(e) => setPartsSearch(e.target.value)}
              className="mb-4"
              dir="rtl"
            />
            <div className="border rounded-lg divide-y">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">מק"ט</th>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">שם</th>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">במלאי</th>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">כמות</th>
                    <th className="py-2 px-4 text-right text-sm font-medium text-gray-500">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {availableParts
                    .filter(part => 
                      part.name?.toLowerCase().includes(partsSearch.toLowerCase()) ||
                      part.sku?.toLowerCase().includes(partsSearch.toLowerCase())
                    )
                    .map(part => {
                      const existingPart = selectedParts.find(p => p.part_id === part.id);
                      const quantity = existingPart ? existingPart.quantity : 0;
                      
                      return (
                        <tr
                          key={part.id}
                          className={quantity > 0 ? "bg-blue-50" : "hover:bg-gray-50"}
                          onClick={() => {
                            if (!existingPart) {
                              handlePartAdd(part);
                            }
                          }}
                          style={{cursor: "pointer"}}
                        >
                          <td className="py-2 px-4">{part.part_number}</td>
                          <td className="py-2 px-4">{part.name}</td>
                          <td className="py-2 px-4">
                            {part.stock_quantity !== undefined ? part.stock_quantity : 'כן'}
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (quantity > 0) {
                                    handlePartQuantityChange(part.id, quantity - 1);
                                  }
                                }}
                                className="h-6 w-6 p-0"
                              >-</Button>
                              <span>{quantity}</span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (existingPart) {
                                    handlePartQuantityChange(part.id, quantity + 1);
                                  } else {
                                    handlePartAdd(part);
                                  }
                                }}
                                className="h-6 w-6 p-0"
                              >+</Button>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-left">
                            {quantity > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePartRemove(part.id);
                                }}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>בחר טכנאי</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="חפש טכנאי..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  לא נמצאו טכנאים
                </div>
              ) : (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {(user.nickname || user.full_name)?.[0]?.toUpperCase() || "ט"}
                      </span>
                    </div>
                    <div className="mr-3">
                      <p className="font-medium">{user.nickname || user.full_name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    {formData.assigned_to === user.email && (
                      <Check className="mr-auto h-5 w-5 text-green-500" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeviceDialog} onOpenChange={setShowDeviceDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>בחר מכשיר</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {devices.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {!formData.client_name ? 
                  "יש לבחור לקוח תחילה" : 
                  "אין מכשירים זמינים ללקוח זה"}
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    onClick={() => {
                      handleChange('device', `${device.name} - ${device.model || device.type}`);
                      setShowDeviceDialog(false);
                    }}
                    className="flex items-center p-3 rounded-md hover:bg-gray-100 cursor-pointer"
                  >
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-gray-500">
                        {device.model || device.type}
                        {device.serial_number && ` - ${device.serial_number}`}
                      </p>
                      {device.location && (
                        <p className="text-sm text-gray-500">{device.location}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}