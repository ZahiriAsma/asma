import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Filter, Folder, Calendar, DollarSign, Archive, FolderOpen,
  ChevronLeft, FileText, Printer, Download, Edit2, Trash2, Eye, Search, X, Check, ChevronDown, Package
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/axios';

const calculateVatBreakdown = (items) => {
  let totalHt = 0;
  let baseHt9 = 0;
  let baseHt10 = 0;
  let baseHt20 = 0;

  (items || []).forEach(item => {
    const qty = parseFloat(item.qty ?? (item.quantity ?? 0));
    const pu = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
    const lineHt = qty * pu;
    const vatRate = parseFloat(item.vat_rate !== undefined ? item.vat_rate : 20);

    totalHt += lineHt;
    if (vatRate === 9) {
      baseHt9 += lineHt;
    } else if (vatRate === 10) {
      baseHt10 += lineHt;
    } else if (vatRate === 20) {
      baseHt20 += lineHt;
    } else {
      // Default to 20% or group other rates
      baseHt20 += lineHt;
    }
  });

  const tva9 = baseHt9 * 0.09;
  const tva10 = baseHt10 * 0.10;
  const tva20 = baseHt20 * 0.20;
  const totalTva = tva9 + tva10 + tva20;
  const totalTtc = totalHt + totalTva;

  return {
    totalHt,
    baseHt9,
    baseHt10,
    baseHt20,
    tva9,
    tva10,
    tva20,
    totalTva,
    totalTtc
  };
};

