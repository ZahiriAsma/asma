import React, { useState, useEffect } from 'react';
import { Package, Search, Download, Calendar, Loader2, RefreshCw } from 'lucide-react';
import api from '../api/axios';

const StockContent = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal for Inventory Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchStocks();
    
    // Set default dates for export modal (start of month to today)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(firstDay.toISOString().split('T')[0]);
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stocks');
      setStocks(response.data);
    } catch (error) {
      console.error("Erreur lors de la récupération des stocks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!startDate || !endDate) return;
    
    try {
      setExporting(true);
      const response = await api.get(`/stocks/export?start_date=${startDate}&end_date=${endDate}`, {
        responseType: 'blob'
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

  const filteredStocks = stocks.filter(stock => 
    stock.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={28} color="#0f766e" />
            Gestion du Stock
          </h2>
          <p style={{ margin: 0, color: '#64748b' }}>Suivi des entrées (Bons de Livraison) et des consommations (Fiches Techniques)</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={fetchStocks}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
              backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', 
              borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' 
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <RefreshCw size={18} />
            Actualiser
          </button>
          
          <button 
            onClick={() => setShowExportModal(true)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', 
              backgroundColor: '#0f766e', color: 'white', border: 'none', 
              borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s',
              boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0d9488'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f766e'}
          >
            <Download size={18} />
            Inventaire
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Produits en Stock</p>
          <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{stocks.length}</h3>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Produits en Rupture (&lt; 0)</p>
          <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
            {stocks.filter(s => s.quantite_restante < 0).length}
          </h3>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', width: '300px' }}>
        <Search size={18} color="#94a3b8" />
        <input 
          type="text" 
          placeholder="Rechercher un produit..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ border: 'none', outline: 'none', padding: '8px', width: '100%', fontSize: '14px', color: '#334155' }}
        />
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 className="animate-spin" size={32} color="#0f766e" />
            <p style={{ marginTop: '16px', color: '#64748b' }}>Chargement du stock...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Désignation Produit</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Quantité Initiale (BL)</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Unité</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Quantité Consommée</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Quantité Restante</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Dernière Entrée</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length > 0 ? (
                  filteredStocks.map((stock) => (
                    <tr key={stock.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '16px', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                        {stock.designation}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '14px', color: '#0ea5e9', fontWeight: '600' }}>
                        {stock.quantite_initiale}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                        {stock.unite}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '14px', color: '#f59e0b', fontWeight: '600' }}>
                        {stock.quantite_consommee}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ 
                          display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                          backgroundColor: stock.quantite_restante < 0 ? '#fee2e2' : stock.quantite_restante === 0 ? '#f1f5f9' : '#dcfce3',
                          color: stock.quantite_restante < 0 ? '#ef4444' : stock.quantite_restante === 0 ? '#64748b' : '#16a34a'
                        }}>
                          {stock.quantite_restante}
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                        {stock.last_entry_date ? new Date(stock.last_entry_date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      Aucun produit trouvé dans le stock. Les produits apparaîtront ici une fois les Bons de Livraison validés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden' 
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={20} color="#0f766e" />
                Exporter l'Inventaire
              </h3>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
                Sélectionnez la période pour générer le rapport d'inventaire Excel incluant les consommations pour cette période.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Date de début</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '8px' }}>Date de fin</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
                <button 
                  onClick={() => setShowExportModal(false)}
                  style={{ padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button 
                  onClick={handleExport}
                  disabled={exporting || !startDate || !endDate}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 20px', backgroundColor: '#0f766e', border: 'none', borderRadius: '8px', 
                    color: 'white', fontWeight: '600', cursor: (exporting || !startDate || !endDate) ? 'not-allowed' : 'pointer',
                    opacity: (exporting || !startDate || !endDate) ? 0.7 : 1
                  }}
                >
                  {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                  {exporting ? 'Exportation...' : 'Télécharger Excel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockContent;
