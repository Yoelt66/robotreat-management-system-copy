import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Info, 
  AlertCircle,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Eye,
  History,
  X
} from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Part } from "@/entities/Part";
import { Warehouse } from "@/entities/Warehouse";
import { SystemLog } from "@/entities/SystemLog";
import { User } from "@/entities/User";

import PartForm from "../components/parts/PartForm";

const getCategoryDisplay = (category) => {
  const fallbackCategories = {
    electronics: { label: "אלקטרוניקה", color: "bg-blue-100 text-blue-800" },
    mechanical: { label: "מכני", color: "bg-orange-100 text-orange-800" },
    tools: { label: "כלי עבודה", color: "bg-purple-100 text-purple-800" },
    consumables: { label: "מתכלים", color: "bg-green-100 text-green-800" },
    raw_materials: { label: "חומרי גלם", color: "bg-yellow-100 text-yellow-800" },
    finished_goods: { label: "מוצרים מוגמרים", color: "bg-indigo-100 text-indigo-800" },
    other: { label: "אחר", color: "bg-gray-100 text-gray-800" }
  };

  return fallbackCategories[category] || { label: category, color: "bg-gray-100 text-gray-800" };
};

const getUnitDisplay = (unit) => {
  const units = {
    "pieces": "יחידות",
    "kg": "ק״ג", 
    "liters": "ליטרים",
    "meters": "מטרים",
    "boxes": "קופסאות",
    "pairs": "זוגות"
  };
  return units[unit] || unit;
};

