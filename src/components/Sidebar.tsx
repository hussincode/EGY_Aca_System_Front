import { BarChartSquare02, Folder, HomeLine, MessageChatCircle, PieChart03, Rows01, Settings01 } from "@untitledui/icons";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import logo from "@/assets/logo.jpg";
import AppIcon from "@/components/AppIcon";

const sidebarSections = [
    {
        label: "القائمة الرئيسية",
        items: [
            { label: "لوحة التحكم", to: "/", icon: BarChartSquare02 },
            { label: "اللاعبين", to: "/players", icon: HomeLine },
            { label: "المدربين والموظفين", to: "/staff", icon: MessageChatCircle },
            { label: "الفروع", to: "/branches", icon: Folder },
            { label: "السفراء", to: "/ambassadors", icon: Rows01 },
            { label: "العملاء المحتملين", to: "/leads", icon: MessageChatCircle },
            { label: "الألعاب", to: "/games", icon: PieChart03 },
            { label: "الاشتراكات", to: "/subscriptions", icon: Rows01 },
            { label: "الحضور", to: "/attendance", icon: Settings01 },
        ],
    },
    {
        label: "المالية",
        items: [
            { label: "الإيرادات والمصروفات", to: "/financ", icon: BarChartSquare02 },
            { label: "المتجر", to: "/store-synced", icon: Folder },
        ],
    },
    {
        label: "الإدارة",
        items: [{ label: "المستخدمين", to: "/users", icon: Settings01 }],
    },
];

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-300 ${
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                }`}
                onClick={() => setIsOpen(false)}
            />

            <aside
                onMouseEnter={() => setIsOpen(true)}
                onMouseLeave={() => setIsOpen(false)}
                className={`fixed right-0 top-0 z-50 h-full border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl transition-all duration-300 ${
                    isOpen ? "w-72 px-5 py-6 overflow-y-auto hide-scrollbar" : "w-16 px-1 py-4 overflow-hidden"
                }`}
            >
                <div className="mb-10 transition-all duration-300">
                    <div className={`flex items-center gap-3 ${isOpen ? "justify-start" : "justify-center"}`}>
                        <img src={logo} alt="Academy Logo" className="h-10 w-10 rounded-xl object-cover" />
                        <div className={`${isOpen ? "block" : "hidden"}`}>
                            <h2 className="text-2xl font-semibold">ايجي سبورتنج كلوب</h2>
                            <p className="mt-1 text-sm text-slate-400">نظام الإدارة</p>
                        </div>
                    </div>
                </div>

                <nav className="space-y-6">
                    {sidebarSections.map((section) => (
                        <div key={section.label}>
                            <div className={`${isOpen ? "mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500" : "hidden"}`}>
                                {section.label}
                            </div>
                            <ul className="space-y-2">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <li key={item.to}>
                                            <NavLink
                                                to={item.to}
                                                className={({ isActive }) =>
                                                    `group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                                                        isActive
                                                            ? "bg-slate-800 text-white"
                                                            : "text-slate-300 hover:bg-slate-900 hover:text-white"
                                                    } ${isOpen ? "justify-start" : "justify-center"}`
                                                }
                                            >
                                                <AppIcon icon={Icon} className="group-hover:text-slate-200" />
                                                <span className={`${isOpen ? "block" : "hidden"} text-sm`}>{item.label}</span>
                                            </NavLink>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className={`mt-8 border-t border-slate-800 pt-4 transition-all duration-300 ${isOpen ? "block" : "hidden"}`}>
                    <div className="space-y-2 text-sm text-slate-300">
                        <NavLink
                            to="/settings"
                            className="flex items-center gap-3 rounded-2xl bg-slate-900 px-3 py-3 text-white transition hover:bg-slate-800"
                        >
                            <AppIcon icon={Settings01} className="text-slate-300" />
                            إعدادات النظام
                        </NavLink>
                        <button
                            type="button"
                            onClick={() => alert('تسجيل الخروج')}
                            className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-3 py-3 text-left text-slate-300 transition hover:bg-slate-800"
                        >
                            <span className="text-slate-300">⇦</span>
                            تسجيل الخروج
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;