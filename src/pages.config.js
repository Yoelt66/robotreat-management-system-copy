import Clients from './pages/Clients';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DeliveryNotes from './pages/DeliveryNotes';
import ExpenseReturns from './pages/ExpenseReturns';
import FieldDashboard from './pages/FieldDashboard';
import History from './pages/History';
import Home from './pages/Home';
import Import from './pages/Import';
import ItemsManagement from './pages/ItemsManagement';
import MaintenanceProcedures from './pages/MaintenanceProcedures';
import MaintenanceTypes from './pages/MaintenanceTypes';
import NewOrders from './pages/NewOrders';
import Orders from './pages/Orders';
import PartsManagement from './pages/PartsManagement';
import Schedule from './pages/Schedule';
import ServiceCalls from './pages/ServiceCalls';
import ServiceUnits from './pages/ServiceUnits';
import Settings from './pages/Settings';
import StockDashboard from './pages/StockDashboard';
import Transfers from './pages/Transfers';
import Welcome from './pages/Welcome';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Clients": Clients,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "DeliveryNotes": DeliveryNotes,
    "ExpenseReturns": ExpenseReturns,
    "FieldDashboard": FieldDashboard,
    "History": History,
    "Home": Home,
    "Import": Import,
    "ItemsManagement": ItemsManagement,
    "MaintenanceProcedures": MaintenanceProcedures,
    "MaintenanceTypes": MaintenanceTypes,
    "NewOrders": NewOrders,
    "Orders": Orders,
    "PartsManagement": PartsManagement,
    "Schedule": Schedule,
    "ServiceCalls": ServiceCalls,
    "ServiceUnits": ServiceUnits,
    "Settings": Settings,
    "StockDashboard": StockDashboard,
    "Transfers": Transfers,
    "Welcome": Welcome,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};