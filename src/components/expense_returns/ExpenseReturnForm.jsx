import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Upload, X } from "lucide-react";
import { User } from "@/entities/all";
import { UploadFile } from "@/integrations/Core";
import { format } from 'date-fns';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const purchaseTypes = {
  tools: "כלי עבודה",
  fuel: "דלק",
  parts: "חלקי חילוף",
  office_supplies: "ציוד משרד",
  travel: "נסיעות",
  meals: "ארוחות",
  accommodation: "לינה",
  maintenance: "תחזוקה",
  other: "אחר"
};

export default function ExpenseReturnForm({ initialReturn, currentUser, onSubmit, onCancel }) {
    const [formData, setFormData] = useState({
        return_number: `EXP-${Date.now().toString().slice(-6)}`,
        employee_name: currentUser?.nickname || currentUser?.full_name || '',
        employee_email: currentUser?.email || '',
        status: 'pending',
        expenses: [],
        total_amount: 0,
        currency: 'ILS',
        submission_date: format(new Date(), 'dd/MM/yyyy'),
        return_date: '',
        bank_reference: '',
        approved_by: '',
        approval_date: '',
        notes: '',
        receipt_urls: []
    });
    
    const [users, setUsers] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [dateErrors, setDateErrors] = useState({}); // Add date errors state

    useEffect(() => {
        if (initialReturn) {
            const formatForDisplay = (date) => {
                if (!date) return '';
                try {
                    // Attempt to parse the date string.
                    // new Date() can handle ISO 8601 strings (e.g., "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss.sssZ").
                    // If the date is already in "dd/MM/yyyy" format, new Date() might return "Invalid Date".
                    // The convertDateForSubmission function implies dates are stored as YYYY-MM-DD on the backend.
                    // So, assuming `initialReturn` comes with YYYY-MM-DD or ISO strings for dates.
                    return format(new Date(date), 'dd/MM/yyyy');
                } catch (e) {
                    // If parsing fails (e.g., date is "Invalid Date" or malformed), return an empty string.
                    return '';
                }
            };

            setFormData({
                ...initialReturn,
                submission_date: formatForDisplay(initialReturn.submission_date),
                return_date: formatForDisplay(initialReturn.return_date),
                approval_date: formatForDisplay(initialReturn.approval_date),
                expenses: initialReturn.expenses.map(exp => ({
                    ...exp,
                    invoice_date: formatForDisplay(exp.invoice_date)
                }))
            });
        }
        
        const loadUsers = async () => {
            try {
                const userData = await User.list();
                setUsers(userData);
            } catch (error) {
                console.error("Failed to load users:", error);
            }
        };
        loadUsers();
    }, [initialReturn]);

    useEffect(() => {
        // Calculate total amount whenever expenses change
        const total = formData.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        setFormData(prev => ({ ...prev, total_amount: total }));
    }, [formData.expenses]);

    const handleAddExpense = () => {
        const newExpense = {
            invoice_date: format(new Date(), 'dd/MM/yyyy'),
            invoice_number: '',
            business_name: '',
            purchase_type: 'other',
            amount: 0,
            currency: 'ILS',
            description: '',
            receipt_uploaded: false
        };
        setFormData(prev => ({ 
            ...prev, 
            expenses: [newExpense, ...prev.expenses] // Add at top of list
        }));
    };

    const handleExpenseChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            expenses: prev.expenses.map((exp, i) =>
                i === index ? { ...exp, [field]: value } : exp
            )
        }));
    };
    
    const handleRemoveExpense = (index) => {
        setFormData(prev => ({
            ...prev,
            expenses: prev.expenses.filter((_, i) => i !== index)
        }));
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({
                ...prev,
                receipt_urls: [...prev.receipt_urls, file_url]
            }));
            toast({ title: "קובץ הועלה בהצלחה" });
        } catch (error) {
            console.error("File upload error:", error);
            toast({ variant: "destructive", title: "שגיאה בהעלאת הקובץ" });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveFile = (index) => {
        setFormData(prev => ({
            ...prev,
            receipt_urls: prev.receipt_urls.filter((_, i) => i !== index)
        }));
    };

    // Convert dd/MM/yyyy to yyyy-MM-dd for form submission
    const convertDateForSubmission = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
            return '';
        }
        
        const parts = dateStr.split('/');
        if (parts.length !== 3) {
            return '';
        }
        
        const [day, month, year] = parts;
        
        // Validate that all parts exist and are valid
        if (!day || !month || !year) {
            return '';
        }
        
        // Ensure we have strings before calling padStart
        const dayStr = String(day).padStart(2, '0');
        const monthStr = String(month).padStart(2, '0');
        const yearStr = String(year);
        
        return `${yearStr}-${monthStr}-${dayStr}`;
    };

    // Date validation and formatting functions
    const validateAndFormatDate = (dateStr, fieldName) => {
        if (!dateStr || dateStr.trim() === '') {
            setDateErrors(prev => ({ ...prev, [fieldName]: null }));
            return '';
        }

        // Remove any existing error for this field
        setDateErrors(prev => ({ ...prev, [fieldName]: null }));

        // Try to parse various date formats
        let parsedDate = null;
        const cleanedDate = dateStr.replace(/[^\d\/\-\.]/g, ''); // Remove non-date characters

        // Common date patterns to try
        const patterns = [
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // dd/mm/yyyy or d/m/yyyy
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/, // dd-mm-yyyy or d-m-yyyy
            /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // dd.mm.yyyy or d.m.yyyy
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // yyyy/mm/dd
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // yyyy-mm-dd
        ];

        for (let i = 0; i < patterns.length; i++) {
            const match = cleanedDate.match(patterns[i]);
            if (match) {
                let day, month, year;
                
                if (i < 3) { // dd/mm/yyyy formats
                    day = parseInt(match[1]);
                    month = parseInt(match[2]);
                    year = parseInt(match[3]);
                } else { // yyyy/mm/dd formats
                    year = parseInt(match[1]);
                    month = parseInt(match[2]);
                    day = parseInt(match[3]);
                }

                // Validate ranges
                if (month < 1 || month > 12) {
                    setDateErrors(prev => ({ ...prev, [fieldName]: 'חודש לא חוקי (1-12)' }));
                    return dateStr;
                }

                // Check reasonable year range (1900-2100)
                if (year < 1900 || year > 2100) {
                    setDateErrors(prev => ({ ...prev, [fieldName]: 'שנה לא סבירה (1900-2100)' }));
                    return dateStr;
                }

                // Check if date is valid (handles leap years, month lengths)
                const testDate = new Date(year, month - 1, day);
                if (testDate.getFullYear() !== year || 
                    testDate.getMonth() !== month - 1 || 
                    testDate.getDate() !== day) {
                    setDateErrors(prev => ({ ...prev, [fieldName]: 'תאריך לא קיים (לדוגמא 31/02)' }));
                    return dateStr;
                }

                // Format as dd/mm/yyyy
                const formattedDay = String(day).padStart(2, '0');
                const formattedMonth = String(month).padStart(2, '0');
                return `${formattedDay}/${formattedMonth}/${year}`;
            }
        }

        // If no pattern matched, show error
        setDateErrors(prev => ({ ...prev, [fieldName]: 'פורמט תאריך לא חוקי. השתמש ב: dd/mm/yyyy' }));
        return dateStr;
    };

    const handleDateChange = (fieldName, value) => {
        const formattedDate = validateAndFormatDate(value, fieldName);
        setFormData(prev => ({ ...prev, [fieldName]: formattedDate }));
    };

    const handleExpenseDateChange = (index, value) => {
        const fieldName = `expense_${index}_date`;
        const formattedDate = validateAndFormatDate(value, fieldName);
        
        setFormData(prev => ({
            ...prev,
            expenses: prev.expenses.map((exp, i) =>
                i === index ? { ...exp, invoice_date: formattedDate } : exp
            )
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Check for date errors before submitting
        const hasDateErrors = Object.values(dateErrors).some(error => error !== null);
        if (hasDateErrors) {
            toast({ 
                variant: "destructive", 
                title: "יש תאריכים לא חוקיים", 
                description: "אנא תקן את התאריכים לפני השמירה" 
            });
            return;
        }

        if (formData.expenses.length === 0) {
            toast({ variant: "destructive", title: "יש להוסיף לפחות הוצאה אחת" });
            return;
        }

        // Convert dates to ISO format for submission
        const submissionData = {
            ...formData,
            submission_date: convertDateForSubmission(formData.submission_date),
            return_date: convertDateForSubmission(formData.return_date),
            approval_date: convertDateForSubmission(formData.approval_date),
            expenses: formData.expenses.map(exp => ({
                ...exp,
                invoice_date: convertDateForSubmission(exp.invoice_date)
            }))
        };

        onSubmit(submissionData);
    };

    const isAdmin = currentUser?.role === 'admin';

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>מספר החזרה</Label>
                    <Input value={formData.return_number} disabled />
                </div>
                <div className="space-y-2">
                    <Label>תאריך הגשה</Label>
                    <Input 
                        value={formData.submission_date} 
                        onChange={e => handleDateChange('submission_date', e.target.value)} 
                        placeholder="dd/mm/yyyy"
                    />
                    {dateErrors.submission_date && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{dateErrors.submission_date}</AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>שם העובד</Label>
                    <Input 
                        value={formData.employee_name} 
                        onChange={e => setFormData(p => ({...p, employee_name: e.target.value}))}
                        disabled={!isAdmin}
                    />
                </div>
                <div className="space-y-2">
                    <Label>אימייל העובד</Label>
                    <Input 
                        type="email"
                        value={formData.employee_email} 
                        onChange={e => setFormData(p => ({...p, employee_email: e.target.value}))}
                        disabled={!isAdmin}
                    />
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>פירוט הוצאות</CardTitle>
                    <Button type="button" onClick={handleAddExpense} size="sm">
                        <Plus className="w-4 h-4 ml-2" /> הוסף הוצאה
                    </Button>
                </CardHeader>
                <CardContent>
                    {formData.expenses.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">לא נוספו הוצאות עדיין</p>
                    ) : (
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>תאריך חשבונית</TableHead>
                                        <TableHead>מספר חשבונית</TableHead>
                                        <TableHead>שם העסק</TableHead>
                                        <TableHead>סוג רכישה</TableHead>
                                        <TableHead>סכום</TableHead>
                                        <TableHead>תיאור</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.expenses.map((expense, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Input 
                                                    value={expense.invoice_date} 
                                                    onChange={e => handleExpenseDateChange(index, e.target.value)}
                                                    placeholder="dd/mm/yyyy"
                                                    className="w-32"
                                                />
                                                {dateErrors[`expense_${index}_date`] && (
                                                    <div className="text-xs text-red-600 mt-1">
                                                        {dateErrors[`expense_${index}_date`]}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.invoice_number} 
                                                    onChange={e => handleExpenseChange(index, 'invoice_number', e.target.value)}
                                                    placeholder="מספר חשבונית"
                                                    className="w-28"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.business_name} 
                                                    onChange={e => handleExpenseChange(index, 'business_name', e.target.value)}
                                                    placeholder="שם העסק"
                                                    className="w-32"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select 
                                                    value={expense.purchase_type} 
                                                    onValueChange={val => handleExpenseChange(index, 'purchase_type', val)}
                                                >
                                                    <SelectTrigger className="w-28">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(purchaseTypes).map(([key, label]) => (
                                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={expense.amount} 
                                                    onChange={e => handleExpenseChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="w-20"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.description} 
                                                    onChange={e => handleExpenseChange(index, 'description', e.target.value)}
                                                    placeholder="תיאור"
                                                    className="w-32"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    type="button"
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleRemoveExpense(index)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <div className="text-lg font-semibold">
                            סה"כ לפירעון: ₪{formData.total_amount.toFixed(2)}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>העלאת קבלות</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label>קבלות וחשבוניות</Label>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="hidden"
                                    id="receipt-upload"
                                />
                                <label htmlFor="receipt-upload">
                                    <Button type="button" variant="outline" disabled={uploading} asChild>
                                        <span>
                                            <Upload className="w-4 h-4 ml-2" />
                                            {uploading ? 'מעלה...' : 'העלה קובץ'}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        </div>
                        
                        {formData.receipt_urls.length > 0 && (
                            <div>
                                <Label>קבצים שהועלו:</Label>
                                <div className="mt-2 space-y-2">
                                    {formData.receipt_urls.map((url, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                קובץ {index + 1}
                                            </a>
                                            <Button 
                                                type="button"
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleRemoveFile(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {isAdmin && (
                <Card>
                    <CardHeader>
                        <CardTitle>פרטי אישור ותשלום (למנהלים בלבד)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>סטטוס</Label>
                                <Select 
                                    value={formData.status} 
                                    onValueChange={val => setFormData(p => ({...p, status: val}))}
                                >
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">ממתין לאישור</SelectItem>
                                        <SelectItem value="approved">מאושר</SelectItem>
                                        <SelectItem value="rejected">נדחה</SelectItem>
                                        <SelectItem value="paid">שולם</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>מאושר על ידי</Label>
                                    <Select 
                                        value={formData.approved_by} 
                                        onValueChange={val => setFormData(p => ({...p, approved_by: val}))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר מנהל" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {users.filter(u => u.role === 'admin').map(user => (
                                                <SelectItem key={user.id} value={user.nickname || user.full_name}>
                                                    {user.nickname || user.full_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>תאריך אישור</Label>
                                    <Input 
                                        value={formData.approval_date} 
                                        onChange={e => handleDateChange('approval_date', e.target.value)} 
                                        placeholder="dd/mm/yyyy"
                                    />
                                    {dateErrors.approval_date && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{dateErrors.approval_date}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>מספר אסמכתא בנק</Label>
                                    <Input 
                                        value={formData.bank_reference} 
                                        onChange={e => setFormData(p => ({...p, bank_reference: e.target.value}))} 
                                        placeholder="מספר העברה/אסמכתא"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>תאריך החזר</Label>
                                    <Input 
                                        value={formData.return_date} 
                                        onChange={e => handleDateChange('return_date', e.target.value)} 
                                        placeholder="dd/mm/yyyy"
                                    />
                                    {dateErrors.return_date && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{dateErrors.return_date}</AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea 
                    value={formData.notes} 
                    onChange={e => setFormData(p => ({...p, notes: e.target.value}))}
                    placeholder="הערות נוספות"
                />
            </div>
            
            <div className="flex justify-start gap-2 pt-4">
                <Button type="submit" disabled={formData.expenses.length === 0}>
                    שמור החזרת הוצאות
                </Button>
                <Button type="button" variant="ghost" onClick={onCancel}>ביטול</Button>
            </div>
        </form>
    );
}