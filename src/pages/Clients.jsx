
import React, { useState, useEffect } from "react";
import { Client } from "@/entities/Client";
import { Device } from "@/entities/Device";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Building2,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Settings2
} from "lucide-react";
import ClientForm from "../components/clients/ClientForm";
import ClientsTable from "../components/clients/ClientsTable";
import ClientDevices from "../components/clients/ClientDevices";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [showDevices, setShowDevices] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    addDefaultDevices();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const clientList = await Client.list();
      setClients(clientList || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const addDefaultDevices = async () => {
    try {
      const clients = await Client.list();
      for (const client of clients) {
        const existingDevices = await Device.filter({ client_id: client.id });
        const existingDeviceNames = existingDevices.map(d => d.name);
        
        const defaultDevices = [
          { name: 'כללי', type: 'other', serial_number: 'NA' },
          { name: 'מחשב', type: 'other', serial_number: 'NA' }
        ];
        
        for (const device of defaultDevices) {
          if (!existingDeviceNames.includes(device.name)) {
            await Device.create({
              ...device,
              client_id: client.id
            });
          }
        }
      }
      console.log('Successfully added default devices to all clients');
    } catch (error) {
      console.error('Error adding default devices:', error);
    }
  };

  const handleSubmit = async (data) => {
    try {
      let clientId;
      if (editingClient) {
        await Client.update(editingClient.id, data);
        clientId = editingClient.id;
      } else {
        const newClient = await Client.create(data);
        clientId = newClient.id;
      }
      
      setShowForm(false);
      setEditingClient(null);
      loadClients();
      
      return {
        id: clientId,
        createDevices: async (devices) => {
          for (const device of devices) {
            const deviceData = { ...device };
            delete deviceData.tempId;
            delete deviceData._markForDeletion;
            
            if (device.id) {
              await Device.update(device.id, { ...deviceData, client_id: clientId });
            } else {
              await Device.create({ ...deviceData, client_id: clientId });
            }
          }
        }
      };
    } catch (error) {
      console.error("Error saving client:", error);
      alert("Error saving client. Please try again.");
      return null;
    }
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      await Client.delete(clientId);
      loadClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      alert("Error deleting client. Please try again.");
    }
  };

  const getCompanies = () => {
    const companies = new Set();
    clients.forEach(client => {
      if (client.company) companies.add(client.company);
    });
    return Array.from(companies);
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm);
    
    const matchesCompany = selectedCompany === "all" || client.company === selectedCompany;
    
    return matchesSearch && matchesCompany;
  }).sort((a, b) => {
    switch (sortBy) {
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "company":
        return (a.company || "").localeCompare(b.company || "");
      case "recent":
        return new Date(b.created_date) - new Date(a.created_date);
      default:
        return 0;
    }
  });

  const exportToCsv = () => {
    const headers = ["Name", "Company", "Email", "Phone", "Address", "Notes"];
    const csvContent = [
      headers.join(","),
      ...filteredClients.map(client => [
        client.name || "",
        client.company || "",
        client.email || "",
        client.phone || "",
        client.address || "",
        client.notes || ""
      ].map(field => `"${field.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">לקוחות</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportToCsv}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              ייצוא
            </Button>
            <Button 
              onClick={() => {
                setEditingClient(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף לקוח
            </Button>
          </div>
        </div>

        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="חיפוש לקוחות..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[180px]">
                  <Building2 className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="סינון לפי חברה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החברות</SelectItem>
                  {getCompanies().map(company => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="מיון לפי" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">מיון לפי שם</SelectItem>
                  <SelectItem value="company">מיון לפי חברה</SelectItem>
                  <SelectItem value="recent">מיון לפי תאריך</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {showForm && (
          <ClientForm
            client={editingClient}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingClient(null);
            }}
          />
        )}

        {showDevices && selectedClient ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                מערכות של {selectedClient.name}
              </h2>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDevices(false);
                  setSelectedClient(null);
                }}
              >
                חזרה ללקוחות
              </Button>
            </div>
            <ClientDevices
              clientId={selectedClient.id}
              onDeviceUpdate={() => loadClients()}
            />
          </div>
        ) : (
          <ClientsTable
            clients={filteredClients}
            loading={loading}
            onEdit={(client) => {
              setEditingClient(client);
              setShowForm(true);
            }}
            onDelete={handleDelete}
            showDevices={(client) => {
              setSelectedClient(client);
              setShowDevices(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
