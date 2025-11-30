import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, Plus, Eye, Edit, AlertCircle } from "lucide-react";
import { getParts } from "@/functions/getParts";
import { ServiceCall } from "@/entities/ServiceCall";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

function PartSelectionModal({ part, existingPartData, allPartInstances, onAdd, onUpdate, onCancel }) {
  const [items, setItems] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (existingPartData && allPartInstances && allPartInstances.length > 0) {
      // Show all instances of this part
      setItems(allPartInstances.map((instance, index) => ({
        id: index + 1, // Unique ID for internal tracking in the modal
        originalIndex: instance.originalIndex, // Important: This ties it to the original list
        part_id: instance.part_id, // Include part_id for consistency
        part_number: instance.part_number, // Include part_number for consistency
        name: instance.name, // Include name for consistency
        quantity: instance.quantity || 1,
        has_serial: instance.has_serial || part.requires_serial_number || false, // Initialize based on existing data or part requirement
        old_serial: instance.old_serial || '',
        new_serial: instance.new_serial || '',
        allowPartialQuantity: instance.quantity % 1 !== 0 // Initialize based on existing quantity
      })));
    } else if (existingPartData) {
      // Single existing part (might be the only one, or a legacy path)
      setItems([{
        id: 1,
        originalIndex: existingPartData.originalIndex,
        part_id: existingPartData.part_id, // Include part_id for consistency
        part_number: existingPartData.part_number, // Include part_number for consistency
        name: existingPartData.name, // Include name for consistency
        quantity: existingPartData.quantity || 1,
        has_serial: existingPartData.has_serial || part.requires_serial_number || false, // Initialize based on existing data or part requirement
        old_serial: existingPartData.old_serial || '',
        new_serial: existingPartData.new_serial || '',
        allowPartialQuantity: existingPartData.quantity % 1 !== 0 // Initialize based on existing quantity
      }]);
    } else {
      // New part - check if serial is required
      setItems([{
        id: 1,
        quantity: 1,
        has_serial: part.requires_serial_number || false, // Default to true if required
        old_serial: '',
        new_serial: '',
        allowPartialQuantity: false
      }]);
    }
  }, [existingPartData, allPartInstances, part.requires_serial_number]);

  const isEditing = !!existingPartData;
  // canAddAnother allows adding new items if at least one item currently being configured has a serial.
  const canAddAnother = items.some(item => item.has_serial);
  const hasMultipleInstances = allPartInstances && allPartInstances.length > 1;

  const updateItem = (itemId, field, value) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? {
            ...item,
            [field]: field === 'quantity' ?
              (item.allowPartialQuantity ? parseFloat(value) || 1 : parseInt(value) || 1) :
              value,
            // Clear serial numbers if has_serial is unchecked AND it's not a required serial part
            ...(field === 'has_serial' && !value && !part.requires_serial_number ? { old_serial: '', new_serial: '' } : {})
          }
        : item
    ));

    // Clear validation error for this item if it exists
    if (validationErrors[itemId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const togglePartialQuantity = (itemId) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? {
            ...item,
            allowPartialQuantity: !item.allowPartialQuantity,
            // Round quantity to integer if disabling partial
            quantity: !item.allowPartialQuantity ? Math.floor(item.quantity) : item.quantity
          }
        : item
    ));
  };

  const addNewItem = () => {
    const maxId = items.length > 0 ? Math.max(...items.map(item => item.id)) : 0;
    setItems(prev => [...prev, {
      id: maxId + 1,
      quantity: 1,
      has_serial: part.requires_serial_number || true, // New items added this way are assumed to have a serial unless part requires
      old_serial: '',
      new_serial: '',
      allowPartialQuantity: false
    }]);
  };

  const removeItem = (itemId) => {
    // Only allow removing items that are not original instances or if there's more than one item
    if (items.length > 1) {
      setItems(prev => {
        const updatedItems = prev.filter(item => item.id !== itemId);
        return updatedItems;
      });
      // Clear validation errors for removed item
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const validateItems = () => {
    const errors = {};
    let hasErrors = false;

    items.forEach(item => {
      // If has_serial is true (either manually checked or because part.requires_serial_number is true)
      // then new_serial must be filled.
      if (item.has_serial) {
        if (!item.new_serial || item.new_serial.trim() === '') {
          errors[item.id] = 'יש למלא מספר סידורי חדש';
          hasErrors = true;
        }
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleSave = () => {
    // Validate before saving
    if (!validateItems()) {
      return;
    }

    // Map items from modal state to the expected part data structure
    const finalParts = items.map(item => ({
      part_id: part.id || '',
      part_number: part.sku,
      name: part.name,
      quantity: item.quantity,
      has_serial: item.has_serial,
      old_serial: item.has_serial ? item.old_serial : '',
      new_serial: item.has_serial ? item.new_serial : '',
      originalIndex: item.originalIndex // This will be undefined for new items
    }));

    // Pass the complete list of items from the modal for reconciliation by PartsStep
    onUpdate(finalParts);
    // Close modal after saving
    onCancel();
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'עדכן חלק בקריאת השירות' : 'הוסף חלק לקריאת השירות'}
            {hasMultipleInstances && (
              <div className="text-sm font-normal text-gray-600 mt-1">
                נמצאו {allPartInstances.length} מופעים של חלק זה
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="font-mono text-sm font-bold text-blue-600 mb-1">{part.sku}</div>
            <div className="font-medium">{part.name}</div>
            {part.requires_serial_number && (
              <Badge className="mt-2 bg-orange-100 text-orange-800">
                <AlertCircle className="w-3 h-3 ml-1" />
                דורש מספר סידורי חובה
              </Badge>
            )}
            {part.notes && part.notes.trim() && part.notes.toLowerCase() !== 'n/a' && (
              <div className="text-sm text-gray-600 mt-1">{part.notes}</div>
            )}
            {isEditing && (
              <Badge className="mt-2 bg-green-100 text-green-800">
                כבר נוסף לקריאה
              </Badge>
            )}
          </div>

          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                יש למלא את כל המספרים הסידוריים הנדרשים.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 space-y-3 ${validationErrors[item.id] ? 'border-red-500' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">
                    {items.length === 1 ? 'פרטי החלק' : `פריט ${index + 1}`}
                  </h4>
                  {items.length > 1 && !item.originalIndex && ( // Only allow removing newly added items (without originalIndex)
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      הסר
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`quantity-${item.id}`}>כמות</Label>
                    {item.allowPartialQuantity && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                        כמות חלקית מופעלת
                      </Badge>
                    )}
                  </div>
                  <Input
                    id={`quantity-${item.id}`}
                    type="number"
                    min={item.allowPartialQuantity ? "0.1" : "1"}
                    step={item.allowPartialQuantity ? "0.1" : "1"}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                    onMouseDown={(e) => {
                      if (e.button === 0) { // Only on left mouse button
                        const holdTimer = setTimeout(() => {
                          togglePartialQuantity(item.id);
                        }, 700);

                        const clearTimer = () => {
                          clearTimeout(holdTimer);
                          document.removeEventListener('mouseup', clearTimer);
                          document.removeEventListener('mouseleave', clearTimer);
                        };

                        document.addEventListener('mouseup', clearTimer);
                        document.addEventListener('mouseleave', clearTimer);
                      }
                    }}
                    onTouchStart={(e) => {
                      const holdTimer = setTimeout(() => {
                        togglePartialQuantity(item.id);
                      }, 700);

                      const clearTimer = () => {
                        clearTimeout(holdTimer);
                        document.removeEventListener('touchend', clearTimer);
                        document.removeEventListener('touchcancel', clearTimer);
                      };

                      document.addEventListener('touchend', clearTimer);
                      document.addEventListener('touchcancel', clearTimer);
                    }}
                    className="cursor-pointer"
                    title="לחץ והחזק כדי להפעיל/לבטל כמות חלקית (לדוגמה, 0.5)"
                  />
                  <div className="text-xs text-gray-500">
                    לחץ והחזק על שדה הכמות כדי להפעיל/לבטל כמות חלקית
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`serial-${item.id}`}
                      checked={item.has_serial}
                      onCheckedChange={(checked) => updateItem(item.id, 'has_serial', checked)}
                      disabled={part.requires_serial_number} // Disable if serial is mandatory
                    />
                    <Label htmlFor={`serial-${item.id}`} className="flex items-center gap-2">
                      יש מספר סידורי
                      {part.requires_serial_number && (
                        <span className="text-xs text-orange-600">(חובה)</span>
                      )}
                    </Label>
                  </div>

                  {item.has_serial && (
                    <div className="space-y-2 mr-6">
                      <div>
                        <Label htmlFor={`oldSerial-${item.id}`}>מספר סידורי ישן</Label>
                        <Input
                          id={`oldSerial-${item.id}`}
                          value={item.old_serial}
                          onChange={(e) => updateItem(item.id, 'old_serial', e.target.value)}
                          placeholder="הזן מספר סידורי ישן"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`newSerial-${item.id}`} className="flex items-center gap-1">
                          מספר סידורי חדש
                          {part.requires_serial_number && (
                            <span className="text-red-500">*</span>
                          )}
                        </Label>
                        <Input
                          id={`newSerial-${item.id}`}
                          value={item.new_serial}
                          onChange={(e) => updateItem(item.id, 'new_serial', e.target.value)}
                          placeholder="הזן מספר סידורי חדש"
                          className={validationErrors[item.id] ? 'border-red-500' : ''}
                        />
                        {validationErrors[item.id] && (
                          <p className="text-red-500 text-sm mt-1">{validationErrors[item.id]}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {canAddAnother && (
              <Button
                variant="outline"
                onClick={addNewItem}
                className="w-full border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 ml-2" />
                הוסף עוד אחד
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            ביטול
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            {isEditing ? (
              <>
                <Edit className="w-4 h-4 ml-2" />
                עדכן חלק
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 ml-2" />
                הוסף חלק
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PartsStep({ data, onUpdate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allParts, setAllParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedPartData, setSelectedPartData] = useState(null);
  const [allPartInstances, setAllPartInstances] = useState(null); // New state for multiple instances
  const [partUsageData, setPartUsageData] = useState(new Map());
  const [partQuantityModes, setPartQuantityModes] = useState(new Map()); // Track partial quantity mode for each part

  useEffect(() => {
    loadAllParts();
    loadPartUsageData();
  }, []);

  useEffect(() => {
    // Initialize partQuantityModes based on existing decimal quantities
    const initialModes = new Map();
    (data.parts_used || []).forEach((part, index) => {
      if (part.quantity % 1 !== 0) { // Check if quantity has a decimal part
        initialModes.set(index, true);
      }
    });
    setPartQuantityModes(initialModes);
  }, [data.parts_used]); // Re-run when parts_used changes

  const loadAllParts = async () => {
    try {
      const partsResponse = await getParts();
      const parts = partsResponse?.data?.data || [];
      setAllParts(parts);
    } catch (error) {
      console.error("Error loading parts:", error);
      setAllParts([]);
    }
  };

  const loadPartUsageData = async () => {
    try {
      const serviceCalls = await ServiceCall.list();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const usageMap = new Map();

      serviceCalls.forEach(call => {
        const callDate = new Date(call.created_date);
        if (callDate >= ninetyDaysAgo && call.parts_used) {
          call.parts_used.forEach(part => {
            const current = usageMap.get(part.part_number) || 0;
            usageMap.set(part.part_number, current + 1);
          });
        }
      });

      setPartUsageData(usageMap);
    } catch (error) {
      console.error("Error loading part usage data:", error);
    }
  };

  useEffect(() => {
    if (searchTerm.length < 4) {
      setSearchResults([]);
      return;
    }

    const searchParts = () => {
      setLoading(true);

      const filteredParts = allParts.filter(part => {
        const searchTermLower = searchTerm.toLowerCase();
        const skuMatch = part.sku && part.sku.toLowerCase().includes(searchTermLower);
        const nameMatch = part.name && part.name.toLowerCase().includes(searchTermLower);
        return skuMatch || nameMatch;
      });

      // Sort by usage (most used first), then alphabetically
      const sortedParts = filteredParts.sort((a, b) => {
        const usageA = partUsageData.get(a.sku) || 0;
        const usageB = partUsageData.get(b.sku) || 0;

        if (usageA !== usageB) {
          return usageB - usageA;
        }

        return a.sku.localeCompare(b.sku, 'he');
      });

      const resultsWithStatus = sortedParts.map(part => {
        const addedCount = getPartAddedCount(part.sku);
        return {
          part: part,
          isAdded: addedCount > 0,
          addedCount: addedCount
        };
      });

      setSearchResults(resultsWithStatus.slice(0, 15));
      setLoading(false);
    };

    const debounceTimer = setTimeout(searchParts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, allParts, partUsageData, data.parts_used]); // Added data.parts_used dependency for live status

  const handleAddPart = (partData) => {
    const updatedParts = [...(data.parts_used || []), partData];
    onUpdate({ parts_used: updatedParts });
    setSelectedPart(null);
    setSelectedPartData(null);
    setAllPartInstances(null); // Clear after add
    // Clear search bar after adding part
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleUpdatePart = (modalItems) => {
    const currentParts = [...(data.parts_used || [])];
    const partSkuBeingEdited = selectedPart.sku;

    // Filter out all existing instances of the part being edited (identified by selectedPart.sku)
    // We will rebuild these based on modalItems. This effectively removes items that were removed in the modal.
    let updatedParts = currentParts.filter(p => p.part_number !== partSkuBeingEdited);

    // Now, add or re-add the items from the modal
    modalItems.forEach(modalItem => {
      updatedParts.push({
        part_id: modalItem.part_id,
        part_number: modalItem.part_number,
        name: modalItem.name,
        quantity: modalItem.quantity,
        has_serial: modalItem.has_serial,
        old_serial: modalItem.old_serial,
        new_serial: modalItem.new_serial,
      });
    });

    onUpdate({ parts_used: updatedParts });
    setSelectedPart(null);
    setSelectedPartData(null);
    setAllPartInstances(null);
    // Clear search bar after updating part
    setSearchTerm('');
    setSearchResults([]);
  };

  const handlePartRowClick = (part) => {
    const currentPartsUsed = data.parts_used || [];
    // Find all instances of this part SKU in the current parts_used list.
    const existingPartInstances = currentPartsUsed
      .map((p, index) => ({ ...p, originalIndex: index })) // Add original index for tracking
      .filter(p => p.part_number === part.sku);

    setSelectedPart(part);

    if (existingPartInstances.length > 0) {
      if (existingPartInstances.length === 1) {
        // Only one instance exists, treat as single edit
        setSelectedPartData(existingPartInstances[0]);
        setAllPartInstances(null); // Ensure this is null if not multiple
      } else {
        // Multiple instances exist, pass them all to the modal
        setSelectedPartData(existingPartInstances[0]); // For `isEditing` check in modal, pick the first one
        setAllPartInstances(existingPartInstances);
      }
    } else {
      // New part, no existing data
      setSelectedPartData(null);
      setAllPartInstances(null);
    }
  };

  const handleRemovePart = (index) => {
    const updatedParts = (data.parts_used || []).filter((_, i) => i !== index);
    onUpdate({ parts_used: updatedParts });
  };

  const handlePartQuantityChange = (index, value) => {
    const updatedParts = [...(data.parts_used || [])];
    const item = updatedParts[index];
    const isPartialMode = partQuantityModes.get(index) || false;

    // If has_serial is true, quantity must be integer. Otherwise, use partial mode setting.
    const parsedValue = item.has_serial
      ? parseInt(value) || 1
      : (isPartialMode ? parseFloat(value) || 1 : parseInt(value) || 1);

    updatedParts[index] = {
      ...item,
      quantity: parsedValue
    };
    onUpdate({ parts_used: updatedParts });
  };

  const handlePartSerialUpdate = (index, field, value) => {
    const updatedParts = [...(data.parts_used || [])];
    updatedParts[index] = { ...updatedParts[index], [field]: value };
    onUpdate({ parts_used: updatedParts });
  };

  const handleSerialToggle = (index, hasSerial) => {
    const updatedParts = [...(data.parts_used || [])];
    const partDefinition = allParts.find(p => p.sku === updatedParts[index].part_number);

    // If part requires serial number, prevent unchecking has_serial
    if (partDefinition?.requires_serial_number && !hasSerial) {
      return;
    }

    updatedParts[index] = {
      ...updatedParts[index],
      has_serial: hasSerial,
      old_serial: hasSerial ? updatedParts[index].old_serial : '',
      new_serial: hasSerial ? updatedParts[index].new_serial : '',
      // If serial is toggled off, ensure quantity is an integer if it was previously partial, unless it's now in partial mode
      quantity: hasSerial ? Math.floor(updatedParts[index].quantity) : updatedParts[index].quantity
    };
    onUpdate({ parts_used: updatedParts });

    // If serial is enabled, ensure quantity mode is integer
    if (hasSerial) {
        const newModes = new Map(partQuantityModes);
        if (newModes.get(index)) { // If it was in partial mode, disable it
            newModes.set(index, false);
            setPartQuantityModes(newModes);
        }
    }
  };

  const togglePartQuantityMode = (index) => {
    const updatedParts = [...(data.parts_used || [])];
    const item = updatedParts[index];
    if (item.has_serial) { // If it has a serial, quantity must be integer, so don't allow partial mode
        return;
    }

    setPartQuantityModes(prevModes => {
      const newModes = new Map(prevModes);
      const currentMode = newModes.get(index) || false;
      const newMode = !currentMode;
      newModes.set(index, newMode);

      // If switching to integer mode, round the quantity
      if (!newMode) {
        updatedParts[index].quantity = Math.floor(updatedParts[index].quantity || 1);
        onUpdate({ parts_used: updatedParts });
      }
      return newModes;
    });
  };

  const getPartAddedCount = (partSku) => {
    return (data.parts_used || []).filter(p => p.part_number === partSku).length;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <div className="space-y-4">
        <div>
          <Label>חיפוש והוספת חלקים</Label>
          <div className="relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חפש חלק לפי מק״ט או שם (4 תווים לפחות)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchTerm.length >= 4 && (
          <div className="border rounded-md">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">מחפש חלקים...</div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-50">
                    <TableRow>
                      <TableHead className="text-center">מק״ט</TableHead>
                      <TableHead className="text-center">שם החלק</TableHead>
                      <TableHead className="text-center">הערות</TableHead>
                      <TableHead className="text-center">סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map(result => (
                      <TableRow
                        key={result.part.id}
                        className="hover:bg-gray-100 cursor-pointer"
                        onClick={() => handlePartRowClick(result.part)}
                      >
                        <TableCell className="text-center font-mono text-blue-600 font-medium">
                          {result.part.sku}
                        </TableCell>
                        <TableCell className="text-center">{result.part.name}</TableCell>
                        <TableCell className="text-center text-sm text-gray-600">
                          {result.part.notes && result.part.notes.trim() && result.part.notes.toLowerCase() !== 'n/a'
                            ? result.part.notes
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          {result.isAdded ? (
                            <Badge className="bg-green-100 text-green-800">
                              כבר נוסף ({result.addedCount})
                            </Badge>
                          ) : (
                            <Badge variant="outline">זמין</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : searchTerm.length >= 4 ? (
              <div className="p-4 text-center text-sm text-gray-500">לא נמצאו חלקים תואמים</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Added Parts Table */}
      {data.parts_used && data.parts_used.length > 0 && (
        <div className="space-y-2">
          <Label>חלקים שנוספו</Label>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">מק״ט</TableHead>
                  <TableHead className="text-center">שם החלק</TableHead>
                  <TableHead className="text-center">כמות</TableHead>
                  <TableHead className="text-center">מספר סידורי</TableHead>
                  <TableHead className="text-center">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.parts_used.map((part, index) => {
                  const isPartialMode = partQuantityModes.get(index) || false;
                  const partDefinition = allParts.find(p => p.sku === part.part_number);

                  return (
                    <TableRow key={index}>
                      <TableCell className="text-center font-mono text-blue-600 font-medium">
                        {part.part_number}
                      </TableCell>
                      <TableCell className="text-center">{part.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={isPartialMode ? "0.1" : "1"}
                              step={isPartialMode ? "0.1" : "1"}
                              value={part.quantity || 1}
                              onChange={(e) => handlePartQuantityChange(index, e.target.value)}
                              onMouseDown={(e) => {
                                // No preventDefault() here to allow native input functionality
                                const holdTimer = setTimeout(() => {
                                  togglePartQuantityMode(index);
                                }, 2000);

                                const clearTimer = () => {
                                  clearTimeout(holdTimer);
                                  document.removeEventListener('mouseup', clearTimer);
                                  document.removeEventListener('mouseleave', clearTimer);
                                };

                                document.addEventListener('mouseup', clearTimer);
                                document.addEventListener('mouseleave', clearTimer);
                              }}
                              onTouchStart={(e) => {
                                const holdTimer = setTimeout(() => {
                                  togglePartQuantityMode(index);
                                }, 2000);

                                const clearTimer = () => {
                                  clearTimeout(holdTimer);
                                  document.removeEventListener('touchend', clearTimer);
                                  document.removeEventListener('touchcancel', clearTimer);
                                };

                                document.addEventListener('touchend', clearTimer);
                                document.addEventListener('touchcancel', clearTimer);
                              }}
                              className="w-20 text-center" // Removed cursor-pointer
                              disabled={part.has_serial} // Disable partial mode for serial parts
                            />
                            {isPartialMode && !part.has_serial && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                                חלקית
                              </Badge>
                            )}
                          </div>
                          {/* Removed the instruction div */}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-2">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={part.has_serial}
                              onCheckedChange={(checked) => handleSerialToggle(index, checked)}
                              disabled={partDefinition?.requires_serial_number} // Disable if part definition requires serial
                            />
                          </div>
                          {part.has_serial && (
                            <div className="space-y-1">
                              <Input
                                placeholder="ישן"
                                value={part.old_serial || ''}
                                onChange={(e) => handlePartSerialUpdate(index, 'old_serial', e.target.value)}
                                className="w-24 mx-auto text-xs"
                              />
                              <Input
                                placeholder="חדש"
                                value={part.new_serial || ''}
                                onChange={(e) => handlePartSerialUpdate(index, 'new_serial', e.target.value)}
                                className="w-24 mx-auto text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePart(index)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Part Selection Modal */}
      {selectedPart && (
        <PartSelectionModal
          part={selectedPart}
          existingPartData={selectedPartData}
          allPartInstances={allPartInstances}
          onAdd={handleAddPart}
          onUpdate={handleUpdatePart}
          onCancel={() => {
            setSelectedPart(null);
            setSelectedPartData(null);
            setAllPartInstances(null);
          }}
        />
      )}
    </div>
  );
}