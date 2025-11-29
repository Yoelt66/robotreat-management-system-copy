import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ExpenseReturn, User } from '@/entities/all';
import ExpenseReturnList from '../components/expense_returns/ExpenseReturnList';
import ExpenseReturnForm from '../components/expense_returns/ExpenseReturnForm';
import ExpenseReturnDetailsModal from '../components/expense_returns/ExpenseReturnDetailsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

export default function ExpenseReturnsPage() {
    const [returns, setReturns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingReturn, setEditingReturn] = useState(null);
    const [viewingReturn, setViewingReturn] = useState(null);
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
            toast({ variant: "destructive", title: "שגיאה בטעינת החזרות הוצאות" });
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (formData) => {
        try {
            if (editingReturn) {
                await ExpenseReturn.update(editingReturn.id, formData);
                toast({ title: "החזרת הוצאות עודכנה בהצלחה" });
            } else {
                await ExpenseReturn.create(formData);
                toast({ title: "החזרת הוצאות חדשה נוצרה" });
            }
            setShowForm(false);
            setEditingReturn(null);
            await loadData();
        } catch (error) {
            console.error("Failed to save expense return:", error);
            toast({ variant: "destructive", title: "שגיאה בשמירת החזרת ההוצאות" });
        }
    };

    const handleEdit = (ret) => {
        setEditingReturn(ret);
        setShowForm(true);
    };

    const handleView = (ret) => {
        setViewingReturn(ret);
    };
    
    const handleAddNew = () => {
        setEditingReturn(null);
        setShowForm(true);
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
            </div>
        </div>
    );
}