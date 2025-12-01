import React, { useState, useEffect } from "react";
import { ServiceCall } from "@/entities/ServiceCall";
import { User } from "@/entities/User";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Users,
  ArrowUpRight,
  Wrench,
  Activity
} from "lucide-react";
import StatsCard from "../components/dashboard/StatsCard";
import RecentCalls from "../components/dashboard/RecentCalls";
import ServiceTypeChart from "../components/dashboard/PriorityChart";

export default function Dashboard() {
  const [serviceCalls, setServiceCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const [calls, user] = await Promise.all([
        ServiceCall.list(),  // Remove the -created_date sorting
        User.me()
      ]);
      
      const callsArray = Array.isArray(calls) ? calls : [];
      
      const callsWithoutNumbers = callsArray.filter(call => 
        call && !call.call_number && call.status !== 'temporary'
      );
      
      if (callsWithoutNumbers.length > 0) {
        const maxCallNumber = Math.max(...callsArray.map(call => parseInt(call?.call_number) || 0), 0);
        
        let nextCallNumber = maxCallNumber + 1;
        
        for (const call of callsWithoutNumbers) {
          await ServiceCall.update(call.id, { call_number: String(nextCallNumber) });
          call.call_number = String(nextCallNumber);
          nextCallNumber++;
        }
        
        console.log(`Assigned call numbers to ${callsWithoutNumbers.length} service calls`);
      }
      
      // Sort calls by call number in descending order
      const sortedCalls = [...callsArray].sort((a, b) => {
        // Put temporary calls (without call numbers) at the top
        if (!a?.call_number && !b?.call_number) return 0;
        if (!a?.call_number) return -1;
        if (!b?.call_number) return 1;
        return b.call_number - a.call_number;
      });
      
      setServiceCalls(sortedCalls);
      setUserData(user);
      
      const urlParams = new URLSearchParams(window.location.search);
      const filterFromUrl = urlParams.get('filter');
      setStatusFilter(filterFromUrl || user?.default_page_filter || "all");

    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setServiceCalls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStats = () => {
    const calls = Array.isArray(serviceCalls) ? serviceCalls : [];
    const today = new Date().toISOString().split('T')[0];

    return {
      total: calls.length,
      inProgress: calls.filter(call => call?.status === "in_progress").length,
      completed: calls.filter(call => 
        call?.status === "completed" && 
        call?.updated_date?.split('T')[0] === today
      ).length
    };
  };

  const filteredCalls = React.useMemo(() => {
    if (!Array.isArray(serviceCalls)) return [];
    
    if (statusFilter === "cancelled") {
      return serviceCalls.filter(call => call && call.status === "cancelled");
    }
    
    return serviceCalls.filter(call => {
      if (!call) return false;
      if (statusFilter === "all") {
        return call.status !== "cancelled"; // Hide cancelled calls in "all" view
      }
      return call.status === statusFilter;
    });
  }, [serviceCalls, statusFilter]);

  const stats = getStats();

  const statusLabels = {
    all: "הכל",
    pending: "טיוטה",
    assigned: "סגור",
    in_progress: "אושר",
    completed: "הוקלדו",
    final: "סופי",
    cancelled: "מבוטל"
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">לוח בקרה</h1>
          <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-white border">
              <TabsTrigger value="all">{statusLabels.all}</TabsTrigger>
              <TabsTrigger value="pending">{statusLabels.pending}</TabsTrigger>
              <TabsTrigger value="assigned">{statusLabels.assigned}</TabsTrigger>
              <TabsTrigger value="in_progress">{statusLabels.in_progress}</TabsTrigger>
              <TabsTrigger value="completed">{statusLabels.completed}</TabsTrigger>
              <TabsTrigger value="final">{statusLabels.final}</TabsTrigger>
              <TabsTrigger value="cancelled">{statusLabels.cancelled}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatsCard
            title="סה״כ קריאות שירות"
            value={stats.total}
            icon={Wrench}
            color="blue"
            trend={stats.total > 0 ? "+12% מהחודש שעבר" : null}
          />
          <StatsCard
            title="מאושרות"
            value={stats.inProgress}
            icon={Activity}
            color="yellow"
          />
          <StatsCard
            title="הוקלדו היום"
            value={stats.completed}
            icon={CheckCircle2}
            color="green"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentCalls 
              calls={filteredCalls}
              loading={loading}
              userEmail={userData?.email}
              onCallsUpdated={loadData}
            />
          </div>
          <div>
            <ServiceTypeChart calls={filteredCalls} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}