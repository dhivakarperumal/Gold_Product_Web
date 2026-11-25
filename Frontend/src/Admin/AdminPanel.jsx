import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const AdminLayout = () => {
    const { pathname } = useLocation();
    const isTackOrdersPage = pathname === "/admin/tack-orders";
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [tackOrdersSearch, setTackOrdersSearch] = useState("");
    const [isLargeScreen, setIsLargeScreen] = useState(
        window.innerWidth >= 1024
    );

    useEffect(() => {
        const handleResize = () => {
            const isLg = window.innerWidth >= 1024;
            setIsLargeScreen(isLg);
            if (isLg) setSidebarOpen(false);
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="admin-root flex min-h-screen bg-[#F4F7F6] text-slate-900">

            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content */}
            <div
                className={`
          flex flex-col flex-1 min-w-0 min-h-screen
          transition-all duration-300 ease-in-out
          ${isLargeScreen ? (sidebarCollapsed ? "lg:ml-20" : "lg:ml-72") : ""}
        `}
            >
                {/* Header */}
                <Header
                    onMenuClick={() => setSidebarOpen(true)}
                    productSearch={isTackOrdersPage ? tackOrdersSearch : undefined}
                    onProductSearchChange={setTackOrdersSearch}
                />

                {/* Page Content */}
                <main className={`flex-1 overflow-y-auto ${isTackOrdersPage ? "flex min-h-0 flex-col p-0" : "p-4 sm:p-5 lg:p-6"}`}>
                    <div className={`glass-container ${isTackOrdersPage ? "flex min-h-0 flex-1 flex-col" : ""}`}>
                        <Outlet context={{ tackOrdersSearch, setTackOrdersSearch }} />
                    </div>
                </main>

                {/* Footer */}
                {!isTackOrdersPage && (
                    <footer className="glass-footer mt-10 border-t border-slate-200 bg-white/80 px-4 py-4 text-center text-xs font-medium text-slate-500">
                        © {new Date().getFullYear()} Q-Techx Solutions. All rights reserved.
                    </footer>
                )}

            </div>
        </div>
    );
};

export default AdminLayout;
