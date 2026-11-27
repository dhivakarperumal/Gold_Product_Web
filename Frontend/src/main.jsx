import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./PrivateRouter/AuthContext.jsx";
import { StoreProvider } from "./PrivateRouter/StoreContext.jsx";
import PrivateRoute from "./PrivateRouter/PrivateRouter.jsx";
import { AdminProvider } from "./PrivateRouter/AdminContext.jsx";
import { GoldRatesProvider } from "./PrivateRouter/GoldRatesContext.jsx";
import { Toaster } from "react-hot-toast";
import Loader from "./Components/CommenComponents/Loader.jsx";

const Login = React.lazy(() => import("./Components/Auth/Login.jsx"));
const Register = React.lazy(() => import("./Components/Auth/Register.jsx"));

// Lazy Load Admin Components
const AdminPanel = React.lazy(() => import("./Admin/AdminPanel.jsx"));
const Dashboard = React.lazy(() => import("./Admin/Dashboard.jsx"));
const SuperAdminPanel = React.lazy(() => import("./SuperAdmin/SuperAdminPanel.jsx"));
const SuperDashboard = React.lazy(() => import("./SuperAdmin/SuperDashboard.jsx"));
const SuperProfile = React.lazy(() => import("./SuperAdmin/SuperSettings/SuperProfile.jsx"));
const AllGoldsShop = React.lazy(() => import("./SuperAdmin/GoldShopmanegement/AllGoldsShop.jsx"));
const GoldShopDetails = React.lazy(() => import("./SuperAdmin/GoldShopmanegement/GoldShopDetails.jsx"));
const AllSubscriptionPlan = React.lazy(() => import("./SuperAdmin/SubscriptionPlans/AllSubscriptionPlan.jsx"));
const RevenueReports = React.lazy(() => import("./SuperAdmin/SuperReport/RevenueReports.jsx"));
const PaymentManagement = React.lazy(() => import("./SuperAdmin/Paymentmanegement/Payment.jsx"));
const SuperAdminUsers = React.lazy(() => import("./SuperAdmin/Usermanagements/UsersManagements.jsx"));
const Users = React.lazy(() => import("./Admin/Pages/Users.jsx"));
const Category = React.lazy(() => import("./Admin/Categery/Category.jsx"));
const Metals = React.lazy(() => import("./Admin/Metal Type/Metals.jsx"));
const AddProducts = React.lazy(() => import("./Admin/Products/AddProducts.jsx"));
const AllProducts = React.lazy(() => import("./Admin/Products/AllProducts.jsx"));
const CustomerViewProducts = React.lazy(() => import("./Admin/Products/CustomerViewProducts.jsx"));
const CustomerViewProductDetail = React.lazy(() => import("./Admin/Products/CustomerViewProductDetail.jsx"));
const AddStock = React.lazy(() => import("./Admin/Products/AddStock.jsx"));
const ProductDetail = React.lazy(() => import("./Admin/Products/ProductDetail.jsx"));
const StockDetails = React.lazy(() => import("./Admin/Pages/StockDetails.jsx"));
const LoanCustomerManagement = React.lazy(() => import("./Admin/Loanmanagements/LoanCustomerManagement.jsx"));
const LoanCustomerDetails = React.lazy(() => import("./Admin/Loanmanagements/LoanCustomerDetails.jsx"));
const CreateLoan = React.lazy(() => import("./Admin/Loanmanagements/CreateLoan.jsx"));
const AllLoans = React.lazy(() => import("./Admin/Loanmanagements/AllLoans.jsx"));
const LoanDetails = React.lazy(() => import("./Admin/Loanmanagements/LoanDetails.jsx"));
const InterestManagement = React.lazy(() => import("./Admin/Loanmanagements/InterestManagement.jsx"));
const LoanRenewal = React.lazy(() => import("./Admin/Loanmanagements/LoanRenewal.jsx"));
const GoldRelease = React.lazy(() => import("./Admin/Loanmanagements/GoldRelease.jsx"));
const OverdueLoans = React.lazy(() => import("./Admin/Loanmanagements/OverdueLoans.jsx"));
const BannerManagement = React.lazy(() => import("./Admin/Marketing/BannerManagement.jsx"));
const VideoManagement = React.lazy(() => import("./Admin/Marketing/VideoManagement.jsx"));
const Reviews = React.lazy(() => import("./Admin/Pages/Reviews.jsx"));
const Enquiries = React.lazy(() => import("./Admin/Pages/Enquiries.jsx"));
const Settings = React.lazy(() => import("./Admin/Pages/Settings.jsx"));
const FundManagement = React.lazy(() => import("./Admin/Pages/FundManagement.jsx"));
const DailyGoldRate = React.lazy(() => import("./Admin/Pages/DailyGoldRate.jsx"));
const ReceiptSettings = React.lazy(() => import("./Admin/Pages/ReceiptSettings.jsx"));
const HomeSections = React.lazy(() => import("./Admin/Pages/HomeSections.jsx"));
const Profile = React.lazy(() => import("./Admin/Pages/Profile.jsx"));
const Dealers = React.lazy(() => import("./Admin/Dealers/Dealers.jsx"));

