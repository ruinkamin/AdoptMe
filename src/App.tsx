import { useState, useEffect, useCallback, useRef } from "react";
import { Pet, Application, AdoptionType, AdoptionFormData } from "./types/pet";
import { PetCard } from "./components/PetCard";
import { Matchmaker } from "./components/Matchmaker";
import { AdoptionForm } from "./components/AdoptionForm";
import { AddPetForm } from "./components/AddPetForm";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { apiCall } from "./utils/api";
import { initialPets } from "./data/pets";

function AppContent() {
  const { user, token, loading, login, register, logout } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [allPetsRaw, setAllPetsRaw] = useState<Pet[]>([]); 
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedPetForDetails, setSelectedPetForDetails] = useState<Pet | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [adoptionType, setAdoptionType] = useState<AdoptionType>("adoption");
  const [showAddPet, setShowAddPet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [petsOnTrial, setPetsOnTrial] = useState<Pet[]>([]);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState<number>(100);
  const [isDonating, setIsDonating] = useState(false);

  const [aiFilteredPetIds, setAiFilteredPetIds] = useState<string[] | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Pet>>({});

  const petDetailAbortControllerRef = useRef<AbortController | null>(null);
  const currentPetIdRef = useRef<string | null>(null);

  const isAdmin = user?.isAdmin || (user as any)?.role === 'admin';

  const normalizePet = (raw: any): Pet => {
    const temperamentTags = Array.isArray(raw.temperament_tags) ? raw.temperament_tags : raw.temperament ? String(raw.temperament).split(/,\s*/).filter(Boolean) : [];
    const ageMonths = raw.age_months ?? (typeof raw.age === "string" ? Math.round(Number(raw.age.replace(/[^0-9.]/g, "")) * 12) : 0);
    
    return {
      id: String(raw.id || raw._id || Math.random().toString(36).substr(2, 9)),
      type: raw.type === "cat" || raw.type === "dog" ? raw.type : "cat",
      breed_visual: raw.breed_visual || raw.breed || "",
      name: raw.name || "",
      sex: raw.sex || "",
      description: raw.description || "",
      age_months: ageMonths,
      size: raw.size || "",
      weight_kg: raw.weight_kg,
      color: raw.color || "",
      sterilized: raw.sterilized ?? false,
      temperament_tags: temperamentTags,
      health_status: raw.health_status || "",
      medical_conditions: raw.medical_conditions || "",
      ideal_owner_tags: Array.isArray(raw.ideal_owner_tags) ? raw.ideal_owner_tags : [],
      photo_url: raw.photo_url || raw.imageUrl || "",
      monthly_cost: raw.monthly_cost ?? raw.estimatedCost ?? 0,
      status: raw.status || "available",
      deleted_at: raw.deleted_at
    };
  };

  const normalizeApplication = (raw: any): Application => ({
    id: String(raw.id || raw._id || ""),
    user_id: String(raw.user_id || raw.userId || ""),
    pet_id: String(raw.pet_id || raw.petId || ""),
    type: raw.type || "trial_day",
    full_name: raw.full_name || raw.fullName || "",
    phone: raw.phone || "",
    address: raw.address || "",
    has_children: raw.has_children ?? raw.hasChildren ?? false,
    has_other_pets: raw.has_other_pets ?? raw.hasOtherPets ?? false,
    booking_date: raw.booking_date || raw.date || "",
    booking_time: raw.booking_time || raw.time || "",
    agreed_to_costs: raw.agreed_to_costs ?? raw.understandsCommitment ?? false,
    status: raw.status || raw.applicationStatus || "pending",
    created_at: raw.created_at || raw.createdAt || "",
    user_name: raw.user_name || raw.userName || "",
    pet_name: raw.pet_name || raw.petName || "",
  });

  const loadAllPetsData = useCallback(async () => {
    try {
      const data = await apiCall("/pets?per_page=100", "GET", undefined, token || "");
      const serverPetsRaw: any[] = Array.isArray(data) ? data : (data.data || []);
      const serverPets = serverPetsRaw.map(normalizePet).filter(p => !p.deleted_at);
      
      const combined = [...serverPets];
      initialPets.forEach(ip => {
        if (!combined.some(cp => cp.name.toLowerCase() === ip.name.toLowerCase())) {
          combined.push(ip);
        }
      });
      
      setAllPetsRaw(combined);
      setTotalPages(Math.max(1, Math.ceil(combined.length / ITEMS_PER_PAGE)));
    } catch (error) {
      console.error("Error loading all pets:", error);
      setAllPetsRaw(initialPets);
      setTotalPages(Math.max(1, Math.ceil(initialPets.length / ITEMS_PER_PAGE)));
    }
  }, [token]);

  useEffect(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    setPets(allPetsRaw.slice(start, start + ITEMS_PER_PAGE));
  }, [allPetsRaw, currentPage]);

  const loadMyApplications = useCallback(async () => {
    try {
      const data = await apiCall("/applications/my", "GET", undefined, token || "");
      const rawApplications = Array.isArray(data) ? data : data.applications || [];
      setApplications(rawApplications.map(normalizeApplication));
    } catch (error) { console.error(error); }
  }, [token]);

  const loadAllApplications = useCallback(async () => {
    try {
      const data = await apiCall("/applications", "GET", undefined, token || "");
      const rawApplications = Array.isArray(data) ? data : data.applications || [];
      setAllApplications(rawApplications.map(normalizeApplication));
    } catch (error) { console.error(error); }
  }, [token]);

  const loadTrialPets = useCallback(async () => {
    try {
      const data = await apiCall("/pets?per_page=100", "GET", undefined, token || "");
      const serverPetsRaw: any[] = Array.isArray(data) ? data : (data.data || []);
      const trialOnly = serverPetsRaw.map(normalizePet).filter(p => p.status === "trial");
      setPetsOnTrial(trialOnly);
    } catch (error) { console.error(error); }
  }, [token]);

  const loadPetDetails = useCallback(async (petId: string) => {
    try {
      if (petDetailAbortControllerRef.current) petDetailAbortControllerRef.current.abort();
      const controller = new AbortController();
      petDetailAbortControllerRef.current = controller;
      currentPetIdRef.current = petId;
      let petDetail: any = null;
      try {
        const data = await apiCall(`/pets/${petId}`, "GET", undefined, token || "", controller.signal);
        petDetail = data?.data || data;
      } catch (e) { petDetail = allPetsRaw.find(p => p.id === petId); }
      if (currentPetIdRef.current === petId && petDetail) setSelectedPetForDetails(normalizePet(petDetail));
    } catch (error) { console.error(error); }
  }, [token, allPetsRaw]);

  const handleOpenPetDetails = (petId: string) => {
    const pet = allPetsRaw.find(p => p.id === petId);
    if (pet) {
      setSelectedPetForDetails(pet);
      setIsEditingDetails(false);
      setEditForm(pet);
      setIsDetailsOpen(true);
      loadPetDetails(petId);
    }
  };

  const handleSaveDetails = async () => {
    await handleUpdatePet(editForm as Pet);
    setIsEditingDetails(false);
    setSelectedPetForDetails({ ...selectedPetForDetails, ...editForm } as Pet);
  };

  useEffect(() => { loadAllPetsData(); }, [loadAllPetsData]);
  useEffect(() => {
    if (token && user) {
      if (isAdmin) { loadAllApplications(); loadTrialPets(); }
      else loadMyApplications();
    }
  }, [token, user, isAdmin, loadMyApplications, loadAllApplications, loadTrialPets]);

  const handleLogin = async (email: string, pass: string) => {
    try { setAuthLoading(true); setAuthError(""); await login(email, pass); }
    catch (error) { setAuthError("Невірні облікові дані"); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async (email: string, pass: string, name: string) => {
    try { setAuthLoading(true); setAuthError(""); await register(email, pass, name); setIsRegisterMode(false); }
    catch (error) { setAuthError("Помилка реєстрації"); }
    finally { setAuthLoading(false); }
  };

  const handleTrialDay = (pet: Pet) => { if (!user) { setAuthError("Будь ласка, увійдіть"); return; } setSelectedPet(pet); setAdoptionType("trial"); };
  const handleAdopt = (pet: Pet) => { if (!user) { setAuthError("Будь ласка, увійдіть"); return; } setSelectedPet(pet); setAdoptionType("adoption"); };

  const handleFormSubmit = async (formData: AdoptionFormData) => {
    if (!selectedPet || !token) return;
    try {
      const payload = {
        pet_id: selectedPet.id, type: adoptionType === "trial" ? "trial_day" : "adoption",
        full_name: formData.fullName, phone: formData.phone, address: formData.address,
        has_children: formData.hasChildren, has_other_pets: formData.hasOtherPets,
        booking_date: formData.date, booking_time: formData.time, agreed_to_costs: formData.understandsCommitment,
      };
      await apiCall("/applications", "POST", payload, token);
      setSelectedPet(null); setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadMyApplications();
    } catch (error) { alert("Помилка при подачі заявки"); }
  };

  const handleAddPet = async (petData: any) => {
    if (!token) return;
    try {
      await apiCall("/pets", "POST", petData, token);
      setShowAddPet(false); setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllPetsData();
    } catch (error) { console.error(error); }
  };

  const handleUpdatePet = async (updated: any) => {
    if (!token) return;
    try {
      const parseTags = (tags: any) => Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const payload = {
        type: updated.type, name: updated.name, sex: updated.sex, description: updated.description,
        age_months: Number(updated.age_months) || 0, size: updated.size, weight_kg: updated.weight_kg ? Number(updated.weight_kg) : null,
        color: updated.color, sterilized: Boolean(updated.sterilized), temperament_tags: parseTags(updated.temperament_tags),
        health_status: updated.health_status, medical_conditions: updated.medical_conditions,
        ideal_owner_tags: parseTags(updated.ideal_owner_tags), breed_visual: updated.breed_visual,
        photo_url: updated.photo_url || updated.imageUrl, monthly_cost: Number(updated.monthly_cost) || 0, status: updated.status || "available"
      };
      await apiCall(`/pets/${updated.id}`, "PUT", payload, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllPetsData(); loadTrialPets();
    } catch (error) { console.error(error); }
  };

  const handleDeletePet = async (petId: string) => {
    if (!token || !window.confirm("Ви впевнені?")) return;
    try {
      await apiCall(`/pets/${petId}`, "DELETE", undefined, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllPetsData(); setPetsOnTrial(prev => prev.filter(p => p.id !== petId));
    } catch (error) { alert("Помилка при видаленні"); }
  };

  const handleApproveApplication = async (appId: string) => {
    if (!token) return;
    try {
      await apiCall(`/applications/${appId}/approve`, "PATCH", {}, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllApplications(); loadTrialPets(); loadAllPetsData();
    } catch (error) { alert("Помилка при схваленні"); }
  };

  const handleRejectApplication = async (appId: string) => {
    if (!token) return;
    try {
      await apiCall(`/applications/${appId}/reject`, "PATCH", {}, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllApplications();
    } catch (error) { alert("Помилка при відхиленні"); }
  };

  const handleDeleteApplication = async (appId: string) => {
    if (!token || !window.confirm("Ви впевнені?")) return;
    try {
      await apiCall(`/applications/${appId}`, "DELETE", undefined, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadMyApplications();
    } catch (error) { alert("Помилка при видаленні"); }
  };

  const handleReturnPetFromTrial = async (petId: string) => {
    if (!token || !window.confirm("Повернути тваринку?")) return;
    try {
      setPetsOnTrial(prev => prev.filter(p => p.id !== petId));
      await apiCall(`/pets/${petId}/return`, "PATCH", {}, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadTrialPets(); loadAllPetsData();
    } catch (error) { alert("Помилка при поверненні"); loadTrialPets(); }
  };

  const handleDonate = async () => {
    try {
      setIsDonating(true);
      const res = await apiCall('/donate', 'POST', { amount: donateAmount });
      const f = document.createElement('form'); f.method = 'POST'; f.action = 'https://www.liqpay.ua/api/3/checkout';
      const d = document.createElement('input'); d.type = 'hidden'; d.name = 'data'; d.value = res.data;
      const s = document.createElement('input'); s.type = 'hidden'; s.name = 'signature'; s.value = res.signature;
      f.appendChild(d); f.appendChild(s); document.body.appendChild(f); f.submit();
    } catch (e) { alert("Помилка платежу"); } finally { setIsDonating(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-amber-900 font-medium">AdoptMe Dnipro...</div>;

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-amber-900">AdoptMe Dnipro</h1>
            <p className="text-xs text-slate-500">DniproAnimals Shelter {isAdmin && <span className="text-emerald-600 font-bold ml-2">Адмін</span>}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button className="bg-emerald-600 text-white font-bold" onClick={() => setShowDonateModal(true)}>Задонатити 💛</Button>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                <Button variant="outline" size="sm" onClick={logout}>Вийти</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsRegisterMode(false)}>Увійти</Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user && (
          <div className="mb-8 p-6 bg-white rounded-xl shadow-sm max-w-md mx-auto border border-amber-100">
            <h2 className="text-lg font-semibold text-amber-900 mb-4 text-center">{isRegisterMode ? "Реєстрація" : "Вхід"}</h2>
            <div className="space-y-4">
              {isRegisterMode && <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Ім'я" className="w-full border rounded-lg px-3 py-2 text-sm" />}
              <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Пароль" type="password" className="w-full border rounded-lg px-3 py-2 text-sm" />
              {authError && <p className="text-red-500 text-xs text-center">{authError}</p>}
              <div className="flex gap-2 pt-2">
                <Button onClick={() => isRegisterMode ? handleRegister(authEmail, authPassword, authName) : handleLogin(authEmail, authPassword)} disabled={authLoading} className="flex-1 bg-amber-600 text-white">{authLoading ? "..." : isRegisterMode ? "Зареєструватися" : "Увійти"}</Button>
                <Button variant="outline" onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(""); }} className="flex-1 border-amber-200">{isRegisterMode ? "Вхід" : "Реєстрація"}</Button>
              </div>
            </div>
          </div>
        )}

        {user && (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-1/3 space-y-6">
              {!isAdmin ? (
                <>
                  <Matchmaker pets={allPetsRaw} onMatch={handleAdopt} onAiFilter={(ids) => setAiFilteredPetIds(ids.length > 0 ? ids : null)} />
                  {applications.length > 0 && (
                    <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-amber-900 mb-3 text-center border-b pb-2">Мої заявки</h3>
                      <div className="space-y-3">
                        {applications.map(app => (
                          <div key={app.id} className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 flex justify-between items-start shadow-sm transition-hover hover:bg-amber-50">
                            <div>
                              <p className="text-sm font-bold text-amber-900">{app.pet_name || "Тваринка"}</p>
                              <p className="text-[10px] text-slate-500">{app.booking_date}</p>
                              <p className="text-xs mt-1 font-medium"><span className={app.status === "approved" ? "text-emerald-600" : app.status === "rejected" ? "text-red-500" : "text-amber-600"}>{app.status === "pending" ? "Очікування" : app.status === "approved" ? "Схвалено" : "Відхилено"}</span></p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteApplication(app.id)} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="sticky top-24 space-y-6">
                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-amber-900 mb-3 text-center border-b pb-2">Заявки</h3>
                    {allApplications.filter(app => app.status === 'pending').length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {allApplications.filter(app => app.status === 'pending').map(app => (
                          <div key={app.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50 shadow-sm">
                            <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}>
                              <div><p className="font-bold text-amber-900 text-sm">{app.pet_name}</p><p className="text-[10px] text-slate-600">Від: {app.user_name || app.full_name}</p></div>
                              <div className="bg-white p-1 rounded-full shadow-sm">{expandedAppId === app.id ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}</div>
                            </div>
                            {expandedAppId === app.id && (
                              <div className="mt-3 pt-3 border-t border-amber-200 text-[11px] space-y-2">
                                <p>📞 {app.phone}</p><p>🏠 {app.address}</p>
                                <div className="flex gap-2 mt-4">
                                  <Button size="sm" onClick={() => handleApproveApplication(app.id)} className="flex-1 bg-emerald-600 text-white text-xs h-8">Погодити</Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRejectApplication(app.id)} className="flex-1 text-red-600 border-red-200 text-xs h-8">Відхилити</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500 text-center py-4">Немає нових заявок.</p>}
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-amber-900 mb-3 text-center border-b pb-2">На тріалі</h3>
                    <div className="space-y-2">
                      {petsOnTrial.length > 0 ? (
                        petsOnTrial.map(pet => (
                          <div key={pet.id} className="flex items-center justify-between p-2 border border-amber-100 rounded bg-amber-50/50 shadow-sm">
                            <span className="text-sm font-medium">{pet.name}</span>
                            <Button size="sm" variant="outline" onClick={() => handleReturnPetFromTrial(pet.id)} className="h-7 text-[10px] text-amber-700 border-amber-200">Повернути</Button>
                          </div>
                        ))
                      ) : <p className="text-xs text-slate-500 text-center py-4">Список заброньованих порожній</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full lg:w-2/3">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-amber-900">Наші улюбленці</h2>
                {isAdmin && <Button onClick={() => setShowAddPet(true)} className="bg-amber-600 text-white font-bold"><Plus className="w-4 h-4 mr-2" /> Додати</Button>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(aiFilteredPetIds ? allPetsRaw.filter(p => aiFilteredPetIds.includes(p.id)) : pets).map((pet) => (
                  <PetCard key={pet.id} pet={pet} onTrialDay={handleTrialDay} onAdopt={handleAdopt} onSelect={handleOpenPetDetails} isAdmin={isAdmin} onDelete={handleDeletePet} />
                ))}
              </div>
              <div className="flex justify-between items-center mt-10 border-t border-amber-100 pt-6">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="border-amber-200 text-amber-800">Назад</Button>
                <span className="text-sm font-bold text-amber-900">Сторінка {currentPage} з {totalPages}</span>
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="border-amber-200 text-amber-800">Вперед</Button>
              </div>
            </div>
          </div>
        )}

        {isDetailsOpen && selectedPetForDetails && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-5 border-b bg-amber-50">
                <h3 className="text-xl font-bold text-amber-900">
                  {isEditingDetails ? <input className="border border-amber-300 rounded px-2 w-full text-sm outline-none focus:ring-2 focus:ring-amber-500" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /> : selectedPetForDetails.name}
                </h3>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    isEditingDetails ? (
                      <><Button size="sm" className="bg-emerald-600 text-white" onClick={handleSaveDetails}>Зберегти</Button><Button size="sm" variant="outline" onClick={() => setIsEditingDetails(false)}>Скасувати</Button></>
                    ) : (
                      <><Button size="sm" variant="outline" onClick={() => setIsEditingDetails(true)} className="text-amber-700 border-amber-200">Редагувати</Button><Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => { handleDeletePet(selectedPetForDetails.id); setIsDetailsOpen(false); }}>Видалити</Button></>
                    )
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></Button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-y-auto">
                <div className="space-y-4">
                  <img src={selectedPetForDetails.photo_url || selectedPetForDetails.imageUrl} className="w-full aspect-square object-cover rounded-xl shadow-sm border border-amber-100" alt="pet" />
                  {isEditingDetails && <input className="w-full border border-amber-200 rounded px-3 py-2 text-xs" value={editForm.photo_url || ''} onChange={e => setEditForm({ ...editForm, photo_url: e.target.value })} placeholder="URL фото" />}
                </div>
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Стать</span>{isEditingDetails ? <input className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.sex || ''} onChange={e => setEditForm({ ...editForm, sex: e.target.value })} /> : <span className="font-medium">{selectedPetForDetails.sex || 'Не вказано'}</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Вік</span>{isEditingDetails ? <input type="number" className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.age_months || 0} onChange={e => setEditForm({ ...editForm, age_months: parseInt(e.target.value) })} /> : <span className="font-medium">{selectedPetForDetails.age_months} міс.</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Розмір</span>{isEditingDetails ? <input className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.size || ''} onChange={e => setEditForm({ ...editForm, size: e.target.value })} /> : <span className="font-medium">{selectedPetForDetails.size || 'Не вказано'}</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Вага</span>{isEditingDetails ? <input type="number" className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.weight_kg || ''} onChange={e => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })} /> : <span className="font-medium">{selectedPetForDetails.weight_kg ? `${selectedPetForDetails.weight_kg} кг` : 'Не вказано'}</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Колір</span>{isEditingDetails ? <input className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.color || ''} onChange={e => setEditForm({ ...editForm, color: e.target.value })} /> : <span className="font-medium">{selectedPetForDetails.color || 'Не вказано'}</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Стерилізація</span>{isEditingDetails ? <input type="checkbox" checked={editForm.sterilized || false} onChange={e => setEditForm({ ...editForm, sterilized: e.target.checked })} /> : <span className="font-medium">{selectedPetForDetails.sterilized ? 'Так' : 'Ні'}</span>}</div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Витрати</span><span className="font-bold text-emerald-700">{selectedPetForDetails.monthly_cost} грн/міс</span></div>
                    <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Статус</span>{isEditingDetails ? <select className="border border-amber-100 rounded px-2 py-1 text-xs bg-white" value={editForm.status || 'available'} onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}><option value="available">Доступний</option><option value="trial">На тріалі</option><option value="adopted">У родині</option></select> : <span className="font-bold text-amber-600">{selectedPetForDetails.status}</span>}</div>
                  </div>
                  <div className="flex flex-col"><span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Здоров'я</span>{isEditingDetails ? <input className="border border-amber-100 rounded px-2 py-1 text-xs" value={editForm.health_status || ''} onChange={e => setEditForm({ ...editForm, health_status: e.target.value })} /> : <span>{selectedPetForDetails.health_status || 'В нормі'}</span>}</div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2">Темперамент</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedPetForDetails.temperament_tags?.map(t => <span key={t} className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-100">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-2 block">Опис</span>
                    <p className="text-slate-600 leading-relaxed text-xs italic bg-amber-50/30 p-3 rounded-lg border border-amber-50">"{selectedPetForDetails.description}"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedPet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-amber-50"><h3 className="font-bold text-amber-900 text-lg">{adoptionType === "trial" ? "Тріал (знайомство)" : "Усиновлення"}</h3><Button variant="ghost" onClick={() => setSelectedPet(null)} className="text-slate-400"><X className="w-5 h-5" /></Button></div>
            <AdoptionForm pet={selectedPet} adoptionType={adoptionType} onSubmit={handleFormSubmit} onCancel={() => setSelectedPet(null)} />
          </div>
        </div>
      )}

      {showToast && <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-8 py-4 rounded-xl shadow-2xl z-[100] animate-in slide-in-from-bottom font-bold">Успішно!</div>}
      
      {showDonateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl border border-amber-100">
            <div className="flex justify-between items-center mb-6 text-center">
              <h3 className="text-xl font-bold text-amber-900 w-full ml-4">Підтримати нас</h3>
              <Button variant="ghost" onClick={() => setShowDonateModal(false)} className="text-slate-400 hover:bg-amber-50 rounded-full"><X className="w-5 h-5" /></Button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 200, 500, 1000].map(amount => (
                  <Button key={amount} variant={donateAmount === amount ? "default" : "outline"} className={donateAmount === amount ? "bg-amber-600 text-white font-bold h-11 border-none shadow-md" : "border-amber-200 text-amber-800 h-11 hover:bg-amber-50 font-medium"} onClick={() => setDonateAmount(amount)}>{amount}</Button>
                ))}
                <div className="relative">
                  <Input type="number" placeholder="Сума" value={donateAmount} onChange={(e) => setDonateAmount(Number(e.target.value))} className="border-amber-200 h-11 text-xs focus:ring-amber-500 shadow-sm" />
                </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                <div className="text-2xl">🐾</div>
                <p className="text-xs text-amber-800 font-medium leading-relaxed italic">Кожна ваша гривня допомагає нашим пухнастикам.</p>
              </div>
              <Button className="w-full bg-emerald-600 text-white font-bold h-14 shadow-lg hover:bg-emerald-700 rounded-xl" onClick={handleDonate} disabled={isDonating}>
                {isDonating ? "Зачекайте..." : `Сплатити ${donateAmount} грн 💛`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddPet && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-amber-100">
            <AddPetForm onSubmit={handleAddPet} onCancel={() => setShowAddPet(false)} />
          </div>
        </div>
      )}
      <footer className="bg-white border-t border-amber-50 mt-20 py-10 text-center text-slate-500 text-[10px] font-medium tracking-widest uppercase">© 2026 AdoptMe Dnipro</footer>
    </div>
  );
}

function App() { return (<AuthProvider><AppContent /></AuthProvider>); }
export default App;
