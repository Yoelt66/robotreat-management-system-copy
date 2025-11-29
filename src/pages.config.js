import Dashboard from './pages/Dashboard';
import Transfers from './pages/Transfers';
import Import from './pages/Import';
import Settings from './pages/Settings';
import DeliveryNotes from './pages/DeliveryNotes';
import NewOrders from './pages/NewOrders';
import Orders from './pages/Orders';
import History from './pages/History';
import Welcome from './pages/Welcome';
import ExpenseReturns from './pages/ExpenseReturns';
import PartsManagement from './pages/PartsManagement';
import StockDashboard from './pages/StockDashboard';
import FieldDashboard from './pages/FieldDashboard';
import ServiceCalls from './pages/ServiceCalls';
import ItemsManagement from './pages/ItemsManagement';
import Clients from './pages/Clients';
import MaintenanceProcedures from './pages/MaintenanceProcedures';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Transfers": Transfers,
    "Import": Import,
    "Settings": Settings,
    "DeliveryNotes": DeliveryNotes,
    "NewOrders": NewOrders,
    "Orders": Orders,
    "History": History,
    "Welcome": Welcome,
    "ExpenseReturns": ExpenseReturns,
    "PartsManagement": PartsManagement,
    "StockDashboard": StockDashboard,
    "FieldDashboard": FieldDashboard,
    "ServiceCalls": ServiceCalls,
    "ItemsManagement": ItemsManagement,
    "Clients": Clients,
    "MaintenanceProcedures": MaintenanceProcedures,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};