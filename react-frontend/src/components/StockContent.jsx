import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package, Search, Download, Calendar, Loader2,
  RefreshCw, TrendingDown, AlertTriangle, CheckCircle,
  XCircle, BarChart3, Archive, PlusCircle, Trash2, HelpCircle, FileText
} from 'lucide-react';
import api from '../api/axios';
import * as XLSX from 'xlsx';
import stockInitialLogo from '../assets/stock-initial-logo.png';
import useMediaQuery from '../hooks/useMediaQuery';

/* ─────────────────────────────────────────────────────────────
   Helper: status badge config
   ───────────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  'En Stock': {
    color: '#16a34a',
    bg: '#dcfce7',
    border: '#bbf7d0',
    icon: CheckCircle,
    label: 'En Stock',
  },
  'Stock Faible': {
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fde68a',
    icon: AlertTriangle,
    label: 'Stock Faible',
  },
  'Rupture de Stock': {
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fecaca',
    icon: XCircle,
    label: 'Rupture',
  },
};

/* ─────────────────────────────────────────────────────────────
   Sub-component: Stat Card
   ───────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, subtitle, accent, icon: Icon, iconBg }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '16px 20px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    transition: 'transform 0.2s, box-shadow 0.2s',
  }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
    }}
  >
    <div style={{
      width: '44px', height: '44px', borderRadius: '10px',
      backgroundColor: iconBg || '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={20} color={accent || '#64748b'} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 2px 0', fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: 1.1 }}>
        {value}
      </h3>
      {subtitle && (
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   Sub-component: Status Badge
   ───────────────────────────────────────────────────────────── */
