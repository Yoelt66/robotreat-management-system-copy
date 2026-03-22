/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Clients from './pages/Clients';
import Customers from './pages/Customers.jsx';
import Dashboard from './pages/Dashboard';
import DeliveryNotes from './pages/DeliveryNotes';
import ExpenseReturns from './pages/ExpenseReturns';
import FieldDashboard from './pages/FieldDashboard';
import History from './pages/History';
import Home from './pages/Home';
import Import from './pages/Import';
import Invoices from './pages/Invoices';
import ItemsManagement from './pages/ItemsManagement';
import MaintenanceProcedures from './pages/MaintenanceProcedures';
import MaintenanceTypes from './pages/MaintenanceTypes.jsx';
import NewOrders from './pages/NewOrders';
import Orders from './pages/Orders';
import PartsManagement from './pages/PartsManagement';
import Schedule from './pages/Schedule';
import ServiceCalls from './pages/ServiceCalls';
import ServiceUnits from './pages/ServiceUnits.jsx';
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
    "Invoices": Invoices,
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