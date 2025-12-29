import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Upload, X, RefreshCw, FileText, ExternalLink, FileDown } from "lucide-react";
import { User } from "@/entities/all";
import { Currency } from "@/entities/Currency";
import { base44 } from "@/api/base44Client";
import { format } from 'date-fns';
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { jsPDF } from 'jspdf';

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
        receipt_urls: [],
        receipt_files: [] // Store file info with original names
    });
    
    const [users, setUsers] = useState([]);
    const [currencies, setCurrencies] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
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
                receipt_files: initialReturn.receipt_files || (initialReturn.receipt_urls || []).map((url, i) => ({ url, name: `קובץ ${i + 1}` })),
                expenses: (initialReturn.expenses || []).map(exp => ({
                    ...exp,
                    invoice_date: formatForDisplay(exp.invoice_date)
                }))
            });
        }
        
        const loadData = async () => {
            try {
                const [userData, currencyData] = await Promise.all([
                    User.list(),
                    Currency.list()
                ]);
                setUsers(userData);
                setCurrencies(currencyData);
            } catch (error) {
                console.error("Failed to load data:", error);
            }
        };
        loadData();
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
            original_amount: 0,
            original_currency: 'ILS',
            exchange_rate: null,
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

    const analyzeReceipt = async (fileUrl) => {
        try {
            const accountingCategories = [
                "דלק והובלה",
                "כלי עבודה וציוד",
                "חלקי חילוף ותחזוקה",
                "ציוד משרדי",
                "נסיעות וארוחות",
                "לינה",
                "שונות"
            ];

            const prompt = `נתח את החשבונית/קבלה המצורפת וחלץ את הפרטים הבאים:
1. שם העסק/שם בית העסק
2. מספר חשבונית (אם קיים)
3. תאריך החשבונית (בפורמט dd/mm/yyyy)
4. סכום החשבונית
5. מטבע (ILS/USD/EUR/GBP או אחר)
6. קטגוריה חשבונאית מתאימה מתוך: ${accountingCategories.join(', ')}

אם לא ניתן לזהות שדה מסוים, השאר אותו ריק או null.
עבור הקטגוריה החשבונאית, בחר את הקטגוריה המתאימה ביותר על פי תוכן החשבונית.`;

            const result = await base44.integrations.Core.InvokeLLM({
                prompt,
                file_urls: [fileUrl],
                response_json_schema: {
                    type: "object",
                    properties: {
                        business_name: { type: "string" },
                        invoice_number: { type: "string" },
                        invoice_date: { type: "string" },
                        amount: { type: "number" },
                        currency: { type: "string" },
                        accounting_category: { type: "string" }
                    }
                }
            });

            return result;
        } catch (error) {
            console.error("Receipt analysis error:", error);
            return null;
        }
    };

    const getExchangeRateFromBankOfIsrael = async (fromCurrency, invoiceDate) => {
        if (!fromCurrency || fromCurrency === 'ILS') return 1;
        
        try {
            // Use LLM to fetch exchange rate from Bank of Israel for specific date
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `מה היה שער החליפין של ${fromCurrency} לשקל ישראלי (ILS) בתאריך ${invoiceDate}?
                חפש את המידע באתר בנק ישראל או מקורות רשמיים אחרים.
                החזר רק את השער כמספר (לדוגמה: 3.65), ללא טקסט נוסף.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        exchange_rate: { type: "number" }
                    }
                }
            });
            
            return result.exchange_rate || 1;
        } catch (error) {
            console.error("Error fetching exchange rate:", error);
            // Fallback to default if API fails
            const currency = currencies.find(c => c.code === fromCurrency);
            return currency?.rate_to_ils || 1;
        }
    };

    const convertCurrency = async (amount, fromCurrency, invoiceDate) => {
        if (!amount || fromCurrency === 'ILS') return { amountInILS: amount, exchangeRate: null };

        const exchangeRate = await getExchangeRateFromBankOfIsrael(fromCurrency, invoiceDate);
        const amountInILS = amount * exchangeRate;
        
        return { amountInILS, exchangeRate };
    };

    const mapCategoryToPurchaseType = (category) => {
        const mapping = {
            "דלק והובלה": "fuel",
            "כלי עבודה וציוד": "tools",
            "חלקי חילוף ותחזוקה": "parts",
            "ציוד משרדי": "office_supplies",
            "נסיעות וארוחות": "meals",
            "לינה": "accommodation",
            "שונות": "other"
        };
        return mapping[category] || "other";
    };

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        setUploading(true);
        setAnalyzing(true);
        
        try {
            toast.info(`מעלה ${files.length} קבצים...`);
            
            // Upload and analyze all files in parallel
            const results = await Promise.all(
                files.map(async (file) => {
                    try {
                        // Upload file
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        
                        // Analyze receipt
                        const analysisResult = await analyzeReceipt(file_url);
                        
                        return { file_url, file_name: file.name, analysisResult };
                    } catch (error) {
                        console.error("Error processing file:", error);
                        return { file_url: null, file_name: file.name, analysisResult: null };
                    }
                })
            );

            // Add receipt files with names
            const newReceiptFiles = results
                .filter(r => r.file_url)
                .map(r => ({ url: r.file_url, name: r.file_name }));

            // Process analyzed data - with async conversion
            const newExpenses = await Promise.all(
                results
                    .filter(r => r.analysisResult)
                    .map(async ({ file_url, file_name, analysisResult }) => {
                        const { business_name, invoice_number, invoice_date, amount, currency, accounting_category } = analysisResult;
                        
                        // Check for missing data
                        const missingFields = [];
                        if (!business_name) missingFields.push('שם העסק');
                        if (!invoice_date) missingFields.push('תאריך');
                        if (!amount || amount === 0) missingFields.push('סכום');
                        
                        // Convert amount to ILS if needed using Bank of Israel rates
                        let amountInILS = amount;
                        let exchangeRate = null;
                        
                        if (currency && currency !== 'ILS') {
                            const conversionResult = await convertCurrency(amount, currency, invoice_date);
                            amountInILS = conversionResult.amountInILS;
                            exchangeRate = conversionResult.exchangeRate;
                        }

                        // Map category to purchase type
                        const purchaseType = mapCategoryToPurchaseType(accounting_category);

                        return {
                            invoice_date: invoice_date || format(new Date(), 'dd/MM/yyyy'),
                            invoice_number: invoice_number || '',
                            business_name: business_name || '',
                            purchase_type: purchaseType,
                            amount: parseFloat(amountInILS?.toFixed(2)) || 0,
                            currency: 'ILS',
                            original_amount: amount || 0,
                            original_currency: currency || 'ILS',
                            exchange_rate: exchangeRate,
                            description: accounting_category || '',
                            receipt_uploaded: true,
                            receipt_url: file_url,
                            receipt_file_name: file_name,
                            missing_fields: missingFields
                        };
                    })
            );

            setFormData(prev => ({
                ...prev,
                receipt_urls: [...prev.receipt_urls, ...newReceiptFiles.map(f => f.url)],
                receipt_files: [...prev.receipt_files, ...newReceiptFiles],
                expenses: [...newExpenses, ...prev.expenses]
            }));

            const analyzedCount = newExpenses.length;
            const incompleteParsing = newExpenses.filter(e => e.missing_fields?.length > 0);
            
            if (analyzedCount > 0) {
                if (incompleteParsing.length > 0) {
                    toast.success(`${analyzedCount} חשבוניות נותחו. ${incompleteParsing.length} דורשות השלמה ידנית.`, { duration: 6000 });
                } else {
                    toast.success(`${analyzedCount} מתוך ${files.length} חשבוניות נותחו בהצלחה!`);
                }
            } else {
                toast.info("הקבצים הועלו, אך לא ניתן לנתח אותם אוטומטית");
            }
        } catch (error) {
            console.error("File upload error:", error);
            toast.error("שגיאה בהעלאת הקבצים");
        } finally {
            setUploading(false);
            setAnalyzing(false);
            event.target.value = ''; // Reset input
        }
    };

    const handleRemoveFile = (index) => {
        setFormData(prev => ({
            ...prev,
            receipt_urls: prev.receipt_urls.filter((_, i) => i !== index),
            receipt_files: prev.receipt_files.filter((_, i) => i !== index)
        }));
    };

    const reanalyzeExpense = async (originalIndex) => {
        const expense = formData.expenses[originalIndex];
        if (!expense.receipt_url) {
            toast.error("לא נמצא קובץ מקושר להוצאה זו");
            return;
        }

        setAnalyzing(true);
        try {
            toast.info("מנתח מחדש את הקובץ המקושר...");
            const analysisResult = await analyzeReceipt(expense.receipt_url);
            
            if (analysisResult) {
                const { business_name, invoice_number, invoice_date, amount, currency, accounting_category } = analysisResult;
                
                // Check for missing data and ask user
                const missingFields = [];
                if (!business_name) missingFields.push('שם העסק');
                if (!invoice_date) missingFields.push('תאריך חשבונית');
                if (!amount || amount === 0) missingFields.push('סכום');
                
                if (missingFields.length > 0) {
                    toast.info(`לא ניתן לזהות: ${missingFields.join(', ')}. אנא הזן ידנית.`, { duration: 5000 });
                }
                
                // Convert amount to ILS using Bank of Israel rates
                let amountInILS = amount;
                let exchangeRate = null;
                
                if (currency && currency !== 'ILS') {
                    const conversionResult = await convertCurrency(amount, currency, invoice_date || expense.invoice_date);
                    amountInILS = conversionResult.amountInILS;
                    exchangeRate = conversionResult.exchangeRate;
                }

                const purchaseType = mapCategoryToPurchaseType(accounting_category);
                
                handleExpenseChange(originalIndex, 'invoice_date', invoice_date || expense.invoice_date || format(new Date(), 'dd/MM/yyyy'));
                handleExpenseChange(originalIndex, 'invoice_number', invoice_number || expense.invoice_number || '');
                handleExpenseChange(originalIndex, 'business_name', business_name || expense.business_name || '');
                handleExpenseChange(originalIndex, 'purchase_type', purchaseType);
                handleExpenseChange(originalIndex, 'amount', parseFloat(amountInILS?.toFixed(2)) || expense.amount || 0);
                handleExpenseChange(originalIndex, 'original_amount', amount || expense.original_amount || 0);
                handleExpenseChange(originalIndex, 'original_currency', currency || expense.original_currency || 'ILS');
                handleExpenseChange(originalIndex, 'exchange_rate', exchangeRate);
                handleExpenseChange(originalIndex, 'description', accounting_category || expense.description || '');

                toast.success("הוצאה נותחה מחדש בהצלחה!");
            } else {
                toast.error("לא ניתן לנתח את הקובץ");
            }
        } catch (error) {
            console.error("Reanalysis error:", error);
            toast.error("שגיאה בניתוח מחדש");
        } finally {
            setAnalyzing(false);
        }
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

    const generatePDF = async () => {
        console.log("Generating PDF...");
        
        // Load Hebrew font
        const fontUrl = 'https://cdn.jsdelivr.net/npm/open-sans-hebrew@1.1.0/fonts/OpenSansHebrew-Regular.ttf';
        
        try {
            toast.info("יוצר PDF...");
            const doc = new jsPDF();
            
            // Try to add Hebrew font support
            try {
                const response = await fetch(fontUrl);
                const fontData = await response.arrayBuffer();
                const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontData)));
                doc.addFileToVFS('OpenSansHebrew.ttf', fontBase64);
                doc.addFont('OpenSansHebrew.ttf', 'OpenSansHebrew', 'normal');
                doc.setFont('OpenSansHebrew');
            } catch (fontError) {
                console.warn("Could not load Hebrew font, using default", fontError);
                doc.setFont("helvetica");
            }
            
            let y = 20;
            
            // Title - RTL
            doc.setFontSize(18);
            doc.text("דוח החזר הוצאות", 190, y, { align: "right" });
            doc.text(formData.return_number, 190, y + 7, { align: "right" });
            y += 20;
            
            // Employee details - RTL
            doc.setFontSize(11);
            doc.text(`עובד: ${formData.employee_name}`, 190, y, { align: "right" });
            y += 7;
            doc.text(`אימייל: ${formData.employee_email}`, 190, y, { align: "right" });
            y += 7;
            doc.text(`תאריך הגשה: ${formData.submission_date}`, 190, y, { align: "right" });
            y += 10;
            
            // Expenses table header
            doc.setFontSize(12);
            doc.setFont("OpenSansHebrew", "bold");
            doc.text("פירוט הוצאות:", 190, y, { align: "right" });
            y += 7;
            
            doc.setFontSize(9);
            doc.text("תאריך", 190, y, { align: "right" });
            doc.text("עסק", 160, y, { align: "right" });
            doc.text("סוג", 120, y, { align: "right" });
            doc.text("סכום מקורי", 90, y, { align: "right" });
            doc.text("שער", 60, y, { align: "right" });
            doc.text("סכום ש״ח", 30, y, { align: "right" });
            y += 5;
            
            doc.setFont("OpenSansHebrew", "normal");
            
            // Sort expenses
            const sortedExpenses = [...formData.expenses].sort((a, b) => {
                const nameCompare = (a.business_name || '').localeCompare(b.business_name || '');
                if (nameCompare !== 0) return nameCompare;
                const dateA = convertDateForSubmission(a.invoice_date);
                const dateB = convertDateForSubmission(b.invoice_date);
                return dateB.localeCompare(dateA);
            });
            
            // Expenses rows
            sortedExpenses.forEach((expense) => {
                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.text(expense.invoice_date || '', 190, y, { align: "right" });
                doc.text((expense.business_name || '').substring(0, 20), 160, y, { align: "right" });
                doc.text(purchaseTypes[expense.purchase_type] || '', 120, y, { align: "right" });
                
                // Original amount and currency
                if (expense.original_currency && expense.original_currency !== 'ILS') {
                    doc.text(`${expense.original_amount?.toFixed(2) || '0.00'} ${expense.original_currency}`, 90, y, { align: "right" });
                    doc.text(expense.exchange_rate?.toFixed(4) || '-', 60, y, { align: "right" });
                } else {
                    doc.text('-', 90, y, { align: "right" });
                    doc.text('-', 60, y, { align: "right" });
                }
                
                doc.text(`${expense.amount?.toFixed(2) || '0.00'}`, 30, y, { align: "right" });
                y += 6;
            });
            
            y += 5;
            
            // Total
            doc.setFont("OpenSansHebrew", "bold");
            doc.setFontSize(11);
            doc.text(`סה״כ לפירעון: ₪${formData.total_amount.toFixed(2)}`, 190, y, { align: "right" });
            y += 10;
            
            // Approval details
            if (formData.status !== 'pending' && (formData.approved_by || formData.bank_reference || formData.return_date)) {
                y += 5;
                doc.setFontSize(12);
                doc.text("פרטי אישור ותשלום:", 190, y, { align: "right" });
                y += 7;
                doc.setFont("OpenSansHebrew", "normal");
                doc.setFontSize(10);
                
                if (formData.approved_by) {
                    doc.text(`מאושר על ידי: ${formData.approved_by}`, 190, y, { align: "right" });
                    y += 6;
                }
                if (formData.approval_date) {
                    doc.text(`תאריך אישור: ${formData.approval_date}`, 190, y, { align: "right" });
                    y += 6;
                }
                if (formData.bank_reference) {
                    doc.text(`אסמכתא בנק: ${formData.bank_reference}`, 190, y, { align: "right" });
                    y += 6;
                }
                if (formData.return_date) {
                    doc.text(`תאריך תשלום: ${formData.return_date}`, 190, y, { align: "right" });
                    y += 6;
                }
                
                const statusText = 
                    formData.status === 'pending' ? 'ממתין לאישור' :
                    formData.status === 'approved' ? 'מאושר' :
                    formData.status === 'rejected' ? 'נדחה' :
                    formData.status === 'paid' ? 'שולם' : formData.status;
                doc.text(`סטטוס: ${statusText}`, 190, y, { align: "right" });
            }
            
            // Notes
            if (formData.notes) {
                y += 10;
                doc.setFont("OpenSansHebrew", "bold");
                doc.text("הערות:", 190, y, { align: "right" });
                y += 6;
                doc.setFont("OpenSansHebrew", "normal");
                const notesLines = doc.splitTextToSize(formData.notes, 170);
                notesLines.forEach(line => {
                    if (y > 280) {
                        doc.addPage();
                        y = 20;
                    }
                    doc.text(line, 190, y, { align: "right" });
                    y += 6;
                });
            }
            
            // Save PDF
            doc.save(`החזר_הוצאות_${formData.return_number}.pdf`);
            toast.success("PDF נוצר בהצלחה");
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast.error("שגיאה ביצירת PDF");
        }
    };

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

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">פירוט הוצאות</h3>
                <div className="flex gap-2">
                    <Button 
                        type="button" 
                        onClick={generatePDF} 
                        variant="outline" 
                        size="sm"
                    >
                        <FileDown className="w-4 h-4 ml-2" /> ייצא ל-PDF
                    </Button>
                    <Button type="button" onClick={handleAddExpense} size="sm">
                        <Plus className="w-4 h-4 ml-2" /> הוסף הוצאה
                    </Button>
                </div>
            </div>
            
            <Card>
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
                                        <TableHead>סכום מקורי</TableHead>
                                        <TableHead>שער</TableHead>
                                        <TableHead>סכום ₪</TableHead>
                                        <TableHead>תיאור</TableHead>
                                        <TableHead>קובץ</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...formData.expenses]
                                        .sort((a, b) => {
                                            // Sort by business name first
                                            const nameCompare = (a.business_name || '').localeCompare(b.business_name || '');
                                            if (nameCompare !== 0) return nameCompare;
                                            
                                            // Then by date
                                            const dateA = convertDateForSubmission(a.invoice_date);
                                            const dateB = convertDateForSubmission(b.invoice_date);
                                            return dateB.localeCompare(dateA); // Most recent first
                                        })
                                        .map((expense, sortedIndex) => {
                                            // Find the original index in unsorted array
                                            const originalIndex = formData.expenses.indexOf(expense);
                                            const hasIncompleteData = expense.missing_fields && expense.missing_fields.length > 0;
                                            
                                            return (
                                        <TableRow key={originalIndex} className={hasIncompleteData ? 'bg-yellow-50' : ''}>
                                            <TableCell>
                                                <Input 
                                                    value={expense.invoice_date} 
                                                    onChange={e => handleExpenseDateChange(originalIndex, e.target.value)}
                                                    placeholder="dd/mm/yyyy"
                                                    className="w-32"
                                                />
                                                {dateErrors[`expense_${originalIndex}_date`] && (
                                                    <div className="text-xs text-red-600 mt-1">
                                                        {dateErrors[`expense_${originalIndex}_date`]}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.invoice_number} 
                                                    onChange={e => handleExpenseChange(originalIndex, 'invoice_number', e.target.value)}
                                                    placeholder="מספר חשבונית"
                                                    className="w-28"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.business_name} 
                                                    onChange={e => handleExpenseChange(originalIndex, 'business_name', e.target.value)}
                                                    placeholder="שם העסק"
                                                    className="w-32"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select 
                                                    value={expense.purchase_type} 
                                                    onValueChange={val => handleExpenseChange(originalIndex, 'purchase_type', val)}
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
                                                {expense.original_currency && expense.original_currency !== 'ILS' ? (
                                                    <div className="text-sm whitespace-nowrap">
                                                        <span className="font-medium">{expense.original_amount?.toFixed(2) || '0.00'}</span>
                                                        <span className="text-slate-500 mr-1">{expense.original_currency}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {expense.exchange_rate ? (
                                                    <span className="text-sm text-slate-600 font-mono">{expense.exchange_rate.toFixed(4)}</span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={expense.amount} 
                                                    onChange={e => handleExpenseChange(originalIndex, 'amount', parseFloat(parseFloat(e.target.value).toFixed(2)) || 0)}
                                                    className="w-24"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    value={expense.description} 
                                                    onChange={e => handleExpenseChange(originalIndex, 'description', e.target.value)}
                                                    placeholder="תיאור"
                                                    className="w-32"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {expense.receipt_url && (
                                                    <a 
                                                        href={expense.receipt_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                                        title={expense.receipt_file_name || 'צפה בקובץ'}
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {expense.receipt_url && (
                                                        <Button 
                                                            type="button"
                                                            variant="ghost" 
                                                            size="icon"
                                                            onClick={() => reanalyzeExpense(originalIndex)}
                                                            disabled={analyzing}
                                                            title="נתח מחדש את הקובץ המקושר"
                                                        >
                                                            <RefreshCw className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''} text-blue-500`} />
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        type="button"
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleRemoveExpense(originalIndex)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                            );
                                        })}
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
                                    multiple
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="hidden"
                                    id="receipt-upload"
                                />
                                <label htmlFor="receipt-upload">
                                    <Button type="button" variant="outline" disabled={uploading || analyzing} asChild>
                                        <span>
                                            {analyzing ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                                    מנתח...
                                                </>
                                            ) : uploading ? (
                                                <>
                                                    <Upload className="w-4 h-4 ml-2" />
                                                    מעלה...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4 ml-2" />
                                                    העלה קבצים
                                                </>
                                            )}
                                        </span>
                                    </Button>
                                </label>
                                {analyzing && (
                                    <span className="text-sm text-slate-500">מנתח חשבוניות...</span>
                                )}
                                <span className="text-xs text-slate-500">ניתן לבחור מספר קבצים</span>
                            </div>
                        </div>
                        
                        {(formData.receipt_files || []).length > 0 && (
                            <div>
                                <Label>קבצים שהועלו:</Label>
                                <div className="mt-2 space-y-2">
                                    {(formData.receipt_files || []).map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                                {file.name}
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