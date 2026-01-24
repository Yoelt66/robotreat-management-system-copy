import React, { useState, useEffect } from "react";
import { Warehouse } from "@/entities/Warehouse";
import { Category } from "@/entities/Category";
import { Supplier } from "@/entities/Supplier";
import { Currency } from "@/entities/Currency";
import { Unit } from "@/entities/Unit";
import { User } from "@/entities/User";
import { getParts } from "@/functions/getParts";
import { createPart } from "@/functions/createPart";
import { updatePart } from "@/functions/updatePart";
import { deletePart } from "@/functions/deletePart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package,
  ChevronUp,
  ChevronDown
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
} from "@/components/ui/alert-dialog";


import PartForm from "../components/parts/PartForm";

export default function ItemsManagement() {
  const [parts, setParts] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [partToDelete, setPartToDelete] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortColumn, setSortColumn] = useState("sku");
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAndSortParts();
  }, [parts, searchTerm, categoryFilter, sortColumn, sortDirection]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        partsResponse,
        categoriesData,
        suppliersData,
        currenciesData,
        unitsData,
        warehousesData,
        userData
      ] = await Promise.all([
        getParts(),
        Category.list(),
        Supplier.list(),
        Currency.list(),
        Unit.list(),
        Warehouse.list(),
        User.me().catch(() => null)
      ]);

      const partsData = partsResponse?.data?.data || [];
      setParts(partsData);
      setCategories(categoriesData || []);
      setSuppliers(suppliersData || []);
      setCurrencies(currenciesData || []);
      setUnits(unitsData || []);
      setWarehouses((warehousesData || []).sort((a, b) => (a.number || 0) - (b.number || 0)));
      setCurrentUser(userData);
    } catch (error) {
      console.error("Error loading data:", error);

    } finally {
      setLoading(false);
    }
  };

  // Calculate sale price for a part using current exchange rates
  const calculateSalePrice = (part) => {
    if (part.is_manual && part.manual_sale_price) {
      return part.manual_sale_price;
    }

    const costPrice = parseFloat(part.cost_price) || 0;
    const importPercentage = parseFloat(part.import_percentage) || 0;
    const markupPercentage = parseFloat(part.markup_percentage) || 0;

    if (costPrice === 0) return 0;

    let exchangeRate = 1;
    if (part.cost_currency !== part.sale_currency) {
      const costCurrency = currencies.find(c => c.code === part.cost_currency);
      const saleCurrency = currencies.find(c => c.code === part.sale_currency);
      
      if (costCurrency && saleCurrency) {
        exchangeRate = costCurrency.rate_to_ils / saleCurrency.rate_to_ils;
      }
    }

    const costWithImport = costPrice * (1 + importPercentage / 100);
    const costWithMarkup = costWithImport * (1 + markupPercentage / 100);
    const finalSalePrice = costWithMarkup * exchangeRate;

    return Math.round(finalSalePrice * 100) / 100;
  };

  const getMainWarehouse = () => {
    return warehouses.find(w => w.number === 1);
  };

  const getStockForWarehouse = (part, warehouse) => {
    return part[warehouse.warehouse_id] || 0;
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? 
      <ChevronUp className="h-4 w-4 inline" /> : 
      <ChevronDown className="h-4 w-4 inline" />;
  };

  const filterAndSortParts = () => {
    let filtered = parts;

    // Search filter - minimum 4 characters
    if (searchTerm && searchTerm.length >= 4) {
      filtered = filtered.filter(part =>
        part.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.supplier_part_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else if (searchTerm.length > 0 && searchTerm.length < 4) {
      // Show all parts if search term is less than 4 characters
      filtered = parts;
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(part => part.category === categoryFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'sku':
          aValue = a.sku || '';
          bValue = b.sku || '';
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'category':
          aValue = categories.find(c => c.code === a.category)?.name || a.category || '';
          bValue = categories.find(c => c.code === b.category)?.name || b.category || '';
          break;
        case 'location':
          aValue = a.current_location || '';
          bValue = b.current_location || '';
          break;
        case 'minimum_stock':
          aValue = a.minimum_stock || 0;
          bValue = b.minimum_stock || 0;
          break;
        case 'sale_price':
          aValue = calculateSalePrice(a);
          bValue = calculateSalePrice(b);
          break;
        default:
          // Handle warehouse columns
          const warehouse = warehouses.find(w => sortColumn === `warehouse_${w.warehouse_id}`);
          if (warehouse) {
            aValue = getStockForWarehouse(a, warehouse);
            bValue = getStockForWarehouse(b, warehouse);
          } else {
            aValue = a[sortColumn] || '';
            bValue = b[sortColumn] || '';
          }
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortDirection === "asc") {
        return aStr.localeCompare(bStr, 'he');
      } else {
        return bStr.localeCompare(aStr, 'he');
      }
    });

    setFilteredParts(filtered);
  };

  const handleSubmit = async (partData) => {
    try {
      // Add warehouse data for new parts
      const dataWithWarehouses = {
        ...partData,
        warehouses: warehouses.map(wh => ({
          warehouse_id: wh.warehouse_id,
          quantity: 0
        }))
      };
      
      if (editingPart) {
        const response = await updatePart(partData);
        if (response?.data?.error) {
          throw new Error(response.data.error);
        }

      } else {
        const response = await createPart(dataWithWarehouses);
        if (response?.data?.error) {
          throw new Error(response.data.error);
        }

      }
      
      setShowForm(false);
      setEditingPart(null);
      loadData();
    } catch (error) {
      console.error("Error saving part:", error);

    }
  };

  const handleDelete = async () => {
    if (!partToDelete) return;
    
    try {
      const response = await deletePart({ sku: partToDelete.sku });
      if (response?.data?.error) {
        throw new Error(response.data.error);
      }

      setPartToDelete(null);
      loadData();
    } catch (error) {
      console.error("Error deleting part:", error);

    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Package className="mx-auto h-8 w-8 text-gray-400 mb-4" />
          <div>טוען פריטים...</div>
        </div>
      </div>
    );
  }

  const mainWarehouse = getMainWarehouse();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ניהול פריטים</h1>
        {isAdmin && (
          <Button onClick={() => {
            setEditingPart(null);
            setShowForm(true);
          }}>
            <Plus className="h-4 w-4 ml-2" />
            פריט חדש
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון וחיפוש</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי מק״ט, שם או מספר ספק (מינימום 4 תווים)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9"
              />
              {searchTerm.length > 0 && searchTerm.length < 4 && (
                <p className="text-xs text-gray-500 mt-1">נדרשים לפחות 4 תווים לחיפוש</p>
              )}
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="כל הקטגוריות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקטגוריות</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.code} value={category.code}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('sku')}
                  >
                    מק״ט {getSortIcon('sku')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('name')}
                  >
                    שם הפריט {getSortIcon('name')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('category')}
                  >
                    קטגוריה {getSortIcon('category')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('location')}
                  >
                    מיקום {getSortIcon('location')}
                  </TableHead>
                  {warehouses.map((warehouse) => (
                    <TableHead 
                      key={warehouse.warehouse_id}
                      className="text-center cursor-pointer hover:bg-gray-50 min-w-[80px]"
                      onClick={() => handleSort(`warehouse_${warehouse.warehouse_id}`)}
                    >
                      {warehouse.name} {getSortIcon(`warehouse_${warehouse.warehouse_id}`)}
                    </TableHead>
                  ))}
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('minimum_stock')}
                  >
                    מלאי מינימלי {getSortIcon('minimum_stock')}
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('sale_price')}
                  >
                    מחיר מכירה {getSortIcon('sale_price')}
                  </TableHead>
                  {isAdmin && <TableHead>פעולות</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8 + warehouses.length} className="text-center py-8 text-gray-500">
                      {searchTerm.length > 0 && searchTerm.length < 4 
                        ? "הזן לפחות 4 תווים לחיפוש" 
                        : "לא נמצאו פריטים"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParts.map((part) => {
                    const salePrice = calculateSalePrice(part);
                    const mainWarehouseStock = mainWarehouse ? getStockForWarehouse(part, mainWarehouse) : 0;
                    const isLowStock = part.minimum_stock > 0 && mainWarehouseStock < part.minimum_stock;
                    
                    return (
                      <TableRow key={part.id}>
                        <TableCell className="font-mono font-bold">
                          {part.sku}
                        </TableCell>
                        <TableCell className="font-medium">
                          {part.name}
                        </TableCell>
                        <TableCell>
                          {categories.find(c => c.code === part.category)?.name || part.category}
                        </TableCell>
                        <TableCell>
                          {part.current_location || '-'}
                        </TableCell>
                        {warehouses.map((warehouse) => {
                          const stock = getStockForWarehouse(part, warehouse);
                          return (
                            <TableCell key={warehouse.warehouse_id} className="text-center">
                              <span className="font-medium">
                                {stock}
                              </span>
                              <span className="text-gray-500 text-sm ml-1">
                                {units.find(u => u.code === part.unit)?.symbol || ''}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <span className={`font-medium ${isLowStock ? 'text-red-600' : ''}`}>
                            {part.minimum_stock || 0}
                          </span>
                          <span className="text-gray-500 text-sm mr-1">
                            {units.find(u => u.code === part.unit)?.symbol || ''}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold">
                          {salePrice > 0 ? `${salePrice.toFixed(2)} ${part.sale_currency || 'ILS'}` : '-'}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingPart(part);
                                  setShowForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setPartToDelete(part)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog - Only for Admin */}
      {isAdmin && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle>
                {editingPart ? 'עריכת פריט' : 'פריט חדש'}
              </DialogTitle>
            </DialogHeader>
            <PartForm
              part={editingPart}
              categories={categories}
              suppliers={suppliers}
              currencies={currencies}
              units={units}
              warehouses={warehouses}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingPart(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog - Only for Admin */}
      {isAdmin && (
        <AlertDialog open={!!partToDelete} onOpenChange={() => setPartToDelete(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>אישור מחיקת פריט</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את הפריט "{partToDelete?.name}" (מק״ט: {partToDelete?.sku})?
                פעולה זו בלתי הפיכה.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                מחק פריט
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}