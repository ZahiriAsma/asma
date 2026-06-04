import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, FileText, Package, Users, BarChart3, CalendarDays, Settings, LogOut,
  FileSpreadsheet, AlertTriangle, ArrowRight, ChevronRight, Clock, AlertCircle, TrendingUp, Search, Bell, X,
  PieChart as PieChartIcon, Menu
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import MarchesContent from './MarchesContent';
import FournisseursContent from './FournisseursContent';
import MenusContent from './MenusContent';
import ParametresContent from './ParametresContent';
import BordereauContent from './BordereauContent';
import StockContent from './StockContent';
import { useDashboard } from '../context/DashboardContext';
import api from '../api/axios';
import dashboardLogo from '../assets/dashboard-logo.jpg';
import useMediaQuery from '../hooks/useMediaQuery';

const CustomTooltip = ({ active, payload, label, isDark, clr }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: clr.card, padding: '12px', border: `1px solid ${clr.cardBorder}`, borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', color: clr.text, fontSize: '12px' }}>
        <p style={{ fontWeight: 'bold', marginBottom: '8px', borderBottom: `1px solid ${clr.cardBorder}`, paddingBottom: '4px', margin: '0 0 8px 0' }}>{data.name}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: '#2563eb', fontWeight: '600' }}>Budget Total:</span>
            <span>{(data.budget_total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Budget Consommé:</span>
            <span>{(data.budget_consomme || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: '#f59e0b', fontWeight: '600' }}>Budget Restant:</span>
            <span>{(data.budget_restant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '4px', paddingTop: '4px', borderTop: `1px dotted ${clr.cardBorder}` }}>
            <span style={{ fontWeight: '600' }}>Pourcentage Consommé:</span>
            <span style={{ fontWeight: 'bold' }}>{data.pourcentage_consomme || 0} %</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const PieCustomTooltip = ({ active, payload, clr }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: clr.card, padding: '8px 12px', border: `1px solid ${clr.cardBorder}`, borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', color: clr.text, fontSize: '12px' }}>
        <span style={{ fontWeight: '600', marginRight: '8px' }}>{data.name} :</span>
        <span>{(data.value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
      </div>
    );
  }
  return null;
};

const DashboardPage = () => {
  const { isMobile, isTablet } = useMediaQuery();
  const isMobileOrTablet = isMobile || isTablet;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [marchesFilterFournisseurId, setMarchesFilterFournisseurId] = useState(null);

  const {
    notifications,
    unreadCount,
    showNotifications,
    setShowNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    sysConfig,
  } = useDashboard();

  const isDark = sysConfig?.theme === 'dark';
  const lang = sysConfig?.language || 'fr';
  const isRtl = lang === 'ar';

  // Translation map for nav/shell & dashboard content
  const NAV_T = {
    fr: {
      dashboard: 'Tableau de bord', marches: 'Marchés', stock: 'Stock', fournisseurs: 'Fournisseurs',
      rapports: 'Rapports & statistiques', menus: 'Menus journaliers', parametres: 'Paramètres',
      bordereau: 'Import Bordereau', facture: 'Factures',
      navMain: 'NAVIGATION PRINCIPALE', analyse: 'ANALYSE', systeme: 'SYSTÈME',
      search: 'Rechercher produit, marché, fournisseur...', logout: 'Déconnexion',
      brand: 'Gestion des internats OFPPT', welcome: 'Bonjour', underControl: 'Tout est sous contrôle.',
      fillRate: 'Taux de remplissage', notifications: 'Notifications', markAll: 'Tout marquer comme lu', noNotif: 'Aucune notification pour le moment.',
      activeTenders: 'MARCHÉS ACTIFS', stockProducts: 'PRODUITS EN STOCK', suppliers: 'FOURNISSEURS', stockAlerts: 'ALERTES DE STOCK',
      monthlyConsumption: 'Consommation mensuelle (2024)', budgetDistribution: 'Répartition budget',
      latestOrders: 'Dernières commandes', alerts: 'Alertes', seeAll: 'Voir tout', report: 'Rapport',
      backToDashboard: 'Retour au Tableau de Bord', planMenus: 'Planifier des Menus',
      stockManagement: 'Gestion des Stocks Alimentaires',
      stockManagementDesc: 'Suivez en temps réel les quantités d\'ingrédients disponibles, configurez les seuils d\'alerte et gérez les entrées/sorties de magasin.',
      reportsFinancials: 'Rapports & Statistiques Financières',
      reportsFinancialsDesc: 'Générez des rapports mensuels détaillés sur la consommation des denrées, le respect du budget par résident et l\'évolution des stocks.',
      orderNo: 'N° MARCHÉ', supplier: 'FOURNISSEUR', product: 'PRODUIT', amount: 'MONTANT', status: 'STATUT'
    },
    ar: {
      dashboard: 'لوحة التحكم', marches: 'المناقصات', stock: 'المخزون', fournisseurs: 'الموردون',
      rapports: 'التقارير والإحصاءات', menus: 'قوائم الطعام', parametres: 'الإعدادات',
      bordereau: 'استيراد جدول الأسعار', facture: 'الفواتير',
      navMain: 'التنقل الرئيسي', analyse: 'تحليل', systeme: 'النظام',
      search: 'ابحث عن منتج أو مناقصة أو مورد...', logout: 'تسجيل الخروج',
      brand: 'إدارة داخليات OFPPT', welcome: 'مرحباً', underControl: 'كل شيء تحت السيطرة.',
      fillRate: 'نسبة الإشغال', notifications: 'الإشعارات', markAll: 'تحديد الكل كمقروء', noNotif: 'لا توجد إشعارات حالياً.',
      activeTenders: 'المناقصات النشطة', stockProducts: 'منتجات المخزون', suppliers: 'الموردون النشطون', stockAlerts: 'تنبيهات المخزون',
      monthlyConsumption: 'الاستهلاك الشهري (2024)', budgetDistribution: 'توزيع الميزانية',
      latestOrders: 'آخر الطلبيات', alerts: 'التنبيهات', seeAll: 'عرض الكل', report: 'تقرير',
      backToDashboard: 'العودة للوحة التحكم', planMenus: 'تخطيط الوجبات',
      stockManagement: 'إدارة مخزون الأغذية',
      stockManagementDesc: 'تتبع كميات المكونات المتاحة في الوقت الفعلي، وتكوين عتبات التنبيه وإدارة مدخلات ومخرجات المخزن.',
      reportsFinancials: 'التقارير والإحصاءات المالية',
      reportsFinancialsDesc: 'توليد تقارير شهرية مفصلة عن استهلاك المواد الغذائية، واحترام الميزانية لكل مقيم وتطور المخزون.',
      orderNo: 'رقم المناقصة', supplier: 'المورد', product: 'المنتج', amount: 'المبلغ', status: 'الحالة'
    },
    en: {
      dashboard: 'Dashboard', marches: 'Tenders', stock: 'Stock', fournisseurs: 'Suppliers',
      rapports: 'Reports & Statistics', menus: 'Daily Menus', parametres: 'Settings',
      bordereau: 'Import Bordereau', facture: 'Invoices',
      navMain: 'MAIN NAVIGATION', analyse: 'ANALYSIS', systeme: 'SYSTEM',
      search: 'Search product, tender, supplier...', logout: 'Logout',
      brand: 'OFPPT Internship Management', welcome: 'Hello', underControl: 'Everything is under control.',
      fillRate: 'Fill Rate', notifications: 'Notifications', markAll: 'Mark all as read', noNotif: 'No notifications at the moment.',
      activeTenders: 'ACTIVE TENDERS', stockProducts: 'STOCK PRODUCTS', suppliers: 'SUPPLIERS', stockAlerts: 'STOCK ALERTS',
      monthlyConsumption: 'Monthly Consumption (2024)', budgetDistribution: 'Budget Distribution',
      latestOrders: 'Latest Orders', alerts: 'Alerts', seeAll: 'See all', report: 'Report',
      backToDashboard: 'Back to Dashboard', planMenus: 'Plan Menus',
      stockManagement: 'Food Stock Management',
      stockManagementDesc: 'Track in real-time the quantities of ingredients available, configure alert thresholds and manage store entries/exits.',
      reportsFinancials: 'Financial Reports & Statistics',
      reportsFinancialsDesc: 'Generate detailed monthly reports on food consumption, budget compliance per resident and stock trends.',
      orderNo: 'TENDER NO', supplier: 'SUPPLIER', product: 'PRODUCT', amount: 'AMOUNT', status: 'STATUS'
    }
  };
  const nt = NAV_T[lang] || NAV_T.fr;

  // Dark mode color tokens
  const clr = {
    bg:        isDark ? '#0f172a' : '#f8fafc',
    sidebar:   isDark ? '#020617' : '#0f172a',
    card:      isDark ? '#1e293b' : 'white',
    cardBorder:isDark ? '#334155' : '#e2e8f0',
    header:    isDark ? '#1e293b' : 'white',
    headerBorder: isDark ? '#334155' : '#e2e8f0',
    text:      isDark ? '#f1f5f9' : '#0f172a',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    inputBg:   isDark ? '#0f172a' : '#f8fafc',
    inputBorder: isDark ? '#334155' : '#e2e8f0',
  };

  const [currentUser, setCurrentUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  });

  useEffect(() => {
    const handleProfileUpdate = () => {
      const updatedUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      setCurrentUser(updatedUser);
    };

    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const response = await api.get('/dashboard/stats');
        setDashboardStats(response.data);
      } catch (err) {
        console.error("Erreur lors du chargement des statistiques du Dashboard:", err);
      } finally {
        setLoadingStats(false);
      }
    };
    
    if (activeTab === 'dashboard') {
      fetchStats();
    }
  }, [activeTab]);

  // Sync theme and text direction globally with <html> and <body>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark-theme');
      document.body.classList.add('dark-theme');
      document.documentElement.style.backgroundColor = '#0f172a';
      document.body.style.backgroundColor = '#0f172a';
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.body.classList.remove('dark-theme');
      document.documentElement.style.backgroundColor = '#f8fafc';
      document.body.style.backgroundColor = '#f8fafc';
    }
    document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [isDark, isRtl, lang]);

  const getInitials = (name) => {
    if (!name) return 'KA';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user');
    window.location.href = '/';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = localSearchQuery.toLowerCase().trim();
    if (!q) return;
    if (q.includes('march') || q.includes('contrat') || q.includes('budget')) setActiveTab('marches');
    else if (q.includes('fourn') || q.includes('disma') || q.includes('presta')) setActiveTab('fournisseurs');
    else if (q.includes('stoc') || q.includes('prod') || q.includes('magasin')) setActiveTab('stock');
    else if (q.includes('menu') || q.includes('repas') || q.includes('dejeuner')) setActiveTab('menus');
    else if (q.includes('param') || q.includes('profil') || q.includes('config')) setActiveTab('parametres');
    else if (q.includes('rapport') || q.includes('stat')) setActiveTab('rapports');
    else if (q.includes('border') || q.includes('excel') || q.includes('import')) setActiveTab('bordereau');
    setLocalSearchQuery('');
  };

  const getCurrentDate = () => {
    const now = new Date();
    if (lang === 'ar') {
      return now.toLocaleDateString('ar-MA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
    if (lang === 'en') {
      return now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  };

  const userInternat = currentUser.establishment || 'Internat OFPPT Ouarzazate';

  // Recharts Data
  const barData = [
    { name: 'Jan', val1: 4000, val2: 2400 },
    { name: 'Fev', val1: 3000, val2: 1398 },
    { name: 'Mar', val1: 2000, val2: 4800 },
    { name: 'Avr', val1: 2780, val2: 3908 },
    { name: 'Mai', val1: 1890, val2: 4800 },
    { name: 'Juin', val1: 2390, val2: 3800 },
    { name: 'Juil', val1: 3490, val2: 4300 },
    { name: 'Aout', val1: 4490, val2: 3300 },
    { name: 'Sep', val1: 2890, val2: 4500 },
    { name: 'Oct', val1: 3390, val2: 2500 },
    { name: 'Nov', val1: 3890, val2: 2100 },
    { name: 'Dec', val1: 4290, val2: 3600 },
  ];

  const pieData = [
    { name: 'Alimentation', value: 42, color: '#10b981' },
    { name: 'Hygiène', value: 28, color: '#f59e0b' },
    { name: 'Entretien', value: 15, color: '#3b82f6' },
    { name: 'Divers', value: 15, color: '#ef4444' },
  ];

  // Components for layout
  const NavItem = ({ id, icon: Icon, label, badge, indent = false }) => (
    <button
      onClick={() => { 
        setActiveTab(id); 
        setIsSidebarOpen(false); 
        if (id === 'marches') setMarchesFilterFournisseurId(null);
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '10px 16px',
        backgroundColor: activeTab === id ? '#0f766e' : 'transparent',
        borderLeft: activeTab === id ? '4px solid #10b981' : '4px solid transparent',
        color: activeTab === id ? 'white' : '#cbd5e1',
        border: 'none', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: activeTab === id ? '#10b981' : 'transparent',
        cursor: 'pointer', textAlign: 'left',
        fontSize: '13px', fontWeight: activeTab === id ? '600' : '500',
        transition: 'all 0.2s', borderRadius: '0 8px 8px 0',
        marginBottom: '4px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Icon size={18} style={{ opacity: activeTab === id ? 1 : 0.7 }} />
        {label}
      </div>
      {badge && (
        <span style={{
          backgroundColor: '#ef4444', color: 'white', fontSize: '10px',
          fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px'
        }}>
          {badge}
        </span>
      )}
    </button>
  );

  const NavGroup = ({ title }) => (
    <div style={{
      fontSize: '10px', fontWeight: '700', color: '#64748b',
      letterSpacing: '0.05em', marginTop: '24px', marginBottom: '8px',
      paddingLeft: '20px', textTransform: 'uppercase'
    }}>
      {title}
    </div>
  );

  return (
    <div 
      dir={isRtl ? 'rtl' : 'ltr'} 
      className={isDark ? 'dark-theme' : ''} 
      style={{ display: 'flex', minHeight: '100vh', backgroundColor: clr.bg, fontFamily: isRtl ? "'Noto Sans Arabic','Segoe UI',sans-serif" : "'Inter',sans-serif", transition: 'background-color 0.3s' }}
    >
      <style>{`
        /* Global Dark Mode Overrides for Child Components */
        html.dark-theme,
        body.dark-theme,
        .dark-theme {
          background-color: #0f172a !important;
          color: #f1f5f9 !important;
        }
        .dark-theme h1, .dark-theme h2, .dark-theme h3, .dark-theme h4, .dark-theme h5, .dark-theme h6 {
          color: #f8fafc !important;
        }
        .dark-theme p, .dark-theme label, .dark-theme span:not([style*="color"]):not([style*="background-color"]) {
          color: #cbd5e1 !important;
        }
        .dark-theme [style*="background-color: white"],
        .dark-theme [style*="background-color: rgb(255, 255, 255)"],
        .dark-theme [style*="background-color: rgb(255,255,255)"],
        .dark-theme [style*="background-color: #fff"],
        .dark-theme [style*="background-color:#ffffff"],
        .dark-theme [style*="background-color: #ffffff"] {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border-color: #334155 !important;
        }
        .dark-theme input:not([type="submit"]):not([type="button"]),
        .dark-theme select,
        .dark-theme textarea {
          background-color: #0f172a !important;
          color: #f1f5f9 !important;
          border-color: #334155 !important;
        }
        .dark-theme input::placeholder {
          color: #64748b !important;
        }
        .dark-theme table {
          color: #f1f5f9 !important;
        }
        .dark-theme th {
          color: #94a3b8 !important;
          border-bottom-color: #334155 !important;
        }
        .dark-theme td {
          color: #cbd5e1 !important;
          border-bottom-color: #334155 !important;
        }
        .dark-theme tr {
          border-bottom-color: #334155 !important;
        }
        .dark-theme [style*="border: 1px solid #cbd5e1"],
        .dark-theme [style*="border: 1px solid #cbd5e0"],
        .dark-theme [style*="border: 1px solid #cbd5e2"],
        .dark-theme [style*="border:1px solid #cbd5e1"],
        .dark-theme [style*="border-color: #cbd5e1"] {
          border-color: #334155 !important;
        }
        .dark-theme [style*="border: 1px solid #e2e8f0"],
        .dark-theme [style*="border:1px solid #e2e8f0"] {
          border-color: #334155 !important;
        }
        .dark-theme [style*="border-bottom: 1px solid #f1f5f9"],
        .dark-theme [style*="border-bottom:1px solid #f1f5f9"],
        .dark-theme [style*="border-bottom: 1px solid #cbd5e1"] {
          border-bottom-color: #334155 !important;
        }
        .dark-theme [style*="background-color: rgba(0, 0, 0, 0.5)"],
        .dark-theme [style*="background-color:rgba(0,0,0,0.5)"] {
          background-color: rgba(0, 0, 0, 0.75) !important;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          cursor: pointer;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03) !important;
        }
        .stat-card::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 4px;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stat-card:hover::after {
          transform: scaleX(1);
        }
        .stat-card-blue::after {
          background: linear-gradient(90deg, #2563eb, #10b981) !important;
        }
        .stat-card-green::after {
          background: linear-gradient(90deg, #10b981, #0f766e) !important;
        }
        .stat-card-orange::after {
          background: linear-gradient(90deg, #f59e0b, #eab308) !important;
        }
        .stat-card-red::after {
          background: linear-gradient(90deg, #ef4444, #f87171) !important;
        }
      `}</style>

      {/* Sidebar overlay backdrop */}
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />

      <aside className={`sidebar-responsive ${isSidebarOpen ? 'active' : ''}`} style={{
        width: '260px', backgroundColor: clr.sidebar, color: 'white',
        display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'background-color 0.3s'
      }}>
        {isMobileOrTablet && (
          <div className="mobile-sidebar-close" style={{ display: 'none' }}>
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '8px' }}>
              <X size={20} />
            </button>
          </div>
        )}

        {/* Brand */}
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', background: 'white',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden'
          }}>
            <img src={dashboardLogo} alt="InterNat Stock Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>InterNat Stock</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{nt.brand}</div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: isRtl ? '0' : '12px', paddingLeft: isRtl ? '12px' : '0' }}>
          <NavGroup title={nt.navMain} />
          <NavItem id="dashboard" icon={LayoutDashboard} label={nt.dashboard} />
          <NavItem id="marches" icon={FileText} label={nt.marches} badge="2" />
          <NavItem id="stock" icon={Package} label={nt.stock} />
          <NavItem id="fournisseurs" icon={Users} label={nt.fournisseurs} />
          <NavItem id="bordereau" icon={FileSpreadsheet} label={nt.bordereau} />

          <NavGroup title={nt.analyse} />
          <NavItem id="menus" icon={CalendarDays} label={nt.menus} />

          <NavGroup title={nt.systeme} />
          <NavItem id="parametres" icon={Settings} label={nt.parametres} />
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          backgroundColor: clr.header, padding: isMobile ? '12px 16px' : '16px 32px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${clr.headerBorder}`,
          transition: 'background-color 0.3s, border-color 0.3s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: clr.textMuted, fontWeight: '500' }}>
            {isMobileOrTablet && (
              <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)} style={{ color: clr.text, marginRight: isRtl ? '0' : '12px', marginLeft: isRtl ? '12px' : '0' }}>
                <Menu size={20} />
              </button>
            )}
            <span style={{ color: '#94a3b8' }}>InterNat Stock</span>
            <ChevronRight size={14} style={{ margin: '0 8px', transform: isRtl ? 'rotate(180deg)' : 'none' }} />
            <span style={{ color: clr.text, fontWeight: '600' }}>
              {activeTab === 'dashboard' && nt.dashboard}
              {activeTab === 'marches' && nt.marches}
              {activeTab === 'fournisseurs' && nt.fournisseurs}
              {activeTab === 'bordereau' && nt.bordereau}
              {activeTab === 'menus' && nt.menus}
              {activeTab === 'parametres' && nt.parametres}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '20px' }}>
            {/* Search */}
            <form onSubmit={handleSearch} style={{ position: 'relative', width: isMobile ? '160px' : '320px' }}>
              <Search size={16} style={{ position: 'absolute', [isRtl ? 'right' : 'left']: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="search"
                placeholder={nt.search}
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: isRtl ? '9px 12px 9px 36px' : '9px 36px 9px 36px',
                  paddingLeft: isRtl ? '36px' : '36px',
                  paddingRight: isRtl ? '36px' : '36px',
                  backgroundColor: clr.inputBg,
                  border: `1.5px solid ${clr.inputBorder}`, borderRadius: '8px', outline: 'none',
                  fontSize: '13px', color: clr.text, transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0f766e'; e.target.style.boxShadow = '0 0 0 3px rgba(15,118,110,0.1)'; setShowNotifications(false); }}
                onBlur={(e) => { e.target.style.borderColor = clr.inputBorder; e.target.style.boxShadow = 'none'; }}
              />
              {localSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLocalSearchQuery('')}
                  style={{ position: 'absolute', [isRtl ? 'left' : 'right']: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Visual Divider */}
            <div style={{ width: '1px', height: '24px', backgroundColor: clr.headerBorder, margin: '0 4px' }} />

            {/* Icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: clr.textMuted, position: 'relative' }}>
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{ 
                    position: 'absolute', top: '-4px', right: '-4px', 
                    minWidth: '16px', height: '16px', backgroundColor: '#ef4444', 
                    borderRadius: '50%', color: 'white', fontSize: '9px', fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveTab('parametres')}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Settings size={20} />
              </button>

              {/* Notification Dropdown List */}
              {showNotifications && (
                <div style={{
                  position: 'absolute', top: '100%', [isRtl ? 'left' : 'right']: '40px',
                  backgroundColor: clr.card, border: `1px solid ${clr.cardBorder}`,
                  borderRadius: '12px', marginTop: '12px', width: '360px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  zIndex: 100, padding: '0', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${clr.cardBorder}` }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: clr.text }}>{nt.notifications}</span>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllNotificationsRead}
                        style={{ border: 'none', background: 'none', color: '#0f766e', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        {nt.markAll}
                      </button>
                    )}
                  </div>
                  
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: clr.textMuted }}>
                        {nt.noNotif}
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id}
                          onClick={() => {
                            if (notif.tab) {
                              setActiveTab(notif.tab);
                            }
                            markNotificationRead(notif.id);
                            setShowNotifications(false);
                          }}
                          style={{
                            padding: '12px 16px', borderBottom: `1px solid ${clr.cardBorder}`,
                            backgroundColor: notif.read ? 'transparent' : (isDark ? 'rgba(16,185,129,0.05)' : '#f0fdf4'),
                            cursor: 'pointer', transition: 'background-color 0.2s',
                            display: 'flex', gap: '10px', alignItems: 'flex-start'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = notif.read ? (isDark ? '#334155' : '#f8fafc') : (isDark ? 'rgba(16,185,129,0.1)' : '#e6fbf0')}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : (isDark ? 'rgba(16,185,129,0.05)' : '#f0fdf4')}
                        >
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: notif.type === 'alert' ? '#fef2f2' : (notif.type === 'warning' ? '#fffbeb' : '#f0fdf4'),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {notif.type === 'alert' ? (
                              <AlertCircle size={14} color="#ef4444" />
                            ) : (notif.type === 'warning' ? (
                              <AlertTriangle size={14} color="#d97706" />
                            ) : (
                              <Bell size={14} color="#10b981" />
                            ))}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                              <span style={{ fontWeight: '600', fontSize: '12px', color: clr.text }}>{notif.title}</span>
                              <span style={{ fontSize: '9px', color: clr.textMuted }}>
                                {new Date(notif.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11px', color: clr.textMuted, lineHeight: '1.4' }}>
                              {notif.message}
                            </p>
                          </div>
                          {!notif.read && (
                            <div style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', marginTop: '6px', alignSelf: 'center' }}></div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#94a3b8', padding: '4px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', alignSelf: 'center'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f1f5f9';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#94a3b8';
                            }}
                            title="Supprimer la notification"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar Small with Dropdown */}
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => {
                  setShowProfileDropdown(!showProfileDropdown);
                  setShowNotifications(false);
                }}
                style={{ width: '32px', height: '32px', backgroundColor: '#0f766e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {getInitials(currentUser.name)}
              </div>
              
              {/* Profile Dropdown */}
              {showProfileDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', [isRtl ? 'left' : 'right']: '0',
                  backgroundColor: clr.card, border: `1px solid ${clr.cardBorder}`,
                  borderRadius: '12px', marginTop: '12px', width: '220px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  zIndex: 100, padding: '16px', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{
                      width: '36px', height: '36px', backgroundColor: '#0f766e',
                      borderRadius: '8px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', position: 'relative'
                    }}>
                      {getInitials(currentUser.name)}
                      <div style={{
                        position: 'absolute', bottom: '-2px', right: '-2px', width: '10px', height: '10px',
                        backgroundColor: '#10b981', border: `2px solid ${clr.card}`, borderRadius: '50%'
                      }}></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: clr.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {currentUser.name || 'Utilisateur'}
                      </div>
                      <div style={{ fontSize: '11px', color: clr.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {currentUser.email || 'Gestionnaire'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '8px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '8px',
                      color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer', justifyContent: 'center',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  >
                    <LogOut size={14} style={{ transform: isRtl ? 'rotate(180deg)' : 'none' }} /> {nt.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'dashboard' && (
            <div style={{ padding: isMobile ? '16px' : '32px', maxWidth: '1200px', margin: '0 auto' }}>

              {/* Welcome Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #0f766e 0%, #10b981 100%)',
                borderRadius: '16px', padding: isMobile ? '20px 24px' : '28px 32px', color: 'white',
                display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '16px' : '0',
                justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
                boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)', marginBottom: '24px'
              }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0' }}>{nt.welcome}, {currentUser.name || 'Karim'}</h1>
                  <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>{getCurrentDate()} - {userInternat} - {nt.underControl}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '800' }}>94%</div>
                    <div style={{ fontSize: '11px', opacity: 0.9, textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>{nt.fillRate}</div>
                  </div>
                </div>
              </div>

              {/* 4 Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
                {loadingStats ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: clr.textMuted }}>Chargement des statistiques...</div>
                ) : (
                  [
                    { 
                      label: nt.activeTenders, 
                      value: dashboardStats?.active_marches_count ?? 0, 
                      trend: 'Total Actifs', 
                      icon: <FileSpreadsheet size={20} color="#2563eb" />, 
                      bg: 'rgba(37,99,235,0.1)', tColor: '#10b981' 
                    },
                    { 
                      label: nt.stockProducts, 
                      value: dashboardStats?.products_in_stock_count ?? 0, 
                      trend: 'En Magasin', 
                      icon: <Package size={20} color="#10b981" />, 
                      bg: 'rgba(16,185,129,0.1)', tColor: '#10b981' 
                    },
                    { 
                      label: nt.suppliers, 
                      value: dashboardStats?.fournisseurs_count ?? 0, 
                      trend: 'Total Fournisseurs', 
                      icon: <Users size={20} color="#2563eb" />, 
                      bg: 'rgba(37,99,235,0.1)', tColor: '#f59e0b' 
                    },
                    { 
                      label: 'Marché Critique', 
                      value: dashboardStats?.critical_alert ? `${dashboardStats.critical_alert.percentage}%` : '0%', 
                      trend: dashboardStats?.critical_alert ? dashboardStats.critical_alert.titulaire : 'Aucune alerte', 
                      icon: <AlertCircle size={20} color="#ef4444" />, 
                      bg: 'rgba(239,68,68,0.1)', tColor: '#ef4444' 
                    }
                  ].map((stat, i) => {
                    const classes = ['stat-card-blue', 'stat-card-green', 'stat-card-orange', 'stat-card-red'];
                    return (
                      <div key={i}
                        className={`stat-card ${classes[i]}`}
                        style={{ backgroundColor: clr.card, borderRadius: '16px', padding: '20px', border: `1px solid ${clr.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'background-color 0.3s, border-color 0.3s' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: clr.textMuted, letterSpacing: '0.05em' }}>{stat.label}</div>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {stat.icon}
                          </div>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: clr.text, marginBottom: '8px' }}>{stat.value}</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: stat.tColor, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {stat.trend.includes('+') ? <TrendingUp size={14} /> : (stat.tColor === '#ef4444' ? <AlertTriangle size={14} /> : null)}
                          {stat.trend}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* Charts Section */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobileOrTablet ? '1fr' : '2fr 1fr', gap: '20px', marginBottom: '24px' }}>

                {/* Bar Chart — Budget Total vs Consommé par Marché */}
                <div style={{ backgroundColor: clr.card, borderRadius: '16px', padding: '24px', border: `1px solid ${clr.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'background-color 0.3s, border-color 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: clr.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BarChart3 size={18} color="#0f766e" />
                      Budget par Marché
                    </h3>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', fontWeight: '600', color: clr.textMuted }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#2563eb', display: 'inline-block' }}></span>Budget Total</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981', display: 'inline-block' }}></span>Consommé</span>
                    </div>
                  </div>
                  <div style={{ height: '240px', width: '100%', overflowX: 'auto' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={dashboardStats?.marches_chart || []} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: isDark ? '#94a3b8' : '#94a3b8' }} dy={10} tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '…' : v} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                        <Tooltip
                          cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                          contentStyle={{ borderRadius: '10px', border: 'none', backgroundColor: clr.card, color: clr.text, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '12px 16px' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              const pct = d.budget_total > 0 ? ((d.budget_consomme / d.budget_total) * 100).toFixed(1) : 0;
                              return (
                                <div style={{ backgroundColor: clr.card, border: `1px solid ${clr.cardBorder}`, borderRadius: '10px', padding: '12px 16px', fontSize: '12px' }}>
                                  <div style={{ fontWeight: '700', color: clr.text, marginBottom: '8px', maxWidth: '200px' }}>{d.name}</div>
                                  <div style={{ color: '#2563eb', marginBottom: '4px' }}>● Budget Total : <strong>{d.budget_total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</strong></div>
                                  <div style={{ color: '#10b981', marginBottom: '4px' }}>● Consommé : <strong>{d.budget_consomme.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</strong></div>
                                  <div style={{ color: clr.textMuted }}>● Taux : <strong>{pct}%</strong></div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="budget_total" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={10} name="Budget Total" />
                        <Bar dataKey="budget_consomme" fill="#10b981" radius={[4, 4, 0, 0]} barSize={10} name="Budget Consommé" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pie Chart — Répartition des budgets par Marché */}
                <div style={{ backgroundColor: clr.card, borderRadius: '16px', padding: '24px', border: `1px solid ${clr.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'background-color 0.3s, border-color 0.3s', overflow: 'hidden' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: clr.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PieChartIcon size={18} color="#0f766e" />
                    Répartition Budget
                  </h3>
                  {(() => {
                    const PIE_COLORS = ['#0f766e','#2563eb','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#10b981','#ec4899','#f97316','#84cc16'];
                    const pieData = (dashboardStats?.marches_pie || []).map((m, i) => ({
                      name: m.name,
                      value: m.budget_total,
                      percentage: m.percentage,
                      color: PIE_COLORS[i % PIE_COLORS.length]
                    }));
                    const grandTotal = dashboardStats?.grand_total_budget || 0;
                    const grandTotalK = grandTotal >= 1000000
                      ? `${(grandTotal / 1000000).toFixed(2)}M`
                      : grandTotal >= 1000 ? `${Math.round(grandTotal / 1000)}K` : `${Math.round(grandTotal)}`;

                    return (
                      <>
                        <div style={{ height: '170px', width: '100%', position: 'relative' }}>
                          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <RechartsPieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              </Pie>
                              <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: clr.card, color: clr.text, boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '12px' }}
                                formatter={(value, name) => [`${value.toLocaleString('fr-FR')} MAD`, name]}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: clr.text, lineHeight: 1.1 }}>{grandTotalK}</div>
                            <div style={{ fontSize: '9px', color: clr.textMuted, fontWeight: '600', marginTop: '2px' }}>Budget Total</div>
                            <div style={{ fontSize: '9px', color: clr.textMuted, fontWeight: '500' }}>MAD</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                          {pieData.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: clr.textMuted }}>
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }}></div>
                              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                              <div style={{ fontWeight: '700', color: clr.text, flexShrink: 0 }}>{item.percentage}%</div>
                            </div>
                          ))}
                          {pieData.length === 0 && <div style={{ textAlign: 'center', color: clr.textMuted, fontSize: '12px' }}>Aucun marché</div>}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>


              {/* Bottom Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

                {/* Table */}
                <div style={{ backgroundColor: clr.card, borderRadius: '16px', padding: '24px', border: `1px solid ${clr.cardBorder}`, boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'background-color 0.3s, border-color 0.3s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: clr.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#0f766e" />
                      {nt.latestOrders}
                    </h3>
                    <button style={{ backgroundColor: 'transparent', border: `1px solid ${clr.cardBorder}`, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: clr.textMuted, cursor: 'pointer', transition: 'all 0.2s' }}>{nt.seeAll}</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${clr.cardBorder}`, textAlign: isRtl ? 'right' : 'left', fontSize: '11px', color: clr.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          <th style={{ paddingBottom: '12px', fontWeight: '600' }}>{nt.orderNo}</th>
                          <th style={{ paddingBottom: '12px', fontWeight: '600' }}>N° MARCHÉ</th>
                          <th style={{ paddingBottom: '12px', fontWeight: '600' }}>{nt.supplier}</th>
                          <th style={{ paddingBottom: '12px', fontWeight: '600' }}>{nt.amount}</th>
                          <th style={{ paddingBottom: '12px', fontWeight: '600' }}>{nt.status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingStats ? (
                          <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: clr.textMuted }}>Chargement des commandes...</td></tr>
                        ) : (!dashboardStats?.latest_orders || dashboardStats.latest_orders.length === 0) ? (
                          <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: clr.textMuted }}>Aucune commande récente</td></tr>
                        ) : (
                          dashboardStats.latest_orders.map((row, i) => (
                            <tr key={i} style={{ borderBottom: i !== (dashboardStats.latest_orders.length - 1) ? `1px solid ${clr.cardBorder}` : 'none' }}>
                              <td style={{ padding: '16px 0', fontSize: '13px', fontWeight: '600', color: '#0f766e', textAlign: isRtl ? 'right' : 'left' }}>{row.id}</td>
                              <td style={{ padding: '16px 0', fontSize: '13px', color: clr.textMuted, textAlign: isRtl ? 'right' : 'left', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.marche}</td>
                              <td style={{ padding: '16px 0', fontSize: '13px', color: clr.text, fontWeight: '500', textAlign: isRtl ? 'right' : 'left' }}>{row.fournisseur}</td>
                              <td style={{ padding: '16px 0', fontSize: '13px', fontWeight: '600', color: clr.text, textAlign: isRtl ? 'right' : 'left' }}>{row.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                              <td style={{ padding: '16px 0', textAlign: isRtl ? 'right' : 'left' }}>
                                <span style={{ 
                                  backgroundColor: row.statut === 'Livré' || row.statut === 'Validé' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', 
                                  color: row.statut === 'Livré' || row.statut === 'Validé' ? '#10b981' : '#f59e0b', 
                                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' 
                                }}>
                                  {row.statut}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}
          {activeTab === 'stock' && <StockContent />}
          {activeTab === 'marches' && <MarchesContent filterFournisseurId={marchesFilterFournisseurId} onClearFournisseurFilter={() => setMarchesFilterFournisseurId(null)} />}
          {activeTab === 'fournisseurs' && <FournisseursContent onNavigateToMarches={(fournisseurId) => {
            setMarchesFilterFournisseurId(fournisseurId);
            setActiveTab('marches');
          }} />}
          {activeTab === 'bordereau' && <BordereauContent />}
          {activeTab === 'menus' && <MenusContent />}
          {activeTab === 'parametres' && <ParametresContent />}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
