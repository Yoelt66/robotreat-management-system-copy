import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { 
  CheckCircle2, 
  Clock, 
  Eye,
  Calendar,
  User as UserIcon,
  ArrowUpDown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceCall } from "@/entities/ServiceCall";
import { User } from "@/entities/User";
import { SendEmail } from "@/integrations/Core";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  temporary: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  assigned: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  final: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
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

const serviceTypeLabels = {
  repair: "תקלה",
  inspection: "תקלה חוזרת",
  maintenance: "טיפול",
  parts: "חלקים",
  emergency: "חירום",
  installation: "התקנה",
  other: "אחר"
};

const parseDisplayDate = (dateString) => {
  if (!dateString) return null;
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const d = new Date(dateString);
    if (!isNaN(d)) return d;
  }
  
  const parts = dateString.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
  if (parts) {
    const d = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
    if (!isNaN(d)) return d;
  }

  const d = new Date(dateString);
  if (!isNaN(d)) return d;

  return null;
};

const SORT_STORAGE_KEY = 'dashboard_calls_sort';

export default function RecentCalls({ calls = [], loading, userEmail, onCallsUpdated }) {
  const [viewCall, setViewCall] = useState(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentCallIndex, setCurrentCallIndex] = useState(0);
  const [originalFilter, setOriginalFilter] = useState(null);
  
  // Sort state - load from localStorage
  const [sortField, setSortField] = useState(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).field || 'call_number';
      } catch { return 'call_number'; }
    }
    return 'call_number';
  });
  const [sortDirection, setSortDirection] = useState(() => {
    const saved = localStorage.getItem(SORT_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).direction || 'desc';
      } catch { return 'desc'; }
    }
    return 'desc';
  });

  const ITEMS_PER_PAGE = 10;

  // Save sort preference to localStorage
  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ field: sortField, direction: sortDirection }));
  }, [sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedCalls = useMemo(() => {
    const safeCallsArray = Array.isArray(calls) ? calls : [];
    return [...safeCallsArray].sort((a, b) => {
      let aVal, bVal;
      
      if (sortField === 'call_number') {
        aVal = parseInt(a.call_number) || 0;
        bVal = parseInt(b.call_number) || 0;
      } else if (sortField === 'scheduled_date') {
        aVal = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
        bVal = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }, [calls, sortField, sortDirection]);

  const totalCalls = sortedCalls.length;
  const totalPages = Math.ceil(totalCalls / ITEMS_PER_PAGE);
  const currentCalls = sortedCalls.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleNavigateCall = (direction) => {
    const totalCallsOnCurrentPage = currentCalls.length;
    if (totalCallsOnCurrentPage <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentCallIndex + 1) % totalCallsOnCurrentPage;
    } else {
      newIndex = (currentCallIndex - 1 + totalCallsOnCurrentPage) % totalCallsOnCurrentPage;
    }

    setCurrentCallIndex(newIndex);
    setViewCall(currentCalls[newIndex]);
    
    setTimeout(() => {
      const contentElement = document.querySelector('[data-dialog-content]');
      if (contentElement) {
        contentElement.scrollTop = 0;
      }
    }, 100);
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'לא צוין';
    
    try {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);

      let diffHours = endHours - startHours;
      let diffMinutes = endMinutes - startMinutes;

      if (diffHours < 0 || (diffHours === 0 && diffMinutes < 0)) {
        diffHours += 24;
      }

      if (diffMinutes < 0) {
        diffHours -= 1;
        diffMinutes += 60;
      }

      return `${diffHours} שעות ו-${diffMinutes} דקות`;
    } catch (e) {
      console.error("Error calculating duration:", e);
      return 'פורמט זמן לא תקין';
    }
  };

  const openDialog = (call) => {
    try {
      const refreshCall = async () => {
        try {
          if (call && call.id) {
            const freshCall = await ServiceCall.filter({ id: call.id });
            if (freshCall && freshCall.length > 0) {
              setViewCall(freshCall[0]);
              setCurrentCallIndex(currentCalls.findIndex(c => c.id === call.id));
            } else {
              setViewCall(call);
              setCurrentCallIndex(currentCalls.indexOf(call));
            }
          } else {
            setViewCall(call);
            setCurrentCallIndex(currentCalls.indexOf(call));
          }
        } catch (error) {
          console.error("Error refreshing call data:", error);
          setViewCall(call);
          setCurrentCallIndex(currentCalls.indexOf(call));
        }
      };
      
      const user = localStorage.getItem('userData');
      if (user) {
        const userData = JSON.parse(user);
        setOriginalFilter(userData.dashboard_default_filter);
      }
      
      refreshCall();
      setShowViewDialog(true);
    } catch (error) {
      console.error("Error in openDialog:", error);
    }
  };

  const closeDialog = async () => {
    try {
      setShowViewDialog(false);
      
      if (originalFilter && typeof onCallsUpdated === 'function') {
        const userDataStr = localStorage.getItem('userData');
        if (userDataStr) {
          const userData = JSON.parse(userDataStr);
          userData.dashboard_default_filter = originalFilter;
          localStorage.setItem('userData', JSON.stringify(userData));
          await User.updateMyUserData({ dashboard_default_filter: originalFilter });
          await onCallsUpdated();
        }
      }
    } catch (error) {
      console.error("Error in closeDialog:", error);
    }
  };

  const formatCallSummary = (call) => {
    const lines = [
      `לקוח: ${call.client_name}`,
      `מספר קריאה: ${call.call_number || 'לא הוקצה'}`,
      `סטטוס: ${statusLabels[call.status] || call.status}`,
      `מערכת: ${call.device || 'לא צוין'}${call.device_type ? ` - ${deviceTypeLabels[call.device_type] || call.device_type}` : ''}`,
      `תאריך: ${call.scheduled_date ? format(new Date(call.scheduled_date), 'dd/MM/yyyy') : 'לא נקבע'}`,
      `סוג שירות: ${call.service_type ? serviceTypeLabels[call.service_type] || call.service_type : 'לא צוין'}`,
      `טכנאי מטפל: ${call.assigned_to_nickname || call.assigned_to || 'לא הוקצה'}`,
      `תיאור: ${call.description || 'אין תיאור'}`,
      `הערות: ${call.notes || 'אין הערות'}`,
    ];

    if (call.parts_used && call.parts_used.length > 0) {
      lines.push('\nחלקים בשימוש:');
      call.parts_used.forEach(part => {
        lines.push(`- ${part.name} (${part.part_number}) - כמות: ${part.quantity}`);
      });
    }

    return lines.join('\n');
  };

  const sendUpdateEmail = async (call) => {
    try {
      const users = await User.list();
      const admins = users.filter(user => 
        user.role === 'admin' && 
        user.email_notifications === true && 
        user.email
      );

      for (const admin of admins) {
        try {
          await SendEmail({
            to: admin.email,
            subject: `עדכון קריאת שירות - ${call.client_name} - קריאה ${call.call_number}`,
            body: formatCallSummary(call)
          });
        } catch (error) {
          console.error(`Error sending email to ${admin.email}:`, error);
        }
      }
    } catch (error) {
      console.error("Error sending update email:", error);
    }
  };

  const handleStatusChange = async (call, newStatus) => {
    try {
      await ServiceCall.update(call.id, { status: newStatus });
      
      const updatedCall = { ...call, status: newStatus };
      setViewCall(updatedCall);
      
      await sendUpdateEmail(updatedCall);
      
      if (typeof onCallsUpdated === 'function') {
        await onCallsUpdated();
      }

      const remainingCallsOnCurrentPage = currentCalls.filter(c => c.id !== call.id);
      
      if (remainingCallsOnCurrentPage.length === 0) {
        closeDialog();
      } else {
        let nextIndex = currentCallIndex;
        if (nextIndex >= remainingCallsOnCurrentPage.length) {
          nextIndex = 0;
        }
        
        setCurrentCallIndex(nextIndex);
        setViewCall(remainingCallsOnCurrentPage[nextIndex]);
      }
      
    } catch (error) {
      console.error("Error updating status:", error);
      alert("שגיאה בעדכון הסטטוס. אנא נסה שנית.");
    }
  };

  const SortableHeader = ({ field, children }) => (
    <TableHead 
      className="text-center cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
        {sortField === field && (
          <span className="text-xs text-blue-600">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>קריאות שירות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2 mr-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>קריאות שירות</CardTitle>
            <div className="text-sm text-gray-500">
              סה"כ: {totalCalls} קריאות
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentCalls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              אין קריאות שירות להצגה
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="call_number">מס׳ קריאה</SortableHeader>
                      <SortableHeader field="scheduled_date">תאריך</SortableHeader>
                      <TableHead className="text-center">לקוח</TableHead>
                      <TableHead className="text-center">מכשיר</TableHead>
                      <TableHead className="text-center">צפייה</TableHead>
                      <TableHead className="text-center">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentCalls.map((call) => {
                      const callDate = parseDisplayDate(call?.scheduled_date);
                      return (
                        <TableRow key={call?.id} className="hover:bg-gray-50">
                          <TableCell className="text-center font-mono font-bold">
                            {call?.call_number || '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {callDate ? (
                              <div className="flex items-center justify-center gap-1 text-sm">
                                <Calendar className="h-3 w-3 text-gray-500" />
                                {format(callDate, 'dd/MM/yyyy')}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">{call?.client_name}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            {call?.device ? (
                              <div>
                                <div className="font-medium">{call.device}</div>
                                {call.device_type && (
                                  <div className="text-sm text-gray-500">
                                    {deviceTypeLabels[call.device_type] || call.device_type}
                                  </div>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDialog(call)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={statusColors[call?.status] || 'bg-gray-100 text-gray-800'}>
                              {statusLabels[call?.status] || call?.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      הקודם
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageToShow;
                        if (totalPages <= 5) {
                          pageToShow = i + 1;
                        } else if (currentPage <= 3) {
                          pageToShow = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageToShow = totalPages - 4 + i;
                        } else {
                          pageToShow = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageToShow}
                            variant={currentPage === pageToShow ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageToShow)}
                            className={currentPage === pageToShow ? "bg-blue-600" : ""}
                          >
                            {pageToShow}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      הבא
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showViewDialog} onOpenChange={(open) => {
        if (!open) closeDialog();
      }}>
        <DialogContent className="p-0 flex flex-col h-screen w-screen max-w-full sm:max-w-4xl sm:h-auto sm:max-h-[95vh] sm:rounded-lg" dir="rtl">
          <DialogHeader className="p-4 md:p-6 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg">צפייה בקריאת שירות</DialogTitle>
              {viewCall?.call_number && (
                <Badge variant="outline" className="text-lg">
                  קריאה מס׳ {viewCall.call_number}
                </Badge>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6" data-dialog-content>
            {viewCall && (() => {
              const viewCallDate = parseDisplayDate(viewCall.scheduled_date);
              return (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">סטטוס</h3>
                    <Badge className={viewCall.status ? statusColors[viewCall.status] : ''}>
                      {viewCall.status ? statusLabels[viewCall.status] || viewCall.status : 'טיוטה'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">טכנאי</h3>
                    <div className="flex items-center gap-1">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                      <p>{viewCall.assigned_to_nickname || viewCall.assigned_to || 'לא הוקצה'}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">לקוח</h3>
                    <p className="text-lg">{viewCall.client_name}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">תאריך</h3>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p>{viewCallDate ? format(viewCallDate, 'dd/MM/yyyy') : 'לא צוין'}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">מערכת</h3>
                    <p className="flex items-center">
                      <span className="font-medium">{viewCall.device || 'לא צוין'}</span>
                      {viewCall.device_type && (
                        <span className="text-gray-500 mr-1">
                          {` - ${deviceTypeLabels[viewCall.device_type] || viewCall.device_type}`}
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">זמני טיפול</h3>
                    {viewCall.no_work_hours ? (
                      <div className="text-sm text-gray-500 italic mt-1">
                        ללא שעות עבודה
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>התחלה: {viewCall.start_time || 'לא צוין'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>סיום: {viewCall.end_time || 'לא צוין'}</span>
                        </div>
                        {viewCall.start_time && viewCall.end_time && (
                          <div className="text-sm text-blue-600">
                            משך זמן: {calculateDuration(viewCall.start_time, viewCall.end_time)}
                          </div>
                        )}
                      </div>
                    )}
                    {viewCall.no_travel && (
                      <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ללא נסיעה</span>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">סוג שירות</h3>
                    <p>{viewCall.service_type ? serviceTypeLabels[viewCall.service_type] || viewCall.service_type : 'לא צוין'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">תיאור</h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-md">
                    {viewCall.description || 'אין תיאור'}
                  </p>
                </div>

                {viewCall.parts_used && viewCall.parts_used.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">חלקים שהשתמשו</h3>
                    <div className="mt-2 border rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">מק"ט</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">שם חלק</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">כמות</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">מספר סידורי</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {viewCall.parts_used.map((part, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-500">{part.part_number}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">{part.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{part.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {part.has_serial && (
                                  <div>
                                    {part.old_serial && <div>ישן: {part.old_serial}</div>}
                                    <div>
                                      חדש:
                                      <Input
                                        type="text"
                                        value={part.new_serial || ''}
                                        onChange={async (e) => {
                                          const newSerial = e.target.value;
                                          const updatedParts = [...viewCall.parts_used];
                                          updatedParts[index] = { ...part, new_serial: newSerial };
                                          setViewCall({ ...viewCall, parts_used: updatedParts });

                                          if (part.autoSaveTimeout) {
                                            clearTimeout(part.autoSaveTimeout);
                                          }

                                          const timeoutId = setTimeout(async () => {
                                            try {
                                              const updateData = { parts_used: updatedParts };
                                              await ServiceCall.update(viewCall.id, updateData);
                                              await sendUpdateEmail({ ...viewCall, parts_used: updatedParts });
                                            } catch (error) {
                                              console.error("Error saving serial:", error);
                                            }
                                          }, 500);

                                          updatedParts[index] = { ...part, autoSaveTimeout: timeoutId };
                                          setViewCall(prev => ({ ...prev, parts_used: updatedParts }));
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-500">הערות</h3>
                  <textarea
                    className="w-full mt-1 p-2 bg-gray-50 rounded-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    value={viewCall.notes || ''}
                    onChange={async (e) => {
                      const newNotes = e.target.value;
                      setViewCall({...viewCall, notes: newNotes});
                      
                      if (viewCall.autoSaveTimeout) {
                        clearTimeout(viewCall.autoSaveTimeout);
                      }
                      
                      const timeoutId = setTimeout(async () => {
                        try {
                          await ServiceCall.update(viewCall.id, { notes: newNotes });
                          await sendUpdateEmail({ ...viewCall, notes: newNotes });
                        } catch (error) {
                          console.error("Error saving notes:", error);
                        }
                      }, 500);
                      
                      setViewCall(prev => ({...prev, autoSaveTimeout: timeoutId}));
                    }}
                    placeholder="הוסף הערות כאן..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">הערות נשמרות אוטומטית</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">שנה סטטוס</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(statusLabels)
                      .filter(([key]) => key !== 'temporary')
                      .map(([status, label]) => (
                        <Button 
                          key={status}
                          variant={viewCall.status === status ? 'default' : 'outline'}
                          onClick={() => handleStatusChange(viewCall, status)}
                          className={
                            viewCall.status === status 
                              ? `bg-${status === 'pending' ? 'yellow' : status === 'assigned' ? 'blue' : status === 'in_progress' ? 'purple' : 'final' ? 'orange' : status === 'completed' ? 'green' : 'gray'}-500 hover:bg-${status === 'pending' ? 'yellow' : status === 'assigned' ? 'blue' : status === 'in_progress' ? 'purple' : 'final' ? 'orange' : status === 'completed' ? 'green' : 'gray'}-600`
                              : ''
                          }
                        >
                          {label}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            )})()}
          </div>

          <DialogFooter className="p-4 md:p-6 border-t bg-gray-50 flex flex-row-reverse justify-between items-center gap-2">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleNavigateCall('prev')}
                disabled={currentCalls.length <= 1}
              >
                הקודם
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleNavigateCall('next')}
                disabled={currentCalls.length <= 1}
              >
                הבא
              </Button>
            </div>
            <Button 
              variant="default"
              onClick={closeDialog}
            >
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}