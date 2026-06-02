import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Search, Download, Calendar, Loader2,
  RefreshCw, TrendingDown, AlertTriangle, CheckCircle,
  XCircle, BarChart3, Archive, Flame
} from 'lucide-react';
import api from '../api/axios';

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
    padding: '20px 22px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    transition: 'box-shadow 0.2s',
  }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'}
  >
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px',
      backgroundColor: iconBg || '#f1f5f9',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={22} color={accent || '#64748b'} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: accent || '#0f172a', lineHeight: 1 }}>
        {value}
      </h3>
      {subtitle && (
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
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

  /* ── Derived statistics ── */
  const stats = {
    total: stocks.length,
    enStock: stocks.filter(s => s.statut === 'En Stock').length,
    stockFaible: stocks.filter(s => s.statut === 'Stock Faible').length,
    rupture: stocks.filter(s => s.statut === 'Rupture de Stock').length,
    totalDisponible: stocks.reduce((sum, s) => sum + Number(s.quantite_disponible ?? s.quantite_initiale ?? 0), 0),
    totalConsomme: stocks.reduce((sum, s) => sum + Number(s.quantite_consommee ?? 0), 0),
    totalRestant: stocks.reduce((sum, s) => sum + Number(s.quantite_restante ?? 0), 0),
  };

  /* ── Filtered table data ── */
  const filteredStocks = stocks.filter(stock => {
    const matchSearch = stock.designation?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      stock.statut === statusFilter;
    return matchSearch && matchStatus;
  });

  /* ── Last sync label ── */
  const syncLabel = lastSyncTime
    ? `Synchronisé à ${lastSyncTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Chargement…';

  /* ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px', maxWidth: '1500px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

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
            Suivi automatique des entrées (Bons de Livraison) et des consommations (Fiches Techniques) ·{' '}
            <span style={{ color: '#0f766e', fontWeight: '600' }}>{syncLabel}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Refresh button */}
          <button
            onClick={fetchStocks}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 16px', backgroundColor: 'white',
              color: '#475569', border: '1px solid #cbd5e1',
              borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600', fontSize: '13px', transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseOver={e => { if (!loading) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = 'white'; }}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
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
          subtitle="en stock"
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
            placeholder="Rechercher un produit..."
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
              Synchronisation avec les Fiches Techniques…
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {[
                    { label: '#', align: 'center', width: '48px' },
                    { label: 'Désignation Produit', align: 'left' },
                    { label: 'Unité', align: 'center', width: '90px' },
                    { label: 'Qté Disponible (BL)', align: 'center' },
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
                    const cfg = STATUS_CONFIG[statut] || STATUS_CONFIG['En Stock'];
                    const isRupture = statut === 'Rupture de Stock';
                    const isFaible = statut === 'Stock Faible';

                    const rowBg = isRupture
                      ? 'rgba(254,226,226,0.25)'
                      : isFaible
                        ? 'rgba(254,243,199,0.25)'
                        : 'transparent';

                    const disponible = Number(stock.quantite_disponible ?? stock.quantite_initiale ?? 0);
                    const consomme = Number(stock.quantite_consommee ?? 0);
                    const restante = Number(stock.quantite_restante ?? 0);
                    const progressPct = disponible > 0
                      ? Math.max(0, Math.min(100, (restante / disponible) * 100))
                      : 0;

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

                        {/* Désignation */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                            {stock.designation}
                          </div>
                          {/* Consumption progress bar */}
                          <div style={{ marginTop: '6px', width: '100%', maxWidth: '200px' }}>
                            <div style={{ height: '4px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${progressPct}%`,
                                backgroundColor: isRupture ? '#ef4444' : isFaible ? '#f59e0b' : '#10b981',
                                borderRadius: '2px', transition: 'width 0.4s ease',
                              }} />
                            </div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', fontWeight: '500' }}>
                              {progressPct.toFixed(0)}% restant
                            </div>
                          </div>
                        </td>

                        {/* Unité */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                          <span style={{
                            backgroundColor: '#f1f5f9', padding: '3px 10px',
                            borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#475569',
                          }}>
                            {stock.unite || '—'}
                          </span>
                        </td>

                        {/* Qté Disponible */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0284c7' }}>
                            {disponible.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
                          </span>
                        </td>

                        {/* Qté Consommée */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '14px', fontWeight: '700',
                            color: consomme > 0 ? '#d97706' : '#94a3b8',
                          }}>
                            {consomme > 0
                              ? consomme.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
                              : '—'}
                          </span>
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
                    <td colSpan="8" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                      <Package size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '14px' }}>
                        {searchTerm || statusFilter !== 'all'
                          ? 'Aucun produit ne correspond aux critères de recherche.'
                          : 'Aucun produit en stock. Les produits apparaissent ici après validation des Bons de Livraison.'}
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
              🔄 Mise à jour automatique depuis Bons de Livraison & Fiches Techniques
            </span>
          </div>
        )}
      </div>

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
                <strong> Désignation, Unité, Qté Disponible, Qté Consommée, Qté Restante, Statut</strong>.
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
