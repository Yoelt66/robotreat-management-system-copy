import React, { useState, useEffect } from "react";
import { Transfer } from "@/entities/Transfer";
import { Warehouse } from "@/entities/Warehouse";
import { SystemLog } from "@/entities/SystemLog";
import { User } from "@/entities/User";
import { getParts } from "@/functions/getParts";
import { updatePartStock } from "@/functions/updatePartStock";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";

import TransfersList from "../components/transfers/TransfersList";
import TransferForm from "../components/transfers/TransferForm";
import TransferMigration from "../components/transfers/TransferMigration";
import TransferDetailsModal from "../components/transfers/TransferDetailsModal";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [parts, setParts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [viewingTransfer, setViewingTransfer] = useState(null);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [transferToDelete, setTransferToDelete] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
    loadUser();

    const checkMigrationNeeded = async () => {
      try {
        const allTransfers = await Transfer.list();
        const needsMigration = allTransfers.some(t =>
          !t.transfer_number ||
          (t.items && t.items.some(item => item.part_id && !item.part_sku))
        );
        setNeedsMigration(needsMigration);
      } catch (error) {
        console.error("Error checking for migration:", error);
      }
    };

    checkMigrationNeeded();
  }, []);

  const loadUser = async () => {
    try {
        const user = await User.me();
        setCurrentUser(user);
    } catch (e) {
        console.error("Failed to load user", e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Add delays between API calls to avoid rate limiting
      let transfersData = [];
      let warehousesData = [];
      let partsData = [];
      let usersData = [];

      try {
        transfersData = await Transfer.list("-created_date");
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Error loading transfers:", error);
      }

      try {
        warehousesData = await Warehouse.list();
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Error loading warehouses:", error);
      }

      try {
        const partsResponse = await getParts();
        partsData = partsResponse?.data?.data || [];
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Error loading parts:", error);
      }

      try {
        usersData = await User.list();
      } catch (error) {
        console.error("Error loading users:", error);
        usersData = [];
      }

      const userMap = new Map(usersData.map(user => [user.email, user.nickname || user.full_name]));

      const enrichedTransfers = transfersData.map(transfer => {
        const enrichedItems = transfer.items?.map(item => {
          const part = partsData.find(p => p.sku === item.part_sku);
          return {
            ...item,
            part_name: part ? part.name : null,
            sku: item.part_sku
          };
        });

        const creatorName = userMap.get(transfer.created_by) || transfer.created_by;

        return {
          ...transfer,
          items: enrichedItems || [],
          creator_nickname: creatorName,
        };
      });

      setTransfers(enrichedTransfers);
      setWarehouses(warehousesData);
      setParts(partsData);
    } catch (error) {
      console.error("Error loading data:", error);
      
      // More specific error handling for rate limits
      if (error.message && error.message.includes('429')) {
        console.error("Rate limit exceeded, please wait before making more requests");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTransferCreation = async (transferData) => {
    setLoading(true);
    try {
      // Create the transfer record only - don't update stock yet
      await Transfer.create(transferData);

      await loadData();
      setShowForm(false);
    } catch (error) {
      console.error("Error creating transfer:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStockForTransfer = async (transfer) => {
    // Find warehouses
    const fromWarehouse = warehouses.find(w => w.name === transfer.from_warehouse_name);
    const toWarehouse = warehouses.find(w => w.name === transfer.to_warehouse_name);

    if (!fromWarehouse || !toWarehouse) {
      throw new Error("Warehouse not found");
    }

    for (const item of transfer.items) {
      // Find the part using part_sku
      const part = parts.find(p => p.sku === item.part_sku);
      if (!part) continue;

      // Get current warehouse quantities directly from the part record
      const currentFromQty = part[fromWarehouse.warehouse_id] || 0;
      const currentToQty = part[toWarehouse.warehouse_id] || 0;

      const newFromQty = currentFromQty - item.quantity;
      const newToQty = currentToQty + item.quantity;

      // Update the part stock for both warehouses using backend function
      await updatePartStock({ 
        sku: part.sku, 
        warehouse_id: fromWarehouse.warehouse_id, 
        quantity: newFromQty 
      });
      await updatePartStock({ 
        sku: part.sku, 
        warehouse_id: toWarehouse.warehouse_id, 
        quantity: newToQty 
      });

      // Log history
      if (currentUser && part) {
          await SystemLog.create({
              user_email: currentUser.email,
              user_nickname: currentUser.nickname || currentUser.full_name,
              action_type: 'STOCK_TRANSFER',
              entity_type: 'Part',
              entity_identifier: item.part_sku,
              description: `העברת מלאי: ${item.quantity} יח' מ-${fromWarehouse.name} ל-${toWarehouse.name} (העברה ${transfer.transfer_number})`,
              details: { 
                  from_warehouse: fromWarehouse.name, 
                  to_warehouse: toWarehouse.name, 
                  quantity: item.quantity,
                  transfer_number: transfer.transfer_number
              }
          });
      }
    }
  };

  const handleStatusUpdate = async (transferId, newStatus) => {
    setLoading(true);
    try {
      const transfer = transfers.find(t => t.id === transferId);

      if (!transfer) {
        console.error("Transfer not found:", transferId);
        return;
      }

      // If completing the transfer, update stock levels
      if (newStatus === 'completed' && transfer.status !== 'completed') {
        await updateStockForTransfer(transfer);
      }

      await Transfer.update(transferId, {
        status: newStatus,
        transfer_number: transfer.transfer_number || `TRF-${transferId.substring(0, 6)}`
      });
      
      if(currentUser && transfer.status !== newStatus) {
         await SystemLog.create({
            user_email: currentUser.email,
            user_nickname: currentUser.nickname || currentUser.full_name,
            action_type: 'STATUS_CHANGE',
            entity_type: 'Transfer',
            entity_identifier: transfer.transfer_number,
            description: `שינה סטטוס העברה ${transfer.transfer_number} ל-'${newStatus}'`,
            details: { from: transfer.status, to: newStatus }
        });
      }

      await loadData();
    } catch (error) {
      console.error("Error updating transfer status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTransfer = (transfer) => {
    setViewingTransfer(transfer);
  };

  const handleEditTransfer = (transfer) => {
    setViewingTransfer(null);
    const formData = {
      ...transfer,
      items: transfer.items || []
    };

    setEditingTransfer(formData);
    setShowForm(true);
  };

  const handleUpdateTransfer = async (transferData) => {
    setLoading(true);
    try {
      await Transfer.update(editingTransfer.id, transferData);
      setShowForm(false);
      setEditingTransfer(null);
      await loadData();
      toast({ title: "העברה עודכנה בהצלחה" });
    } catch (error) {
      console.error("Error updating transfer:", error);
      toast({ variant: "destructive", title: "שגיאה בעדכון העברה" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!transferToDelete) return;
    setLoading(true);
    try {
      await Transfer.delete(transferToDelete.id);
      setTransferToDelete(null);
      setShowForm(false);
      setEditingTransfer(null);
      await loadData();
      toast({ title: "העברה נמחקה בהצלחה" });
    } catch (error) {
      console.error("Error deleting transfer:", error);
      toast({ variant: "destructive", title: "שגיאה במחיקת העברה" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h1 className="text-2xl font-bold">העברות מלאי</h1>
          <Button onClick={() => {
            setEditingTransfer(null);
            setShowForm(true);
          }} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" /> העברה חדשה
          </Button>
        </div>

        {needsMigration && <TransferMigration />}

        <Dialog open={showForm} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowForm(false);
            setEditingTransfer(null);
          }
        }}>
          <DialogContent className="max-w-4xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                {editingTransfer ? `עריכת העברה ${editingTransfer.transfer_number}` : 'העברת מלאי חדשה'}
              </DialogTitle>
            </DialogHeader>
            <TransferForm
              warehouses={warehouses}
              stocks={[]} // Pass empty array instead of undefined stocks
              transfer={editingTransfer}
              onSubmit={editingTransfer ? handleUpdateTransfer : handleTransferCreation}
              onCancel={() => {
                setShowForm(false);
                setEditingTransfer(null);
              }}
              onDelete={(transfer) => setTransferToDelete(transfer)}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!transferToDelete} onOpenChange={() => setTransferToDelete(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>אישור מחיקת העברה</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את העברה מספר {transferToDelete?.transfer_number}?
                פעולה זו היא בלתי הפיכה.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTransfer} className="bg-red-600 hover:bg-red-700">
                <Trash2 className="h-4 w-4 ml-2" />
                מחק
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <TransfersList
          transfers={transfers}
          onStatusUpdate={handleStatusUpdate}
          onViewTransfer={handleViewTransfer}
        />

        {viewingTransfer && (
          <TransferDetailsModal
            transfer={viewingTransfer}
            onClose={() => setViewingTransfer(null)}
            onEdit={handleEditTransfer}
          />
        )}
      </div>
    </div>
  );
}