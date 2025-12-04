import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Warehouse, BoxesIcon, ArrowLeftRight, BarChart3, Upload, Settings, LogOut,
  ClipboardList, ClipboardPlus, ClipboardCheck, History, Undo2, Home, Wrench, Users,
  Menu, X, Building, Users2, Workflow, Map, Truck, Calendar
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
  { name: "לוח זמנים", icon: Calendar, path: "Schedule" },
  { name: "לקוחות", icon: Users2, path: "Customers" },
  { name: "יחידות שירות", icon: BoxesIcon, path: "ServiceUnits" },
  { name: "סוגי תחזוקה", icon: Wrench, path: "MaintenanceTypes" },
  { name: "קריאות שירות", icon: ClipboardList, path: "ServiceCalls" },
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

  // Professional Business Theme
  const theme = {
    primary: "slate",
    accent: "emerald"
  };

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
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        currentPageName === item.path
          ? "bg-gradient-to-l from-emerald-50 to-emerald-100 text-emerald-800 border-r-3 border-emerald-500 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
      onClick={() => setSidebarOpen(false)}
    >
      <item.icon className={cn(
        "h-5 w-5",
        currentPageName === item.path ? "text-emerald-600" : "text-slate-400"
      )} />
      {item.name}
    </Link>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-emerald-500 border-t-transparent"></div>
          <span className="text-slate-500 text-sm">טוען...</span>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-slate-100 font-sans">
      <style>{`
        :root {
          --color-primary: #0f172a;
          --color-accent: #10b981;
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
      
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 right-0 z-50 h-full w-72 bg-white border-l border-slate-200 shadow-xl transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-l from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Workflow className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-l from-slate-700 to-slate-900 bg-clip-text text-transparent">FlowMaster</h1>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden hover:bg-slate-100" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate-500" />
          </Button>
        </div>

        <nav className="p-4 space-y-1 h-[calc(100vh-80px)] overflow-y-auto scrollbar-thin">
          <NavLink item={{ name: "ראשי", icon: Home, path: "Dashboard" }} />
          
          <div className="pt-4">
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 rounded-lg transition-colors">
                  <span className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    ניהול מלאי
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 pt-1 pr-2 border-r-2 border-slate-100 mr-2">
                {stockNavigation.map((item) => <NavLink key={item.name} item={item} />)}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="pt-3">
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 rounded-lg transition-colors">
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    ניהול שטח
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 pt-1 pr-2 border-r-2 border-slate-100 mr-2">
                {fieldNavigation.map((item) => <NavLink key={item.name} item={item} />)}
              </CollapsibleContent>
            </Collapsible>
          </div>
          
          <div className="pt-3">
            <Collapsible defaultOpen={true}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 rounded-lg transition-colors">
                  <span className="flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    כללי
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 pt-1 pr-2 border-r-2 border-slate-100 mr-2">
                {sharedNavigation.map((item) => <NavLink key={item.name} item={item} />)}
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="pt-6 mt-4 border-t border-slate-100">
            <NavLink item={{ name: "הגדרות", icon: Settings, path: "Settings" }} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-right text-red-500 hover:bg-red-50 hover:text-red-600 mt-1"
            >
              <LogOut className="h-5 w-5" />
              התנתק
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
          <Button variant="ghost" size="icon" className="md:hidden hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6 text-slate-600" />
          </Button>
          <div className="flex-1" />
          {currentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3 hover:bg-slate-100 rounded-xl px-3">
                  <Avatar className="h-9 w-9 border-2 border-emerald-100">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-emerald-500 text-white font-medium">
                      {getUserInitials(currentUser.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right hidden sm:block">
                    <div className="text-sm font-medium text-slate-700">{currentUser.nickname || currentUser.full_name}</div>
                    <div className="text-xs text-slate-400">{currentUser.role === 'admin' ? 'מנהל' : 'משתמש'}</div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-slate-500">חשבון</DropdownMenuLabel>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to={createPageUrl("Welcome")}>עדכן פרופיל</Link>
                </DropdownMenuItem>
                {currentUser.role === "admin" && (
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to={createPageUrl("Settings")}>הגדרות מערכת</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-500 cursor-pointer focus:text-red-600 focus:bg-red-50" onClick={handleLogout}>
                  <LogOut className="ml-2 h-4 w-4" />
                  התנתק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}