const numberToFrenchWords = (num) => {
  if (num === 0) return 'Zéro Dirhams';
  
  const unities = ['', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf'];
  const teens = ['Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze', 'Seize', 'Dix-Sept', 'Dix-Huit', 'Dix-Neuf'];
  const tens = ['', 'Dix', 'Vingt', 'Trente', 'Quarante', 'Cinquante', 'Soixante', 'Soixante-Dix', 'Quatre-Vingt', 'Quatre-Vingt-Dix'];
  
  const convertBelow100 = (n) => {
    if (n < 10) return unities[n];
    if (n < 20) return teens[n - 10];
    let tenDigit = Math.floor(n / 10);
    let unitDigit = n % 10;
    if (tenDigit === 7 || tenDigit === 9) {
      return tens[tenDigit - 1] + (unitDigit === 1 && tenDigit === 7 ? ' et Onze' : '-' + teens[unitDigit]);
    }
    if (unitDigit === 0) return tens[tenDigit];
    if (unitDigit === 1) return tens[tenDigit] + ' et Un';
    return tens[tenDigit] + '-' + unities[unitDigit];
  };

  const convertBelow1000 = (n) => {
    if (n < 100) return convertBelow100(n);
    let hundredDigit = Math.floor(n / 100);
    let rest = n % 100;
    let hundredStr = hundredDigit === 1 ? 'Cent' : unities[hundredDigit] + ' Cent';
    if (rest === 0) return hundredStr + (hundredDigit > 1 && hundredStr !== 'Cent' ? 's' : '');
    return hundredStr + ' ' + convertBelow100(rest);
  };

  let intPart = Math.floor(num);
  let decPart = Math.round((num - intPart) * 100);
  let result = '';
  
  if (intPart >= 1000000) {
    let millions = Math.floor(intPart / 1000000);
    result += convertBelow1000(millions) + ' Million' + (millions > 1 ? 's ' : ' ');
    intPart %= 1000000;
  }
  
  if (intPart >= 1000) {
    let thousands = Math.floor(intPart / 1000);
    if (thousands === 1) {
      result += 'Mille ';
    } else {
      result += convertBelow1000(thousands) + ' Mille ';
    }
    intPart %= 1000;
  }
  
  if (intPart > 0 || result === '') {
    result += convertBelow1000(intPart);
  }
  
  result = result.trim() + ' Dirhams';
  
  if (decPart > 0) {
    result += ' et ' + convertBelow100(decPart) + ' Centimes';
  }
  
  return result;
};

const MarchesContent = ({ filterFournisseurId, onClearFournisseurFilter }) => {
  const [marches, setMarches] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    titulaire: '',
    id_fournisseur: ''
  });
  const [activeMarchesTab, setActiveMarchesTab] = useState('actifs');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMarche, setSelectedMarche] = useState(null);
  // Ref so async callbacks (fetchMarches) always read the latest selectedMarche
  const selectedMarcheRef = useRef(null);
  const [activeDocTab, setActiveDocTab] = useState('bc');

  // Dynamic state for Bons de commande documents (now loaded from database)
  const [bcs, setBcs] = useState([]);
  const [showBcModal, setShowBcModal] = useState(false);
  const [newBcData, setNewBcData] = useState({
    numeroBC: '',
    dateEmission: new Date().toISOString().split('T')[0],
    budget: 'Budget de Fonctionnement',
    exercice: new Date().getFullYear(),
    rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
    referenceMarcheCadre: '',
    lieuLivraison: 'Internat OFPPT Casablanca',
    conditionsGenerales: 'Nous vous prions de bien vouloir exécuter la présente commande aux conditions ci-après.',
    conditionsParticulieres: '',
    montantHT: '0.00',
    montantTVA: '0.00',
    montantTTC: '0.00',
    statut: 'En cours',
    type: '',
    fournisseur_id: '',
    items: []
  });
  const [editingBc, setEditingBc] = useState(null);
  const [selectedBcForView, setSelectedBcForView] = useState(null);
  const [bordereauItems, setBordereauItems] = useState([]);
  const [bordereauHeaders, setBordereauHeaders] = useState([]);

  // Dynamic state for Bons de livraison documents
  const [bls, setBls] = useState([]);
  const [showBlModal, setShowBlModal] = useState(false);
  const [newBlData, setNewBlData] = useState({
    numeroBL: '',
    dateLivraison: new Date().toISOString().split('T')[0],
    exercice: new Date().getFullYear(),
    rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
    referenceBCs: [],
    lieuLivraison: 'Internat OFPPT Casablanca',
    conditionsGenerales: 'Livraison sous 5 jours. Paiement à 60 jours.',
    conditionsParticulieres: '',
    montantHT: '0.00',
    montantTVA: '0.00',
    montantTTC: '0.00',
    statut: 'En cours',
    type: '',
    fournisseur_id: '',
    items: []
  });
  const [editingBl, setEditingBl] = useState(null);
  const [selectedBlForView, setSelectedBlForView] = useState(null);
  const [blDropdownOpen, setBlDropdownOpen] = useState(false);

  
  // --- Attachments State ---
  const [attachments, setAttachments] = useState([]);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [newAttachmentData, setNewAttachmentData] = useState({
    numero_attachment: '',
    bon_livraison_id: '',
    budget: 'BF',
    exercice: new Date().getFullYear(),
    rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
    reference_marche: '',
    lieu_livraison: 'Ouarzazate',
    items: []
  });
  const [editingAttachmentGroup, setEditingAttachmentGroup] = useState(null);

  // --- Factures State ---
  const [factures, setFactures] = useState([]);
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [newFactureData, setNewFactureData] = useState({
    numero_facture: '',
    date_facture: new Date().toISOString().split('T')[0],
    client: 'OFPPT / ISTA Ouarzazate',
    ice_client: '',
    reference_bc: '',
    site_livraison: 'ISTA Ouarzazate',
    conditions_generales: 'Paiement à réception de la facture.',
    conditions_particulieres: '',
    montantHT: '0.00',
    montantTVA: '0.00',
    tva_9: '0.00',
    tva_10: '0.00',
    tva_20: '0.00',
    montantTTC: '0.00',
    montant_lettres: '',
    statut: 'En cours',
    items: []
  });
  const [editingFacture, setEditingFacture] = useState(null);
  const [selectedFactureForView, setSelectedFactureForView] = useState(null);

  // --- PV de Reception State ---
  const [pvs, setPvs] = useState([]);
  const [showPvModal, setShowPvModal] = useState(false);
  const [newPvData, setNewPvData] = useState({
    bon_livraison_id: '',
    marche_id: '',
    date_reception: new Date().toISOString().split('T')[0],
    commissions: []
  });
  const [editingPv, setEditingPv] = useState(null);

  // --- PV de Conformité State ---
  const [showConformiteModal, setShowConformiteModal] = useState(false);
  const [newConformiteData, setNewConformiteData] = useState({
    pv_reception_id: '',
    conformites: []
  });
  const [editingConformite, setEditingConformite] = useState(null);

  // --- View modal states ---
  const [selectedAttachmentForView, setSelectedAttachmentForView] = useState(null);
  const [selectedPvForView, setSelectedPvForView] = useState(null);
  const [selectedConformiteForView, setSelectedConformiteForView] = useState(null);
  const normalizeBlItems = (items) => {
    let itemsArray = [];
    if (items) {
      if (Array.isArray(items)) {
        itemsArray = items;
      } else if (typeof items === 'string') {
        try {
          let parsed = JSON.parse(items);
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (Array.isArray(parsed)) {
            itemsArray = parsed;
          }
        } catch (e) {
          console.error("Failed to parse BL items:", e);
        }
      }
    }
    return itemsArray.map(item => {
      const price = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
      return {
        ...item,
        unit_price_ht: price,
        price: price,
        pu: price,
        unit_price: price,
        qty: parseFloat(item.qty ?? (item.quantity ?? 0)),
        quantity: parseFloat(item.qty ?? (item.quantity ?? 0))
      };
    });
  };

  // Mappers back-and-forth for unified backend <-> frontend integration
  const mapBlFromApi = (bl) => ({
    id: bl.id,
    numeroBL: bl.numero_bl,
    dateLivraison: bl.date_bl,
    rubrique: bl.items?.[0]?.rubrique || 'ACHAT PRODUITS ALIMENTAIRES',
    exercice: new Date(bl.date_bl).getFullYear(),
    referenceBCs: bl.reference_bc ? bl.reference_bc.split(', ') : [],
    lieuLivraison: bl.client || 'Internat OFPPT Casablanca',
    fournisseur_id: bl.fournisseur_id?.toString() || '',
    marche_id: bl.marche_id != null ? Number(bl.marche_id) : null,
    items: normalizeBlItems(bl.items),
    montantHT: bl.total_ht,
    montantTVA: bl.total_tva,
    montantTTC: bl.total_ttc ?? 0,
    statut: bl.statut
  });


  // Dynamic state for Bon de commande items (used when viewing a BC)
  const [bcItems, setBcItems] = useState([
    { id: 1, label: 'Huile de table 5L', unit: 'Carton', qty: 40, price: 180 },
    { id: 2, label: 'Sucre en poudre 50kg', unit: 'Sac', qty: 20, price: 350 },
    { id: 3, label: 'Riz long grain 25kg', unit: 'Sac', qty: 30, price: 280 },
    { id: 4, label: 'Semoule fine 25kg', unit: 'Sac', qty: 25, price: 210 }
  ]);

  
  const fetchAttachments = async () => {
    try {
      const response = await api.get('/attachments-bc');
      setAttachments(response.data);
    } catch (error) {
      console.error('Erreur chargement attachments', error);
    }
  };

  const fetchPvs = async () => {
    try {
      const response = await api.get('/pv-receptions');
      setPvs(response.data);
    } catch (error) {
      console.error('Erreur chargement PVs', error);
    }
  };

  const handleUpdatePvCommission = (index, field, value) => {
    const updated = [...newPvData.commissions];
    updated[index][field] = value;
    setNewPvData({ ...newPvData, commissions: updated });
  };

  const handleCommissionNameChange = (index, value) => {
    const updated = [...newPvData.commissions];
    updated[index].nom_prenom = value;
    
    // Auto-fill logic based on existing PVs
    const existingMember = pvs.flatMap(p => p.commissions || []).find(c => c.nom_prenom === value);
    if (existingMember) {
        updated[index].fonction = existingMember.fonction;
        updated[index].role = existingMember.role;
    }
    
    setNewPvData({ ...newPvData, commissions: updated });
  };

  const handleAddPvCommission = () => {
    setNewPvData({
      ...newPvData,
      commissions: [...newPvData.commissions, { nom_prenom: '', fonction: '', role: 'Membre' }]
    });
  };

  const handleRemovePvCommission = (index) => {
    const updated = newPvData.commissions.filter((_, i) => i !== index);
    setNewPvData({ ...newPvData, commissions: updated });
  };

  const handleSubmitPv = async (e) => {
    e.preventDefault();
    try {
      if (editingPv) {
        await api.put(`/pv-receptions/${editingPv.id}`, newPvData);
        alert('PV mis à jour avec succès');
      } else {
        await api.post('/pv-receptions', newPvData);
        alert('PV créé avec succès');
      }
      setShowPvModal(false);
      setEditingPv(null);
      fetchPvs();
    } catch (error) {
      console.error('Erreur', error);
      alert('Erreur lors de l\'enregistrement du PV');
    }
  };

  // Keep ref in sync with selectedMarche so async fetchMarches always reads latest value
  useEffect(() => {
    selectedMarcheRef.current = selectedMarche;
  }, [selectedMarche]);

  useEffect(() => {
    fetchMarches(); // Will set loading to false as soon as it finishes
    fetchAttachments();
    fetchFournisseurs();
    fetchBcs();
    fetchFactures();
    fetchBordereauItems();
    fetchBordereauHeaders();
    fetchBls();
    fetchPvs();
  }, []);

  const fetchBls = async () => {
    try {
      const response = await api.get('/bons-livraison');
      const mapped = response.data.map(mapBlFromApi);
      setBls(mapped);
    } catch (error) {
      console.error('Erreur lors du chargement des bons de livraison', error);
    }
  };

  const fetchBordereauHeaders = async () => {
    try {
      const response = await api.get('/bordereau');
      setBordereauHeaders(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des bordereaux importés', error);
    }
  };

  const fetchBordereauItems = async (type = null) => {
    try {
      let url = '/bordereau?items=true';
      if (type) {
        url += `&type=${encodeURIComponent(type)}`;
      }
      const response = await api.get(url);
      setBordereauItems(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement du bordereau', error);
    }
  };

  const fetchMarches = async () => {
    try {
      const response = await api.get('/marches');
      setMarches(response.data);
      setLoading(false);
      // Use ref so this always reads the CURRENT selectedMarche, even from a stale closure
      const currentSelected = selectedMarcheRef.current;
      if (currentSelected) {
        const refreshed = response.data.find(m => m.id === currentSelected.id);
        if (refreshed) setSelectedMarche(refreshed);
      }
    } catch (error) {
      console.error('Erreur de chargement', error.response || error);
      alert("Erreur de chargement des marchés: " + (error.response?.data?.message || error.message));
      setLoading(false);
    }
  };

  const fetchFournisseurs = async () => {
    try {
      const response = await api.get('/fournisseurs');
      setFournisseurs(response.data);
      if (response.data.length > 0) {
        setFormData(prev => ({
          ...prev,
          id_fournisseur: response.data[0].id.toString()
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs', error);
    }
  };

  const normalizeBc = (bc) => {
    let itemsArray = [];
    if (bc && bc.items) {
      if (Array.isArray(bc.items)) {
        itemsArray = bc.items;
      } else if (typeof bc.items === 'string') {
        try {
          let parsed = JSON.parse(bc.items);
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (Array.isArray(parsed)) {
            itemsArray = parsed;
          }
        } catch (e) {
          console.error("Failed to parse items for BC ID:", bc.id, e);
        }
      }
    }
    const normalizedItems = itemsArray.map(item => {
      const price = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
      return {
        ...item,
        unit_price_ht: price,
        price: price,
        pu: price,
        unit_price: price,
        qty: parseFloat(item.qty ?? (item.quantity ?? 0)),
        quantity: parseFloat(item.qty ?? (item.quantity ?? 0))
      };
    });
    return {
      ...bc,
      items: normalizedItems
    };
  };


  const fetchBcs = async () => {
    try {
      const response = await api.get('/bon-commandes');
      setBcs(response.data.map(normalizeBc));
    } catch (error) {
      console.error('Erreur lors du chargement des bons de commande', error);
    }
  };

  const fetchFactures = async () => {
    try {
      const response = await api.get('/factures');
      setFactures(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des factures', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    // (Existing handleSubmit logic)
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedBordereau = bordereauHeaders.find(b => (b.market_name || `Bordereau #${b.id}`) === formData.titulaire);
      const budgetMax = selectedBordereau 
        ? parseFloat(selectedBordereau.bordereaux_sum_maximum_total_price_ttc ?? selectedBordereau.total_ttc_max ?? 0) 
        : 0;

      const payload = {
        ...formData,
        budget: budgetMax,
        consomme: 0
      };

      await api.post('/marches', payload);
      setShowModal(false);
      setFormData({ titulaire: '', id_fournisseur: fournisseurs[0]?.id?.toString() || '' });
      fetchMarches(); // Refresh
    } catch (error) {
      console.error('Erreur lors de l\'ajout', error.response || error);
      alert("Erreur: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveMarche = async (id) => {
    if (window.confirm('Voulez-vous vraiment archiver ce marché ?')) {
      try {
        await api.post(`/marches/${id}/archive`);
        fetchMarches();
      } catch (error) {
        console.error('Erreur lors de l\'archivage', error);
        alert('Erreur lors de l\'archivage.');
      }
    }
  };

  const [productSearch, setProductSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedBordereauItem, setSelectedBordereauItem] = useState(null);
  const [tempQty, setTempQty] = useState(1);
  const [tempPrice, setTempPrice] = useState('');
  const [tempVat, setTempVat] = useState(20);

  // --- ISOLATION LOGIC ---
  const associatedBordereauHeader = selectedMarche ? bordereauHeaders.find(b => b.market_name === selectedMarche.titulaire) : null;
  const associatedBordereauHeaderId = associatedBordereauHeader ? associatedBordereauHeader.id : null;
  const providerBcs = bcs.filter(bc => selectedMarche && bc.marche_id == selectedMarche.id);
  const providerBls = bls.filter(bl => selectedMarche && bl.marche_id == selectedMarche.id);
  const providerFactures = factures.filter(f => selectedMarche && f.marche_id == selectedMarche.id);

  const recalculateBcTotals = (itemsList) => {
    let ht = 0;
    let tva = 0;
    itemsList.forEach(item => {
      const itemHt = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price_ht) || 0);
      const itemTva = itemHt * ((parseFloat(item.vat_rate) || 0) / 100);
      ht += itemHt;
      tva += itemTva;
    });
    const ttc = ht + tva;
    setNewBcData(prev => ({
      ...prev,
      items: itemsList,
      montantHT: ht.toFixed(2),
      montantTVA: tva.toFixed(2),
      montantTTC: ttc.toFixed(2)
    }));
  };

  const handleAddProductToBc = () => {
    if (!selectedBordereauItem) {
      alert("Veuillez sélectionner un produit du bordereau.");
      return;
    }
    const qty = parseFloat(tempQty) || 0;
    if (qty <= 0) {
      alert("La quantité doit être supérieure à 0.");
      return;
    }
    const price = parseFloat(tempPrice) || 0;

    // Check if product already added
    const existingItems = newBcData.items || [];
    const isAlreadyAdded = existingItems.some(
      item => item.price_number === selectedBordereauItem.price_number
    );
    if (isAlreadyAdded) {
      alert("Ce produit est déjà ajouté au bon de commande.");
      return;
    }

    const newItem = {
      price_number: selectedBordereauItem.price_number,
      service_description: selectedBordereauItem.service_description,
      unit_of_measure: selectedBordereauItem.unit_of_measure,
      qty: qty,
      quantity: qty,
      unit_price_ht: price,
      price: price,
      pu: price,
      unit_price: price,
      vat_rate: parseFloat(tempVat) || 20
    };

    const updatedItems = [...existingItems, newItem];
    recalculateBcTotals(updatedItems);

    // Reset inputs
    setProductSearch('');
    setSelectedBordereauItem(null);
    setTempQty(1);
    setTempPrice('');
    setTempVat(20);
  };

  const handleRemoveProductFromBc = (index) => {
    const updatedItems = [...(newBcData.items || [])];
    updatedItems.splice(index, 1);
    recalculateBcTotals(updatedItems);
  };

  const handleDirectProductAdd = (item) => {
    const existingItems = newBcData.items || [];
    const isAlreadyAdded = existingItems.some(
      existingItem => existingItem.price_number === item.price_number
    );
    if (isAlreadyAdded) {
      alert("Ce produit est déjà ajouté au bon de commande.");
      setProductSearch('');
      setShowSuggestions(false);
      return;
    }

    const price = parseFloat(item.unit_price_ht) || 0;
    const newItem = {
      price_number: item.price_number,
      service_description: item.service_description,
      unit_of_measure: item.unit_of_measure,
      qty: 1,
      quantity: 1,
      unit_price_ht: price,
      price: price,
      pu: price,
      unit_price: price,
      vat_rate: parseFloat(item.vat_rate) || 20
    };

    const updatedItems = [...existingItems, newItem];
    recalculateBcTotals(updatedItems);
    setProductSearch('');
    setShowSuggestions(false);
  };

  const handleUpdateItem = (index, field, value) => {
    const updatedItems = [...(newBcData.items || [])];
    const parsedVal = parseFloat(value) || 0;
    const updatedItem = { ...updatedItems[index], [field]: parsedVal };

    if (field === 'qty' || field === 'quantity') {
      updatedItem.qty = parsedVal;
      updatedItem.quantity = parsedVal;
    } else if (field === 'unit_price_ht' || field === 'price' || field === 'pu' || field === 'unit_price') {
      updatedItem.unit_price_ht = parsedVal;
      updatedItem.price = parsedVal;
      updatedItem.pu = parsedVal;
      updatedItem.unit_price = parsedVal;
    }

    updatedItems[index] = updatedItem;
    recalculateBcTotals(updatedItems);
  };

  const handleSaveBc = async (e) => {
    e.preventDefault();
    if (!newBcData.numeroBC || !newBcData.dateEmission) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    try {
      const payload = {
        ...newBcData,
        statut: 'Validé', // Auto-finalize BC
        fournisseur_id: newBcData.fournisseur_id || selectedMarche?.id_fournisseur || null,
        marche_id: selectedMarche ? selectedMarche.id : null,
        referenceMarcheCadre: newBcData.referenceMarcheCadre
      };

      if (editingBc) {
        // Edit mode in database
        const response = await api.put(`/bon-commandes/${editingBc.id}`, payload);
        setBcs(bcs.map(bc => bc.id === editingBc.id ? normalizeBc(response.data) : bc));
        setEditingBc(null);
      } else {
        // Add mode in database
        const response = await api.post('/bon-commandes', payload);
        setBcs([...bcs, normalizeBc(response.data)]);
      }

      setNewBcData({
        numeroBC: '',
        dateEmission: new Date().toISOString().split('T')[0],
        budget: 'Budget de Fonctionnement',
        exercice: new Date().getFullYear(),
        rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
        referenceMarcheCadre: '',
        lieuLivraison: 'Internat OFPPT Casablanca',
        conditionsGenerales: 'Nous vous prions de bien vouloir exécuter la présente commande aux conditions ci-après.',
        conditionsParticulieres: '',
        montantHT: '0.00',
        montantTVA: '0.00',
        montantTTC: '0.00',
        statut: 'En cours',
        type: '',
        fournisseur_id: '',
        items: []
      });
      setShowBcModal(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du bon de commande", error.response || error);
      alert("Erreur: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteBc = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce bon de commande ?")) {
      try {
        await api.delete(`/bon-commandes/${id}`);
        setBcs(bcs.filter(bc => bc.id !== id));
      } catch (error) {
        console.error("Erreur lors de la suppression du bon de commande", error.response || error);
        alert("Erreur: " + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleExportBcToExcel = async (bc) => {
    if (!bc || !bc.id) {
      alert("Impossible d'exporter un bon de commande sans identifiant.");
      return;
    }
    try {
      const response = await api.get(`/bon-commandes/${bc.id}/export`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      const cleanNum = bc.numeroBC ? bc.numeroBC.replace(/[\/\s]/g, '_') : bc.id;
      link.setAttribute('download', `Bon_de_Commande_${cleanNum}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors de l'exportation Excel :", error);
      if (error.response && error.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errData = JSON.parse(reader.result);
            alert("Erreur lors de l'exportation : " + (errData.message || "Erreur serveur."));
          } catch (e) {
            alert("Une erreur est survenue lors de l'exportation Excel depuis le serveur.");
          }
        };
        reader.readAsText(error.response.data);
      } else {
        alert("Une erreur est survenue lors de l'exportation Excel depuis le serveur. " + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleExportAllBcsToExcel = () => {
    const filename = `Bons_de_commande_${selectedMarche.titulaire}.xls`;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-family: Arial, sans-serif; font-size: 13px; }
          th { background-color: #0f766e; color: white; font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; color: #0f766e; text-align: center; padding-bottom: 20px; }
          .right { text-align: right; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="title">Bons de commande - Marché : ${selectedMarche.titulaire}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>N° Bon de commande</th>
              <th>Date d'émission</th>
              <th>Lieu de livraison</th>
              <th class="right">Montant HT (MAD)</th>
              <th class="right">Montant TVA (MAD)</th>
              <th class="right">Montant TTC (MAD)</th>
              <th class="center">Statut</th>
            </tr>
          </thead>
          <tbody>
    `;

    providerBcs.forEach((bc, idx) => {
      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="bold">${bc.numeroBC}</td>
          <td class="center">${bc.dateEmission}</td>
          <td>${bc.lieuLivraison || '—'}</td>
          <td class="right">${parseFloat(bc.montantHT || 0).toFixed(2)}</td>
          <td class="right">${parseFloat(bc.montantTVA || 0).toFixed(2)}</td>
          <td class="right bold">${parseFloat(bc.montantTTC || 0).toFixed(2)}</td>
          <td class="center">${bc.statut || 'En cours'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
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

  const handleExportBlToExcel = async (bl) => {
    if (!bl || !bl.id) {
      alert("Impossible d'exporter un bon de livraison sans identifiant.");
      return;
    }
    try {
      const response = await api.get(`/bons-livraison/${bl.id}/export`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      const cleanNum = bl.numeroBL ? bl.numeroBL.replace(/[\/\s]/g, '_') : bl.id;
      link.setAttribute('download', `Bon_de_Livraison_${cleanNum}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors de l'exportation Excel :", error);
      if (error.response && error.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errData = JSON.parse(reader.result);
            alert("Erreur lors de l'exportation : " + (errData.message || "Erreur serveur."));
          } catch (e) {
            alert("Une erreur est survenue lors de l'exportation Excel depuis le serveur.");
          }
        };
        reader.readAsText(error.response.data);
      } else {
        alert("Une erreur est survenue lors de l'exportation Excel depuis le serveur. " + (error.response?.data?.message || error.message));
      }
    }
  };

  useEffect(() => {
    if (!showBlModal) return;
    const selectedBCs = providerBcs.filter(bc => newBlData.referenceBCs.includes(bc.numeroBC));
    console.log("Moteur de consolidation déclenché. BCs sélectionnés :", selectedBCs);

    // Merge all items from selected BCs, summing quantities for matching price numbers
    const mergedMap = {};
    selectedBCs.forEach(bc => {
      let bcItems = [];
      if (bc && bc.items) {
        if (Array.isArray(bc.items)) {
          bcItems = bc.items;
        } else if (typeof bc.items === 'string') {
          try {
            let parsed = JSON.parse(bc.items);
            if (typeof parsed === 'string') {
              parsed = JSON.parse(parsed);
            }
            if (Array.isArray(parsed)) {
              bcItems = parsed;
            }
          } catch (e) {
            console.error("Erreur de décodage JSON pour les articles du BC:", bc.numeroBC, e);
          }
        }
      }

      console.log(`Le BC ${bc.numeroBC} contient ${bcItems.length} article(s):`, bcItems);

      bcItems.forEach(item => {
        const key = item.price_number || item.service_description || item.designation || '';
        if (!key) return;

        const qty = parseFloat(item.qty ?? (item.quantity ?? 0));
        const pu = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
        const vatRate = parseFloat(item.vat_rate !== undefined ? item.vat_rate : 20);

        if (mergedMap[key]) {
          mergedMap[key].qty += qty;
          mergedMap[key].quantity += qty;
          if (!mergedMap[key]._bcRefs.includes(bc.numeroBC)) {
            mergedMap[key]._bcRefs.push(bc.numeroBC);
          }
        } else {
          mergedMap[key] = {
            ...item,
            qty: qty,
            quantity: qty,
            unit_price_ht: pu,
            price: pu,
            pu: pu,
            unit_price: pu,
            vat_rate: vatRate,
            _bcRefs: [bc.numeroBC],
          };
        }
      });
    });

    const merged = Object.values(mergedMap).map(item => {
      const price = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
      const q = parseFloat(item.qty ?? (item.quantity ?? 0));
      return {
        ...item,
        unit_price_ht: price,
        price: price,
        pu: price,
        unit_price: price,
        qty: q,
        quantity: q,
        _bcRef: item._bcRefs.join(', ')
      };
    });
    console.log("Articles consolidés après fusion :", merged);

    const breakdown = calculateVatBreakdown(merged);

    setNewBlData(prev => ({
      ...prev,
      items: merged,
      montantHT: breakdown.totalHt.toFixed(2),
      montantTVA: breakdown.totalTva.toFixed(2),
      montantTTC: breakdown.totalTtc.toFixed(2)
    }));
  }, [newBlData.referenceBCs, showBlModal, bcs]);


  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (blDropdownOpen && !e.target.closest('.bl-dropdown-container')) {
        setBlDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [blDropdownOpen]);

  const handleSaveBl = async (e) => {
    e.preventDefault();
    if (!newBlData.numeroBL || !newBlData.dateLivraison) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    try {
      const payload = {
        numero_bl: newBlData.numeroBL,
        date_bl: newBlData.dateLivraison,
        fournisseur: fournisseurs.find(f => f.id.toString() === selectedMarche?.id_fournisseur?.toString())?.raisonSociale || '',
        fournisseur_id: selectedMarche?.id_fournisseur || null,
        marche_id: selectedMarche ? selectedMarche.id : null,
        reference_bc: Array.isArray(newBlData.referenceBCs) ? newBlData.referenceBCs.join(', ') : '',
        client: newBlData.lieuLivraison,
        total_ht: parseFloat(newBlData.montantHT),
        total_tva: parseFloat(newBlData.montantTVA),
        total_ttc: parseFloat(newBlData.montantTTC),
        type: newBlData.type,
        items: newBlData.items,
        statut: 'Validé' // Auto-finalize BL
      };

      if (editingBl) {
        const response = await api.put(`/bons-livraison/${editingBl.id}`, payload);
        const mapped = mapBlFromApi(response.data);
        setBls(bls.map(bl => bl.id === editingBl.id ? mapped : bl));
        setEditingBl(null);
      } else {
        const response = await api.post('/bons-livraison', payload);
        const mapped = mapBlFromApi(response.data);
        setBls([...bls, mapped]);
      }
      setNewBlData({
        numeroBL: '',
        dateLivraison: new Date().toISOString().split('T')[0],
        exercice: new Date().getFullYear(),
        rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
        referenceBCs: [],
        lieuLivraison: 'Internat OFPPT Casablanca',
        conditionsGenerales: 'Livraison sous 5 jours. Paiement à 60 jours.',
        conditionsParticulieres: '',
        montantHT: '0.00',
        montantTVA: '0.00',
        montantTTC: '0.00',
        statut: 'En cours',
        type: '',
        fournisseur_id: '',
        items: []
      });
      setShowBlModal(false);
      // Refresh marches so consomme_amount and progress_percent update automatically
      fetchMarches();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde du bon de livraison", error.response || error);
      alert("Erreur: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteBl = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce bon de livraison ?")) {
      try {
        await api.delete(`/bons-livraison/${id}`);
        setBls(bls.filter(bl => bl.id !== id));
        // Refresh marches so consomme_amount and progress_percent update automatically
        fetchMarches();
      } catch (error) {
        console.error("Erreur lors de la suppression du bon de livraison", error);
        alert("Erreur: " + (error.response?.data?.message || error.message));
      }
    }
  };

  const recalculateFactureTotals = (itemsList) => {
    let ht = 0;
    let tva9 = 0, tva10 = 0, tva20 = 0;
    itemsList.forEach(item => {
      const itemHt = (parseFloat(item.qte) || 0) * (parseFloat(item.pu_ht) || 0);
      const rate = parseFloat(item.taux_tva) || 0;
      const itemTva = itemHt * (rate / 100);
      ht += itemHt;
      if (rate === 9) tva9 += itemTva;
      else if (rate === 10) tva10 += itemTva;
      else if (rate === 20) tva20 += itemTva;
    });
    const totalTva = tva9 + tva10 + tva20;
    const ttc = ht + totalTva;
    setNewFactureData(prev => ({
      ...prev,
      items: itemsList,
      montantHT: ht.toFixed(2),
      montantTVA: totalTva.toFixed(2),
      tva_9: tva9.toFixed(2),
      tva_10: tva10.toFixed(2),
      tva_20: tva20.toFixed(2),
      montantTTC: ttc.toFixed(2),
      montant_lettres: numberToFrenchWords(ttc)
    }));
  };

  const handleAddProductToFacture = () => {
    if (!selectedBordereauItem) {
      alert("Veuillez sélectionner un produit.");
      return;
    }
    const qty = parseFloat(tempQty) || 0;
    if (qty <= 0) {
      alert("La quantité doit être supérieure à 0.");
      return;
    }
    const price = parseFloat(tempPrice) || 0;

    const newItem = {
      num_article: selectedBordereauItem.price_number,
      designation: selectedBordereauItem.service_description,
      unite: selectedBordereauItem.unit_of_measure,
      qte: qty,
      pu_ht: price,
      taux_tva: parseFloat(tempVat) || 20
    };

    const updatedItems = [...(newFactureData.items || []), newItem];
    recalculateFactureTotals(updatedItems);
    setProductSearch('');
    setSelectedBordereauItem(null);
    setTempQty(1);
    setTempPrice('');
  };

  const handleUpdateItemFacture = (index, field, value) => {
    const updated = [...(newFactureData.items || [])];
    updated[index] = { ...updated[index], [field]: value };
    recalculateFactureTotals(updated);
  };

  const handleRemoveProductFromFacture = (index) => {
    const updated = [...(newFactureData.items || [])];
    updated.splice(index, 1);
    recalculateFactureTotals(updated);
  };

  const handleSaveFacture = async (e) => {
    e.preventDefault();
    if (!newFactureData.numero_facture || !newFactureData.date_facture) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    
    // Check if duplicate numero_facture exists
    if (!editingFacture) {
        const isDuplicate = factures.some(f => f.numero_facture === newFactureData.numero_facture);
        if (isDuplicate) {
             alert("Ce numéro de facture existe déjà.");
             return;
        }
    }

    try {
      const payload = {
        numero_facture: newFactureData.numero_facture,
        date_facture: newFactureData.date_facture,
        client: newFactureData.client,
        ice_client: newFactureData.ice_client,
        reference_bc: newFactureData.reference_bc,
        site_livraison: newFactureData.site_livraison,
        montant_lettres: newFactureData.montant_lettres,
        marche_id: selectedMarche ? selectedMarche.id : null,
        conditions_generales: newFactureData.conditions_generales,
        conditions_particulieres: newFactureData.conditions_particulieres,
        total_ht: newFactureData.montantHT,
        tva: newFactureData.montantTVA,
        tva_9: newFactureData.tva_9,
        tva_10: newFactureData.tva_10,
        tva_20: newFactureData.tva_20,
        total_ttc: newFactureData.montantTTC,
        statut: newFactureData.statut,
        articles: newFactureData.items
      };

      if (editingFacture) {
        await api.put(`/factures/${editingFacture.id}`, payload);
      } else {
        await api.post('/factures', payload);
      }
      fetchFactures();
      setShowFactureModal(false);
    } catch (error) {
      console.error('Erreur save facture', error.response?.data || error);
      alert("Erreur lors de l'enregistrement de la facture: " + (error.response?.data?.message || ""));
    }
  };

  const handleDeleteFacture = async (id) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) {
      try {
        await api.delete(`/factures/${id}`);
        fetchFactures();
      } catch (error) {
        console.error('Erreur delete facture', error);
      }
    }
  };

  const handleExportFactureToExcel = async (facture) => {
    if (!facture || !facture.id) {
      alert("Impossible d'exporter une facture sans identifiant.");
      return;
    }
    try {
      const response = await api.get(`/factures/${facture.id}/export`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanNum = facture.numero_facture ? facture.numero_facture.replace(/[\/\s]/g, '_') : facture.id;
      link.setAttribute('download', `Facture_${cleanNum}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors de l'exportation Excel :", error);
      alert("Erreur lors de l'exportation de la facture.");
    }
  };

  const handleGenerateConformite = async (pvReceptionId) => {
    try {
      // Find the selected PV de Réception
      const selectedPv = pvs.find(p => p.id == pvReceptionId);
      if (!selectedPv) {
        alert('PV de réception introuvable.');
        return;
      }

      // Find the associated BL from already-loaded data (search all bls as fallback)
      const bl = providerBls.find(b => b.id == selectedPv.bon_livraison_id)
               || bls.find(b => b.id == selectedPv.bon_livraison_id);
      if (!bl) {
        alert('Bon de livraison associé introuvable (ID: ' + selectedPv.bon_livraison_id + ')');
        return;
      }
      console.log('BL found:', bl.numeroBL, '| items count:', (bl.items || []).length, '| first item:', bl.items?.[0]);

      // Parse BL items
      let blItems = [];
      if (bl.items) {
        if (Array.isArray(bl.items)) {
          blItems = bl.items;
        } else if (typeof bl.items === 'string') {
          try {
            let parsed = JSON.parse(bl.items);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (Array.isArray(parsed)) blItems = parsed;
          } catch (e) {
            console.error('Erreur parsing items BL:', e);
          }
        }
      }

      if (blItems.length === 0) {
        alert('Aucun produit trouvé dans le bon de livraison.');
        return;
      }

      // Build conformite lines from BL items
      const conformites = blItems.map((item, index) => ({
        numero_ligne: index + 1,
        price_number: item.price_number || null,
        designation: item.service_description || item.designation || item.label || item.name || 'Produit',
        unite: item.unit_of_measure || item.unite || item.unit || 'U',
        quantite: parseFloat(item.qty || item.quantity || item.qte || 0),
        conformite: 'Conforme',
        observation: ''
      }));

      console.log('Conformite lines generated from BL:', conformites);

      setNewConformiteData({
        pv_reception_id: pvReceptionId,
        conformites: conformites
      });

    } catch (error) {
      console.error('Erreur generate conformite', error);
      alert('Erreur: ' + (error.message || 'Erreur inconnue'));
    }
  };

  const handleUpdateConformiteLine = (index, field, value) => {
    const updated = [...newConformiteData.conformites];
    updated[index] = { ...updated[index], [field]: value };
    setNewConformiteData({ ...newConformiteData, conformites: updated });
  };

  const handleSaveConformite = async (e) => {
    e.preventDefault();
    if (!newConformiteData.pv_reception_id) {
        alert("Veuillez sélectionner un bon de livraison (PV de réception).");
        return;
    }
    try {
      await api.put(`/pv-receptions/${newConformiteData.pv_reception_id}/conformites`, {
          conformites: newConformiteData.conformites
      });
      fetchPvs();
      setShowConformiteModal(false);
      alert('PV de conformité enregistré avec succès.');
    } catch (error) {
      console.error('Erreur save conformite', error);
      alert("Erreur lors de l'enregistrement du PV de conformité.");
    }
  };

  const handleExportConformite = async (pv) => {
    try {
        const res = await api.get(`/pv-receptions/${pv.id}/conformites/export`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        const bcRef = providerBls.find(b => b.id === pv.bon_livraison_id)?.reference_bc || 'Inconnu';
        link.setAttribute('download', `PV_Conformite_BC_${bcRef.replace(/[\/\s]/g, '_')}.doc`);
        document.body.appendChild(link);
        link.click();
    } catch (e) {
        console.error("Export error", e);
        alert("Erreur lors de l'exportation du PV de conformité.");
    }
  };

  const renderDocumentContent = () => {
    const sName = fournisseurs.find(f => f.id === selectedMarche.id_fournisseur)?.raisonSociale || 'DISMA Maroc';
    const sICE = fournisseurs.find(f => f.id === selectedMarche.id_fournisseur)?.ice || '001234567000021';

    if (activeDocTab === 'bc') {
      return (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> Bons de commande
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setEditingBc(null);
                  let nextNum = 1;
                  if (bcs.length > 0) {
                    let maxNum = 0;
                    bcs.forEach(bc => {
                      if (bc && bc.numeroBC) {
                        const match = bc.numeroBC.match(/PA\s+(\d+)\//i);
                        if (match && match[1]) {
                          const num = parseInt(match[1]);
                          if (num > maxNum) maxNum = num;
                        } else {
                          const fallbackMatch = bc.numeroBC.match(/-00(\d+)$/);
                          if (fallbackMatch && fallbackMatch[1]) {
                            const num = parseInt(fallbackMatch[1]);
                            if (num > maxNum) maxNum = num;
                          }
                        }
                      }
                    });
                    if (maxNum > 0) {
                      nextNum = maxNum + 1;
                    } else {
                      nextNum = bcs.length + 1;
                    }
                  }

                  setNewBcData({
                    numeroBC: `B.C PA ${nextNum}/${new Date().getFullYear()}`,
                    dateEmission: new Date().toISOString().split('T')[0],
                    budget: 'BF',
                    exercice: new Date().getFullYear(),
                    rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
                    referenceMarcheCadre: selectedMarche ? `N° 07 E/${new Date().getFullYear()}` : '',
                    lieuLivraison: 'Ouarzazate',
                    conditionsGenerales: 'Nous vous prions de bien vouloir exécuter la présente commande aux conditions ci-après.',
                    conditionsParticulieres: '',
                    montantHT: '0.00',
                    montantTVA: '0.00',
                    montantTTC: '0.00',
                    statut: 'En cours',
                    fournisseur_id: selectedMarche ? selectedMarche.id_fournisseur.toString() : '',
                    items: []
                  });
                  setShowBcModal(true);
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={15} /> Nouveau BC
              </button>
            </div>
          </div>

          {/* Simple Beautiful Table */}
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>#</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>RUBRIQUE / NOM</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '140px' }}>N° DE BC</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '120px' }}>DATE D'ÉMISSION</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'right' }}>MONTANT TTC</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '110px', textAlign: 'center' }}>STATUT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '340px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {providerBcs.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun bon de commande trouvé. Cliquez sur "Nouveau BC" pour en ajouter un.
                      </td>
                    </tr>
                  ) : (
                    providerBcs.map((bc, idx) => (
                      <tr key={bc.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          <div>{bc.rubrique || 'N/A'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>{bc.budget || 'Budget de Fonctionnement'}</div>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            {bc.numeroBC}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {new Date(bc.dateEmission).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
                          {bc.montantTTC ? parseFloat(bc.montantTTC).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '0.00'} MAD
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: bc.statut === 'Validé' || bc.statut === 'Livré' ? '#ecfdf5' : '#fef3c7',
                            color: bc.statut === 'Validé' || bc.statut === 'Livré' ? '#0f766e' : '#d97706',
                            padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700'
                          }}>
                            {bc.statut || 'En cours'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedBcForView(bc)}
                            title="Voir"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingBc(bc);
                              setNewBcData({
                                numeroBC: bc.numeroBC,
                                dateEmission: bc.dateEmission,
                                budget: bc.budget || 'Budget de Fonctionnement',
                                exercice: bc.exercice || new Date().getFullYear(),
                                rubrique: bc.rubrique || 'ACHAT PRODUITS ALIMENTAIRES',
                                referenceMarcheCadre: bc.referenceMarcheCadre || '',
                                lieuLivraison: bc.lieuLivraison || 'Internat OFPPT Casablanca',
                                conditionsGenerales: bc.conditionsGenerales || 'Nous vous prions de bien vouloir exécuter la présente commande aux conditions ci-après.',
                                conditionsParticulieres: bc.conditionsParticulieres || '',
                                montantHT: bc.montantHT || '0.00',
                                montantTVA: bc.montantTVA || '0.00',
                                montantTTC: bc.montantTTC || '0.00',
                                statut: bc.statut || 'En cours',
                                type: bc.type || '',
                                fournisseur_id: bc.fournisseur_id ? bc.fournisseur_id.toString() : '',
                                items: Array.isArray(bc.items) ? bc.items : []
                              });
                              setShowBcModal(true);
                            }}
                            title="Modifier"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)',
                              backgroundColor: '#eff6ff', color: '#3b82f6', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBc(bc.id)}
                            title="Supprimer"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)',
                              backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => handleExportBcToExcel(bc)}
                            title="Exporter Excel"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)',
                              backgroundColor: '#f0fdf4', color: '#10b981', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeDocTab === 'bl') {
      const filteredBls = providerBls;
      return (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> Bons de livraison
            </h3>
            <button
              onClick={() => {
                setEditingBl(null);
                setNewBlData({
                  numeroBL: `BL-${new Date().getFullYear()}-00${bls.length + 1}`,
                  dateLivraison: new Date().toISOString().split('T')[0],
                  exercice: new Date().getFullYear(),
                  rubrique: 'Alimentation générale',
                  referenceBCs: [],
                  lieuLivraison: 'Internat OFPPT Casablanca',
                  conditionsGenerales: 'Livraison sous 5 jours. Paiement à 60 jours.',
                  conditionsParticulieres: '',
                  montantHT: '0.00',
                  montantTVA: '0.00',
                  montantTTC: '0.00',
                  statut: 'Validé',
                  fournisseur_id: selectedMarche ? selectedMarche.id_fournisseur.toString() : '',
                  items: []
                });
                setShowBlModal(true);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} /> Nouveau BL
            </button>
          </div>

          {/* Simple Beautiful Table */}
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>#</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>RUBRIQUE / NOM</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '140px' }}>N° DE BL</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '120px' }}>DATE DE LIVRAISON</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'right' }}>MONTANT TTC</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '110px', textAlign: 'center' }}>STATUT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBls.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun bon de livraison trouvé. Cliquez sur "Nouveau BL" pour en ajouter un.
                      </td>
                    </tr>
                  ) : (
                    filteredBls.map((bl, idx) => (
                      <tr key={bl.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          <div>{bl.rubrique || 'N/A'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>BCs: {bl.referenceBCs?.join(', ') || '—'}</div>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            {bl.numeroBL}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {new Date(bl.dateLivraison).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
                          {parseFloat(bl.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: bl.statut === 'Validé' ? '#ecfdf5' : '#fef3c7',
                            color: bl.statut === 'Validé' ? '#0f766e' : '#d97706',
                            padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700'
                          }}>
                            {bl.statut || 'En cours'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedBlForView(bl)}
                            title="Voir"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingBl(bl);
                              setNewBlData({
                                numeroBL: bl.numeroBL,
                                dateLivraison: bl.dateLivraison,
                                exercice: bl.exercice || new Date().getFullYear(),
                                rubrique: bl.rubrique || 'ACHAT PRODUITS ALIMENTAIRES',
                                referenceBCs: bl.referenceBCs || [],
                                lieuLivraison: bl.lieuLivraison || 'Internat OFPPT Casablanca',
                                conditionsGenerales: bl.conditionsGenerales || 'Livraison sous 5 jours. Paiement à 60 jours.',
                                conditionsParticulieres: bl.conditionsParticulieres || '',
                                montantHT: bl.montantHT || '0.00',
                                montantTVA: bl.montantTVA || '0.00',
                                montantTTC: bl.montantTTC || '0.00',
                                statut: bl.statut || 'En cours',
                                type: bl.type || '',
                                fournisseur_id: bl.fournisseur_id || '',
                                items: bl.items || []
                              });
                              setShowBlModal(true);
                            }}
                            title="Modifier"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px',
                              border: '1px solid rgba(59,130,246,0.2)',
                              backgroundColor: '#eff6ff', color: '#3b82f6', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dbeafe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteBl(bl.id)}
                            title="Supprimer"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px',
                              border: '1px solid rgba(239,68,68,0.2)',
                              backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            onClick={() => handleExportBlToExcel(bl)}
                            title="Télécharger Excel"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '28px', height: '28px', borderRadius: '6px',
                              border: '1px solid rgba(16,185,129,0.2)',
                              backgroundColor: '#f0fdf4', color: '#10b981', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    
    if (activeDocTab === 'attachments') {
      const filteredAttachments = attachments.filter(a => selectedMarche && a.marche_id === selectedMarche.id);
      
      const attachmentGroups = filteredAttachments;

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> Attachements
            </h3>
            <button
              onClick={() => {
                setEditingAttachmentGroup(null);
                
                const stockMap = {};
                const newItems = [];

                setNewAttachmentData({
                  numero_attachment: attachments.length > 0 ? Math.max(...attachments.map(a => a.numero_attachment || 0)) + 1 : 1,
                  bon_livraison_id: '',
                  marche_id: selectedMarche ? selectedMarche.id : null,
                  date_attachment: new Date().toISOString().split('T')[0],
                  budget: 'BF',
                  exercice: new Date().getFullYear(),
                  rubrique: 'ACHAT PRODUITS ALIMENTAIRES',
                  reference_marche: selectedMarche ? selectedMarche.titulaire : '',
                  lieu_livraison: 'Ouarzazate',
                  items: newItems
                });
                setShowAttachmentModal(true);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} /> Nouvel Attachement
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>#</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>N° BL ASSOCIÉ</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '140px' }}>N° ATTACHEMENT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '120px' }}>BUDGET</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {attachmentGroups.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun attachement trouvé.
                      </td>
                    </tr>
                  ) : (
                    attachmentGroups.map((group, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                           {selectedMarche.titulaire}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            {group.numero_attachment}/{group.exercice}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {group.budget}
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedAttachmentForView(group)}
                            title="Voir"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingAttachmentGroup(group);
                              
                              const stockMap = {};
                              providerBls.forEach(bl => {
                                (bl.items || []).forEach(item => {
                                  const designation = item.designation || item.service_description || item.description || item.name || '';
                                  if (!designation) return;
                                  if (!stockMap[designation]) {
                                    stockMap[designation] = {
                                      designation: designation,
                                      unite: item.unite || item.unit_of_measure || item.unit || 'U',
                                      quantite_initiale: 0
                                    };
                                  }
                                  stockMap[designation].quantite_initiale += parseFloat(item.qty || item.quantity || item.quantite || 0);
                                });
                              });

                              let itemsArr = group.items;
                              if (typeof itemsArr === 'string') {
                                try { itemsArr = JSON.parse(itemsArr); } catch(e) { itemsArr = []; }
                              } else if (!itemsArr) {
                                itemsArr = [];
                              }

                              const mergedItems = itemsArr.map(item => ({
                                ...item,
                                quantite_initiale: stockMap[item.designation] ? stockMap[item.designation].quantite_initiale : 0
                              }));

                              setNewAttachmentData({
                                numero_attachment: group.numero_attachment,
                                bon_livraison_id: '',
                                marche_id: group.marche_id || selectedMarche.id,
                                budget: group.budget,
                                exercice: group.exercice,
                                rubrique: group.rubrique,
                                reference_marche: group.reference_marche || '',
                                lieu_livraison: group.lieu_livraison,
                                items: mergedItems
                              });
                              setShowAttachmentModal(true);
                            }}
                            title="Modifier"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.18)', backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                                if (window.confirm("Supprimer cet attachement ?")) {
                                    await api.delete(`/attachments-bc/${group.id}`);
                                    fetchAttachments();
                                }
                            }}
                            title="Supprimer"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.18)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                                try {
                                    const res = await api.get(`/attachments-bc/${group.id}/export`, { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `Attachement_${group.numero_attachment}_${group.exercice}.xlsx`);
                                    document.body.appendChild(link);
                                    link.click();
                                    link.parentNode.removeChild(link);
                                } catch(e) {
                                    alert("Erreur lors de l'export.");
                                }
                            }}
                            title="Télécharger Excel"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.18)', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Download size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }


    if (activeDocTab === 'facture') {
      const filteredFactures = providerFactures;
      return (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> Factures
            </h3>
            <button
              onClick={() => {
                setEditingFacture(null);
                setNewFactureData({
                  numero_facture: `FA-${new Date().getFullYear()}-00${factures.length + 1}`,
                  date_facture: new Date().toISOString().split('T')[0],
                  client: 'OFPPT / ISTA Ouarzazate',
                  site_livraison: 'ISTA Ouarzazate',
                  ice_client: '',
                  reference_bc: '',
                  conditions_generales: 'Paiement à réception de la facture.',
                  conditions_particulieres: '',
                  montantHT: '0.00',
                  montantTVA: '0.00',
                  tva_9: '0.00',
                  tva_10: '0.00',
                  tva_20: '0.00',
                  montantTTC: '0.00',
                  montant_lettres: '',
                  statut: 'En cours',
                  items: []
                });
                setShowFactureModal(true);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} /> Nouvelle Facture
            </button>
          </div>

          {/* Simple Beautiful Table */}
          <div style={{
            border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>#</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>CLIENT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '140px' }}>N° DE FACTURE</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '120px' }}>DATE</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'right' }}>MONTANT TTC</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '110px', textAlign: 'center' }}>STATUT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '130px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {factures.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucune facture trouvée. Cliquez sur "Nouvelle Facture" pour en ajouter une.
                      </td>
                    </tr>
                  ) : (
                    factures.map((facture, idx) => (
                      <tr key={facture.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                          <div>{facture.client || 'N/A'}</div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>ICE Client: {facture.ice_client || '—'}</div>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>
                            {facture.numero_facture}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {new Date(facture.date_facture).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
                          {parseFloat(facture.total_ttc || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </td>
                        <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                          <span style={{
                            backgroundColor: facture.statut === 'Payée' ? '#ecfdf5' : '#fef3c7',
                            color: facture.statut === 'Payée' ? '#0f766e' : '#d97706',
                            padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '700'
                          }}>
                            {facture.statut || 'En cours'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedFactureForView(facture)}
                            title="Voir"
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: '1px solid rgba(15, 118, 110, 0.18)',
                              backgroundColor: 'rgba(15, 118, 110, 0.05)',
                              color: '#0f766e',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#0f766e';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(15, 118, 110, 0.05)';
                              e.currentTarget.style.color = '#0f766e';
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFacture(facture);
                              setNewFactureData({
                                numero_facture: facture.numero_facture,
                                date_facture: facture.date_facture ? facture.date_facture.split('T')[0] : '',
                                client: facture.client || 'OFPPT / ISTA Ouarzazate',
                                site_livraison: facture.site_livraison || '',
                                ice_client: facture.ice_client || '',
                                reference_bc: facture.reference_bc || '',
                                conditions_generales: facture.conditions_generales,
                                conditions_particulieres: facture.conditions_particulieres,
                                montantHT: facture.total_ht,
                                montantTVA: facture.tva,
                                tva_9: facture.tva_9 || '0.00',
                                tva_10: facture.tva_10 || '0.00',
                                tva_20: facture.tva_20 || '0.00',
                                montantTTC: facture.total_ttc,
                                montant_lettres: facture.montant_lettres || '',
                                statut: facture.statut,
                                items: facture.articles || []
                              });
                              setShowFactureModal(true);
                            }}
                            title="Modifier"
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: '1px solid rgba(59, 130, 246, 0.18)',
                              backgroundColor: 'rgba(59, 130, 246, 0.05)',
                              color: '#3b82f6',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#3b82f6';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                              e.currentTarget.style.color = '#3b82f6';
                            }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleExportFactureToExcel(facture)}
                            title="Télécharger Excel"
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: '1px solid rgba(16, 185, 129, 0.18)',
                              backgroundColor: 'rgba(16, 185, 129, 0.05)',
                              color: '#10b981',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#10b981';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                              e.currentTarget.style.color = '#10b981';
                            }}
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteFacture(facture.id)}
                            title="Supprimer"
                            style={{
                              width: '32px', height: '32px',
                              borderRadius: '8px',
                              border: '1px solid rgba(239, 68, 68, 0.18)',
                              backgroundColor: 'rgba(239, 68, 68, 0.05)',
                              color: '#ef4444',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                              e.currentTarget.style.color = '#ffffff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeDocTab === 'pv') {
      const filteredPvs = pvs.filter(p => providerBls.some(b => b.id == p.bon_livraison_id));
      
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> PV de Réception
            </h3>
            <button
              onClick={() => {
                setEditingPv(null);
                setNewPvData({
                  bon_livraison_id: '',
                  marche_id: selectedMarche.id,
                  date_reception: new Date().toISOString().split('T')[0],
                  commissions: []
                });
                setShowPvModal(true);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} /> Nouveau PV
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>N° BL ASSOCIÉ</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DATE RECEPTION</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>MEMBRES</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPvs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun PV de réception trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredPvs.map((pv, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                           {providerBls.find(b => b.id == pv.bon_livraison_id)?.numeroBL || 'Inconnu'}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {new Date(pv.date_reception).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {pv.commissions ? pv.commissions.length : 0} membres
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedPvForView(pv)}
                            title="Voir"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPv(pv);
                              setNewPvData({
                                bon_livraison_id: pv.bon_livraison_id,
                                marche_id: pv.marche_id,
                                date_reception: pv.date_reception,
                                commissions: pv.commissions || []
                              });
                              setShowPvModal(true);
                            }}
                            title="Modifier"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.18)', backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                                if (window.confirm("Supprimer ce PV ?")) {
                                    await api.delete(`/pv-receptions/${pv.id}`);
                                    fetchPvs();
                                }
                            }}
                            title="Supprimer"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.18)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                                try {
                                    const res = await api.get(`/pv-receptions/${pv.id}/export`, { responseType: 'blob' });
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.setAttribute('download', `PV_Reception_${pv.id}.doc`);
                                    document.body.appendChild(link);
                                    link.click();
                                } catch (e) {
                                    console.error("Export error", e);
                                }
                            }}
                            title="Télécharger Word"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.18)', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeDocTab === 'stock') {
      const filteredAttachments = attachments.filter(a => selectedMarche && a.marche_id === selectedMarche.id);
      
      const stockMap = {};
      
      providerBls.forEach(bl => {
        (bl.items || []).forEach(item => {
          const designation = item.designation || item.service_description || item.description || item.name || '';
          if (!designation) return;
          
          if (!stockMap[designation]) {
            stockMap[designation] = {
              designation: designation,
              unite: item.unite || item.unit_of_measure || item.unit || 'U',
              quantite_initiale: 0
            };
          }
          stockMap[designation].quantite_initiale += parseFloat(item.qty || item.quantity || item.quantite || 0);
        });
      });

      const stockItems = Object.values(stockMap).sort((a, b) => a.designation.localeCompare(b.designation));

      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} color="#0f766e" /> Mouvement de Stock (Marché)
            </h3>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DÉSIGNATION PRODUIT</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>UNITÉ</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>QUANTITÉ INITIALE (BL)</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun mouvement de stock pour ce marché.
                      </td>
                    </tr>
                  ) : (
                    stockItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{item.designation}</td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>{item.unite}</td>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0ea5e9', textAlign: 'center' }}>{item.quantite_initiale}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeDocTab === 'conformite') {
      const filteredPvs = pvs.filter(p => selectedMarche && p.marche_id == selectedMarche.id && p.pv_conformites && p.pv_conformites.length > 0);
      const eligiblePvsForCreation = pvs.filter(p => selectedMarche && p.marche_id == selectedMarche.id);
      
      return (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#0f766e" /> PV de Conformité
            </h3>
            <button
              onClick={() => {
                setEditingConformite(null);
                setNewConformiteData({
                  pv_reception_id: '',
                  conformites: []
                });
                setShowConformiteModal(true);
              }}
              className="btn-primary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} /> Ajouter PV de Conformité
            </button>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>N° BL ASSOCIÉ</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DATE RECEPTION</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>ARTICLES</th>
                    <th style={{ padding: '12px 8px', fontSize: '11px', fontWeight: '700', color: '#64748b', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPvs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                        Aucun PV de conformité trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredPvs.map((pv, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                           {providerBls.find(b => b.id == pv.bon_livraison_id)?.numeroBL || 'Inconnu'}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {new Date(pv.date_reception).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '12px', color: '#475569' }}>
                          {pv.pv_conformites ? pv.pv_conformites.length : 0} articles
                        </td>
                        <td style={{ padding: '14px 8px', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            onClick={() => setSelectedConformiteForView(pv)}
                            title="Voir"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingConformite(pv);
                              setNewConformiteData({
                                pv_reception_id: pv.id,
                                conformites: pv.pv_conformites || []
                              });
                              setShowConformiteModal(true);
                            }}
                            title="Modifier"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.18)', backgroundColor: 'rgba(59, 130, 246, 0.05)', color: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={async () => {
                                if (window.confirm("Voulez-vous vraiment supprimer ce PV de Conformité ?")) {
                                    try {
                                        await api.delete(`/pv-receptions/${pv.id}/conformites`);
                                        fetchPvs();
                                    } catch (error) {
                                        console.error("Erreur de suppression", error);
                                        alert("Erreur lors de la suppression.");
                                    }
                                }
                            }}
                            title="Supprimer"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.18)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            onClick={() => handleExportConformite(pv)}
                            title="Télécharger Word"
                            style={{
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.18)', backgroundColor: 'rgba(16, 185, 129, 0.05)', color: '#10b981', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s'
                            }}
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <FileText size={48} color="#94a3b8" style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ margin: '0 0 8px 0', color: '#0f172a', fontWeight: '700' }}>
          Document : {activeDocTab.toUpperCase()}
        </h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          Le document lié au marché de {selectedMarche.titulaire} est en cours de traitement ou n'est pas encore disponible.
        </p>
      </div>
    );
  };

  const renderMarcheDetail = () => {
    const sName = fournisseurs.find(f => f.id === selectedMarche.id_fournisseur)?.raisonSociale || 'DISMA Maroc';
    const consumedAmount = selectedMarche.consomme_amount || 0;
    const progressPercent = selectedMarche.progress_percent || 0;
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Navigation sub-header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <button
            onClick={() => setSelectedMarche(null)}
            className="btn-back"
          >
            <ChevronLeft size={16} /> Retour aux marchés
          </button>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
            M-2024-089 - {selectedMarche.titulaire}
          </span>
        </div>

        {/* Header summary panel */}
        <div style={{
          backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
          padding: '24px', marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
                  {selectedMarche.titulaire}
                </h2>
                <span style={{
                  backgroundColor: '#ecfdf5', color: '#10b981', padding: '4px 10px',
                  borderRadius: '12px', fontSize: '12px', fontWeight: '700'
                }}>
                  {selectedMarche.statut || 'Actif'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Marché N° M-2024-089 · {sName} · Ouvert le {new Date(selectedMarche.date_debut).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  const consumed = consumedAmount;
                  const remaining = Math.max(0, parseFloat(selectedMarche.budget || 0) - consumed);
                  const progress = progressPercent;
                  const iframe = document.createElement('iframe');
                  iframe.style.position = 'absolute';
                  iframe.style.width = '0';
                  iframe.style.height = '0';
                  iframe.style.border = 'none';
                  document.body.appendChild(iframe);
                  
                  const doc = iframe.contentWindow.document;
                  doc.open();
                  doc.write(`
                    <!DOCTYPE html><html><head><meta charset="utf-8">
                    <title>Marché — ${selectedMarche.titulaire}</title>
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 48px; background: white; }
                      .header { border-bottom: 3px solid #0f766e; padding-bottom: 20px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
                      .header h1 { font-size: 22px; font-weight: 800; color: #0f766e; }
                      .header .meta { font-size: 12px; color: #64748b; text-align: right; }
                      .section { margin-bottom: 32px; }
                      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                      .field label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px; }
                      .field span { font-size: 15px; font-weight: 700; color: #0f172a; }
                      .fin-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
                      .fin-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
                      .fin-card label { font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px; }
                      .fin-card span { font-size: 18px; font-weight: 800; }
                      .fin-card.budget span { color: #0f172a; }
                      .fin-card.consumed span { color: #0f766e; }
                      .fin-card.remaining span { color: #f59e0b; }
                      .fin-card.progress span { color: #3b82f6; }
                      .bar-wrap { margin-top: 24px; }
                      .bar-wrap label { font-size: 11px; color: #64748b; font-weight: 600; display: block; margin-bottom: 6px; }
                      .bar-bg { width: 100%; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
                      .bar-fill { height: 100%; background: linear-gradient(90deg, #0f766e, #10b981); border-radius: 5px; }
                      .footer { margin-top: 48px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
                      @media print { body { padding: 32px; } }
                    </style></head><body>
                    <div class="header">
                      <div>
                        <h1>${selectedMarche.titulaire}</h1>
                        <div style="font-size:13px;color:#64748b;margin-top:4px;">Fournisseur : <strong>${sName}</strong></div>
                      </div>
                      <div class="meta">
                        <div>Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
                        <div style="margin-top:4px;font-weight:700;color:#0f766e;">Statut : ${selectedMarche.statut || 'Actif'}</div>
                      </div>
                    </div>
                    <div class="section">
                      <div class="section-title">Informations du marché</div>
                      <div class="grid">
                        <div class="field"><label>Nom du marché</label><span>${selectedMarche.titulaire}</span></div>
                        <div class="field"><label>Fournisseur / Titulaire</label><span>${sName}</span></div>
                        <div class="field"><label>Date de début</label><span>${new Date(selectedMarche.date_debut).toLocaleDateString('fr-FR')}</span></div>
                        <div class="field"><label>Date d'expiration</label><span>${new Date(selectedMarche.date_fin).toLocaleDateString('fr-FR')}</span></div>
                      </div>
                    </div>
                    <div class="section">
                      <div class="section-title">Informations financières</div>
                      <div class="fin-grid">
                        <div class="fin-card budget"><label>Budget Total</label><span>${parseFloat(selectedMarche.budget || 0).toLocaleString('fr-FR', {minimumFractionDigits:2})} MAD</span></div>
                        <div class="fin-card consumed"><label>Montant Consommé</label><span>${consumed.toLocaleString('fr-FR', {minimumFractionDigits:2})} MAD</span></div>
                        <div class="fin-card remaining"><label>Montant Restant</label><span>${remaining.toLocaleString('fr-FR', {minimumFractionDigits:2})} MAD</span></div>
                        <div class="fin-card progress"><label>Avancement</label><span>${progress}%</span></div>
                      </div>
                      <div class="bar-wrap">
                        <label>Progression de la consommation</label>
                        <div class="bar-bg"><div class="bar-fill" style="width:${progress}%"></div></div>
                      </div>
                    </div>
                    <div class="footer">
                      <span>Document généré automatiquement</span>
                      <span>Système de gestion des marchés publics</span>
                    </div>
                    </body></html>
                  `);
                  doc.close();
                  
                  iframe.contentWindow.focus();
                  setTimeout(() => {
                    iframe.contentWindow.print();
                    setTimeout(() => document.body.removeChild(iframe), 1000);
                  }, 200);
                }}
              >
                <Printer size={15} /> Imprimer
              </button>
            </div>
          </div>

          {/* Header details stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px',
            borderTop: '1px solid #f1f5f9', paddingTop: '20px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Fournisseur</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{sName}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Budget Total</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{parseFloat(selectedMarche.budget || 0).toLocaleString()} MAD</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Consommé</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#10b981' }}>
                {consumedAmount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} DH ({progressPercent}%)
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Restant</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#f59e0b' }}>
                {(parseFloat(selectedMarche.budget || 0) - consumedAmount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Avancement</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#0f766e', borderRadius: '3px' }}></div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                  {progressPercent}%
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Main panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px', alignItems: 'stretch' }}>

          {/* Left panel */}
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Documents
            </h3>
            {[
              { id: 'bc', label: 'Bon de commande' },
              { id: 'bl', label: 'Bon de livraison' },
              { id: 'pv', label: 'PV de réception' },
              { id: 'attachments', label: 'Attachements' },
              { id: 'conformite', label: 'PV de conformité' },
              { id: 'facture', label: 'Facture' },
              { id: 'stock', label: 'Mouvement stock' }
            ].map(tab => {
              const isActive = activeDocTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDocTab(tab.id)}
                  className={`doc-tab-button ${isActive ? 'doc-tab-button-active' : 'doc-tab-button-inactive'}`}
                >
                  <FileText size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right panel */}
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            {renderDocumentContent()}
          </div>

        </div>

      </div>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Actif': return { text: '#10b981', bg: 'rgba(16,185,129,0.1)' };
      case 'En cours': return { text: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      case 'Retard': return { text: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
      case 'Préparation': return { text: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
      default: return { text: '#64748b', bg: 'rgba(100,116,139,0.1)' };
    }
  };

  const filteredSuggestions = productSearch.trim() === '' ? [] : bordereauItems.filter(item => {
    // Isolate products by selected Marche's Bordereau Header ID
    if (!associatedBordereauHeaderId) return false;
    if (item.bordereau_header_id !== associatedBordereauHeaderId) return false;

    const q = productSearch.toLowerCase();
    
    // Filtre par texte
    const matchesText = (item.price_number && item.price_number.toString().toLowerCase().includes(q)) ||
      (item.service_description && item.service_description.toLowerCase().includes(q));
    
    if (!matchesText) return false;
    
    // Filtre par type - récupérer le type courant en fonction de la modale ouverte
    let currentType = null;
    if (showBcModal) {
      currentType = newBcData.type;
    } else if (showBlModal) {
      currentType = newBlData.type;
    }
    
    // Si un type est spécifié, filtrer les produits par type
    if (currentType && item.type && item.type.toLowerCase() !== currentType.toLowerCase()) {
      return false;
    }
    
    return true;
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
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
          background: linear-gradient(90deg, #3b82f6, #60a5fa) !important;
        }
        .stat-card-green::after {
          background: linear-gradient(90deg, #10b981, #0f766e) !important;
        }
        .stat-card-orange::after {
          background: linear-gradient(90deg, #f59e0b, #eab308) !important;
        }
        .stat-card-dark::after {
          background: linear-gradient(90deg, #0f172a, #334155) !important;
        }

        /* Interactive Document Tab Button Styles */
        .doc-tab-button {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .doc-tab-button-inactive {
          background-color: #f8fafc;
          color: #475569;
          border: 1px solid #e2e8f0;
          font-weight: 500;
        }
        .doc-tab-button-inactive:hover {
          background-color: #f1f5f9;
          color: #0f766e;
          border-color: #cbd5e1;
          transform: translateX(4px);
        }
        .doc-tab-button-inactive:active {
          background-color: #e2e8f0;
          transform: scale(0.98);
        }
        .doc-tab-button-active {
          background-color: #0f766e;
          color: #ffffff;
          border: 1px solid #0f766e;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.25);
        }
        .doc-tab-button-active:active {
          transform: scale(0.98);
        }

        /* Generic Action Buttons */
        .btn-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background-color: #0f766e;
          border: 1px solid #0f766e;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-primary:hover {
          background-color: #0d5c56;
          border-color: #0d5c56;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.3);
          transform: translateY(-1px);
        }
        .btn-primary:active {
          background-color: #0b4a45;
          border-color: #0b4a45;
          transform: translateY(1px);
        }

        .btn-secondary {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background-color: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          color: #475569;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-secondary:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
          color: #0f766e;
          transform: translateY(-1px);
        }
        .btn-secondary:active {
          background-color: #f1f5f9;
          transform: translateY(1px);
        }

        .btn-back {
          background: none;
          border: none;
          display: flex;
          align-items: center;
          gap: 4px;
          color: #475569;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .btn-back:hover {
          color: #0f766e;
          transform: translateX(-3px);
        }
      `}</style>

      {selectedMarche ? (
        renderMarcheDetail()
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>Marchés publics</h1>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Gérez vos marchés, commandes et documents associés</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
              >
                <Plus size={16} /> Ajouter marché
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
            {[
              { label: 'Total marchés', value: marches.length, color: '#0f172a', cls: 'stat-card-dark' },
              { label: 'Marchés actifs', value: marches.filter(m => !m.is_archived).length, color: '#10b981', cls: 'stat-card-green' },
              { label: 'Marchés archivés', value: marches.filter(m => m.is_archived).length, color: '#64748b', cls: 'stat-card-dark' },
              { label: 'Budget total (MAD)', value: (marches.reduce((sum, m) => sum + parseFloat(m.budget || 0), 0) / 1000).toFixed(0) + 'K', color: '#3b82f6', cls: 'stat-card-blue' }
            ].map((stat, i) => (
              <div key={i}
                className={`stat-card ${stat.cls}`}
                style={{
                  flex: 1, backgroundColor: 'white', padding: '20px', borderRadius: '12px',
                  border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs: Actifs / Archivés */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => setActiveMarchesTab('actifs')}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: '700',
                cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s',
                backgroundColor: activeMarchesTab === 'actifs' ? '#0f766e' : '#e2e8f0',
                color: activeMarchesTab === 'actifs' ? 'white' : '#475569'
              }}
            >
               Marchés Actifs ({marches.filter(m => !m.is_archived).length})
            </button>
            <button
              onClick={() => setActiveMarchesTab('archives')}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none', fontWeight: '700',
                cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s',
                backgroundColor: activeMarchesTab === 'archives' ? '#64748b' : '#e2e8f0',
                color: activeMarchesTab === 'archives' ? 'white' : '#475569'
              }}
            >
               Marchés Archivés ({marches.filter(m => m.is_archived).length})
            </button>
          </div>

          {filterFournisseurId && (
            <div style={{ padding: '12px 16px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Affichage des marchés pour le fournisseur sélectionné</span>
              <button onClick={onClearFournisseurFilter} style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}><X size={16} /> Effacer le filtre</button>
            </div>
          )}

          {/* Grid of Marches */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>

            {loading ? (
              <p>Chargement des marchés...</p>
            ) : (
              (activeMarchesTab === 'actifs' ? marches.filter(m => !m.is_archived) : marches.filter(m => m.is_archived))
                .filter(m => filterFournisseurId ? m.id_fournisseur == filterFournisseurId : true)
                .map((marche) => {
                const statusStyle = getStatusColor(marche.statut);
                return (
                  <div key={marche.id} style={{
                    backgroundColor: 'white', borderRadius: '16px', padding: '20px',
                    border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>M-{new Date(marche.date_debut).getFullYear()}-00{marche.id}</span>
                      <span style={{ backgroundColor: statusStyle.bg, color: statusStyle.text, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                        {marche.statut}
                      </span>
                    </div>

                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{marche.titulaire}</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><Folder size={14} /> Fournisseur</span>
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {fournisseurs.find(f => f.id === marche.id_fournisseur)?.raisonSociale || 'DISMA Maroc'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><DollarSign size={14} /> Budget alloué</span>
                        <span style={{ fontWeight: '600', color: '#334155' }}>{parseFloat(marche.budget).toLocaleString()} MAD</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> Échéance</span>
                        <span style={{ fontWeight: '600', color: '#334155' }}>{new Date(marche.date_fin).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>

                    {(() => {
                      const consumed = marche.consomme_amount || 0;
                      const progress = marche.progress_percent || 0;
                      return (
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>
                            <span style={{ color: '#64748b' }}>Consommé</span>
                            <span style={{ color: '#0f766e' }}>{consumed.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} DH ({progress}%)</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#0f766e', borderRadius: '3px' }}></div>
                          </div>
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '12px' }}>
                      {!marche.is_archived && (
                        <button
                          onClick={() => handleArchiveMarche(marche.id)}
                          className="btn-secondary"
                          style={{ flex: 1, padding: '8px', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', borderColor: '#cbd5e1' }}
                        >
                          <Archive size={14} /> Archiver
                        </button>
                      )}
                      {marche.is_archived && (
                        <div style={{ flex: 1, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: '#f1f5f9', borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                          Archivé le {marche.archived_at ? new Date(marche.archived_at).toLocaleDateString('fr-FR') : '—'}
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedMarche(marche)}
                        className="btn-primary"
                        style={{ flex: 1, padding: '8px', justifyContent: 'center' }}
                      >
                        <FolderOpen size={14} /> Ouvrir
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add New Card Button - only on active tab */}
            {activeMarchesTab === 'actifs' && (
              <div
                onClick={() => setShowModal(true)}
                style={{
                  borderRadius: '16px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', minHeight: '260px', cursor: 'pointer',
                  backgroundColor: 'rgba(248,250,252,0.5)', transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '48px', height: '48px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                  <Plus size={24} color="#64748b" />
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>Nouveau marché</div>
              </div>
            )}

          </div>

        </>
      )}

      {/* Modal Add Marche */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Ajouter un nouveau marché</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#64748b',
                  fontSize: '18px', fontWeight: 'bold', lineHeight: 1, flexShrink: 0,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                title="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Bordereau importé (Titulaire) *</label>
                <select
                  name="titulaire"
                  value={formData.titulaire}
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}
                >
                  <option value="" disabled>-- Sélectionner un bordereau importé --</option>
                  {bordereauHeaders.map(b => (
                    <option key={b.id} value={b.market_name || `Bordereau #${b.id}`}>
                      {b.market_name || `Bordereau #${b.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const selectedBordereau = bordereauHeaders.find(b => (b.market_name || `Bordereau #${b.id}`) === formData.titulaire);
                if (!selectedBordereau) return null;
                return (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', marginTop: '-4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600' }}>Date d'import :</span>
                      <span>{new Date(selectedBordereau.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600' }}>Total TTC Minimum :</span>
                      <span style={{ color: '#0f766e', fontWeight: '700' }}>{parseFloat(selectedBordereau.bordereaux_sum_minimum_total_price_ttc ?? selectedBordereau.total_ttc_min ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '600' }}>Total TTC Maximum :</span>
                      <span style={{ color: '#10b981', fontWeight: '700' }}>{parseFloat(selectedBordereau.bordereaux_sum_maximum_total_price_ttc ?? selectedBordereau.total_ttc_max ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Fournisseur *</label>
                <select
                  name="id_fournisseur"
                  value={formData.id_fournisseur}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    backgroundColor: 'white',
                    fontSize: '14px',
                    color: '#334155'
                  }}
                >
                  <option value="" disabled>-- Sélectionner un fournisseur --</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.raisonSociale}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates are now auto-generated by the backend */}
              <div style={{ padding: '10px 14px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#15803d', fontWeight: '500' }}>
                 La date de début sera automatiquement définie à aujourd'hui et la date de fin dans 3 ans.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button" onClick={() => setShowModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 20px' }}
                >
                  Annuler
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="btn-primary"
                  style={{ padding: '10px 20px' }}
                >
                  {submitting ? 'Enregistrement...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBcModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '95%', maxWidth: '1000px',
            padding: '24px 32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                {editingBc ? 'Modifier le Bon de commande' : 'Ajouter un Bon de commande'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowBcModal(false);
                  setEditingBc(null);
                }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBc} style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', overflowX: 'hidden', flex: 1, paddingRight: '12px' }}>
              {/* General Information Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Numéro du BC *</label>
                  <input
                    type="text"
                    value={newBcData.numeroBC}
                    onChange={(e) => setNewBcData({ ...newBcData, numeroBC: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                    placeholder="Ex: BC-2024-089-001"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Date d'émission *</label>
                  <input
                    type="date"
                    value={newBcData.dateEmission}
                    onChange={(e) => setNewBcData({ ...newBcData, dateEmission: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Rubrique / Nom *</label>
                  <input
                    type="text"
                    value={newBcData.rubrique}
                    onChange={(e) => setNewBcData({ ...newBcData, rubrique: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                    placeholder="Alimentation générale"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Exercice *</label>
                  <input
                    type="number"
                    value={newBcData.exercice}
                    onChange={(e) => setNewBcData({ ...newBcData, exercice: e.target.value })}
                    required
                    style={{ width: '90%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Budget *</label>
                  <select
                    value={newBcData.budget}
                    onChange={(e) => setNewBcData({ ...newBcData, budget: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'white' }}
                  >
                    <option value="Budget de Fonctionnement">Fonctionnement</option>
                    <option value="Budget d'Investissement">Investissement</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Réf. Marché Cadre</label>
                  <input
                    type="text"
                    value={newBcData.referenceMarcheCadre}
                    onChange={(e) => setNewBcData({ ...newBcData, referenceMarcheCadre: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                    placeholder="MC-2023-01"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Lieu de Livraison</label>
                  <input
                    type="text"
                    value={newBcData.lieuLivraison}
                    onChange={(e) => setNewBcData({ ...newBcData, lieuLivraison: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Fournisseur *</label>
                  <select
                    value={newBcData.fournisseur_id}
                    onChange={(e) => setNewBcData({ ...newBcData, fournisseur_id: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'white' }}
                  >
                    <option value="">-- Choisir un fournisseur --</option>
                    {fournisseurs.map(f => (
                      <option key={f.id} value={f.id}>{f.raisonSociale}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Type de produit (gaz, pain, etc.)</label>
                  <input
                    type="text"
                    value={newBcData.type}
                    onChange={(e) => setNewBcData({ ...newBcData, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                    placeholder="Ex: gaz, pain, farine, etc."
                  />
                </div>
              </div>

              {/* Added Products Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Articles du Bon de commande ({newBcData.items?.length || 0})
                </label>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', paddingBottom: '120px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b' }}>N&deg;</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b' }}>D&eacute;signation</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '80px' }}>Qt&eacute;</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '100px' }}>P.U HT</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '80px' }}>TVA (%)</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'right', width: '100px' }}>Total HT</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!newBcData.items || newBcData.items.length === 0) ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            Aucun produit ajouter; pour le moment.
                          </td>
                        </tr>
                      ) : (
                        newBcData.items.map((item, index) => {
                          const totalLineHt = (parseFloat(item.qty) || 0) * (parseFloat(item.unit_price_ht) || 0);
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f766e' }}>{item.price_number}</td>
                              <td style={{ padding: '10px 12px', color: '#334155' }}>
                                <div style={{ fontWeight: '600' }}>{item.service_description}</div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Unit&eacute;: {item.unit_of_measure}</div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="number" min="1"
                                  value={item.qty}
                                  onChange={(e) => handleUpdateItem(index, 'qty', e.target.value)}
                                  style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
                                />
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="number" step="0.01"
                                  value={item.unit_price_ht}
                                  onChange={(e) => handleUpdateItem(index, 'unit_price_ht', e.target.value)}
                                  style={{ width: '80px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }}
                                />
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <select
                                  value={item.vat_rate}
                                  onChange={(e) => handleUpdateItem(index, 'vat_rate', e.target.value)}
                                  style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}
                                >
                                  <option value={0}>0%</option>
                                  <option value={9}>9%</option>
                                  <option value={10}>10%</option>
                                  <option value={20}>20%</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>{totalLineHt.toFixed(2)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductFromBc(index)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <td colSpan="7" style={{ padding: '12px' }}>
                          <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                              type="text"
                              value={productSearch}
                              onChange={(e) => {
                                setProductSearch(e.target.value);
                                setShowSuggestions(true);
                              }}
                              onFocus={() => setShowSuggestions(true)}
                              placeholder="Ajouter un article : Saisissez le N° ou la désignation du produit..."
                              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }}
                            />
                            {showSuggestions && filteredSuggestions.length > 0 && (
                              <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '220px', overflowY: 'auto',
                                marginTop: '4px'
                              }}>
                                {filteredSuggestions.map((item) => (
                                  <div
                                    key={item.id}
                                    onClick={() => handleDirectProductAdd(item)}
                                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '13px', display: 'flex', justifyContent: 'space-between', transition: 'background-color 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                  >
                                    <span style={{ fontWeight: '700', color: '#0f766e', minWidth: '80px' }}>N&deg; {item.price_number}</span>
                                    <span style={{ flex: 1, marginLeft: '12px', color: '#334155' }}>{item.service_description}</span>
                                    <span style={{ color: '#64748b', fontSize: '12px', minWidth: '150px', textAlign: 'right' }}>
                                      {item.unit_of_measure} | {parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0)))).toFixed(2)} MAD
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '32px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Montant HT</label>
                  <input
                    type="text" readOnly disabled
                    value={`${newBcData.montantHT} MAD`}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#64748b', backgroundColor: '#e2e8f0' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Montant TVA</label>
                  <input
                    type="text" readOnly disabled
                    value={`${newBcData.montantTVA} MAD`}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#64748b', backgroundColor: '#e2e8f0' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Montant TTC</label>
                  <input
                    type="text" readOnly disabled
                    value={`${newBcData.montantTTC} MAD`}
                    style={{ width: '90%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', color: '#0f766e', backgroundColor: '#ecfdf5', fontWeight: '800' }}
                  />
                </div>
              </div>

              {/* Conditions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Conditions Générales</label>
                  <textarea
                    value={newBcData.conditionsGenerales}
                    onChange={(e) => setNewBcData({ ...newBcData, conditionsGenerales: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', minHeight: '80px', height: '80px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Conditions Particulières</label>
                  <textarea
                    value={newBcData.conditionsParticulieres}
                    onChange={(e) => setNewBcData({ ...newBcData, conditionsParticulieres: e.target.value })}
                    style={{ width: '90%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', minHeight: '80px', height: '80px', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowBcModal(false);
                    setEditingBc(null);
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px', borderRadius: '8px', border: 'none',
                    backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  {editingBc ? 'Enregistrer les modifications' : 'Ajouter le Bon de commande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add/Edit BL */}
      {showBlModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '95%', maxWidth: '1000px',
            padding: '24px 32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                {editingBl ? 'Modifier le Bon de livraison (BL)' : 'Créer un Bon de livraison (BL)'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowBlModal(false);
                  setEditingBl(null);
                }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBl} style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1, paddingRight: '12px' }}>
              
              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Numéro du BL *</label>
                  <input
                    type="text"
                    value={newBlData.numeroBL}
                    onChange={(e) => setNewBlData({ ...newBlData, numeroBL: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                    placeholder="Ex: BL-2024-001"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Date de Livraison *</label>
                  <input
                    type="date"
                    value={newBlData.dateLivraison}
                    onChange={(e) => setNewBlData({ ...newBlData, dateLivraison: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Fournisseur</label>
                  <input
                    type="text"
                    value={fournisseurs.find(f => f.id.toString() === selectedMarche?.id_fournisseur?.toString())?.raisonSociale || 'Chargement...'}
                    disabled
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontSize: '13px', color: '#64748b', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Client / Établissement</label>
                  <input
                    type="text"
                    value={newBlData.lieuLivraison || ''}
                    onChange={(e) => setNewBlData({ ...newBlData, lieuLivraison: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Type de produit (gaz, pain, etc.)</label>
                  <input
                    type="text"
                    value={newBlData.type}
                    onChange={(e) => setNewBlData({ ...newBlData, type: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                    placeholder="Ex: gaz, pain, farine, etc."
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Statut *</label>
                  <select
                    value={newBlData.statut || 'En cours'}
                    onChange={(e) => setNewBlData({ ...newBlData, statut: e.target.value })}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="En cours">En cours</option>
                    <option value="Validé">Validé</option>
                    <option value="Livré">Livré</option>
                  </select>
                </div>
              </div>

              {/* BC Selection - Multi-select drop-down with live search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }} className="bl-dropdown-container">
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569' }}>Réf. Bon de Commande (BC) *</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setBlDropdownOpen(!blDropdownOpen)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '6px',
                      border: '1px solid #cbd5e1', background: 'white', color: newBlData.referenceBCs.length ? '#334155' : '#94a3b8',
                      fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', outline: 'none', textAlign: 'left'
                    }}
                  >
                    <span>
                      {newBlData.referenceBCs.length === 0
                        ? 'Sélectionner un ou plusieurs Bons de Commande...'
                        : `${newBlData.referenceBCs.length} BC sélectionné(s) : ${newBlData.referenceBCs.join(', ')}`}
                    </span>
                    <ChevronDown size={16} />
                  </button>

                  {blDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: '4px',
                      maxHeight: '260px', overflowY: 'auto'
                    }}>
                      <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
                        <input
                          type="text"
                          placeholder="Rechercher par numéro de BC..."
                          onChange={(e) => {
                            const filterVal = e.target.value.toLowerCase();
                            const items = document.querySelectorAll('.bc-item-option');
                            items.forEach(el => {
                              const text = el.getAttribute('data-bc-num').toLowerCase();
                              if (text.includes(filterVal)) {
                                el.style.display = 'flex';
                              } else {
                                el.style.display = 'none';
                              }
                            });
                          }}
                          style={{ width: '100%', padding: '6px 12px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '12px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {(() => {
                          const usedBCs = bls
                            .filter(bl => editingBl ? bl.id !== editingBl.id : true)
                            .flatMap(bl => (bl.referenceBCs || (bl.reference_bc ? bl.reference_bc.split(',').map(s => s.trim()) : [])));
                          const eligibleBcs = providerBcs.filter(bc => !usedBCs.includes(bc.numeroBC) || newBlData.referenceBCs.includes(bc.numeroBC));
                          
                          if (eligibleBcs.length === 0) {
                            return (
                              <div style={{ padding: '12px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                                Aucun Bon de Commande disponible pour ce marché (tous sont déjà liés à un BL).
                              </div>
                            );
                          }

                          return eligibleBcs.map(bc => {
                            const isSelected = newBlData.referenceBCs.includes(bc.numeroBC);
                            return (
                              <div
                                key={bc.id}
                                className="bc-item-option"
                                data-bc-num={bc.numeroBC}
                                onClick={() => {
                                  const alreadySelected = newBlData.referenceBCs.includes(bc.numeroBC);
                                  const updatedBCs = alreadySelected
                                    ? newBlData.referenceBCs.filter(x => x !== bc.numeroBC)
                                    : [...newBlData.referenceBCs, bc.numeroBC];
                                  setNewBlData({ ...newBlData, referenceBCs: updatedBCs });
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px', cursor: 'pointer', fontSize: '13px',
                                  backgroundColor: isSelected ? '#ecfdf5' : 'transparent',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <div>
                                  <span style={{ fontWeight: '600', color: isSelected ? '#0f766e' : '#334155' }}>{bc.numeroBC}</span>
                                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>
                                    {new Date(bc.dateEmission).toLocaleDateString('fr-FR')}
                                  </span>
                                  <span style={{
                                    fontSize: '10px',
                                    backgroundColor: (bc.items?.length || 0) > 0 ? '#e0f2fe' : '#fee2e2',
                                    color: (bc.items?.length || 0) > 0 ? '#0369a1' : '#b91c1c',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    marginLeft: '8px',
                                    fontWeight: '600'
                                  }}>
                                    {(bc.items?.length || 0)} article(s)
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                                    {parseFloat(bc.montantTTC || 0).toLocaleString('fr-FR')} MAD
                                  </span>
                                  <div style={{
                                    width: '16px', height: '16px', borderRadius: '4px',
                                    border: `1.5px solid ${isSelected ? '#10b981' : '#cbd5e1'}`,
                                    backgroundColor: isSelected ? '#10b981' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    {isSelected && <Check size={10} color="white" />}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Consolidated Products Table */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Articles consolidés des BC sélectionnés
                  <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>(Fusion automatique des doublons)</span>
                </h3>

                <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Réf. BC</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>N° Prix</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569' }}>Désignation</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'center' }}>Unité</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Quantité</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>PU (MAD)</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>TVA (%)</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newBlData.items.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                            Aucun produit chargé. Veuillez sélectionner un ou plusieurs bons de commande.
                          </td>
                        </tr>
                      ) : (
                        newBlData.items.map((item, idx) => {
                          const qty = parseFloat(item.qty || 0);
                          const pu = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
                          const vat = parseFloat(item.vat_rate !== undefined ? item.vat_rate : 20);
                          const lineHt = qty * pu;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                                  {item._bcRef || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f766e' }}>{item.price_number || '—'}</td>
                              <td style={{ padding: '8px 12px', color: '#334155', fontWeight: '500' }}>{item.service_description || item.designation || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{item.unit_of_measure || '—'}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{qty}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#2563eb' }}>{pu.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#64748b' }}>{vat}%</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#0f766e' }}>{lineHt.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Section */}
              {(() => {
                const breakdown = calculateVatBreakdown(newBlData.items);
                return (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                    <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                        <span>Total HT :</span>
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {breakdown.totalHt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                        <span>TVA 9% (Base HT: {breakdown.baseHt9.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                        <span style={{ fontWeight: '500', color: '#475569' }}>
                          {breakdown.tva9.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                        <span>TVA 10% (Base HT: {breakdown.baseHt10.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                        <span style={{ fontWeight: '500', color: '#475569' }}>
                          {breakdown.tva10.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                        <span>TVA 20% (Base HT: {breakdown.baseHt20.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                        <span style={{ fontWeight: '500', color: '#475569' }}>
                          {breakdown.tva20.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </span>
                      </div>

                      <div style={{
                        display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800',
                        color: '#0f766e', backgroundColor: '#ecfdf5', padding: '10px 14px', borderRadius: '8px',
                        border: '1px solid rgba(16,185,129,0.2)', marginTop: '4px'
                      }}>
                        <span>Total TTC :</span>
                        <span>
                          {breakdown.totalTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setNewBlData({
                      ...newBlData,
                      numeroBL: `BL-${new Date().getFullYear()}-00${bls.length + 1}`,
                      dateLivraison: new Date().toISOString().split('T')[0],
                      referenceBCs: [],
                      montantHT: '0.00',
                      montantTVA: '0.00',
                      montantTTC: '0.00',
                      items: []
                    });
                    setBlDropdownOpen(false);
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBlModal(false);
                    setEditingBl(null);
                  }}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px'
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={newBlData.referenceBCs.length === 0}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', border: 'none',
                    backgroundColor: newBlData.referenceBCs.length === 0 ? '#94a3b8' : '#0f766e',
                    color: 'white', fontWeight: '600', cursor: newBlData.referenceBCs.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px'
                  }}
                >
                  {editingBl ? 'Enregistrer les modifications' : 'Créer le Bon de livraison'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal View BL details */}
      {selectedBlForView && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', marginRight: '8px' }}>
                  {selectedBlForView.numeroBL}
                </span>
                <h2 style={{ margin: '6px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                  {selectedBlForView.rubrique || 'Bon de Livraison'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedBlForView(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Date de Livraison</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {new Date(selectedBlForView.dateLivraison).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Fournisseur</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {fournisseurs.find(f => f.id.toString() === selectedBlForView.fournisseur_id?.toString())?.raisonSociale || 'DISMA Maroc'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Exercice</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedBlForView.exercice || '2024'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Bons de Commande</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f766e' }}>{selectedBlForView.referenceBCs?.join(', ') || 'Non spécifié'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Lieu de Livraison</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedBlForView.lieuLivraison || 'Casablanca'}</div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Liste des articles livrés</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '60px' }}>N° PRIX</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DÉSIGNATION</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '80px' }}>UNITÉ</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '70px', textAlign: 'center' }}>QTÉ</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '100px', textAlign: 'right' }}>PU (MAD)</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#475569', width: '110px', textAlign: 'right' }}>TOTAL HT</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBlForView.items || []).map((item, idx) => {
                  const unitPrice = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
                  const qty = parseFloat(item.qty || 0);
                  const totalLineHt = qty * unitPrice;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontSize: '12px', fontWeight: '700', color: '#0f766e' }}>{item.price_number || (idx + 1)}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{item.service_description || item.designation}</td>
                      <td style={{ padding: '10px 8px', fontSize: '12px', color: '#475569' }}>{item.unit_of_measure || '—'}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#0f172a', textAlign: 'center', fontWeight: '600' }}>{qty}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>{unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: '#334155', textAlign: 'right' }}>{totalLineHt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Calculations */}
            {(() => {
              const viewBreakdown = calculateVatBreakdown(selectedBlForView.items);
              return (
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
                  <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                      <span>Montant HT :</span>
                      <span style={{ fontWeight: '600', color: '#334155' }}>
                        {viewBreakdown.totalHt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                      <span>TVA 9% (Base HT: {viewBreakdown.baseHt9.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                      <span style={{ fontWeight: '500', color: '#475569' }}>
                        {viewBreakdown.tva9.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                      <span>TVA 10% (Base HT: {viewBreakdown.baseHt10.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                      <span style={{ fontWeight: '500', color: '#475569' }}>
                        {viewBreakdown.tva10.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', paddingLeft: '8px', borderLeft: '2px solid #cbd5e1' }}>
                      <span>TVA 20% (Base HT: {viewBreakdown.baseHt20.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD) :</span>
                      <span style={{ fontWeight: '500', color: '#475569' }}>
                        {viewBreakdown.tva20.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </div>

                    <div style={{
                      display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800',
                      color: '#0f766e', borderTop: '1px double #cbd5e1', paddingTop: '8px', marginTop: '4px'
                    }}>
                      <span>Montant TTC :</span>
                      <span>
                        {viewBreakdown.totalTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => handleExportBlToExcel(selectedBlForView)}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  color: '#10b981',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#dcfce7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
              >
                <Download size={16} /> Exporter Excel
              </button>
              <button
                type="button"
                onClick={() => setSelectedBlForView(null)}
                className="btn-primary"
                style={{ padding: '10px 20px', backgroundColor: '#0f766e', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View BC details */}
      {selectedBcForView && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', marginRight: '8px' }}>
                  {selectedBcForView.numeroBC}
                </span>
                <h2 style={{ margin: '6px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                  {selectedBcForView.rubrique || 'Bon de Commande'}
                </h2>
              </div>
              <button
                onClick={() => setSelectedBcForView(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Date d'émission</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {new Date(selectedBcForView.dateEmission).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Fournisseur</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {selectedBcForView.fournisseur?.raisonSociale || fournisseurs.find(f => f.id === selectedBcForView.fournisseur_id)?.raisonSociale || 'Non spécifié'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Exercice</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedBcForView.exercice || '2024'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Réf. Marché Cadre</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedBcForView.referenceMarcheCadre || 'Non spécifié'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Lieu de Livraison</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedBcForView.lieuLivraison || 'Internat Casablanca'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Conditions Générales</div>
                <div style={{ fontSize: '13px', color: '#475569', backgroundColor: '#fafafa', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  {selectedBcForView.conditionsGenerales || 'Aucune condition spécifique.'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Conditions Particulières</div>
                <div style={{ fontSize: '13px', color: '#475569', backgroundColor: '#fafafa', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  {selectedBcForView.conditionsParticulieres || 'Aucune condition particulière.'}
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Liste des articles</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>#</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DÉSIGNATION</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '80px' }}>UNITÉ</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '70px', textAlign: 'center' }}>QTÉ</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '110px', textAlign: 'right' }}>PU (MAD)</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '120px', textAlign: 'right' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {(selectedBcForView.items || []).map((item, idx) => {
                  const unitPrice = parseFloat(item.unit_price_ht ?? (item.price ?? (item.pu ?? (item.unit_price ?? 0))));
                  const qty = parseFloat(item.qty || 0);
                  const totalLineHt = qty * unitPrice;
                  return (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontSize: '12px', color: '#64748b' }}>{item.price_number || (idx + 1)}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{item.service_description}</td>
                      <td style={{ padding: '10px 8px', fontSize: '12px', color: '#475569' }}>{item.unit_of_measure || '—'}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#0f172a', textAlign: 'center', fontWeight: '600' }}>{qty}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>{unitPrice.toFixed(2)}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>{totalLineHt.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Calculations */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
              <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Montant HT:</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {parseFloat(selectedBcForView.montantHT || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Montant TVA (20%):</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {parseFloat(selectedBcForView.montantTVA || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#0f766e', borderTop: '1px double #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Montant TTC:</span>
                  <span>
                    {parseFloat(selectedBcForView.montantTTC || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setSelectedBcForView(null)}
                className="btn-primary"
                style={{ padding: '10px 20px', backgroundColor: '#0f766e', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FACTURE MODALS ADDED HERE */}
      
      {/* Modal Add/Edit Attachment */}
      {showAttachmentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '900px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
                {editingAttachmentGroup ? 'Modifier l\'Attachement' : 'Créer un Attachement'}
              </h2>
              <button onClick={() => setShowAttachmentModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#64748b" /></button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Marché Sélectionné</label>
                  <input
                    type="text"
                    disabled
                    value={selectedMarche ? selectedMarche.titulaire : ''}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f1f5f9' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Bon de Livraison *</label>
                  <select
                    value={newAttachmentData.bon_livraison_id || ''}
                    onChange={(e) => {
                      const blId = e.target.value;
                      const selectedBl = providerBls.find(b => b.id.toString() === blId);
                      let newItems = [];
                      if (selectedBl && selectedBl.items) {
                        newItems = selectedBl.items.map((item, idx) => {
                          const qty = parseFloat(item.qty || item.quantity || item.quantite || 0);
                          return {
                            numero_article: idx + 1,
                            designation: item.designation || item.service_description || item.description || item.name || '',
                            unite: item.unite || item.unit_of_measure || item.unit || 'U',
                            quantite_initiale: qty,
                            quantite: qty,
                            taux_tva: item.vat_rate || item.taux_tva || 20
                          };
                        });
                      }
                      setNewAttachmentData({ ...newAttachmentData, bon_livraison_id: blId, items: newItems });
                    }}
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}
                  >
                    <option value="">-- Sélectionner un BL --</option>
                    {providerBls.map(bl => (
                      <option key={bl.id} value={bl.id}>{bl.numeroBL}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>N° Attachement *</label>
                  <input
                    type="number"
                    value={newAttachmentData.numero_attachment}
                    onChange={(e) => setNewAttachmentData({ ...newAttachmentData, numero_attachment: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Budget</label>
                  <input
                    type="text"
                    value={newAttachmentData.budget}
                    onChange={(e) => setNewAttachmentData({ ...newAttachmentData, budget: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Exercice</label>
                  <input
                    type="number"
                    value={newAttachmentData.exercice}
                    onChange={(e) => setNewAttachmentData({ ...newAttachmentData, exercice: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Rubrique</label>
                  <input
                    type="text"
                    value={newAttachmentData.rubrique}
                    onChange={(e) => setNewAttachmentData({ ...newAttachmentData, rubrique: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Lieu Livraison</label>
                  <input
                    type="text"
                    value={newAttachmentData.lieu_livraison}
                    onChange={(e) => setNewAttachmentData({ ...newAttachmentData, lieu_livraison: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>Articles (Récupérés depuis le Bon de Livraison)</h4>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '8px', textAlign: 'left', width: '50px' }}>N°</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Désignation</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '80px' }}>Unité</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '100px' }}>Qté Initiale</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '100px' }}>Taux TVA (%)</th>
                      <th style={{ padding: '8px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {newAttachmentData.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px' }}>
                          <input type="number" value={item.numero_article} onChange={(e) => {
                            const newItems = [...newAttachmentData.items];
                            newItems[idx].numero_article = e.target.value;
                            setNewAttachmentData({ ...newAttachmentData, items: newItems });
                          }} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="text" value={item.designation} onChange={(e) => {
                            const newItems = [...newAttachmentData.items];
                            newItems[idx].designation = e.target.value;
                            setNewAttachmentData({ ...newAttachmentData, items: newItems });
                          }} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="text" value={item.unite} onChange={(e) => {
                            const newItems = [...newAttachmentData.items];
                            newItems[idx].unite = e.target.value;
                            setNewAttachmentData({ ...newAttachmentData, items: newItems });
                          }} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="number" disabled value={item.quantite_initiale || 0} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <input type="number" value={item.taux_tva} onChange={(e) => {
                            const newItems = [...newAttachmentData.items];
                            newItems[idx].taux_tva = e.target.value;
                            setNewAttachmentData({ ...newAttachmentData, items: newItems });
                          }} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button onClick={() => {
                            const newItems = newAttachmentData.items.filter((_, i) => i !== idx);
                            setNewAttachmentData({ ...newAttachmentData, items: newItems });
                          }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button type="button" onClick={() => setShowAttachmentModal(false)} className="btn-secondary" style={{ padding: '10px 20px' }}>Annuler</button>
              <button
                onClick={async () => {
                  if (!newAttachmentData.bon_livraison_id) {
                    alert("Veuillez sélectionner un Bon de Livraison avant d'enregistrer.");
                    return;
                  }
                  try {
                    setSubmitting(true);
                    const payload = { ...newAttachmentData, marche_id: selectedMarche ? selectedMarche.id : null };
                    await api.post('/attachments-bc', payload);
                    await fetchAttachments();
                    setShowAttachmentModal(false);
                  } catch (error) {
                    console.error("Erreur save attachment", error.response || error);
                    alert("Erreur lors de la sauvegarde: " + (error.response?.data?.message || error.message));
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="btn-primary"
                style={{ padding: '10px 20px' }}
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFactureModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '95%', maxWidth: '1000px',
            padding: '24px 32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                {editingFacture ? 'Modifier la Facture' : 'Ajouter une Facture'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowFactureModal(false);
                  setEditingFacture(null);
                }}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background-color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFacture} style={{ display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto', overflowX: 'hidden', flex: 1, paddingRight: '12px' }}>
              {/* General Information Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>N° de Facture *</label>
                  <input
                    type="text"
                    value={newFactureData.numero_facture}
                    onChange={(e) => setNewFactureData({ ...newFactureData, numero_facture: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Date Facture *</label>
                  <input
                    type="date"
                    value={newFactureData.date_facture}
                    onChange={(e) => setNewFactureData({ ...newFactureData, date_facture: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Client</label>
                  <select
                    value={newFactureData.client}
                    onChange={(e) => {
                      const client = e.target.value;
                      const site = client === 'OFPPT / ISTA Ouarzazate' ? 'ISTA Ouarzazate' : 'ISTA Errachidia';
                      setNewFactureData({ ...newFactureData, client, site_livraison: site });
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="OFPPT / ISTA Ouarzazate">OFPPT / ISTA Ouarzazate</option>
                    <option value="OFPPT / ISTA Errachidia">OFPPT / ISTA Errachidia</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Site de livraison</label>
                  <input
                    type="text"
                    value={newFactureData.site_livraison}
                    readOnly
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '13px', color: '#64748b', boxSizing: 'border-box', backgroundColor: '#f8fafc' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Réf. Bon de Commande (BC)</label>
                  <select
                    value={newFactureData.reference_bc}
                    onChange={(e) => {
                      const bcNum = e.target.value;
                      const selectedBc = providerBcs.find(bc => bc.numeroBC === bcNum);
                      if (selectedBc && selectedBc.items && selectedBc.items.length > 0) {
                        const bcItems = selectedBc.items.map(item => ({
                          num_article: item.price_number || '',
                          designation: item.service_description || item.designation || '',
                          unite: item.unit_of_measure || item.unite || 'U',
                          qte: parseFloat(item.qty || item.qte || 1),
                          pu_ht: parseFloat(item.unit_price_ht || item.pu_ht || 0),
                          taux_tva: parseFloat(item.vat_rate || item.taux_tva || 20)
                        }));
                        recalculateFactureTotals(bcItems);
                        setNewFactureData(prev => ({ ...prev, reference_bc: bcNum }));
                      } else {
                        setNewFactureData(prev => ({ ...prev, reference_bc: bcNum }));
                      }
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box', backgroundColor: 'white' }}
                  >
                    <option value="">-- Sélectionner un BC --</option>
                    {providerBcs.map(bc => (
                      <option key={bc.id} value={bc.numeroBC}>{bc.numeroBC} ({new Date(bc.dateEmission).toLocaleDateString('fr-FR')})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>ICE Client</label>
                  <input
                    type="text"
                    value={newFactureData.ice_client}
                    onChange={(e) => setNewFactureData({ ...newFactureData, ice_client: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Added Products Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                    Articles de la Facture ({newFactureData.items?.length || 0})
                  </label>

                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b' }}>N&deg;</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b' }}>D&eacute;signation</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '80px' }}>Qt&eacute;</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '100px' }}>P.U HT</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'center', width: '80px' }}>TVA (%)</th>
                        <th style={{ padding: '10px 12px', fontWeight: '700', color: '#64748b', textAlign: 'right', width: '100px' }}>Total HT</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!newFactureData.items || newFactureData.items.length === 0) ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            Aucun produit ajouté à la facture.
                          </td>
                        </tr>
                      ) : (
                        newFactureData.items.map((item, index) => {
                          const totalLineHt = (parseFloat(item.qte) || 0) * (parseFloat(item.pu_ht) || 0);
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f766e' }}>{item.num_article}</td>
                              <td style={{ padding: '10px 12px', color: '#334155' }}>
                                <div style={{ fontWeight: '600' }}>{item.designation}</div>
                                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Unit&eacute;: {item.unite}</div>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input type="number" min="1" value={item.qte} onChange={(e) => handleUpdateItemFacture(index, 'qte', e.target.value)} style={{ width: '60px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }} />
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input type="number" step="0.01" value={item.pu_ht} onChange={(e) => handleUpdateItemFacture(index, 'pu_ht', e.target.value)} style={{ width: '80px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none' }} />
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <select value={item.taux_tva} onChange={(e) => handleUpdateItemFacture(index, 'taux_tva', e.target.value)} style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}>
                                  <option value={0}>0%</option><option value={9}>9%</option><option value={10}>10%</option><option value={20}>20%</option>
                                </select>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>{totalLineHt.toFixed(2)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button type="button" onClick={() => handleRemoveProductFromFacture(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals + Montant en lettres */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {/* Montant en lettres */}
                <div style={{ flex: 1, minWidth: '280px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Arrêter la présente facture à la somme de :</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', fontStyle: 'italic', lineHeight: '1.5' }}>
                    {newFactureData.montant_lettres || '—'}
                  </div>
                </div>
                {/* Calculs */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: 'Total HT :', value: newFactureData.montantHT, bold: false },
                    { label: 'TVA 9 % :', value: newFactureData.tva_9, bold: false },
                    { label: 'TVA 10 % :', value: newFactureData.tva_10, bold: false },
                    { label: 'TVA 20 % :', value: newFactureData.tva_20, bold: false },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{row.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>{parseFloat(row.value || 0).toFixed(2)} MAD</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '2px solid #0f766e' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f766e' }}>Total TTC :</span>
                    <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f766e' }}>{parseFloat(newFactureData.montantTTC || 0).toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" onClick={() => { setShowFactureModal(false); setEditingFacture(null); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Annuler</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                  {editingFacture ? 'Enregistrer les modifications' : 'Créer la facture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal View Facture details */}
      {selectedFactureForView && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', marginRight: '8px' }}>
                  {selectedFactureForView.numero_facture}
                </span>
                <h2 style={{ margin: '6px 0 0 0', fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                  Facture Client
                </h2>
              </div>
              <button
                onClick={() => setSelectedFactureForView(null)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Date de facturation</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {new Date(selectedFactureForView.date_facture).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Client</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  {selectedFactureForView.client || 'Non spécifié'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>ICE Client</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>{selectedFactureForView.ice_client || 'Non spécifié'}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Statut</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  <span style={{ backgroundColor: selectedFactureForView.statut === 'Payée' ? '#ecfdf5' : '#fef3c7', color: selectedFactureForView.statut === 'Payée' ? '#10b981' : '#d97706', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                    {selectedFactureForView.statut || 'En cours'}
                  </span>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>Détail des articles</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '40px' }}>N°</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b' }}>DÉSIGNATION</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '60px', textAlign: 'center' }}>QTÉ</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '90px', textAlign: 'right' }}>PU HT</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '60px', textAlign: 'center' }}>TVA</th>
                  <th style={{ padding: '8px', fontSize: '11px', fontWeight: '700', color: '#64748b', width: '100px', textAlign: 'right' }}>TOTAL HT</th>
                </tr>
              </thead>
              <tbody>
                {(!selectedFactureForView.articles || selectedFactureForView.articles.length === 0) ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                      Aucun article trouvé.
                    </td>
                  </tr>
                ) : (
                  selectedFactureForView.articles.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 8px', fontSize: '12px', color: '#0f766e', fontWeight: '600' }}>{item.num_article}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                        {item.designation}
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>Unité: {item.unite}</div>
                      </td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#0f172a', textAlign: 'center', fontWeight: '600' }}>{item.qte}</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', color: '#475569', textAlign: 'right' }}>{parseFloat(item.pu_ht).toFixed(2)}</td>
                      <td style={{ padding: '10px 8px', fontSize: '12px', color: '#475569', textAlign: 'center' }}>{parseFloat(item.taux_tva)}%</td>
                      <td style={{ padding: '10px 8px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>{((parseFloat(item.qte) || 0) * (parseFloat(item.pu_ht) || 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Calculations */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #cbd5e1', paddingTop: '16px' }}>
              <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Total HT:</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {parseFloat(selectedFactureForView.total_ht || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Total TVA:</span>
                  <span style={{ fontWeight: '600', color: '#334155' }}>
                    {parseFloat(selectedFactureForView.tva || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '800', color: '#0f766e', borderTop: '1px double #cbd5e1', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Montant TTC:</span>
                  <span>
                    {parseFloat(selectedFactureForView.total_ttc || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setSelectedFactureForView(null)}
                className="btn-primary"
                style={{ padding: '10px 20px', backgroundColor: '#0f766e', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '600', cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {showPvModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                {editingPv ? 'Modifier le PV de Réception' : 'Nouveau PV de Réception'}
              </h2>
              <button onClick={() => { setShowPvModal(false); setEditingPv(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <form onSubmit={handleSubmitPv} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Informations du BL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>N° Bon de Livraison *</label>
                  <select
                    value={newPvData.bon_livraison_id}
                    onChange={(e) => setNewPvData({ ...newPvData, bon_livraison_id: e.target.value })}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    required
                  >
                    <option value="">Sélectionnez un BL</option>
                    {providerBls.map(bl => (
                      <option key={bl.id} value={bl.id}>{bl.numeroBL} (émis le {new Date(bl.dateLivraison).toLocaleDateString('fr-FR')})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Date de Réception *</label>
                  <input
                    type="date"
                    value={newPvData.date_reception}
                    onChange={(e) => setNewPvData({ ...newPvData, date_reception: e.target.value })}
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                    required
                  />
                </div>
              </div>

              {/* Read-only populated data from BL */}
              {newPvData.bon_livraison_id && (
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {(() => {
                    const selBl = providerBls.find(b => b.id.toString() === newPvData.bon_livraison_id.toString());
                    const fournName = fournisseurs.find(f => f.id.toString() === selBl?.fournisseur_id?.toString())?.raisonSociale || 'Inconnu';
                    return (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Fournisseur</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{fournName}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Rubrique</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{selBl?.rubrique || 'Produits alimentaires'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Objet / Marché</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{selectedMarche?.titulaire}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Commission Members */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Membres de la commission</label>
                  <button type="button" onClick={handleAddPvCommission} style={{ fontSize: '12px', padding: '6px 12px', backgroundColor: '#e0e7ff', color: '#4f46e5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={14} /> Ajouter un membre
                  </button>
                </div>
                
                <datalist id="commission-names">
                  {Array.from(new Set(pvs.flatMap(p => p.commissions || []).map(c => c.nom_prenom))).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b' }}>Nom et Prénom</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b' }}>Fonction</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b', width: '140px' }}>Rôle</th>
                        <th style={{ padding: '10px 12px', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!newPvData.commissions || newPvData.commissions.length === 0) ? (
                        <tr>
                          <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                            Aucun membre ajouté.
                          </td>
                        </tr>
                      ) : (
                        newPvData.commissions.map((member, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="text" 
                                list="commission-names"
                                value={member.nom_prenom} 
                                onChange={(e) => handleCommissionNameChange(index, e.target.value)} 
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                                placeholder="Commencez à taper..."
                                required 
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="text" 
                                value={member.fonction} 
                                onChange={(e) => handleUpdatePvCommission(index, 'fonction', e.target.value)} 
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                                required 
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select 
                                value={member.role} 
                                onChange={(e) => handleUpdatePvCommission(index, 'role', e.target.value)}
                                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', backgroundColor: 'white' }}
                              >
                                <option value="President">Président</option>
                                <option value="Membre">Membre</option>
                                <option value="Rapporteur">Rapporteur</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button type="button" onClick={() => handleRemovePvCommission(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" onClick={() => { setShowPvModal(false); setEditingPv(null); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Annuler</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                  {editingPv ? 'Mettre à jour' : 'Enregistrer le PV'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConformiteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '900px',
            padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                {editingConformite ? 'Modifier PV de Conformité' : 'Générer PV de Conformité'}
              </h2>
              <button onClick={() => { setShowConformiteModal(false); setEditingConformite(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            <form onSubmit={handleSaveConformite} style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Sélectionner un Bon de Livraison (PV de Réception) *</label>
                <select
                  value={newConformiteData.pv_reception_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewConformiteData({ ...newConformiteData, pv_reception_id: val });
                    if (val && !editingConformite) {
                      handleGenerateConformite(val);
                    }
                  }}
                  style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                  required
                  disabled={!!editingConformite}
                >
                  <option value="">Sélectionnez un BL ayant un PV de Réception</option>
                  {pvs.filter(p => providerBls.some(b => b.id == p.bon_livraison_id)).map(pv => {
                    const bl = providerBls.find(b => b.id == pv.bon_livraison_id);
                    return (
                      <option key={pv.id} value={pv.id}>
                        {bl ? bl.numeroBL : 'BL Inconnu'} (PV du {new Date(pv.date_reception).toLocaleDateString('fr-FR')})
                      </option>
                    );
                  })}
                </select>
              </div>

              {newConformiteData.conformites && newConformiteData.conformites.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b', width: '50px' }}>N°</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b' }}>Désignation</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b', width: '80px', textAlign: 'center' }}>Unité</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b', width: '80px', textAlign: 'center' }}>Quantité</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b', width: '120px' }}>Conformité</th>
                        <th style={{ padding: '10px 12px', fontWeight: '600', color: '#64748b' }}>Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newConformiteData.conformites.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', color: '#0f766e', fontWeight: '600' }}>{item.numero_ligne}</td>
                          <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: '500' }}>
                            {item.price_number && (
                              <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', marginRight: '8px' }}>
                                N° {item.price_number}
                              </span>
                            )}
                            {item.designation}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              letterSpacing: '0.03em'
                            }}>
                              {item.unite}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              backgroundColor: '#fef3c7',
                              color: '#d97706',
                              border: '1px solid #fde68a',
                              padding: '3px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: '700',
                              letterSpacing: '0.03em'
                            }}>
                              {item.quantite}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select 
                              value={item.conformite} 
                              onChange={(e) => handleUpdateConformiteLine(index, 'conformite', e.target.value)}
                              style={{ 
                                width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', 
                                outline: 'none', backgroundColor: item.conformite === 'Conforme' ? '#ecfdf5' : '#fef2f2',
                                color: item.conformite === 'Conforme' ? '#0f766e' : '#ef4444',
                                fontWeight: '600'
                              }}
                            >
                              <option value="Conforme">Conforme</option>
                              <option value="Non Conforme">Non Conforme</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input 
                              type="text" 
                              value={item.observation || ''} 
                              onChange={(e) => handleUpdateConformiteLine(index, 'observation', e.target.value)}
                              placeholder="Remarques..."
                              style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" onClick={() => { setShowConformiteModal(false); setEditingConformite(null); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Annuler</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL: ATTACHEMENT ── */}
      {selectedAttachmentForView && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', padding: '32px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={20} color="#0f766e" /> Détail Attachement
              </h2>
              <button onClick={() => setSelectedAttachmentForView(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'N° Attachement', value: `${selectedAttachmentForView.numero_attachment}/${selectedAttachmentForView.exercice}` },
                { label: 'Budget', value: selectedAttachmentForView.budget || '—' },
                { label: 'Rubrique', value: selectedAttachmentForView.rubrique || '—' },
                { label: 'Lieu de livraison', value: selectedAttachmentForView.lieu_livraison || '—' },
                { label: 'Référence marché', value: selectedAttachmentForView.reference_marche || '—' },
                { label: 'Exercice', value: selectedAttachmentForView.exercice || '—' },
              ].map((field, i) => (
                <div key={i} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{field.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{field.value}</div>
                </div>
              ))}
            </div>
            {selectedAttachmentForView.items && selectedAttachmentForView.items.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>Articles ({selectedAttachmentForView.items.length})</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Désignation</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>Unité</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>Quantité</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>Taux TVA (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(typeof selectedAttachmentForView.items === 'string' ? JSON.parse(selectedAttachmentForView.items) : selectedAttachmentForView.items).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', color: '#334155', fontWeight: '500' }}>{item.designation || item.service_description || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.unite || '—'}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.quantite || item.quantity || '0'}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.taux_tva || '0'}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button onClick={() => setSelectedAttachmentForView(null)} style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL: PV DE RÉCEPTION ── */}
      {selectedPvForView && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '640px', padding: '32px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={20} color="#0f766e" /> Détail PV de Réception
              </h2>
              <button onClick={() => setSelectedPvForView(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'BL Associé', value: providerBls.find(b => b.id == selectedPvForView.bon_livraison_id)?.numeroBL || 'Inconnu' },
                { label: 'Date de réception', value: new Date(selectedPvForView.date_reception).toLocaleDateString('fr-FR') },
                { label: 'Marché', value: selectedMarche?.titulaire || '—' },
                { label: 'Membres commission', value: `${selectedPvForView.commissions?.length || 0} membres` },
              ].map((field, i) => (
                <div key={i} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{field.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{field.value}</div>
                </div>
              ))}
            </div>
            {selectedPvForView.commissions && selectedPvForView.commissions.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>Membres de la commission</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Nom & Prénom</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Fonction</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b' }}>Rôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPvForView.commissions.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{m.nom_prenom}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{m.fonction}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: m.role === 'President' ? '#ecfdf5' : m.role === 'Rapporteur' ? '#eff6ff' : '#f8fafc', color: m.role === 'President' ? '#0f766e' : m.role === 'Rapporteur' ? '#2563eb' : '#64748b', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', border: '1px solid', borderColor: m.role === 'President' ? '#bbf7d0' : m.role === 'Rapporteur' ? '#bfdbfe' : '#e2e8f0' }}>{m.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button onClick={() => setSelectedPvForView(null)} style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW MODAL: PV DE CONFORMITÉ ── */}
      {selectedConformiteForView && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', padding: '32px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={20} color="#0f766e" /> Détail PV de Conformité
              </h2>
              <button onClick={() => setSelectedConformiteForView(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { label: 'BL Associé', value: providerBls.find(b => b.id == selectedConformiteForView.bon_livraison_id)?.numeroBL || 'Inconnu' },
                { label: 'Date de réception', value: new Date(selectedConformiteForView.date_reception).toLocaleDateString('fr-FR') },
                { label: 'Total articles', value: `${selectedConformiteForView.pv_conformites?.length || 0} articles` },
                { label: 'Conformes', value: `${(selectedConformiteForView.pv_conformites || []).filter(c => c.conformite === 'Conforme').length} / ${selectedConformiteForView.pv_conformites?.length || 0}` },
              ].map((field, i) => (
                <div key={i} style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{field.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{field.value}</div>
                </div>
              ))}
            </div>
            {selectedConformiteForView.pv_conformites && selectedConformiteForView.pv_conformites.length > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>Articles vérifiés</div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b', width: '40px' }}>N°</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Désignation</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b', width: '80px' }}>Unité</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b', width: '80px' }}>Quantité</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#64748b', width: '130px' }}>Conformité</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>Observations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedConformiteForView.pv_conformites.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#0f766e', fontWeight: '700' }}>{item.numero_ligne}</td>
                          <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: '500' }}>
                            {item.price_number && <span style={{ backgroundColor: '#ecfdf5', color: '#0f766e', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', marginRight: '6px' }}>N° {item.price_number}</span>}
                            {item.designation}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.unite}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.quantite}</span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ backgroundColor: item.conformite === 'Conforme' ? '#ecfdf5' : '#fef2f2', color: item.conformite === 'Conforme' ? '#0f766e' : '#ef4444', border: `1px solid ${item.conformite === 'Conforme' ? '#bbf7d0' : '#fca5a5'}`, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{item.conformite}</span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '12px' }}>{item.observation || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button onClick={() => setSelectedConformiteForView(null)} style={{ padding: '10px 28px', borderRadius: '8px', border: 'none', backgroundColor: '#0f766e', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarchesContent;