const StatusBadge = ({ statut }) => {
  const cfg = STATUS_CONFIG[statut] || STATUS_CONFIG['En Stock'];
  const Icon = cfg.icon;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '20px',
      backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: '11px', fontWeight: '700', color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={11} />
      {cfg.label}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Sub-component: Remaining quantity badge
   ───────────────────────────────────────────────────────────── */
const RemainingBadge = ({ value, statut }) => {
  const cfg = STATUS_CONFIG[statut] || STATUS_CONFIG['En Stock'];
  return (
    <div style={{
      display: 'inline-block', padding: '5px 12px',
      borderRadius: '20px', fontSize: '13px', fontWeight: '800',
      backgroundColor: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {value}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main Component
   ───────────────────────────────────────────────────────────── */
const StockContent = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  // Import stock initial modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [rawImportItems, setRawImportItems] = useState([]);
  const [importingExcel, setImportingExcel] = useState(false);

  const fileInputRef = useRef(null);

  // Set default export date range on mount
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(firstDay.toISOString().split('T')[0]);
  }, []);

  /* ── Fetch stocks ── */
  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/stocks');
      setStocks(response.data);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Erreur lors de la récupération des stocks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  /* ── Export handler ── */
  const handleExport = async () => {
    if (!startDate || !endDate) return;
    try {
      setExporting(true);
      const response = await api.get(`/stocks/export?start_date=${startDate}&end_date=${endDate}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Inventaire_Stock_${startDate}_au_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      setShowExportModal(false);
    } catch (error) {
      console.error("Erreur lors de l'exportation:", error);
      alert("Une erreur est survenue lors de l'exportation de l'inventaire.");
    } finally {
      setExporting(false);
    }
  };

  /* ── Download Model Excel ── */
  const downloadModelExcel = () => {
    const data = [
      ["Référence", "Désignation", "Unité", "Quantité"],
      ["P-001", "Riz blanc", "Kg", 150],
      ["P-002", "Sucre en poudre", "Kg", 75],
      ["P-003", "Huile de table", "Litre", 45]
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 15 }, // Référence
      { wch: 30 }, // Désignation
      { wch: 10 }, // Unité
      { wch: 12 }  // Quantité
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Stock");
    XLSX.writeFile(wb, "modele_stock_initial.xlsx");
  };

  /* ── Excel File Selection & Parse ── */
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target.result;
        const wb = XLSX.read(ab, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const worksheet = wb.Sheets[firstSheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rows.length === 0) {
          alert("Le fichier Excel est vide.");
          return;
        }

        // Find headers in the first 5 rows
        let headerRowIdx = -1;
        let colMapping = { reference: -1, designation: -1, unite: -1, quantite: -1 };

        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          row.forEach((cell, idx) => {
            if (!cell) return;
            const str = cell.toString().toLowerCase().trim();
            if (str.includes("référence") || str.includes("reference") || str === "ref" || str === "code") {
              colMapping.reference = idx;
            } else if (str.includes("désignation") || str.includes("designation") || str === "article" || str === "produit") {
              colMapping.designation = idx;
            } else if (str.includes("unité") || str.includes("unite") || str === "unit") {
              colMapping.unite = idx;
            } else if (str.includes("quantité") || str.includes("quantite") || str.includes("qty") || str.includes("qte")) {
              colMapping.quantite = idx;
            }
          });

          // Check if we matched at least designation and quantity
          if (colMapping.designation !== -1 && colMapping.quantite !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          alert("Format incorrect. Le fichier doit contenir au moins les colonnes 'Désignation' (ou Produit) et 'Quantité'.");
          return;
        }

        const parsedItems = [];
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          const designation = colMapping.designation !== -1 ? row[colMapping.designation]?.toString().trim() : null;
          const quantiteVal = colMapping.quantite !== -1 ? row[colMapping.quantite] : null;
          
          if (!designation) continue;

          const quantite = parseFloat(quantiteVal);
          if (isNaN(quantite) || quantite < 0) continue;

          const reference = colMapping.reference !== -1 ? row[colMapping.reference]?.toString().trim() : null;
          const unite = colMapping.unite !== -1 ? row[colMapping.unite]?.toString().trim() : "Unité";

          parsedItems.push({
            reference: reference || null,
            designation,
            unite: unite || "Unité",
            quantite
          });
        }

        if (parsedItems.length === 0) {
          alert("Aucune ligne de produit valide trouvée dans le fichier.");
          return;
        }

        // Generate fusion preview list:
        const previewList = parsedItems.map(item => {
          // Find matching item in existing stocks (reference or designation)
          let existing = null;
          if (item.reference) {
            existing = stocks.find(s => s.reference?.toLowerCase().trim() === item.reference.toLowerCase().trim());
          }
          if (!existing) {
            existing = stocks.find(s => s.designation.toLowerCase().trim() === item.designation.toLowerCase().trim());
          }

          const currentInitial = existing ? Number(existing.quantite_initiale ?? 0) : 0;
          const currentAvailable = existing ? Number(existing.quantite_disponible ?? 0) : 0;

          return {
            reference: item.reference || existing?.reference || "—",
            designation: item.designation,
            unite: item.unite || existing?.unite || "—",
            quantiteExcel: item.quantite,
            currentInitial,
            currentAvailable,
            finalInitial: currentInitial + item.quantite,
            finalAvailable: currentAvailable + item.quantite,
            isExisting: !!existing
          };
        });

        setPreviewData(previewList);
        setRawImportItems(parsedItems);

      } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  /* ── Confirm & Save Stock Initial Import ── */
  const handleConfirmImport = async () => {
    try {
      setImportingExcel(true);
      const response = await api.post('/stocks/import-initial', { items: rawImportItems });
      alert(response.data.message || "Importation réussie !");
      
      // Auto refresh list, calculations, and statistics
      await fetchStocks();
      
      // Reset state
      setPreviewData(null);
      setRawImportItems([]);
      setShowImportModal(false);
    } catch (error) {
      console.error("Erreur lors de l'importation:", error);
      alert(error.response?.data?.error || "Une erreur s'est produite lors de l'importation.");
    } finally {
      setImportingExcel(false);
    }
  };

  /* ── Derived statistics ── */
  const stats = {
    total: stocks.length,
    enStock: stocks.filter(s => s.statut === 'En Stock').length,
    stockFaible: stocks.filter(s => s.statut === 'Stock Faible').length,
    rupture: stocks.filter(s => s.statut === 'Rupture de Stock').length,
    totalInitial: stocks.reduce((sum, s) => sum + Number(s.quantite_initiale ?? 0), 0),
    totalRecu: stocks.reduce((sum, s) => sum + Number(s.quantite_recue ?? 0), 0),
    totalDisponible: stocks.reduce((sum, s) => sum + Number(s.quantite_disponible ?? 0), 0),
    totalConsomme: stocks.reduce((sum, s) => sum + Number(s.quantite_consommee ?? 0), 0),
    totalRestant: stocks.reduce((sum, s) => sum + Number(s.quantite_restante ?? 0), 0),
  };

  /* ── Filtered table data ── */
  const filteredStocks = stocks.filter(stock => {
    return stock.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           stock.reference?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /* ── Last sync label ── */
  const syncLabel = lastSyncTime
    ? `Synchronisé à ${lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Chargement…';

  /* ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px', maxWidth: '1600px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0f766e, #0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={22} color="white" />
            </div>
            Gestion du Stock
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
            Suivi automatique du stock initial, des livraisons (BL) et des consommations (PV / Fiches Tech.) ·{' '}
            <span style={{ color: '#0f766e', fontWeight: '600' }}>{syncLabel}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Stock Initial Import Button */}
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 16px', backgroundColor: 'white',
              color: '#0f766e', border: '1px solid #0f766e',
              borderRadius: '10px', cursor: 'pointer',
              fontWeight: '700', fontSize: '13px', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            <Archive size={15} />
            Stock Initial
          </button>

          {/* Export button */}
          <button
            onClick={() => setShowExportModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
              color: 'white', border: 'none',
              borderRadius: '10px', cursor: 'pointer',
              fontWeight: '700', fontSize: '13px',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'}
            onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)'}
          >
            <Download size={15} />
            Exporter Inventaire
          </button>
        </div>
      </div>

      {/* ── Stats Cards (1 card) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 300px)', gap: '14px', marginBottom: '28px' }}>
        <StatCard
          label="Total Produits"
          value={stats.total}
          subtitle="produits enregistrés"
          accent="#0f766e"
          icon={Package}
          iconBg="rgba(15,118,110,0.1)"
        />
      </div>

      {/* ── Toolbar: Search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'white', padding: '10px 14px',
          borderRadius: '10px', border: '1px solid #e2e8f0',
          flex: '1', maxWidth: '360px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder="Rechercher désignation ou référence..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              border: 'none', outline: 'none', width: '100%',
              fontSize: '13px', color: '#334155', backgroundColor: 'transparent',
            }}
          />
        </div>
      </div>

      {/* ── Stock Table ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '16px',
        border: '1px solid #e2e8f0', overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)',
      }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={36} color="#0f766e" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
              Synchronisation des stocks en temps réel…
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {[
                    { label: '#', align: 'center', width: '48px' },
                    { label: 'Référence', align: 'center', width: '100px' },
                    { label: 'Désignation Produit', align: 'left' },
                    { label: 'Unité', align: 'center', width: '80px' },
                    { label: 'Qté Initiale', align: 'center' },
                    { label: 'Qté Consommée', align: 'center' },
                    { label: 'Qté Restante', align: 'center' },
                    { label: 'Statut', align: 'center' },
                    { label: 'Dernière Entrée', align: 'center' },
                  ].map((col, i) => (
                    <th key={i} style={{
                      padding: '14px 16px', textAlign: col.align,
                      fontSize: '11px', fontWeight: '700', color: '#475569',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      width: col.width || 'auto',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length > 0 ? (
                  filteredStocks.map((stock, idx) => {
                    const statut = stock.statut || 'En Stock';
                    const isRupture = statut === 'Rupture de Stock';
                    const isFaible = statut === 'Stock Faible';

                    const rowBg = isRupture
                      ? 'rgba(254,226,226,0.25)'
                      : isFaible
                        ? 'rgba(254,243,199,0.25)'
                        : 'transparent';

                    const initiale = Number(stock.quantite_initiale ?? 0);
                    const recue = Number(stock.quantite_recue ?? 0);
                    const disponible = Number(stock.quantite_disponible ?? 0);
                    const consomme = Number(stock.quantite_consommee ?? 0);
                    const restante = Number(stock.quantite_restante ?? 0);

                    return (
                      <tr
                        key={stock.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: rowBg,
                          transition: 'background-color 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = rowBg}
                      >
                        {/* # */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                          {idx + 1}
                        </td>

                        {/* Référence */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                          <span style={{
                            backgroundColor: '#f1f5f9', padding: '3px 8px',
                            borderRadius: '6px', fontSize: '11px', color: '#475569',
                          }}>
                            {stock.reference || '—'}
                          </span>
                        </td>

                        {/* Désignation */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                            {stock.designation}
                          </div>
                        </td>

                        {/* Unité */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                          <span style={{
                            backgroundColor: '#e2e8f0', padding: '3px 10px',
                            borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#475569',
                          }}>
                            {stock.unite || '—'}
                          </span>
                        </td>

                        {/* Qté Initiale (Stock Initial + BL) */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                          {(initiale + recue).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                        </td>

                        {/* Qté Consommée */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: '#f59e0b', fontWeight: '600' }}>
                          {consomme > 0 ? consomme.toLocaleString('fr-FR', { maximumFractionDigits: 3 }) : '—'}
                        </td>

                        {/* Qté Restante */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <RemainingBadge
                             value={restante.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                             statut={statut}
                          />
                        </td>

                        {/* Statut */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <StatusBadge statut={statut} />
                        </td>

                        {/* Dernière Entrée */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          {stock.last_entry_date
                            ? new Date(stock.last_entry_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                      <Package size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '14px' }}>
                        {searchTerm || statusFilter !== 'all'
                          ? 'Aucun produit ne correspond aux critères de recherche.'
                          : 'Aucun produit en stock. Les produits apparaissent ici après importation de Stock Initial ou validation des Bons de Livraison.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer with count */}
        {!loading && filteredStocks.length > 0 && (
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: '#fafbfc',
          }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>
              {filteredStocks.length} produit{filteredStocks.length > 1 ? 's' : ''} affiché{filteredStocks.length > 1 ? 's' : ''}
              {stocks.length !== filteredStocks.length && ` sur ${stocks.length}`}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Formule : Qté Restante = Qté Initiale - Qté Consommée (FT)
            </span>
          </div>
        )}
      </div>

      {/* ── Stock Initial Import Modal ── */}
      {showImportModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px',
            width: '90%', maxWidth: previewData ? '1100px' : '550px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)', overflow: 'hidden',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column'
          }}>
            {/* Modal header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <img src={stockInitialLogo} alt="Stock Initial Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Gestion du Stock Initial
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Importer le stock de départ via un fichier Excel
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPreviewData(null);
                  setRawImportItems([]);
                  setShowImportModal(false);
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', padding: '4px', borderRadius: '6px',
                  fontSize: '20px', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {!previewData ? (
                // Step 1: Upload Dropzone & Template Download
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', padding: '20px 0' }}>
                  <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', maxWidth: '440px', lineHeight: '1.6', margin: '0 0 10px 0' }}>
                    Pour configurer vos stocks de départ, veuillez télécharger notre modèle Excel pré-formaté, le remplir avec vos références, puis le charger ci-dessous.
                  </p>



                  <div
                    onClick={() => fileInputRef.current.click()}
                    style={{
                      border: '2px dashed #cbd5e1',
                      borderRadius: '14px',
                      width: '100%',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.backgroundColor = '#f5f7ff'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                  >
                    <Archive size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                      Glissez-déposez votre fichier ici
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                      Supporte les formats .xlsx et .xls
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".xlsx, .xls"
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
              ) : (
                // Step 2: Verification and Fusion Preview Table
                <div>
                  <div style={{
                    backgroundColor: '#eef2ff', border: '1px solid #e0e7ff',
                    borderRadius: '10px', padding: '12px 16px', display: 'flex',
                    alignItems: 'flex-start', gap: '10px', marginBottom: '20px'
                  }}>
                    <HelpCircle size={18} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                      <strong>Vérification avant fusion :</strong> Les produits correspondants à des désignations ou références déjà existantes en stock seront fusionnés automatiquement. Les quantités importées seront <strong>ajoutées</strong> à leurs stocks initiaux actuels sans écraser les données précédentes.
                    </p>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '10px', maxHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Référence</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Désignation</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Unité</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700', backgroundColor: '#f5f7ff' }}>Qté Excel</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Qté Init. Actuelle</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Qté Disp. Actuelle</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700', backgroundColor: '#eef2ff' }}>Qté Init. Finale</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700', backgroundColor: '#ecfdf5' }}>Qté Disp. Finale</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center', color: '#475569', textTransform: 'uppercase', fontSize: '10px', fontWeight: '700' }}>Statut Produit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>{row.reference}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{row.designation}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{row.unite}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#4f46e5', backgroundColor: '#f5f7ff' }}>{row.quantiteExcel}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{row.currentInitial > 0 ? row.currentInitial : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{row.currentAvailable > 0 ? row.currentAvailable : '—'}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#4f46e5', backgroundColor: '#eef2ff' }}>{row.finalInitial}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#10b981', backgroundColor: '#ecfdf5' }}>{row.finalAvailable}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: '700',
                                backgroundColor: row.isExisting ? '#fef3c7' : '#dcfce7',
                                color: row.isExisting ? '#d97706' : '#15803d'
                              }}>
                                {row.isExisting ? 'Produit Existant' : 'Nouveau Produit'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px'
            }}>
              <button
                onClick={() => {
                  setPreviewData(null);
                  setRawImportItems([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  if (!previewData) setShowImportModal(false);
                }}
                style={{
                  padding: '10px 20px', backgroundColor: 'transparent',
                  border: '1px solid #cbd5e1', borderRadius: '10px',
                  color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                }}
              >
                {!previewData ? 'Fermer' : 'Choisir un autre fichier'}
              </button>

              {previewData && (
                <button
                  onClick={handleConfirmImport}
                  disabled={importingExcel}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 24px',
                    background: importingExcel
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none', borderRadius: '10px', color: 'white',
                    fontWeight: '700', fontSize: '13px',
                    cursor: importingExcel ? 'not-allowed' : 'pointer',
                    boxShadow: !importingExcel ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {importingExcel
                    ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    : <CheckCircle size={15} />}
                  {importingExcel ? 'Validation...' : 'Confirmer l\'importation'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px',
            width: '100%', maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)', overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '22px 28px', borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Calendar size={18} color="white" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Exporter l'Inventaire
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Rapport Excel avec consommations par période
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', padding: '4px', borderRadius: '6px',
                  fontSize: '20px', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '28px' }}>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px', lineHeight: '1.6' }}>
                Sélectionnez la période pour générer le rapport. Le fichier inclura les colonnes :
                <strong> Désignation, Référence, Unité, Qté Initiale, Qté Reçue, Qté Disponible, Qté Consommée, Qté Restante, Statut</strong>.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px',
                      color: '#334155', transition: 'border-color 0.2s', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0f766e'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '10px',
                      border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px',
                      color: '#334155', transition: 'border-color 0.2s', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0f766e'}
                    onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowExportModal(false)}
                  style={{
                    padding: '10px 20px', backgroundColor: 'transparent',
                    border: '1px solid #cbd5e1', borderRadius: '10px',
                    color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting || !startDate || !endDate}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 22px',
                    background: (exporting || !startDate || !endDate)
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                    border: 'none', borderRadius: '10px', color: 'white',
                    fontWeight: '700', fontSize: '13px',
                    cursor: (exporting || !startDate || !endDate) ? 'not-allowed' : 'pointer',
                    boxShadow: (!exporting && startDate && endDate) ? '0 4px 12px rgba(15,118,110,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {exporting
                    ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Download size={15} />}
                  {exporting ? 'Exportation...' : 'Télécharger Excel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Spinner keyframe (inline) ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default StockContent;
