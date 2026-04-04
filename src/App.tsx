import { useState, useEffect, useCallback, useRef } from "react";
import { Pet, Application, AdoptionType, AdoptionFormData } from "./types/pet";
import { PetCard } from "./components/PetCard";
import { Matchmaker } from "./components/Matchmaker";
import { AdoptionForm } from "./components/AdoptionForm";
import { AddPetForm } from "./components/AddPetForm";
import { Button } from "./components/ui/button";
import { Plus, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { apiCall } from "./utils/api";
import { initialPets } from "./data/pets";


function AppContent() {
  const { user, token, loading, login, register, logout } = useAuth();
  const [pets, setPets] = useState<Pet[]>(initialPets);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedPetForDetails, setSelectedPetForDetails] = useState<Pet | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [adoptionType, setAdoptionType] = useState<AdoptionType>("adoption");
  const [showAddPet, setShowAddPet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  //Donation
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateAmount, setDonateAmount] = useState<number>(100);
  const [isDonating, setIsDonating] = useState(false);

  //Filter
  const [aiFilteredPetIds, setAiFilteredPetIds] = useState<string[] | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 6;
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Pet>>({});

  const petDetailAbortControllerRef = useRef<AbortController | null>(null);
  const currentPetIdRef = useRef<string | null>(null);

  const isAdmin = user?.isAdmin || (user as any)?.role === 'admin';

  const normalizePet = (raw: any): Pet => {
    const ageMonths = raw.age_months ?? (typeof raw.age === "string" ? Math.round(Number(raw.age.replace(/[^0-9.]/g, "")) * 12) : undefined);
    const temperamentTags = Array.isArray(raw.temperament_tags) ? raw.temperament_tags : raw.temperament ? String(raw.temperament).split(/,\s*/).filter(Boolean) : [];
    const rawId = raw.id ?? raw._id ?? null;
    let idValue = rawId != null ? String(rawId) : "";
    if (!idValue) {
      const fallbackIdParts = [raw.name, raw.breed_visual || raw.breed, raw.type, raw.sex, raw.age_months ?? raw.age].filter(Boolean).map((v: any) => String(v).trim().toLowerCase()).join("|");
      idValue = fallbackIdParts ? `fallback-${fallbackIdParts}` : `fallback-${Math.random().toString(36).slice(2, 10)}`;
    }
    const normalizedPet: Pet = {
      id: idValue,
      type: raw.type === "cat" || raw.type === "dog" ? raw.type : "cat",
      breed_visual: raw.breed_visual || raw.breed || "",
      name: raw.name || "",
      sex: raw.sex || "",
      description: raw.description || "",
      size: raw.size || "",
      color: raw.color || "",
      sterilized: raw.sterilized ?? false,
      temperament_tags: temperamentTags,
      health_status: raw.health_status || "",
      medical_conditions: raw.medical_conditions || "",
      ideal_owner_tags: Array.isArray(raw.ideal_owner_tags) ? raw.ideal_owner_tags : [],
      photo_url: raw.photo_url || raw.imageUrl || "",
      monthly_cost: raw.monthly_cost ?? raw.estimatedCost ?? 0,
      status: raw.status || "available",
      age: raw.age,
      breed: raw.breed,
      temperament: raw.temperament,
      imageUrl: raw.imageUrl,
      estimatedCost: raw.estimatedCost,
      timeNeeded: raw.timeNeeded,
      costBreakdown: raw.costBreakdown,
    };
    if (typeof ageMonths === "number" && !Number.isNaN(ageMonths)) normalizedPet.age_months = Math.round(ageMonths);
    if (typeof raw.weight_kg === "number") normalizedPet.weight_kg = raw.weight_kg;
    return normalizedPet;
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

  const loadPets = useCallback(async () => {
    try {
      const data = await apiCall(`/pets?page=${currentPage}&per_page=${ITEMS_PER_PAGE}`, "GET", undefined, token || "");
      const serverPetsRaw: any[] = Array.isArray(data) ? data : (data.data || []);

      if (serverPetsRaw.length > 0) {
        // Дані з бекенду вже поділені на сторінки, просто нормалізуємо їх
        const normalized = serverPetsRaw.map(normalizePet).filter(p => !p.deleted_at);
        setPets(normalized);

        // Отримуємо загальну кількість для пагінації
        const totalCount = data.total || data.meta?.total || normalized.length;
        setTotalPages(Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE)));
      } else {
        // Фолбек на локальні дані (якщо бекенд пустий)
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        setPets(initialPets.slice(start, start + ITEMS_PER_PAGE));
        setTotalPages(Math.max(1, Math.ceil(initialPets.length / ITEMS_PER_PAGE)));
      }
    } catch (error) {
      console.error("Error loading pets:", error);
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      setPets(initialPets.slice(start, start + ITEMS_PER_PAGE));
      setTotalPages(Math.ceil(initialPets.length / ITEMS_PER_PAGE));
    }
  }, [currentPage, token]);

  const loadMyApplications = useCallback(async () => {
    try {
      const data = await apiCall("/applications/my", "GET", undefined, token || "");
      const rawApplications = Array.isArray(data) ? data : data.applications || [];
      setApplications(rawApplications.map(normalizeApplication));
    } catch (error) {
      console.error("Error loading applications:", error);
    }
  }, [token]);

  const loadAllApplications = useCallback(async () => {
    try {
      const data = await apiCall("/applications", "GET", undefined, token || "");
      const rawApplications = Array.isArray(data) ? data : data.applications || [];
      setAllApplications(rawApplications.map(normalizeApplication));
    } catch (error) {
      console.error("Error loading all applications:", error);
    }
  }, [token]);

  const loadPetDetails = useCallback(async (petId: string) => {
    try {
      if (petDetailAbortControllerRef.current) petDetailAbortControllerRef.current.abort();
      const controller = new AbortController();
      petDetailAbortControllerRef.current = controller;
      currentPetIdRef.current = petId;
      setSelectedPetForDetails(null);
      setIsDetailsOpen(true);
      setDetailsLoading(true);
      let petDetail: any = null;
      try {
        const data = await apiCall(`/pets/${petId}`, "GET", undefined, token || "", controller.signal);
        petDetail = data?.data || data;
      } catch (backendError) {
        if ((backendError as any)?.name === "AbortError") return;
        petDetail = initialPets.find(p => p.id === petId);
      }
      if (currentPetIdRef.current === petId && petDetail) setSelectedPetForDetails(normalizePet(petDetail));
    } catch (error) {
      console.error("Error loading pet details:", error);
    } finally {
      setDetailsLoading(false);
    }
  }, [token]);

  const handleOpenPetDetails = (petId: string) => {
    const pet = pets.find(p => p.id === petId);
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

  useEffect(() => { loadPets(); }, [loadPets]);
  useEffect(() => {
    if (token && user) {
      if (isAdmin) loadAllApplications();
      else loadMyApplications();
    }
  }, [token, user, isAdmin, loadMyApplications, loadAllApplications]);

  const handleLogin = async (email: string, pass: string) => {
    try {
      setAuthLoading(true); setAuthError("");
      await login(email, pass);
    } catch (error) {
      setAuthError("Невірні облікові дані");
    } finally { setAuthLoading(false); }
  };

  const handleRegister = async (email: string, pass: string, name: string) => {
    try {
      setAuthLoading(true); setAuthError("");
      await register(email, pass, name);
      setIsRegisterMode(false);
    } catch (error) {
      setAuthError("Помилка реєстрації");
    } finally { setAuthLoading(false); }
  };

  const handleTrialDay = (pet: Pet) => {
    if (!user) { setAuthError("Будь ласка, увійдіть"); return; }
    setSelectedPet(pet); setAdoptionType("trial");
  };

  const handleAdopt = (pet: Pet) => {
    if (!user) { setAuthError("Будь ласка, увійдіть"); return; }
    setSelectedPet(pet); setAdoptionType("adoption");
  };

  const handleFormSubmit = async (formData: AdoptionFormData) => {
    if (!selectedPet || !token) return;
    try {
      const payload = {
        pet_id: selectedPet.id,
        type: adoptionType === "trial" ? "trial_day" : "adoption",
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
      // petData приходить вже з правильними полями з нової форми
      await apiCall("/pets", "POST", petData, token);
      setShowAddPet(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      loadPets();
    } catch (error) {
      alert("Помилка при додаванні. Перевірте консоль для деталей.");
      console.error("Add Pet Error:", error);
    }
  };

  const handleUpdatePet = async (updated: any) => {
    if (!token) return;
    try {
      // Підготовка масивів тегів (якщо вони редагувалися як строка через кому)
      const parseTags = (tags: any) => {
        if (Array.isArray(tags)) return tags;
        if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
        return [];
      };

      const payload = {
        type: updated.type,
        name: updated.name,
        sex: updated.sex,
        description: updated.description,
        age_months: Number(updated.age_months) || 0,
        size: updated.size,
        weight_kg: updated.weight_kg ? Number(updated.weight_kg) : null,
        color: updated.color,
        sterilized: Boolean(updated.sterilized),
        temperament_tags: parseTags(updated.temperament_tags),
        health_status: updated.health_status,
        medical_conditions: updated.medical_conditions,
        ideal_owner_tags: parseTags(updated.ideal_owner_tags),
        breed_visual: updated.breed_visual,
        photo_url: updated.photo_url || updated.imageUrl,
        monthly_cost: Number(updated.monthly_cost) || 0,
        status: updated.status || "available"
      };

      await apiCall(`/pets/${updated.id}`, "PUT", payload, token);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      loadPets();
    } catch (error) {
      alert("Помилка при редагуванні.");
      console.error("Update Pet Error:", error);
    }
  };

  const handleDeletePet = async (petId: string) => {
    if (!token || !window.confirm("Ви впевнені?")) return;
    try {
      await apiCall(`/pets/${petId}`, "DELETE", undefined, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadPets();
    } catch (error) { alert("Помилка при видаленні"); }
  };



  const handleApproveApplication = async (appId: string) => {
    if (!token) return;
    try {
      await apiCall(`/applications/${appId}/approve`, "PATCH", {}, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadAllApplications();
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
      await apiCall(`/pets/${petId}/return`, "PATCH", {}, token);
      setShowToast(true); setTimeout(() => setShowToast(false), 3000);
      loadPets();
    } catch (error) { alert("Помилка при поверненні"); }
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

  if (loading) return <div className="flex items-center justify-center min-h-screen">Завантаження...</div>;

  return (
    <div className="min-h-screen bg-amber-50">
      <header className="bg-white border-b border-amber-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-amber-900">AdoptMe Dnipro</h1>
            <p className="text-xs text-slate-500">DniproAnimals Shelter {isAdmin && <span className="text-emerald-600 font-bold ml-2">Адмін</span>}</p>
          </div>
          <div className="flex items-center gap-4">
            <Button className="bg-emerald-600 text-white" onClick={() => setShowDonateModal(true)}>Задонатити 💛</Button>
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
            <h2 className="text-lg font-semibold text-amber-900 mb-4">{isRegisterMode ? "Реєстрація" : "Вхід"}</h2>
            <div className="space-y-4">
              {isRegisterMode && <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Ім'я" className="w-full border rounded-lg px-3 py-2" />}
              <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
              <input value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="Пароль" type="password" className="w-full border rounded-lg px-3 py-2" />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <div className="flex gap-2">
                <Button onClick={() => isRegisterMode ? handleRegister(authEmail, authPassword, authName) : handleLogin(authEmail, authPassword)} disabled={authLoading} className="flex-1 bg-amber-600">{authLoading ? "..." : isRegisterMode ? "Зареєструватися" : "Увійти"}</Button>
                <Button variant="outline" onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthError(""); }} className="flex-1">{isRegisterMode ? "Вхід" : "Реєстрація"}</Button>
              </div>
            </div>
          </div>
        )}

        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {!isAdmin ? (
                <>
                  <Matchmaker pets={pets} onMatch={handleAdopt} onAiFilter={(ids) => setAiFilteredPetIds(ids.length > 0 ? ids : null)} />
                  {applications.length > 0 ? (
                    <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm animate-fade-in">
                      <h3 className="text-lg font-semibold text-amber-900 mb-3">Мої заявки</h3>
                      <div className="space-y-3">
                        {applications.map(app => (
                          <div key={app.id} className="p-3 rounded-lg border border-amber-100 bg-amber-50/50 flex justify-between items-start shadow-sm">
                            <div>
                              <p className="text-sm font-bold text-amber-900">{app.pet_name || "Тваринка"}</p>
                              <p className="text-[10px] text-slate-500">📅 {app.booking_date} {app.booking_time}</p>
                              <p className="text-xs mt-1">
                                Статус:
                                <span className={`ml-1 font-medium ${app.status === "approved" ? "text-emerald-600" :
                                  app.status === "rejected" ? "text-red-500" : "text-amber-600"
                                  }`}>
                                  {app.status === "pending" ? "Очікування" :
                                    app.status === "approved" ? "Схвалено" : "Відхилено"}
                                </span>
                              </p>
                            </div>
                            {/* Кнопка видалення/скасування заявки */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteApplication(app.id)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 h-auto"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-6 border border-amber-200 text-center">
                      <p className="text-sm text-slate-500">У вас поки немає поданих заявок.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* ПУНКТ 1: Оновлений блок заявок для адміна */}
                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-amber-900 mb-3">Заявки (Очікують)</h3>
                    {allApplications.filter(app => app.status === 'pending').length > 0 ? (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {allApplications.filter(app => app.status === 'pending').map(app => (
                          <div key={app.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50 shadow-sm transition-all">
                            <div
                              className="flex justify-between items-center cursor-pointer"
                              onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                            >
                              <div>
                                <p className="font-bold text-amber-900">{app.pet_name}</p>
                                <p className="text-xs text-slate-600">Від: {app.user_name || app.full_name}</p>
                              </div>
                              <div className="bg-white p-1 rounded-full shadow-sm">
                                {expandedAppId === app.id ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
                              </div>
                            </div>

                            {expandedAppId === app.id && (
                              <div className="mt-3 pt-3 border-t border-amber-200 text-sm space-y-2 animate-fade-in">
                                <p>📞 {app.phone}</p>
                                <p>🏠 {app.address}</p>
                                <p>📅 {app.booking_date} {app.booking_time}</p>
                                <p>Тип: <span className="font-semibold">{app.type === 'trial_day' ? 'Тестовий день' : 'Усиновлення'}</span></p>
                                <p>👨‍👩‍👧‍👦 Діти: {app.has_children ? "Так" : "Ні"} | 🐾 Тварини: {app.has_other_pets ? "Так" : "Ні"}</p>

                                <div className="flex gap-2 mt-4">
                                  <Button size="sm" onClick={() => handleApproveApplication(app.id)} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700">Погодити</Button>
                                  <Button size="sm" variant="outline" onClick={() => handleRejectApplication(app.id)} className="flex-1 text-red-600 border-red-300 hover:bg-red-50">Відхилити</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-slate-500">Немає нових заявок.</p>}
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-amber-900 mb-3">На тріалі</h3>
                    <div className="space-y-2">
                      {pets.filter(p => p.status === "trial").map(pet => (
                        <div key={pet.id} className="flex items-center justify-between p-2 border rounded bg-amber-50">
                          <span className="text-sm">{pet.name}</span>
                          <Button size="sm" variant="outline" onClick={() => handleReturnPetFromTrial(pet.id)}>Повернути</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-amber-900">Наші улюбленці</h2>
                {isAdmin && (
                  <Button onClick={() => setShowAddPet(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Додати тварину
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {(aiFilteredPetIds ? pets.filter(pet => aiFilteredPetIds.includes(pet.id)) : pets).map((pet) => (
                  <PetCard key={pet.id} pet={pet} onTrialDay={handleTrialDay} onAdopt={handleAdopt} onSelect={handleOpenPetDetails} isAdmin={isAdmin} onDelete={handleDeletePet} onEdit={setEditingPet} />
                ))}
              </div>
              <div className="flex justify-between mt-8">
                <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm">Сторінка {currentPage} з {totalPages}</span>
                <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ПУНКТ 3: Модальне вікно тваринки з режимом редагування */}
        {isDetailsOpen && selectedPetForDetails && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              {/* Хедер модалки */}
              <div className="flex justify-between items-center p-4 border-b bg-amber-50">
                <h3 className="text-xl font-bold text-amber-900 w-1/2">
                  {isEditingDetails ? (
                    <input className="border border-amber-300 rounded-lg px-3 py-1.5 w-full bg-white" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Ім'я" />
                  ) : (
                    selectedPetForDetails.name
                  )}
                </h3>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      {isEditingDetails ? (
                        <>
                          <Button size="sm" className="bg-emerald-600 text-white" onClick={handleSaveDetails}>Зберегти</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingDetails(false)}>Скасувати</Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300" onClick={() => setIsEditingDetails(true)}>Редагувати</Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => {
                            handleDeletePet(selectedPetForDetails.id);
                            setIsDetailsOpen(false);
                          }}>Видалити</Button>
                        </>
                      )}
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setIsDetailsOpen(false)}><X className="w-5 h-5 text-slate-500" /></Button>
                </div>
              </div>

              {/* Тіло модалки */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                {/* Фото */}
                <div className="space-y-4">
                  <img src={isEditingDetails ? (editForm.photo_url || editForm.imageUrl) : (selectedPetForDetails.photo_url || selectedPetForDetails.imageUrl)} className="w-full h-72 object-cover rounded-xl shadow-sm" alt="pet" />
                  {isEditingDetails && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-amber-900">URL Фото:</label>
                      <input className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm" placeholder="https://..." value={editForm.photo_url || editForm.imageUrl || ''} onChange={e => setEditForm({ ...editForm, photo_url: e.target.value, imageUrl: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* Інформація */}
                <div className="space-y-4 text-sm text-slate-700">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                    {/* Основне */}
                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Тип:</span>
                      {isEditingDetails ? (
                        <select className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.type || ''} onChange={e => setEditForm({ ...editForm, type: e.target.value as 'cat' | 'dog' })}>
                          <option value="cat">Кіт</option>
                          <option value="dog">Собака</option>
                        </select>
                      ) : <span>{selectedPetForDetails.type === 'cat' ? 'Кіт' : 'Собака'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Порода:</span>
                      {isEditingDetails ? <input className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.breed_visual || ''} onChange={e => setEditForm({ ...editForm, breed_visual: e.target.value })} /> : <span>{selectedPetForDetails.breed_visual || 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Стать:</span>
                      {isEditingDetails ? (
                        <select className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.sex || ''} onChange={e => setEditForm({ ...editForm, sex: e.target.value })}>
                          <option value="Хлопчик">Хлопчик</option>
                          <option value="Дівчинка">Дівчинка</option>
                          <option value="Невідомо">Невідомо</option>
                        </select>
                      ) : <span>{selectedPetForDetails.sex || 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Вік (міс.):</span>
                      {isEditingDetails ? <input type="number" className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.age_months || ''} onChange={e => setEditForm({ ...editForm, age_months: parseInt(e.target.value) })} /> : <span>{selectedPetForDetails.age_months} міс.</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Розмір:</span>
                      {isEditingDetails ? (
                        <select className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.size || ''} onChange={e => setEditForm({ ...editForm, size: e.target.value })}>
                          <option value="Малий">Малий</option>
                          <option value="Середній">Середній</option>
                          <option value="Великий">Великий</option>
                        </select>
                      ) : <span>{selectedPetForDetails.size || 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Вага (кг):</span>
                      {isEditingDetails ? <input type="number" step="0.1" className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.weight_kg || ''} onChange={e => setEditForm({ ...editForm, weight_kg: parseFloat(e.target.value) })} /> : <span>{selectedPetForDetails.weight_kg ? `${selectedPetForDetails.weight_kg} кг` : 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Окрас:</span>
                      {isEditingDetails ? <input className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.color || ''} onChange={e => setEditForm({ ...editForm, color: e.target.value })} /> : <span>{selectedPetForDetails.color || 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Стерилізація:</span>
                      {isEditingDetails ? (
                        <label className="flex items-center mt-2 cursor-pointer">
                          <input type="checkbox" className="mr-2 w-4 h-4" checked={editForm.sterilized || false} onChange={e => setEditForm({ ...editForm, sterilized: e.target.checked })} />
                          Так
                        </label>
                      ) : <span>{selectedPetForDetails.sterilized ? 'Так' : 'Ні'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Витрати:</span>
                      {isEditingDetails ? <input type="number" className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1" value={editForm.monthly_cost || ''} onChange={e => setEditForm({ ...editForm, monthly_cost: parseInt(e.target.value) })} /> : <span>{selectedPetForDetails.monthly_cost || 0} грн/міс</span>}
                    </div>
                  </div>

                  {/* Медичні дані та теги */}
                  <div className="pt-3 border-t border-amber-100 space-y-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Стан здоров'я:</span>
                      {isEditingDetails ? <input className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1 w-full" value={editForm.health_status || ''} onChange={e => setEditForm({ ...editForm, health_status: e.target.value })} /> : <span>{selectedPetForDetails.health_status || 'Без відхилень'}</span>}
                    </div>

                    {isEditingDetails ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-amber-900">Медичні показання:</span>
                        <textarea className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1 resize-none" rows={2} value={editForm.medical_conditions || ''} onChange={e => setEditForm({ ...editForm, medical_conditions: e.target.value })} />
                      </div>
                    ) : selectedPetForDetails.medical_conditions && (
                      <div className="flex flex-col">
                        <span className="font-semibold text-amber-900">Медичні показання:</span>
                        <span>{selectedPetForDetails.medical_conditions}</span>
                      </div>
                    )}

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Характер (теги через кому):</span>
                      {isEditingDetails ? (
                        <input className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1 w-full" placeholder="грайливий, спокійний" value={Array.isArray(editForm.temperament_tags) ? editForm.temperament_tags.join(', ') : (editForm.temperament_tags || '')} onChange={e => setEditForm({ ...editForm, temperament_tags: e.target.value as any })} />
                      ) : <span>{Array.isArray(selectedPetForDetails.temperament_tags) && selectedPetForDetails.temperament_tags.length > 0 ? selectedPetForDetails.temperament_tags.join(', ') : 'Не вказано'}</span>}
                    </div>

                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-900">Ідеальний власник (теги через кому):</span>
                      {isEditingDetails ? (
                        <input className="border border-amber-200 rounded-lg px-2 py-1.5 mt-1 w-full" placeholder="без дітей, активний" value={Array.isArray(editForm.ideal_owner_tags) ? editForm.ideal_owner_tags.join(', ') : (editForm.ideal_owner_tags || '')} onChange={e => setEditForm({ ...editForm, ideal_owner_tags: e.target.value as any })} />
                      ) : <span>{Array.isArray(selectedPetForDetails.ideal_owner_tags) && selectedPetForDetails.ideal_owner_tags.length > 0 ? selectedPetForDetails.ideal_owner_tags.join(', ') : 'Не вказано'}</span>}
                    </div>
                  </div>

                  {/* Опис */}
                  <div className="flex flex-col pt-3 border-t border-amber-100">
                    <span className="font-semibold text-amber-900 mb-1">Опис:</span>
                    {isEditingDetails ? (
                      <textarea rows={5} className="border border-amber-200 rounded-lg px-3 py-2 resize-none w-full" value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                    ) : (
                      <p className="leading-relaxed whitespace-pre-wrap">{selectedPetForDetails.description}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        )
        }


      </main >

      {selectedPet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-4 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">{adoptionType === "trial" ? "Тріал" : "Усиновлення"}</h3><Button variant="ghost" onClick={() => setSelectedPet(null)}><X className="w-4 h-4" /></Button></div>
            <AdoptionForm pet={selectedPet} adoptionType={adoptionType} onSubmit={handleFormSubmit} onCancel={() => setSelectedPet(null)} />
          </div>
        </div>
      )}

      {showToast && <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-in slide-in-from-right">Успішно!</div>}
      {
        showDonateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Донат</h3><Button variant="ghost" onClick={() => setShowDonateModal(false)}><X className="w-4 h-4" /></Button></div>
              <div className="space-y-4">
                <input type="number" value={donateAmount} onChange={(e) => setDonateAmount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
                <Button className="w-full bg-emerald-600 text-white" onClick={handleDonate} disabled={isDonating}>{isDonating ? "..." : "Сплатити"}</Button>
              </div>
            </div>
          </div>
        )
      }
      {
        showAddPet && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <AddPetForm onSubmit={handleAddPet} onCancel={() => setShowAddPet(false)} />
            </div>
          </div>
        )
      }
      <footer className="bg-white border-t mt-16 py-8 text-center text-slate-600 text-xs">© 2026 AdoptMe Dnipro.</footer>
    </div >
  );
}

function App() { return (<AuthProvider><AppContent /></AuthProvider>); }
export default App;
