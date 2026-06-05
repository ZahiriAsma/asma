import React, { useState, useEffect } from 'react';
import {
  Coffee, Utensils, Moon, FileText, AlertTriangle, CheckCircle2,
  Printer, Plus, X, Save, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../api/axios';
import { useDashboard } from '../context/DashboardContext';
import FicheTechniqueModal from './FicheTechniqueModal';

const formatDateISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getMondayOfWeek = (refDate = new Date()) => {
  const monday = new Date(refDate);
  const day = monday.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekDays = (weekMonday) => {
  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const fullDayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  return Array.from({ length: 7 }, (_, idx) => {
    const dayDate = new Date(weekMonday);
    dayDate.setDate(weekMonday.getDate() + idx);
    return {
      name: dayNames[idx],
      date: dayDate.getDate().toString(),
      full: fullDayNames[idx],
      dateObj: dayDate,
      iso: formatDateISO(dayDate),
    };
  });
};

/** Parse une ligne du menu (format base de données) en { name, qty } */
const parseMealLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const colonMatch = trimmed.match(/^(.+?):\s*(.+)$/);
  if (colonMatch) {
    return { name: colonMatch[1].trim(), qty: colonMatch[2].trim() };
  }

  const leadingQty = trimmed.match(/^(\d+\/\d+|\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (leadingQty) {
    return { name: leadingQty[2].trim(), qty: leadingQty[1].replace(',', '.') };
  }

  const unitQty = trimmed.match(/^(\d+(?:[.,]\d+)?\s*(?:ml|cl|L|kg|g))\s+(.+)$/i);
  if (unitQty) {
    return { name: unitQty[2].trim(), qty: unitQty[1].replace(',', '.') };
  }

  return { name: trimmed, qty: 'par pers.' };
};

const mealTextToItems = (mealText) => {
  if (!mealText) return [];
  return mealText
    .split('\n')
    .map(parseMealLine)
    .filter(Boolean);
};

const parsePlats = (text) => {
  if (!text) return [];
  const parts = text.split(/[\n,+;]/).map(p => p.trim()).filter(p => p.length > 0);
  return parts.map(p => {
    return p.replace(/^(\d+\/\d+|\d+(?:[.,]\d+)?(?:ml|cl|L|kg|g)?)\s+/i, '').trim();
  }).filter((value, index, self) => self.indexOf(value) === index);
};



const MenusContent = () => {
  const { setShowNotifications, addNotification } = useDashboard();
  const today = new Date();
  const todayIso = formatDateISO(today);

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(today));
  const daysInfo = getWeekDays(weekStart);

  const todayIndexInWeek = daysInfo.findIndex((d) => d.iso === todayIso);
  const defaultDayIndex = todayIndexInWeek >= 0 ? todayIndexInWeek : 0;

  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(defaultDayIndex);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    petit_dejeuner: '',
    dejeuner: '',
    diner: '',
    residents: 70,
    kcal_pd: 620,
    kcal_dej: 820,
    kcal_din: 580
  });
  const [saving, setSaving] = useState(false);
  const [showFicheTechnique, setShowFicheTechnique] = useState(false);
  const [dailyIngredients, setDailyIngredients] = useState([]);
  const [dailyStocks, setDailyStocks] = useState([]);

  // ── Carousel images — matched to actual menu dishes ──
  const CAROUSEL_IMAGES = {
    // Petit-déjeuner : Café au lait · Beurre ou fromage · Confiture · Pain
    breakfast: [
      { image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=700&q=80', label: 'Café au lait' },
      { image_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=700&q=80', label: 'Confiture' },
      { image_url: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?w=700&q=80', label: 'Beurre / Fromage' },
      { image_url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=700&q=80', label: 'Pain' },
    ],
    // Déjeuner : Salade italienne · Bœuf pruneaux lentilles · Fruits de saison · Pain
    lunch: [
      { image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&q=80', label: 'Salade italienne' },
      { image_url: 'https://images.unsplash.com/photo-1520218064547-b7b99ab89977?w=700&q=80', label: 'Bœuf aux pruneaux' },
      { image_url: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=700&q=80', label: 'Lentilles' },
      { image_url: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=700&q=80', label: 'Fruits de saison' },
    ],
    // Dîner : Dinde à la sauce · Riz aux légumes vapeur · Pain
    dinner: [
      { image_url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=700&q=80', label: 'Dinde à la sauce' },
      { image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=700&q=80', label: 'Riz aux légumes vapeur' },
      { image_url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=700&q=80', label: 'Pain' },
    ],
  };
  const [carouselIdx, setCarouselIdx] = useState({ breakfast: 0, lunch: 0, dinner: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIdx(prev => ({
        breakfast: (prev.breakfast + 1) % CAROUSEL_IMAGES.breakfast.length,
        lunch: (prev.lunch + 1) % CAROUSEL_IMAGES.lunch.length,
        dinner: (prev.dinner + 1) % CAROUSEL_IMAGES.dinner.length,
      }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const prevSlide = (meal) => setCarouselIdx(prev => {
    const len = CAROUSEL_IMAGES[meal].length;
    return { ...prev, [meal]: (prev[meal] - 1 + len) % len };
  });
  const nextSlide = (meal) => setCarouselIdx(prev => {
    const len = CAROUSEL_IMAGES[meal].length;
    return { ...prev, [meal]: (prev[meal] + 1) % len };
  });

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const dateStr = daysInfo[selectedDayIndex]?.iso;
        if (!dateStr) return;
        const [sheetsRes, stocksRes] = await Promise.all([
          api.get(`/technical-sheets?date=${dateStr}`),
          api.get('/stocks'),
        ]);
        setDailyIngredients(sheetsRes.data || []);
        setDailyStocks(stocksRes.data || []);
      } catch (err) {
        console.error('Error fetching daily data', err);
        setDailyIngredients([]);
        setDailyStocks([]);
      }
    };
    fetchDailyData();
  }, [selectedDayIndex, weekStart, showFicheTechnique]); // re-fetch when showFicheTechnique closes

  useEffect(() => {
    fetchMenus(weekStart);
  }, [weekStart]);

  useEffect(() => {
    const idx = daysInfo.findIndex((d) => d.iso === todayIso);
    if (formatDateISO(weekStart) === formatDateISO(getMondayOfWeek(today)) && idx >= 0) {
      setSelectedDayIndex(idx);
    } else {
      setSelectedDayIndex(0);
    }
  }, [weekStart]);

  const fetchMenus = async (monday) => {
    try {
      setLoading(true);
      const res = await api.get('/menus', {
        params: { week_start: formatDateISO(monday) },
      });
      const fetchedMenus = res.data;
      setMenus(fetchedMenus);
    } catch (err) {
      console.error('Erreur lors de la récupération des menus:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedDay = daysInfo[selectedDayIndex];
  const selectedMenu = menus.find((m) => {
    const menuDate = typeof m.date === 'string' ? m.date.slice(0, 10) : formatDateISO(new Date(m.date));
    return menuDate === selectedDay?.iso;
  }) || null;

  const changeWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(next);
  };

  const handleOpenEditModal = () => {
    if (selectedMenu) {
      setEditFormData({
        petit_dejeuner: selectedMenu.petit_dejeuner || '',
        dejeuner: selectedMenu.dejeuner || '',
        diner: selectedMenu.diner || '',
        residents: selectedMenu.residents || 70,
        kcal_pd: selectedMenu.kcal_pd || 620,
        kcal_dej: selectedMenu.kcal_dej || 820,
        kcal_din: selectedMenu.kcal_din || 580
      });
    } else {
      setEditFormData({
        petit_dejeuner: '',
        dejeuner: '',
        diner: '',
        residents: 70,
        kcal_pd: 620,
        kcal_dej: 820,
        kcal_din: 580
      });
    }
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (selectedMenu) {
        const res = await api.put(`/menus/${selectedMenu.id}`, editFormData);
        setMenus((prev) => prev.map((m) => (m.id === selectedMenu.id ? res.data.menu : m)));
      } else {
        const selectedDay = daysInfo[selectedDayIndex];
        const res = await api.post(`/menus`, {
          ...editFormData,
          date: selectedDay.iso
        });
        setMenus((prev) => [...prev, res.data.menu]);
      }
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du menu:', err);
      alert('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getMealItems = (mealText) => mealTextToItems(mealText);

  // Returns hierarchical structure: array of meal sections,
  // each containing dishes, each containing ingredients with stock info.
  const getIngredientNeeds = () => {
    const MEAL_LABELS = {
      breakfast: { label: 'Petit-déjeuner', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
      lunch: { label: 'Déjeuner', color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' },
      dinner: { label: 'Dîner', color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
    };

    if (!dailyIngredients || dailyIngredients.length === 0) {
      return null; // signals "no technical sheets yet"
    }

    const parsedPlats = {
      breakfast: parsePlats(selectedMenu?.petit_dejeuner),
      lunch: parsePlats(selectedMenu?.dejeuner),
      dinner: parsePlats(selectedMenu?.diner)
    };

    // Group sheets: meal → dish → [ingredients]
    const byMeal = {};
    dailyIngredients.forEach((sheet) => {
      const meal = sheet.meal_type || 'lunch';
      const plat = sheet.plat_name || 'Autre';

      // Only show ingredients for dishes that exist in today's menu
      const menuPlatsForMeal = parsedPlats[meal] || [];
      if (!menuPlatsForMeal.includes(plat)) return;

      if (!byMeal[meal]) byMeal[meal] = {};
      if (!byMeal[meal][plat]) byMeal[meal][plat] = [];

      const stockEntry = dailyStocks.find(
        (s) => s.designation?.toLowerCase() === sheet.bordereau?.service_description?.toLowerCase()
      );

      const grossReq = Number(sheet.calculated_quantity || 0);
      const stockQty = stockEntry ? Number(stockEntry.quantite_restante || 0) : null;
      const isShortage = stockQty !== null && stockQty < grossReq;

      byMeal[meal][plat].push({
        name: sheet.bordereau?.service_description || '—',
        unit: sheet.bordereau?.unit_of_measure || '',
        grossReq,
        stockQty,
        isShortage,
      });
    });

    // Build ordered array of meal sections
    const ORDER = ['breakfast', 'lunch', 'dinner'];
    return ORDER
      .filter((m) => byMeal[m])
      .map((mealKey) => {
        const meta = MEAL_LABELS[mealKey] || { label: mealKey, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
        const dishes = Object.entries(byMeal[mealKey]).map(([dishName, ingredients]) => {
          const totalReq = ingredients.reduce((s, i) => s + i.grossReq, 0);
          return { dishName, ingredients, totalReq };
        });
        return { mealKey, ...meta, dishes };
      });
  };

  const getSelectedDayFullText = () => {
    if (daysInfo.length === 0) return '';
    const day = daysInfo[selectedDayIndex];
    const dateObj = day.dateObj;

    const monthsFr = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    return `${day.full} ${dateObj.getDate()} ${monthsFr[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  };

  const getWeekRangeText = () => {
    if (daysInfo.length === 0) return '';
    const startDay = daysInfo[0].dateObj;
    const endDay = daysInfo[6].dateObj;

    const monthsFr = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
    ];

    const startMonth = monthsFr[startDay.getMonth()];
    const endMonth = monthsFr[endDay.getMonth()];
    const startYear = startDay.getFullYear();
    const endYear = endDay.getFullYear();

    if (startMonth === endMonth) {
      return `Semaine du ${startDay.getDate()} au ${endDay.getDate()} ${startMonth} ${startYear}`;
    } else if (startYear === endYear) {
      return `Semaine du ${startDay.getDate()} ${startMonth} au ${endDay.getDate()} ${endMonth} ${startYear}`;
    } else {
      return `Semaine du ${startDay.getDate()} ${startMonth} ${startYear} au ${endDay.getDate()} ${endMonth} ${endYear}`;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMenuForIso = (iso) =>
    menus.find((m) => {
      const menuDate = typeof m.date === 'string' ? m.date.slice(0, 10) : formatDateISO(new Date(m.date));
      return menuDate === iso;
    }) || null;

  const formatDayFullLabel = (day) => {
    const monthsFr = [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ];
    const d = day.dateObj;
    return `${day.full} ${d.getDate()} ${monthsFr[d.getMonth()]} ${d.getFullYear()}`;
  };

  const renderPrintMealList = (mealText) => {
    const items = mealTextToItems(mealText);
    if (items.length === 0) return <li>—</li>;
    return items.map((item, i) => (
      <li key={i}>
        {item.name}
        {item.qty !== 'par pers.' ? ` (${item.qty})` : ''}
      </li>
    ));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} className="animate-spin" style={{ color: '#0f766e', margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>Chargement du calendrier des menus...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="menus-page" style={{ padding: '32px', maxWidth: '1280px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      <div className="menus-print-area">

        {/* ── Header (écran) ── */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>Menus journaliers</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              {getWeekRangeText()} · Année 2025-2026
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', border: '1px solid #cbd5e1',
                borderRadius: '10px', backgroundColor: 'white',
                color: '#334155', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Printer size={15} /> Imprimer semaine
            </button>
            <button
              onClick={handleOpenEditModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 18px', border: 'none',
                borderRadius: '10px', backgroundColor: '#0f766e',
                color: 'white', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)'
              }}
            >
              <Plus size={15} /> Planifier menu
            </button>
          </div>
        </div>

        {/* ── Navigation semaine (écran) ── */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '16px' }} role="navigation" aria-label="Navigation par semaine">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
            aria-label="Semaine précédente"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', border: '1px solid #e2e8f0',
              borderRadius: '10px', backgroundColor: 'white', color: '#475569',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', minWidth: '220px', textAlign: 'center' }}>
            {getWeekRangeText()}
          </span>
          <button
            type="button"
            onClick={() => changeWeek(1)}
            aria-label="Semaine suivante"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', border: '1px solid #e2e8f0',
              borderRadius: '10px', backgroundColor: 'white', color: '#475569',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Week Calendar Bar (écran) ── */}
        <div className="no-print" style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '12px', marginBottom: '24px'
        }}>
          {daysInfo.map((day, idx) => {
            const isSelected = selectedDayIndex === idx;
            const isToday = day.iso === todayIso;
            return (
              <button
                key={day.iso}
                onClick={() => setSelectedDayIndex(idx)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '16px 12px', border: isSelected ? 'none' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  background: isSelected ? 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)' : 'white',
                  color: isSelected ? 'white' : '#64748b',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 10px 15px -3px rgba(15, 118, 110, 0.3)' : '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', opacity: isSelected ? 0.9 : 0.6, marginBottom: '6px' }}>
                  {day.name}
                </span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: isSelected ? 'white' : '#1e293b' }}>
                  {day.date}
                </span>
                {isToday && !isSelected && (
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#0f766e', marginTop: '4px' }}>
                    Aujourd&apos;hui
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Vue écran : jour sélectionné ── */}
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
            <span style={{
              backgroundColor: '#f1f5f9', color: '#1e293b',
              fontWeight: '700', fontSize: '13px',
              padding: '6px 18px', borderRadius: '20px',
              border: '1px solid #e2e8f0'
            }}>
              {getSelectedDayFullText()}
            </span>
          </div>

          {/* ── Meal Cards Grid ── */}
          {selectedMenu ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>

              {/* Breakfast Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px',
                border: '1px solid #fef3c7', overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  backgroundColor: '#fef3c7', padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid rgba(217, 119, 6, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Coffee size={18} color="#d97706" />
                    <span style={{ fontWeight: '800', color: '#b45309', fontSize: '15px' }}>Petit-déjeuner</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>{selectedMenu.time_pd}</span>
                </div>
                {/* Breakfast Carousel */}
                <div style={{ position: 'relative', height: '190px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  <img
                    src={CAROUSEL_IMAGES.breakfast[carouselIdx.breakfast].image_url}
                    alt="Petit-déjeuner"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1504630083234-14187a9df0f5?w=700&q=80'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.5s ease' }}
                  />
                  <button onClick={() => prevSlide('breakfast')} aria-label="Précédent" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button onClick={() => nextSlide('breakfast')} aria-label="Suivant" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                    {CAROUSEL_IMAGES.breakfast.map((_, i) => (
                      <span key={i} onClick={() => setCarouselIdx(p => ({ ...p, breakfast: i }))} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i === carouselIdx.breakfast ? '#f97316' : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'inline-block', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {getMealItems(selectedMenu.petit_dejeuner).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                        <span style={{ color: '#475569', fontWeight: '500' }}>{item.name}</span>
                        <span style={{ color: '#0f172a', fontWeight: '700' }}>{item.qty}</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* Lunch Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px',
                border: '1px solid #dcfce7', overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  backgroundColor: '#dcfce7', padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid rgba(22, 163, 74, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Utensils size={18} color="#16a34a" />
                    <span style={{ fontWeight: '800', color: '#15803d', fontSize: '15px' }}>Déjeuner</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600' }}>{selectedMenu.time_dej}</span>
                </div>
                {/* Lunch Carousel */}
                <div style={{ position: 'relative', height: '190px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  <img
                    src={CAROUSEL_IMAGES.lunch[carouselIdx.lunch].image_url}
                    alt="Déjeuner"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=700&q=80'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.5s ease' }}
                  />
                  <button onClick={() => prevSlide('lunch')} aria-label="Précédent" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button onClick={() => nextSlide('lunch')} aria-label="Suivant" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                    {CAROUSEL_IMAGES.lunch.map((_, i) => (
                      <span key={i} onClick={() => setCarouselIdx(p => ({ ...p, lunch: i }))} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i === carouselIdx.lunch ? '#22c55e' : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'inline-block', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {getMealItems(selectedMenu.dejeuner).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                        <span style={{ color: '#475569', fontWeight: '500' }}>{item.name}</span>
                        <span style={{ color: '#0f172a', fontWeight: '700' }}>{item.qty}</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

              {/* Dinner Card */}
              <div style={{
                backgroundColor: 'white', borderRadius: '16px',
                border: '1px solid #f3e8ff', overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{
                  backgroundColor: '#f3e8ff', padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid rgba(124, 58, 237, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Moon size={18} color="#7c3aed" />
                    <span style={{ fontWeight: '800', color: '#6d28d9', fontSize: '15px' }}>Dîner</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#6d28d9', fontWeight: '600' }}>{selectedMenu.time_din}</span>
                </div>
                {/* Dinner Carousel */}
                <div style={{ position: 'relative', height: '190px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                  <img
                    src={CAROUSEL_IMAGES.dinner[carouselIdx.dinner].image_url}
                    alt="Dîner"
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=700&q=80'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.5s ease' }}
                  />
                  <button onClick={() => prevSlide('dinner')} aria-label="Précédent" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button onClick={() => nextSlide('dinner')} aria-label="Suivant" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                  <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                    {CAROUSEL_IMAGES.dinner.map((_, i) => (
                      <span key={i} onClick={() => setCarouselIdx(p => ({ ...p, dinner: i }))} style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: i === carouselIdx.dinner ? '#a855f7' : 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'inline-block', transition: 'background 0.3s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {getMealItems(selectedMenu.diner).map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '8px' }}>
                        <span style={{ color: '#475569', fontWeight: '500' }}>{item.name}</span>
                        <span style={{ color: '#0f172a', fontWeight: '700' }}>{item.qty}</span>
                      </div>
                    ))}
                  </div>

                </div>
              </div>

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              Aucun menu planifié pour le {getSelectedDayFullText()}.
            </div>
          )}

        </div>

        {/* ── Bouton Fiche Technique ── */}
        {selectedMenu && (
          <div className="no-print" style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <button
              onClick={() => setShowFicheTechnique(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 28px', border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0f766e 0%, #059669 100%)',
                color: 'white', fontSize: '14px', fontWeight: '700',
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 8px 20px -4px rgba(15, 118, 110, 0.4)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #0f766e 100%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0f766e 0%, #059669 100%)'}
            >
              <FileText size={17} />
              Fiche Technique
            </button>
          </div>
        )}

        <div className="menus-print-only">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 6px', color: '#0f172a' }}>
              Menu hebdomadaire – Internat ISTA Ouarzazate
            </h1>
            <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: '#0f766e' }}>
              {getWeekRangeText()} · Année 2025-2026
            </p>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>
              NB : des modifications peuvent être apportées pour circonstances exceptionnelles ou disponibilité des articles.
            </p>
          </div>

          {daysInfo.map((day) => {
            const menu = getMenuForIso(day.iso);
            return (
              <div key={day.iso} className="print-day-block">
                <h3>{formatDayFullLabel(day)}</h3>
                {menu ? (
                  <>
                    <p className="print-meal-title">Petit-déjeuner ({menu.time_pd})</p>
                    <ul className="print-meal-list">{renderPrintMealList(menu.petit_dejeuner)}</ul>
                    <p className="print-meal-title">Déjeuner ({menu.time_dej})</p>
                    <ul className="print-meal-list">{renderPrintMealList(menu.dejeuner)}</ul>
                    <p className="print-meal-title">Dîner ({menu.time_din})</p>
                    <ul className="print-meal-list">{renderPrintMealList(menu.diner)}</ul>

                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Aucun menu planifié.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Besoin total (écran uniquement) ── */}
        <div className="no-print" style={{
          backgroundColor: 'white', borderRadius: '16px',
          padding: '24px', border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <FileText size={20} color="#0f766e" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              Besoin total – {getSelectedDayFullText()} ({selectedMenu ? selectedMenu.residents : 70} résidents)
            </h3>
          </div>

          {(() => {
            const mealSections = getIngredientNeeds();

            if (mealSections === null) {
              return (
                <div style={{
                  padding: '32px', textAlign: 'center',
                  border: '2px dashed #e2e8f0', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px'
                }}>
                  <FileText size={32} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                  <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#64748b' }}>
                    Aucune fiche technique pour ce jour.
                  </p>
                  <p style={{ margin: 0, fontSize: '13px' }}>
                    Cliquez sur <strong>Fiche Technique</strong> ci-dessus pour saisir les ingrédients par plat.
                  </p>
                </div>
              );
            }

            return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Plat / Ingrédient</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Besoin Brut</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock Disponible</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mealSections.map((meal) =>
                      meal.dishes.map((dish) => (
                        <React.Fragment key={`${meal.mealKey}-${dish.dishName}`}>
                          <tr style={{ backgroundColor: '#f1f5f9' }}>
                            <td colSpan={4} style={{
                              padding: '10px 16px', fontWeight: '700', fontSize: '13px',
                              color: '#1e293b', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0'
                            }}>
                              <span style={{ color: '#64748b', fontWeight: '500', marginRight: '6px', fontSize: '12px' }}>
                                {meal.label} ·
                              </span>
                              {dish.dishName}
                              <span style={{ marginLeft: '12px', fontSize: '12px', fontWeight: '500', color: '#0f766e' }}>
                                (Total : {dish.totalReq.toFixed(2)})
                              </span>
                            </td>
                          </tr>
                          {dish.ingredients.map((ing, idx) => (
                            <tr key={idx} style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: ing.isShortage ? '#fff8f8' : 'white'
                            }}>
                              <td style={{ padding: '11px 16px 11px 32px', color: '#334155', fontWeight: '500' }}>
                                {ing.name}
                              </td>
                              <td style={{ padding: '11px 16px', textAlign: 'center', color: '#1e293b', fontWeight: '600' }}>
                                {ing.grossReq.toFixed(2)} {ing.unit}
                              </td>
                              <td style={{
                                padding: '11px 16px', textAlign: 'center', fontWeight: '600',
                                color: ing.stockQty === null ? '#94a3b8' : ing.isShortage ? '#dc2626' : '#16a34a'
                              }}>
                                {ing.stockQty === null ? '—' : `${Number(ing.stockQty).toFixed(2)} ${ing.unit}`}
                              </td>
                              <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                                {ing.stockQty === null ? (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Non suivi</span>
                                ) : ing.isShortage ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    backgroundColor: '#fef2f2', color: '#dc2626',
                                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
                                  }}>
                                    <AlertTriangle size={11} /> Manque
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    backgroundColor: '#f0fdf4', color: '#16a34a',
                                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
                                  }}>
                                    <CheckCircle2 size={11} /> OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

      </div>

      {/* ── Edit Menu Modal (Planifier menu) ── */}
      {isEditModalOpen && (
        <div className="no-print" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '560px',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '28px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Modifier le menu du {getSelectedDayFullText()}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Ajustez les éléments et calories servis ce jour.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                Indiquez les plats ligne par ligne. Exemple: <strong>Salade italienne</strong> ou <strong>Pain</strong>.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Petit-déjeuner (Un produit par ligne)
                </label>
                <textarea
                  rows={4}
                  value={editFormData.petit_dejeuner}
                  onChange={(e) => setEditFormData({ ...editFormData, petit_dejeuner: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                    borderRadius: '8px', padding: '10px', fontSize: '13px', outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Déjeuner (Un produit par ligne)
                </label>
                <textarea
                  rows={4}
                  value={editFormData.dejeuner}
                  onChange={(e) => setEditFormData({ ...editFormData, dejeuner: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                    borderRadius: '8px', padding: '10px', fontSize: '13px', outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Dîner (Un produit par ligne)
                </label>
                <textarea
                  rows={4}
                  value={editFormData.diner}
                  onChange={(e) => setEditFormData({ ...editFormData, diner: e.target.value })}
                  style={{
                    width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                    borderRadius: '8px', padding: '10px', fontSize: '13px', outline: 'none',
                    fontFamily: 'inherit'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Résidents
                  </label>
                  <input
                    type="number"
                    value={editFormData.residents}
                    onChange={(e) => setEditFormData({ ...editFormData, residents: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '8px', fontSize: '13px'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Kcal P.D.
                  </label>
                  <input
                    type="number"
                    value={editFormData.kcal_pd}
                    onChange={(e) => setEditFormData({ ...editFormData, kcal_pd: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '8px', fontSize: '13px'
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Kcal Dej.
                  </label>
                  <input
                    type="number"
                    value={editFormData.kcal_dej}
                    onChange={(e) => setEditFormData({ ...editFormData, kcal_dej: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1',
                      borderRadius: '8px', padding: '8px', fontSize: '13px'
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: '10px 18px', border: '1px solid #cbd5e1',
                    borderRadius: '8px', backgroundColor: 'white', color: '#475569',
                    fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 18px', border: 'none', borderRadius: '8px',
                    backgroundColor: '#0f766e', color: 'white', fontSize: '13px',
                    fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Enregistrer
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* ── Modale Fiche Technique ── */}
      {showFicheTechnique && selectedMenu && (
        <FicheTechniqueModal
          selectedMenu={selectedMenu}
          date={selectedMenu.date}
          dayText={getSelectedDayFullText()}
          onClose={() => setShowFicheTechnique(false)}
        />
      )}

    </div>
  );
};

export default MenusContent;
