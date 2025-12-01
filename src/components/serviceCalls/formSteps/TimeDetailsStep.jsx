
import React, { useEffect, useRef, useImperativeHandle } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { ProcedureTemplate } from "@/entities/ProcedureTemplate";

const parseDisplayDate = (dateString) => {
    if (!dateString) return null;
    
    // Check for YYYY-MM-DD (standard format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const d = new Date(dateString);
        if (!isNaN(d)) return d;
    }
    
    // Check for DD.MM.YYYY or DD/MM/YYYY (legacy import format)
    const parts = dateString.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/);
    if (parts) {
        // new Date(year, monthIndex, day)
        const d = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
        if (!isNaN(d)) return d;
    }

    // Fallback for other JS-supported formats
    const d = new Date(dateString);
    if (!isNaN(d)) return d;

    return null;
};

export default function TimeDetailsStep({ data, onUpdate }) {
  const startTimeRef = useRef(null);
  const [maintenanceProcedures, setMaintenanceProcedures] = React.useState([]);
  const [loadingProcedures, setLoadingProcedures] = React.useState(false);
  const [loadingMaintenanceSteps, setLoadingMaintenanceSteps] = React.useState(false);
  
  const handleTimeChange = (field, value) => {
    onUpdate({ [field]: value });
  };

  const handleDateChange = (date) => {
    onUpdate({ scheduled_date: date ? format(date, 'yyyy-MM-dd') : null });
  };

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // Changed to 30-minute intervals
        times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return times;
  };

  // Load maintenance procedures when service type changes to maintenance
  React.useEffect(() => {
    if (data.service_type === 'maintenance' && data.device_type) {
      loadMaintenanceProcedures();
    } else {
      setMaintenanceProcedures([]);
      // Clear selected procedure if service type is not maintenance
      if (data.selected_procedure_id) { // Only update if a procedure was previously selected to avoid unnecessary renders
        onUpdate({ 
          selected_procedure_id: '', 
          selected_procedure_name: '',
          procedure_steps: [],
          maintenance_steps_loaded: false // Reset this flag
        });
      }
    }
  }, [data.service_type, data.device_type]); // Removed onUpdate and data.selected_procedure_id from dependencies

  const loadMaintenanceProcedures = async () => {
    setLoadingProcedures(true);
    try {
      const procedures = await ProcedureTemplate.filter({ 
        device_type: data.device_type,
        is_active: true 
      });
      setMaintenanceProcedures(procedures || []);
    } catch (error) {
      console.error("Error loading maintenance procedures:", error);
      setMaintenanceProcedures([]);
    } finally {
      setLoadingProcedures(false);
    }
  };

  const handleServiceTypeChange = (value) => {
    const updateData = { service_type: value };
    if (value !== 'maintenance') {
      updateData.selected_procedure_id = '';
      updateData.selected_procedure_name = '';
      updateData.procedure_steps = [];
      updateData.maintenance_steps_loaded = false;
    }
    onUpdate(updateData);
  };

  const handleProcedureChange = async (procedureId) => {
    const selectedProcedure = maintenanceProcedures.find(p => p.id === procedureId);
    if (selectedProcedure) {
      // Just store the procedure selection, don't load steps yet
      onUpdate({
        selected_procedure_id: procedureId,
        selected_procedure_name: selectedProcedure.name,
        maintenance_steps_loaded: false // Mark that steps haven't been loaded yet
      });
    } else {
        // If no procedure is selected (e.g., if procedureId is empty string or not found)
        onUpdate({
            selected_procedure_id: '',
            selected_procedure_name: '',
            procedure_steps: [], // Clear steps if no procedure is selected
            maintenance_steps_loaded: false
        });
    }
  };

  // Function to load maintenance steps (will be called from parent when moving to next step)
  React.useImperativeHandle(data.loadMaintenanceStepsRef, () => ({
    loadMaintenanceSteps: async () => {
      if (!data.selected_procedure_id) {
        // If no procedure is selected, ensure steps are empty and return.
        return {
          procedure_steps: [],
          maintenance_steps_loaded: false
        };
      }

      setLoadingMaintenanceSteps(true);
      try {
        const selectedProcedure = maintenanceProcedures.find(p => p.id === data.selected_procedure_id);
        if (selectedProcedure) {
          const { MaintenanceStep } = await import("@/entities/MaintenanceStep");
          const procedureSteps = [];
          
          for (const step of selectedProcedure.steps || []) {
            const stepDetails = await MaintenanceStep.get(step.step_id);
            if (stepDetails) {
              // Check if we have existing state for this step
              const existingStep = data.procedure_steps?.find(s => s.step_id === step.step_id);
              
              procedureSteps.push({
                step_id: step.step_id,
                description: stepDetails.description,
                safety_note: stepDetails.safety_note,
                parts_required: (stepDetails.parts_required || []).map(part => ({
                  ...part,
                  // Preserve existing 'should_add' state if available, otherwise default to true
                  should_add: existingStep?.parts_required?.find(ep => ep.part_id === part.part_id)?.should_add ?? true
                })),
                is_optional: step.is_optional || false,
                is_completed: existingStep?.is_completed || false // Preserve completion status
              });
            }
          }

          return {
            procedure_steps: procedureSteps,
            maintenance_steps_loaded: true
          };
        } else {
          // If selected procedure not found (e.g., was deleted or filtered out after selection)
          console.warn(`Selected procedure with ID ${data.selected_procedure_id} not found during step loading.`);
          return {
            procedure_steps: [],
            maintenance_steps_loaded: false
          };
        }
      } catch (error) {
        console.error("Error loading procedure steps:", error);
        throw error; // Re-throw to propagate error to parent handler if needed
      } finally {
        setLoadingMaintenanceSteps(false);
      }
    }
  }));

  const toggleNoWorkHours = () => {
    const newValue = !data.no_work_hours;
    onUpdate({
      no_work_hours: newValue,
      end_time: newValue ? '' : data.end_time
    });
  };

  const toggleNoTravel = () => {
    onUpdate({ no_travel: !data.no_travel });
  };

  const handleStartTimeOpen = () => {
    setTimeout(() => {
      const selectedTimeEl = document.querySelector(`[data-value="${data.start_time}"]`);
      if (selectedTimeEl && startTimeRef.current) {
        const container = startTimeRef.current.closest('.time-options-container');
        if (container) {
          const containerHeight = container.clientHeight;
          const itemHeight = selectedTimeEl.clientHeight;
          const scrollPosition = selectedTimeEl.offsetTop - (containerHeight / 2) + (itemHeight / 2);
          container.scrollTop = scrollPosition;
        }
      }
    }, 0);
  };
  
  const scheduledDate = parseDisplayDate(data.scheduled_date);

  return (
    <div className="space-y-4">
      {loadingMaintenanceSteps && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium">יוצר דף תחזוקה...</p>
            <p className="text-sm text-gray-500 mt-2">אנא המתן</p>
          </div>
        </div>
      )}

      <div>
        <Label>סוג שירות</Label>
        <Select
          value={data.service_type || 'repair'}
          onValueChange={handleServiceTypeChange}
          disabled={loadingMaintenanceSteps}
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

      {data.service_type === 'maintenance' && data.device_type && (
        <div>
          <Label>נוהל תחזוקה</Label>
          <Select
            value={data.selected_procedure_id || ''}
            onValueChange={handleProcedureChange}
            disabled={loadingProcedures || loadingMaintenanceSteps}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingProcedures ? "טוען נהלים..." : "בחר נוהל תחזוקה"} />
            </SelectTrigger>
            <SelectContent>
              {maintenanceProcedures.map((procedure) => (
                <SelectItem key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {maintenanceProcedures.length === 0 && !loadingProcedures && (
            <p className="text-sm text-gray-500 mt-1">
              אין נהלי תחזוקה זמינים עבור סוג מכשיר זה
            </p>
          )}
          {data.selected_procedure_id && data.selected_procedure_name && (
            <p className="text-sm text-green-600 mt-1">
              נוהל נבחר: {data.selected_procedure_name}
            </p>
          )}
        </div>
      )}

      <div>
        <Label>תאריך מתוכנן</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-right"
              disabled={loadingMaintenanceSteps}
            >
              <CalendarIcon className="ml-2 h-4 w-4" />
              {scheduledDate ? format(scheduledDate, 'dd/MM/yyyy') : 'בחר תאריך'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={scheduledDate || undefined}
              onSelect={handleDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label>שעת התחלה</Label>
        <Select
          value={data.start_time || ''}
          onValueChange={(value) => handleTimeChange('start_time', value)}
          onOpenChange={(open) => {
            if (open) handleStartTimeOpen();
          }}
          disabled={loadingMaintenanceSteps}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר שעת התחלה" />
          </SelectTrigger>
          <SelectContent>
            <div className="time-options-container max-h-[300px] overflow-y-auto py-1">
              {generateTimeOptions().map(time => (
                <SelectItem 
                  key={time} 
                  value={time} 
                  ref={time === data.start_time ? startTimeRef : null}
                  data-value={time}
                >
                  {time}
                </SelectItem>
              ))}
            </div>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="no-travel"
            checked={data.no_travel || false}
            onChange={toggleNoTravel}
            className="ml-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={loadingMaintenanceSteps}
          />
          <Label htmlFor="no-travel">ללא נסיעה</Label>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="no-work-hours"
            checked={data.no_work_hours || false}
            onChange={toggleNoWorkHours}
            className="ml-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={loadingMaintenanceSteps}
          />
          <Label htmlFor="no-work-hours">ללא שעות עבודה</Label>
        </div>
      </div>
    </div>
  );
}
