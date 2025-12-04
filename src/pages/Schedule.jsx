import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isWithinInterval, isBefore } from "date-fns";
import { he } from "date-fns/locale";
import { Maintenance } from "@/entities/Maintenance";
import { ServiceUnit } from "@/entities/ServiceUnit";
import { Customer } from "@/entities/Customer";
import { MaintenanceType } from "@/entities/MaintenanceType";
import { User } from "@/entities/User";
import { getParts } from "@/functions/getParts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Clock,
  Wrench,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const statusConfig = {
  scheduled: { label: "מתוזמן", color: "bg-blue-100 text-blue-700", icon: Clock },
  in_progress: { label: "בביצוע", color: "bg-amber-100 text-amber-700", icon: Wrench },
  completed: { label: "הושלם", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelled: { label: "בוטל", color: "bg-slate-100 text-slate-700", icon: XCircle },
};

export default function SchedulePage() {
  const [maintenances, setMaintenances] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterMaintenanceType, setFilterMaintenanceType] = useState("all");

  const [formData, setFormData] = useState({
    unit_id: "",
    customer_id: "",
    maintenance_type_id: "",
    visit_step: 1,
    scheduled_date: format(new Date(), "yyyy-MM-dd"),
    completed_date: "",
    status: "scheduled",
    parts_used: [],
    notes: "",
    technician: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [maintenancesData, unitsData, customersData, typesData, usersData, partsResponse] = await Promise.all([
        Maintenance.list("-scheduled_date"),
        ServiceUnit.list(),
        Customer.list(),
        MaintenanceType.list(),
        User.list(),
        getParts(),
      ]);
      setMaintenances(maintenancesData);
      setUnits(unitsData);
      setCustomers(customersData);
      setMaintenanceTypes(typesData);
      setUsers(usersData);
      setParts(partsResponse?.data?.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaintenances = useMemo(() => {
    const monthInterval = {
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    };

    return maintenances.filter((m) => {
      if (!m.scheduled_date) return false;
      const inMonth = isWithinInterval(parseISO(m.scheduled_date), monthInterval);
      const matchesStatus = filterStatus === "all" || m.status === filterStatus;
      const matchesCustomer = filterCustomer === "all" || m.customer_id === filterCustomer;
      const matchesType = filterMaintenanceType === "all" || m.maintenance_type_id === filterMaintenanceType;
      return inMonth && matchesStatus && matchesCustomer && matchesType;
    });
  }, [maintenances, currentMonth, filterStatus, filterCustomer, filterMaintenanceType]);

  const groupedMaintenances = useMemo(() => ({
    scheduled: filteredMaintenances.filter((m) => m.status === "scheduled"),
    in_progress: filteredMaintenances.filter((m) => m.status === "in_progress"),
    completed: filteredMaintenances.filter((m) => m.status === "completed"),
    cancelled: filteredMaintenances.filter((m) => m.status === "cancelled"),
  }), [filteredMaintenances]);

  const handleUnitChange = (unitId) => {
    const unit = units.find((u) => u.id === unitId);
    const currentStep = unit?.current_visit_step || 1;
    const stepData = unit?.visit_sequence?.find((s) => s.step_number === currentStep);
    const mt = maintenanceTypes.find((m) => m.id === stepData?.maintenance_type_id);

    const partsToUse = stepData?.use_custom_parts
      ? stepData.custom_parts || []
      : mt?.default_parts || [];

    setFormData({
      ...formData,
      unit_id: unitId,
      customer_id: unit?.customer_id || "",
      maintenance_type_id: stepData?.maintenance_type_id || "",
      visit_step: currentStep,
      parts_used: partsToUse,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const submitData = { ...formData };

    if (submitData.status === "completed" && !submitData.completed_date) {
      submitData.completed_date = format(new Date(), "yyyy-MM-dd");
    }

    try {
      if (editingMaintenance) {
        await Maintenance.update(editingMaintenance.id, submitData);

        if (submitData.status === "completed") {
          await handleCompleteMaintenance(submitData);
        }
        toast({ title: "הביקור עודכן בהצלחה" });
      } else {
        await Maintenance.create(submitData);
        toast({ title: "הביקור נוצר בהצלחה" });
      }

      setShowForm(false);
      setEditingMaintenance(null);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error saving maintenance:", error);
      toast({ variant: "destructive", title: "שגיאה בשמירה" });
    }
  };

  const handleCompleteMaintenance = async (submitData) => {
    const unit = units.find((u) => u.id === submitData.unit_id);
    if (!unit) return;

    const completedDate = submitData.completed_date || format(new Date(), "yyyy-MM-dd");
    const sequence = unit.visit_sequence || [];
    const currentStep = unit.current_visit_step || 1;
    const totalSteps = sequence.length;

    const nextStep = totalSteps > 0 ? (currentStep >= totalSteps ? 1 : currentStep + 1) : 1;

    await ServiceUnit.update(unit.id, {
      last_visit_date: completedDate,
      current_visit_step: nextStep,
    });

    const existingNext = maintenances.find(
      (m) => m.unit_id === unit.id && m.status === "scheduled" && m.id !== editingMaintenance?.id
    );

    if (!existingNext && totalSteps > 0) {
      const nextStepData = sequence.find((s) => s.step_number === nextStep);
      const nextMt = maintenanceTypes.find((m) => m.id === nextStepData?.maintenance_type_id);
      const nextVisitDate = addMonths(parseISO(completedDate), unit.visit_interval_months || 3);

      const nextParts = nextStepData?.use_custom_parts
        ? nextStepData.custom_parts || []
        : nextMt?.default_parts || [];

      await Maintenance.create({
        unit_id: unit.id,
        customer_id: unit.customer_id,
        maintenance_type_id: nextStepData?.maintenance_type_id,
        visit_step: nextStep,
        scheduled_date: format(nextVisitDate, "yyyy-MM-dd"),
        status: "scheduled",
        parts_used: nextParts,
        auto_generated: true,
      });
    }
  };

  const handleGenerateVisits = async () => {
    setGenerating(true);
    try {
      const today = new Date();
      const oneYearAhead = addMonths(today, 12);
      let created = 0;

      for (const unit of units) {
        if (unit.active === false) continue;

        const sequence = unit.visit_sequence || [];
        if (sequence.length === 0) continue;

        const intervalMonths = unit.visit_interval_months || 3;

        let lastScheduledDate;
        if (unit.last_visit_date) {
          lastScheduledDate = parseISO(unit.last_visit_date);
        } else if (unit.installation_date) {
          lastScheduledDate = parseISO(unit.installation_date);
        } else {
          lastScheduledDate = today;
        }

        let currentStep = unit.current_visit_step || 1;
        let nextDate = addMonths(lastScheduledDate, intervalMonths);

        while (nextDate <= oneYearAhead) {
          const existingVisit = maintenances.find(
            (m) => m.unit_id === unit.id && 
                   m.scheduled_date === format(nextDate, "yyyy-MM-dd") &&
                   m.status === "scheduled"
          );

          if (!existingVisit) {
            const stepData = sequence.find((s) => s.step_number === currentStep);
            const mt = maintenanceTypes.find((m) => m.id === stepData?.maintenance_type_id);

            const partsToUse = stepData?.use_custom_parts
              ? stepData.custom_parts || []
              : mt?.default_parts || [];

            await Maintenance.create({
              unit_id: unit.id,
              customer_id: unit.customer_id,
              maintenance_type_id: stepData?.maintenance_type_id,
              visit_step: currentStep,
              scheduled_date: format(nextDate, "yyyy-MM-dd"),
              status: "scheduled",
              parts_used: partsToUse,
              auto_generated: true,
            });
            created++;
          }

          currentStep = sequence.length > 0 ? (currentStep >= sequence.length ? 1 : currentStep + 1) : 1;
          nextDate = addMonths(nextDate, intervalMonths);
        }
      }

      toast({ title: `נוצרו ${created} ביקורים חדשים` });
      await loadData();
    } catch (error) {
      console.error("Error generating visits:", error);
      toast({ variant: "destructive", title: "שגיאה ביצירת ביקורים" });
    } finally {
      setGenerating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      unit_id: "",
      customer_id: "",
      maintenance_type_id: "",
      visit_step: 1,
      scheduled_date: format(new Date(), "yyyy-MM-dd"),
      completed_date: "",
      status: "scheduled",
      parts_used: [],
      notes: "",
      technician: "",
    });
  };

  const openEditForm = (maintenance) => {
    setEditingMaintenance(maintenance);
    setFormData({
      unit_id: maintenance.unit_id || "",
      customer_id: maintenance.customer_id || "",
      maintenance_type_id: maintenance.maintenance_type_id || "",
      visit_step: maintenance.visit_step || 1,
      scheduled_date: maintenance.scheduled_date || "",
      completed_date: maintenance.completed_date || "",
      status: maintenance.status || "scheduled",
      parts_used: maintenance.parts_used || [],
      notes: maintenance.notes || "",
      technician: maintenance.technician || "",
    });
    setShowForm(true);
  };

  const getCustomerName = (customerId) => {
    return customers.find((c) => c.id === customerId)?.name || "לא ידוע";
  };

  const getUnitName = (unitId) => {
    return units.find((u) => u.id === unitId)?.name || "לא ידוע";
  };

  const getMaintenanceTypeName = (typeId) => {
    return maintenanceTypes.find((t) => t.id === typeId)?.name || "";
  };

  const getStepInfo = (unitId, visitStep) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit?.visit_sequence?.length || !visitStep) return null;
    return `שלב ${visitStep}/${unit.visit_sequence.length}`;
  };

  const isPastDue = (m) => isBefore(parseISO(m.scheduled_date), new Date()) && m.status === "scheduled";

  const customerUnits = useMemo(() => {
    if (!formData.customer_id) return units;
    return units.filter((u) => u.customer_id === formData.customer_id);
  }, [formData.customer_id, units]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">לוח זמנים</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerateVisits} disabled={generating}>
            <RefreshCw className={`h-4 w-4 ml-2 ${generating ? "animate-spin" : ""}`} />
            יצירת ביקורים אוטומטית
          </Button>
          <Button onClick={() => { resetForm(); setEditingMaintenance(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 ml-2" />
            ביקור חדש
          </Button>
        </div>
      </div>

      {/* Month Navigation & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold min-w-[150px] text-center">
                {format(currentMonth, "MMMM yyyy", { locale: he })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="לקוח" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הלקוחות</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterMaintenanceType} onValueChange={setFilterMaintenanceType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="סוג תחזוקה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  {maintenanceTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Cards by Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const StatusIcon = config.icon;
          const items = groupedMaintenances[status] || [];

          return (
            <Card key={status} className="h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  {config.label}
                  <Badge variant="secondary" className="mr-auto">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">אין ביקורים</p>
                ) : (
                  items.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => openEditForm(m)}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        isPastDue(m) ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{getCustomerName(m.customer_id)}</span>
                        {isPastDue(m) && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      </div>
                      <p className="text-xs text-slate-600">{getUnitName(m.unit_id)}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-500">
                          {format(parseISO(m.scheduled_date), "dd/MM/yyyy")}
                        </span>
                        {getStepInfo(m.unit_id, m.visit_step) && (
                          <Badge variant="outline" className="text-xs">
                            {getStepInfo(m.unit_id, m.visit_step)}
                          </Badge>
                        )}
                      </div>
                      {getMaintenanceTypeName(m.maintenance_type_id) && (
                        <Badge className="mt-2 text-xs" variant="secondary">
                          {getMaintenanceTypeName(m.maintenance_type_id)}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Maintenance Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingMaintenance(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingMaintenance ? "עריכת ביקור" : "ביקור חדש"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>לקוח</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => setFormData({ ...formData, customer_id: value, unit_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר לקוח" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>יחידה</Label>
                <Select value={formData.unit_id} onValueChange={handleUnitChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר יחידה" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>סוג תחזוקה</Label>
                <Select
                  value={formData.maintenance_type_id}
                  onValueChange={(value) => setFormData({ ...formData, maintenance_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוג" />
                  </SelectTrigger>
                  <SelectContent>
                    {maintenanceTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>טכנאי</Label>
                <Select
                  value={formData.technician}
                  onValueChange={(value) => setFormData({ ...formData, technician: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר טכנאי" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.email}>{u.nickname || u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>תאריך מתוזמן</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>סטטוס</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.status === "completed" && (
                <div className="space-y-2">
                  <Label>תאריך השלמה</Label>
                  <Input
                    type="date"
                    value={formData.completed_date}
                    onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingMaintenance(null); }}>
                ביטול
              </Button>
              <Button type="submit">
                {editingMaintenance ? "עדכן" : "צור"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}