import React from 'react';
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowUpRight } from "lucide-react";

const colorVariants = {
  blue: "text-blue-600 bg-blue-100",
  green: "text-green-600 bg-green-100",
  yellow: "text-yellow-600 bg-yellow-100",
  red: "text-red-600 bg-red-100"
};

export default function StatsCard({ title, value, icon: Icon, color = "blue", trend }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className={`w-12 h-12 rounded-lg ${colorVariants[color]} flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className="flex items-center text-green-600 text-sm">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              {trend}
            </div>
          )}
        </div>
        <div className="mt-3">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
      </CardHeader>
    </Card>
  );
}