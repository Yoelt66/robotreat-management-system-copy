import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, Map, Settings, ArrowRight } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          ברוכים הבאים ל-FlowMaster
        </h1>
        <p className="mt-2 text-lg text-gray-600">
          מערכת מאוחדת לניהול מלאי ופעולות שטח.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>ניהול מלאי</CardTitle>
                <CardDescription>סקירה כללית על המלאי</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              צפה בסטטיסטיקות מלאי, התראות על מלאי נמוך, והעברות אחרונות.
            </p>
            <Link to={createPageUrl('StockDashboard')}>
              <Button className="w-full">
                ללוח הבקרה <ArrowRight className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
             <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <Map className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>ניהול שטח</CardTitle>
                <CardDescription>סקירה כללית על פעולות השטח</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
             עקוב אחר קריאות שירות פתוחות, ביצועי טכנאים, וסטטוס עבודות.
            </p>
            <Link to={createPageUrl('FieldDashboard')}>
              <Button className="w-full" variant="outline">
                 ללוח הבקרה <ArrowRight className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
             <div className="flex items-center gap-4">
              <div className="bg-gray-100 p-3 rounded-full">
                <Settings className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <CardTitle>הגדרות מערכת</CardTitle>
                <CardDescription>ניהול כללי של המערכת</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              נהל משתמשים, מחסנים, קטגוריות, הרשאות ועוד.
            </p>
            <Link to={createPageUrl('Settings')}>
              <Button className="w-full" variant="secondary">
                 להגדרות <ArrowRight className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}