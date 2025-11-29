import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { AppSetting } from "@/entities/AppSetting";

export default function GeneralSettings() {
  const [settings, setSettings] = useState({
    companyName: "",
    enableNotifications: true,
    enableAutoNumbering: true,
    defaultCurrency: "ILS",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsData = await AppSetting.filter({ key: 'general_settings' });
      if (settingsData && settingsData.length > 0) {
        setSettings(prev => ({ ...prev, ...settingsData[0].value }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingSettings = await AppSetting.filter({ key: 'general_settings' });
      
      if (existingSettings && existingSettings.length > 0) {
        // Update existing settings
        await AppSetting.update(existingSettings[0].id, {
          key: 'general_settings',
          value: settings
        });
      } else {
        // Create new settings
        await AppSetting.create({
          key: 'general_settings',
          value: settings
        });
      }

      toast({
        title: "הגדרות נשמרו",
        description: "ההגדרות עודכנו בהצלחה",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת ההגדרות",
        description: "אנא נסה שנית",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="text-center">טוען הגדרות...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות כלליות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName">שם החברה</Label>
          <Input
            id="companyName"
            value={settings.companyName}
            onChange={(e) => handleInputChange('companyName', e.target.value)}
            placeholder="הזן שם החברה"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">מטבע ברירת מחדל</Label>
          <Input
            id="defaultCurrency"
            value={settings.defaultCurrency}
            onChange={(e) => handleInputChange('defaultCurrency', e.target.value)}
            placeholder="ILS"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="notifications">התראות מערכת</Label>
          <Switch
            id="notifications"
            checked={settings.enableNotifications}
            onCheckedChange={(checked) => handleInputChange('enableNotifications', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="autoNumbering">מספור אוטומטי לפריטים</Label>
          <Switch
            id="autoNumbering"
            checked={settings.enableAutoNumbering}
            onCheckedChange={(checked) => handleInputChange('enableAutoNumbering', checked)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </Button>
      </CardContent>
    </Card>
  );
}