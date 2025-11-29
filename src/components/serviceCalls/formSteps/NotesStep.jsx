
import React, { useRef } from 'react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Calendar, Clock } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const serviceTypeLabels = {
  repair: "תקלה",
  inspection: "תקלה חוזרת",
  maintenance: "טיפול",
  parts: "חלקים",
  emergency: "חירום",
  installation: "התקנה",
  other: "אחר"
};

export default function NotesStep({ data, onUpdate }) {
  const endTimeRef = useRef(null);

  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return times;
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;

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
      return null;
    }
  };

  const getNearestTimeSlot = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 30) * 30;
    const hours = now.getHours() + Math.floor(roundedMinutes / 60);
    const finalMinutes = roundedMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  };

  const handleEndTimeOpen = () => {
    if (!data.end_time) {
      setTimeout(() => {
        const nearestTime = getNearestTimeSlot();
        const timeEl = document.querySelector(`[data-value="${nearestTime}"]`);
        if (timeEl && endTimeRef.current) {
          const container = endTimeRef.current.closest('.time-options-container');
          if (container) {
            const containerHeight = container.clientHeight;
            const itemHeight = timeEl.clientHeight;
            const scrollPosition = timeEl.offsetTop - (containerHeight / 2) + (itemHeight / 2);
            container.scrollTop = scrollPosition;
          }
        }
      }, 0);
    }
  };

  const handleNotesChange = (e) => {
    onUpdate({ notes: e.target.value });
  };

  const handleDescriptionChange = (e) => {
    onUpdate({ description: e.target.value });
  };

  const handleServiceTypeChange = (value) => {
    const updates = { service_type: value };
    if (value === 'parts') {
      updates.description = 'חלקים';
    }
    onUpdate(updates);
  };

  const toggleDraft = () => {
    onUpdate({ is_draft: !data.is_draft });
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

  const handleInputChange = (field, value) => {
    onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-lg">שעת סיום</Label>
        <Select
          value={data.end_time || ''}
          onValueChange={(value) => onUpdate({ end_time: value })}
          onOpenChange={(open) => {
            if (open) handleEndTimeOpen();
          }}
          disabled={data.no_work_hours}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר שעת סיום" />
          </SelectTrigger>
          <SelectContent>
            <div className="time-options-container max-h-[300px] overflow-y-auto py-1">
              {generateTimeOptions().map(time => (
                <SelectItem 
                  key={time} 
                  value={time}
                  ref={time === getNearestTimeSlot() ? endTimeRef : null}
                  data-value={time}
                >
                  {time}
                </SelectItem>
              ))}
            </div>
          </SelectContent>
        </Select>
        {!data.no_work_hours && (
          <div className="text-sm">
            {!data.end_time ? (
              <p className="text-red-500">* נדרש למלא שעת סיום</p>
            ) : data.start_time ? (
              <p className="text-gray-600">
                משך זמן: {calculateDuration(data.start_time, data.end_time)}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <Label className="text-lg">סוג שירות</Label>
        <Select
          value={data.service_type || 'repair'}
          onValueChange={handleServiceTypeChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר סוג שירות" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(serviceTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-lg">תיאור קריאת השירות</Label>
        <Textarea
          placeholder="נא להזין תיאור מפורט של קריאת השירות"
          className="mt-2 h-24"
          value={data.description || ''}
          onChange={handleDescriptionChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">הערות נוספות</Label>
        <Textarea
          id="notes"
          value={data.notes || ''}
          onChange={(e) => handleInputChange('notes', e.target.value)}
          placeholder="הוסף הערות נוספות כאן..."
          rows={6}
        />
        <p className="text-sm text-gray-500">
          הוסף כל מידע נוסף שיכול להיות רלוונטי לקריאת השירות
        </p>
      </div>
      
      {/* Removing service call summary section */}
      
      <div className="space-y-2">
        <Label htmlFor="is_draft">סטטוס שמירה</Label>
        <div className="flex items-center space-x-3 space-x-reverse">
          <Checkbox 
            id="is_draft"
            checked={data.is_draft || false}
            onCheckedChange={(checked) => handleInputChange('is_draft', checked)}
          />
          <Label htmlFor="is_draft" className="font-normal cursor-pointer">שמור כטיוטה</Label>
        </div>
        <p className="text-sm text-gray-500">
          אם מסומן, קריאת השירות תישמר כטיוטה ולא תוקצה לטכנאי.
        </p>
      </div>
    </div>
  );
}
