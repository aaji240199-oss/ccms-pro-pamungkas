import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// --- INISIALISASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAFCc-J03dzOYyl30_waMd25iF4-gVh7rk",
  authDomain: "ccms-pro-by-pamungkas.firebaseapp.com",
  projectId: "ccms-pro-by-pamungkas",
  storageBucket: "ccms-pro-by-pamungkas.firebasestorage.app",
  messagingSenderId: "69936221641",
  appId: "1:69936221641:web:64a6aaa1f8dfc7a580ec18",
  measurementId: "G-EEVR3N4EC3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cmms-pabrik-saya';

export default function App() {
  // --- STATES: SISTEM & UI ---
  const [fbUser, setFbUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dialog, setDialog] = useState(null);

  // --- STATES: DATABASE ---
  const [factories, setFactories] = useState([]);
  const [users, setUsers] = useState([]);
  const [machines, setMachines] = useState([]);
  const [dailyParams, setDailyParams] = useState([]);
  const [dailyChecks, setDailyChecks] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);
  const [pmSchedules, setPmSchedules] = useState([]);
  const [pmParams, setPmParams] = useState([]);
  const [dailyActivities, setDailyActivities] = useState([]);
  
  // --- STATES: SPAREPART ---
  const [spareparts, setSpareparts] = useState([]);
  const [sparepartLogs, setSparepartLogs] = useState([]);
  const [sparepartRequests, setSparepartRequests] = useState([]);

  // --- EFFECT: LOAD FONTAWESOME & FIREBASE AUTH ---
  useEffect(() => {
    // Inject FontAwesome
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);

    // Init Auth
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // --- EFFECT: SINKRONISASI DATABASE (REAL-TIME) ---
  useEffect(() => {
    if (!fbUser) return;

    const getPath = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
    const handleSnap = (setter) => (snap) => setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    const handleErr = (err) => console.error("DB Sync Error:", err);

    const unsubFactories = onSnapshot(getPath('cmms_factories'), handleSnap(setFactories), handleErr);
    const unsubUsers = onSnapshot(getPath('cmms_users'), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsDbLoaded(true);
    }, handleErr);
    const unsubMachines = onSnapshot(getPath('cmms_machines'), handleSnap(setMachines), handleErr);
    const unsubDailyParams = onSnapshot(getPath('cmms_dailyParams'), handleSnap(setDailyParams), handleErr);
    const unsubDailyChecks = onSnapshot(getPath('cmms_dailyChecks'), handleSnap(setDailyChecks), handleErr);
    const unsubBreakdowns = onSnapshot(getPath('cmms_breakdowns'), handleSnap(setBreakdowns), handleErr);
    const unsubPmSchedules = onSnapshot(getPath('cmms_pmSchedules'), handleSnap(setPmSchedules), handleErr);
    const unsubPmParams = onSnapshot(getPath('cmms_pmParams'), handleSnap(setPmParams), handleErr);
    const unsubDailyActivities = onSnapshot(getPath('cmms_dailyActivities'), handleSnap(setDailyActivities), handleErr);
    const unsubSpareparts = onSnapshot(getPath('cmms_spareparts'), handleSnap(setSpareparts), handleErr);
    const unsubSparepartLogs = onSnapshot(getPath('cmms_sparepart_logs'), handleSnap(setSparepartLogs), handleErr);
    const unsubSparepartRequests = onSnapshot(getPath('cmms_sparepart_requests'), handleSnap(setSparepartRequests), handleErr);

    return () => {
      unsubFactories(); unsubUsers(); unsubMachines(); unsubDailyParams();
      unsubDailyChecks(); unsubBreakdowns(); unsubPmSchedules(); unsubPmParams(); unsubDailyActivities();
      unsubSpareparts(); unsubSparepartLogs(); unsubSparepartRequests();
    };
  }, [fbUser]);

  // --- HELPER FUNCTIONS ---
  const showMessage = (title, message, type = 'info') => setDialog({ title, message, type, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setDialog({ title, message, type: 'confirm', onConfirm });
  const colRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
  const docRef = (colName, id) => doc(db, 'artifacts', appId, 'public', 'data', colName, id);

  const getAvailableMachines = () => {
    if (currentUser?.role === 'admin' || currentUser?.factory === 'All') return machines;
    return machines.filter(m => m.factory === currentUser?.factory);
  };

  const seedDatabase = async () => {
    try {
      await addDoc(colRef('cmms_factories'), { name: 'Pabrik A' });
      await addDoc(colRef('cmms_factories'), { name: 'Pabrik B' });
      await addDoc(colRef('cmms_users'), { username: 'admin', password: '123', role: 'admin', name: 'Budi (Supervisor)', factory: 'All' });
      await addDoc(colRef('cmms_users'), { username: 'tek_a', password: '123', role: 'teknisi', name: 'Andi (Teknisi A)', factory: 'Pabrik A' });
      await addDoc(colRef('cmms_users'), { username: 'prod_a', password: '123', role: 'user', name: 'Siti (Produksi A)', factory: 'Pabrik A' });
      showMessage('Berhasil', 'Database awal berhasil dibuat! Silakan login dengan akun: admin / 123', 'success');
    } catch (e) {
      showMessage('Error', 'Gagal membuat database awal.', 'error');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const u = e.target.username.value;
    const p = e.target.password.value;
    const foundUser = users.find(x => x.username === u && x.password === p);
    if (foundUser) {
      setCurrentUser(foundUser);
      setActiveMenu('dashboard');
    } else {
      showMessage('Gagal Login', 'Username atau password salah!', 'error');
    }
  };

  const handleLogout = () => setCurrentUser(null);

  // --- KOMPONEN UI ---
  const ModalDialog = () => {
    if (!dialog) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-[fadeIn_0.2s_ease-in-out]">
          <h3 className={`text-lg font-bold mb-2 ${dialog.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{dialog.title}</h3>
          <p className="text-gray-600 mb-6 text-sm">{dialog.message}</p>
          <div className="flex justify-end gap-3">
            {dialog.type === 'confirm' && (
              <button onClick={() => setDialog(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300">Batal</button>
            )}
            <button 
              onClick={() => { if (dialog.onConfirm) dialog.onConfirm(); setDialog(null); }} 
              className={`px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {dialog.type === 'confirm' ? 'Ya, Eksekusi' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        <ModalDialog />
        <div className="bg-white p-8 rounded-xl shadow-xl w-96 z-10 border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"><i className="fa-solid fa-gear text-white text-3xl"></i></div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">CMMS System</h2>
          <p className="text-gray-500 text-center mb-6 text-sm">Sistem Manajemen Pemeliharaan</p>
          
          {!isDbLoaded ? (
             <p className="text-center text-blue-600 font-bold p-4 animate-pulse">Menghubungkan ke Database...</p>
          ) : users.length === 0 ? (
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-yellow-800 text-sm mb-3 font-bold">Database masih kosong!</p>
              <button onClick={seedDatabase} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-blue-700">Setup Database Awal</button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input type="text" name="username" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" defaultValue="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input type="password" name="password" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" defaultValue="" />
              </div>
              <button type="submit" className="w-full flex justify-center py-3 px-4 rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Masuk Sistem</button>
            </form>
          )}
          
          <div className="mt-6 text-xs text-gray-600 text-center space-y-1 p-3 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
            <p className="font-bold text-gray-800 border-b pb-1 mb-1">Aplikasi V.1 By Pamungkas</p>
          </div>
        </div>
      </div>
    );
  }

  const Dashboard = () => {
    const availableMachines = getAvailableMachines();
    const openBreakdowns = breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId));
    const resolvedBreakdowns = breakdowns.filter(b => b.status === 'Selesai Diperbaiki' && availableMachines.find(m => m.id === b.machineId));
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Utama</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center hover:shadow-md transition-shadow">
            <div className="bg-blue-100 p-3 rounded-full mr-4"><i className="fa-solid fa-industry text-blue-600 text-xl w-6 text-center"></i></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Mesin</p>
              <p className="text-2xl font-bold text-gray-800">{availableMachines.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500 flex items-center hover:shadow-md transition-shadow">
            <div className="bg-red-100 p-3 rounded-full mr-4"><i className="fa-solid fa-triangle-exclamation text-red-600 text-xl w-6 text-center"></i></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Request Pending</p>
              <p className="text-2xl font-bold text-gray-800">{openBreakdowns.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500 flex items-center hover:shadow-md transition-shadow">
            <div className="bg-indigo-100 p-3 rounded-full mr-4"><i className="fa-solid fa-wrench text-indigo-600 text-xl w-6 text-center"></i></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Mesin Diperbaiki</p>
              <p className="text-2xl font-bold text-gray-800">{resolvedBreakdowns.length}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center hover:shadow-md transition-shadow">
            <div className="bg-green-100 p-3 rounded-full mr-4"><i className="fa-solid fa-calendar-check text-green-600 text-xl w-6 text-center"></i></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Jadwal PM (Total)</p>
              <p className="text-2xl font-bold text-gray-800">{pmSchedules.filter(s => availableMachines.find(m => m.id === s.machineId)).length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-white p-6 rounded-xl shadow-sm mb-6 border border-blue-100">
          <h3 className="text-lg font-semibold mb-1 text-blue-900">Selamat Datang, {currentUser.name}</h3>
          <p className="text-gray-600 text-sm">Anda login sebagai <strong>{currentUser.role.toUpperCase()}</strong>. Lingkup operasional: <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-bold">{currentUser.factory}</span>.</p>
        </div>

        {currentUser.role === 'admin' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2"><i className="fa-solid fa-desktop mr-2 text-gray-500"></i> Panel Monitoring Admin</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* RINCIAN REQUEST PENDING */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100">
                <h4 className="font-bold text-red-700 mb-4 flex items-center"><i className="fa-solid fa-triangle-exclamation mr-2"></i> Permintaan Perbaikan (Pending)</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {openBreakdowns.length > 0 ? openBreakdowns.slice().reverse().map(b => {
                    const machine = machines.find(m => m.id === b.machineId);
                    return (
                      <div key={b.id} className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm shadow-sm relative">
                        <div className="flex justify-between font-bold text-gray-800 mb-2 border-b border-red-100 pb-2">
                          <span>{machine?.name} <span className="text-gray-500 font-normal">({machine?.factory})</span></span>
                          <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full whitespace-nowrap">Open</span>
                        </div>
                        <div className="mb-2">
                           <p className="text-xs text-gray-500 mb-1">Requested by: <span className="font-bold text-gray-800">{b.requestBy || b.reportedBy || 'Unknown'}</span></p>
                           <p className="text-gray-700 bg-white p-2 border border-red-100 rounded italic text-xs">"{b.description}"</p>
                        </div>
                        <div className="text-[10px] text-gray-500 flex justify-between border-t border-red-200 pt-2">
                          <span><i className="fa-solid fa-clock mr-1"></i> Tgl Lapor: {b.date}</span>
                        </div>
                      </div>
                    )
                  }) : <p className="text-sm text-gray-500 italic text-center py-8 border border-dashed rounded-lg">Tidak ada permintaan perbaikan pending.</p>}
                </div>
              </div>

              {/* RINCIAN PERBAIKAN SELESAI */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100">
                <h4 className="font-bold text-indigo-700 mb-4 flex items-center"><i className="fa-solid fa-circle-check mr-2"></i> Perbaikan Dikerjakan (Terbaru)</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {resolvedBreakdowns.length > 0 ? resolvedBreakdowns.slice().reverse().map(b => {
                    const machine = machines.find(m => m.id === b.machineId);
                    return (
                      <div key={b.id} className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg text-sm shadow-sm">
                        <div className="flex justify-between font-bold text-gray-800 mb-2 border-b border-indigo-200 pb-2">
                          <span>{machine?.name} <span className="text-gray-500 font-normal">({machine?.factory})</span></span>
                          <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full whitespace-nowrap">Selesai</span>
                        </div>
                        
                        <div className="mb-3 grid grid-cols-2 gap-2 text-xs border-b border-indigo-100 pb-2">
                          <div>
                            <span className="text-gray-500 block">Pelapor/Request:</span>
                            <span className="font-bold text-gray-800"><i className="fa-solid fa-user text-gray-400 mr-1"></i> {b.requestBy || b.reportedBy || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block">Diperbaiki Oleh (Teknisi):</span>
                            <span className="font-bold text-indigo-700"><i className="fa-solid fa-user-wrench mr-1"></i> {b.resolvedBy}</span>
                          </div>
                        </div>

                        <p className="text-gray-700 mb-1"><span className="font-semibold text-xs text-gray-500 block uppercase">Tindakan Perbaikan:</span> <span className="font-medium bg-white px-2 py-1 block rounded border border-indigo-100 mt-1">{b.analysis}</span></p>
                        <p className="text-gray-700 mb-3 mt-2"><span className="font-semibold text-xs text-gray-500 block uppercase">Part Diganti:</span> <span className="font-medium">{b.partsReplaced || '-'}</span></p>
                        
                        <div className="text-[11px] text-gray-600 flex justify-between items-end pt-2 border-t border-indigo-200">
                          <span>Durasi Pengerjaan:</span>
                          <span className="text-right font-bold text-indigo-800">{b.startTime?.split(' ')[0]} <br/> {b.startTime?.split(' ')[1]} s/d {b.endTime?.split(' ')[1]}</span>
                        </div>
                      </div>
                    )
                  }) : <p className="text-sm text-gray-500 italic text-center py-8 border border-dashed rounded-lg">Belum ada perbaikan yang diselesaikan.</p>}
                </div>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100">
              <h4 className="font-bold text-blue-700 mb-4 flex items-center"><i className="fa-solid fa-list-check mr-2"></i> Daily Activity Teknisi (Monitoring)</h4>
              <div className="overflow-x-auto rounded-lg border border-blue-200">
                <table className="w-full text-sm border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-blue-100 text-left">
                      <th className="p-3 font-semibold text-blue-900">Tanggal</th>
                      <th className="p-3 font-semibold text-blue-900">Teknisi</th>
                      <th className="p-3 font-semibold text-blue-900">Pabrik</th>
                      <th className="p-3 font-semibold text-blue-900">Aktivitas / Pekerjaan Tambahan</th>
                      <th className="p-3 font-semibold text-blue-900">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {dailyActivities.slice().reverse().map(act => (
                      <tr key={act.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 whitespace-nowrap text-gray-600">{act.date}</td>
                        <td className="p-3 font-semibold text-gray-800">{act.teknisi}</td>
                        <td className="p-3"><span className="text-[10px] uppercase font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded">{act.factory}</span></td>
                        <td className="p-3 text-gray-700">{act.activity}</td>
                        <td className="p-3 whitespace-nowrap text-gray-500 font-medium"><i className="fa-solid fa-clock text-gray-400 mr-1"></i> {act.startTime} - {act.endTime}</td>
                      </tr>
                    ))}
                    {dailyActivities.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500 italic border-t border-dashed">Belum ada catatan aktivitas harian teknisi.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const AdminKelolaPabrik = () => {
    const [newFactory, setNewFactory] = useState('');
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState('');

    const handleAdd = async (e) => {
      e.preventDefault();
      if(!newFactory) return;
      await addDoc(colRef('cmms_factories'), { name: newFactory });
      setNewFactory('');
      showMessage('Berhasil', 'Pabrik baru berhasil ditambahkan.', 'success');
    };

    const handleSaveEdit = (id, oldName) => {
      if(!editName) return;
      showConfirm('Konfirmasi Perubahan', `Ubah nama pabrik dari "${oldName}" menjadi "${editName}"? Ini otomatis memperbarui lokasi semua User dan Mesin yang terkait.`, async () => {
        await updateDoc(docRef('cmms_factories', id), { name: editName });
        users.filter(u => u.factory === oldName).forEach(async u => await updateDoc(docRef('cmms_users', u.id), { factory: editName }));
        machines.filter(m => m.factory === oldName).forEach(async m => await updateDoc(docRef('cmms_machines', m.id), { factory: editName }));
        setEditId(null);
        showMessage('Diperbarui', 'Nama pabrik berhasil diubah beserta relasinya.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Pabrik (Lokasi)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm h-fit">
            <h3 className="font-semibold text-lg mb-4 text-gray-800"><i className="fa-solid fa-industry text-blue-500 mr-2"></i> Tambah Pabrik</h3>
            <form onSubmit={handleAdd} className="flex gap-2">
              <input type="text" placeholder="Masukkan Nama Pabrik Baru" required className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newFactory} onChange={e => setNewFactory(e.target.value)} />
              <button type="submit" className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm">Tambah</button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Daftar Pabrik Terdaftar</h3>
            <ul className="space-y-3">
              {factories.map(f => (
                <li key={f.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
                  {editId === f.id ? (
                    <div className="flex flex-1 gap-2 mr-2">
                      <input type="text" className="flex-1 border p-2 rounded text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                      <button onClick={() => handleSaveEdit(f.id, f.name)} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-bold shadow-sm">Simpan</button>
                      <button onClick={() => setEditId(null)} className="bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm font-bold">Batal</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center"><div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3"><i className="fa-solid fa-building"></i></div><span className="font-semibold text-gray-800 text-lg">{f.name}</span></div>
                      <button onClick={() => {setEditId(f.id); setEditName(f.name)}} className="text-gray-400 hover:text-blue-600 bg-white p-2 border rounded shadow-sm"><i className="fa-solid fa-pen-to-square"></i></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const AdminKelolaUser = () => {
    const defaultFactory = factories[0]?.name || '';
    const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'user', name: '', factory: defaultFactory });
    const [isEditing, setIsEditing] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      const { id, ...dataToSave } = formData;
      if (isEditing) {
        await updateDoc(docRef('cmms_users', id), dataToSave);
        setIsEditing(false);
        showMessage('Diperbarui', 'Data pengguna berhasil diupdate.', 'success');
      } else {
        await addDoc(colRef('cmms_users'), dataToSave);
        showMessage('Ditambahkan', 'Pengguna baru berhasil dibuat.', 'success');
      }
      setFormData({ id: null, username: '', password: '', role: 'user', name: '', factory: defaultFactory });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Pengguna (Akun)</h2>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm xl:col-span-1 h-fit border-t-4 border-blue-500">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 flex items-center">
              <i className={`fa-solid ${isEditing ? 'fa-user-pen' : 'fa-user-plus'} mr-2 text-blue-500`}></i> {isEditing ? 'Edit Informasi User' : 'Buat User Baru'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Nama Lengkap</label>
                <input type="text" required className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Username</label>
                  <input type="text" required className="w-full border p-2 rounded-lg bg-gray-50" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Password</label>
                  <input type="text" required className="w-full border p-2 rounded-lg bg-gray-50" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Hak Akses</label>
                  <select className="w-full border p-2 rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="user">User Produksi</option>
                    <option value="teknisi">Teknisi</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lokasi Pabrik</label>
                  <select className="w-full border p-2 rounded-lg" value={formData.factory} onChange={e => setFormData({...formData, factory: e.target.value})}>
                    <option value="All">Semua</option>
                    {factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold shadow-sm flex-1">{isEditing ? 'Simpan' : 'Buat Akun'}</button>
                {isEditing && <button type="button" onClick={() => {setIsEditing(false); setFormData({ id: null, username: '', password: '', role: 'user', name: '', factory: defaultFactory })}} className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-bold">Batal</button>}
              </div>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm xl:col-span-2 overflow-hidden flex flex-col">
            <h3 className="font-semibold text-lg mb-4 text-gray-800">Daftar Pengguna Sistem</h3>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 border-b font-semibold text-gray-700 rounded-tl-lg">Nama Lengkap</th>
                    <th className="p-3 border-b font-semibold text-gray-700">Akun Login</th>
                    <th className="p-3 border-b font-semibold text-gray-700">Role</th>
                    <th className="p-3 border-b font-semibold text-gray-700">Lokasi</th>
                    <th className="p-3 border-b font-semibold text-gray-700 text-center rounded-tr-lg">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-blue-50">
                      <td className="p-3 font-semibold text-gray-800">{u.name}</td>
                      <td className="p-3 text-gray-600"><span className="bg-gray-100 px-2 py-1 rounded text-xs border"><i className="fa-solid fa-user-shield text-gray-400 mr-1"></i>{u.username}</span></td>
                      <td className="p-3"><span className={`px-2 py-1 rounded text-[10px] uppercase font-bold shadow-sm ${u.role==='admin' ? 'bg-purple-600 text-white' : u.role==='teknisi' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>{u.role}</span></td>
                      <td className="p-3 text-gray-700">{u.factory}</td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => {setFormData(u); setIsEditing(true);}} className="text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-200"><i className="fa-solid fa-pen-to-square"></i> Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AdminKelolaMesin = () => {
    const defaultFactory = factories[0]?.name || '';
    const [newMachine, setNewMachine] = useState({ code: '', name: '', location: '', factory: defaultFactory });
    const [selectedMachineParams, setSelectedMachineParams] = useState(null);
    const [tempParams, setTempParams] = useState([]);
    const [newParamText, setNewParamText] = useState('');

    const handleAddMachine = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_machines'), newMachine);
      setNewMachine({ code: '', name: '', location: '', factory: defaultFactory });
      showMessage('Sukses', 'Mesin baru berhasil ditambahkan.', 'success');
    };

    const handleDeleteMachine = (mId, mName) => {
      showConfirm('Hapus Mesin', `Apakah Anda yakin ingin menghapus mesin ${mName}? Data mesin ini akan dihapus permanen.`, async () => {
        await deleteDoc(docRef('cmms_machines', mId));
        showMessage('Dihapus', `Data mesin ${mName} berhasil dihapus dari Database.`, 'success');
        if(selectedMachineParams === mId) setSelectedMachineParams(null);
      });
    };

    const handleSelectMachineParams = (mId) => {
      setSelectedMachineParams(mId);
      setTempParams(dailyParams.filter(p => p.machineId === mId).map(p => p.name));
    };

    const handleSaveChanges = async () => {
      const oldParams = dailyParams.filter(p => p.machineId === selectedMachineParams);
      for(const op of oldParams) await deleteDoc(docRef('cmms_dailyParams', op.id));
      for(const name of tempParams) {
        await addDoc(colRef('cmms_dailyParams'), { machineId: selectedMachineParams, name: name, type: 'boolean' });
      }
      showMessage('Tersimpan', 'Parameter berhasil disimpan secara batch ke Database.', 'success');
      setSelectedMachineParams(null);
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Mesin & Master Parameter</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 border-b pb-2"><i className="fa-solid fa-server text-blue-500 mr-2"></i> Tambah Inventaris Mesin</h3>
            <form onSubmit={handleAddMachine} className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex gap-3">
                <div className="w-1/3">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Kode Mesin</label>
                  <input type="text" required className="w-full border p-2 rounded" value={newMachine.code} onChange={e => setNewMachine({...newMachine, code: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Nama Mesin</label>
                  <input type="text" required className="w-full border p-2 rounded" value={newMachine.name} onChange={e => setNewMachine({...newMachine, name: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Lokasi Detail</label>
                  <input type="text" required className="w-full border p-2 rounded" value={newMachine.location} onChange={e => setNewMachine({...newMachine, location: e.target.value})} />
                </div>
                <div className="w-1/3">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Pabrik Utama</label>
                  <select className="w-full border p-2 rounded" value={newMachine.factory} onChange={e => setNewMachine({...newMachine, factory: e.target.value})}>
                    {factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 mt-2 rounded-lg font-bold shadow-sm w-full"><i className="fa-solid fa-plus mr-2"></i> Daftarkan Mesin</button>
            </form>

            <div className="mt-6">
              <h4 className="font-bold text-gray-700 mb-3 flex items-center justify-between">
                <span>Daftar Aset Mesin</span><span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{machines.length} Total</span>
              </h4>
              <div className="space-y-3 max-h-[400px] overflow-auto pr-2">
                {machines.map(m => (
                  <div key={m.id} className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                    <div className="flex items-start">
                      <div className="bg-blue-50 text-blue-600 p-2 rounded-lg mr-3 mt-1"><i className="fa-solid fa-box-open"></i></div>
                      <div>
                        <p className="font-bold text-gray-800">{m.name} <span className="text-xs text-gray-500 font-normal">({m.code})</span></p>
                        <div className="text-[10px] mt-1 space-x-2"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase font-bold">{m.factory}</span></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => handleSelectMachineParams(m.id)} className="bg-gray-800 hover:bg-black text-white text-xs px-3 py-2 rounded-lg font-bold transition-colors">Setup Cek</button>
                       <button type="button" onClick={() => handleDeleteMachine(m.id, m.name)} className="bg-red-100 hover:bg-red-200 text-red-600 text-xs px-3 py-2 rounded-lg font-bold border border-red-200 transition-colors" title="Hapus Mesin"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedMachineParams && (
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-500 sticky top-6">
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-500">Editor Batch Parameter Harian</span>
                  <h3 className="font-bold text-xl text-gray-800">{machines.find(m => m.id === selectedMachineParams)?.name}</h3>
                </div>
                <button type="button" onClick={() => setSelectedMachineParams(null)} className="bg-gray-100 text-gray-500 hover:text-red-600 w-8 h-8 rounded-full"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (newParamText) { setTempParams([...tempParams, newParamText]); setNewParamText(''); } }} className="flex gap-2 mb-4">
                <input type="text" placeholder="Ketik indikator cek..." className="flex-1 border-2 border-gray-200 p-3 rounded-lg text-sm" value={newParamText} onChange={e => setNewParamText(e.target.value)} />
                <button type="submit" className="bg-gray-800 text-white px-5 py-3 rounded-lg text-sm font-bold">Tambah</button>
              </form>
              <ul className="space-y-2 mb-6 max-h-[300px] overflow-y-auto bg-gray-50 p-2 rounded">
                {tempParams.map((pName, idx) => (
                  <li key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border">
                    <span className="text-sm font-medium text-gray-700">{idx + 1}. {pName}</span>
                    <button type="button" onClick={() => setTempParams(tempParams.filter((_, i) => i !== idx))} className="text-red-500"><i className="fa-solid fa-trash-can"></i></button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleSaveChanges} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg"><i className="fa-solid fa-floppy-disk mr-2"></i> Simpan ke Database</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AdminKelolaSparepart = () => {
    const defaultFactory = factories[0]?.name || '';
    const [spForm, setSpForm] = useState({ code: '', name: '', factory: defaultFactory, stock: '', unit: 'pcs' });
    const [activeTab, setActiveTab] = useState('stok'); // 'stok' or 'request'

    const handleAddSparepart = async (e) => {
      e.preventDefault();
      const newPartData = { ...spForm, stock: Number(spForm.stock) };
      const docRefId = await addDoc(colRef('cmms_spareparts'), newPartData);
      
      // Catat log barang masuk pertama kali
      await addDoc(colRef('cmms_sparepart_logs'), {
        partId: docRefId.id, partCode: spForm.code, partName: spForm.name, factory: spForm.factory,
        date: new Date().toLocaleString(), type: 'IN', qty: Number(spForm.stock), unit: spForm.unit,
        remarks: 'Stok Awal (Master Baru)', user: currentUser.name
      });
      
      setSpForm({ code: '', name: '', factory: defaultFactory, stock: '', unit: 'pcs' });
      showMessage('Berhasil', 'Data Sparepart baru dan stok awal berhasil ditambahkan.', 'success');
    };

    const handleAddStock = (partId, partName, currentStock) => {
      const addedQty = prompt(`Masukkan jumlah stok tambahan untuk ${partName}:`, "0");
      const qtyNum = Number(addedQty);
      if (qtyNum && qtyNum > 0) {
        showConfirm('Tambah Stok', `Tambahkan ${qtyNum} ke ${partName}?`, async () => {
          const part = spareparts.find(p => p.id === partId);
          await updateDoc(docRef('cmms_spareparts', partId), { stock: currentStock + qtyNum });
          await addDoc(colRef('cmms_sparepart_logs'), {
            partId, partCode: part.code, partName: part.name, factory: part.factory,
            date: new Date().toLocaleString(), type: 'IN', qty: qtyNum, unit: part.unit,
            remarks: 'Penambahan Stok Manual (Admin)', user: currentUser.name
          });
          showMessage('Berhasil', 'Stok sparepart berhasil diperbarui.', 'success');
        });
      }
    };

    const handleFulfillRequest = (reqId, reqName) => {
      showConfirm('Selesaikan Request', `Tandai request "${reqName}" sebagai sudah dipenuhi/disediakan?`, async () => {
        await updateDoc(docRef('cmms_sparepart_requests', reqId), { status: 'Fulfilled', fulfillDate: new Date().toLocaleString() });
        showMessage('Berhasil', 'Request telah ditandai selesai.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Sparepart & Inventori</h2>
        <div className="flex border-b-2 border-gray-200 mb-4 gap-2">
           <button onClick={() => setActiveTab('stok')} className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'stok' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-boxes-stacked mr-2"></i> Stok Sparepart</button>
           <button onClick={() => setActiveTab('request')} className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'request' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
              <i className="fa-solid fa-hand-holding-hand mr-2"></i> Request Teknisi 
              {sparepartRequests.filter(r => r.status === 'Pending').length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{sparepartRequests.filter(r => r.status === 'Pending').length}</span>}
           </button>
        </div>

        {activeTab === 'stok' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm xl:col-span-1 h-fit border-t-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-4 text-gray-800"><i className="fa-solid fa-plus-circle mr-2 text-blue-500"></i> Register Part Baru</h3>
              <form onSubmit={handleAddSparepart} className="space-y-4">
                <div><label className="block text-xs font-bold mb-1">Kode Part</label><input type="text" required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.code} onChange={e => setSpForm({...spForm, code: e.target.value})} /></div>
                <div><label className="block text-xs font-bold mb-1">Nama Part</label><input type="text" required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.name} onChange={e => setSpForm({...spForm, name: e.target.value})} /></div>
                <div>
                  <label className="block text-xs font-bold mb-1">Lokasi Pabrik Gudang</label>
                  <select required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.factory} onChange={e => setSpForm({...spForm, factory: e.target.value})}>
                    {factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-bold mb-1">Stok Awal</label><input type="number" required min="0" className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.stock} onChange={e => setSpForm({...spForm, stock: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold mb-1">Satuan</label><input type="text" required placeholder="pcs, liter, set" className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.unit} onChange={e => setSpForm({...spForm, unit: e.target.value})} /></div>
                </div>
                <button type="submit" className="bg-blue-600 text-white w-full py-3 rounded-lg font-bold shadow hover:bg-blue-700">Simpan Sparepart</button>
              </form>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm xl:col-span-2">
              <h3 className="font-semibold text-lg mb-4 text-gray-800">Daftar Ketersediaan Stok</h3>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-3 font-semibold text-gray-700">Kode</th>
                      <th className="p-3 font-semibold text-gray-700">Nama Part</th>
                      <th className="p-3 font-semibold text-gray-700">Pabrik / Lokasi</th>
                      <th className="p-3 font-semibold text-gray-700 text-center">Sisa Stok</th>
                      <th className="p-3 font-semibold text-gray-700 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spareparts.map(sp => (
                      <tr key={sp.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-xs font-bold text-gray-500">{sp.code}</td>
                        <td className="p-3 font-semibold text-gray-800">{sp.name}</td>
                        <td className="p-3 text-xs"><span className="bg-gray-200 px-2 py-1 rounded">{sp.factory}</span></td>
                        <td className="p-3 text-center font-black text-blue-700">{sp.stock} <span className="text-xs font-normal text-gray-500">{sp.unit}</span></td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleAddStock(sp.id, sp.name, sp.stock)} className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-lg text-xs font-bold border border-green-200"><i className="fa-solid fa-plus"></i> Tambah Stok</button>
                        </td>
                      </tr>
                    ))}
                    {spareparts.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-400">Belum ada data sparepart.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'request' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-orange-500">
             <h3 className="font-semibold text-lg mb-4 text-gray-800">Daftar Request Pengadaan Part Baru (Dari Teknisi)</h3>
             <div className="space-y-4">
               {sparepartRequests.slice().reverse().map(req => (
                 <div key={req.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 ${req.status === 'Pending' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                   <div>
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'}`}>{req.status}</span>
                     <h4 className="font-bold text-gray-900 text-lg mt-1">{req.partName}</h4>
                     <p className="text-xs text-gray-600 mt-1">Dibutuhkan: <strong className="text-gray-900">{req.qty}</strong> | Lokasi: <strong>{req.factory}</strong></p>
                     <p className="text-sm italic text-gray-700 mt-2">"{req.remarks}"</p>
                     <div className="text-[10px] text-gray-500 mt-2"><i className="fa-solid fa-user-astronaut mr-1"></i> Req By: {req.requestedBy} pada {req.date}</div>
                   </div>
                   {req.status === 'Pending' && (
                     <button onClick={() => handleFulfillRequest(req.id, req.partName)} className="bg-orange-600 text-white font-bold px-6 py-3 rounded-lg hover:bg-orange-700 shadow-sm whitespace-nowrap"><i className="fa-solid fa-check-double mr-2"></i> Tandai Sudah Tersedia</button>
                   )}
                 </div>
               ))}
               {sparepartRequests.length === 0 && <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400">Belum ada request part.</div>}
             </div>
          </div>
        )}
      </div>
    );
  };

  const UserRequestPerbaikan = () => {
    const [formData, setFormData] = useState({ machineId: '', description: '' });
    const availableMachines = getAvailableMachines();

    const handleSubmit = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_breakdowns'), {
        date: new Date().toLocaleString(),
        ...formData,
        status: 'Open',
        reportedBy: currentUser.name,
        requestBy: currentUser.name,
        analysis: '', partsReplaced: '', startTime: '', endTime: ''
      });
      showMessage('Terkirim', 'Request perbaikan berhasil disimpan ke Database.', 'success');
      setFormData({ machineId: '', description: '' });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Form Request Perbaikan Mesin</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-8 border-red-500 h-fit">
            <h3 className="font-bold text-xl mb-6 text-gray-800"><i className="fa-solid fa-bullhorn text-red-500 mr-2"></i> Buat Laporan Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Aset Mesin ({currentUser.factory})</label>
                <select required className="w-full border-2 border-gray-200 p-3 rounded-lg" value={formData.machineId} onChange={e => setFormData({...formData, machineId: e.target.value})}>
                  <option value="">-- Pilih mesin --</option>
                  {availableMachines.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Deskripsi Kendala</label>
                <textarea required rows="5" className="w-full border-2 border-gray-200 p-3 rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <button type="submit" className="bg-red-600 text-white px-4 py-4 rounded-xl w-full font-bold"><i className="fa-solid fa-paper-plane mr-2"></i> Kirim Request</button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
            <h3 className="font-bold text-lg mb-4 text-gray-800">History Request Anda</h3>
            <div className="space-y-4 overflow-y-auto pr-2">
              {breakdowns.filter(b => b.reportedBy === currentUser.name).map(b => {
                const machine = machines.find(m => m.id === b.machineId);
                return (
                  <div key={b.id} className={`p-5 border rounded-xl shadow-sm ${b.status === 'Open' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-bold text-gray-900 text-lg">{machine?.name}</span>
                      <span className={`text-xs px-3 py-1 rounded-full font-bold ${b.status === 'Open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{b.status}</span>
                    </div>
                    <div className="bg-white p-3 rounded border text-sm text-gray-700 mb-3">{b.description}</div>
                    <div className="text-[10px] text-gray-400 font-medium"><i className="fa-regular fa-clock mr-1"></i> {b.date}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PenangananKerusakan = () => {
    const availableMachines = getAvailableMachines();
    const [resolveId, setResolveId] = useState(null);
    const [resolveData, setResolveData] = useState({ analysis: '', partsReplaced: '', startDate: '', startTime: '', endTime: '' });

    const handleResolveSubmit = async (e, bId) => {
      e.preventDefault();
      showConfirm('Selesaikan Perbaikan?', 'Data penanganan ini akan disimpan permanen.', async () => {
        await updateDoc(docRef('cmms_breakdowns', bId), {
          status: 'Selesai Diperbaiki', 
          resolvedBy: currentUser.name, 
          resolveDate: new Date().toLocaleString(),
          analysis: resolveData.analysis,
          partsReplaced: resolveData.partsReplaced,
          startTime: `${resolveData.startDate} ${resolveData.startTime}`,
          endTime: `${resolveData.startDate} ${resolveData.endTime}`
        });
        setResolveId(null);
        showMessage('Selesai', 'Perbaikan berhasil dicatat ke Database.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Penanganan Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-red-500">
            <h3 className="font-semibold text-lg mb-4 text-red-700 border-b pb-2"><i className="fa-solid fa-screwdriver-wrench mr-2"></i> Antrean Perbaikan (Open)</h3>
            <div className="space-y-4">
              {breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId)).map(b => {
                const machine = machines.find(m => m.id === b.machineId);
                const isResolving = resolveId === b.id;
                return (
                  <div key={b.id} className={`p-4 rounded-xl border ${isResolving ? 'border-blue-400 bg-blue-50' : 'border-red-200 bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900 text-lg block">{machine?.name}</span>
                      <span className="text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded">{machine?.factory}</span>
                    </div>
                    <div className="bg-gray-50 border p-3 rounded-lg mb-3 relative">
                      <span className="absolute -top-2 left-3 bg-gray-50 text-[10px] font-bold text-gray-400 px-1">Laporan: {b.requestBy}</span>
                      <p className="text-sm text-gray-800 mt-1">{b.description}</p>
                    </div>
                    {!isResolving ? (
                      <button onClick={() => {setResolveId(b.id); setResolveData({ analysis: '', partsReplaced: '', startDate: new Date().toISOString().split('T')[0], startTime: '', endTime: '' })}} className="w-full bg-blue-600 text-white font-bold px-4 py-3 rounded-lg"><i className="fa-solid fa-hand-pointer mr-2"></i> Ambil Pekerjaan Ini</button>
                    ) : (
                      <form onSubmit={(e) => handleResolveSubmit(e, b.id)} className="bg-white p-4 rounded-lg border-2 border-blue-200 mt-4">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold mb-1">Analisa & Tindakan</label>
                            <textarea required className="w-full border-2 p-2 text-sm rounded-lg" rows="2" value={resolveData.analysis} onChange={e => setResolveData({...resolveData, analysis: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="block text-xs font-bold mb-1">Part Diganti</label>
                            <input required type="text" className="w-full border-2 p-2 text-sm rounded-lg" value={resolveData.partsReplaced} onChange={e => setResolveData({...resolveData, partsReplaced: e.target.value})} />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div><label className="block text-[9px] font-bold">Tgl</label><input required type="date" className="w-full border p-2 text-sm" value={resolveData.startDate} onChange={e => setResolveData({...resolveData, startDate: e.target.value})} /></div>
                            <div><label className="block text-[9px] font-bold">Jam Mulai</label><input required type="time" className="w-full border p-2 text-sm" value={resolveData.startTime} onChange={e => setResolveData({...resolveData, startTime: e.target.value})} /></div>
                            <div><label className="block text-[9px] font-bold">Jam Selesai</label><input required type="time" className="w-full border p-2 text-sm" value={resolveData.endTime} onChange={e => setResolveData({...resolveData, endTime: e.target.value})} /></div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button type="submit" className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg text-sm"><i className="fa-solid fa-check mr-2"></i> Selesaikan</button>
                          <button type="button" onClick={() => setResolveId(null)} className="bg-gray-200 text-gray-700 font-bold px-4 py-3 rounded-lg text-sm">Batal</button>
                        </div>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-green-500">
            <h3 className="font-semibold text-lg mb-4 text-green-700 border-b pb-2"><i className="fa-solid fa-clock-rotate-left mr-2"></i> Histori Pekerjaan Selesai</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {breakdowns.filter(b => b.status === 'Selesai Diperbaiki' && availableMachines.find(m => m.id === b.machineId)).map(b => {
                const machine = machines.find(m => m.id === b.machineId);
                return (
                  <div key={b.id} className="p-4 border bg-white rounded-xl shadow-sm relative">
                    <span className="font-bold text-gray-900 block">{machine?.name}</span>
                    <p className="text-sm text-gray-600 mb-2 italic">"{b.description}"</p>
                    <div className="text-sm bg-green-50 p-3 rounded-lg border border-green-100 mb-3 text-gray-800">
                      <p className="mb-1"><span className="font-bold text-green-800 text-[10px] uppercase block">Tindakan:</span> {b.analysis}</p>
                      <p><span className="font-bold text-green-800 text-[10px] uppercase block">Part Ganti:</span> {b.partsReplaced}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const TeknisiSparepart = () => {
    const [activeTab, setActiveTab] = useState('ambil'); // 'ambil' or 'request'
    
    // Form Pengambilan
    const availableParts = spareparts.filter(sp => sp.factory === currentUser.factory);
    const [useForm, setUseForm] = useState({ partId: '', qty: '', remarks: '' });
    
    // Form Request
    const [reqForm, setReqForm] = useState({ partName: '', qty: '', remarks: '' });

    const handleUsePart = async (e) => {
      e.preventDefault();
      const part = availableParts.find(p => p.id === useForm.partId);
      if(!part) return;
      const qtyNum = Number(useForm.qty);
      
      if(qtyNum > part.stock) {
        showMessage('Gagal', `Stok tidak mencukupi! Stok saat ini: ${part.stock} ${part.unit}`, 'error');
        return;
      }
      
      showConfirm('Ambil Part', `Konfirmasi pengambilan ${qtyNum} ${part.unit} ${part.name}?`, async () => {
        await updateDoc(docRef('cmms_spareparts', part.id), { stock: part.stock - qtyNum });
        await addDoc(colRef('cmms_sparepart_logs'), {
          partId: part.id, partCode: part.code, partName: part.name, factory: part.factory,
          date: new Date().toLocaleString(), type: 'OUT', qty: qtyNum, unit: part.unit,
          remarks: useForm.remarks, user: currentUser.name
        });
        showMessage('Berhasil', 'Pengambilan part berhasil dicatat.', 'success');
        setUseForm({ partId: '', qty: '', remarks: '' });
      });
    };

    const handleRequestPart = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_sparepart_requests'), {
        partName: reqForm.partName, factory: currentUser.factory, qty: reqForm.qty,
        remarks: reqForm.remarks, status: 'Pending', requestedBy: currentUser.name, date: new Date().toLocaleString()
      });
      showMessage('Terkirim', 'Request sparepart baru telah dikirim ke Admin.', 'success');
      setReqForm({ partName: '', qty: '', remarks: '' });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Gudang Sparepart ({currentUser.factory})</h2>
        <div className="flex border-b-2 border-gray-200 mb-4 gap-2">
           <button onClick={() => setActiveTab('ambil')} className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'ambil' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-box-open mr-2"></i> Ambil / Gunakan Part</button>
           <button onClick={() => setActiveTab('request')} className={`px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'request' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-cart-plus mr-2"></i> Request Part Baru</button>
        </div>

        {activeTab === 'ambil' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-indigo-500 h-fit">
                <h3 className="font-semibold text-lg mb-4 text-gray-800"><i className="fa-solid fa-dolly mr-2 text-indigo-500"></i> Form Pengambilan Part</h3>
                <form onSubmit={handleUsePart} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Pilih Sparepart Tersedia</label>
                    <select required className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={useForm.partId} onChange={e => setUseForm({...useForm, partId: e.target.value})}>
                      <option value="">-- Pilih Part --</option>
                      {availableParts.map(sp => <option key={sp.id} value={sp.id}>{sp.code} - {sp.name} (Sisa: {sp.stock} {sp.unit})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Jumlah Diambil</label>
                    <input type="number" required min="1" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={useForm.qty} onChange={e => setUseForm({...useForm, qty: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Digunakan Untuk (Deskripsi/Nama Mesin)</label>
                    <textarea required rows="2" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" placeholder="Contoh: Ganti bearing mesin mixer B..." value={useForm.remarks} onChange={e => setUseForm({...useForm, remarks: e.target.value})}></textarea>
                  </div>
                  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-4 rounded-lg shadow-md hover:bg-indigo-700">Catat Pengambilan</button>
                </form>
             </div>
             
             <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col max-h-[500px]">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Histori Pengambilan Anda</h3>
                <div className="overflow-y-auto space-y-3 pr-2">
                  {sparepartLogs.filter(l => l.type === 'OUT' && l.user === currentUser.name).slice().reverse().map(log => (
                    <div key={log.id} className="p-3 border rounded-lg bg-indigo-50 border-indigo-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-900">{log.partName} <span className="text-xs text-gray-500 font-normal">({log.partCode})</span></span>
                        <span className="text-xs font-black text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200">-{log.qty} {log.unit}</span>
                      </div>
                      <p className="text-xs text-gray-700 italic mb-2">Tujuan: {log.remarks}</p>
                      <span className="text-[10px] text-gray-500 font-bold uppercase"><i className="fa-regular fa-clock"></i> {log.date}</span>
                    </div>
                  ))}
                  {sparepartLogs.filter(l => l.type === 'OUT' && l.user === currentUser.name).length === 0 && <div className="text-center py-6 text-gray-400 border-2 border-dashed rounded-xl">Belum ada histori pengambilan.</div>}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'request' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border-t-4 border-orange-500 h-fit">
                <h3 className="font-semibold text-lg mb-4 text-gray-800"><i className="fa-solid fa-cart-plus mr-2 text-orange-500"></i> Form Request Sparepart Baru</h3>
                <p className="text-xs text-gray-500 mb-4 bg-orange-50 p-2 border border-orange-100 rounded">Gunakan form ini HANYA jika part yang dibutuhkan belum tersedia di master stok pabrik Anda.</p>
                <form onSubmit={handleRequestPart} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Nama / Spesifikasi Part</label>
                    <input type="text" required placeholder="Contoh: V-Belt B-42 Mitsuboshi" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={reqForm.partName} onChange={e => setReqForm({...reqForm, partName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Estimasi Kebutuhan (Qty)</label>
                    <input type="text" required placeholder="Contoh: 2 pcs" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={reqForm.qty} onChange={e => setReqForm({...reqForm, qty: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Tingkat Urgensi / Alasan Request</label>
                    <textarea required rows="2" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" placeholder="Sangat mendesak untuk perbaikan mesin..." value={reqForm.remarks} onChange={e => setReqForm({...reqForm, remarks: e.target.value})}></textarea>
                  </div>
                  <button type="submit" className="w-full bg-orange-600 text-white font-bold py-4 rounded-lg shadow-md hover:bg-orange-700">Kirim Request Ke Admin</button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm flex flex-col max-h-[500px]">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Status Request Anda</h3>
                <div className="overflow-y-auto space-y-3 pr-2">
                  {sparepartRequests.filter(r => r.requestedBy === currentUser.name).slice().reverse().map(req => (
                     <div key={req.id} className="p-3 border rounded-lg bg-gray-50 relative">
                        <span className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded text-white ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'}`}>{req.status}</span>
                        <p className="font-bold text-gray-900 pr-16">{req.partName}</p>
                        <p className="text-xs text-gray-600 mb-1">Qty: {req.qty}</p>
                        <p className="text-xs text-gray-700 italic border-t border-dashed pt-1 mt-1">"{req.remarks}"</p>
                        <span className="text-[10px] text-gray-500 mt-2 block">{req.date}</span>
                     </div>
                  ))}
                  {sparepartRequests.filter(r => r.requestedBy === currentUser.name).length === 0 && <div className="text-center py-6 text-gray-400 border-2 border-dashed rounded-xl">Belum ada request diajukan.</div>}
                </div>
              </div>
           </div>
        )}
      </div>
    );
  };

  const TeknisiDailyActivity = () => {
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', activity: '' });
    const handleSubmit = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_dailyActivities'), { teknisi: currentUser.name, factory: currentUser.factory, ...formData });
      showMessage('Tersimpan', 'Aktivitas harian disinkronkan ke Database.', 'success');
      setFormData({ ...formData, startTime: '', endTime: '', activity: '' });
    };
    const myActivities = dailyActivities.filter(a => a.teknisi === currentUser.name);

    return (
      <div className="space-y-6">
        <div className="bg-blue-900 text-white p-6 rounded-xl shadow-md"><h2 className="text-2xl font-bold">Jurnal Aktivitas Harian</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border h-fit">
            <h3 className="font-bold text-lg mb-5 border-b pb-2"><i className="fa-solid fa-pen-clip mr-2 text-blue-500"></i> Entri Aktivitas Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required type="date" className="w-full border-2 p-3 rounded-lg" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input required type="time" className="w-full border-2 p-3 rounded-lg" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                <input required type="time" className="w-full border-2 p-3 rounded-lg" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
              </div>
              <textarea required rows="4" className="w-full border-2 p-3 rounded-lg" placeholder="Deskripsi aktivitas..." value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})}></textarea>
              <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-lg font-bold"><i className="fa-solid fa-floppy-disk mr-2"></i> Simpan ke Jurnal</button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm md:col-span-2 overflow-auto max-h-[650px]">
            <h3 className="font-bold text-lg mb-4">Riwayat Jurnal Anda</h3>
            <div className="space-y-4">
              {myActivities.map(act => (
                <div key={act.id} className="flex p-4 border rounded-xl shadow-sm">
                  <div className="mr-4 flex flex-col items-center justify-center border-r pr-4 min-w-[80px]">
                    <span className="text-xl font-black text-blue-600">{act.date.split('-')[2]}</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded"><i className="fa-regular fa-clock mr-1"></i> {act.startTime} - {act.endTime}</span>
                    <p className="text-sm text-gray-700 font-medium mt-2">{act.activity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CekHarian = () => {
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [checkData, setCheckData] = useState({});
    const availableMachines = getAvailableMachines();
    const params = selectedMachine ? dailyParams.filter(p => p.machineId === selectedMachine) : [];

    const handleSaveCheck = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_dailyChecks'), { date: new Date().toISOString().split('T')[0], machineId: selectedMachine, teknisi: currentUser.name, results: checkData });
      showMessage('Pengecekan Selesai', 'Data checklist harian mesin berhasil disubmit ke Database.', 'success');
      setSelectedMachine(null);
      setCheckData({});
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Form Checklist Harian</h2>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 border-b pb-2">1. Pilih Aset Mesin</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {availableMachines.map(m => (
              <div key={m.id} onClick={() => { setSelectedMachine(m.id); setCheckData({}); }} className={`cursor-pointer border-2 p-4 rounded-2xl flex flex-col items-center text-center transition-all ${selectedMachine === m.id ? 'bg-blue-600 border-blue-600 shadow-lg scale-105' : 'bg-white hover:border-blue-300'}`}>
                <div className={`text-3xl mb-2 ${selectedMachine === m.id ? 'text-white' : 'text-gray-400'}`}><i className="fa-solid fa-box"></i></div>
                <span className={`text-[11px] font-bold ${selectedMachine === m.id ? 'text-white' : 'text-gray-800'}`}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
        {selectedMachine && (
          <div className="bg-white p-6 rounded-xl shadow-xl border-t-8 border-blue-500">
            <h3 className="text-xl font-bold mb-6 flex items-center border-b pb-4"><i className="fa-solid fa-list-check text-blue-500 mr-3"></i> Lembar Cek: {machines.find(m=>m.id === selectedMachine)?.name}</h3>
            {params.length > 0 ? (
              <form onSubmit={handleSaveCheck}>
                <div className="space-y-4 mb-8">
                  {params.map((p, idx) => {
                    const status = checkData[p.id]?.status;
                    return (
                      <div key={p.id} className="p-4 border-2 rounded-xl bg-gray-50 flex flex-col md:flex-row justify-between gap-4">
                        <p className="font-bold flex-1 text-sm">{idx+1}. {p.name}</p>
                        <div className="flex gap-2">
                          <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer text-sm font-bold border-2 ${status === 'OK' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-white border-gray-200'}`}>
                            <input type="radio" required name={`param_${p.id}`} className="hidden" onChange={() => setCheckData({...checkData, [p.id]: { status: 'OK', note: checkData[p.id]?.note || '' }})} /> Normal
                          </label>
                          <label className={`flex items-center px-4 py-2 rounded-lg cursor-pointer text-sm font-bold border-2 ${status === 'NG' ? 'bg-red-100 text-red-700 border-red-500' : 'bg-white border-gray-200'}`}>
                            <input type="radio" required name={`param_${p.id}`} className="hidden" onChange={() => setCheckData({...checkData, [p.id]: { status: 'NG', note: checkData[p.id]?.note || '' }})} /> Abnormal
                          </label>
                        </div>
                        {status === 'NG' && <input type="text" placeholder="Ket. abnormal" required className="w-full md:w-48 border-2 border-red-300 p-2 text-sm rounded bg-red-50" onChange={(e) => setCheckData({...checkData, [p.id]: { ...checkData[p.id], note: e.target.value }})} />}
                      </div>
                    )
                  })}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-lg">Submit Hasil Ke Database</button>
              </form>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-red-200 bg-red-50 rounded-xl"><p className="text-red-800 font-bold">Parameter Belum Diatur Admin!</p></div>
            )}
          </div>
        )}
      </div>
    );
  };

  const SetupPM = () => {
    const [newSchedule, setNewSchedule] = useState({ machineId: '', date: '', title: '' });
    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const [tempTasks, setTempTasks] = useState([]);
    const [newTaskText, setNewTaskText] = useState('');

    const handleCreateSchedule = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_pmSchedules'), { ...newSchedule, status: 'Pending', executedBy: null, verifiedBy: null, executionNote: '' });
      setNewSchedule({ machineId: '', date: '', title: '' });
      showMessage('Berhasil', 'Jadwal PM baru disimpan ke Database.', 'success');
    };

    const handleSelectSchedule = (sId) => {
      setSelectedSchedule(sId);
      setTempTasks(pmParams.filter(p => p.scheduleId === sId).map(p => p.task));
    };

    const handleSaveTasks = async () => {
      const oldTasks = pmParams.filter(p => p.scheduleId === selectedSchedule);
      for(const ot of oldTasks) await deleteDoc(docRef('cmms_pmParams', ot.id));
      for(const task of tempTasks) {
        await addDoc(colRef('cmms_pmParams'), { scheduleId: selectedSchedule, task: task });
      }
      showMessage('Tersimpan', 'Daftar SOP PM berhasil disimpan.', 'success');
      setSelectedSchedule(null);
    };

    const handleVerify = (id) => {
      showConfirm('Otorisasi Verifikasi', 'TTD Digital Anda akan dibubuhkan.', async () => {
        await updateDoc(docRef('cmms_pmSchedules', id), { status: 'Terverifikasi', verifiedBy: currentUser.name, verifyDate: new Date().toISOString().split('T')[0] });
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Perencanaan & Verifikasi PM</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 border-b pb-2"><i className="fa-regular fa-calendar-plus text-blue-500 mr-2"></i> Terbitkan Jadwal PM</h3>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <select required className="w-full border-2 p-3 rounded-lg" value={newSchedule.machineId} onChange={e => setNewSchedule({...newSchedule, machineId: e.target.value})}>
                <option value="">-- Pilih Mesin --</option>
                {machines.map(m => <option key={m.id} value={m.id}>[{m.factory}] {m.name}</option>)}
              </select>
              <input required type="text" placeholder="Judul PM..." className="w-full border-2 p-3 rounded-lg" value={newSchedule.title} onChange={e => setNewSchedule({...newSchedule, title: e.target.value})} />
              <input required type="date" className="w-full border-2 p-3 rounded-lg" value={newSchedule.date} onChange={e => setNewSchedule({...newSchedule, date: e.target.value})} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-4 rounded-xl w-full font-bold">Terbitkan Instruksi</button>
            </form>
            <div className="mt-8 border-t pt-6">
              <h4 className="font-bold text-gray-700 mb-3">Database Jadwal PM</h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {pmSchedules.map(sch => (
                  <div key={sch.id} onClick={() => handleSelectSchedule(sch.id)} className={`p-4 border rounded-xl cursor-pointer ${selectedSchedule === sch.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white'}`}>
                    <p className="font-bold">{sch.title}</p>
                    <p className="text-xs text-gray-600">{machines.find(m => m.id === sch.machineId)?.name} | Status: {sch.status}</p>
                    {sch.status === 'Selesai' && (
                      <button onClick={(e) => { e.stopPropagation(); handleVerify(sch.id); }} className="mt-2 bg-green-600 text-white text-xs px-3 py-1 rounded font-bold w-full">Verifikasi PM Ini</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {selectedSchedule && (
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-indigo-500 sticky top-6">
              <h3 className="font-bold text-xl mb-4">SOP PM: {pmSchedules.find(s => s.id === selectedSchedule)?.title}</h3>
              <form onSubmit={e => { e.preventDefault(); if(newTaskText) { setTempTasks([...tempTasks, newTaskText]); setNewTaskText(''); } }} className="flex gap-2 mb-4">
                <input type="text" placeholder="Ketik rincian pekerjaan..." className="flex-1 border-2 p-3 rounded-lg text-sm" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} />
                <button type="submit" className="bg-indigo-900 text-white px-5 py-3 rounded-lg text-sm font-bold">Tambah</button>
              </form>
              <ul className="space-y-2 mb-6 max-h-[300px] overflow-y-auto bg-gray-50 p-2">
                {tempTasks.map((task, idx) => (
                  <li key={idx} className="flex justify-between p-3 bg-white rounded border">
                    <span className="text-sm">{idx + 1}. {task}</span>
                    <button type="button" onClick={() => setTempTasks(tempTasks.filter((_, i) => i !== idx))} className="text-red-500"><i className="fa-solid fa-trash-can"></i></button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleSaveTasks} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">Simpan SOP ke Database</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const EksekusiPM = () => {
    const pendingSchedules = pmSchedules.filter(s => s.status === 'Pending' && getAvailableMachines().find(m => m.id === s.machineId));
    const [pmForms, setPmForms] = useState({});

    const handleSelesaikanPM = (scheduleId) => {
      const formData = pmForms[scheduleId] || {};
      if(!formData.executeDate || !formData.startTime || !formData.endTime) {
        showMessage('Data Tidak Lengkap', 'Lengkapi Durasi Waktu Pengerjaan.', 'error');
        return;
      }
      showConfirm('Submit Laporan', 'Dokumen pelaksanaan PM akan disimpan ke Database.', async () => {
        await updateDoc(docRef('cmms_pmSchedules', scheduleId), {
          status: 'Selesai', executedBy: currentUser.name, executeDate: formData.executeDate, pmStartTime: formData.startTime, pmEndTime: formData.endTime, executionNote: formData.note || '-'
        });
        showMessage('Berhasil', 'Dokumen terkirim ke Supervisor.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Eksekusi Preventive Maintenance (PM)</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {pendingSchedules.map(sch => {
            const machine = machines.find(m => m.id === sch.machineId);
            const tasks = pmParams.filter(p => p.scheduleId === sch.id);
            const form = pmForms[sch.id] || { executeDate: new Date().toISOString().split('T')[0], startTime: '', endTime: '', note: '' };
            return (
              <div key={sch.id} className="bg-white p-6 rounded-xl shadow-md border-t-8 border-blue-500 flex flex-col">
                <h3 className="font-bold text-xl mb-1">{sch.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{machine?.name} ({machine?.code})</p>
                <div className="mb-4 bg-gray-50 p-4 rounded border">
                  <h4 className="text-sm font-bold mb-2">SOP Pekerjaan:</h4>
                  <ul className="space-y-2 mb-4">
                    {tasks.map(t => <li key={t.id} className="text-sm flex"><input type="checkbox" className="mr-2 mt-1"/> {t.task}</li>)}
                  </ul>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div><label className="text-[9px] font-bold">Tgl</label><input type="date" className="w-full border p-2" value={form.executeDate} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, executeDate: e.target.value}})} /></div>
                    <div><label className="text-[9px] font-bold">Jam Mulai</label><input type="time" className="w-full border p-2" value={form.startTime} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, startTime: e.target.value}})} /></div>
                    <div><label className="text-[9px] font-bold">Jam Selesai</label><input type="time" className="w-full border p-2" value={form.endTime} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, endTime: e.target.value}})} /></div>
                  </div>
                  <textarea rows="2" className="w-full border p-2 text-sm" placeholder="Catatan tambahan..." value={form.note} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, note: e.target.value}})}></textarea>
                </div>
                <button type="button" onClick={() => handleSelesaikanPM(sch.id)} className="w-full bg-blue-600 text-white py-3 rounded font-bold"><i className="fa-solid fa-qrcode mr-2"></i> Submit Data PM</button>
              </div>
            )
          })}
        </div>
      </div>
    );
  };

  const CetakLaporan = () => {
    const [activeTab, setActiveTab] = useState('harian');
    const [filterFactory, setFilterFactory] = useState('All');
    const [filterMachine, setFilterMachine] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    
    const machinesToPrint = filterFactory === 'All' ? machines : machines.filter(m => m.factory === filterFactory);
    
    const filteredChecks = dailyChecks.filter(c => {
      const matchMachine = filterMachine ? c.machineId === filterMachine : machinesToPrint.find(m => m.id === c.machineId);
      const matchMonth = filterMonth ? c.date.startsWith(filterMonth) : true;
      return matchMachine && matchMonth;
    });

    const filteredPMs = pmSchedules.filter(s => {
      const isDone = s.status === 'Selesai' || s.status === 'Terverifikasi';
      const matchMachine = filterMachine ? s.machineId === filterMachine : machinesToPrint.find(m => m.id === s.machineId);
      const matchYear = filterYear ? s.date.startsWith(filterYear) : true;
      return isDone && matchMachine && matchYear;
    });

    const filteredSparepartLogs = sparepartLogs.filter(log => {
       const matchFactory = filterFactory === 'All' ? true : log.factory === filterFactory;
       let matchDate = true;
       if(activeTab === 'sparepart') {
         if (filterMonth) {
            const [year, month] = filterMonth.split('-');
            matchDate = log.date.includes(`${month}/${year}`) || log.date.includes(`${year}-${month}`);
         } else if (filterYear) {
            matchDate = log.date.includes(filterYear);
         }
       }
       return matchFactory && matchDate;
    });

    return (
      <div className="space-y-6">
        <div className="print:hidden">
          <div className="bg-gray-800 text-white p-6 rounded-xl mb-6">
            <h2 className="text-2xl font-bold">Pusat Cetak Dokumen</h2>
          </div>
          
          <div className="flex border-b-2 border-gray-200 mb-6 gap-2 overflow-x-auto pb-1">
             <button onClick={() => setActiveTab('harian')} className={`whitespace-nowrap px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'harian' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-clipboard-check mr-2"></i> Rekap Harian</button>
             <button onClick={() => setActiveTab('pm')} className={`whitespace-nowrap px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'pm' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-calendar-check mr-2"></i> Riwayat PM Tahunan</button>
             <button onClick={() => setActiveTab('sparepart')} className={`whitespace-nowrap px-6 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'sparepart' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-boxes-stacked mr-2"></i> Mutasi Sparepart</button>
          </div>

          <div className="bg-white p-6 rounded-xl flex gap-4 items-end mb-6 border flex-wrap">
            <div>
              <label className="block text-xs font-bold mb-1">Filter Pabrik</label>
              <select className="border-2 p-3 rounded min-w-[150px]" value={filterFactory} onChange={e => {setFilterFactory(e.target.value); setFilterMachine('');}}>
                <option value="All">Semua Pabrik</option>
                {factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
            </div>
            
            {activeTab !== 'sparepart' && (
              <div>
                <label className="block text-xs font-bold mb-1">Filter Mesin</label>
                <select className="border-2 p-3 rounded min-w-[150px]" value={filterMachine} onChange={e => setFilterMachine(e.target.value)}>
                  <option value="">Semua Mesin</option>
                  {machinesToPrint.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
            
            {activeTab === 'harian' || activeTab === 'sparepart' ? (
              <div>
                <label className="block text-xs font-bold mb-1">Filter Bulan {activeTab === 'sparepart' && '(Opsional)'}</label>
                <input type="month" className="border-2 p-3 rounded" value={filterMonth} onChange={e => {setFilterMonth(e.target.value); if(activeTab==='sparepart') setFilterYear('');}} />
              </div>
            ) : null}

            {activeTab === 'pm' || activeTab === 'sparepart' ? (
              <div>
                <label className="block text-xs font-bold mb-1">Filter Tahun {activeTab === 'sparepart' && '(Opsional)'}</label>
                <input type="number" className="border-2 p-3 rounded w-32" value={filterYear} onChange={e => {setFilterYear(e.target.value); if(activeTab==='sparepart') setFilterMonth('');}} />
              </div>
            ) : null}
            
            <button onClick={() => window.print()} className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold ml-auto shadow-lg"><i className="fa-solid fa-print mr-2"></i> Cetak / PDF</button>
          </div>
        </div>

        {/* HALAMAN CETAK: HARIAN */}
        {activeTab === 'harian' && (
          <div className="bg-white p-8 rounded-xl print:p-0 border print:border-0 print:shadow-none shadow-sm">
            <h1 className="text-2xl font-bold uppercase mb-4 text-center print:text-left border-b-2 border-gray-900 pb-2">Laporan Pengecekan Harian</h1>
            <table className="w-full border-collapse border border-gray-900 text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-900 p-2">Tanggal</th>
                  <th className="border border-gray-900 p-2">Aset Mesin</th>
                  <th className="border border-gray-900 p-2 text-center">Teknisi</th>
                  <th className="border border-gray-900 p-2">Hasil Cek (Parameter & Ket)</th>
                </tr>
              </thead>
              <tbody>
                {filteredChecks.length > 0 ? filteredChecks.map(check => {
                  const machine = machines.find(m => m.id === check.machineId);
                  return (
                    <tr key={check.id}>
                      <td className="border border-gray-900 p-2 text-center whitespace-nowrap">{check.date}</td>
                      <td className="border border-gray-900 p-2 font-bold">{machine?.name} <br/><span className="text-xs font-normal text-gray-500">{machine?.factory}</span></td>
                      <td className="border border-gray-900 p-2 text-center">{check.teknisi}</td>
                      <td className="border border-gray-900 p-2">
                        <ul className="space-y-1">
                          {Object.entries(check.results).map(([paramId, res]) => (
                            <li key={paramId} className="text-xs">
                              <span className="font-bold">{dailyParams.find(p => p.id === paramId)?.name || 'Terhapus'}</span>: [{res.status}] {res.note && `(${res.note})`}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan="4" className="border border-gray-900 p-8 text-center text-gray-500 font-bold">Data tidak ditemukan sesuai filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* HALAMAN CETAK: PREVENTIVE MAINTENANCE */}
        {activeTab === 'pm' && (
  <div className="space-y-12">
    {filteredPMs.length > 0 ? filteredPMs.map(pm => {
      const machine = machines.find(m => m.id === pm.machineId);
      const tasks = pmParams.filter(p => p.scheduleId === pm.id);
      
      // Data QR Code
      const qrTeknisiData = encodeURIComponent(`Sign:${pm.executedBy}|Date:${pm.executeDate}|ID:${pm.id}`);
      const qrSpvData = encodeURIComponent(`VerifiedBy:${pm.verifiedBy}|Date:${pm.verifyDate}|ID:${pm.id}`);
      const qrTeknisi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrTeknisiData}`;
      const qrSupervisor = pm.status === 'Terverifikasi' ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrSpvData}` : null;

      return (
        <div key={pm.id} className="border-4 border-gray-900 p-8 rounded-xl bg-white break-inside-avoid shadow-sm print:shadow-none relative">
          {/* Watermark */}
          {pm.status === 'Terverifikasi' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-[-30deg] opacity-[0.03] print:opacity-10 pointer-events-none z-0">
              <span className="text-8xl font-black uppercase text-gray-900 border-8 border-gray-900 px-6 py-2 rounded-xl whitespace-nowrap">Verified Document</span>
            </div>
          )}

          {/* Header Sertifikat */}
          <div className="flex justify-between border-b-2 border-gray-900 pb-6 mb-6 relative z-10">
            <div className="flex-1">
              <span className="bg-gray-900 text-white font-bold text-[10px] uppercase tracking-widest px-2 py-1 mb-2 inline-block">Doc ID: PM-{pm.id.toString().slice(-6)}</span>
              <h4 className="font-black text-2xl uppercase text-gray-900 leading-tight mb-2">{pm.title}</h4>
              <div className="text-gray-800 text-sm p-3 bg-gray-100 border border-gray-300 rounded inline-block print:bg-transparent print:border-gray-900">
                <p className="font-bold text-lg mb-1"><i className="fa-solid fa-microchip mr-2"></i>{machine?.name || 'Unknown'}</p>
                <p className="text-xs uppercase tracking-wide">Aset Code: <strong>{machine?.code || '-'}</strong> | Lokasi: <strong>{machine?.factory || '-'}</strong></p>
              </div>
            </div>
            {/* Info Tanggal */}
            <div className="text-right text-sm border-l-2 border-gray-900 pl-6 flex flex-col justify-center bg-gray-50 p-4 rounded print:bg-transparent print:p-0 print:border-0">
              <table className="text-left font-medium">
                <tbody>
                  <tr><td className="pr-4 pb-1 text-gray-500 uppercase text-xs">Jadwal</td><td className="font-bold pb-1">: {pm.date}</td></tr>
                  <tr><td className="pr-4 pb-1 text-gray-500 uppercase text-xs">Pengerjaan</td><td className="font-bold pb-1">: {pm.executeDate}</td></tr>
                  <tr><td className="pr-4 pb-1 text-gray-500 uppercase text-xs">Jam</td><td className="font-bold pb-1">: {pm.pmStartTime || '-'} s/d {pm.pmEndTime || '-'}</td></tr>
                  <tr><td className="pr-4 pt-2 text-gray-500 uppercase text-xs border-t border-gray-300">Status</td><td className="font-bold pt-2 uppercase">: {pm.status}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SOP Lists */}
          <div className="mb-6 relative z-10">
            <h5 className="font-bold text-gray-900 bg-gray-200 px-3 py-1 rounded text-sm uppercase tracking-wider inline-block mb-3 border border-gray-400">Daftar SOP Terselesaikan:</h5>
            {tasks.length > 0 ? (
              <ul className="space-y-1">
                {tasks.map((t, idx) => (
                  <li key={t.id} className="text-sm flex border-b border-gray-200 pb-2 mb-2 items-end">
                    <span className="font-bold mr-3 text-gray-400">{idx+1}.</span> 
                    <span className="flex-1 text-gray-800">{t.task}</span>
                    <span className="font-black text-gray-900 bg-gray-100 px-2 py-0.5 rounded border border-gray-400"><i className="fa-regular fa-square-check mr-1"></i> DONE</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm italic p-4 border border-dashed rounded">Tidak ada daftar SOP.</p>}
          </div>

          {/* Catatan */}
          <div className="mb-8 relative z-10">
            <h5 className="font-bold text-gray-900 bg-gray-200 px-3 py-1 rounded text-sm uppercase tracking-wider inline-block mb-3 border border-gray-400">Catatan Kondisi Aktual:</h5>
            <div className="bg-gray-50 p-4 border border-gray-400 min-h-[80px] text-sm italic font-medium rounded">{pm.executionNote || '-'}</div>
          </div>

          {/* Footer TTD QR */}
          <div className="flex justify-between mt-8 pt-8 border-t-2 border-gray-900 relative z-10">
            <div className="text-center w-56">
              <p className="text-xs font-bold mb-2 uppercase text-gray-500">Teknisi Pelaksana</p>
              <div className="h-32 w-32 mx-auto border p-1 bg-white rounded shadow-sm"><img src={qrTeknisi} alt="QR" className="w-full h-full" crossOrigin="anonymous" /></div>
              <p className="font-black text-gray-900 uppercase text-sm mt-2 border-t pt-1">{pm.executedBy}</p>
            </div>
            <div className="text-center w-56">
              <p className="text-xs font-bold mb-2 uppercase text-gray-500">Supervisor</p>
              <div className="h-32 w-32 mx-auto border p-1 bg-white rounded shadow-sm">
                {qrSupervisor ? <img src={qrSupervisor} alt="QR" className="w-full h-full" crossOrigin="anonymous" /> : <div className="text-[10px] text-red-400 pt-10 uppercase">Pending<br/>Verifikasi</div>}
              </div>
              <p className="font-black text-gray-900 uppercase text-sm mt-2 border-t pt-1">{pm.status === 'Terverifikasi' ? pm.verifiedBy : '...................'}</p>
            </div>
          </div>
        </div>
      );
    }) : (
      <div className="text-center p-16 border-4 border-dashed text-gray-500 rounded-xl">Arsip Kosong</div>
    )}
  </div>
)}

        {/* HALAMAN CETAK: MUTASI SPAREPART */}
{activeTab === 'sparepart' && (
  <div className="bg-white p-8 rounded-xl print:p-0 border print:border-0 shadow-sm print:shadow-none">
    
    {/* HEADER DOKUMEN RESMI */}
    <div className="flex items-center justify-between border-b-4 border-gray-900 pb-6 mb-8 print:flex">
      <div>
        <h1 className="text-3xl font-black uppercase text-gray-900">Laporan Mutasi Sparepart</h1>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Sistem Manajemen Inventori - {filterFactory}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-gray-400">PERIODE LAPORAN</p>
        <p className="text-lg font-black text-gray-900">{filterMonth || filterYear || 'Semua Waktu'}</p>
      </div>
    </div>

    {/* TABEL MUTASI */}
    <table className="w-full border-collapse border border-gray-900 text-sm">
      <thead>
        <tr className="bg-gray-900 text-white">
          <th className="border border-gray-900 p-3">Tanggal</th>
          <th className="border border-gray-900 p-3">Nama Sparepart</th>
          <th className="border border-gray-900 p-3 text-center">Tipe</th>
          <th className="border border-gray-900 p-3 text-center">Qty</th>
          <th className="border border-gray-900 p-3 text-left">Keterangan</th>
          <th className="border border-gray-900 p-3">PIC</th>
        </tr>
      </thead>
      <tbody>
        {filteredSparepartLogs.length > 0 ? filteredSparepartLogs.slice().reverse().map(log => (
          <tr key={log.id} className="hover:bg-gray-50">
            <td className="border border-gray-900 p-2 text-center text-xs font-medium">{log.date}</td>
            <td className="border border-gray-900 p-2">
              <span className="font-bold text-gray-900">{log.partName}</span>
              <span className="text-[10px] text-gray-500 block">Code: {log.partCode}</span>
            </td>
            <td className="border border-gray-900 p-2 text-center">
               <span className={`px-2 py-1 rounded font-black text-[10px] uppercase ${log.type === 'IN' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                 {log.type === 'IN' ? 'Masuk' : 'Keluar'}
               </span>
            </td>
            <td className={`border border-gray-900 p-2 text-center font-black ${log.type === 'IN' ? 'text-green-700' : 'text-red-700'}`}>
               {log.type === 'IN' ? '+' : '-'}{log.qty} <span className="text-[10px] font-normal">{log.unit}</span>
            </td>
            <td className="border border-gray-900 p-2 text-xs italic">{log.remarks}</td>
            <td className="border border-gray-900 p-2 text-center text-xs font-bold">{log.user}</td>
          </tr>
        )) : (
          <tr><td colSpan="6" className="border border-gray-900 p-10 text-center font-bold text-gray-400">Data Transaksi Kosong</td></tr>
        )}
      </tbody>
    </table>

    {/* FOOTER TTD */}
    <div className="flex justify-between mt-12 pt-4">
      <div className="text-center w-48">
        <p className="text-[10px] font-bold uppercase text-gray-500 mb-16">Dibuat Oleh (Admin/SPV)</p>
        <p className="border-t border-gray-900 pt-1 font-bold text-sm">____________________</p>
      </div>
      <div className="text-center w-48">
        <p className="text-[10px] font-bold uppercase text-gray-500 mb-16">Disetujui (Dir. Manufaktur)</p>
        <p className="border-t border-gray-900 pt-1 font-bold text-sm">____________________</p>
      </div>
    </div>
  </div>
)}

  const NavItem = ({ id, icon, label, roles }) => {
    if (!roles.includes(currentUser.role)) return null;
    return (
      <button onClick={() => {setActiveMenu(id); setIsSidebarOpen(false)}} className={`w-full flex items-center px-4 py-3 rounded-lg text-left font-medium text-sm ${activeMenu === id ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-800'}`}>
        <i className={`fa-solid ${icon} w-6 mr-3 text-lg`}></i> <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900 font-sans">
      <ModalDialog />
      <aside className={`print:hidden fixed inset-y-0 left-0 bg-gray-900 text-white w-72 transform ${isSidebarOpen ? '-translate-x-full' : 'translate-x-0'} md:relative md:translate-x-0 transition-transform z-30 flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
          <h1 className="text-xl font-black uppercase">CMMS Pro</h1>
          <button className="md:hidden" onClick={() => setIsSidebarOpen(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="mb-8 bg-gray-800 p-4 rounded-xl border border-gray-700">
            <p className="font-bold text-white mb-2">{currentUser.name}</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] uppercase font-bold bg-blue-600 px-2 py-1 rounded">{currentUser.role}</span>
              <span className="text-[9px] uppercase font-bold bg-gray-700 px-2 py-1 rounded">{currentUser.factory}</span>
            </div>
          </div>
          <nav className="space-y-1">
            <NavItem id="dashboard" icon="fa-chart-pie" label="Dashboard" roles={['admin', 'teknisi', 'user']} />
            <div className={currentUser.role === 'admin' ? 'pt-6 pb-2' : 'hidden'}>
              <NavItem id="kelola_pabrik" icon="fa-city" label="Master Pabrik / Lokasi" roles={['admin']} />
              <NavItem id="kelola_user" icon="fa-users-gear" label="Manajemen Akun" roles={['admin']} />
              <NavItem id="kelola_mesin" icon="fa-network-wired" label="Aset & Parameter" roles={['admin']} />
              <NavItem id="kelola_sparepart" icon="fa-boxes-stacked" label="Manajemen Sparepart" roles={['admin']} />
              <NavItem id="setup_pm" icon="fa-calendar-days" label="Jadwal & Verifikasi PM" roles={['admin']} />
              <NavItem id="cetak" icon="fa-print" label="Pusat Dokumen (Cetak)" roles={['admin']} />
            </div>
            <div className={currentUser.role === 'teknisi' ? 'pt-6 pb-2' : 'hidden'}>
              <NavItem id="daily_activity" icon="fa-book-open" label="Buku Jurnal Harian" roles={['teknisi']} />
              <NavItem id="cek_harian" icon="fa-clipboard-list" label="Checklist Rutin Mesin" roles={['teknisi']} />
              <NavItem id="penanganan_rusak" icon="fa-screwdriver-wrench" label="Tangani Breakdown" roles={['teknisi']} />
              <NavItem id="eksekusi_pm" icon="fa-business-time" label="Jadwal PM Aktif" roles={['teknisi']} />
              <NavItem id="teknisi_sparepart" icon="fa-box-open" label="Gudang & Request Part" roles={['teknisi']} />
            </div>
            <div className={currentUser.role === 'user' ? 'pt-6 pb-2' : 'hidden'}>
              <NavItem id="req_perbaikan" icon="fa-triangle-exclamation" label="Lapor Kendala Mesin" roles={['user']} />
            </div>
          </nav>
        </div>
        <div className="absolute bottom-0 w-full p-4 bg-gray-950"><button onClick={handleLogout} className="bg-red-600 text-white w-full p-3 rounded font-bold"><i className="fa-solid fa-power-off mr-2"></i> KELUAR</button></div>
      </aside>
      <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden relative">
        <header className="print:hidden bg-white shadow-sm border-b h-16 flex items-center px-4 md:px-8 z-10 sticky top-0">
          <button className="md:hidden mr-4 text-gray-600" onClick={() => setIsSidebarOpen(true)}><i className="fa-solid fa-bars-staggered"></i></button>
          <h2 className="text-lg font-black uppercase text-gray-800">{activeMenu.replace('_', ' ')}</h2>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8 print:p-0">
          {activeMenu === 'dashboard' && <Dashboard />}
          {activeMenu === 'kelola_pabrik' && <AdminKelolaPabrik />}
          {activeMenu === 'kelola_user' && <AdminKelolaUser />}
          {activeMenu === 'kelola_mesin' && <AdminKelolaMesin />}
          {activeMenu === 'kelola_sparepart' && <AdminKelolaSparepart />}
          {activeMenu === 'setup_pm' && <SetupPM />}
          {activeMenu === 'cetak' && <CetakLaporan />}
          {activeMenu === 'daily_activity' && <TeknisiDailyActivity />}
          {activeMenu === 'cek_harian' && <CekHarian />}
          {activeMenu === 'penanganan_rusak' && <PenangananKerusakan />}
          {activeMenu === 'eksekusi_pm' && <EksekusiPM />}
          {activeMenu === 'teknisi_sparepart' && <TeknisiSparepart />}
          {activeMenu === 'req_perbaikan' && <UserRequestPerbaikan />}
        </div>
      </main>
    </div>
  );
}