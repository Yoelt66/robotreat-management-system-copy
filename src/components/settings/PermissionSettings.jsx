
import React, { useState, useEffect } from 'react';
import { AppSetting } from '@/entities/AppSetting';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ShieldCheck, Eye, Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const PERMISSIONS_KEY = 'user_permissions';

const defaultPermissions = {
  Dashboard: { view: true, edit: false, name: 'לוח בקרה' },
  Parts: { view: true, edit: false, name: 'פריטים' },
  StockPage: { view: true, edit: false, name: 'מלאי' },
  Prices: { view: true, edit: false, name: 'מחירים' },
  Transfers: { view: true, edit: false, name: 'העברות' },
  NewOrders: { view: true, edit: true, name: 'הזמנה חדשה' },
  Orders: { view: true, edit: false, name: 'רשימת הזמנות' },
  DeliveryNotes: { view: true, edit: true, name: 'תעודות משלוח' },
  ExpenseReturns: { view: true, edit: true, name: 'החזר הוצאות עובד' },
  History: { view: true, edit: false, name: 'היסטוריה' },
  Import: { view: false, edit: false, name: 'ייבוא מקובץ' },
  Welcome: { view: true, edit: true, name: 'דף פרופיל' },
};

export default function PermissionSettings() {
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [loading, setLoading] = useState(true);
  const [settingId, setSettingId] = useState(null);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const settings = await AppSetting.filter({ key: PERMISSIONS_KEY });
        if (settings && settings.length > 0) {
          setSettingId(settings[0].id);
          // Merge saved settings with defaults to handle new pages
          setPermissions(prev => ({ ...defaultPermissions, ...settings[0].value })); // Use defaultPermissions here to ensure new keys are added
        } else {
          setPermissions(defaultPermissions); // No settings saved yet, use full defaults
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        toast({
          variant: 'destructive',
          title: 'שגיאה בטעינת הרשאות',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  const handlePermissionChange = (page, type, value) => {
    setPermissions(prev => ({
      ...prev,
      [page]: { ...prev[page], [type]: value },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const dataToSave = {
        key: PERMISSIONS_KEY,
        value: permissions,
      };

      if (settingId) {
        await AppSetting.update(settingId, dataToSave);
      } else {
        await AppSetting.create(dataToSave);
      }
      toast({ title: 'ההרשאות נשמרו בהצלחה' });
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        variant: 'destructive',
        title: 'שגיאה בשמירת הרשאות',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !Object.keys(permissions).length) {
    return <div>טוען...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות הרשאה למשתמשים</CardTitle>
        <CardDescription>
          קבע אילו עמודים ופעולות משתמשים שאינם מנהלים יכולים לגשת אליהם.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-semibold border-b pb-2">
            <div className="md:col-span-1">שם העמוד</div>
            <div className="flex items-center justify-center gap-2"><Eye className="h-4 w-4" /> צפייה</div>
            <div className="flex items-center justify-center gap-2"><Pencil className="h-4 w-4" /> עריכה</div>
        </div>

        {Object.entries(permissions).map(([pageKey, pagePermissions]) => (
          <div key={pageKey} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-2 rounded-md hover:bg-gray-50">
            <Label className="font-medium md:col-span-1">{pagePermissions.name}</Label>
            <div className="flex items-center justify-center">
              <Switch
                checked={pagePermissions.view}
                onCheckedChange={(checked) => handlePermissionChange(pageKey, 'view', checked)}
              />
            </div>
            <div className="flex items-center justify-center">
               <Switch
                checked={pagePermissions.edit}
                onCheckedChange={(checked) => handlePermissionChange(pageKey, 'edit', checked)}
              />
            </div>
          </div>
        ))}

         <Alert className="mt-6">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>הערה חשובה</AlertTitle>
            <AlertDescription>
                שינויים אלה יחולו על כל המשתמשים שאינם מנהלים. דף ההגדרות וניהול המשתמשים תמיד זמינים למנהלים בלבד.
            </AlertDescription>
        </Alert>

      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'שומר...' : 'שמור הרשאות'}
        </Button>
      </CardFooter>
    </Card>
  );
}
