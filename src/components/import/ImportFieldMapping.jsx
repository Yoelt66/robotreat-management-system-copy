
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { List, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function ImportFieldMapping({ mapping, onMappingChange }) {
    const renumberCheckedFields = (orderedMapping) => {
        let columnCounter = 1;
        return orderedMapping.map(field => {
            if (field.checked) {
                return { ...field, column: columnCounter++ };
            }
            return { ...field, column: '' };
        });
    };

    const handleFieldChange = (key, property, value) => {
        let newMapping = mapping.map(field =>
            field.key === key ? { ...field, [property]: value } : field
        );
        
        if (property === 'checked') {
            newMapping = renumberCheckedFields(newMapping);
        }
        
        onMappingChange(newMapping);

        try {
            localStorage.setItem('importFieldMapping', JSON.stringify(newMapping));
        } catch (error) {
            console.warn('Failed to save field mapping to localStorage:', error);
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination || result.source.index === result.destination.index) {
            return;
        }

        const currentDisplayOrder = getSortedMapping();
        const reorderedItems = Array.from(currentDisplayOrder);
        
        const [draggedItem] = reorderedItems.splice(result.source.index, 1);
        reorderedItems.splice(result.destination.index, 0, draggedItem);

        const reorderedChecked = reorderedItems.filter(item => item.checked);
        const reorderedUnchecked = reorderedItems.filter(item => !item.checked);
        
        const displayedKeys = new Set(currentDisplayOrder.map(item => item.key));
        const hiddenItems = mapping.filter(item => !displayedKeys.has(item.key));
        
        const newFullMapping = [...reorderedChecked, ...reorderedUnchecked, ...hiddenItems];
        const finalMapping = renumberCheckedFields(newFullMapping);
        
        onMappingChange(finalMapping);

        try {
            localStorage.setItem('importFieldMapping', JSON.stringify(finalMapping));
        } catch (error) {
            console.warn('Failed to save field mapping to localStorage:', error);
        }
    };

    const getSortedMapping = () => {
        return [...mapping].sort((a, b) => {
            if (a.checked && !b.checked) return -1;
            if (!a.checked && b.checked) return 1;
            
            if (a.checked && b.checked) {
                const aCol = parseInt(a.column) || 0;
                const bCol = parseInt(b.column) || 0;
                return aCol - bCol;
            }
            
            const aIndex = mapping.findIndex(f => f.key === a.key);
            const bIndex = mapping.findIndex(f => f.key === b.key);
            return aIndex - bIndex;
        });
    };

    const sortedMapping = getSortedMapping();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    מיפוי עמודות
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="fields">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="max-h-96 overflow-y-auto space-y-3 pr-2"
                            >
                                {sortedMapping.map((field, index) => (
                                    <Draggable key={field.key} draggableId={field.key} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`grid grid-cols-12 items-center gap-2 p-2 border rounded-md transition-all ${
                                                    snapshot.isDragging 
                                                        ? 'bg-blue-50 shadow-lg border-blue-200 transform rotate-1' 
                                                        : field.checked 
                                                            ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                                            : 'hover:bg-gray-50'
                                                }`}
                                            >
                                                <div {...provided.dragHandleProps} className="col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                                                    <GripVertical className="h-4 w-4" />
                                                </div>
                                                <div className="col-span-1 flex items-center justify-center">
                                                    <Checkbox
                                                        id={`check-${field.key}`}
                                                        checked={field.checked}
                                                        onCheckedChange={(checked) => handleFieldChange(field.key, 'checked', checked)}
                                                        disabled={field.is_required}
                                                    />
                                                </div>
                                                <Label htmlFor={`check-${field.key}`} className="col-span-6 cursor-pointer flex items-center gap-2 text-sm">
                                                    {field.label}
                                                    {field.is_required && <Badge variant="destructive" className="text-xs">חובה</Badge>}
                                                </Label>
                                                <div className="col-span-4">
                                                    <Input
                                                        type="text"
                                                        readOnly
                                                        placeholder={field.checked ? "עמודה" : "לא פעיל"}
                                                        value={field.checked ? `עמודה ${field.column}` : ''}
                                                        className={`h-6 text-center cursor-default font-medium text-sm ${
                                                            field.checked 
                                                                ? 'bg-green-100 border-green-300 text-green-800' 
                                                                : 'bg-gray-100 text-gray-400'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </CardContent>
        </Card>
    );
}
