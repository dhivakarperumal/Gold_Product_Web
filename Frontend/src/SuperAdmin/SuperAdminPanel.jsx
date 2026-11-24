import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./SuperSidebar.jsx";
import Header from "./SuperHeader.jsx";

const SuperAdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        <div className="admin-root flex min-h-screen bg-[#F8F9FC] text-slate-900">

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
                <Header onMenuClick={() => setSidebarOpen(true)} />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <div className="glass-container">
                        <Outlet />
                    </div>
                </main>

                {/* Footer */}
                <footer className="glass-footer border-t border-slate-200 bg-white px-4 py-4 text-center text-xs font-medium text-slate-500">
                    © {new Date().getFullYear()} Q-Techx Solutions. All rights reserved.
                </footer>

            </div>
        </div>
    );
};

export default SuperAdminLayout;
