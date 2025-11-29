
import React, { useState, useEffect } from 'react';
import { Transfer } from '@/entities/Transfer';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeftRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// Helper function to add delays between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function RecentTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTransfers = async () => {
      try {
        // Add delay to avoid rate limiting
        await delay(1000);
        
        // Fetch recent transfers (most recent first, limited to 5)
        const transfersData = await Transfer.list("-created_date", 5);
        setTransfers(transfersData);
        setError("");
      } catch (err) {
        console.error("Error loading transfers:", err);
        
        // If it's a rate limit error, show a more helpful message
        if (err.message && err.message.includes('429')) {
          setError("טעינת נתוני העברות נדחתה זמנית - יותר מדי בקשות. אנא רענן את הדף בעוד מספר שניות.");
        } else {
          setError("אירעה שגיאה בטעינת נתוני ההעברות");
        }
      } finally {
        setLoading(false);
      }
    };

    loadTransfers();
  }, []);

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: "בהמתנה", className: "bg-yellow-100 text-yellow-800" },
      in_transit: { label: "בהעברה", className: "bg-blue-100 text-blue-800" },
      completed: { label: "הושלם", className: "bg-green-100 text-green-800" }
    };
    
    const { label, className } = statusMap[status] || { label: status, className: "" };
    
    return <Badge className={className}>{label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>העברות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            טוען העברות...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>העברות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (transfers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>העברות אחרונות</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            לא נמצאו העברות אחרונות
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5" />
          העברות אחרונות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">מספר העברה</TableHead>
              <TableHead className="text-center">ממחסן</TableHead>
              <TableHead className="text-center">למחסן</TableHead>
              <TableHead className="text-center">פריטים</TableHead>
              <TableHead className="text-center">תאריך</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map(transfer => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium text-center">
                  <Link 
                    to={createPageUrl("Transfers")} 
                    className="text-blue-600 hover:underline"
                  >
                    {transfer.transfer_number || `TRF-${transfer.id.substring(0, 6)}`}
                  </Link>
                </TableCell>
                <TableCell className="text-center">{transfer.from_warehouse_name}</TableCell>
                <TableCell className="text-center">{transfer.to_warehouse_name}</TableCell>
                <TableCell className="text-center">{transfer.items?.length || 0}</TableCell>
                <TableCell className="text-center">
                  {new Date(transfer.created_date).toLocaleDateString('he-IL')}
                </TableCell>
                <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 text-center">
          <Link to={createPageUrl("Transfers")}>
            <span className="text-sm text-blue-600 hover:underline">
              לכל ההעברות
            </span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
