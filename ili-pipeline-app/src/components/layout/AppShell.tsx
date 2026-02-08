import { Outlet, NavLink } from 'react-router-dom';
import { Upload, LayoutDashboard, Cylinder } from 'lucide-react';

const navItems = [
  { to: '/', icon: Upload, label: 'Upload Data' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

export function AppShell() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Cylinder className="h-6 w-6 text-blue-700 mr-2" />
          <span className="font-bold text-lg text-gray-900">ILI Inspector</span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            ILI Pipeline Inspector v1.0
          </p>
          <p className="text-xs text-gray-400">
            Powered by Gemini AI
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
