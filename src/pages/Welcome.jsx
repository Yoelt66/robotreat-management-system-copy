import React, { useState, useEffect } from "react";
import { User } from "@/entities/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Warehouse, Package, ArrowLeftRight, Users } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";

import UserProfileForm from "../components/settings/UserProfileForm";

export default function WelcomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      
      // Show profile form if user hasn't completed their profile
      if (!user.profile_completed) {
        setShowProfileForm(true);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (profileData) => {
    try {
      await User.updateMyUserData(profileData);
      setCurrentUser(prev => ({ ...prev, ...profileData }));
      setShowProfileForm(false);
      toast({ title: "הפרופיל שלך נשמר בהצלחה!" });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        variant: "destructive",
        title: "שגיאה בשמירת הפרופיל",
      });
    }
  };

  const features = [
    {
      icon: Package,
      title: "ניהול פריטים",
      description: "הוסף ונהל את כל הפריטים במלאי שלך"
    },
    {
      icon: Warehouse,
      title: "ניהול מחסנים",
      description: "עקוב אחר המלאי במחסנים שונים"
    },
    {
      icon: ArrowLeftRight,
      title: "העברות מלאי",
      description: "העבר פריטים בין מחסנים בקלות"
    },
    {
      icon: Users,
      title: "ניהול הזמנות",
      description: "צור ונהל הזמנות מספקים"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">טוען...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            ברוך הבא למערכת ניהול המלאי! 
          </h1>
          <p className="text-xl text-gray-600">
            {currentUser?.nickname ? `שלום ${currentUser.nickname}!` : `שלום ${currentUser?.full_name}!`}
          </p>
          <p className="text-lg text-gray-500">
            כל מה שאתה צריך לניהול מלאי יעיל ומקצועי
          </p>
        </div>

        {/* Profile Setup */}
        {showProfileForm ? (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">בואו נכיר!</CardTitle>
              <p className="text-center text-gray-600">
                אנא השלם את הפרטים שלך כדי להתחיל להשתמש במערכת
              </p>
            </CardHeader>
            <CardContent>
              <UserProfileForm
                user={currentUser}
                onSubmit={handleProfileSubmit}
                onCancel={() => setShowProfileForm(false)}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Success Message */}
            <Card className="max-w-2xl mx-auto bg-green-50 border-green-200">
              <CardContent className="flex items-center gap-4 pt-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    הפרופיל שלך הוגדר בהצלחה!
                  </h3>
                  <p className="text-green-600">
                    כעת אתה יכול להתחיל להשתמש במערכת ניהול המלאי
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Features Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <feature.icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">מוכן להתחיל?</h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => window.location.href = createPageUrl('Dashboard')}
                >
                  לכו ללוח הבקרה
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => window.location.href = createPageUrl('Parts')}
                >
                  התחל עם ניהול פריטים
                </Button>
              </div>
            </div>

            {/* Quick Tips */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800">טיפים מהירים להתחלה</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p>התחל על ידי הוספת המחסנים שלך בהגדרות המערכת</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p>הוסף את הפריטים הראשונים שלך והגדר מלאי מינימלי</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p>התחל לעקוב אחר תנועות המלאי והעברות בין מחסנים</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}