import React, { useState, useEffect } from "react";
import { User, Category, Currency } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CategorySettings from "../components/settings/CategorySettings";
import CurrencySettings from "../components/settings/CurrencySettings";
import SupplierSettings from "../components/settings/SupplierSettings";
import UserManagement from "../components/settings/UserManagement";
import GeneralSettings from "../components/settings/GeneralSettings";
import WarehouseSettings from "../components/settings/WarehouseSettings";
import UnitSettings from "../components/settings/UnitSettings";
import PermissionSettings from "../components/settings/PermissionSettings";
import DatabaseSettings from "../components/settings/DatabaseSettings";
import ImportSettings from "../components/settings/ImportSettings";
import UnitBrandSettings from "../components/settings/UnitBrandSettings";
import SupplierAliasManager from "../components/settings/SupplierAliasManager";

export default function Settings() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkUserAccess();
  }, []);

  const checkUserAccess = async () => {
    try {
      const user = await User.me();
      if (user.role !== 'admin') {
        setError("גישה לדף זה מוגבלת למנהלי מערכת בלבד");
      }
      setCurrentUser(user);
    } catch (error) {
      setError("אירעה שגיאה בטעינת פרטי המשתמש");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">טוען...</div>
        </div>
      </div>
    );
  }

  if (error || !currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "אין לך הרשאות לצפות בדף זה"}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">הגדרות מערכת</h1>
          <div className="text-sm text-gray-500">
            מחובר כמנהל: {currentUser.full_name}
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="w-full justify-start border-b overflow-x-auto">
            <TabsTrigger value="general">הגדרות כלליות</TabsTrigger>
            <TabsTrigger value="warehouses">מחסנים</TabsTrigger>
            <TabsTrigger value="suppliers">ספקים</TabsTrigger>
            <TabsTrigger value="supplier-aliases">כינויי ספקים</TabsTrigger>
            <TabsTrigger value="users">ניהול משתמשים</TabsTrigger>
            <TabsTrigger value="permissions">הרשאות משתמשים</TabsTrigger>
            <TabsTrigger value="categories">קטגוריות</TabsTrigger>
            <TabsTrigger value="units">יחידות מידה</TabsTrigger>
            <TabsTrigger value="currencies">מטבעות</TabsTrigger>
            <TabsTrigger value="import">הגדרות ייבוא</TabsTrigger>
            <TabsTrigger value="brands">מותגי יחידות</TabsTrigger>
            <TabsTrigger value="database">מסד נתונים</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="warehouses" className="space-y-4">
            <WarehouseSettings />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SupplierSettings />
          </TabsContent>

          <TabsContent value="supplier-aliases" className="space-y-4">
            <SupplierAliasManager />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <PermissionSettings />
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <CategorySettings />
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <UnitSettings />
          </TabsContent>

          <TabsContent value="currencies" className="space-y-4">
            <CurrencySettings />
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <ImportSettings />
          </TabsContent>

          <TabsContent value="brands" className="space-y-4">
            <UnitBrandSettings />
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <DatabaseSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}