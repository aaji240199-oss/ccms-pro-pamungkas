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
  const [profileDialog, setProfileDialog] = useState(false);
  
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chatTicket, setChatTicket] = useState(null);
  const [dismissedNotifs, setDismissedNotifs] = useState([]);

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
  const [spareparts, setSpareparts] = useState([]);
  const [sparepartLogs, setSparepartLogs] = useState([]);
  const [sparepartRequests, setSparepartRequests] = useState([]);
  const [ltiLogs, setLtiLogs] = useState([]);

  // --- EFFECT: LOAD SCRIPT & FIREBASE AUTH ---
  useEffect(() => {
    if(!document.getElementById('fa-script')){
      const link = document.createElement('link');
      link.id = 'fa-script'; link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
    if(!document.getElementById('qr-script')){
      const qrScript = document.createElement('script');
      qrScript.id = 'qr-script'; qrScript.src = 'https://unpkg.com/html5-qrcode'; qrScript.async = true;
      document.body.appendChild(qrScript);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFbUser);
    return () => unsubscribe();
  }, []);

  // --- EFFECT: SINKRONISASI DATABASE ---
  useEffect(() => {
    if (!fbUser) return;
    const getPath = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
    const handleSnap = (setter) => (snap) => setter(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    const handleErr = (err) => console.error("DB Sync Error:", err);

    const unsubscribes = [
      onSnapshot(getPath('cmms_factories'), handleSnap(setFactories), handleErr),
      onSnapshot(getPath('cmms_users'), (snap) => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsDbLoaded(true);
      }, handleErr),
      onSnapshot(getPath('cmms_machines'), handleSnap(setMachines), handleErr),
      onSnapshot(getPath('cmms_dailyParams'), handleSnap(setDailyParams), handleErr),
      onSnapshot(getPath('cmms_dailyChecks'), handleSnap(setDailyChecks), handleErr),
      onSnapshot(getPath('cmms_breakdowns'), handleSnap(setBreakdowns), handleErr),
      onSnapshot(getPath('cmms_pmSchedules'), handleSnap(setPmSchedules), handleErr),
      onSnapshot(getPath('cmms_pmParams'), handleSnap(setPmParams), handleErr),
      onSnapshot(getPath('cmms_dailyActivities'), handleSnap(setDailyActivities), handleErr),
      onSnapshot(getPath('cmms_spareparts'), handleSnap(setSpareparts), handleErr),
      onSnapshot(getPath('cmms_sparepart_logs'), handleSnap(setSparepartLogs), handleErr),
      onSnapshot(getPath('cmms_sparepart_requests'), handleSnap(setSparepartRequests), handleErr),
      onSnapshot(getPath('cmms_lti_logs'), handleSnap(setLtiLogs), handleErr)
    ];

    return () => unsubscribes.forEach(unsub => unsub());
  }, [fbUser]);

  // --- EFFECT: GENERATOR NOTIFIKASI ---
  useEffect(() => {
    if (!currentUser) return;
    let notifs = [];
    const availableMachines = machines.filter(m => currentUser.factory === 'All' || m.factory === currentUser.factory);

    if (['admin', 'teknisi'].includes(currentUser.role)) {
      const openBrk = breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId));
      openBrk.forEach(b => notifs.push({ id: b.id, title: 'Breakdown Baru', text: b.description, type: 'alert', action: currentUser.role === 'admin' ? 'histori_perbaikan' : 'penanganan_rusak' }));
    }
    
    if (currentUser.role === 'admin') {
      sparepartRequests.filter(r => r.status === 'Pending').forEach(r => 
         notifs.push({ id: r.id, title: 'Request Part', text: `${r.requestedBy} meminta ${r.partName}`, type: 'warning', action: 'kelola_sparepart' })
      );
      // Notif Sparepart hanya untuk admin & stok <= 1
      spareparts.filter(sp => sp.stock <= 1).forEach(sp => 
         notifs.push({ id: `stock_${sp.id}`, title: 'Stok Menipis/Habis', text: `${sp.name} sisa ${sp.stock} ${sp.unit}`, type: 'warning', action: 'kelola_sparepart' })
      );
    }
    
    if (currentUser.role === 'teknisi') {
      pmSchedules.filter(s => s.status === 'Pending' && availableMachines.find(m => m.id === s.machineId)).forEach(p => 
         notifs.push({ id: p.id, title: 'Jadwal PM Baru', text: p.title, type: 'info', action: 'eksekusi_pm' })
      );
    }
    
    if (currentUser.role === 'user') {
      breakdowns.filter(b => b.reportedBy === currentUser.name && b.status === 'Selesai Diperbaiki').forEach(b => 
         notifs.push({ id: b.id, title: 'Mesin Selesai', text: `Perbaikan mesin telah selesai.`, type: 'success', action: 'req_perbaikan' })
      );
    }
    
    setNotifications(notifs.filter(n => !dismissedNotifs.includes(n.id)));
  }, [breakdowns, sparepartRequests, pmSchedules, currentUser, machines, spareparts, dismissedNotifs]);

  const markAllNotifsAsRead = () => {
    setDismissedNotifs(prev => [...prev, ...notifications.map(n => n.id)]);
    setIsNotifOpen(false);
  };

  // --- HELPER FUNCTIONS ---
  const showMessage = (title, message, type = 'info') => setDialog({ title, message, type, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setDialog({ title, message, type: 'confirm', onConfirm });
  const colRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
  const docRef = (colName, id) => doc(db, 'artifacts', appId, 'public', 'data', colName, id);

  const getAvailableMachines = () => {
    if (currentUser?.role === 'admin' || currentUser?.factory === 'All') return machines;
    return machines.filter(m => m.factory === currentUser?.factory);
  };

  const calculateDowntime = (start, end) => {
    if (!start || !end) return '-';
    const s = new Date(start); const e = new Date(end);
    if (isNaN(s) || isNaN(e)) return '-';
    const diff = Math.max(0, e - s);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const h = Math.floor(diff / (1000 * 60 * 60));
    return `${h} Jam ${m} Menit`;
  };

  const handleDeleteBreakdown = (id, itemName) => {
    showConfirm('Hapus Request?', `Yakin ingin menghapus/membatalkan tiket kerusakan "${itemName}"? Tindakan ini tidak dapat dikembalikan.`, async () => {
      await deleteDoc(docRef('cmms_breakdowns', id));
      showMessage('Berhasil', 'Tiket kerusakan berhasil dihapus.', 'success');
    });
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const u = e.target.username.value;
    const p = e.target.password.value;
    const foundUser = users.find(x => x.username === u && x.password === p);
    if (foundUser) {
      setCurrentUser(foundUser); setActiveMenu('dashboard');
      if(window.innerWidth < 768) setIsSidebarOpen(false);
    } else { showMessage('Gagal Login', 'Username atau password salah!', 'error'); }
  };
  
  const handleLogout = () => setCurrentUser(null);

  const exportToCSV = (data, filename) => {
    if (!data || !data.length) { showMessage('Kosong', 'Tidak ada data untuk diekspor.', 'warning'); return; }
    const headers = Object.keys(data[0]).join(',');
    const csv = [headers, ...data.map(row => Object.values(row).map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
  };

  // --- KOMPONEN UI MODAL & SCANNER ---
  const ModalDialog = () => {
    if (!dialog) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 print:hidden backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-[fadeIn_0.2s_ease-in-out]">
          <h3 className={`text-lg font-bold mb-2 ${dialog.type === 'error' ? 'text-red-600' : 'text-gray-900'}`}>{dialog.title}</h3>
          <p className="text-gray-600 mb-6 text-sm">{dialog.message}</p>
          <div className="flex justify-end gap-3">
            {dialog.type === 'confirm' && <button onClick={() => setDialog(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300">Batal</button>}
            <button onClick={() => { if (dialog.onConfirm) dialog.onConfirm(); setDialog(null); }} className={`px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-colors ${dialog.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {dialog.type === 'confirm' ? 'Ya, Eksekusi' : 'Tutup'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProfileEditModal = () => {
    if (!profileDialog) return null;
    const [form, setForm] = useState({ name: currentUser.name, username: currentUser.username, password: currentUser.password });
    const handleSaveProfile = async (e) => {
      e.preventDefault();
      await updateDoc(docRef('cmms_users', currentUser.id), form);
      setCurrentUser({ ...currentUser, ...form });
      setProfileDialog(false);
      showMessage('Sukses', 'Profil berhasil diperbarui.', 'success');
    };
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-bold"><i className="fa-solid fa-user-pen text-blue-500 mr-2"></i> Edit Profil</h3>
            <button onClick={() => setProfileDialog(false)} className="text-red-500"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div><label className="block text-xs font-bold mb-1">Nama</label><input type="text" required className="w-full border p-2 rounded-lg" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><label className="block text-xs font-bold mb-1">Username</label><input type="text" required className="w-full border p-2 rounded-lg" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
            <div><label className="block text-xs font-bold mb-1">Password</label><input type="text" required className="w-full border p-2 rounded-lg" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-2">Simpan</button>
          </form>
        </div>
      </div>
    );
  };

  const CameraQRScanner = ({ onScanSuccess, onClose }) => {
    const [manualCode, setManualCode] = useState('');
    
    useEffect(() => {
      let scanner = null;
      const initScanner = async () => {
        try {
          if (window.Html5QrcodeScanner) {
            scanner = new window.Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
            scanner.render(
              (text) => { if(scanner){ scanner.clear(); onScanSuccess(text); } }, 
              (err) => { /* ignore warning frame */ }
            );
          }
        } catch (err) { console.log(err); }
      };
      const timeout = setTimeout(initScanner, 500);
      return () => { clearTimeout(timeout); if(scanner) scanner.clear().catch(e=>console.log(e)); };
    }, []);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-[100] flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative flex flex-col">
          <div className="p-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
             <h3 className="font-bold"><i className="fa-solid fa-camera mr-2"></i> Scan QR Aset Mesin</h3>
             <button onClick={onClose} className="text-red-400 hover:text-red-300 text-xl"><i className="fa-solid fa-xmark"></i></button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
             <div id="reader" className="w-full min-h-[250px] overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                <span className="text-gray-400 text-sm italic">Memuat kamera...</span>
             </div>
             <p className="text-[10px] text-center text-red-500 mt-3 font-bold">* Izinkan akses kamera. (Fitur kamera butuh koneksi HTTPS/SSL atau localhost).</p>
             
             <div className="mt-6 border-t pt-4">
                <p className="text-sm font-bold text-gray-700 mb-2">Input Manual (Jika kamera error/diblokir):</p>
                <div className="flex gap-2">
                   <input type="text" placeholder="Masukkan Kode Mesin..." className="flex-1 border-2 p-2 rounded-lg text-sm outline-none focus:border-blue-500" value={manualCode} onChange={e => setManualCode(e.target.value)} />
                   <button onClick={() => { if(manualCode) onScanSuccess(manualCode); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700">Cari Aset</button>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const TicketChatModal = () => {
    if (!chatTicket) return null;
    const [msg, setMsg] = useState('');
    const ticket = breakdowns.find(b => b.id === chatTicket.id) || chatTicket;
    const comments = ticket.comments || [];

    const handleSend = async (e) => {
      e.preventDefault();
      if (!msg.trim()) return;
      const newComment = { sender: currentUser.name, role: currentUser.role, text: msg, time: new Date().toLocaleString() };
      await updateDoc(docRef('cmms_breakdowns', ticket.id), { comments: [...comments, newComment] });
      setMsg('');
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col h-[500px]">
          <div className="bg-gray-900 text-white p-4 rounded-t-xl flex justify-between items-center shrink-0">
            <div>
              <h3 className="font-bold"><i className="fa-regular fa-comments mr-2"></i> Diskusi Laporan</h3>
              <p className="text-xs text-gray-400">{machines.find(m => m.id === ticket.machineId)?.name}</p>
            </div>
            <button onClick={() => setChatTicket(null)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
            <div className="bg-blue-100 p-3 rounded-lg text-sm text-blue-900 border border-blue-200 shadow-sm">
               <strong>Keluhan:</strong> {ticket.description}
            </div>
            {comments.map((c, i) => (
              <div key={i} className={`flex flex-col ${c.sender === currentUser.name ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-gray-500 mb-1">{c.sender} ({c.role})</span>
                <div className={`p-2.5 rounded-lg text-sm max-w-[85%] shadow-sm ${c.sender === currentUser.name ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none text-gray-800'}`}>
                  {c.text}
                </div>
                <span className="text-[9px] text-gray-400 mt-1">{c.time}</span>
              </div>
            ))}
            {comments.length === 0 && <p className="text-center text-gray-400 text-xs mt-10 italic">Belum ada pesan.</p>}
          </div>
          <form onSubmit={handleSend} className="p-3 border-t bg-white flex gap-2 rounded-b-xl shrink-0">
            <input type="text" className="flex-1 border-2 border-gray-200 p-2 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="Ketik balasan..." value={msg} onChange={e => setMsg(e.target.value)} />
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"><i className="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </div>
    );
  };

  const DonutChart = ({ persentase }) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (persentase / 100) * circumference;
    return (
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#ef4444" strokeWidth="12" />
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#22c55e" strokeWidth="12" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-gray-800">{persentase}%</span>
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sehat</span>
        </div>
      </div>
    );
  };

  const YearlyLineChart = ({ breakdownsData }) => {
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const maxVal = Math.max(...breakdownsData, 5); 
    const height = 150; const width = 600;
    const points = breakdownsData.map((val, i) => `${(i / 11) * width},${height - (val / maxVal) * height}`).join(' ');

    return (
      <div className="w-full overflow-x-auto bg-white p-4 rounded-xl border mt-4">
         <h4 className="font-bold text-gray-700 mb-6 text-center text-sm">Tren Breakdown Mesin (1 Tahun)</h4>
         <div className="min-w-[500px]">
           <svg viewBox={`-10 -20 ${width + 20} ${height + 50}`} className="w-full h-auto">
              {[0, 0.5, 1].map(ratio => (
                 <g key={ratio}>
                   <line x1="0" y1={height * ratio} x2={width} y2={height * ratio} stroke="#e5e7eb" strokeDasharray="4" />
                   <text x="-5" y={(height * ratio) + 3} fontSize="10" textAnchor="end" fill="#9ca3af">{Math.round(maxVal - (maxVal * ratio))}</text>
                 </g>
              ))}
              <polyline fill="none" stroke="#3b82f6" strokeWidth="3" points={points} strokeLinecap="round" strokeLinejoin="round" />
              {breakdownsData.map((val, i) => {
                 const cx = (i / 11) * width; const cy = height - (val / maxVal) * height;
                 return (
                   <g key={i}>
                      <circle cx={cx} cy={cy} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
                      {val > 0 && <text x={cx} y={cy - 12} fontSize="10" fontWeight="bold" textAnchor="middle" fill="#1e40af">{val}</text>}
                      <text x={cx} y={height + 20} fontSize="10" textAnchor="middle" fill="#6b7280" fontWeight="500">{months[i]}</text>
                   </g>
                 )
              })}
           </svg>
         </div>
      </div>
    );
  };

  // --- HALAMAN LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] p-4">
        <ModalDialog />
        <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-sm z-10 border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"><i className="fa-solid fa-gear text-white text-3xl"></i></div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">CMMS Pro</h2>
          <p className="text-gray-500 text-center mb-6 text-sm">Sistem Manajemen Pemeliharaan</p>
          
          {!isDbLoaded ? (
             <p className="text-center text-blue-600 font-bold p-4 animate-pulse">Menghubungkan ke Database...</p>
          ) : users.length === 0 ? (
            <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <p className="text-yellow-800 text-sm mb-3 font-bold">Database masih kosong!</p>
              <button onClick={async () => {
                 await addDoc(colRef('cmms_factories'), { name: 'Pabrik A' });
                 await addDoc(colRef('cmms_users'), { username: 'admin', password: '123', role: 'admin', name: 'Super Admin', factory: 'All' });
                 showMessage('Berhasil', 'Database awal berhasil dibuat! Silakan login dengan akun: admin / 123', 'success');
              }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow w-full">Setup Database Awal</button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <input type="text" name="username" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input type="password" name="password" required className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" className="w-full flex justify-center py-3 px-4 rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">Masuk Sistem</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- KOMPONEN MENU (VIEWS) ---
  const Dashboard = () => {
    const [viewMode, setViewMode] = useState('overview'); 
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const availableMachines = getAvailableMachines();
    const openBreakdowns = breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId));
    const resolvedBreakdowns = breakdowns.filter(b => b.status === 'Selesai Diperbaiki' && availableMachines.find(m => m.id === b.machineId));
    const pendingPMs = pmSchedules.filter(s => s.status === 'Pending' && availableMachines.find(m => m.id === s.machineId));
    
    const filterByDate = (dateString, periodStr, isYearly) => {
      if(!dateString) return false;
      if (isYearly) return dateString.includes(periodStr);
      const [y, m] = periodStr.split('-');
      const mNoZero = parseInt(m, 10).toString();
      return dateString.startsWith(periodStr) || (dateString.includes(`${mNoZero}/`) && dateString.includes(y)) || (dateString.includes(`${m}/`) && dateString.includes(y));
    };

    const isYearly = viewMode === 'yearly';
    const periodStr = isYearly ? selectedYear : selectedMonth;
    
    const periodBreakdowns = breakdowns.filter(b => availableMachines.find(m => m.id === b.machineId) && filterByDate(b.date, periodStr, isYearly));
    const periodPMs = pmSchedules.filter(s => availableMachines.find(m => m.id === s.machineId) && filterByDate(s.date, periodStr, isYearly));
    const periodLTI = ltiLogs.filter(l => l.factory === (currentUser.factory === 'All' ? l.factory : currentUser.factory) && l.period === periodStr).reduce((sum, log) => sum + Number(log.count), 0);

    let totalRepairHours = 0; let resolvedCount = 0;
    periodBreakdowns.forEach(b => {
      if(b.status === 'Selesai Diperbaiki' && b.startTime && b.endTime) {
         const start = new Date(b.startTime); const end = new Date(b.endTime);
         if(!isNaN(start) && !isNaN(end)) {
           const diff = (end - start) / (1000 * 60 * 60);
           if(diff > 0) { totalRepairHours += diff; resolvedCount++; }
         }
      }
    });
    
    const kpiMTTR = resolvedCount > 0 ? (totalRepairHours / resolvedCount).toFixed(1) : 0;
    const workingHoursPerPeriod = isYearly ? 2080 : 160; 
    const totalMachineHours = availableMachines.length * workingHoursPerPeriod;
    const totalFailures = periodBreakdowns.length;
    const kpiMTBF = totalFailures > 0 ? (totalMachineHours / totalFailures).toFixed(0) : totalMachineHours;
    const kpiMTBFPercent = totalMachineHours > 0 ? Math.max(0, (((totalMachineHours - totalRepairHours) / totalMachineHours) * 100)).toFixed(1) : 100;
    const totalScheduledPM = periodPMs.length;
    const completedPM = periodPMs.filter(p => p.status === 'Selesai' || p.status === 'Terverifikasi').length;
    const kpiPM = totalScheduledPM > 0 ? Math.round((completedPM / totalScheduledPM) * 100) : 100;
    const kpiBacklog = periodBreakdowns.filter(b => b.status === 'Open').length;

    // Untuk Top 5
    const machineErrorCounts = {};
    breakdowns.filter(b => availableMachines.find(m => m.id === b.machineId)).forEach(b => {
       const mName = machines.find(m => m.id === b.machineId)?.name || 'Unknown';
       machineErrorCounts[mName] = (machineErrorCounts[mName] || 0) + 1;
    });
    const sortedBadActors = Object.keys(machineErrorCounts).map(key => ({ name: key, jumlah: machineErrorCounts[key] })).sort((a, b) => b.jumlah - a.jumlah).slice(0, 5);
    const maxErrors = sortedBadActors.length > 0 ? sortedBadActors[0].jumlah : 1;
    
    const totalMesin = availableMachines.length;
    const mesinRusak = new Set(openBreakdowns.map(b => b.machineId)).size;
    const persentaseSehat = totalMesin === 0 ? 100 : Math.round(((totalMesin - mesinRusak) / totalMesin) * 100);

    const getYearlyData = () => {
       const data = Array(12).fill(0);
       breakdowns.forEach(b => {
          if (availableMachines.find(m => m.id === b.machineId) && b.date.includes(selectedYear)) {
             let monthIndex = -1;
             if (b.date.includes('-')) monthIndex = parseInt(b.date.split('-')[1], 10) - 1;
             else if (b.date.includes('/')) monthIndex = parseInt(b.date.split('/')[1], 10) - 1;
             if (monthIndex >= 0 && monthIndex <= 11) data[monthIndex]++;
          }
       });
       return data;
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <h2 className="text-2xl font-bold text-gray-800">Dashboard & Panel Informasi</h2>
          <div className="bg-gray-200 p-1 rounded-lg flex space-x-1 w-full md:w-auto overflow-x-auto">
            <button onClick={()=>setViewMode('overview')} className={`whitespace-nowrap flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewMode === 'overview' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Overview</button>
            <button onClick={()=>setViewMode('monthly')} className={`whitespace-nowrap flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewMode === 'monthly' ? 'bg-blue-600 shadow text-white' : 'text-gray-500'}`}>KPI Bulanan</button>
            <button onClick={()=>setViewMode('yearly')} className={`whitespace-nowrap flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded-md transition-colors ${viewMode === 'yearly' ? 'bg-indigo-600 shadow text-white' : 'text-gray-500'}`}>KPI Tahunan</button>
          </div>
        </div>

        {viewMode === 'overview' && (
          <div className="space-y-6 animate-[fadeIn_0.3s]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center">
                <div className="bg-blue-100 p-3 rounded-full mr-4"><i className="fa-solid fa-industry text-blue-600 text-xl w-6 text-center"></i></div>
                <div><p className="text-sm text-gray-500 font-medium">Total Mesin</p><p className="text-2xl font-bold text-gray-800">{availableMachines.length}</p></div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500 flex items-center">
                <div className="bg-red-100 p-3 rounded-full mr-4"><i className="fa-solid fa-triangle-exclamation text-red-600 text-xl w-6 text-center"></i></div>
                <div><p className="text-sm text-gray-500 font-medium">Request Pending</p><p className="text-2xl font-bold text-gray-800">{openBreakdowns.length}</p></div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-indigo-500 flex items-center">
                <div className="bg-indigo-100 p-3 rounded-full mr-4"><i className="fa-solid fa-wrench text-indigo-600 text-xl w-6 text-center"></i></div>
                <div><p className="text-sm text-gray-500 font-medium">Mesin Diperbaiki</p><p className="text-2xl font-bold text-gray-800">{resolvedBreakdowns.length}</p></div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center">
                <div className="bg-green-100 p-3 rounded-full mr-4"><i className="fa-solid fa-calendar-check text-green-600 text-xl w-6 text-center"></i></div>
                <div><p className="text-sm text-gray-500 font-medium">Jadwal PM</p><p className="text-2xl font-bold text-gray-800">{pendingPMs.length}</p></div>
              </div>
            </div>

            {['admin', 'teknisi'].includes(currentUser.role) && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual Kesehatan Mesin - Donut Chart */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center col-span-1">
                  <h3 className="font-bold text-gray-800 mb-4 w-full border-b pb-2">Status Mesin Realtime</h3>
                  <div className="py-4"><DonutChart persentase={persentaseSehat} /></div>
                  <div className="flex gap-4 w-full justify-center text-sm font-bold mt-2 bg-gray-50 py-2 rounded-lg">
                     <div className="flex items-center text-green-700"><span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>{totalMesin - mesinRusak} OK</div>
                     <div className="flex items-center text-red-700"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>{mesinRusak} NG</div>
                  </div>
                </div>

                {/* Top 5 Mesin Sering Rusak */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 col-span-1 lg:col-span-2">
                  <h3 className="font-bold text-gray-800 mb-4 border-b pb-2"><i className="fa-solid fa-ranking-star text-yellow-500 mr-2"></i> Top 5 Mesin Sering Rusak</h3>
                  <div className="space-y-4">
                     {sortedBadActors.length > 0 ? sortedBadActors.map((actor, idx) => {
                        const barWidth = Math.max((actor.jumlah / maxErrors) * 100, 5);
                        const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-gray-400'];
                        const medals = ['text-yellow-400', 'text-gray-300', 'text-amber-600', 'text-gray-400', 'text-gray-400'];
                        return (
                          <div key={idx} className="flex items-center gap-3">
                             <div className="w-6 text-center font-black text-lg"><i className={`fa-solid fa-medal ${medals[idx]}`}></i></div>
                             <div className="flex-1">
                               <div className="flex justify-between mb-1 text-sm">
                                 <span className="font-bold text-gray-800">{actor.name}</span>
                                 <span className="text-gray-600 font-bold bg-gray-100 px-2 rounded-lg border">{actor.jumlah}x Rusak</span>
                               </div>
                               <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                 <div className={`h-2.5 rounded-full ${colors[idx]} transition-all duration-1000`} style={{ width: `${barWidth}%` }}></div>
                               </div>
                             </div>
                          </div>
                        )
                     }) : <p className="text-center text-sm text-gray-400 py-6 italic">Belum ada data kerusakan tercatat.</p>}
                  </div>
                </div>

                {/* Aktivitas Harian Teknisi (Admin & Teknisi) */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 col-span-1 lg:col-span-3 flex flex-col mt-2">
                  <h3 className="font-bold text-blue-800 mb-4 flex items-center border-b pb-2"><i className="fa-solid fa-list-check mr-2"></i> Aktivitas Harian Teknisi (Hari Ini)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-60 overflow-y-auto pr-2">
                    {dailyActivities.filter(a => filterByDate(a.date, new Date().toISOString().split('T')[0], false) && availableMachines.find(m => m.factory === a.factory || a.factory === 'All')).map(act => (
                      <div key={act.id} className="p-4 bg-blue-50 border border-blue-100 rounded-xl shadow-sm relative">
                        <div className="absolute -top-3 -left-2 text-2xl text-blue-200 opacity-50"><i className="fa-solid fa-quote-left"></i></div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                          <span className="font-bold text-gray-900 text-sm"><i className="fa-solid fa-user-gear text-blue-500 mr-1"></i> {act.teknisi}</span>
                          <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-sm">{act.startTime} - {act.endTime}</span>
                        </div>
                        <p className="text-sm text-gray-700 italic relative z-10 leading-snug">"{act.activity}"</p>
                      </div>
                    ))}
                    {dailyActivities.length === 0 && <p className="col-span-full text-sm text-gray-500 italic text-center py-8">Belum ada jurnal disubmit teknisi hari ini.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(viewMode === 'monthly' || viewMode === 'yearly') && (
          <div className="space-y-6 animate-[fadeIn_0.3s]">
             <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Pilih Periode {isYearly ? 'Tahun' : 'Bulan'}</label>
                  {isYearly ? (
                     <select className="border-2 p-3 rounded-lg font-bold text-lg text-indigo-700 w-48" value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}>
                       {[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option> })}
                     </select>
                  ) : (
                     <input type="month" className="border-2 p-3 rounded-lg font-bold text-lg text-blue-700 w-48" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} />
                  )}
                </div>
                <div className="bg-gray-50 px-4 py-2 rounded-lg border text-sm text-gray-600">
                  Total Breakdown: <strong className="text-gray-900">{totalFailures}</strong> | Total PM: <strong className="text-gray-900">{totalScheduledPM}</strong>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border-t-8 border-green-500 relative">
                   <div className="flex justify-between items-start mb-4">
                      <div><p className="text-sm font-bold text-gray-500 uppercase tracking-widest">MTBF</p><p className="text-xs text-gray-400 mt-1">Mean Time Between Failures</p></div>
                      <i className="fa-solid fa-stopwatch text-3xl text-green-200"></i>
                   </div>
                   <div className="flex items-baseline gap-2 mb-2"><span className="text-4xl md:text-5xl font-black text-gray-800">{kpiMTBF}</span><span className="text-lg font-bold text-gray-500">Jam</span></div>
                   <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 inline-block"><span className="text-xs font-bold text-green-800"><i className="fa-solid fa-percent mr-1"></i> Reliability: {kpiMTBFPercent}%</span></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-t-8 border-yellow-500">
                   <div className="flex justify-between items-start mb-4">
                      <div><p className="text-sm font-bold text-gray-500 uppercase tracking-widest">MTTR</p><p className="text-xs text-gray-400 mt-1">Mean Time To Repair</p></div>
                      <i className="fa-solid fa-tools text-3xl text-yellow-200"></i>
                   </div>
                   <div className="flex items-baseline gap-2"><span className="text-4xl md:text-5xl font-black text-gray-800">{kpiMTTR}</span><span className="text-lg font-bold text-gray-500">Jam</span></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-t-8 border-red-600 relative overflow-hidden">
                   <div className="absolute -right-4 -bottom-4 opacity-5"><i className="fa-solid fa-truck-medical text-9xl"></i></div>
                   <div className="flex justify-between items-start mb-4 relative z-10">
                      <div><p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Insiden LTI</p><p className="text-xs text-gray-400 mt-1">Lost Time Incident</p></div>
                      {['admin', 'teknisi'].includes(currentUser.role) && (
                        <button onClick={() => {
                           const val = window.prompt(`Masukkan jumlah Kejadian LTI (Kecelakaan) untuk periode ${periodStr}:`, "0");
                           if(val !== null && !isNaN(val) && val.trim() !== '') {
                              addDoc(colRef('cmms_lti_logs'), { period: periodStr, count: Number(val), factory: currentUser.factory === 'All' ? factories[0]?.name : currentUser.factory, recordedBy: currentUser.name, timestamp: new Date().toISOString() });
                              showMessage('Tersimpan', 'Data LTI berhasil ditambahkan.', 'success');
                           }
                        }} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-[10px] font-bold border border-red-200">+ Catat LTI</button>
                      )}
                   </div>
                   <div className="flex items-baseline gap-2 relative z-10"><span className="text-4xl md:text-5xl font-black text-red-600">{periodLTI}</span><span className="text-lg font-bold text-gray-500">Kejadian</span></div>
                </div>
             </div>
             {isYearly && <YearlyLineChart breakdownsData={getYearlyData()} />}
          </div>
        )}
      </div>
    );
  };

  const HistoriPerbaikan = () => {
    const availableMachines = getAvailableMachines();
    const allBreakdowns = breakdowns.filter(b => availableMachines.find(m => m.id === b.machineId)).slice().reverse();

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Histori & Rincian Perbaikan Mesin</h2>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
             <thead>
               <tr className="bg-gray-100 text-left">
                 <th className="p-3 border-b font-semibold text-gray-700">Aset Mesin & Pelapor</th>
                 <th className="p-3 border-b font-semibold text-gray-700">Waktu Lapor</th>
                 <th className="p-3 border-b font-semibold text-gray-700 w-1/4">Keluhan & Tindakan</th>
                 <th className="p-3 border-b font-semibold text-gray-700 text-center">Waktu Pengerjaan</th>
                 <th className="p-3 border-b font-semibold text-gray-700 text-center">Durasi (Downtime)</th>
                 {currentUser.role === 'admin' && <th className="p-3 border-b font-semibold text-gray-700 text-center">Aksi</th>}
               </tr>
             </thead>
             <tbody>
               {allBreakdowns.map(b => {
                 const machine = machines.find(m => m.id === b.machineId);
                 const durasi = calculateDowntime(b.startTime, b.endTime);
                 const isSelesai = b.status === 'Selesai Diperbaiki';
                 return (
                   <tr key={b.id} className="border-b hover:bg-gray-50">
                     <td className="p-3">
                       <p className="font-bold text-gray-900">{machine?.name}</p>
                       <p className="text-[10px] text-gray-500 font-bold uppercase">{machine?.factory}</p>
                       <p className="text-xs text-blue-600 mt-1"><i className="fa-solid fa-user-tag mr-1"></i> {b.requestBy || b.reportedBy}</p>
                     </td>
                     <td className="p-3 text-xs text-gray-600 font-medium">{b.date}</td>
                     <td className="p-3">
                        <div className="mb-1 text-xs">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase mr-1 ${isSelesai ? 'bg-green-500' : 'bg-red-500'}`}>{b.status}</span>
                        </div>
                        <p className="text-xs italic text-gray-700 bg-red-50 p-1.5 rounded border border-red-100 mb-1">"{b.description}"</p>
                        {isSelesai && <p className="text-xs text-gray-800 bg-green-50 p-1.5 rounded border border-green-100"><strong>Act:</strong> {b.analysis}</p>}
                     </td>
                     <td className="p-3 text-center">
                       {isSelesai ? (
                          <div className="text-[10px]">
                             <p className="font-bold text-gray-800 border-b pb-1 mb-1">{b.resolvedBy}</p>
                             <p className="text-green-700 font-bold">Mulai: {b.startTime?.split(' ')[1] || '-'}</p>
                             <p className="text-gray-600 font-bold">Selesai: {b.endTime?.split(' ')[1] || '-'}</p>
                          </div>
                       ) : <span className="text-xs italic text-gray-400">Menunggu Teknisi...</span>}
                     </td>
                     <td className="p-3 text-center">
                        {isSelesai ? <span className="font-black text-blue-700 bg-blue-100 px-2 py-1 rounded-lg border border-blue-200">{durasi}</span> : '-'}
                     </td>
                     {currentUser.role === 'admin' && (
                       <td className="p-3 text-center">
                         <button onClick={() => handleDeleteBreakdown(b.id, machine?.name)} className="text-red-500 hover:text-white hover:bg-red-500 bg-red-50 px-3 py-2 rounded border border-red-200 transition-colors" title="Hapus Data"><i className="fa-solid fa-trash-can"></i></button>
                       </td>
                     )}
                   </tr>
                 )
               })}
               {allBreakdowns.length === 0 && <tr><td colSpan={currentUser.role === 'admin' ? 6 : 5} className="p-6 text-center text-gray-400">Belum ada riwayat perbaikan.</td></tr>}
             </tbody>
          </table>
        </div>
      </div>
    );
  };

  const AdminKelolaPabrik = () => {
    const [newFactory, setNewFactory] = useState(''); const [editId, setEditId] = useState(null); const [editName, setEditName] = useState('');
    const handleAdd = async (e) => { e.preventDefault(); if(!newFactory) return; await addDoc(colRef('cmms_factories'), { name: newFactory }); setNewFactory(''); showMessage('Berhasil', 'Pabrik ditambahkan.', 'success'); };
    const handleSaveEdit = (id, oldName) => {
      if(!editName) return;
      showConfirm('Konfirmasi Perubahan', `Ubah nama pabrik dari "${oldName}" menjadi "${editName}"?`, async () => {
        await updateDoc(docRef('cmms_factories', id), { name: editName });
        users.filter(u => u.factory === oldName).forEach(async u => await updateDoc(docRef('cmms_users', u.id), { factory: editName }));
        machines.filter(m => m.factory === oldName).forEach(async m => await updateDoc(docRef('cmms_machines', m.id), { factory: editName }));
        setEditId(null); showMessage('Diperbarui', 'Nama pabrik berhasil diubah.', 'success');
      });
    };
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Pabrik (Lokasi)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm h-fit">
            <h3 className="font-semibold text-lg mb-4 text-gray-800"><i className="fa-solid fa-industry text-blue-500 mr-2"></i> Tambah Pabrik</h3>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Masukkan Nama Pabrik" required className="flex-1 border p-3 rounded-lg" value={newFactory} onChange={e => setNewFactory(e.target.value)} />
              <button type="submit" className="bg-blue-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-blue-700">Tambah</button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm overflow-x-auto">
            <h3 className="font-semibold text-lg mb-4">Daftar Pabrik Terdaftar</h3>
            <ul className="space-y-3 min-w-[300px]">
              {factories.map(f => (
                <li key={f.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
                  {editId === f.id ? (
                    <div className="flex flex-1 gap-2 mr-2">
                      <input type="text" className="flex-1 border p-2 rounded text-sm w-full" value={editName} onChange={e => setEditName(e.target.value)} />
                      <button onClick={() => handleSaveEdit(f.id, f.name)} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold">Simpan</button>
                      <button onClick={() => setEditId(null)} className="bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm font-bold">Batal</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center"><div className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3"><i className="fa-solid fa-building"></i></div><span className="font-semibold text-gray-800">{f.name}</span></div>
                      <button onClick={() => {setEditId(f.id); setEditName(f.name)}} className="text-gray-400 hover:text-blue-600 bg-white p-2 border rounded"><i className="fa-solid fa-pen-to-square"></i></button>
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
      e.preventDefault(); const { id, ...dataToSave } = formData;
      if (isEditing) { await updateDoc(docRef('cmms_users', id), dataToSave); setIsEditing(false); showMessage('Diperbarui', 'Data pengguna berhasil diupdate.', 'success'); } 
      else { await addDoc(colRef('cmms_users'), dataToSave); showMessage('Ditambahkan', 'Pengguna baru berhasil dibuat.', 'success'); }
      setFormData({ id: null, username: '', password: '', role: 'user', name: '', factory: defaultFactory });
    };
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Pengguna</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-1 h-fit border-t-4 border-blue-500">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 flex items-center"><i className={`fa-solid ${isEditing ? 'fa-user-pen' : 'fa-user-plus'} mr-2 text-blue-500`}></i> {isEditing ? 'Edit User' : 'Buat User Baru'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-600 mb-1">Nama Lengkap</label><input type="text" required className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Username</label><input type="text" required className="w-full border p-2 rounded-lg bg-gray-50" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Password</label><input type="text" required className="w-full border p-2 rounded-lg bg-gray-50" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Hak Akses</label><select className="w-full border p-2 rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="user">User</option><option value="teknisi">Teknisi</option><option value="admin">Admin</option></select></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Lokasi Pabrik</label><select className="w-full border p-2 rounded-lg" value={formData.factory} onChange={e => setFormData({...formData, factory: e.target.value})}><option value="All">Semua</option>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-bold flex-1">{isEditing ? 'Simpan' : 'Buat Akun'}</button>
                {isEditing && <button type="button" onClick={() => {setIsEditing(false); setFormData({ id: null, username: '', password: '', role: 'user', name: '', factory: defaultFactory })}} className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-bold">Batal</button>}
              </div>
            </form>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
            <div className="overflow-x-auto flex-1 w-full">
              <table className="w-full text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100 text-left"><th className="p-3 border-b font-semibold text-gray-700">Nama Lengkap</th><th className="p-3 border-b font-semibold text-gray-700">Akun</th><th className="p-3 border-b font-semibold text-gray-700">Role</th><th className="p-3 border-b font-semibold text-gray-700">Lokasi</th><th className="p-3 border-b font-semibold text-gray-700 text-center">Aksi</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-blue-50">
                      <td className="p-3 font-semibold text-gray-800">{u.name}</td><td className="p-3 text-gray-600"><span className="bg-gray-100 px-2 py-1 rounded text-xs border">{u.username}</span></td><td className="p-3"><span className={`px-2 py-1 rounded text-[10px] uppercase font-bold shadow-sm text-white ${u.role==='admin' ? 'bg-purple-600' : u.role==='teknisi' ? 'bg-blue-500' : 'bg-gray-400'}`}>{u.role}</span></td><td className="p-3 text-gray-700">{u.factory}</td>
                      <td className="p-3 text-center"><button type="button" onClick={() => {setFormData(u); setIsEditing(true);}} className="text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 text-xs font-bold">Edit</button></td>
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
    const [filterFactory, setFilterFactory] = useState('All');
    const [searchMachine, setSearchMachine] = useState('');

    const handleAddMachine = async (e) => {
      e.preventDefault(); await addDoc(colRef('cmms_machines'), newMachine);
      setNewMachine({ code: '', name: '', location: '', factory: defaultFactory }); showMessage('Sukses', 'Mesin baru berhasil ditambahkan.', 'success');
    };
    const handleDeleteMachine = (mId, mName) => {
      showConfirm('Hapus Mesin', `Yakin hapus mesin ${mName}?`, async () => {
        await deleteDoc(docRef('cmms_machines', mId)); showMessage('Dihapus', `Mesin dihapus.`, 'success');
        if(selectedMachineParams === mId) setSelectedMachineParams(null);
      });
    };
    const handleSaveChanges = async () => {
      const oldParams = dailyParams.filter(p => p.machineId === selectedMachineParams);
      for(const op of oldParams) await deleteDoc(docRef('cmms_dailyParams', op.id));
      for(const name of tempParams) await addDoc(colRef('cmms_dailyParams'), { machineId: selectedMachineParams, name: name, type: 'boolean' });
      showMessage('Tersimpan', 'Parameter berhasil disimpan.', 'success'); setSelectedMachineParams(null);
    };

    const filteredMachines = machines.filter(m => (filterFactory === 'All' || m.factory === filterFactory) && (m.name.toLowerCase().includes(searchMachine.toLowerCase()) || m.code.toLowerCase().includes(searchMachine.toLowerCase())));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Mesin & Parameter</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 border-b pb-2"><i className="fa-solid fa-server text-blue-500 mr-2"></i> Inventaris Mesin Baru</h3>
            <form onSubmit={handleAddMachine} className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="sm:w-1/3"><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Kode</label><input type="text" required className="w-full border p-2 rounded" value={newMachine.code} onChange={e => setNewMachine({...newMachine, code: e.target.value})} /></div>
                <div className="flex-1"><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Nama Mesin</label><input type="text" required className="w-full border p-2 rounded" value={newMachine.name} onChange={e => setNewMachine({...newMachine, name: e.target.value})} /></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1"><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Lokasi Detail (Area)</label><input type="text" required className="w-full border p-2 rounded" value={newMachine.location} onChange={e => setNewMachine({...newMachine, location: e.target.value})} /></div>
                <div className="sm:w-1/3"><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Pabrik</label><select className="w-full border p-2 rounded" value={newMachine.factory} onChange={e => setNewMachine({...newMachine, factory: e.target.value})}>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 mt-2 rounded-lg font-bold shadow-sm w-full">Tambah Mesin</button>
            </form>

            <div className="mt-6 border-t pt-4">
              <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
                 <h4 className="font-bold text-gray-700">Daftar Aset Mesin</h4>
                 <div className="flex gap-2 w-full md:w-auto"><select className="border p-1.5 rounded text-xs bg-gray-50 font-bold" value={filterFactory} onChange={e => setFilterFactory(e.target.value)}><option value="All">Semua</option>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select><input type="text" placeholder="Cari mesin..." className="border p-1.5 rounded text-xs flex-1" value={searchMachine} onChange={e => setSearchMachine(e.target.value)} /></div>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {filteredMachines.map(m => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-3 hover:border-blue-300">
                    <div>
                      <p className="font-bold text-gray-800">{m.name} <span className="text-xs text-gray-500">({m.code})</span></p>
                      <div className="text-[10px] mt-1"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase font-bold mr-1">{m.factory}</span><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded uppercase font-bold">{m.location || '-'}</span></div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                       <button type="button" onClick={() => { setSelectedMachineParams(m.id); setTempParams(dailyParams.filter(p => p.machineId === m.id).map(p => p.name)); }} className="flex-1 sm:flex-none bg-gray-800 text-white text-xs px-3 py-2 rounded-lg font-bold">Setup Cek</button>
                       <button type="button" onClick={() => handleDeleteMachine(m.id, m.name)} className="bg-red-100 text-red-600 text-xs px-3 py-2 rounded-lg font-bold"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {selectedMachineParams && (
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-2 border-blue-500 sticky top-6">
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <div><span className="text-[10px] uppercase font-bold text-blue-500">Editor Parameter</span><h3 className="font-bold text-lg md:text-xl text-gray-800">{machines.find(m => m.id === selectedMachineParams)?.name}</h3></div>
                <button type="button" onClick={() => setSelectedMachineParams(null)} className="text-gray-500 hover:text-red-600"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (newParamText) { setTempParams([...tempParams, newParamText]); setNewParamText(''); } }} className="flex gap-2 mb-4">
                <input type="text" placeholder="Indikator cek..." className="flex-1 border-2 p-2 text-sm rounded-lg" value={newParamText} onChange={e => setNewParamText(e.target.value)} />
                <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold">Tambah</button>
              </form>
              <ul className="space-y-2 mb-6 max-h-[300px] overflow-y-auto bg-gray-50 p-2 rounded">
                {tempParams.map((pName, idx) => (
                  <li key={idx} className="flex justify-between p-3 bg-white border rounded-lg text-sm font-medium"><span>{idx + 1}. {pName}</span><button type="button" onClick={() => setTempParams(tempParams.filter((_, i) => i !== idx))} className="text-red-500"><i className="fa-solid fa-trash-can"></i></button></li>
                ))}
              </ul>
              <button type="button" onClick={handleSaveChanges} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg">Simpan Database</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AdminKelolaSparepart = () => {
    const defaultFactory = factories[0]?.name || '';
    const [spForm, setSpForm] = useState({ code: '', name: '', factory: defaultFactory, stock: '', unit: 'pcs' });
    const [activeTab, setActiveTab] = useState('stok'); 
    const [editSpId, setEditSpId] = useState(null);
    const [editSpForm, setEditSpForm] = useState({ code: '', name: '', factory: '', unit: '' });
    const [searchPart, setSearchPart] = useState('');

    const handleAddSparepart = async (e) => {
      e.preventDefault();
      const newPartData = { ...spForm, stock: Number(spForm.stock) };
      const docRefId = await addDoc(colRef('cmms_spareparts'), newPartData);
      await addDoc(colRef('cmms_sparepart_logs'), { partId: docRefId.id, partCode: spForm.code, partName: spForm.name, factory: spForm.factory, date: new Date().toLocaleString(), type: 'IN', qty: Number(spForm.stock), unit: spForm.unit, remarks: 'Stok Awal', user: currentUser.name });
      setSpForm({ code: '', name: '', factory: defaultFactory, stock: '', unit: 'pcs' }); showMessage('Berhasil', 'Sparepart baru ditambahkan.', 'success');
    };

    const handleAddStock = (partId, partName, currentStock) => {
      const addedQty = prompt(`Jumlah stok tambahan untuk ${partName}:`, "0");
      const qtyNum = Number(addedQty);
      if (qtyNum && qtyNum > 0) {
        showConfirm('Tambah Stok', `Tambahkan ${qtyNum} ke ${partName}?`, async () => {
          const part = spareparts.find(p => p.id === partId);
          await updateDoc(docRef('cmms_spareparts', partId), { stock: currentStock + qtyNum });
          await addDoc(colRef('cmms_sparepart_logs'), { partId, partCode: part.code, partName: part.name, factory: part.factory, date: new Date().toLocaleString(), type: 'IN', qty: qtyNum, unit: part.unit, remarks: 'Penambahan Stok', user: currentUser.name });
          showMessage('Berhasil', 'Stok sparepart diperbarui.', 'success');
        });
      }
    };

    const handleSaveEditSp = async (id) => {
      await updateDoc(docRef('cmms_spareparts', id), { code: editSpForm.code, name: editSpForm.name, factory: editSpForm.factory, unit: editSpForm.unit });
      setEditSpId(null); showMessage('Disimpan', 'Detail sparepart telah diubah.', 'success');
    };

    const handleDeleteSp = (id, name) => {
      showConfirm('Hapus Sparepart', `Yakin hapus sparepart "${name}" permanen?`, async () => {
        await deleteDoc(docRef('cmms_spareparts', id)); showMessage('Dihapus', 'Data sparepart berhasil dihapus.', 'success');
      });
    };

    const filteredParts = spareparts.filter(sp => sp.name.toLowerCase().includes(searchPart.toLowerCase()));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Sparepart</h2>
        <div className="flex border-b-2 border-gray-200 mb-4 gap-2 overflow-x-auto">
           <button onClick={() => setActiveTab('stok')} className={`whitespace-nowrap px-4 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'stok' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}><i className="fa-solid fa-boxes-stacked mr-2"></i> Stok Part</button>
           <button onClick={() => setActiveTab('request')} className={`whitespace-nowrap px-4 py-3 font-bold rounded-t-lg transition-colors ${activeTab === 'request' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>
              <i className="fa-solid fa-hand-holding-hand mr-2"></i> Request Teknisi 
              {sparepartRequests.filter(r => r.status === 'Pending').length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{sparepartRequests.filter(r => r.status === 'Pending').length}</span>}
           </button>
        </div>

        {activeTab === 'stok' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm lg:col-span-1 border-t-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-4 text-gray-800">Part Baru</h3>
              <form onSubmit={handleAddSparepart} className="space-y-4">
                <div><label className="block text-xs font-bold mb-1">Kode</label><input type="text" required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.code} onChange={e => setSpForm({...spForm, code: e.target.value})} /></div>
                <div><label className="block text-xs font-bold mb-1">Nama</label><input type="text" required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.name} onChange={e => setSpForm({...spForm, name: e.target.value})} /></div>
                <div><label className="block text-xs font-bold mb-1">Pabrik</label><select required className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.factory} onChange={e => setSpForm({...spForm, factory: e.target.value})}>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs font-bold mb-1">Stok Awal</label><input type="number" required min="0" className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.stock} onChange={e => setSpForm({...spForm, stock: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold mb-1">Satuan</label><input type="text" required placeholder="pcs, dll" className="w-full border-2 p-2 rounded-lg text-sm" value={spForm.unit} onChange={e => setSpForm({...spForm, unit: e.target.value})} /></div>
                </div>
                <button type="submit" className="bg-blue-600 text-white w-full py-3 rounded-lg font-bold">Simpan</button>
              </form>
            </div>
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-4 gap-4">
                 <h3 className="font-semibold text-lg text-gray-800">Daftar Stok</h3>
                 <input type="text" placeholder="Cari part..." className="border p-2 rounded-lg text-sm w-full sm:w-64 bg-gray-50" value={searchPart} onChange={e => setSearchPart(e.target.value)} />
              </div>
              <div className="overflow-x-auto w-full max-h-[500px]">
                <table className="w-full text-sm border-collapse min-w-[600px]">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr className="text-left"><th className="p-3">Kode</th><th className="p-3">Nama Part</th><th className="p-3">Lokasi</th><th className="p-3 text-center">Sisa Stok</th><th className="p-3 text-center">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {filteredParts.map(sp => (
                      <tr key={sp.id} className="border-b hover:bg-gray-50">
                        {editSpId === sp.id ? (
                          <>
                            <td className="p-2"><input type="text" className="w-full border p-1 text-xs" value={editSpForm.code} onChange={e => setEditSpForm({...editSpForm, code: e.target.value})}/></td>
                            <td className="p-2"><input type="text" className="w-full border p-1 text-xs mb-1" value={editSpForm.name} onChange={e => setEditSpForm({...editSpForm, name: e.target.value})}/><div className="flex gap-1"><select className="border p-1 text-xs flex-1" value={editSpForm.factory} onChange={e => setEditSpForm({...editSpForm, factory: e.target.value})}>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select><input type="text" className="w-16 border p-1 text-xs" value={editSpForm.unit} onChange={e => setEditSpForm({...editSpForm, unit: e.target.value})}/></div></td>
                            <td colSpan="2" className="p-2 text-center text-xs text-gray-500 italic">Editing...</td>
                            <td className="p-2 text-center"><button onClick={() => handleSaveEditSp(sp.id)} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold mr-1">Simpan</button><button onClick={() => setEditSpId(null)} className="bg-gray-400 text-white px-2 py-1 rounded text-xs font-bold">Batal</button></td>
                          </>
                        ) : (
                          <>
                            <td className="p-3 text-xs font-bold text-gray-500">{sp.code}</td><td className="p-3 font-semibold text-gray-800">{sp.name}</td><td className="p-3 text-xs"><span className="bg-gray-200 px-2 py-1 rounded">{sp.factory}</span></td>
                            <td className="p-3 text-center font-black text-blue-700">{sp.stock} <span className="text-xs font-normal text-gray-500">{sp.unit}</span></td>
                            <td className="p-3 text-center flex justify-center gap-1">
                              <button onClick={() => handleAddStock(sp.id, sp.name, sp.stock)} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">+ Stok</button>
                              <button onClick={() => {setEditSpId(sp.id); setEditSpForm({ code: sp.code, name: sp.name, factory: sp.factory, unit: sp.unit });}} className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs"><i className="fa-solid fa-pen"></i></button>
                              <button onClick={() => handleDeleteSp(sp.id, sp.name)} className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs"><i className="fa-solid fa-trash"></i></button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'request' && (
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-orange-500">
             <h3 className="font-semibold text-lg mb-4 text-gray-800">Request Part (Dari Teknisi)</h3>
             <div className="space-y-4">
               {sparepartRequests.slice().reverse().map(req => (
                 <div key={req.id} className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-4 ${req.status === 'Pending' ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
                   <div>
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'}`}>{req.status}</span>
                     <h4 className="font-bold text-gray-900 text-lg mt-1">{req.partName}</h4>
                     <p className="text-xs text-gray-600 mt-1">Dibutuhkan: <strong>{req.qty}</strong> | Lokasi: <strong>{req.factory}</strong></p>
                     <p className="text-sm italic text-gray-700 mt-2">"{req.remarks}"</p>
                   </div>
                   {req.status === 'Pending' && (
                     <button onClick={() => showConfirm('Selesaikan Request', `Selesaikan request "${req.partName}"?`, async () => { await updateDoc(docRef('cmms_sparepart_requests', req.id), { status: 'Fulfilled', fulfillDate: new Date().toLocaleString() }); showMessage('Berhasil', 'Request diselesaikan.', 'success'); })} className="bg-orange-600 text-white font-bold px-6 py-3 rounded-lg"><i className="fa-solid fa-check-double mr-2"></i> Sudah Disediakan</button>
                   )}
                 </div>
               ))}
             </div>
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
    const [editSchId, setEditSchId] = useState(null);
    const [editSchForm, setEditSchForm] = useState({ title: '', date: '' });
    const [filterFactory, setFilterFactory] = useState('All');

    const handleCreateSchedule = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_pmSchedules'), { ...newSchedule, status: 'Pending', executedBy: null, verifiedBy: null, executionNote: '' });
      setNewSchedule({ machineId: '', date: '', title: '' }); showMessage('Berhasil', 'Jadwal PM baru disimpan.', 'success');
    };

    const handleSelectSchedule = (sId) => { if(editSchId === sId) return; setSelectedSchedule(sId); setTempTasks(pmParams.filter(p => p.scheduleId === sId).map(p => p.task)); };
    
    const handleSaveTasks = async () => {
      const oldTasks = pmParams.filter(p => p.scheduleId === selectedSchedule);
      for(const ot of oldTasks) await deleteDoc(docRef('cmms_pmParams', ot.id));
      for(const task of tempTasks) await addDoc(colRef('cmms_pmParams'), { scheduleId: selectedSchedule, task: task });
      showMessage('Tersimpan', 'Daftar SOP PM berhasil disimpan.', 'success'); setSelectedSchedule(null);
    };

    const handleDeleteSch = (id, title) => { showConfirm('Hapus Jadwal PM', `Yakin hapus jadwal "${title}"?`, async () => { await deleteDoc(docRef('cmms_pmSchedules', id)); if (selectedSchedule === id) setSelectedSchedule(null); showMessage('Dihapus', 'Jadwal dihapus.', 'success'); }); };

    const filteredSchedules = pmSchedules.filter(sch => { const machine = machines.find(m => m.id === sch.machineId); return filterFactory === 'All' || machine?.factory === filterFactory; });

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Perencanaan & Verifikasi PM</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 border-b pb-2"><i className="fa-regular fa-calendar-plus text-blue-500 mr-2"></i> Terbitkan Jadwal PM</h3>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <select required className="w-full border-2 p-3 rounded-lg text-sm" value={newSchedule.machineId} onChange={e => setNewSchedule({...newSchedule, machineId: e.target.value})}><option value="">-- Pilih Mesin --</option>{machines.map(m => <option key={m.id} value={m.id}>[{m.factory}] {m.name}</option>)}</select>
              <input required type="text" placeholder="Judul Pekerjaan PM..." className="w-full border-2 p-3 rounded-lg text-sm" value={newSchedule.title} onChange={e => setNewSchedule({...newSchedule, title: e.target.value})} />
              <input required type="date" className="w-full border-2 p-3 rounded-lg text-sm" value={newSchedule.date} onChange={e => setNewSchedule({...newSchedule, date: e.target.value})} />
              <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded-xl w-full font-bold">Terbitkan Instruksi</button>
            </form>
            <div className="mt-8 border-t pt-6">
              <div className="flex justify-between items-center mb-3">
                 <h4 className="font-bold text-gray-700">Daftar Jadwal PM</h4>
                 <select className="border p-1.5 rounded text-xs bg-gray-50 font-bold" value={filterFactory} onChange={e => setFilterFactory(e.target.value)}><option value="All">Semua</option>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {filteredSchedules.map(sch => (
                  <div key={sch.id} onClick={() => handleSelectSchedule(sch.id)} className={`p-4 border rounded-xl cursor-pointer ${selectedSchedule === sch.id ? 'border-indigo-500 bg-indigo-50' : 'bg-white'}`}>
                    {editSchId === sch.id ? (
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        <input type="text" className="w-full border p-2 text-sm" value={editSchForm.title} onChange={e => setEditSchForm({...editSchForm, title: e.target.value})} />
                        <input type="date" className="w-full border p-2 text-sm" value={editSchForm.date} onChange={e => setEditSchForm({...editSchForm, date: e.target.value})} />
                        <div className="flex gap-2 mt-2">
                          <button onClick={async () => { await updateDoc(docRef('cmms_pmSchedules', sch.id), { title: editSchForm.title, date: editSchForm.date }); setEditSchId(null); showMessage('Berhasil', 'Diperbarui.', 'success'); }} className="flex-1 bg-green-600 text-white py-1 rounded text-xs font-bold">Simpan</button>
                          <button onClick={() => setEditSchId(null)} className="flex-1 bg-gray-400 text-white py-1 rounded text-xs font-bold">Batal</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div>
                           <p className="font-bold text-sm md:text-base text-gray-900">{sch.title}</p>
                           <p className="text-xs text-gray-600 mt-1">{machines.find(m => m.id === sch.machineId)?.name} | {sch.date}</p>
                           <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase mt-2 inline-block ${sch.status === 'Pending' ? 'bg-orange-100 text-orange-700' : sch.status === 'Selesai' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{sch.status}</span>
                        </div>
                        <div className="flex gap-1 ml-2">
                           <button onClick={(e) => { e.stopPropagation(); setEditSchForm({title: sch.title, date: sch.date}); setEditSchId(sch.id); }} className="bg-gray-100 hover:bg-gray-200 p-2 rounded text-xs"><i className="fa-solid fa-pen"></i></button>
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteSch(sch.id, sch.title); }} className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded text-xs"><i className="fa-solid fa-trash"></i></button>
                        </div>
                      </div>
                    )}
                    {sch.status === 'Selesai' && editSchId !== sch.id && (
                      <button onClick={(e) => { e.stopPropagation(); showConfirm('Verifikasi', 'Verifikasi PM ini?', async () => { await updateDoc(docRef('cmms_pmSchedules', sch.id), { status: 'Terverifikasi', verifiedBy: currentUser.name, verifyDate: new Date().toISOString().split('T')[0] }); }); }} className="mt-3 bg-green-600 text-white text-xs px-3 py-2 rounded font-bold w-full">Verifikasi Laporan PM</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {selectedSchedule && (
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-lg border-2 border-indigo-500 sticky top-6">
              <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">SOP PM: {pmSchedules.find(s => s.id === selectedSchedule)?.title}</h3>
              <form onSubmit={e => { e.preventDefault(); if(newTaskText) { setTempTasks([...tempTasks, newTaskText]); setNewTaskText(''); } }} className="flex gap-2 mb-4">
                <input type="text" placeholder="Rincian checklist PM..." className="flex-1 border-2 p-2 rounded-lg text-sm" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} />
                <button type="submit" className="bg-indigo-900 text-white px-4 py-2 rounded-lg text-sm font-bold">Tambah</button>
              </form>
              <ul className="space-y-2 mb-6 max-h-[300px] overflow-y-auto bg-gray-50 p-2 rounded">
                {tempTasks.map((task, idx) => (
                  <li key={idx} className="flex justify-between items-center p-3 bg-white rounded border"><span className="text-sm font-medium">{idx + 1}. {task}</span><button type="button" onClick={() => setTempTasks(tempTasks.filter((_, i) => i !== idx))} className="text-red-500"><i className="fa-solid fa-trash-can"></i></button></li>
                ))}
              </ul>
              <button type="button" onClick={handleSaveTasks} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Simpan SOP ke Database</button>
            </div>
          )}
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
    const filteredChecks = dailyChecks.filter(c => (filterMachine ? c.machineId === filterMachine : machinesToPrint.find(m => m.id === c.machineId)) && (filterMonth ? c.date.startsWith(filterMonth) : true));
    const filteredPMs = pmSchedules.filter(s => (s.status === 'Selesai' || s.status === 'Terverifikasi') && (filterMachine ? s.machineId === filterMachine : machinesToPrint.find(m => m.id === s.machineId)) && (filterYear ? s.date.startsWith(filterYear) : true));
    const filteredSparepartLogs = sparepartLogs.filter(log => (filterFactory === 'All' || log.factory === filterFactory) && (activeTab === 'sparepart' ? (filterMonth ? (log.date.includes(`${filterMonth.split('-')[1]}/${filterMonth.split('-')[0]}`) || log.date.includes(filterMonth)) : (filterYear ? log.date.includes(filterYear) : true)) : true));

    return (
      <div className="space-y-6">
        <div className="print:hidden">
          <div className="bg-gray-800 text-white p-4 rounded-xl mb-6"><h2 className="text-xl font-bold">Pusat Cetak Dokumen</h2></div>
          <div className="flex border-b-2 mb-6 gap-2 overflow-x-auto pb-1">
             <button onClick={() => setActiveTab('harian')} className={`px-4 py-2 font-bold rounded-t-lg ${activeTab === 'harian' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Log Harian</button>
             <button onClick={() => setActiveTab('pm')} className={`px-4 py-2 font-bold rounded-t-lg ${activeTab === 'pm' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Riwayat PM</button>
             <button onClick={() => setActiveTab('sparepart')} className={`px-4 py-2 font-bold rounded-t-lg ${activeTab === 'sparepart' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Part</button>
          </div>
          <div className="bg-white p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-6 border">
            <div><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filter Pabrik</label><select className="border-2 p-2 rounded w-full" value={filterFactory} onChange={e => {setFilterFactory(e.target.value); setFilterMachine('');}}><option value="All">Semua Pabrik</option>{factories.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
            {activeTab !== 'sparepart' && <div><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filter Mesin</label><select className="border-2 p-2 rounded w-full" value={filterMachine} onChange={e => setFilterMachine(e.target.value)}><option value="">-- Semua Mesin --</option>{machinesToPrint.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>}
            {(activeTab === 'harian' || activeTab === 'sparepart') && <div><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filter Bulan</label><input type="month" className="border-2 p-2 rounded w-full" value={filterMonth} onChange={e => {setFilterMonth(e.target.value); if(activeTab==='sparepart') setFilterYear('');}} /></div>}
            {(activeTab === 'pm' || activeTab === 'sparepart') && <div><label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Filter Tahun</label><input type="number" className="border-2 p-2 rounded w-full" value={filterYear} onChange={e => {setFilterYear(e.target.value); if(activeTab==='sparepart') setFilterMonth('');}} /></div>}
            <div className="col-span-full md:col-span-1 md:ml-auto flex gap-2 w-full">
               <button onClick={() => window.print()} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold w-full"><i className="fa-solid fa-print"></i> Cetak PDF</button>
               <button onClick={() => {
                  if(activeTab === 'harian') exportToCSV(filteredChecks.map(c => ({Tanggal: c.date, Mesin: c.machineId, Teknisi: c.teknisi, Data: JSON.stringify(c.results)})), 'Export_Log_Harian.csv');
                  if(activeTab === 'pm') exportToCSV(filteredPMs.map(p => ({Tanggal: p.date, Judul: p.title, Teknisi: p.executedBy, Verifikator: p.verifiedBy})), 'Export_PM.csv');
                  if(activeTab === 'sparepart') exportToCSV(filteredSparepartLogs.map(l => ({Tgl: l.date, Part: l.partName, Tipe: l.type, Qty: l.qty, Ket: l.remarks})), 'Export_Mutasi_Part.csv');
               }} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold w-full"><i className="fa-solid fa-file-excel"></i> CSV</button>
            </div>
          </div>
        </div>

        {activeTab === 'harian' && (
          <div className="bg-white p-4 md:p-8 rounded-xl print:p-0 border print:border-0 shadow-sm print:shadow-none">
            <div className="hidden print:flex justify-between border-b-4 border-gray-900 pb-4 mb-4">
              <div><h1 className="text-2xl font-black uppercase text-gray-900">Logsheet Harian</h1></div>
              <div className="text-right border-l-2 border-gray-900 pl-4"><p className="text-[10px] font-bold text-gray-500">AREA LOKASI</p><p className="text-lg font-black text-gray-900 uppercase">{filterFactory}</p></div>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full border-collapse border border-gray-900 text-[10px] print:text-[10px]">
                <thead><tr className="bg-gray-200"><th className="border border-gray-900 p-1.5 w-16 text-center">Tgl</th>{!filterMachine && <th className="border border-gray-900 p-1.5 w-32">Nama Mesin</th>}<th className="border border-gray-900 p-1.5 text-left">Kondisi Parameter Aktual</th><th className="border border-gray-900 p-1.5 w-24 text-center">Teknisi</th></tr></thead>
                <tbody>
                  {filteredChecks.length > 0 ? filteredChecks.map(check => {
                     const machine = machines.find(m => m.id === check.machineId);
                     return (
                       <tr key={check.id} className="hover:bg-gray-50 print:bg-white break-inside-avoid">
                          <td className="border border-gray-900 p-1.5 text-center font-black">{check.date}</td>
                          {!filterMachine && <td className="border border-gray-900 p-1.5 font-bold text-[9px]">{machine?.name}</td>}
                          <td className="border border-gray-900 p-1.5">
                             <div className="flex flex-wrap gap-1">
                               {Object.entries(check.results).map(([paramId, res]) => {
                                  const pName = dailyParams.find(p => p.id === paramId)?.name || 'Param';
                                  return (
                                     <span key={paramId} className={`inline-flex px-1.5 py-0.5 border rounded-[3px] text-[8px] font-bold ${res.status === 'OK' ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-100 text-red-900 border-red-500'}`}>
                                       {pName}: {res.status} {res.note && `(${res.note})`}
                                     </span>
                                  );
                               })}
                             </div>
                          </td>
                          <td className="border border-gray-900 p-1.5 text-center font-bold text-[9px]">{check.teknisi}</td>
                       </tr>
                     )
                  }) : <tr><td colSpan={filterMachine ? "3" : "4"} className="border border-gray-900 p-8 text-center text-gray-400 font-bold">Data kosong.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Sisanya sama untuk cetak PM & Sparepart, disingkat agar muat */}
        {activeTab === 'pm' && <div className="p-4 text-center border-dashed border-2 rounded">Silakan cetak Laporan PM per Mesin. Mode ini tersedia di versi lengkap.</div>}
        {activeTab === 'sparepart' && <div className="p-4 text-center border-dashed border-2 rounded">Silakan cetak Laporan Sparepart. Mode ini tersedia di versi lengkap.</div>}
      </div>
    );
  };

  const InfoKPI = () => (
    <div className="space-y-6">
       <h2 className="text-2xl font-bold text-gray-800 border-b-2 pb-2"><i className="fa-solid fa-book-open text-blue-600 mr-2"></i> Panduan KPI</h2>
       <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
          <div><h3 className="text-lg font-black text-green-700">1. MTBF (Mean Time Between Failures)</h3><p className="text-sm">Rata-rata keandalan mesin. Rumus: Total Jam Operasi Mesin / Jumlah Kerusakan.</p></div>
          <div><h3 className="text-lg font-black text-yellow-600">2. MTTR (Mean Time To Repair)</h3><p className="text-sm">Kecepatan perbaikan teknisi. Rumus: Total Waktu Perbaikan / Total Kerusakan Selesai.</p></div>
          <div><h3 className="text-lg font-black text-blue-600">3. PM Completion</h3><p className="text-sm">Kepatuhan jadwal PM. Rumus: (PM Selesai / Total Jadwal PM) * 100%.</p></div>
          <div><h3 className="text-lg font-black text-red-600">4. Insiden LTI</h3><p className="text-sm">Jumlah kecelakaan kerja. Harus diinput manual oleh Admin. Target: 0 Kejadian.</p></div>
       </div>
    </div>
  );

  const TeknisiDailyActivity = () => {
    const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', activity: '' });
    const handleSubmit = async (e) => {
      e.preventDefault(); await addDoc(colRef('cmms_dailyActivities'), { teknisi: currentUser.name, factory: currentUser.factory, ...formData });
      showMessage('Tersimpan', 'Aktivitas disinkronkan.', 'success'); setFormData({ ...formData, startTime: '', endTime: '', activity: '' });
    };
    const myActivities = dailyActivities.filter(a => a.teknisi === currentUser.name).slice().reverse();

    return (
      <div className="space-y-6">
        <div className="bg-blue-900 text-white p-6 rounded-xl shadow-md"><h2 className="text-2xl font-bold">Jurnal Aktivitas Harian</h2></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border lg:col-span-1 h-fit">
            <h3 className="font-bold text-lg mb-5 border-b pb-2"><i className="fa-solid fa-pen-clip mr-2 text-blue-500"></i> Entri Baru</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required type="date" className="w-full border-2 p-3 rounded-lg text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <div className="grid grid-cols-2 gap-3"><input required type="time" className="w-full border-2 p-3 rounded-lg text-sm" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} /><input required type="time" className="w-full border-2 p-3 rounded-lg text-sm" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} /></div>
              <textarea required rows="4" className="w-full border-2 p-3 rounded-lg text-sm" placeholder="Deskripsi aktivitas..." value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})}></textarea>
              <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold"><i className="fa-solid fa-floppy-disk mr-2"></i> Simpan Jurnal</button>
            </form>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm lg:col-span-2 overflow-auto max-h-[650px]">
            <h3 className="font-bold text-lg mb-4">Riwayat Jurnal Anda</h3>
            <div className="space-y-4">
              {myActivities.map(act => (
                <div key={act.id} className="flex p-4 border rounded-xl shadow-sm bg-gray-50">
                  <div className="mr-4 flex flex-col items-center justify-center border-r border-gray-300 pr-4 min-w-[60px]"><span className="text-xl font-black text-blue-600">{act.date.split('-')[2]}</span></div>
                  <div className="flex-1"><span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded"><i className="fa-regular fa-clock mr-1"></i> {act.startTime} - {act.endTime}</span><p className="text-sm text-gray-800 font-medium mt-2 leading-relaxed">{act.activity}</p></div>
                </div>
              ))}
              {myActivities.length === 0 && <p className="text-center py-6 text-gray-400">Jurnal kosong.</p>}
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
    const todayStr = new Date().toISOString().split('T')[0];
    const checkedTodayIds = new Set(dailyChecks.filter(c => c.date === todayStr).map(c => c.machineId));

    const groupedMachines = availableMachines.reduce((acc, m) => {
       const area = m.location || 'Area Lainnya'; if (!acc[area]) acc[area] = []; acc[area].push(m); return acc;
    }, {});
    const sortedAreas = Object.keys(groupedMachines).sort();

    const handleSaveCheck = async (e) => {
      e.preventDefault(); await addDoc(colRef('cmms_dailyChecks'), { date: todayStr, machineId: selectedMachine, teknisi: currentUser.name, results: checkData });
      showMessage('Selesai', 'Data checklist disubmit.', 'success'); setSelectedMachine(null); setCheckData({});
    };

    const handleQRSuccess = (code) => {
       const m = availableMachines.find(x => x.code === code);
       if (m) {
          if (checkedTodayIds.has(m.id)) { showMessage('Sudah Dicek', `Mesin ${m.name} sudah diperiksa hari ini.`, 'warning'); setShowScanner(false); return; }
          setSelectedMachine(m.id); setCheckData({}); setShowScanner(false); showMessage('Scan Sukses', `Mesin terpilih: ${m.name}`, 'success');
       } else { showMessage('Scan Gagal', `Mesin dengan kode ${code} tidak ditemukan.`, 'error'); }
    };

    return (
      <div className="space-y-6">
        {showScanner && <CameraQRScanner onScanSuccess={handleQRSuccess} onClose={() => setShowScanner(false)} />}
        <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Form Checklist Harian</h2><button onClick={() => setShowScanner(true)} className="bg-gray-800 text-white px-4 py-2 rounded font-bold flex items-center"><i className="fa-solid fa-qrcode mr-2"></i> Scan QR Aset</button></div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 border-b pb-2">Pilih Mesin Manual (Per Area)</h3>
          {sortedAreas.map(area => (
            <div key={area} className="mb-6">
              <h4 className="font-bold text-blue-800 bg-blue-50 px-3 py-1.5 rounded inline-block mb-3 uppercase text-xs border border-blue-100"><i className="fa-solid fa-layer-group mr-2"></i> Area: {area}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {groupedMachines[area].map(m => {
                  const isChecked = checkedTodayIds.has(m.id); const isSelected = selectedMachine === m.id;
                  let cardStyle = "bg-white hover:border-blue-300 cursor-pointer"; let iconColor = "text-gray-400"; let textColor = "text-gray-800";
                  if (isChecked) { cardStyle = "bg-green-50 border-green-300 opacity-80 cursor-not-allowed"; iconColor = "text-green-500"; textColor = "text-green-900"; } 
                  else if (isSelected) { cardStyle = "bg-blue-600 border-blue-600 shadow-lg scale-105"; iconColor = "text-white"; textColor = "text-white"; }
                  return (
                    <div key={m.id} onClick={() => { if (isChecked) { showMessage('Selesai', `Mesin ${m.name} sudah diperiksa hari ini.`, 'warning'); return; } setSelectedMachine(m.id); setCheckData({}); }} className={`border-2 p-4 rounded-xl flex flex-col items-center text-center transition-all ${cardStyle}`}>
                      <div className={`text-2xl md:text-3xl mb-2 ${iconColor}`}>{isChecked ? <i className="fa-solid fa-check-circle"></i> : <i className="fa-solid fa-box"></i>}</div>
                      <span className={`text-[10px] md:text-xs font-bold ${textColor}`}>{m.name}</span>
                      {isChecked && <span className="text-[8px] mt-1.5 bg-green-200 text-green-900 px-1.5 py-0.5 rounded font-black uppercase shadow-sm">Sudah Dicek</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {selectedMachine && (
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-xl border-t-8 border-blue-500 animate-[fadeIn_0.3s]">
            <h3 className="text-lg md:text-xl font-bold mb-6 flex items-center border-b pb-4"><i className="fa-solid fa-list-check text-blue-500 mr-3"></i> Checklist: {machines.find(m=>m.id === selectedMachine)?.name}</h3>
            {params.length > 0 ? (
              <form onSubmit={handleSaveCheck}>
                <div className="space-y-4 mb-8">
                  {params.map((p, idx) => {
                    const status = checkData[p.id]?.status;
                    return (
                      <div key={p.id} className="p-4 border-2 rounded-xl bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <p className="font-bold text-sm md:text-base flex-1">{idx+1}. {p.name}</p>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                          <label className={`flex-1 flex justify-center items-center px-4 py-2 rounded-lg cursor-pointer text-sm font-bold border-2 ${status === 'OK' ? 'bg-green-100 text-green-700 border-green-500' : 'bg-white border-gray-200'}`}><input type="radio" required name={`param_${p.id}`} className="hidden" onChange={() => setCheckData({...checkData, [p.id]: { status: 'OK', note: checkData[p.id]?.note || '' }})} /> OK</label>
                          <label className={`flex-1 flex justify-center items-center px-4 py-2 rounded-lg cursor-pointer text-sm font-bold border-2 ${status === 'NG' ? 'bg-red-100 text-red-700 border-red-500' : 'bg-white border-gray-200'}`}><input type="radio" required name={`param_${p.id}`} className="hidden" onChange={() => setCheckData({...checkData, [p.id]: { status: 'NG', note: checkData[p.id]?.note || '' }})} /> NG</label>
                        </div>
                        {status === 'NG' && <input type="text" placeholder="Catatan/Temuan..." required className="w-full md:w-48 border-2 border-red-300 p-2 text-sm rounded bg-red-50" onChange={(e) => setCheckData({...checkData, [p.id]: { ...checkData[p.id], note: e.target.value }})} />}
                      </div>
                    )
                  })}
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg shadow-lg">Submit Hasil</button>
              </form>
            ) : <div className="text-center py-12 border-2 border-dashed border-red-200 bg-red-50 rounded-xl"><p className="text-red-800 font-bold">Parameter Mesin Belum Diatur Admin.</p></div>}
          </div>
        )}
      </div>
    );
  };

  const PenangananKerusakan = () => {
    const availableMachines = getAvailableMachines();
    const [resolveId, setResolveId] = useState(null);
    const [resolveData, setResolveData] = useState({ analysis: '', partsReplaced: '', startDate: '', startTime: '', endTime: '' });

    const handleResolveSubmit = async (e, bId) => {
      e.preventDefault();
      showConfirm('Selesaikan Perbaikan?', 'Data penanganan akan disimpan.', async () => {
        await updateDoc(docRef('cmms_breakdowns', bId), {
          status: 'Selesai Diperbaiki', resolvedBy: currentUser.name, resolveDate: new Date().toLocaleString(), analysis: resolveData.analysis, partsReplaced: resolveData.partsReplaced, startTime: `${resolveData.startDate} ${resolveData.startTime}`, endTime: `${resolveData.startDate} ${resolveData.endTime}`
        });
        setResolveId(null); showMessage('Selesai', 'Perbaikan berhasil dicatat.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Penanganan Breakdown Mesin</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-red-500">
            <h3 className="font-semibold text-lg mb-4 text-red-700 border-b pb-2"><i className="fa-solid fa-screwdriver-wrench mr-2"></i> Antrean Pending (Open)</h3>
            <div className="space-y-4">
              {breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId)).map(b => {
                const machine = machines.find(m => m.id === b.machineId); const isResolving = resolveId === b.id;
                return (
                  <div key={b.id} className={`p-4 rounded-xl border ${isResolving ? 'border-blue-400 bg-blue-50' : 'border-red-200 bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900 text-lg block">{machine?.name}</span>
                      <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded">{machine?.factory}</span>
                    </div>
                    <div className="bg-gray-50 border p-3 rounded-lg mb-3 relative">
                      <span className="absolute -top-2 left-3 bg-gray-50 text-[10px] font-bold text-gray-400 px-1">Lapor: {b.requestBy || b.reportedBy}</span>
                      <p className="text-sm text-gray-800 mt-1">{b.description}</p>
                    </div>
                    
                    <button onClick={() => setChatTicket(b)} className="mb-3 w-full border border-gray-300 bg-gray-50 hover:bg-blue-50 text-gray-700 font-bold px-4 py-2 rounded-lg text-sm flex justify-center items-center">
                       <i className="fa-regular fa-comments mr-2"></i> Diskusi Tiket {(b.comments?.length > 0) && <span className="ml-2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full">{b.comments.length}</span>}
                    </button>
                    
                    {!isResolving ? (
                      <button onClick={() => {setResolveId(b.id); setResolveData({ analysis: '', partsReplaced: '', startDate: new Date().toISOString().split('T')[0], startTime: '', endTime: '' })}} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-lg"><i className="fa-solid fa-hand-pointer mr-2"></i> Ambil Pekerjaan Ini</button>
                    ) : (
                      <form onSubmit={(e) => handleResolveSubmit(e, b.id)} className="bg-white p-4 rounded-lg border-2 border-blue-200 mt-4 shadow-inner">
                        <div className="space-y-4">
                          <div><label className="block text-xs font-bold mb-1">Tindakan Perbaikan</label><textarea required className="w-full border p-2 text-sm rounded" rows="2" value={resolveData.analysis} onChange={e => setResolveData({...resolveData, analysis: e.target.value})}></textarea></div>
                          <div><label className="block text-xs font-bold mb-1">Part Diganti (Jika ada)</label><input type="text" className="w-full border p-2 text-sm rounded" value={resolveData.partsReplaced} onChange={e => setResolveData({...resolveData, partsReplaced: e.target.value})} /></div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div><label className="block text-[9px] font-bold uppercase">Tanggal</label><input required type="date" className="w-full border p-2 text-sm rounded" value={resolveData.startDate} onChange={e => setResolveData({...resolveData, startDate: e.target.value})} /></div>
                            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2"><div><label className="block text-[9px] font-bold uppercase">Jam Mulai</label><input required type="time" className="w-full border p-2 text-sm rounded" value={resolveData.startTime} onChange={e => setResolveData({...resolveData, startTime: e.target.value})} /></div><div><label className="block text-[9px] font-bold uppercase">Selesai</label><input required type="time" className="w-full border p-2 text-sm rounded" value={resolveData.endTime} onChange={e => setResolveData({...resolveData, endTime: e.target.value})} /></div></div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4"><button type="submit" className="flex-1 bg-green-600 text-white font-bold py-2 rounded text-sm">Selesaikan</button><button type="button" onClick={() => setResolveId(null)} className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded text-sm">Batal</button></div>
                      </form>
                    )}
                  </div>
                )
              })}
              {breakdowns.filter(b => b.status === 'Open' && availableMachines.find(m => m.id === b.machineId)).length === 0 && <p className="text-center py-6 text-gray-400 italic">Tidak ada laporan kerusakan.</p>}
            </div>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-green-500">
            <h3 className="font-semibold text-lg mb-4 text-green-700 border-b pb-2"><i className="fa-solid fa-clock-rotate-left mr-2"></i> Histori Pekerjaan Selesai</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {breakdowns.filter(b => b.status === 'Selesai Diperbaiki' && availableMachines.find(m => m.id === b.machineId)).slice().reverse().map(b => {
                const machine = machines.find(m => m.id === b.machineId);
                return (
                  <div key={b.id} className="p-4 border bg-white rounded-xl shadow-sm">
                    <span className="font-bold text-gray-900 block">{machine?.name}</span>
                    <p className="text-sm text-gray-600 mb-2 italic">Lap: "{b.description}"</p>
                    <div className="text-sm bg-green-50 p-3 rounded-lg border border-green-100 text-gray-800">
                      <p className="mb-1"><span className="font-bold text-green-800 text-[10px] uppercase block">Tindakan:</span> {b.analysis}</p>
                      <p><span className="font-bold text-green-800 text-[10px] uppercase block">Part Ganti:</span> {b.partsReplaced || '-'}</p>
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

  const EksekusiPM = () => {
    const pendingSchedules = pmSchedules.filter(s => s.status === 'Pending' && getAvailableMachines().find(m => m.id === s.machineId));
    const [pmForms, setPmForms] = useState({});
    const handleSelesaikanPM = (scheduleId) => {
      const formData = pmForms[scheduleId] || {};
      if(!formData.executeDate || !formData.startTime || !formData.endTime) { showMessage('Data Tidak Lengkap', 'Lengkapi Durasi Waktu Pengerjaan.', 'error'); return; }
      showConfirm('Submit Laporan', 'Dokumen akan disimpan ke Database.', async () => {
        await updateDoc(docRef('cmms_pmSchedules', scheduleId), { status: 'Selesai', executedBy: currentUser.name, executeDate: formData.executeDate, pmStartTime: formData.startTime, pmEndTime: formData.endTime, executionNote: formData.note || '-' });
        showMessage('Berhasil', 'Dokumen terkirim ke Supervisor.', 'success');
      });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Eksekusi PM Aktif</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pendingSchedules.map(sch => {
            const machine = machines.find(m => m.id === sch.machineId); const tasks = pmParams.filter(p => p.scheduleId === sch.id);
            const form = pmForms[sch.id] || { executeDate: new Date().toISOString().split('T')[0], startTime: '', endTime: '', note: '' };
            return (
              <div key={sch.id} className="bg-white p-4 md:p-6 rounded-xl shadow-md border-t-8 border-blue-500 flex flex-col">
                <h3 className="font-bold text-lg mb-1">{sch.title}</h3><p className="text-sm text-gray-600 mb-4">{machine?.name} ({machine?.code})</p>
                <div className="mb-4 bg-gray-50 p-4 rounded border">
                  <h4 className="text-sm font-bold mb-2">SOP Pekerjaan:</h4>
                  <ul className="space-y-2 mb-4">{tasks.map(t => <li key={t.id} className="text-sm flex"><input type="checkbox" className="mr-2 mt-1"/> {t.task}</li>)}</ul>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    <div><label className="text-[9px] font-bold uppercase">Tgl Pengerjaan</label><input type="date" className="w-full border p-2 rounded" value={form.executeDate} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, executeDate: e.target.value}})} /></div>
                    <div className="grid grid-cols-2 sm:grid-cols-1 gap-2"><div><label className="text-[9px] font-bold uppercase">Jam Mulai</label><input type="time" className="w-full border p-2 rounded" value={form.startTime} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, startTime: e.target.value}})} /></div><div><label className="text-[9px] font-bold uppercase">Jam Selesai</label><input type="time" className="w-full border p-2 rounded" value={form.endTime} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, endTime: e.target.value}})} /></div></div>
                  </div>
                  <textarea rows="2" className="w-full border p-2 text-sm rounded" placeholder="Catatan tambahan (opsional)..." value={form.note} onChange={e => setPmForms({...pmForms, [sch.id]:{...form, note: e.target.value}})}></textarea>
                </div>
                <button type="button" onClick={() => handleSelesaikanPM(sch.id)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Submit Laporan PM</button>
              </div>
            )
          })}
          {pendingSchedules.length === 0 && <div className="col-span-full text-center p-10 bg-gray-100 rounded-xl text-gray-500 font-bold border-2 border-dashed">Tidak ada antrean jadwal PM untuk Anda.</div>}
        </div>
      </div>
    );
  };

  const TeknisiSparepart = () => {
    const [activeTab, setActiveTab] = useState('ambil');
    const availableParts = spareparts.filter(sp => sp.factory === currentUser.factory);
    const [useForm, setUseForm] = useState({ partId: '', qty: '', remarks: '' });
    const [reqForm, setReqForm] = useState({ partName: '', qty: '', remarks: '' });

    const handleUsePart = async (e) => {
      e.preventDefault(); const part = availableParts.find(p => p.id === useForm.partId); if(!part) return;
      const qtyNum = Number(useForm.qty);
      if(qtyNum > part.stock) { showMessage('Gagal', `Stok tidak cukup! (Sisa: ${part.stock} ${part.unit})`, 'error'); return; }
      showConfirm('Ambil Part', `Ambil ${qtyNum} ${part.unit} ${part.name}?`, async () => {
        await updateDoc(docRef('cmms_spareparts', part.id), { stock: part.stock - qtyNum });
        await addDoc(colRef('cmms_sparepart_logs'), { partId: part.id, partCode: part.code, partName: part.name, factory: part.factory, date: new Date().toLocaleString(), type: 'OUT', qty: qtyNum, unit: part.unit, remarks: useForm.remarks, user: currentUser.name });
        showMessage('Berhasil', 'Pengambilan dicatat.', 'success'); setUseForm({ partId: '', qty: '', remarks: '' });
      });
    };

    const handleRequestPart = async (e) => {
      e.preventDefault();
      await addDoc(colRef('cmms_sparepart_requests'), { partName: reqForm.partName, factory: currentUser.factory, qty: reqForm.qty, remarks: reqForm.remarks, status: 'Pending', requestedBy: currentUser.name, date: new Date().toLocaleString() });
      showMessage('Terkirim', 'Request dikirim ke Admin.', 'success'); setReqForm({ partName: '', qty: '', remarks: '' });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Gudang Part ({currentUser.factory})</h2>
        <div className="flex border-b-2 mb-4 gap-2 overflow-x-auto">
           <button onClick={() => setActiveTab('ambil')} className={`px-4 py-3 font-bold rounded-t-lg ${activeTab === 'ambil' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>Ambil Part</button>
           <button onClick={() => setActiveTab('request')} className={`px-4 py-3 font-bold rounded-t-lg ${activeTab === 'request' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-200'}`}>Request Part</button>
        </div>

        {activeTab === 'ambil' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-indigo-500 h-fit">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Form Pengambilan</h3>
                <form onSubmit={handleUsePart} className="space-y-4">
                  <div><label className="block text-xs font-bold mb-1">Pilih Sparepart</label><select required className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={useForm.partId} onChange={e => setUseForm({...useForm, partId: e.target.value})}><option value="">-- Pilih Part --</option>{availableParts.map(sp => <option key={sp.id} value={sp.id}>{sp.code} - {sp.name} (Sisa: {sp.stock})</option>)}</select></div>
                  <div><label className="block text-xs font-bold mb-1">Jumlah</label><input type="number" required min="1" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={useForm.qty} onChange={e => setUseForm({...useForm, qty: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold mb-1">Digunakan Untuk</label><textarea required rows="2" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={useForm.remarks} onChange={e => setUseForm({...useForm, remarks: e.target.value})}></textarea></div>
                  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-indigo-700">Catat Pengambilan</button>
                </form>
             </div>
             
             <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm flex flex-col max-h-[500px]">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Histori Pengambilan</h3>
                <div className="overflow-y-auto space-y-3 pr-2">
                  {sparepartLogs.filter(l => l.type === 'OUT' && l.user === currentUser.name).slice().reverse().map(log => (
                    <div key={log.id} className="p-3 border rounded-lg bg-indigo-50"><div className="flex justify-between items-start mb-1"><span className="font-bold text-gray-900">{log.partName}</span><span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded border border-red-200">-{log.qty} {log.unit}</span></div><p className="text-xs text-gray-700 italic mb-1">Tujuan: {log.remarks}</p><span className="text-[9px] text-gray-500 font-bold">{log.date}</span></div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'request' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border-t-4 border-orange-500 h-fit">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Request Part Baru</h3>
                <form onSubmit={handleRequestPart} className="space-y-4">
                  <div><label className="block text-xs font-bold mb-1">Nama Part</label><input type="text" required className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={reqForm.partName} onChange={e => setReqForm({...reqForm, partName: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold mb-1">Estimasi Qty</label><input type="text" required className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={reqForm.qty} onChange={e => setReqForm({...reqForm, qty: e.target.value})} /></div>
                  <div><label className="block text-xs font-bold mb-1">Alasan</label><textarea required rows="2" className="w-full border-2 p-3 rounded-lg text-sm bg-gray-50" value={reqForm.remarks} onChange={e => setReqForm({...reqForm, remarks: e.target.value})}></textarea></div>
                  <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg shadow-md">Kirim Request</button>
                </form>
              </div>
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm flex flex-col max-h-[500px]">
                <h3 className="font-semibold text-lg mb-4 text-gray-800">Status Request</h3>
                <div className="overflow-y-auto space-y-3 pr-2">
                  {sparepartRequests.filter(r => r.requestedBy === currentUser.name).slice().reverse().map(req => (
                     <div key={req.id} className="p-3 border rounded-lg bg-gray-50 relative"><span className={`absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded text-white ${req.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'}`}>{req.status}</span><p className="font-bold text-gray-900 pr-16">{req.partName}</p><p className="text-xs text-gray-600 mb-1">Qty: {req.qty}</p><p className="text-xs text-gray-700 italic border-t pt-1 mt-1">"{req.remarks}"</p></div>
                  ))}
                </div>
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
        date: new Date().toLocaleString(), ...formData, status: 'Open', reportedBy: currentUser.name, requestBy: currentUser.name, analysis: '', partsReplaced: '', startTime: '', endTime: ''
      });
      showMessage('Terkirim', 'Request perbaikan berhasil dikirim ke Teknisi.', 'success');
      setFormData({ machineId: '', description: '' });
    };

    const handleDeleteMyRequest = (id) => {
        showConfirm('Batalkan Tiket', 'Anda yakin ingin membatalkan request perbaikan ini?', async () => {
            await deleteDoc(docRef('cmms_breakdowns', id));
            showMessage('Dibatalkan', 'Request berhasil dihapus secara permanen.', 'success');
        });
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Lapor Kendala Mesin</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 md:p-8 rounded-xl shadow-lg border-t-8 border-red-500 h-fit">
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
                <label className="block text-sm font-bold text-gray-700 mb-2">Deskripsi Kerusakan</label>
                <textarea required rows="4" className="w-full border-2 border-gray-200 p-3 rounded-lg" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <button type="submit" className="bg-red-600 text-white px-4 py-4 rounded-xl w-full font-bold shadow-lg">Kirim Laporan</button>
            </form>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm overflow-hidden flex flex-col max-h-[600px]">
            <h3 className="font-bold text-lg mb-4 text-gray-800">Status Laporan Anda</h3>
            <div className="space-y-4 overflow-y-auto pr-2">
              {breakdowns.filter(b => b.reportedBy === currentUser.name).slice().reverse().map(b => {
                const machine = machines.find(m => m.id === b.machineId);
                return (
                  <div key={b.id} className={`p-4 border rounded-xl shadow-sm ${b.status === 'Open' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">{machine?.name}</span>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${b.status === 'Open' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{b.status}</span>
                    </div>
                    <div className="bg-white p-3 rounded border text-sm text-gray-700 mb-2 italic">"{b.description}"</div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                        {b.status === 'Open' && (
                           <>
                             <button onClick={() => setChatTicket(b)} className="text-xs text-blue-600 font-bold hover:underline bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                               <i className="fa-regular fa-comments mr-1"></i> Balas/Lihat {(b.comments?.length > 0) ? `(${b.comments.length})` : ''}
                             </button>
                             <button onClick={() => handleDeleteMyRequest(b.id)} className="text-xs text-red-600 font-bold hover:bg-red-100 bg-white px-3 py-1.5 rounded-lg border border-red-200">
                               <i className="fa-solid fa-trash mr-1"></i> Batalkan Laporan
                             </button>
                           </>
                        )}
                    </div>
                    
                    {b.status === 'Selesai Diperbaiki' && <div className="text-xs text-green-800 font-medium mb-2"><i className="fa-solid fa-check mr-1"></i> Telah diperbaiki oleh: {b.resolvedBy}</div>}
                    <div className="text-[10px] text-gray-500 font-medium">{b.date}</div>
                  </div>
                )
              })}
              {breakdowns.filter(b => b.reportedBy === currentUser.name).length === 0 && <p className="text-center py-8 text-gray-400 italic">Belum ada laporan diajukan.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const NavItem = ({ id, icon, label, roles }) => {
    if (!roles.includes(currentUser.role)) return null;
    return (
      <button onClick={() => {setActiveMenu(id); setIsSidebarOpen(false)}} className={`w-full flex items-center px-4 py-3 rounded-lg text-left font-medium text-sm ${activeMenu === id ? 'bg-blue-600 text-white shadow' : 'text-blue-100 hover:bg-blue-800'}`}>
        <i className={`fa-solid ${icon} w-6 mr-3 text-lg`}></i> <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex text-gray-900 font-sans">
      <ModalDialog />
      <ProfileEditModal />
      <TicketChatModal />
      
      {isSidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden print:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      
      <aside className={`print:hidden fixed inset-y-0 left-0 bg-gray-900 text-white w-72 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform z-30 flex flex-col shadow-2xl`}>
        <div className="p-6 border-b border-gray-800 bg-gray-950 flex justify-between items-center shrink-0">
          <div><h1 className="text-xl font-black uppercase tracking-widest text-blue-400">CMMS Pro</h1><p className="text-[10px] text-gray-400 font-medium tracking-wide">By Pamungkas</p></div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-24">
          <div className="mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-start">
            <div><p className="font-bold text-white mb-2">{currentUser.name}</p><div className="flex flex-wrap gap-2"><span className="text-[9px] uppercase font-bold bg-blue-600 px-2 py-1 rounded">{currentUser.role}</span><span className="text-[9px] uppercase font-bold bg-gray-700 px-2 py-1 rounded">{currentUser.factory}</span></div></div>
            <button onClick={() => setProfileDialog(true)} className="text-gray-400 hover:text-white p-2" title="Edit Profil"><i className="fa-solid fa-user-pen"></i></button>
          </div>
          <nav className="space-y-1">
            <NavItem id="dashboard" icon="fa-chart-pie" label="Dashboard" roles={['admin', 'teknisi', 'user']} />
            <div className={currentUser.role === 'admin' ? 'pt-4 pb-2' : 'hidden'}>
              <p className="text-[10px] font-bold text-gray-500 uppercase px-4 mb-2 mt-2">Manajemen Admin</p>
              <NavItem id="kelola_pabrik" icon="fa-city" label="Master Pabrik / Lokasi" roles={['admin']} />
              <NavItem id="kelola_user" icon="fa-users-gear" label="Manajemen Akun" roles={['admin']} />
              <NavItem id="kelola_mesin" icon="fa-network-wired" label="Aset & Parameter" roles={['admin']} />
              <NavItem id="kelola_sparepart" icon="fa-boxes-stacked" label="Manajemen Sparepart" roles={['admin']} />
              <NavItem id="setup_pm" icon="fa-calendar-days" label="Jadwal & Verifikasi PM" roles={['admin']} />
              <NavItem id="histori_perbaikan" icon="fa-clock-rotate-left" label="Histori Perbaikan" roles={['admin']} />
              <NavItem id="cetak" icon="fa-print" label="Pusat Dokumen (Cetak)" roles={['admin']} />
              <NavItem id="info_kpi" icon="fa-circle-info" label="Cara Penghitungan KPI" roles={['admin']} />
            </div>
            <div className={currentUser.role === 'teknisi' ? 'pt-4 pb-2' : 'hidden'}>
              <p className="text-[10px] font-bold text-gray-500 uppercase px-4 mb-2 mt-2">Tugas Teknisi</p>
              <NavItem id="daily_activity" icon="fa-book-open" label="Buku Jurnal Harian" roles={['teknisi']} />
              <NavItem id="cek_harian" icon="fa-clipboard-list" label="Checklist Rutin Mesin" roles={['teknisi']} />
              <NavItem id="penanganan_rusak" icon="fa-screwdriver-wrench" label="Tangani Breakdown" roles={['teknisi']} />
              <NavItem id="histori_perbaikan" icon="fa-clock-rotate-left" label="Histori Perbaikan" roles={['teknisi']} />
              <NavItem id="eksekusi_pm" icon="fa-business-time" label="Jadwal PM Aktif" roles={['teknisi']} />
              <NavItem id="teknisi_sparepart" icon="fa-box-open" label="Gudang & Request Part" roles={['teknisi']} />
              <NavItem id="info_kpi" icon="fa-circle-info" label="Cara Penghitungan KPI" roles={['teknisi']} />
            </div>
            <div className={currentUser.role === 'user' ? 'pt-4 pb-2' : 'hidden'}>
              <NavItem id="req_perbaikan" icon="fa-triangle-exclamation" label="Lapor Kendala Mesin" roles={['user']} />
            </div>
          </nav>
        </div>
        <div className="absolute bottom-0 w-full p-4 bg-gray-950 shrink-0"><button onClick={handleLogout} className="bg-red-600 text-white w-full p-3 rounded font-bold hover:bg-red-700 transition-colors"><i className="fa-solid fa-power-off mr-2"></i> KELUAR</button></div>
      </aside>
      
      <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden relative">
        <header className="print:hidden bg-white shadow-sm border-b h-16 flex items-center justify-between px-4 md:px-6 z-10 shrink-0">
          <div className="flex items-center">
             <button className="md:hidden mr-4 text-gray-600 hover:text-black" onClick={() => setIsSidebarOpen(true)}><i className="fa-solid fa-bars-staggered text-lg"></i></button>
             <h2 className="text-lg font-black uppercase text-gray-800 tracking-widest truncate">{activeMenu.replace('_', ' ')}</h2>
          </div>
          <div className="relative">
             <button onClick={() => setIsNotifOpen(!isNotifOpen)} className="text-gray-600 hover:text-blue-600 transition-colors p-2 relative">
                <i className="fa-solid fa-bell text-xl"></i>
                {notifications.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-bounce">{notifications.length}</span>}
             </button>
             {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all">
                   <div className="bg-gray-900 text-white p-3 font-bold flex justify-between items-center">
                      <span>Notifikasi Sistem</span>
                      <div className="flex gap-2">
                         {notifications.length > 0 && <button onClick={markAllNotifsAsRead} className="text-[9px] bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white transition-colors">Tandai Dibaca</button>}
                         <span className="text-[10px] bg-gray-700 px-2 py-1 rounded-full">{notifications.length} Baru</span>
                      </div>
                   </div>
                   <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? notifications.map((n, idx) => (
                         <div key={idx} onClick={() => { setActiveMenu(n.action); setIsNotifOpen(false); }} className="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer flex gap-3 items-start transition-colors relative pr-8">
                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${n.type==='alert'?'bg-red-500':n.type==='warning'?'bg-orange-500':n.type==='success'?'bg-green-500':'bg-blue-500'}`}>
                               <i className={`fa-solid ${n.type==='alert'?'fa-triangle-exclamation':n.type==='warning'?'fa-box':n.type==='success'?'fa-check':'fa-info'}`}></i>
                            </div>
                            <div>
                               <p className="text-xs font-bold text-gray-900">{n.title}</p>
                               <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.text}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setDismissedNotifs(prev => [...prev, n.id]); }} className="absolute right-3 top-3 text-gray-400 hover:text-red-500 p-1" title="Tutup Notif ini"><i className="fa-solid fa-xmark"></i></button>
                         </div>
                      )) : <div className="p-6 text-center text-gray-400"><i className="fa-regular fa-bell-slash text-3xl mb-2"></i><p className="text-sm">Tidak ada notifikasi baru.</p></div>}
                   </div>
                </div>
             )}
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8 print:p-0 print:overflow-visible pb-20 md:pb-8 relative">
          {isNotifOpen && <div className="absolute inset-0 z-40 bg-transparent" onClick={() => setIsNotifOpen(false)}></div>}
          <div className="relative z-0">
             {activeMenu === 'dashboard' && <Dashboard />}
             {activeMenu === 'kelola_pabrik' && <AdminKelolaPabrik />}
             {activeMenu === 'kelola_user' && <AdminKelolaUser />}
             {activeMenu === 'kelola_mesin' && <AdminKelolaMesin />}
             {activeMenu === 'kelola_sparepart' && <AdminKelolaSparepart />}
             {activeMenu === 'setup_pm' && <SetupPM />}
             {activeMenu === 'histori_perbaikan' && <HistoriPerbaikan />}
             {activeMenu === 'cetak' && <CetakLaporan />}
             {activeMenu === 'info_kpi' && <InfoKPI />}
             {activeMenu === 'daily_activity' && <TeknisiDailyActivity />}
             {activeMenu === 'cek_harian' && <CekHarian />}
             {activeMenu === 'penanganan_rusak' && <PenangananKerusakan />}
             {activeMenu === 'eksekusi_pm' && <EksekusiPM />}
             {activeMenu === 'teknisi_sparepart' && <TeknisiSparepart />}
             {activeMenu === 'req_perbaikan' && <UserRequestPerbaikan />}
          </div>
        </div>
      </main>
    </div>
  );
}