import React, { useState, useEffect } from 'react';
import { SystemLog, User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, X, Eye } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ACTION_TYPES = [
  'CREATE', 'UPDATE', 'DELETE', 'STOCK_TRANSFER', 
  'RECEIVE_STOCK', 'STATUS_CHANGE', 'LOCATION_CHANGE'
];

const ENTITY_TYPES = [
  'Part', 'Order', 'Transfer', 'DeliveryNote', 'ExpenseReturn', 
  'User', 'Warehouse', 'Supplier', 'Category', 'Currency', 'Unit'
];

function EntityDetailsModal({ log, onClose }) {
  if (!log) return null;

  const formatDetails = (details) => {
    if (!details || typeof details !== 'object') return null;
    
    return Object.entries(details).map(([key, value]) => {
      let displayKey = key;
      let displayValue = value;

      // Translate common keys to Hebrew
      const keyTranslations = {
        from: 'מ',
        to: 'אל',
        quantity: 'כמות',
        from_warehouse: 'ממחסן',
        to_warehouse: 'למחסן',
        transfer_number: 'מספר העברה',
        old_location: 'מיקום קודם',
        new_location: 'מיקום חדש',
        warehouse: 'מחסן',
        part_sku: 'מק"ט',
        part_name: 'שם פריט'
      };

      displayKey = keyTranslations[key] || key;

      // Format values
      if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value, null, 2);
      } else {
        displayValue = String(value);
      }

      return { key: displayKey, value: displayValue };
    });
  };

  const details = formatDetails(log.details);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרטי פעולה - {log.action_type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="font-medium">תאריך:</span>
              <div>{format(new Date(log.created_date), 'dd/MM/yyyy HH:mm')}</div>
            </div>
            <div>
              <span className="font-medium">משתמש:</span>
              <div>{log.user_nickname || log.user_email}</div>
            </div>
            <div>
              <span className="font-medium">סוג יישות:</span>
              <div>{log.entity_type}</div>
            </div>
            <div>
              <span className="font-medium">מזהה יישות:</span>
              <div>{log.entity_identifier}</div>
            </div>
          </div>
          
          <div>
            <span className="font-medium">תיאור:</span>
            <div className="mt-1 p-3 bg-gray-50 rounded">{log.description}</div>
          </div>

          {details && details.length > 0 && (
            <div>
              <span className="font-medium">פרטים נוספים:</span>
              <div className="mt-2 space-y-2">
                {details.map((detail, index) => (
                  <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span className="font-medium">{detail.key}:</span>
                    <span className="text-left" dir="ltr">{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HistoryPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  
  const [filters, setFilters] = useState({
    userEmail: 'all',
    actionType: 'all',
    entityType: 'all',
    skuSearch: '',
    dateRange: { from: null, to: null }
  });

  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 15;

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const usersData = await User.list();
        setUsers(usersData);
        await loadLogs(filters);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadLogs = async (currentFilters) => {
    setLoading(true);
    try {
      const query = {};
      if (currentFilters.userEmail !== 'all') {
        query.user_email = currentFilters.userEmail;
      }
      if (currentFilters.actionType !== 'all') {
        query.action_type = currentFilters.actionType;
      }
      if (currentFilters.entityType !== 'all') {
        query.entity_type = currentFilters.entityType;
      }
      if (currentFilters.dateRange.from) {
        const fromDate = new Date(currentFilters.dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        query.created_date = { ...query.created_date, $gte: fromDate.toISOString() };
      }
      if (currentFilters.dateRange.to) {
        const toDate = new Date(currentFilters.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        query.created_date = { ...query.created_date, $lte: toDate.toISOString() };
      }
      
      let logData = await SystemLog.filter(query, '-created_date');
      
      // Apply SKU search filter on the client side
      if (currentFilters.skuSearch.trim()) {
        const skuSearchTerm = currentFilters.skuSearch.trim().toLowerCase();
        logData = logData.filter(log => 
          (log.entity_identifier && log.entity_identifier.toLowerCase().includes(skuSearchTerm)) ||
          (log.description && log.description.toLowerCase().includes(skuSearchTerm)) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(skuSearchTerm))
        );
      }
      
      setLogs(logData);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading system logs:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    loadLogs(newFilters);
  };
  
  const handleDateRangeChange = (range) => {
    const newFilters = { ...filters, dateRange: range };
    setFilters(newFilters);
    loadLogs(newFilters);
  }

  const handleSkuSearchChange = (value) => {
    const newFilters = { ...filters, skuSearch: value };
    setFilters(newFilters);
    // Add debounce for SKU search
    clearTimeout(window.skuSearchTimeout);
    window.skuSearchTimeout = setTimeout(() => {
      loadLogs(newFilters);
    }, 500);
  };

  const resetFilters = () => {
    const defaultFilters = {
      userEmail: 'all',
      actionType: 'all',
      entityType: 'all',
      skuSearch: '',
      dateRange: { from: null, to: null }
    };
    setFilters(defaultFilters);
    loadLogs(defaultFilters);
  };

  const getActionTypeBadge = (actionType) => {
    switch(actionType) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'STOCK_TRANSFER': return 'bg-purple-100 text-purple-800';
      case 'RECEIVE_STOCK': return 'bg-yellow-100 text-yellow-800';
      case 'STATUS_CHANGE': return 'bg-indigo-100 text-indigo-800';
      case 'LOCATION_CHANGE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(logs.length / logsPerPage);
  const paginatedLogs = logs.slice((currentPage - 1) * logsPerPage, currentPage * logsPerPage);

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">היסטוריית פעולות</h1>
        
        <Card>
            <CardHeader>
                <CardTitle>סינון יומן</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="space-y-2">
                    <Label>משתמש</Label>
                    <Select value={filters.userEmail} onValueChange={value => handleFilterChange('userEmail', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">כל המשתמשים</SelectItem>
                            {users.map(user => (
                                <SelectItem key={user.email} value={user.email}>{user.nickname || user.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>סוג פעולה</Label>
                    <Select value={filters.actionType} onValueChange={value => handleFilterChange('actionType', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">כל סוגי הפעולות</SelectItem>
                            {ACTION_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>סוג יישות</Label>
                    <Select value={filters.entityType} onValueChange={value => handleFilterChange('entityType', value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">כל סוגי היישויות</SelectItem>
                            {ENTITY_TYPES.map(type => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>חיפוש מק"ט</Label>
                    <Input
                        placeholder="חפש מק״ט..."
                        value={filters.skuSearch}
                        onChange={(e) => handleSkuSearchChange(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>טווח תאריכים</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-right font-normal",
                                !filters.dateRange.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {filters.dateRange.from ? (
                                filters.dateRange.to ? (
                                    <>
                                    {format(filters.dateRange.from, "dd/MM/yy")} -{" "}
                                    {format(filters.dateRange.to, "dd/MM/yy")}
                                    </>
                                ) : (
                                    format(filters.dateRange.from, "dd/MM/yy")
                                )
                                ) : (
                                <span>בחר טווח</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={filters.dateRange?.from}
                            selected={filters.dateRange}
                            onSelect={handleDateRangeChange}
                            numberOfMonths={2}
                            locale={he}
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex items-end">
                    <Button onClick={resetFilters} variant="ghost" className="w-full">
                        <X className="h-4 w-4 ml-2" />
                        נקה סינונים
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>יומן מערכת</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-500" />
                <p className="mt-2 text-gray-600">טוען יומן...</p>
              </div>
            ) : paginatedLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך</TableHead>
                      <TableHead>משתמש</TableHead>
                      <TableHead>סוג פעולה</TableHead>
                      <TableHead>תיאור</TableHead>
                      <TableHead>פרטי יישות</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_date), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{log.user_nickname || log.user_email}</TableCell>
                        <TableCell>
                          <Badge className={getActionTypeBadge(log.action_type)}>
                            {log.action_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[300px]">{log.description}</TableCell>
                        <TableCell>
                          <div>{log.entity_type}</div>
                          <div className="text-xs text-gray-500">{log.entity_identifier}</div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    לא נמצאו רשומות התואמות לסינון.
                </div>
            )}
          </CardContent>
          {totalPages > 1 && (
            <CardFooter className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                    סה"כ {logs.length} רשומות
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                        עמוד {currentPage} מתוך {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
          )}
        </Card>

        {selectedLog && (
          <EntityDetailsModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </div>
    </div>
  );
}