const AdminKyc = React.lazy(() => import("./Admin/Kyc/AdminKyc.jsx"));
const BillingManagement = React.lazy(() => import("./Admin/Pages/BillingManagement.jsx"));
const Reports = React.lazy(() => import("./Admin/Pages/Reports.jsx"));
const TackOrders = React.lazy(() => import("./Admin/TackOrders/Tackorders.jsx"));
const AllTackOrders = React.lazy(() => import("./Admin/TackOrders/AllOrder.jsx"));
const TackOrderDetails = React.lazy(() => import("./Admin/TackOrders/OrdersViewdetails.jsx"));

const ErrorPage = React.lazy(() => import("./Admin/Pages/ErrorPage.jsx"));

if (window.location.pathname !== "/" && !window.location.hash) {
  window.location.replace(
    `${window.location.origin}/#${window.location.pathname}${window.location.search}`
  );
}

const router = createHashRouter([
  { path: "/", element: <Login />, errorElement: <ErrorPage /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },

   {
    path: "/superadmin",
    element: (
      <PrivateRoute allowedRoles={["superadmin"]}>
        <AdminProvider>
          <SuperAdminPanel />
        </AdminProvider>
      </PrivateRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <SuperDashboard /> },
      { path: "profile", element: <SuperProfile /> },
      { path: "users", element: <SuperAdminUsers /> },
      { path: "goldshop", element: <AllGoldsShop /> },
      { path: "goldshop/:id", element: <GoldShopDetails /> },
      { path: "subscription-plans", element: <AllSubscriptionPlan /> },
      { path: "payments", element: <PaymentManagement /> },
      { path: "revenue-reports", element: <RevenueReports /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <PrivateRoute allowedRoles={["admin", "superadmin"]}>
        <AdminProvider>
          <AdminPanel />
        </AdminProvider>
      </PrivateRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "users/all", element: <Users /> },
      { path: "kyc", element: <AdminKyc /> },
      { path: "billings", element: <BillingManagement /> },
      { path: "loans/customermanagement", element: <LoanCustomerManagement /> },
      { path: "loans/customers/:id", element: <LoanCustomerDetails /> },
      { path: "loans/createloan", element: <CreateLoan /> },
      { path: "loans/edit/:id", element: <CreateLoan /> },
      { path: "loans/allloans", element: <AllLoans /> },
      { path: "loans/details/:id", element: <LoanDetails /> },
      { path: "loans/interestmanagement", element: <InterestManagement /> },
      { path: "loans/overdueloans", element: <OverdueLoans /> },
      { path: "loans/loanreniwel", element: <LoanRenewal /> },
      { path: "loans/loanreniwel/:id", element: <LoanRenewal /> },
      { path: "loans/goldrelease", element: <GoldRelease /> },
      { path: "loans/goldrelease/:id", element: <GoldRelease /> },
      { path: "loans/completeloan", element: <GoldRelease /> },
      { path: "loans/completeloan/:id", element: <GoldRelease /> },
      { path: "products/category", element: <Category /> },
      { path: "products/add", element: <AddProducts /> },
      { path: "products/all", element: <AllProducts /> },
      { path: "customer-view-products", element: <CustomerViewProducts /> },
      { path: "customer-view-products/:id", element: <CustomerViewProductDetail /> },
      { path: "products/stock", element: <StockDetails /> },
      { path: "products/stock/add", element: <AddStock /> },
      { path: "products/edit/:id", element: <AddProducts /> },
      { path: "products/:id", element: <ProductDetail /> },
      { path: "metals", element: <Metals /> },
      { path: "banners", element: <BannerManagement /> },
      { path: "videos", element: <VideoManagement /> },
      { path: "reviews", element: <Reviews /> },
      { path: "reports", element: <Reports /> },
      { path: "dealers", element: <Dealers /> },
      { path: "dealers/*", element: <Dealers /> },
      { path: "settings", element: <Settings /> },
      {
        path: "funds",
        element: (
          <PrivateRoute allowedRoles={["admin"]}>
            <FundManagement />
          </PrivateRoute>
        )
      },
      { path: "settings/daily-gold-rate", element: <DailyGoldRate /> },
      { path: "settings/receipt", element: <ReceiptSettings /> },
      { path: "settings/home-sections", element: <HomeSections /> },
      { path: "profile", element: <Profile /> },
      { path: "enquiries", element: <Enquiries /> },
      { path: "enquiries/new", element: <Enquiries /> },
      { path: "enquiries/edit/:id", element: <Enquiries /> },
      { path: "tack-orders", element: <TackOrders /> },
      { path: "tackAllOrders", element: <AllTackOrders /> },
      { path: "tackAllOrders/:id", element: <TackOrderDetails /> },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <StoreProvider>
      <GoldRatesProvider>
        <Toaster position="top-left" reverseOrder={false} />
        <React.Suspense fallback={<Loader />}>
          <RouterProvider router={router} />
        </React.Suspense>
      </GoldRatesProvider>
    </StoreProvider>
  </AuthProvider>
);
