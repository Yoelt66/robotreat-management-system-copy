import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExpenseReturn, User } from '@/entities/all';
import ExpenseReturnList from '../components/expense_returns/ExpenseReturnList';
import ExpenseReturnForm from '../components/expense_returns/ExpenseReturnForm';
import ExpenseReturnDetailsModal from '../components/expense_returns/ExpenseReturnDetailsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function ExpenseReturnsPage() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingReturn, setEditingReturn] = useState(null);
    const [viewingReturn, setViewingReturn] = useState(null);
    const [deletingReturn, setDeletingReturn] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [returnsData, userData] = await Promise.all([
                ExpenseReturn.list('-created_date'),
                User.me()
            ]);
            setReturns(returnsData);
            setCurrentUser(userData);
        } catch (error) {
            console.error("Failed to load expense returns:", error);
            toast.error("שגיאה בטעינת החזרות הוצאות");
        } finally {
            setLoading(false);
        }
    };

    const generateReturnNumber = async () => {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const prefix = `EXPR${month}${year}`;
        
        // Get all returns with the same prefix
        const allReturns = await ExpenseReturn.list();
        const returnsWithPrefix = allReturns.filter(r => r.return_number?.startsWith(prefix));
        
        // Find the highest sequence number
        let maxSequence = 0;
        returnsWithPrefix.forEach(r => {
            const sequencePart = r.return_number.slice(-3);
            const sequence = parseInt(sequencePart, 10);
            if (!isNaN(sequence) && sequence > maxSequence) {
                maxSequence = sequence;
            }
        });
        
        const nextSequence = String(maxSequence + 1).padStart(3, '0');
        return `${prefix}${nextSequence}`;
    };

    const handleFormSubmit = async (formData) => {
        try {
            if (editingReturn) {
                // Update status from temporary to pending when saving
                const updateData = {
                    ...formData,
                    status: formData.status === 'temporary' ? 'pending' : formData.status
                };
                await ExpenseReturn.update(editingReturn.id, updateData);
                toast.success("החזרת הוצאות עודכנה בהצלחה");
            } else {
                const returnNumber = await generateReturnNumber();
                await ExpenseReturn.create({ ...formData, return_number: returnNumber });
                toast.success("החזרת הוצאות חדשה נוצרה");
            }
            setShowForm(false);
            setEditingReturn(null);
            await loadData();
        } catch (error) {
            console.error("Failed to save expense return:", error);
            toast.error("שגיאה בשמירת החזרת ההוצאות");
        }
    };

    const handleEdit = (ret) => {
        setEditingReturn(ret);
        setShowForm(true);
    };

    const handleView = (ret) => {
        setViewingReturn(ret);
    };
    
    const handleAddNew = async () => {
        setEditingReturn(null);
        setShowForm(true);
        
        // Create a temporary expense return
        try {
            const returnNumber = await generateReturnNumber();
            const tempReturn = {
                return_number: returnNumber,
                employee_name: currentUser?.nickname || currentUser?.full_name || '',
                employee_email: currentUser?.email || '',
                status: 'temporary',
                expenses: [],
                total_amount: 0,
                currency: 'ILS',
                submission_date: new Date().toISOString().split('T')[0],
                notes: 'טיוטה - החזר הוצאות זמני'
            };
            
            const created = await ExpenseReturn.create(tempReturn);
            setEditingReturn(created);
            await loadData();
        } catch (error) {
            console.error("Failed to create temporary return:", error);
            toast.error("שגיאה ביצירת החזר הוצאות זמני");
        }
    };

    const handleDelete = async () => {
        if (!deletingReturn) return;
        
        try {
            await ExpenseReturn.delete(deletingReturn.id);
            toast.success("החזרת הוצאות נמחקה בהצלחה");
            setDeletingReturn(null);
            await loadData();
        } catch (error) {
            console.error("Failed to delete expense return:", error);
            toast.error("שגיאה במחיקת החזרת ההוצאות");
        }
    };

    return (
        <div className="p-6" dir="rtl">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">החזרות הוצאות עובדים</h1>
                    <Button onClick={handleAddNew}>
                        <Plus className="w-4 h-4 ml-2" /> החזרת הוצאות חדשה
                    </Button>
                </div>

                <ExpenseReturnList
                    returns={returns}
                    loading={loading}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={setDeletingReturn}
                    currentUser={currentUser}
                />

                <Dialog open={showForm} onOpenChange={setShowForm}>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
                        <DialogHeader>
                            <DialogTitle>
                                {editingReturn ? `עריכת החזרת הוצאות ${editingReturn.return_number}` : 'יצירת החזרת הוצאות חדשה'}
                            </DialogTitle>
                        </DialogHeader>
                        <ExpenseReturnForm
                            initialReturn={editingReturn}
                            currentUser={currentUser}
                            onSubmit={handleFormSubmit}
                            onCancel={() => {
                                setShowForm(false);
                                setEditingReturn(null);
                            }}
                        />
                    </DialogContent>
                </Dialog>

                {viewingReturn && (
                    <ExpenseReturnDetailsModal
                        expenseReturn={viewingReturn}
                        onClose={() => setViewingReturn(null)}
                    />
                )}

                <AlertDialog open={!!deletingReturn} onOpenChange={() => setDeletingReturn(null)}>
                    <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>אישור מחיקה</AlertDialogTitle>
                            <AlertDialogDescription>
                                האם אתה בטוח שברצונך למחוק את החזרת ההוצאות "{deletingReturn?.return_number}"?
                                פעולה זו אינה ניתנת לביטול.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                מחק
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}