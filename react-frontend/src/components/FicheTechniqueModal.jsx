import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, X, Trash2, Coffee, Utensils, Moon, Loader2, Search, Check, Filter, ChevronDown, Save, ShieldCheck, Landmark, Plus, Download } from 'lucide-react';
import api from '../api/axios';
import { useDashboard } from '../context/DashboardContext';

// Helper: Extract plats from menu text
const parsePlats = (text) => {
  if (!text) return [];
  const parts = text.split(/[\n,+;]/).map(p => p.trim()).filter(p => p.length > 0);
  return parts.map(p => {
    return p.replace(/^(\d+\/\d+|\d+(?:[.,]\d+)?(?:ml|cl|L|kg|g)?)\s+/i, '').trim();
  }).filter((value, index, self) => self.indexOf(value) === index);
};

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Ftour / Petit déjeuner', icon: Coffee, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', sourceKey: 'petit_dejeuner' },
  { id: 'lunch', label: 'Déjeuner', icon: Utensils, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)', border: 'rgba(14,165,233,0.2)', sourceKey: 'dejeuner' },
  { id: 'dinner', label: 'Dîner', icon: Moon, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)', sourceKey: 'diner' }
];

const FicheTechniqueModal = ({ selectedMenu, onClose, date, dayText }) => {
  const { fetchNotifications } = useDashboard();
  const [globalIngredients, setGlobalIngredients] = useState([]);
  const [bordereauHeaders, setBordereauHeaders] = useState([]);
  
  // State structure: { breakfast: { 'Plat 1': [ingredients...], 'Plat 2': [...] }, lunch: {...}, dinner: {...} }
  const [sheets, setSheets] = useState({ breakfast: {}, lunch: {}, dinner: {} });
  
  // The plats available for each meal based on the menu text
  const [platsPerMeal, setPlatsPerMeal] = useState({ breakfast: [], lunch: [], dinner: [] });
  const [peopleCounts, setPeopleCounts] = useState({ breakfast: 450, lunch: 450, dinner: 450 });
  
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'dirty', 'error'
  const isFirstLoad = useRef(true);

  // Modal State for Ingredient Selector
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [currentMealForModal, setCurrentMealForModal] = useState(null);
  const [currentPlatForModal, setCurrentPlatForModal] = useState(null);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [selectedBordereauFilter, setSelectedBordereauFilter] = useState('');
  // Set of ingredient IDs selected in the current modal session
  const [tempSelectedIngredients, setTempSelectedIngredients] = useState(new Set());

  const defaultResidents = selectedMenu?.residents || 450;

  // Compute overall summary totals
  const totalAmount = useMemo(() => {
    let sum = 0;
    Object.values(sheets).forEach(mealPlats => {
      Object.values(mealPlats).forEach(items => {
        sum += items.reduce((acc, item) => acc + Number(item.amount || 0), 0);
      });
    });
    return sum;
  }, [sheets]);

  const totalProductsCount = useMemo(() => {
    let count = 0;
    Object.values(sheets).forEach(mealPlats => {
      Object.values(mealPlats).forEach(items => {
        count += items.length;
      });
    });
    return count;
  }, [sheets]);

  // 1. Initial Load: Fetch everything
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Parse the plats from the selected menu
        const parsedPlats = {
          breakfast: parsePlats(selectedMenu?.petit_dejeuner),
          lunch: parsePlats(selectedMenu?.dejeuner),
          dinner: parsePlats(selectedMenu?.diner)
        };
        setPlatsPerMeal(parsedPlats);

        const [ingredientsRes, headersRes, sheetsRes] = await Promise.all([
          api.get('/technical-sheets/ingredients'),
          api.get('/technical-sheets/bordereau-headers'),
          api.get(`/technical-sheets?date=${date}&fallback_latest=true`)
        ]);

        setGlobalIngredients(ingredientsRes.data);
        setBordereauHeaders(headersRes.data);

        const loadedSheets = sheetsRes.data;

        const grouped = { breakfast: {}, lunch: {}, dinner: {} };
        // Initialize empty arrays for all parsed plats
        Object.keys(parsedPlats).forEach(meal => {
          parsedPlats[meal].forEach(plat => {
            grouped[meal][plat] = [];
          });
        });

        const pplCounts = { breakfast: defaultResidents, lunch: defaultResidents, dinner: defaultResidents };

        if (loadedSheets && loadedSheets.length > 0) {
          const isCloned = loadedSheets[0].is_cloned || loadedSheets[0].date !== date;

          loadedSheets.forEach(sheet => {
            const meal = sheet.meal_type;
            const plat = sheet.plat_name || 'Autre';

            // Only load ingredients for dishes that exist in today's menu
            const menuPlatsForMeal = parsedPlats[meal] || [];
            if (!menuPlatsForMeal.includes(plat)) return;

            if (!grouped[meal]) grouped[meal] = {};
            if (!grouped[meal][plat]) grouped[meal][plat] = [];

            // Add the item
            grouped[meal][plat].push({
              id: isCloned ? `temp_${Math.random()}` : sheet.id,
              meal_type: meal,
              plat_name: plat,
              bordereau_id: sheet.bordereau_id,
              item: sheet.bordereau, // includes .header
              quantity_per_person: Number(sheet.quantity_per_person || 0),
              present_people: isCloned ? defaultResidents : Number(sheet.present_people),
              r: Number(sheet.r || 1.00),
              calculated_quantity: Number(sheet.calculated_quantity),
              pu_r: Number(sheet.pu_r),
              amount: Number(sheet.amount),
              isNew: !!isCloned
            });
            
            if (!isCloned) {
              pplCounts[meal] = Number(sheet.present_people);
            }
          });

          // Recalculate if cloned
          if (isCloned) {
            Object.keys(grouped).forEach(meal => {
              Object.keys(grouped[meal]).forEach(plat => {
                grouped[meal][plat] = grouped[meal][plat].map(row => {
                  const qtyPerPerson = row.quantity_per_person;
                  const calculatedQty = (qtyPerPerson / 70) * defaultResidents;
                  const pur = row.pu_r / (row.r || 1);
                  return {
                    ...row,
                    present_people: defaultResidents,
                    calculated_quantity: calculatedQty,
                    amount: calculatedQty * pur
                  };
                });
              });
            });
            setSaveStatus('dirty');
          } else {
            setSaveStatus('saved');
          }
        } else {
          // Empty sheets, user will add manually
          setSaveStatus('saved');
        }

        setSheets(grouped);
        setPeopleCounts(pplCounts);

      } catch (err) {
        console.error("Error loading Technical Sheet:", err);
        setSaveStatus('error');
      } finally {
        setLoading(false);
        isFirstLoad.current = false;
      }
    };

    fetchData();
  }, [date, defaultResidents, selectedMenu]);

  // 2. Debounced Batch Auto-Save
  useEffect(() => {
    if (loading || isFirstLoad.current || saveStatus === 'saved' || saveStatus === 'saving') return;

    const saveTimeout = setTimeout(async () => {
      setSaveStatus('saving');
      
      const payloadItems = [];
      Object.keys(sheets).forEach(mealType => {
        Object.keys(sheets[mealType]).forEach(plat => {
          sheets[mealType][plat].forEach(row => {
            payloadItems.push({
              id: row.isNew ? null : row.id,
              date: date,
              meal_type: mealType,
              plat_name: plat,
              bordereau_id: row.bordereau_id,
              quantity_per_person: row.quantity_per_person,
              present_people: row.present_people,
              calculated_quantity: row.calculated_quantity,
              r: row.r,
              pu_r: row.pu_r,
              amount: row.amount
            });
          });
        });
      });

      try {
        await api.post('/technical-sheets', { items: payloadItems });
        
        // Fetch fresh entries to resolve temp IDs to real database IDs
        const res = await api.get(`/technical-sheets?date=${date}`);
        const grouped = { breakfast: {}, lunch: {}, dinner: {} };
        // initialize empty plats based on current state
        Object.keys(sheets).forEach(m => {
            Object.keys(sheets[m]).forEach(p => {
                grouped[m][p] = [];
            });
        });

        res.data.forEach(sheet => {
          const meal = sheet.meal_type;
          const plat = sheet.plat_name || 'Autre';
          if (!grouped[meal]) grouped[meal] = {};
          if (!grouped[meal][plat]) grouped[meal][plat] = [];

          grouped[meal][plat].push({
            ...sheet,
            item: sheet.bordereau,
            quantity_per_person: Number(sheet.quantity_per_person || 0),
            present_people: Number(sheet.present_people),
            r: Number(sheet.r || 1.00),
            calculated_quantity: Number(sheet.calculated_quantity),
            pu_r: Number(sheet.pu_r),
            amount: Number(sheet.amount),
            isNew: false
          });
        });

        setSheets(grouped);
        setSaveStatus('saved');
        fetchNotifications();
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus('error');
      }
    }, 800);

    return () => clearTimeout(saveTimeout);
  }, [sheets, saveStatus, date, loading]);

  // Update people count for a meal
  const handlePeopleCountChange = (mealType, count) => {
    const value = parseInt(count) || 0;
    setPeopleCounts(prev => ({ ...prev, [mealType]: value }));
    
    setSheets(prev => {
      const next = { ...prev };
      const newMealPlats = { ...next[mealType] };
      
      Object.keys(newMealPlats).forEach(plat => {
        newMealPlats[plat] = newMealPlats[plat].map(row => {
          const calculatedQty = (row.quantity_per_person / 70) * value;
          const pur = row.pu_r / (row.r || 1);
          return {
            ...row,
            present_people: value,
            calculated_quantity: calculatedQty,
            amount: calculatedQty * pur
          };
        });
      });
      next[mealType] = newMealPlats;
      return next;
    });

    setSaveStatus('dirty');
  };

  // Update row values
  const handleRowChange = (mealType, platName, idx, field, value) => {
    setSheets(prev => {
      const next = { ...prev };
      const rowList = [...next[mealType][platName]];
      const row = { ...rowList[idx] };

      const numVal = parseFloat(value) || 0;
      row[field] = numVal;

      if (field === 'quantity_per_person') {
        row.calculated_quantity = (numVal / 70) * row.present_people;
        const pur = row.pu_r / (row.r || 1);
        row.amount = row.calculated_quantity * pur;
      } else if (field === 'r' || field === 'pu_r') {
        const r = field === 'r' ? numVal : row.r;
        const pu = field === 'pu_r' ? numVal : row.pu_r;
        const pur = pu / (r || 1);
        row.amount = row.calculated_quantity * pur;
      }

      rowList[idx] = row;
      next[mealType][platName] = rowList;
      return next;
    });

    setSaveStatus('dirty');
  };

  const handleRemoveProduct = async (mealType, platName, idx) => {
    const row = sheets[mealType][platName][idx];
    
    if (!row.isNew && row.id && !row.id.toString().startsWith('temp_')) {
      try {
        await api.delete(`/technical-sheets/${row.id}`);
      } catch (err) {
        console.error("Error deleting row:", err);
      }
    }

    setSheets(prev => {
      const next = { ...prev };
      const rowList = [...next[mealType][platName]];
      rowList.splice(idx, 1);
      next[mealType][platName] = rowList;
      return next;
    });

    setSaveStatus('dirty');
  };

  // --- Modal Logic for Ingredient Selector ---
  const openIngredientModal = (mealType, platName) => {
    setCurrentMealForModal(mealType);
    setCurrentPlatForModal(platName);
    
    // Pre-select existing ingredients for this plat
    const currentItems = sheets[mealType][platName] || [];
    const currentIds = new Set(currentItems.map(i => i.bordereau_id));
    setTempSelectedIngredients(currentIds);
    
    setIsIngredientModalOpen(true);
    setIngredientSearch('');
    setSelectedBordereauFilter('');
  };

  const toggleIngredientSelection = (ingredientId) => {
    setTempSelectedIngredients(prev => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  };

  const confirmIngredientSelection = () => {
    const meal = currentMealForModal;
    const plat = currentPlatForModal;
    const currentList = sheets[meal][plat] || [];
    
    // Keep items that are still selected
    let updatedList = currentList.filter(item => tempSelectedIngredients.has(item.bordereau_id));
    
    // Add new items
    const existingIds = new Set(updatedList.map(i => i.bordereau_id));
    const newIds = [...tempSelectedIngredients].filter(id => !existingIds.has(id));
    
    newIds.forEach(id => {
      const ing = globalIngredients.find(g => g.id === id);
      if (ing) {
        const pu_r = Number(ing.unit_price_ht || 0);
        updatedList.push({
          id: `temp_${Math.random()}`,
          meal_type: meal,
          plat_name: plat,
          bordereau_id: ing.id,
          item: ing, // we fake it a bit, the backend returns item.header normally
          quantity_per_person: 0,
          present_people: peopleCounts[meal],
          r: 1.0000,
          calculated_quantity: 0,
          pu_r: pu_r,
          amount: 0,
          isNew: true
        });
      }
    });

    setSheets(prev => {
      const next = { ...prev };
      next[meal] = { ...next[meal], [plat]: updatedList };
      return next;
    });

    setSaveStatus('dirty');
    setIsIngredientModalOpen(false);
  };

  // Filter global ingredients for the modal
  const filteredIngredients = useMemo(() => {
    return globalIngredients.filter(ing => {
      const matchSearch = ingredientSearch === '' || 
        ing.service_description?.toLowerCase().includes(ingredientSearch.toLowerCase()) || 
        ing.price_number?.toLowerCase().includes(ingredientSearch.toLowerCase());
      
      const matchBordereau = selectedBordereauFilter === '' || 
        ing.bordereau_header_id?.toString() === selectedBordereauFilter;

      return matchSearch && matchBordereau;
    });
  }, [globalIngredients, ingredientSearch, selectedBordereauFilter]);


  // Export Excel
  const handleExportExcel = () => {
    const filename = `Fiche_Technique_${date}.xls`;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-family: Arial, sans-serif; font-size: 13px; }
          th { background-color: #0f766e; color: white; font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; color: #0f766e; text-align: center; padding-bottom: 20px; }
          .subtitle { font-size: 14px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e293b; }
          .right { text-align: right; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .plat-title { font-weight: bold; background-color: #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="title">Fiche Technique Journalière - ${dayText} (${date})</div>
    `;

    MEAL_TYPES.forEach(meal => {
      const platsForThisMeal = Object.keys(sheets[meal.id] || {});
      const nbPersonnes = peopleCounts[meal.id] || 0;
      
      if (platsForThisMeal.length > 0) {
        html += `
          <div class="subtitle">${meal.label} - Nombre de personnes : ${nbPersonnes}</div>
          <table>
            <thead>
              <tr>
                <th>Plat / Ingrédient</th>
                <th class="center">Unité</th>
                <th class="center">Qté / 70 pers.</th>
                <th class="center">Qté Totale</th>
                <th class="center">R</th>
                <th class="center">PU</th>
                <th class="center">PUR +/-</th>
                <th class="right">Montant (DH)</th>
              </tr>
            </thead>
            <tbody>
        `;

        platsForThisMeal.forEach(platName => {
          const items = sheets[meal.id][platName] || [];
          
          html += `
            <tr>
              <td colspan="8" class="plat-title">Plat: ${platName}</td>
            </tr>
          `;

          if (items.length === 0) {
            html += `
              <tr>
                <td colspan="8" class="center">Aucun ingrédient</td>
              </tr>
            `;
          } else {
            items.forEach(row => {
              const pur = row.pu_r / (row.r || 1);
              html += `
                <tr>
                  <td>${row.item?.service_description || '-'}</td>
                  <td class="center">${row.item?.unit_of_measure || '-'}</td>
                  <td class="center">${Number(row.quantity_per_person || 0).toFixed(3)}</td>
                  <td class="center">${Number(row.calculated_quantity || 0).toFixed(2)}</td>
                  <td class="center">${Number(row.r || 1).toFixed(2)}</td>
                  <td class="center">${Number(row.pu_r || 0).toFixed(2)}</td>
                  <td class="center">${Number(pur).toFixed(4)}</td>
                  <td class="right">${Number(row.amount || 0).toFixed(2)}</td>
                </tr>
              `;
            });
          }
        });

        html += `
            </tbody>
          </table>
          <table><tr><td style="height:30px; border:none;"></td></tr></table>
        `;
      }
    });

    html += `
        <div style="margin-top: 30px; text-align: right; font-weight: bold; font-size: 16px;">
          Budget Total du Jour : ${totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(8px)', padding: '24px'
    }}>
      <div style={{
        backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px',
        width: '100%', maxWidth: '1400px', maxHeight: '96vh', display: 'flex',
        flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)',
        overflow: 'hidden', color: '#0f172a'
      }}>
        {/* Header - Gradient & Title */}
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '22px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div style={{ backgroundColor: '#0f766e', borderRadius: '12px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="#ccfbf1" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                  Fiches Techniques Journalières
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                  {dayText} · {defaultResidents} résidents
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Auto-save Status Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
              backgroundColor: saveStatus === 'saved' ? 'rgba(16,185,129,0.1)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.1)' : 'rgba(234,88,12,0.1)',
              color: saveStatus === 'saved' ? '#34d399' : saveStatus === 'saving' ? '#60a5fa' : '#fb923c',
              border: `1px solid ${saveStatus === 'saved' ? 'rgba(16,185,129,0.2)' : saveStatus === 'saving' ? 'rgba(59,130,246,0.2)' : 'rgba(234,88,12,0.2)'}`
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: saveStatus === 'saved' ? '#34d399' : saveStatus === 'saving' ? '#60a5fa' : '#fb923c',
                display: 'inline-block',
                animation: saveStatus === 'saving' ? 'pulse 1s infinite' : 'none'
              }} />
              {saveStatus === 'saved' ? (
                <span>Enregistré automatiquement</span>
              ) : saveStatus === 'saving' ? (
                <span>Sauvegarde en cours...</span>
              ) : saveStatus === 'error' ? (
                <span>Erreur de sauvegarde</span>
              ) : (
                <span>Modifications en cours...</span>
              )}
            </div>

            <button onClick={handleExportExcel}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: 'white', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(2,132,199,0.3)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'}
            >
              <Download size={16} />
              Exporter Excel
            </button>

            <button onClick={onClose}
              style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s', color: '#64748b'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Global Summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px',
          padding: '20px 30px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
          }}>
            <div style={{ backgroundColor: 'rgba(15,118,110,0.1)', borderRadius: '10px', padding: '10px' }}>
              <Landmark size={20} color="#0f766e" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget Total du Jour</p>
              <h4 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '800', color: '#0f766e' }}>{totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DH</h4>
            </div>
          </div>
          <div style={{
            backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
          }}>
            <div style={{ backgroundColor: 'rgba(14,165,233,0.1)', borderRadius: '10px', padding: '10px' }}>
              <ShieldCheck size={20} color="#0284c7" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingrédients Sélectionnés</p>
              <h4 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: '800', color: '#0284c7' }}>{totalProductsCount} produit(s)</h4>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px', backgroundColor: '#f8fafc' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '16px' }}>
              <Loader2 className="animate-spin" size={44} color="#0f766e" />
              <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '600' }}>Chargement des données...</p>
            </div>
          ) : (
            MEAL_TYPES.map(meal => {
              const platsForThisMeal = Object.keys(sheets[meal.id] || {});
              
              return (
                <div key={meal.id} style={{
                  backgroundColor: '#ffffff', borderRadius: '24px', padding: '28px',
                  border: `1px solid ${meal.border}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  {/* Meal Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '24px', paddingBottom: '18px', borderBottom: `1px solid ${meal.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        backgroundColor: meal.bg, borderRadius: '14px', padding: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${meal.border}`
                      }}>
                        <meal.icon size={22} color={meal.color} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: meal.color }}>
                        {meal.label}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <label style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
                        Nombre de personnes :
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={peopleCounts[meal.id]}
                        onChange={e => handlePeopleCountChange(meal.id, e.target.value)}
                        style={{
                          width: '80px', padding: '10px 14px', borderRadius: '12px',
                          border: '1px solid #e2e8f0', backgroundColor: '#f8fafc',
                          color: '#0f172a', fontSize: '15px', fontWeight: '800', textAlign: 'center',
                          outline: 'none', transition: 'border-color 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#0f766e'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                      />
                    </div>
                  </div>

                  {/* Plats Iteration */}
                  {platsForThisMeal.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', padding: '10px' }}>
                      Aucun plat planifié. Modifiez le menu de ce jour pour ajouter des plats.
                    </div>
                  ) : (
                    platsForThisMeal.map(platName => {
                      const items = sheets[meal.id][platName] || [];
                      
                      return (
                        <div key={platName} style={{ marginBottom: '32px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: meal.color }}></div>
                              Plat: <span style={{ color: '#0f172a' }}>{platName}</span>
                            </h4>
                            <button
                              onClick={() => openIngredientModal(meal.id, platName)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '8px 16px', border: 'none', borderRadius: '10px',
                                background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)',
                                color: 'white', fontSize: '12px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(15,118,110,0.3)'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #0f766e 100%)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0f766e 0%, #059669 100%)'}
                            >
                              <Plus size={14} /> Gérer ingrédients
                            </button>
                          </div>

                          {items.length > 0 ? (
                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Ingrédient</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Qté / 70 pers.</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Qté Totale</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>R</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>PU</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>PUR +/-</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Montant</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'center', width: '50px' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((row, idx) => {
                                    const pur = row.pu_r / (row.r || 1);
                                    const bName = row.item?.header?.market_name || row.item?.bordereau_name || 'Bordereau';
                                    return (
                                      <tr key={row.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: 'white' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
                                        <td style={{ padding: '12px 16px' }}>
                                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{row.item?.service_description}</div>
                                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{bName}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                            <input
                                              type="number" min="0" step="0.001"
                                              value={row.quantity_per_person || ''}
                                              onChange={e => handleRowChange(meal.id, platName, idx, 'quantity_per_person', e.target.value)}
                                              style={{
                                                width: '70px', padding: '6px 8px', textAlign: 'center',
                                                border: '1px solid #0f766e', borderRadius: '8px',
                                                backgroundColor: '#f0fdfa', color: '#0f766e', fontSize: '13px',
                                                fontWeight: '700', outline: 'none'
                                              }}
                                            />
                                            <span style={{ fontSize: '11px', color: '#64748b' }}>{row.item?.unit_of_measure}</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#334155' }}>
                                          {Number(row.calculated_quantity).toFixed(2)} {row.item?.unit_of_measure}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                          <input
                                            type="number" min="0.0001" step="0.1"
                                            value={row.r || ''}
                                            onChange={e => handleRowChange(meal.id, platName, idx, 'r', e.target.value)}
                                            style={{
                                              width: '50px', padding: '4px', textAlign: 'center',
                                              border: '1px solid #cbd5e1', borderRadius: '6px',
                                              backgroundColor: 'white', color: '#0f172a', fontSize: '12px', outline: 'none'
                                            }}
                                          />
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>
                                          {Number(row.pu_r).toFixed(2)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569' }}>
                                          {pur.toFixed(4)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: '#0f766e' }}>
                                          {Number(row.amount).toFixed(2)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                          <button
                                            onClick={() => handleRemoveProduct(meal.id, platName, idx)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px' }}
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div style={{
                              padding: '20px', border: '1px dashed #cbd5e1', borderRadius: '12px',
                              textAlign: 'center', color: '#64748b', fontSize: '13px'
                            }}>
                              Aucun ingrédient sélectionné pour ce plat.
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* INGREDIENT SELECTOR MODAL */}
      {isIngredientModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '900px',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Gérer les ingrédients</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Plat: <span style={{ color: '#0f766e', fontWeight: '600' }}>{currentPlatForModal}</span></p>
              </div>
              <button onClick={() => setIsIngredientModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Filters */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', backgroundColor: '#f8fafc' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Rechercher par désignation..." 
                  value={ingredientSearch}
                  onChange={e => setIngredientSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>
              <div style={{ position: 'relative', width: '300px' }}>
                <Filter size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <select
                  value={selectedBordereauFilter}
                  onChange={e => setSelectedBordereauFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px',
                    border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a',
                    fontSize: '14px', outline: 'none', appearance: 'none', boxSizing: 'border-box'
                  }}
                >
                  <option value="">Tous les bordereaux</option>
                  {bordereauHeaders.map(h => (
                    <option key={h.id} value={h.id}>{h.market_name}</option>
                  ))}
                </select>
                <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 24px', width: '40px' }}></th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: '600' }}>Désignation</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: '600' }}>Bordereau Source</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>Unité</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b', fontWeight: '600' }}>Prix (PU)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.slice(0, 100).map(ing => { // limit to 100 to prevent huge render lag if search is empty
                    const isSelected = tempSelectedIngredients.has(ing.id);
                    return (
                      <tr 
                        key={ing.id} 
                        onClick={() => toggleIngredientSelection(ing.id)}
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(15,118,110,0.05)' : 'white',
                          transition: 'background-color 0.1s'
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'white'; }}
                      >
                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#0f766e' : '#cbd5e1'}`,
                            backgroundColor: isSelected ? '#0f766e' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: isSelected ? '#0f766e' : '#0f172a', fontWeight: isSelected ? '600' : '400' }}>
                          {ing.service_description}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {ing.bordereau_name}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#64748b' }}>
                          {ing.unit_of_measure || '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155', fontWeight: '500' }}>
                          {Number(ing.unit_price_ht).toFixed(2)} DH
                        </td>
                      </tr>
                    );
                  })}
                  {filteredIngredients.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        Aucun ingrédient ne correspond à votre recherche.
                      </td>
                    </tr>
                  )}
                  {filteredIngredients.length > 100 && (
                     <tr>
                     <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px', backgroundColor: '#f8fafc' }}>
                       Plus de 100 résultats trouvés. Veuillez affiner votre recherche.
                     </td>
                   </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button onClick={() => setIsIngredientModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', cursor: 'pointer', fontWeight: '600' }}>
                Annuler
              </button>
              <button onClick={confirmIngredientSelection} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)', color: 'white', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={16} /> Valider la sélection ({tempSelectedIngredients.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FicheTechniqueModal;
