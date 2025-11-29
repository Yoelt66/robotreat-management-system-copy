import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Edit, Trash2, Calendar, User as UserIcon, Wrench } from "lucide-react";
import { format } from "date-fns";

const statusLabels = {
  temporary: "זמני",
  pending: "טיוטה",
  assigned: "סגור",
  in_progress: "אושר",
  completed: "הוקלד",
  final: "סופי",
  cancelled: "מבוטל"
};

const statusColors = {
  temporary: "bg-red-100 text-red-800",
  pending: "bg-yellow-100 text-yellow-800",
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  final: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-800"
};

const serviceTypeLabels = {
  repair: "תקלה",
  inspection: "תקלה חוזרת",
  maintenance: "טיפול",
  parts: "חלקים",
  emergency: "חירום",
  installation: "התקנה",
  other: "אחר"
};

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

export default function ServiceCallList({ 
  serviceCalls, 
  clients, 
  devices, 
  users, 
  currentUser,
  onEdit, 
  onDelete, 
  loading 
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");

  const filteredCalls = useMemo(() => {
    return serviceCalls.filter(call => {
      const matchesSearch = 
        searchTerm.length < 3 ||
        call.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.call_number?.toString().includes(searchTerm) ||
        call.device?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === "all" || 
        call.status === statusFilter;

      const matchesTechnician = 
        technicianFilter === "all" || 
        call.assigned_to === technicianFilter;

      return matchesSearch && matchesStatus && matchesTechnician;
    });
  }, [serviceCalls, searchTerm, statusFilter, technicianFilter]);

  if (loading) {
    return <div className="text-center py-8">טוען קריאות שירות...</div>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="חיפוש לפי לקוח, מספר קריאה, מכשיר או תיאור (3 תווים לפחות)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="סטטוס" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הסטטוסים</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="טכנאי" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הטכנאים</SelectItem>
            {users.map(user => (
              <SelectItem key={user.id} value={user.email}>
                {user.nickname || user.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        מציג {filteredCalls.length} מתוך {serviceCalls.length} קריאות
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">מספר קריאה</TableHead>
              <TableHead className="text-center">לקוח</TableHead>
              <TableHead className="text-center">מכשיר</TableHead>
              <TableHead className="text-center">תיאור</TableHead>
              <TableHead className="text-center">סוג שירות</TableHead>
              <TableHead className="text-center">תאריך</TableHead>
              <TableHead className="text-center">טכנאי</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
              {currentUser?.role === 'admin' && (
                <TableHead className="text-center">פעולות</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={currentUser?.role === 'admin' ? 9 : 8} 
                  className="text-center py-8 text-gray-500"
                >
                  לא נמצאו קריאות תואמות
                </TableCell>
              </TableRow>
            ) : (
              filteredCalls.map((call) => (
                <TableRow key={call.id} className="hover:bg-gray-50">
                  <TableCell className="text-center font-mono font-bold">
                    {call.call_number || '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-medium">{call.client_name}</div>
                    {call.client_phone && (
                      <div className="text-sm text-gray-500">{call.client_phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {call.device ? (
                      <div>
                        <div className="font-medium">{call.device}</div>
                        {call.device_type && (
                          <div className="text-sm text-gray-500">
                            {deviceTypeLabels[call.device_type] || call.device_type}
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center max-w-xs">
                    <div className="truncate" title={call.description}>
                      {call.description || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {call.service_type ? (
                      <Badge variant="outline">
                        {serviceTypeLabels[call.service_type] || call.service_type}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {call.scheduled_date ? (
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-gray-500" />
                        {format(new Date(call.scheduled_date), 'dd/MM/yyyy')}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {call.assigned_to_nickname || call.assigned_to ? (
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <UserIcon className="h-3 w-3 text-gray-500" />
                        {call.assigned_to_nickname || call.assigned_to}
                      </div>
                    ) : (
                      <span className="text-gray-400">לא משובץ</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColors[call.status] || 'bg-gray-100 text-gray-800'}>
                      {statusLabels[call.status] || call.status}
                    </Badge>
                  </TableCell>
                  {currentUser?.role === 'admin' && (
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(call)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(call.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}