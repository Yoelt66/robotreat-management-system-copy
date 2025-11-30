import React, { useState } from "react";
import { Part, Warehouse, Transfer, DeliveryNote, Order, ServiceCall } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Trash2, RefreshCw, Database, Wrench, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";

export default function DatabaseSettings() {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState("");
  const [stats, setStats] = useState({ parts: 0, warehouses: 0, transfers: 0, deliveryNotes: 0, orders: 0, serviceCalls: 0 });
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [migratingParts, setMigratingParts] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  const loadStats = async () => {
    try {
      const results = await Promise.allSettled([
        Part.list(),
        Warehouse.list(),
        Transfer.list(),
        DeliveryNote.list(),
        Order.list(),
        ServiceCall.list()
      ]);

      const [partsResult, warehousesResult, transfersResult, deliveryNotesResult, ordersResult, serviceCallsResult] = results;

      setStats({ 
        parts: partsResult.status === 'fulfilled' ? partsResult.value.length : 0,
        warehouses: warehousesResult.status === 'fulfilled' ? warehousesResult.value.length : 0,
        transfers: transfersResult.status === 'fulfilled' ? transfersResult.value.length : 0,
        deliveryNotes: deliveryNotesResult.status === 'fulfilled' ? deliveryNotesResult.value.length : 0,
        orders: ordersResult.status === 'fulfilled' ? ordersResult.value.length : 0,
        serviceCalls: serviceCallsResult.status === 'fulfilled' ? serviceCallsResult.value.length : 0,
      });

      // Log any errors
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const entityNames = ['Parts', 'Warehouses', 'Transfers', 'DeliveryNotes', 'Orders', 'ServiceCalls'];
          console.error(`Error loading ${entityNames[index]}:`, result.reason);
        }
      });

    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  React.useEffect(() => {
    loadStats();
  }, []);

  const handleMigrateParts = async () => {
    setMigratingParts(true);
    setMigrationResult(null);
    try {
      const response = await base44.functions.invoke('migrateParts');
      const result = response?.data;
      setMigrationResult(result);
      if (result?.success) {
        toast({
          title: "המיגרציה הושלמה בהצלחה!",
          description: `הועברו ${result.stats?.migrated || 0} חלקים למבנה החדש.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "שגיאה במיגרציה",
          description: result?.error || "אירעה שגיאה לא ידועה"
        });
      }
    } catch (error) {
      console.error("Migration error:", error);
      toast({
        variant: "destructive",
        title: "שגיאה במיגרציה",
        description: error.message
      });
    } finally {
      setMigratingParts(false);
    }
  };

  const handleCleanDuplicateServiceCalls = async () => {
    setCleaningDuplicates(true);
    setProgress(0);
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
        const allCalls = await ServiceCall.list();
        const groups = new Map();

        for (const call of allCalls) {
            if (!call.call_number) continue;
            if (!groups.has(call.call_number)) {
                groups.set(call.call_number, []);
            }
            groups.get(call.call_number).push(call);
        }

        const duplicatesToDelete = [];
        for (const group of groups.values()) {
            if (group.length > 1) {
                // Sort by updated_date, most recent first
                group.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
                // The first one is kept, the rest are deleted
                duplicatesToDelete.push(...group.slice(1));
            }
        }

        if (duplicatesToDelete.length === 0) {
            toast({ title: "לא נמצאו כפילויות", description: "כל קריאות השירות עם מספר קריאה הן ייחודיות." });
            setCleaningDuplicates(false);
            setShowDuplicateConfirm(false);
            return;
        }

        for (let i = 0; i < duplicatesToDelete.length; i++) {
            await ServiceCall.delete(duplicatesToDelete[i].id);
            await sleep(300); // Increased delay to prevent rate limiting
            setProgress(Math.round(((i + 1) / duplicatesToDelete.length) * 100));
        }

        toast({
            title: "הניקוי הושלם בהצלחה!",
            description: `נמחקו ${duplicatesToDelete.length} קריאות שירות כפולות.`,
        });
        await loadStats();

    } catch (error) {
        console.error("Error cleaning duplicate service calls:", error);
        toast({ variant: "destructive", title: "שגיאה בניקוי כפילויות", description: error.message });
    } finally {
        setCleaningDuplicates(false);
        setShowDuplicateConfirm(false);
        setProgress(0);
    }
  };

  const handleClearDatabase = async () => {
    setLoading(true);
    setProgress(0);
    setResult("");
    
    try {
      // Get all records using Promise.allSettled to handle potential errors
      setProgress(10);
      const results = await Promise.allSettled([
        Part.list(),
        Warehouse.list(),
        Transfer.list(),
        DeliveryNote.list(),
        Order.list(),
        ServiceCall.list()
      ]);

      const [partsResult, warehousesResult, transfersResult, deliveryNotesResult, ordersResult, serviceCallsResult] = results;
      
      const allParts = partsResult.status === 'fulfilled' ? partsResult.value : [];
      const allWarehouses = warehousesResult.status === 'fulfilled' ? warehousesResult.value : [];
      const allTransfers = transfersResult.status === 'fulfilled' ? transfersResult.value : [];
      const allDeliveryNotes = deliveryNotesResult.status === 'fulfilled' ? deliveryNotesResult.value : [];
      const allOrders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
      const allServiceCalls = serviceCallsResult.status === 'fulfilled' ? serviceCallsResult.value : [];

      let deletedParts = 0;
      let deletedWarehouses = 0;
      let deletedTransfers = 0;
      let deletedDeliveryNotes = 0;
      let deletedOrders = 0;
      let deletedServiceCalls = 0;
      let errors = 0;

      // Delete service calls (independent)
      setProgress(15);
      for (let i = 0; i < allServiceCalls.length; i++) {
        try {
          await ServiceCall.delete(allServiceCalls[i].id);
          deletedServiceCalls++;
          setProgress(15 + Math.floor((i / allServiceCalls.length) * 5));
        } catch (error) {
          console.error(`Error deleting service call ${allServiceCalls[i].id}:`, error);
          errors++;
        }
      }

      // Delete delivery notes first (dependent on other entities)
      setProgress(20);
      for (let i = 0; i < allDeliveryNotes.length; i++) {
        try {
          await DeliveryNote.delete(allDeliveryNotes[i].id);
          deletedDeliveryNotes++;
          setProgress(20 + Math.floor((i / allDeliveryNotes.length) * 15));
        } catch (error) {
          console.error(`Error deleting delivery note ${allDeliveryNotes[i].id}:`, error);
          errors++;
        }
      }

      // Delete orders
      setProgress(35);
      for (let i = 0; i < allOrders.length; i++) {
        try {
          await Order.delete(allOrders[i].id);
          deletedOrders++;
          setProgress(35 + Math.floor((i / allOrders.length) * 15));
        } catch (error) {
          console.error(`Error deleting order ${allOrders[i].id}:`, error);
          errors++;
        }
      }

      // Delete transfers
      setProgress(50);
      for (let i = 0; i < allTransfers.length; i++) {
        try {
          await Transfer.delete(allTransfers[i].id);
          deletedTransfers++;
          setProgress(50 + Math.floor((i / allTransfers.length) * 20));
        } catch (error) {
          console.error(`Error deleting transfer ${allTransfers[i].id}:`, error);
          errors++;
        }
      }

      // Delete parts (contains stock data now)
      setProgress(70);
      for (let i = 0; i < allParts.length; i++) {
        try {
          await Part.delete(allParts[i].id);
          deletedParts++;
          setProgress(70 + Math.floor((i / allParts.length) * 20));
        } catch (error) {
          console.error(`Error deleting part ${allParts[i].id}:`, error);
          errors++;
        }
      }

      // Delete warehouses last
      setProgress(90);
      for (let i = 0; i < allWarehouses.length; i++) {
        try {
          await Warehouse.delete(allWarehouses[i].id);
          deletedWarehouses++;
          setProgress(90 + Math.floor((i / allWarehouses.length) * 10));
        } catch (error) {
          console.error(`Error deleting warehouse ${allWarehouses[i].id}:`, error);
          errors++;
        }
      }

      setProgress(100);
      setResult(`
        נמחקו בהצלחה:
        • ${deletedServiceCalls} קריאות שירות
        • ${deletedParts} פריטים
        • ${deletedWarehouses} מחסנים
        • ${deletedTransfers} רשומות העברה
        • ${deletedDeliveryNotes} תעודות משלוח
        • ${deletedOrders} הזמנות
        ${errors > 0 ? `• ${errors} שגיאות` : ''}
      `);

      // Reload stats
      await loadStats();
      
    } catch (error) {
      console.error("Error clearing database:", error);
      setResult(`שגיאה במחיקת המידע: ${error.message}`);
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>אזהרה!</strong> פעולות מחיקת מסד נתונים הן בלתי הפיכות. השתמש בזהירות רבה.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            סטטיסטיקות מסד נתונים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
             <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.serviceCalls}</div>
              <div className="text-sm text-gray-500">קריאות שירות</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.parts}</div>
              <div className="text-sm text-gray-600">פריטים</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.warehouses}</div>
              <div className="text-sm text-gray-600">מחסנים</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.transfers}</div>
              <div className="text-sm text-gray-600">העברות</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.deliveryNotes}</div>
              <div className="text-sm text-gray-600">תעודות משלוח</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.orders}</div>
              <div className="text-sm text-gray-600">הזמנות</div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={loadStats}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              רענן סטטיסטיקות
            </Button>
            
            <Button
              variant="destructive"
              onClick={() => setShowConfirmDialog(true)}
              disabled={loading || (stats.parts === 0 && stats.warehouses === 0 && stats.transfers === 0 && stats.deliveryNotes === 0 && stats.orders === 0 && stats.serviceCalls === 0)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              מחק את כל הנתונים
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            מיגרציה לארכיטקטורה החדשה
          </CardTitle>
          <CardDescription>
            העברת נתוני חלקים מהטבלה הישנה (Part) לארבעת הטבלאות החדשות (PartCore, PartPricing, PartSupplier, PartStock).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="default"
            onClick={handleMigrateParts}
            disabled={migratingParts}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {migratingParts ? 'מעביר נתונים...' : 'התחל מיגרציית חלקים'}
          </Button>
          
          {migrationResult && (
            <Alert variant={migrationResult.success ? 'default' : 'destructive'}>
              <AlertDescription>
                {migrationResult.success ? (
                  <div>
                    <p className="font-medium">מיגרציה הושלמה!</p>
                    <ul className="list-disc list-inside mt-2">
                      <li>סה"כ חלקים: {migrationResult.stats?.total}</li>
                      <li>הועברו: {migrationResult.stats?.migrated}</li>
                      <li>דולגו (כבר קיימים): {migrationResult.stats?.skipped}</li>
                      <li>שגיאות: {migrationResult.stats?.errors}</li>
                    </ul>
                    {migrationResult.errors?.length > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        <p>שגיאות:</p>
                        {migrationResult.errors.map((err, i) => (
                          <p key={i}>{err.sku}: {err.error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{migrationResult.error}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-green-600" />
            תחזוקת נתונים - קריאות שירות
          </CardTitle>
           <CardDescription>
            פעולות לניקוי ותיקון נתונים הקשורים לקריאות שירות.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Button
              variant="outline"
              onClick={() => setShowDuplicateConfirm(true)}
              disabled={cleaningDuplicates}
            >
              {cleaningDuplicates ? 'מנקה כפילויות...' : 'נקה קריאות שירות כפולות'}
            </Button>
             {cleaningDuplicates && <Progress value={progress} className="mt-2" />}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>מוחק נתונים...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Alert variant={result.includes('שגיאה') ? 'destructive' : 'default'}>
          <AlertDescription>
            <pre className="whitespace-pre-wrap">{result}</pre>
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              אישור מחיקת מסד נתונים
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>האם אתה בטוח שברצונך למחוק את כל הנתונים?</p>
                <p className="font-medium">זה יכלול:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{stats.serviceCalls} קריאות שירות</li>
                  <li>{stats.parts} פריטים</li>
                  <li>{stats.warehouses} מחסנים</li>
                  <li>{stats.transfers} העברות</li>
                  <li>{stats.deliveryNotes} תעודות משלוח</li>
                  <li>{stats.orders} הזמנות</li>
                </ul>
                <p className="text-red-600 font-medium">
                  פעולה זו בלתי הפיכה!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearDatabase}
              className="bg-red-600 hover:bg-red-700"
            >
              כן, מחק הכל
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={showDuplicateConfirm} onOpenChange={setShowDuplicateConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור ניקוי כפילויות</AlertDialogTitle>
            <AlertDialogDescription>
                פעולה זו תחפש קריאות שירות עם אותו 'מספר קריאה'. עבור כל קבוצת כפילויות, היא תשמור את הרשומה המעודכנת ביותר ותמחק את השאר.
                <br/><br/>
                <strong>האם אתה בטוח שברצונך להמשיך? פעולה זו בלתי הפיכה.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanDuplicateServiceCalls}
              className="bg-orange-500 hover:bg-orange-600"
            >
              כן, נקה כפילויות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}