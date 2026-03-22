import React, { useState, useEffect, useRef } from 'react';
import { User } from '@/entities/User';
import { Customer } from '@/entities/Customer';
import { ServiceUnit } from '@/entities/ServiceUnit';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function BasicInfoStep({ data, onUpdate, onValidityChange }) {
  const [customers, setCustomers] = useState([]);
  const [serviceUnits, setServiceUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchValue, setSearchValue] = useState(data.client_name || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [isDeviceLoading, setIsDeviceLoading] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [customersList, currentUserData, usersList] = await Promise.all([
          Customer.list(),
          User.me(),
          User.list().catch(() => [])
        ]);
        
        setCustomers(customersList || []);
        setCurrentUser(currentUserData);
        // Ensure usersList includes the current user if not already present or if the list is empty
        const finalUsersList = usersList && usersList.length > 0 ? usersList : [currentUserData].filter(Boolean);
        setUsers(finalUsersList);
        
        if (data.client_name) {
          await loadServiceUnitsForCustomer(data.client_name, customersList);
        }
        
        // Set default technician to current user if no technician is assigned
        if (!data.assigned_to_nickname && currentUserData) {
          const nickname = currentUserData.nickname || currentUserData.full_name;
          onUpdate({
            assigned_to: currentUserData.email,
            assigned_to_nickname: nickname
          });
        }
        
        checkValidity({ ...data, assigned_to_nickname: currentUserData?.nickname || currentUserData?.full_name });
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadServiceUnitsForCustomer = async (customerName, customersList = customers) => {
    try {
      const selectedCustomer = customersList.find(c => c.name === customerName);
      if (selectedCustomer) {
        const customerUnits = await ServiceUnit.filter({ customer_id: selectedCustomer.id });
        setServiceUnits(customerUnits || []);
        
        if (data.device_id && data.device && !customerUnits.some(u => u.id === data.device_id)) {
          try {
            setIsDeviceLoading(true);
            const unitData = await ServiceUnit.get(data.device_id);
            if (unitData) {
              setServiceUnits(prev => [...prev, unitData]);
            }
          } catch (unitError) {
            console.error("Could not load specific unit:", unitError);
          } finally {
            setIsDeviceLoading(false);
          }
        }
      }
    } catch (error) {
      console.error("Error loading service units:", error);
      setServiceUnits([]);
    }
  };

  useEffect(() => {
    checkValidity(data);
  }, [data?.client_name, data?.system, data?.device, data?.assigned_to_nickname]);

  const checkValidity = (currentData) => {
    const isValid = 
      currentData.assigned_to_nickname && 
      currentData.client_name &&
      currentData.device;
    
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  };

  const handleCustomerChange = async (customerName) => {
    setSearchValue(customerName);
    const updateData = { 
      client_name: customerName, 
      system: '', 
      device: '', 
      device_id: '', 
      device_type: '',
      // Clear maintenance procedure selection when customer changes
      selected_procedure_id: '',
      selected_procedure_name: '',
      procedure_steps: []
    };
    await onUpdate(updateData);
    loadServiceUnitsForCustomer(customerName);
    setShowDropdown(false);
    checkValidity({ ...data, ...updateData });
  };

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleClearDevice = () => {
    const updateData = {
      device: '',
      device_id: '',
      device_type: ''
    };
    onUpdate(updateData);
    checkValidity({ ...data, ...updateData });
  };

  const handleUnitSelect = async (unitName, unitId, unitType) => {
    console.log("Selected service unit:", { name: unitName, id: unitId, type: unitType });
    const updateData = {
      device: unitName,
      device_id: unitId,
      device_type: unitType,
      // Clear maintenance procedure selection when unit changes
      selected_procedure_id: '',
      selected_procedure_name: '',
      procedure_steps: []
    };
    onUpdate(updateData);
    checkValidity({ ...data, ...updateData });
  };

  const deviceTypeLabels = {
    Astronaut_A3: "Astronaut A3",
    Astronaut_A3N: "Astronaut A3N",
    Astronaut_A4: "Astronaut A4",
    Delaval_2008: "Delaval 2008",
    Delaval_2011: "Delaval 2011",
    Milk_tank: "מיכל חלב",
    CRS: "CRS+",
    Juno_100: "Juno 100",
    Juno_150: "Juno 150",
    Luna: "Luna",
    other: "מערכת אחרת"
  };

  const handleTechnicianChange = (userEmail) => {
    const selectedUser = users.find(user => user.email === userEmail);
    if (selectedUser) {
      const updateData = {
        assigned_to: selectedUser.email,
        assigned_to_nickname: selectedUser.nickname || selectedUser.full_name
      };
      onUpdate(updateData);
      checkValidity({ ...data, ...updateData });
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="assigned_to">טכנאי מטפל *</Label>
          <Select
            value={data.assigned_to || ''}
            onValueChange={handleTechnicianChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר טכנאי מטפל" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.email} value={user.email}>
                  {user.nickname || user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loading && <p className="text-sm text-gray-500">טוען רשימת טכנאים...</p>}
        </div>

        <div className="space-y-2">
          <Label>לקוח *</Label>
          <div className="relative" ref={dropdownRef}>
            <Input
              type="text"
              placeholder="חפש לקוח..."
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setShowDropdown(true);
                if (e.target.value !== data.client_name) {
                  onUpdate({ client_name: '', system: '', device: '', device_id: '', device_type: '' });
                }
              }}
              onFocus={() => setShowDropdown(true)}
              className="w-full"
            />
            {showDropdown && searchValue && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border max-h-60 overflow-auto">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleCustomerChange(customer.name)}
                    >
                      {customer.name}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-gray-500">לא נמצאו לקוחות</div>
                )}
              </div>
            )}
          </div>
        </div>

        {data.client_name && (
          <>
            {!data.device ? (
              <div className="space-y-2">
                <Label>מערכת *</Label>
                <Select
                   value={data.device || ''}
                   onValueChange={(value) => {
                     const selectedUnit = serviceUnits.find(u => u.name === value);
                     console.log("Selected unit data:", selectedUnit);
                     handleUnitSelect(
                       value,
                       selectedUnit?.id || '',
                       selectedUnit?.type || ''
                     );
                   }}
                   disabled={loading || serviceUnits.length === 0}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="בחר מערכת" />
                   </SelectTrigger>
                   <SelectContent>
                     {serviceUnits.length > 0 ? (
                       [...serviceUnits].sort((a, b) => a.name?.localeCompare(b.name || "", 'he') || 0).map((unit) => (
                         <SelectItem key={unit.id} value={unit.name}>
                           {unit.name} {unit.type && deviceTypeLabels[unit.type] ? `- ${deviceTypeLabels[unit.type]}` : ''}
                         </SelectItem>
                       ))
                     ) : (
                       <SelectItem value={null} disabled>
                         אין מערכות זמינות ללקוח זה
                       </SelectItem>
                     )}
                   </SelectContent>
                 </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>מערכת נבחרת</Label>
                <div className="flex items-center justify-between p-3 border rounded-md bg-blue-50">
                  <div className="flex flex-col">
                    <span className="font-medium">{data.device}</span>
                    <span className="text-sm text-gray-600">
                      {isDeviceLoading ? (
                        "טוען פרטי מערכת..."
                      ) : (
                        (() => {
                          const selectedUnit = serviceUnits.find(u => u.id === data.device_id || u.name === data.device);
                          return selectedUnit 
                            ? (deviceTypeLabels[selectedUnit.type] || selectedUnit.type) 
                            : "מערכת";
                        })()
                      )}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-red-500"
                    onClick={() => handleClearDevice()}
                  >
                    החלף מערכת
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}