
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = {
  repair: '#3b82f6', // blue
  inspection: '#8b5cf6', // purple
  maintenance: '#22c55e', // green
  parts: '#f97316', // orange
  emergency: '#ef4444', // red
  installation: '#0ea5e9', // sky blue
  other: '#9ca3af' // gray
};

// Hebrew service type names
const serviceTypeLabels = {
  repair: 'תקלה',
  inspection: 'תקלה חוזרת',
  maintenance: 'טיפול',
  parts: 'חלקים',
  emergency: 'חירום',
  installation: 'התקנה',
  other: 'אחר'
};

export default function ServiceTypeChart({ calls = [], loading }) {
  // Ensure we're working with a valid array
  const safeCallsArray = Array.isArray(calls) ? calls : [];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>התפלגות סוגי קריאות</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-[300px]" />
        </CardContent>
      </Card>
    );
  }

  // If there are no calls or it's not an array, show an empty state
  if (safeCallsArray.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>התפלגות סוגי קריאות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            אין נתונים להצגה
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create a safe count of service types
  const typeCounts = safeCallsArray.reduce((acc, call) => {
    if (call && call.service_type) {
      acc[call.service_type] = (acc[call.service_type] || 0) + 1;
    } else {
      // Handle calls without a service_type
      acc['other'] = (acc['other'] || 0) + 1;
    }
    return acc;
  }, {});

  // Transform into chart data with safety checks
  const data = Object.entries(typeCounts).map(([name, value]) => ({
    name: (serviceTypeLabels[name] || name),
    value,
    originalName: name // Keep original name for color lookup
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>התפלגות סוגי קריאות</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.originalName] || '#888888'} 
                    />
                  ))}
                </Pie>
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              אין נתוני סוגי קריאות זמינים
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
