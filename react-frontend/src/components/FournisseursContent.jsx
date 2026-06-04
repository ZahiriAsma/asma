import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Building2, CheckCircle2, Star, Users, MapPin, 
  Phone, Landmark, Eye, X, Award, EyeOff, ShieldAlert, Trash2, Edit2, Loader2
} from 'lucide-react';
import api from '../api/axios';

const FournisseursContent = ({ onNavigateToMarches }) => {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [marches, setMarches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    raisonSociale: '',
    ice: '',
    patente: '',
    rc: '',
    if: '',
    cnss: '',
    adresse: '',
    telephone: '',
    rib: '',
    banque: '',
    categorie: 'Denrées alimentaires',
    note: '5.0',
    statut: 'Actif'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchFournisseurs();
    fetchMarches();
  }, []);

  const fetchMarches = async () => {
    try {
      const res = await api.get('/marches');
      setMarches(res.data);
    } catch (err) {
      console.error('Erreur chargement marchés:', err);
    }
  };

  const fetchFournisseurs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/fournisseurs');
      setFournisseurs(res.data);
    } catch (err) {
      console.error(err);
      setError('Impossible de charger les fournisseurs.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/fournisseurs', formData);
      setShowAddModal(false);
      // Reset form
      setFormData({
        raisonSociale: '',
        ice: '',
        patente: '',
        rc: '',
        if: '',
        cnss: '',
        adresse: '',
        telephone: '',
        rib: '',
        banque: '',
        categorie: 'Denrées alimentaires',
        note: '5.0',
        statut: 'Actif'
      });
      fetchFournisseurs();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Erreur lors de la création du fournisseur.';
      setFormError(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce fournisseur ?')) {
      try {
        await api.delete(`/fournisseurs/${id}`);
        fetchFournisseurs();
        if (selectedFournisseur?.id === id) {
          setShowDetailModal(false);
        }
      } catch (err) {
        console.error(err);
        alert('Erreur lors de la suppression du fournisseur.');
      }
    }
  };

  // Helper to get initials
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Calcule les vraies stats par fournisseur depuis les marchés
  const getCardStats = (fournisseur) => {
    const AVATAR_COLORS = ['#0f766e', '#047857', '#6b21a8', '#b45309', '#1e40af'];
    const idx = (fournisseur.id - 1) % AVATAR_COLORS.length;
    const avatarBg = AVATAR_COLORS[idx];

    // Marchés liés à ce fournisseur
    const fournisseurMarches = marches.filter(m => m.id_fournisseur === fournisseur.id);
    const marchesCount = fournisseurMarches.length;
    const budgetTotal = fournisseurMarches.reduce((acc, m) => acc + parseFloat(m.budget || 0), 0);
    const budgetK = budgetTotal >= 1000
      ? `${Math.round(budgetTotal / 1000)}K`
      : `${Math.round(budgetTotal)}`;

    return {
      marches: marchesCount,
      budget: budgetK,
      conformity: '-',
      avatarBg,
    };
  };

  // Nombre de marchés actifs (statut 'En cours') tous fournisseurs confondus
  const activeMarchesCount = marches.filter(m => m.statut === 'En cours').length;

  // Render stars
  const renderStars = (note) => {
    const stars = [];
    const val = parseFloat(note || 5.0);
    const fullStars = Math.floor(val);
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Star key={i} size={14} fill="#f59e0b" color="#f59e0b" />);
      } else {
        stars.push(<Star key={i} size={14} color="#d1d5db" />);
      }
    }
    return stars;
  };

  const filteredFournisseurs = fournisseurs.filter(f => 
    f.raisonSociale.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.categorie && f.categorie.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.adresse && f.adresse.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        .supplier-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .supplier-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 25px -5px rgba(15, 118, 110, 0.1), 0 10px 10px -5px rgba(15, 118, 110, 0.04) !important;
          border-color: rgba(15, 118, 110, 0.35) !important;
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
        .stat-card-indigo::after {
          background: linear-gradient(90deg, #6366f1, #8b5cf6) !important;
        }
      `}</style>
      
      {/* ── HEADER SECTION ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>Fournisseurs</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            {fournisseurs.length} fournisseurs référencés · {fournisseurs.filter(f => f.statut === 'Actif').length} actifs
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          style={{
            backgroundColor: '#0f766e', color: 'white', border: 'none',
            borderRadius: '8px', padding: '10px 20px', display: 'flex',
            alignItems: 'center', gap: '8px', fontWeight: '600',
            fontSize: '14px', cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)'
          }}
        >
          <Plus size={18} /> Ajouter fournisseur
        </button>
      </div>

      {/* ── STATS ROW ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
        {[
          { label: 'TOTAL FOURNISSEURS', value: fournisseurs.length, icon: <Building2 size={20} color="#2563eb" />, bg: 'rgba(37,99,235,0.08)' },
          { label: 'ACTIFS', value: fournisseurs.filter(f => f.statut === 'Actif').length, icon: <CheckCircle2 size={20} color="#10b981" />, bg: 'rgba(16,185,129,0.08)' },
          { label: 'NOTE MOYENNE', value: fournisseurs.length > 0 ? (fournisseurs.reduce((acc, f) => acc + parseFloat(f.note || 5.0), 0) / fournisseurs.length).toFixed(1) + '/5' : '5.0/5', icon: <Star size={20} color="#f59e0b" />, bg: 'rgba(245,158,11,0.08)' },
          { label: 'MARCHÉS EN COURS', value: activeMarchesCount, icon: <Award size={20} color="#6366f1" />, bg: 'rgba(99,102,241,0.08)' }
        ].map((stat, i) => {
          const statClasses = ['stat-card-blue', 'stat-card-green', 'stat-card-orange', 'stat-card-indigo'];
          return (
            <div key={i} 
              className={`stat-card ${statClasses[i]}`}
              style={{ 
                backgroundColor: 'white', borderRadius: '16px', padding: '20px', 
                border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}
            >
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em', marginBottom: '8px' }}>{stat.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{stat.value}</div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stat.icon}
            </div>
          </div>
          );
        })}
      </div>

      {/* ── SEARCH BAR ── */}
      <div style={{ position: 'relative', maxWidth: '400px', marginBottom: '24px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input 
          type="text" 
          placeholder="Rechercher fournisseur ou catégorie..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%', padding: '10px 10px 10px 38px', backgroundColor: 'white', 
            border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', fontSize: '14px', color: '#334155'
          }}
        />
      </div>

      {/* ── LOADING & EMPTY STATES ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
          <Loader2 size={32} className="animate-spin" color="#0f766e" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#64748b', fontSize: '14px' }}>Chargement des fournisseurs...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', color: '#b91c1c', textAlign: 'center' }}>
          {error}
        </div>
      ) : filteredFournisseurs.length === 0 ? (
        <div style={{ padding: '48px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', textAlign: 'center' }}>
          <Building2 size={48} color="#94a3b8" style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: '700' }}>Aucun fournisseur trouvé</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Essayez un autre mot-clé ou ajoutez un nouveau fournisseur.</p>
        </div>
      ) : (
        /* ── SUPPLIERS GRID ── */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {filteredFournisseurs.map((f) => {
            const visual = getCardStats(f);
            return (
              <div 
                key={f.id} 
                className="supplier-card"
                style={{ 
                  backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', 
                  padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column',
                  position: 'relative', cursor: 'pointer'
                }}
              >
                {/* Header Card */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '18px', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '48px', height: '48px', borderRadius: '12px', 
                    backgroundColor: visual.avatarBg, color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '700', fontSize: '16px', flexShrink: 0
                  }}>
                    {getInitials(f.raisonSociale)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {f.raisonSociale}
                    </h3>
                    <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {f.categorie} · {f.adresse ? f.adresse.split(' · ').pop() : 'Maroc'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>{renderStars(f.note)}</div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{f.note}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ 
                    backgroundColor: f.statut === 'Actif' ? '#ecfdf5' : '#fef2f2', 
                    color: f.statut === 'Actif' ? '#10b981' : '#ef4444', 
                    padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' 
                  }}>
                    {f.statut}
                  </span>
                </div>

                {/* Three Stats */}
                <div style={{ 
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', 
                  borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9',
                  padding: '16px 0', marginBottom: '20px', textAlign: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{visual.marches}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>Marchés</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{visual.budget}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>Budget MAD</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{visual.conformity}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>Conformité</div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => {
                      setSelectedFournisseur(f);
                      setShowDetailModal(true);
                    }}
                    style={{
                      flex: 1, backgroundColor: 'white', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '8px 12px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '6px',
                      fontWeight: '600', fontSize: '13px', color: '#475569', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.target.style.backgroundColor = '#f8fafc';
                      e.target.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={e => {
                      e.target.style.backgroundColor = 'white';
                      e.target.style.borderColor = '#cbd5e1';
                    }}
                  >
                    <Eye size={15} /> Voir
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onNavigateToMarches) onNavigateToMarches(f.id);
                    }}
                    style={{
                      flex: 1, backgroundColor: '#0f766e', border: 'none',
                      borderRadius: '8px', padding: '8px 12px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '6px',
                      fontWeight: '600', fontSize: '13px', color: 'white', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.backgroundColor = '#0d5c56'}
                    onMouseLeave={e => e.target.style.backgroundColor = '#0f766e'}
                  >
                    Marchés
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: AJOUTER FOURNISSEUR ── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0',
            width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative',
            padding: '32px'
          }}>
            <button 
              onClick={() => setShowAddModal(false)}
              style={{
                position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9',
                border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer',
                color: '#64748b', display: 'flex'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
              Nouveau Fournisseur
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b' }}>
              Ajouter un fournisseur dans la base de données. Tous les attributs requis seront persistés.
            </p>

            {formError && (
              <div style={{
                backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: '8px', padding: '12px', color: '#b91c1c',
                fontSize: '13px', marginBottom: '20px'
              }}>{formError}</div>
            )}

            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Raison Sociale *</label>
                  <input 
                    type="text" name="raisonSociale" required value={formData.raisonSociale} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Ex: DISMA Maroc"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>ICE (Identifiant Commun de l'Entreprise) *</label>
                  <input 
                    type="text" name="ice" required value={formData.ice} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Ex: 001234567890123"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Patente</label>
                  <input 
                    type="text" name="patente" value={formData.patente} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Numéro de Patente"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Registre du Commerce (RC)</label>
                  <input 
                    type="text" name="rc" value={formData.rc} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Numéro RC"
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Identifiant Fiscal (IF)</label>
                  <input 
                    type="text" name="if" value={formData.if} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Numéro IF"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>CNSS</label>
                  <input 
                    type="text" name="cnss" value={formData.cnss} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Numéro CNSS"
                  />
                </div>
              </div>

              {/* Row 4 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Adresse / Ville</label>
                  <input 
                    type="text" name="adresse" value={formData.adresse} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Ex: Casablanca"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Téléphone</label>
                  <input 
                    type="text" name="telephone" value={formData.telephone} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Numéro de téléphone"
                  />
                </div>
              </div>

              {/* Row 5 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>RIB (24 chiffres)</label>
                  <input 
                    type="text" name="rib" value={formData.rib} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="RIB Bancaire"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Banque</label>
                  <input 
                    type="text" name="banque" value={formData.banque} onChange={handleInputChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px' }}
                    placeholder="Nom de la Banque"
                  />
                </div>
              </div>

              {/* Row 6 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Catégorie</label>
                  <select 
                    name="categorie" value={formData.categorie} onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px', backgroundColor: 'white' }}
                  >
                    <option value="Denrées alimentaires">Denrées alimentaires</option>
                    <option value="Produits hygiéniques">Produits hygiéniques</option>
                    <option value="Fruits & légumes">Fruits & légumes</option>
                    <option value="Entretien & Matériels">Entretien & Matériels</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Statut</label>
                  <select 
                    name="statut" value={formData.statut} onChange={handleInputChange}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none', fontSize: '14px', backgroundColor: 'white' }}
                  >
                    <option value="Actif">Actif</option>
                    <option value="En retard">En retard</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  style={{
                    backgroundColor: 'white', border: '1px solid #cbd5e1',
                    borderRadius: '8px', padding: '10px 20px', fontWeight: '600',
                    fontSize: '14px', color: '#475569', cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button 
                  type="submit" disabled={formLoading}
                  style={{
                    backgroundColor: '#0f766e', border: 'none', color: 'white',
                    borderRadius: '8px', padding: '10px 20px', fontWeight: '600',
                    fontSize: '14px', cursor: formLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {formLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enregistrer'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DETAIL FOURNISSEUR (VOIR) ── */}
      {showDetailModal && selectedFournisseur && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0',
            width: '100%', maxWidth: '550px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative',
            padding: '32px'
          }}>
            <button 
              onClick={() => {
                setShowDetailModal(false);
                setSelectedFournisseur(null);
              }}
              style={{
                position: 'absolute', top: '20px', right: '20px', background: '#f1f5f9',
                border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer',
                color: '#64748b', display: 'flex'
              }}
            >
              <X size={18} />
            </button>

            {/* Header info */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ 
                width: '56px', height: '56px', borderRadius: '14px', 
                backgroundColor: getCardStats(selectedFournisseur).avatarBg, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: '18px'
              }}>
                {getInitials(selectedFournisseur.raisonSociale)}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                  {selectedFournisseur.raisonSociale}
                </h3>
                <span style={{ 
                  backgroundColor: selectedFournisseur.statut === 'Actif' ? '#ecfdf5' : '#fef2f2', 
                  color: selectedFournisseur.statut === 'Actif' ? '#10b981' : '#ef4444', 
                  padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' 
                }}>
                  {selectedFournisseur.statut}
                </span>
              </div>
            </div>

            {/* Attributes Detail List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
              
              {[
                { label: 'ICE', val: selectedFournisseur.ice },
                { label: 'Numéro Patente', val: selectedFournisseur.patente || 'Non renseigné' },
                { label: 'Registre du Commerce (RC)', val: selectedFournisseur.rc || 'Non renseigné' },
                { label: 'Identifiant Fiscal (IF)', val: selectedFournisseur.if || 'Non renseigné' },
                { label: 'CNSS', val: selectedFournisseur.cnss || 'Non renseigné' },
                { label: 'Catégorie d\'activité', val: selectedFournisseur.categorie },
                { label: 'Téléphone', val: selectedFournisseur.telephone || 'Non renseigné', icon: <Phone size={14} color="#64748b" /> },
                { label: 'Banque', val: selectedFournisseur.banque || 'Non renseigné', icon: <Landmark size={14} color="#64748b" /> },
                { label: 'RIB bancaire', val: selectedFournisseur.rib || 'Non renseigné' },
                { label: 'Adresse / Ville', val: selectedFournisseur.adresse || 'Non renseigné', icon: <MapPin size={14} color="#64748b" /> }
              ].map((item, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', borderBottom: index !== 9 ? '1px solid #f1f5f9' : 'none', paddingBottom: '10px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>{item.label}</span>
                  <span style={{ color: '#0f172a', fontWeight: '700', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {item.icon} {item.val}
                  </span>
                </div>
              ))}

            </div>

            {/* Bottom options */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button 
                onClick={() => handleDelete(selectedFournisseur.id)}
                style={{
                  backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: '8px', padding: '10px 16px', fontWeight: '600',
                  fontSize: '13px', color: '#b91c1c', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Trash2 size={15} /> Supprimer
              </button>

              <button 
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedFournisseur(null);
                }}
                style={{
                  backgroundColor: '#0f766e', border: 'none', color: 'white',
                  borderRadius: '8px', padding: '10px 24px', fontWeight: '600',
                  fontSize: '13px', cursor: 'pointer'
                }}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FournisseursContent;
