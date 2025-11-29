
import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Warehouse, BoxesIcon, ArrowLeftRight, BarChart3, Upload, Settings, LogOut,
  ClipboardList, ClipboardPlus, ClipboardCheck, History, Undo2, Home, Wrench, Users,
  Menu, X, Building, Users2, Workflow, Map, Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User } from "@/entities/User";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const stockNavigation = [
  { name: "לוח בקרה מלאי", icon: BarChart3, path: "StockDashboard" },
  { name: "ניהול פריטים", icon: BoxesIcon, path: "ItemsManagement" },
  { name: "העברות", icon: ArrowLeftRight, path: "Transfers" },
  { name: "הזמנה חדשה", icon: ClipboardPlus, path: "NewOrders" },
  { name: "רשימת הזמנות", icon: ClipboardList, path: "Orders" },
  { name: "תעודות משלוח", icon: ClipboardCheck, path: "DeliveryNotes" },
  { name: "החזר הוצאות", icon: Undo2, path: "ExpenseReturns" },
];

const fieldNavigation = [
  { name: "לוח בקרה שטח", icon: Map, path: "FieldDashboard" },
  { name: "לקוחות", icon: Users2, path: "Clients" },
  { name: "קריאות שירות", icon: Wrench, path: "ServiceCalls" },
  { name: "נהלי תחזוקה", icon: Settings, path: "MaintenanceProcedures" },
];

const sharedNavigation = [
  { name: "היסטוריה", icon: History, path: "History" },
  { name: "ייבוא מקובץ", icon: Upload, path: "Import" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await User.me();
        setCurrentUser(user);
        if (!user.profile_completed && currentPageName !== 'Welcome') {
          window.location.href = createPageUrl('Welcome');
          return;
        }

        // Post-login redirect logic
        const redirectDone = sessionStorage.getItem('postLoginRedirectDone');
        if (!redirectDone && user.default_page) {
            sessionStorage.setItem('postLoginRedirectDone', 'true'); // Set flag immediately
            // Only redirect if they are not already on their default page
            if (user.default_page !== currentPageName) {
                let url = createPageUrl(user.default_page);
                if (user.default_page_filter) {
                    url += `?filter=${user.default_page_filter}`;
                }
                window.location.href = url;
                return; // Stop execution to allow redirect
            }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUserData();
  }, [currentPageName]);

  const handleLogout = async () => {
    try {
      await User.logout();
      // Clear the post-login redirect flag on logout
      sessionStorage.removeItem('postLoginRedirectDone');
      window.location.href = '/';
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const getUserInitials = (name) => {
    if (!name) return "??";
    return name.split(" ").map(part => part[0]).join("").toUpperCase();
  };

  const NavLink = ({ item }) => (
    <Link
      to={createPageUrl(item.path)}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        currentPageName === item.path
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
      onClick={() => setSidebarOpen(false)}
    >
      <item.icon className="h-5 w-5" />
      {item.name}
    </Link>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex h-screen bg-gray-100 font-sans">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 right-0 z-50 h-full w-64 bg-white border-l-2 border-gray-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">FlowMaster</h1>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <nav className="p-4 space-y-2 h-[calc(100vh-65px)] overflow-y-auto">
          <NavLink item={{ name: "ראשי", icon: Home, path: "Dashboard" }} />
          
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">
                <span><Building className="inline h-5 w-5 ml-2" />ניהול מלאי</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 pr-4 border-r-2 mr-3">
              {stockNavigation.map((item) => <NavLink key={item.name} item={item} />)}
            </CollapsibleContent>
          </Collapsible>

          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
               <div className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">
                <span><Truck className="inline h-5 w-5 ml-2" />ניהול שטח</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 pr-4 border-r-2 mr-3">
              {fieldNavigation.map((item) => <NavLink key={item.name} item={item} />)}
            </CollapsibleContent>
          </Collapsible>
          
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
               <div className="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">
                <span><Workflow className="inline h-5 w-5 ml-2" />כללי</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1 pr-4 border-r-2 mr-3">
              {sharedNavigation.map((item) => <NavLink key={item.name} item={item} />)}
            </CollapsibleContent>
          </Collapsible>

           <div className="pt-4 border-t">
              <NavLink item={{ name: "הגדרות", icon: Settings, path: "Settings" }} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-right text-red-600 hover:bg-red-50 mt-2"
              >
                <LogOut className="h-5 w-5" />
                התנתק
              </button>
           </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 py-2 flex justify-between items-center">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex-1" />
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{getUserInitials(currentUser.full_name)}</AvatarFallback>
                  </Avatar>
                  <span>{currentUser.nickname || currentUser.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>חשבון</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Welcome")}>עדכן פרופיל</Link>
                </DropdownMenuItem>
                {currentUser.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Settings")}>הגדרות מערכת</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                  <LogOut className="ml-2 h-4 w-4" />
                  התנתק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <main className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
