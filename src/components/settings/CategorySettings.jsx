
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Category } from "@/entities/Category";
import { Supplier } from "@/entities/Supplier"; // Added import for Supplier
import CategoryList from "./CategoryList";
import CategoryForm from "./CategoryForm";

export default function CategorySettings() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const [categoriesData, suppliersData] = await Promise.all([
        Category.list(),
        Supplier.list()
      ]);
      
      // Enrich categories with supplier names
      const enrichedCategories = categoriesData.map(category => {
        if (category.supplier_number) {
          const supplier = suppliersData.find(s => s.supplier_number === category.supplier_number);
          return {
            ...category,
            supplier_name: supplier ? supplier.name : category.supplier_number
          };
        }
        return category;
      });
      
      setCategories(enrichedCategories);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setEditingCategory(null);
    setShowForm(true);
  };

  const handleSubmit = async (categoryData) => {
    try {
      if (editingCategory && editingCategory.id) {
        await Category.update(editingCategory.id, categoryData);
      } else {
        await Category.create(categoryData);
      }
      setShowForm(false);
      setEditingCategory(null);
      loadCategories();
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setShowForm(true);
  };

  const handleDelete = async (categoryId) => {
    if (confirm("האם אתה בטוח שברצונך למחוק קטגוריה זו?")) {
      try {
        await Category.delete(categoryId);
        loadCategories();
      } catch (error) {
        console.error("Error deleting category:", error);
      }
    }
  };

  if (loading) {
    return <div>טוען...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>קטגוריות</CardTitle>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 ml-2" />
          קטגוריה חדשה
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <CategoryForm
            category={editingCategory}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCategory(null);
            }}
          />
        ) : (
          <CategoryList
            categories={categories}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </CardContent>
    </Card>
  );
}
