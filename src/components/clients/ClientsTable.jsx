import React from 'react';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  PencilIcon,
  Trash2,
  MoreVertical,
  Settings2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export default function ClientsTable({ clients = [], loading, onEdit, onDelete, showDevices }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white" dir="rtl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>פרטי לקוח</TableHead>
            <TableHead>פרטי התקשרות</TableHead>
            <TableHead>חברה</TableHead>
            <TableHead>תאריך יצירה</TableHead>
            <TableHead className="w-[100px]">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                לא נמצאו לקוחות. הוסף את הלקוח הראשון באמצעות הכפתור למעלה.
              </TableCell>
            </TableRow>
          ) : (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {client.name?.[0]?.toUpperCase() || "ל"}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{client.name}</div>
                      {client.address && (
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <MapPin className="w-4 h-4 ml-1" />
                          {client.address}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {client.phone && (
                      <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 ml-2 text-gray-500" />
                        {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 ml-2 text-gray-500" />
                        {client.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {client.company ? (
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      <Building2 className="w-3 h-3" />
                      {client.company}
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">אין חברה</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-500" dir="ltr">
                    {format(new Date(client.created_date), "dd/MM/yyyy")}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => showDevices(client)}>
                        <Settings2 className="w-4 h-4 ml-2" />
                        ניהול מערכות
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(client)}>
                        <PencilIcon className="w-4 h-4 ml-2" />
                        עריכה
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(client.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        מחיקה
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}