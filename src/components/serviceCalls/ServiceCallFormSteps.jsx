import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, XCircle, CheckCircle, X } from "lucide-react";
import { ServiceCall } from "@/entities/ServiceCall";
import { User } from "@/entities/User";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import BasicInfoStep from '../serviceCalls/formSteps/BasicInfoStep';
import TimeDetailsStep from '../serviceCalls/formSteps/TimeDetailsStep';
import MaintenanceStep from '../serviceCalls/formSteps/MaintenanceStep';
import PartsStep from '../serviceCalls/formSteps/PartsStep';
import NotesStep from '../serviceCalls/formSteps/NotesStep';
import { SendEmail } from "@/integrations/Core";

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function ServiceCallFormSteps({ initialData, onSubmit, onCancel }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showPartsConfirmation, setShowPartsConfirmation] = useState(false);
  const [showEmptyPartsConfirmation, setShowEmptyPartsConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [isFirstStepValid, setIsFirstStepValid] = useState(false);
  const [temporaryServiceCallId, setTemporaryServiceCallId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMaintenanceSteps, setLoadingMaintenanceSteps] = useState(false);

  const getDefaultStartTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.floor(minutes / 30) * 30; 
    const adjustedHours = hours + Math.floor((minutes + 15) / 60);
    const finalMinutes = roundedMinutes % 60;

    return `${String(adjustedHours % 24).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  };

  const [formData, setFormData] = useState({
    client_name: '',
    device_id: '',
    device: '',
    device_type: '',
    service_type: 'repair',
    selected_procedure_id: initialData?.selected_procedure_id || '', // Initialize from initialData
    selected_procedure_name: initialData?.selected_procedure_name || '', // Initialize from initialData
    procedure_steps: initialData?.procedure_steps || [], // Initialize from initialData
    // Set maintenance_steps_loaded to true if initialData already has maintenance steps
    maintenance_steps_loaded: initialData?.service_type === 'maintenance' && initialData?.selected_procedure_id && initialData?.procedure_steps?.length > 0,
    description: '',
    status: initialData ? initialData.status : 'temporary',
    scheduled_date: initialData?.scheduled_date || new Date().toISOString().split('T')[0],
    start_time: initialData?.start_time || getDefaultStartTime(),
    end_time: initialData?.end_time || '', 
    assigned_to: '',
    assigned_to_nickname: '',
    notes: '',
    no_travel: false,
    no_work_hours: false,
    is_draft: initialData?.status === 'pending' || false,
    parts_used: [],
    ...initialData
  });

  const getSteps = () => {
    const baseSteps = [
      { title: "פרטים בסיסיים", component: BasicInfoStep },
      { title: "זמנים וסוג שירות", component: TimeDetailsStep }
    ];

    // Add maintenance step if service type is maintenance, procedure is selected, AND steps are loaded
    if (formData.service_type === 'maintenance' && formData.selected_procedure_id && formData.maintenance_steps_loaded) {
      baseSteps.push({ title: "ביצוע תחזוקה", component: MaintenanceStep });
    }

    baseSteps.push(
      { title: "חלקים", component: PartsStep },
      { title: "הערות וסיום", component: NotesStep }
    );

    return baseSteps;
  };

  const steps = getSteps();

  useEffect(() => {
    const createTemporaryServiceCall = async () => {
      if (!initialData && formData.client_name && !temporaryServiceCallId) {
        try {
          const tempData = {
            ...formData,
            status: 'temporary',
            service_type: formData.service_type || 'repair',
            description: formData.description || 'טופס בעריכה',
            scheduled_date: formData.scheduled_date || new Date().toISOString().split('T')[0],
            start_time: formData.start_time || getDefaultStartTime(),
          };
          delete tempData.id;
          
          const result = await ServiceCall.create(tempData);
          setTemporaryServiceCallId(result.id);
          console.log('Created temporary service call:', result.id, 'with data:', tempData);
        } catch (error) {
          console.error('Error creating temporary service call:', error);
        }
      }
    };
    
    createTemporaryServiceCall();
  }, [initialData, formData.client_name, temporaryServiceCallId, formData.service_type, formData.description, formData.scheduled_date, formData.start_time]);

  useEffect(() => {
    const fetchTechnicianNickname = async () => {
      if (formData.assigned_to && !formData.assigned_to_nickname) {
        try {
          const users = await User.list();
          const assignedUser = users.find(user => user.email === formData.assigned_to);
          if (assignedUser) {
            setFormData(prev => ({
              ...prev,
              assigned_to_nickname: assignedUser.nickname || assignedUser.full_name
            }));
          }
        } catch (error) {
          console.error("Error fetching technician nickname:", error);
        }
      }
    };

    fetchTechnicianNickname();
  }, [formData.assigned_to]);

  const autoSave = React.useCallback(
    debounce(async (dataToSave) => {
      try {
        const serviceCallId = temporaryServiceCallId || initialData?.id;
        if (serviceCallId) {
          const payload = {
            ...dataToSave,
            status: initialData ? dataToSave.status : 'temporary'
          };
          
          await ServiceCall.update(serviceCallId, payload);
          console.log('Auto-saved service call:', serviceCallId, 'Data:', payload);
        }
      } catch (error) {
        if (error?.response?.status === 429) {
          console.log('Rate limit reached, will retry auto-save later');
        } else {
          console.error('Error auto-saving service call:', error);
        }
      }
    }, 1000),
    [temporaryServiceCallId, initialData]
  );

  const handleStepUpdate = async (stepData) => {
    console.log("Updating form with data from step component:", stepData);
    const updatedData = { ...formData, ...stepData };
    setFormData(updatedData);
    setError("");

    autoSave(updatedData);
  };

  const validateTimes = () => {
    if (!formData.start_time) {
      setError("יש להזין שעת התחלה");
      return false;
    }
    
    setError("");
    return true;
  };

  const validateFinalSubmission = () => {
    if (!formData.description || formData.description.trim().length === 0) {
      setError("יש להזין תיאור לקריאת השירות");
      return false;
    }

    if (!formData.start_time) {
      setError("יש להזין שעת התחלה");
      return false;
    }

    if (!formData.no_work_hours && !formData.end_time) {
      setError("יש להזין שעת סיום");
      return false;
    }

    // Additional validation for maintenance step if it's included
    if (formData.service_type === 'maintenance' && formData.selected_procedure_id) {
      const requiredSteps = (formData.procedure_steps || []).filter(step => !step.is_optional);
      const completedRequiredSteps = requiredSteps.filter(step => step.is_completed);
      if (completedRequiredSteps.length < requiredSteps.length) {
        setError(`יש להשלים את כל השלבים החובה (${completedRequiredSteps.length}/${requiredSteps.length}) בביצוע התחזוקה`);
        return false;
      }
    }

    setError("");
    return true;
  };

  const handleStepChange = async (direction) => {
    const currentSteps = getSteps(); // Get the current steps for validations

    if (direction === 'next') {
      // 1. Basic validation for step 0 (BasicInfoStep)
      if (currentStep === 0 && !isFirstStepValid) {
        setError("יש לבחור לקוח ומערכת");
        return;
      }
      
      // 2. Validate TimeDetailsStep (currentStep 1)
      if (currentSteps[currentStep]?.component === TimeDetailsStep) {
        if (!validateTimes()) {
          return;
        }
        
        // Special handling for loading maintenance steps if conditions met
        if (formData.service_type === 'maintenance' && 
            formData.selected_procedure_id && 
            !formData.maintenance_steps_loaded) {
          
          setLoadingMaintenanceSteps(true);
          try {
            const { MaintenanceStep } = await import("@/entities/MaintenanceStep");
            const { ProcedureTemplate } = await import("@/entities/ProcedureTemplate");
            
            const selectedProcedure = await ProcedureTemplate.get(formData.selected_procedure_id);
            if (selectedProcedure) {
              const procedureSteps = [];
              for (const step of selectedProcedure.steps || []) {
                const stepDetails = await MaintenanceStep.get(step.step_id);
                if (stepDetails) {
                  // Check if we have existing state for this step to preserve 'should_add' and 'is_completed'
                  const existingStep = formData.procedure_steps?.find(s => s.step_id === step.step_id);
                  
                  procedureSteps.push({
                    step_id: step.step_id,
                    name: stepDetails.name, // Added 'name' for rendering and email body
                    description: stepDetails.description,
                    safety_note: stepDetails.safety_note,
                    parts_required: (stepDetails.parts_required || []).map(part => ({
                      ...part,
                      should_add: existingStep?.parts_required?.find(p => p.part_sku === part.part_sku)?.should_add ?? true
                    })),
                    is_optional: step.is_optional || false,
                    is_completed: existingStep?.is_completed || false // Preserve existing completion status
                  });
                }
              }

              const updatedData = {
                ...formData,
                procedure_steps: procedureSteps,
                maintenance_steps_loaded: true
              };
              setFormData(updatedData);
              autoSave(updatedData);
              // After loading, proceed to the next step
              setCurrentStep(currentStep + 1);
              setError("");
              return; // Exit this function call as we've handled the transition
            } else {
                setError("הנוהל הנבחר לא נמצא.");
                return;
            }
          } catch (error) {
            console.error("Error loading maintenance steps:", error);
            setError("שגיאה בטעינת שלבי התחזוקה");
            return; // Stay on current step due to error
          } finally {
            setLoadingMaintenanceSteps(false);
          }
        }
      }

      // 3. Validate MaintenanceStep
      if (currentSteps[currentStep]?.component === MaintenanceStep) {
        const requiredSteps = (formData.procedure_steps || []).filter(step => !step.is_optional);
        const completedRequiredSteps = requiredSteps.filter(step => step.is_completed);
        
        if (completedRequiredSteps.length < requiredSteps.length) {
          setError(`יש להשלים את כל השלבים החובה (${completedRequiredSteps.length}/${requiredSteps.length})`);
          return;
        }
      }

      // 4. Validate PartsStep
      if (currentSteps[currentStep]?.component === PartsStep && formData.parts_used.length === 0) {
        setShowEmptyPartsConfirmation(true);
        return;
      }

      // If all validations pass and no special loading occurred (or it completed successfully), proceed to next step
      if (currentStep < currentSteps.length - 1) {
        setCurrentStep(currentStep + 1);
        setError("");
      }

    } else if (direction === 'prev' && currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  const handleFirstStepValidityChange = (isValid) => {
    setIsFirstStepValid(isValid);
  };

  const handleSubmit = async () => {
    if (!validateFinalSubmission()) {
      return;
    }

    if (formData.parts_used.length === 0) {
      setShowPartsConfirmation(true);
    } else {
      setIsSubmitting(true);
      await submitForm();
    }
  };

  const submitForm = async () => {
    try {
      setIsSubmitting(true);
      const allCalls = await ServiceCall.list();
      const maxCallNumber = Math.max(...allCalls.map(call => parseInt(call.call_number) || 0), 0);
      
      console.log("Submitting form data:", formData);
      
      const finalFormData = {
        ...formData,
        status: formData.is_draft ? 'pending' : 'assigned',
        call_number: initialData?.call_number || (maxCallNumber + 1).toString() // Convert to string
      };

      // If we have a temporary ID for a new call, add it to the data
      // so the parent component can UPDATE it instead of creating a new record.
      if (temporaryServiceCallId && !initialData) {
        finalFormData.id = temporaryServiceCallId;
      }
      
      // The logic to delete the temporary call has been removed to prevent 404 errors.

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

      let partsUsedText = '';
      if (finalFormData.parts_used && finalFormData.parts_used.length > 0) {
        partsUsedText = '\nחלקים שנעשה בהם שימוש:\n';
        
        finalFormData.parts_used.forEach((part, index) => {
          partsUsedText += `${index + 1}. ${part.name} (מק"ט: ${part.part_number}) - כמות: ${part.quantity}`;
          
          if (part.has_serial) {
            if (part.old_serial) {
              partsUsedText += `\n   מספר סידורי ישן: ${part.old_serial}`;
            }
            if (part.new_serial) {
              partsUsedText += `\n   מספר סידורי חדש: ${part.new_serial}`;
            }
          }
          
          partsUsedText += '\n';
        });
      }

      let procedureDetailsText = '';
      if (finalFormData.service_type === 'maintenance' && finalFormData.selected_procedure_name && finalFormData.procedure_steps && finalFormData.procedure_steps.length > 0) {
        procedureDetailsText = `\nנהל תחזוקה: ${finalFormData.selected_procedure_name}\n`;
        finalFormData.procedure_steps.forEach((step, index) => {
          procedureDetailsText += `${index + 1}. ${step.name} - ${step.is_completed ? 'בוצע' : 'לא בוצע'} ${step.is_optional ? '(אופציונלי)' : '(חובה)'}\n`;
        });
      }


      const emailBody = `
        קריאת שירות חדשה נוצרה במערכת:
        
        מספר קריאה: ${finalFormData.call_number}
        לקוח: ${finalFormData.client_name}
        סוג קריאה: ${serviceTypeLabels[finalFormData.service_type] || finalFormData.service_type}
        ${finalFormData.device ? `מערכת: ${finalFormData.device}` : ''}
        ${finalFormData.device_type ? `סוג מערכת: ${deviceTypeLabels[finalFormData.device_type] || finalFormData.device_type}` : ''}
        תיאור: ${finalFormData.description || ''}
        
        תאריך מתוכנן: ${finalFormData.scheduled_date ? new Date(finalFormData.scheduled_date).toLocaleDateString('he-IL') : 'לא נקבע'}
        שעת התחלה: ${finalFormData.start_time || 'לא צוין'}
        שעת סיום: ${finalFormData.end_time || 'לא צוין'}
        ${finalFormData.assigned_to_nickname ? `טכנאי מטפל: ${finalFormData.assigned_to_nickname}` : ''}
        ${finalFormData.no_travel ? 'ללא נסיעה: כן' : ''}
        ${finalFormData.no_work_hours ? 'ללא שעות עבודה: כן' : ''}
        
        ${procedureDetailsText}
        ${finalFormData.notes ? `הערות: ${finalFormData.notes}` : ''}
        ${partsUsedText}
        
        לצפייה בקריאת השירות: [קישור למערכת]
      `;
      
      // Fetch admins and send email to them instead of a hardcoded address
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
            subject: `קריאת שירות חדשה ${finalFormData.call_number} - ${finalFormData.client_name}`,
            body: emailBody
          });
        } catch (error) {
          console.error(`Error sending email to ${admin.email}:`, error);
        }
      }
      
      onSubmit(finalFormData);
    } catch (error) {
      console.error("Error submitting form:", error);
      setError("אירעה שגיאה בשמירת קריאת השירות");
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (temporaryServiceCallId && !initialData) {
      try {
        const allCalls = await ServiceCall.list();
        const tempCallExists = allCalls.some(call => call.id === temporaryServiceCallId);
        
        if (tempCallExists) {
          await ServiceCall.delete(temporaryServiceCallId);
          console.log('Deleted temporary service call');
        } else {
          console.log('Temporary service call no longer exists, skipping deletion');
        }
      } catch (error) {
        console.error('Error deleting temporary service call:', error);
      }
    }
    onCancel();
  };

  // Re-evaluate steps based on current formData for correct rendering of current step component
  const CurrentStepComponent = steps[currentStep].component;

  return (
    <>
      {loadingMaintenanceSteps && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg font-medium">יוצר דף תחזוקה...</p>
            <p className="text-sm text-gray-500 mt-2">אנא המתן</p>
          </div>
        </div>
      )}

      <div className="flex flex-col h-full max-h-full rounded-lg shadow-lg bg-white overflow-hidden">
        {/* Header */}
        <div className="bg-white flex-shrink-0 p-4 sm:p-6 border-b rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold">
              {initialData ? 'עריכת קריאת שירות' : 'קריאת שירות חדשה'}
            </h2>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-xs sm:text-sm text-gray-500">
                שלב {currentStep + 1} מתוך {steps.length}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700"
                disabled={loadingMaintenanceSteps}
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex justify-between mt-3 sm:mt-4">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex-1 h-1.5 sm:h-2 mx-0.5 sm:mx-1 rounded ${
                  index <= currentStep ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          
          {/* Step Title */}
          <div className="flex justify-between items-center mt-3 sm:mt-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-900">
              {steps[currentStep].title}
            </h3>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex-shrink-0 p-4 sm:p-6 border-b bg-red-50">
            <Alert variant="destructive">
              <AlertTitle>שגיאה</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Content Area - Auto-scaling with available space */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50 min-h-0">
          <div className="max-w-4xl mx-auto h-full">
            <CurrentStepComponent
              data={formData}
              onUpdate={handleStepUpdate}
              onValidityChange={currentStep === 0 ? handleFirstStepValidityChange : undefined}
            />
          </div>
        </div>

        {/* Fixed Footer with Navigation Buttons */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-t bg-white rounded-b-lg">
          <div className="flex flex-col sm:flex-row justify-between items-center max-w-4xl mx-auto gap-3 sm:gap-0">
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="w-full sm:w-auto min-w-[100px]"
                disabled={loadingMaintenanceSteps}
              >
                <XCircle className="w-4 h-4 ml-2" />
                ביטול
              </Button>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStepChange('prev')}
                  className="flex-1 sm:flex-none min-w-[100px]"
                  disabled={loadingMaintenanceSteps}
                >
                  <ChevronRight className="w-4 h-4 ml-2" />
                  הקודם
                </Button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => handleStepChange('next')}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 min-w-[100px]"
                  disabled={(currentStep === 0 && !isFirstStepValid) || loadingMaintenanceSteps}
                >
                  הבא
                  <ChevronLeft className="w-4 h-4 mr-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 min-w-[120px]"
                  disabled={!formData.description || formData.description.trim().length === 0 || isSubmitting || loadingMaintenanceSteps}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  {isSubmitting ? 'מעבד...' : initialData ? 'עדכן' : 'צור'} קריאת שירות
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showPartsConfirmation} onOpenChange={setShowPartsConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור - לא נבחרו חלקים</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>לא נבחרו חלקים לקריאת השירות. האם אתה בטוח שברצונך להמשיך?</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPartsConfirmation(false)}
              disabled={isSubmitting}
            >
              חזור לעריכה
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setShowPartsConfirmation(false);
                submitForm();
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'מעבד...' : 'אשר והמשך'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmptyPartsConfirmation} onOpenChange={setShowEmptyPartsConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>אישור - לא נבחרו חלקים</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>לא נבחרו חלקים לקריאת השירות. האם אתה בטוח שברצונך להמשיך לשלב הבא?</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmptyPartsConfirmation(false)}
            >
              חזור לבחירת חלקים
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setShowEmptyPartsConfirmation(false);
                setCurrentStep(currentStep + 1);
              }}
            >
              המשך ללא חלקים
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}