export default function ItemsManagement() {
  const [parts, setParts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'sku', direction: 'asc' });
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedPartSku, setSelectedPartSku] = useState(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    loadUser();
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
    setError('');
    try {
      const [
        partsData,
        warehousesData,
        systemLogsData,
      ] = await Promise.all([
        Part.list().catch(e => { console.error("Error loading parts:", e); return []; }),
        Warehouse.list().catch(e => { console.error("Error loading warehouses:", e); return []; }),
        SystemLog.list('-created_date').catch(e => { console.warn("Could not load system logs:", e); return []; }),
      ]);
      
      setParts(partsData || []);
      setWarehouses((warehousesData || []).sort((a, b) => (a.number || 0) - (b.number || 0)));
      setSystemLogs(systemLogsData || []);

    } catch (error) {
      console.error("General error loading data:", error);
      setError('אירעה שגיאה כללית בטעינת נתונים');
      toast({
        variant: "destructive",
        title: "שגיאה בטעינת נתונים",
        description: "אירעה שגיאה בטעינת נתונים. אנא נסה לרענן את הדף.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCalculatedSalePrice = (part) => {
    if (part.is_manual && part.manual_sale_price) {
      return part.manual_sale_price;
    }

    if (!part.cost_price) return 0;

    const costInTargetCurrency = part.cost_price * (part.exchange_rate || 1);
    const costWithImport = costInTargetCurrency * (1 + (part.import_percentage || 0) / 100);
    const salePrice = costWithImport * (1 + (part.markup_percentage || 0) / 100);
    
    return Math.round(salePrice * 100) / 100;
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedParts = React.useMemo(() => {
    let filtered = parts.filter(part => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        part.sku?.toLowerCase().includes(searchLower) ||
        part.name?.toLowerCase().includes(searchLower) ||
        part.current_location?.toLowerCase().includes(searchLower)
      );
      
      if (selectedPartSku) {
        return part.sku === selectedPartSku && matchesSearch;
      }
      
      return matchesSearch;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const strA = String(aValue || '').toLowerCase();
        const strB = String(bValue || '').toLowerCase();
        
        return sortConfig.direction === 'asc' ? strA.localeCompare(strB, 'he') : strB.localeCompare(strA, 'he');
      });
    }

    return filtered;
  }, [parts, searchTerm, sortConfig, selectedPartSku]);

  const getPartHistory = (sku) => {
    return systemLogs.filter(log => 
      log.entity_identifier === sku || 
      (log.description && log.description.includes(sku))
    ).slice(0, 10);
  };

  const handleSkuClick = (sku) => {
    setSelectedPartSku(selectedPartSku === sku ? null : sku);
  };

  const handleSubmit = async (partData) => {
    try {
      if (editingPart) {
        await Part.update(editingPart.id, partData);
        toast({ title: "הפריט עודכן בהצלחה" });
      } else {
        await Part.create(partData);
        toast({ title: "פריט חדש נוסף בהצלחה" });
      }
      
      setIsFormOpen(false);
      setEditingPart(null);
      await loadData();
    } catch (error) {
      console.error("Error saving part:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת הפריט",
        description: error.message || "אירעה שגיאה לא צפויה"
      });
    }
  };

  const handleDelete = async (part) => {
    try {
      await Part.delete(part.id);
      toast({ title: "הפריט נמחק בהצלחה" });
      setIsFormOpen(false);
      setEditingPart(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting part:", error);
      toast({
        variant: "destructive",
        title: "שגיאה במחיקת הפריט",
        description: error.message || "אירעה שגיאה לא צפויה"
      });
    }
  };

  const SortableHeader = ({ columnKey, children, className = "" }) => (
    <TableHead 
      onClick={() => requestSort(columnKey)} 
      className={`cursor-pointer text-center ${className}`}
    >
      <div className="flex items-center justify-center gap-1">
        {children}
        {sortConfig.key === columnKey && (
          sortConfig.direction === 'asc' ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
        )}
      </div>
    </TableHead>
  );

  const getStockStatusColor = (quantity, minimumStock = 0) => {
    if (quantity === 0) return 'text-red-600';
    if (minimumStock > 0 && quantity <= minimumStock) return 'text-orange-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">טוען פריטים...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>שגיאה בטעינת נתונים</AlertTitle>
            <AlertDescription>
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadData}
                className="mr-2 mt-2"
              >
                נסה שוב
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <h1 className="text-2xl font-bold">ניהול פריטים</h1>
          <Button onClick={() => {
            setEditingPart(null);
            setIsFormOpen(true);
          }} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 ml-2" /> הוסף פריט חדש
          </Button>
        </div>

        <div className="flex items-center space-x-2 space-x-reverse">
          <Search className="w-4 h-4 text-gray-400" />
          <Input
            placeholder="חפש לפי מק״ט, שם או מיקום..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          {selectedPartSku && (
            <div className="flex items-center gap-2 mr-4">
              <Badge variant="outline" className="text-blue-700">
                מסנן: {selectedPartSku}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPartSku(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>רשימת פריטים ({filteredAndSortedParts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAndSortedParts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'לא נמצאו פריטים התואמים לחיפוש' : 'לא נמצאו פריטים במערכת'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader columnKey="sku">מק״ט</SortableHeader>
                      <SortableHeader columnKey="name">שם הפריט</SortableHeader>
                      <SortableHeader columnKey="current_location">מיקום</SortableHeader>
                      {warehouses.map(warehouse => (
                        <TableHead key={warehouse.id} className="text-center">
                          {warehouse.name}
                        </TableHead>
                      ))}
                      <SortableHeader columnKey="minimum_stock">מלאי מינימלי</SortableHeader>
                      <SortableHeader columnKey="cost_price">מחיר מכירה</SortableHeader>
                      <TableHead className="text-center">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedParts.map((part) => {
                      const salePrice = getCalculatedSalePrice(part);
                      
                      return (
                        <TableRow key={part.id}>
                          <TableCell className="font-mono text-center">
                            <button
                              onClick={() => handleSkuClick(part.sku)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {part.sku}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">{part.name}</TableCell>
                          <TableCell className="text-center">{part.current_location || 'לא מוגדר'}</TableCell>
                          {warehouses.map(warehouse => {
                            const stockQuantity = part[warehouse.warehouse_id] || 0;
                            return (
                              <TableCell 
                                key={warehouse.id} 
                                className={`text-center font-medium ${getStockStatusColor(stockQuantity, part.minimum_stock)}`}
                              >
                                {stockQuantity}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">{part.minimum_stock || 0}</TableCell>
                          <TableCell className="text-center">
                            {salePrice ? `${salePrice} ${part.sale_currency || 'ILS'}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingPart(part);
                                  setIsFormOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPartSku && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                היסטוריית פריט: {selectedPartSku}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const partHistory = getPartHistory(selectedPartSku);
                return partHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    לא נמצאו רשומות היסטוריה לפריט זה
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-center">תאריך</TableHead>
                          <TableHead className="text-center">משתמש</TableHead>
                          <TableHead className="text-center">פעולה</TableHead>
                          <TableHead className="text-center">תיאור</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partHistory.map((log, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-center">
                              {new Date(log.created_date).toLocaleDateString('he-IL')}
                            </TableCell>
                            <TableCell className="text-center">
                              {log.user_nickname || log.user_email}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">
                                {log.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {log.description}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {editingPart ? `עריכת פריט: ${editingPart.sku}` : 'פריט חדש'}
              </DialogTitle>
            </DialogHeader>
            <PartForm
              part={editingPart}
              onSubmit={handleSubmit}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingPart(null);
              }}
              onDelete={editingPart ? handleDelete : null}
            />
          </DialogContent>
        </Dialog>
      </div>
  );
}