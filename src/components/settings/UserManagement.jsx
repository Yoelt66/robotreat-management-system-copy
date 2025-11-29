import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Edit, UserPlus } from "lucide-react";
import UserProfileForm from "./UserProfileForm";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = await User.list();
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בטעינת משתמשים",
        description: "אנא נסה שנית",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleUpdateUser = async (userData) => {
    try {
      if (editingUser) {
        await User.update(editingUser.id, userData);
        toast({ title: "פרטי המשתמש עודכנו בהצלחה" });
        setShowForm(false);
        setEditingUser(null);
        loadUsers();
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בעדכון פרטי המשתמש",
      });
    }
  };

  if (loading) {
    return <div className="text-center">טוען...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>ניהול משתמשים</CardTitle>
        <Button onClick={() => window.open("/workspace/users", "_blank")}>
          <UserPlus className="h-4 w-4 ml-2" />
          הזמן משתמשים חדשים
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">שם מלא</TableHead>
              <TableHead className="text-center">כינוי</TableHead>
              <TableHead className="text-center">דוא״ל</TableHead>
              <TableHead className="text-center">מחלקה</TableHead>
              <TableHead className="text-center">תפקיד</TableHead>
              <TableHead className="text-center">סטטוס פרופיל</TableHead>
              <TableHead className="text-center">התחברות אחרונה</TableHead>
              <TableHead className="text-center">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="text-center">{user.full_name}</TableCell>
                <TableCell className="text-center">
                  {user.nickname || 
                    <span className="text-gray-400 italic">לא הוגדר</span>
                  }
                </TableCell>
                <TableCell className="text-center">{user.email}</TableCell>
                <TableCell className="text-center">
                  {user.department || 
                    <span className="text-gray-400 italic">לא הוגדר</span>
                  }
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                    {user.role === 'admin' ? 'מנהל' : 'משתמש'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={user.profile_completed ? 'default' : 'destructive'}>
                    {user.profile_completed ? 'הושלם' : 'לא הושלם'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {user.last_login ? 
                    new Date(user.last_login).toLocaleDateString('he-IL') : 
                    <span className="text-gray-400">מעולם לא</span>
                  }
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditUser(user)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת פרטי משתמש</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <UserProfileForm
                user={editingUser}
                onSubmit={handleUpdateUser}
                onCancel={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                isAdmin={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}