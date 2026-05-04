import { useState, useReducer, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// 🔧 KONFIGURASI
// ─────────────────────────────────────────────────────────────────────────────
const APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbyU005I1auRL8h7whcX5rNmto9AvbVYqw0tUw3jz_SEGMqct2LjnqwwMeQ6nD_sxtg9/exec";

// ─── API LAYER ────────────────────────────────────────────────────────────────
const api = {
  fetchAll: () =>
    fetch(`${APPSCRIPT_URL}?action=getAll`).then(r => r.json()),

  submitPembayaran: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "submitPembayaran", ...payload }),
    }).then(r => r.json()),

  approvePembayaran: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "approvePembayaran", ...payload }),
    }).then(r => r.json()),

  rejectPembayaran: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "rejectPembayaran", ...payload }),
    }).then(r => r.json()),

  assignMutasi: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "assignMutasi", ...payload }),
    }).then(r => r.json()),

  uploadMutasi: (rows) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "uploadMutasi", rows }),
    }).then(r => r.json()),

  uploadBukti: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "uploadBukti", ...payload }),
    }).then(r => r.json()),

  autoMatch: () =>
    fetch(`${APPSCRIPT_URL}?action=autoMatch`).then(r => r.json()),

  approvePembayaranManual: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "approvePembayaranManual", ...payload }),
    }).then(r => r.json()),

  addKas: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "addKas", ...payload }),
    }).then(r => r.json()),

  loginAdmin: (payload) =>
    fetch(APPSCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "loginAdmin", ...payload }),
    }).then(r => r.json()),
};

// ─── REDUCER ──────────────────────────────────────────────────────────────────
const initialState = {
  loading: true,
  saving: false,
  error: null,
  warga: [],
  tagihan: [],
  pembayaran: [],
  mutasi: [],
  deposit: [],
  kas: [],
  kasRingkasan: { masuk: 0, keluar: 0, saldo: 0 },
  config: {},
  currentWarga: null,
  session: null,
  notification: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":      return { ...state, loading: action.payload };
    case "SET_SAVING":       return { ...state, saving: action.payload };
    case "SET_ERROR":        return { ...state, error: action.payload, loading: false, saving: false };

    // FIX: Tambah SET_NOTIFICATION yang sebelumnya tidak ada di reducer
    case "SET_NOTIFICATION": return { ...state, notification: action.payload };

    case "LOGIN":
      sessionStorage.setItem("ipl_session", JSON.stringify(action.payload));
      return { ...state, session: action.payload, currentWarga: action.payload };

    case "LOGOUT":
      sessionStorage.removeItem("ipl_session");
      return { ...state, session: null, currentWarga: null };

    case "HYDRATE":
      return {
        ...state,
        loading: false,
        error: null,
        warga:        action.payload.warga        || [],
        tagihan:      action.payload.tagihan      || [],
        pembayaran:   action.payload.pembayaran   || [],
        mutasi:       action.payload.mutasi       || [],
        deposit:      action.payload.deposit      || [],
        kas:          action.payload.kas          || [],
        kasRingkasan: action.payload.kasRingkasan || { masuk: 0, keluar: 0, saldo: 0 },
        config:       action.payload.config       || {},
        currentWarga: state.session || action.payload.warga?.[0] || null,
      };

    // FIX: Refresh data setelah hydrate ulang
    case "REFRESH_DATA":
      return {
        ...state,
        loading: false,
        warga:        action.payload.warga        || state.warga,
        tagihan:      action.payload.tagihan      || state.tagihan,
        pembayaran:   action.payload.pembayaran   || state.pembayaran,
        mutasi:       action.payload.mutasi       || state.mutasi,
        deposit:      action.payload.deposit      || state.deposit,
        kas:          action.payload.kas          || state.kas,
        kasRingkasan: action.payload.kasRingkasan || state.kasRingkasan,
        config:       action.payload.config       || state.config,
      };

    case "ADD_KAS":
      return {
        ...state,
        saving: false,
        kas: [...state.kas, action.payload],
        notification: { type: "success", msg: "✅ Kas berhasil dicatat!" },
      };

    case "ADD_PEMBAYARAN_MANUAL":
      return {
        ...state,
        saving: false,
        pembayaran: [...state.pembayaran, action.payload],
        notification: { type: "success", msg: "✅ Pembayaran manual berhasil dicatat!" },
      };

    case "SET_WARGA":
      return { ...state, currentWarga: action.payload };

    case "ADD_PEMBAYARAN":
      return {
        ...state,
        saving: false,
        pembayaran: [...state.pembayaran, action.payload],
        notification: { type: "success", msg: "✅ Konfirmasi pembayaran terkirim! Status: PENDING" },
      };

    case "UPDATE_PEMBAYARAN": {
      const updated = state.pembayaran.map(p =>
        p.id === action.payload.id ? { ...p, ...action.payload.changes } : p
      );
      const updMutasi = action.payload.mutasiId
        ? state.mutasi.map(m => m.id === action.payload.mutasiId ? { ...m, matched: true } : m)
        : state.mutasi;
      return {
        ...state,
        saving: false,
        pembayaran: updated,
        mutasi: updMutasi,
        notification: { type: action.payload.notifType || "success", msg: action.payload.msg },
      };
    }

    case "ADD_MUTASI":
      return {
        ...state,
        saving: false,
        mutasi: [...state.mutasi, ...action.payload],
        notification: { type: "success", msg: `${action.payload.length} baris mutasi berhasil diupload!` },
      };

    case "CLEAR_NOTIF":
      return { ...state, notification: null };

    default:
      return state;
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt     = n => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
const fmtDate = d => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING:  { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-400",   label: "Menunggu"  },
    MATCHED:  { bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500",    label: "Cocok"     },
    APPROVED: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Disetujui" },
    REJECTED: { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500",     label: "Ditolak"   },
  };
  const s = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── DASHBOARD CARD ───────────────────────────────────────────────────────────
function DashboardCard({ icon, label, value, sub, color }) {
  const colors = {
    teal:    { border: "border-teal-500",    icon: "bg-teal-50 text-teal-600",      val: "text-teal-700"    },
    blue:    { border: "border-blue-500",    icon: "bg-blue-50 text-blue-600",      val: "text-blue-700"    },
    amber:   { border: "border-amber-500",   icon: "bg-amber-50 text-amber-600",    val: "text-amber-700"   },
    rose:    { border: "border-rose-500",    icon: "bg-rose-50 text-rose-600",      val: "text-rose-700"    },
    purple:  { border: "border-purple-500",  icon: "bg-purple-50 text-purple-600",  val: "text-purple-700"  },
    emerald: { border: "border-emerald-500", icon: "bg-emerald-50 text-emerald-600",val: "text-emerald-700" },
  };
  const c = colors[color] || colors.teal;
  return (
    <div className={`bg-white rounded-2xl border-l-4 ${c.border} shadow-sm p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${c.icon} flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold ${c.val} leading-tight`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── PAYMENT TABLE ────────────────────────────────────────────────────────────
function PaymentTable({ rows, columns }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {columns.map(c => (
              <th key={c.key} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={columns.length} className="text-center py-10 text-slate-400 italic">Tidak ada data</td></tr>
            : rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────
function Notification({ notif, onClose }) {
  if (!notif) return null;
  const colors = {
    success: "bg-emerald-500",
    error:   "bg-red-500",
    warning: "bg-amber-500",
    info:    "bg-blue-500",
  };
  return (
    <div className={`fixed top-4 right-4 ${colors[notif.type] || colors.success} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50`}>
      <span>{notif.msg}</span>
      <button onClick={onClose} className="font-bold text-xl leading-none">×</button>
    </div>
  );
}

// ─── LOADING & ERROR SCREENS ──────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-600 font-semibold">Loading...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Terjadi Kesalahan</h1>
        <p className="text-slate-600 text-sm mb-6">{error}</p>
        <button onClick={onRetry} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl">
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

// ─── LOGIN PAGE (WARGA) ───────────────────────────────────────────────────────
function LoginPage({ state, dispatch, onShowAdminLogin }) {
  const [searchText, setSearchText] = useState("");
  const [pin, setPin]               = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [showPin, setShowPin]       = useState(false);

  const filteredWarga = state.warga.filter(w =>
    w.nama.toLowerCase().includes(searchText.toLowerCase()) ||
    (w.blok + (w.nomor || "")).toLowerCase().includes(searchText.toLowerCase())
  );

  const selectedWarga = filteredWarga.length === 1 ? filteredWarga[0] : null;
  const selectedId    = selectedWarga?.id || "";

  const handleLogin = async () => {
    if (!selectedId) { setError("Cari dan pilih warga dulu"); return; }
    if (!pin)        { setError("Masukkan PIN"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `${APPSCRIPT_URL}?action=login&id_warga=${selectedId}&pin=${pin}`
      ).then(r => r.json());
      if (!res.ok) setError(res.msg || "Login gagal");
      else         dispatch({ type: "LOGIN", payload: res.data });
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-md">⭐</div>
          <h1 className="text-xl font-bold text-slate-800">{state.config.nama_perumahan || "Mandalika Residence"}</h1>
          <p className="text-slate-500 text-sm">{state.config.nama_sistem || "Sistem Iuran IPL"}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Cari Warga</label>
            <input
              type="text"
              placeholder="Ketik nama atau blok nomor..."
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setError(""); }}
              autoFocus
            />
            {searchText && (
              <div className="mt-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                {filteredWarga.length === 0
                  ? <p>❌ Tidak ada yang cocok</p>
                  : filteredWarga.length === 1
                    ? <p>✅ {filteredWarga[0].nama} — Blok {filteredWarga[0].blok}{filteredWarga[0].nomor || ""}</p>
                    : <p>📋 {filteredWarga.length} hasil ditemukan. Perjelas pencarian.</p>
                }
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">PIN</label>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                maxLength={6}
                placeholder="Masukkan PIN (6 digit)"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 pr-12 tracking-widest font-mono"
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
              <button type="button" onClick={() => setShowPin(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg">
                {showPin ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          <button onClick={handleLogin}
            disabled={loading || state.loading || !selectedId}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-sm">
            {loading ? "🔄 Memverifikasi…" : "Masuk"}
          </button>

          {/* FIX: Tambah tombol login admin yang sebelumnya tidak ada */}
          <button onClick={onShowAdminLogin}
            className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition-colors">
            🔑 Login sebagai Admin
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ADMIN (FIX: Halaman login admin yang sebelumnya tidak ada) ─────────
function AdminLoginPage({ state, dispatch, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!username) { setError("Username wajib diisi"); return; }
    if (!password) { setError("Password wajib diisi"); return; }
    setError("");
    setLoading(true);
    try {
      // Coba login via API Apps Script
      const res = await api.loginAdmin({ username, password });
      if (!res.ok) {
        setError(res.msg || "Username atau password salah");
      } else {
        dispatch({ type: "LOGIN", payload: { ...res.data, isAdmin: true } });
      }
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-md">🔑</div>
          <h1 className="text-xl font-bold text-slate-800">Admin Login</h1>
          <p className="text-slate-500 text-sm">{state.config.nama_perumahan || "Mandalika Residence"}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Username</label>
            <input type="text" placeholder="Username admin"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Password admin"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 pr-12"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg">
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? "🔄 Memverifikasi…" : "Masuk sebagai Admin"}
          </button>

          <button onClick={onBack}
            className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 transition-colors">
            ← Kembali ke login warga
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── USER: DASHBOARD ──────────────────────────────────────────────────────────
function UserDashboard({ state }) {
  const { currentWarga, pembayaran, tagihan } = state;
  if (!currentWarga) return null;

  const myPembayaran = pembayaran.filter(p => p.wargaId === currentWarga.id);
  const myTagihan    = tagihan.filter(t => t.wargaId === currentWarga.id);
  const lunasIds     = myPembayaran.filter(p => p.status === "APPROVED").map(p => p.tagihanId);
  const belumLunas   = myTagihan.filter(t => !lunasIds.includes(t.id));
  const totalTagihan = belumLunas.reduce((s, t) => s + t.nominal, 0);
  const totalBayar   = myPembayaran.filter(p => p.status === "APPROVED").reduce((s, p) => s + p.nominal, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Selamat datang, {currentWarga.nama} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Blok {currentWarga.blok}{currentWarga.nomor || ""}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashboardCard icon="📋" label="Tagihan Belum Lunas" value={belumLunas.length} sub={fmt(totalTagihan)} color="rose" />
        <DashboardCard icon="✅" label="Total Sudah Dibayar" value={fmt(totalBayar)} color="emerald" />
        <DashboardCard icon="⏳" label="Menunggu Persetujuan" value={myPembayaran.filter(p => p.status === "PENDING").length} color="amber" />
      </div>

      {belumLunas.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-slate-700 mb-4">Tagihan Aktif</h3>
          <div className="space-y-3">
            {belumLunas.map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-rose-50 rounded-xl border border-rose-200">
                <div>
                  <p className="font-semibold text-slate-700">{t.keterangan || "Iuran IPL"}</p>
                  <p className="text-xs text-slate-500">Jatuh tempo: {fmtDate(t.jatuhTempo)}</p>
                </div>
                <p className="font-bold text-rose-600">{fmt(t.nominal)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USER: QRIS PAGE ──────────────────────────────────────────────────────────
function QRISPage({ state }) {
  const config        = state.config;
  const nominalIpl    = config.nominal_ipl    || 40000;
  const bankName      = config.bank_name      || "BCA";
  const bankRekening  = config.bank_rekening  || "901025974294";
  const bankAtasNama  = config.bank_atas_nama || "EGI MARTIN SETIAWAN";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cara Bayar IPL</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏦</div>
          <div>
            <h2 className="font-bold text-slate-800">Informasi Rekening</h2>
            <p className="text-sm text-slate-500">{bankName}</p>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 space-y-1">
          <p className="text-xs text-slate-500 uppercase">Nomor Rekening</p>
          <p className="text-lg font-bold text-teal-600 font-mono">{bankRekening}</p>
          <p className="text-xs text-slate-500">Atas Nama: {bankAtasNama}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase mb-1">Nominal Transfer</p>
          <p className="text-3xl font-bold text-emerald-600">{fmt(nominalIpl)}</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg space-y-2">
          <p className="text-sm font-semibold text-yellow-800">📌 PERATURAN PEMBAYARAN IPL BULANAN</p>
          <ul className="text-xs text-yellow-700 space-y-1">
            <li>✓ Pembayaran dilakukan setiap bulan (batas: 25 setiap bulan)</li>
            <li>✓ Wajib menggunakan media transfer bank</li>
            <li>✓ <strong>Cantumkan nomor rumah di catatan bank (tanpa spasi/karakter lain)</strong></li>
            <li>✓ Gagal terbaca? Hubungi operator</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── USER: KONFIRMASI PEMBAYARAN ──────────────────────────────────────────────
function UserKonfirmasi({ state, dispatch }) {
  const { currentWarga, pembayaran, tagihan } = state;
  if (!currentWarga) return null;

  const [modal, setModal]               = useState(null);
  const [selectedTagihan, setSelectedTagihan] = useState("");
  const [buktiFile, setBuktiFile]       = useState(null);
  const [catatan, setCatatan]           = useState("");
  const [saving, setSaving]             = useState(false);
  const fileInputRef = useRef();

  const tagihanBelumLunas = tagihan.filter(t =>
    t.wargaId === currentWarga.id &&
    !pembayaran.find(p => p.tagihanId === t.id && p.status === "APPROVED")
  );

  const handleSubmit = async () => {
    if (!selectedTagihan) { alert("Pilih tagihan dulu"); return; }
    setSaving(true);
    try {
      const tgh = tagihan.find(t => t.id === selectedTagihan);
      if (!tgh) throw new Error("Tagihan tidak ditemukan");

      let buktiUrl = null;
      if (buktiFile) {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result.split(",")[1]);
          reader.onerror = () => reject(new Error("Gagal membaca file"));
          reader.readAsDataURL(buktiFile);
        });
        const buktiRes = await api.uploadBukti({
          fileName: buktiFile.name,
          fileData: base64Data,
          wargaId: currentWarga.id,
          tagihanId: selectedTagihan,
        });
        if (!buktiRes.ok) throw new Error("Upload bukti gagal: " + buktiRes.msg);
        buktiUrl = buktiRes.buktiUrl;
      }

      const submitRes = await api.submitPembayaran({
        id_warga:   currentWarga.id,
        id_tagihan: selectedTagihan,
        nominal:    tgh.nominal,
        catatan,
        bukti:      buktiUrl || null,
        tanggal:    new Date().toISOString().split("T")[0],
      });

      if (!submitRes.ok) throw new Error("Submit gagal: " + submitRes.msg);

      dispatch({ type: "ADD_PEMBAYARAN", payload: submitRes.data });
      setModal(null);
      setSelectedTagihan("");
      setBuktiFile(null);
      setCatatan("");
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const myPembayaran = pembayaran.filter(p => p.wargaId === currentWarga.id);
  const cols = [
    { key: "tanggal", label: "Tanggal", render: r => fmtDate(r.tanggal) },
    { key: "nominal", label: "Nominal", render: r => fmt(r.nominal) },
    { key: "status",  label: "Status",  render: r => <StatusBadge status={r.status} /> },
    { key: "bukti",   label: "Bukti",   render: r => r.bukti
      ? <a href={r.bukti} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">📎 Lihat</a>
      : "—"
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Konfirmasi Pembayaran</h1>
        {tagihanBelumLunas.length > 0 && (
          <button onClick={() => setModal("submit")} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-xl">
            + Konfirmasi Pembayaran
          </button>
        )}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-4">Riwayat Konfirmasi</h3>
        <PaymentTable rows={myPembayaran} columns={cols} />
      </div>

      {modal === "submit" && (
        <Modal title="Konfirmasi Pembayaran" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Pilih Tagihan</label>
              <select value={selectedTagihan} onChange={e => setSelectedTagihan(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">— Pilih tagihan —</option>
                {tagihanBelumLunas.map(t => (
                  <option key={t.id} value={t.id}>{t.keterangan} — {fmt(t.nominal)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Catatan (Nomor Rumah)</label>
              <input type="text" placeholder="Contoh: B234" value={catatan} onChange={e => setCatatan(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Upload Bukti Transfer (Opsional)</label>
              <button onClick={() => fileInputRef.current.click()}
                className="w-full border-2 border-dashed border-teal-300 rounded-xl p-4 text-center hover:bg-teal-50 transition-colors">
                <p className="text-sm text-teal-600 font-semibold">{buktiFile ? buktiFile.name : "📸 Klik untuk upload bukti"}</p>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                onChange={e => setBuktiFile(e.target.files?.[0])} className="hidden" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50">Batal</button>
              <button onClick={handleSubmit} disabled={saving || !selectedTagihan}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold">
                {saving ? "⏳ Mengirim..." : "✅ Konfirmasi"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── USER: RIWAYAT ────────────────────────────────────────────────────────────
function UserRiwayat({ state }) {
  const { currentWarga, pembayaran } = state;
  if (!currentWarga) return null;
  const myPembayaran = pembayaran
    .filter(p => p.wargaId === currentWarga.id)
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  const cols = [
    { key: "tanggal", label: "Tanggal", render: r => fmtDate(r.tanggal) },
    { key: "nominal", label: "Nominal", render: r => fmt(r.nominal) },
    { key: "status",  label: "Status",  render: r => <StatusBadge status={r.status} /> },
    { key: "catatan", label: "Catatan" },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Riwayat Pembayaran</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <PaymentTable rows={myPembayaran} columns={cols} />
      </div>
    </div>
  );
}

// ─── USER: PENGATURAN ─────────────────────────────────────────────────────────
function UserPengaturan({ state }) {
  const { currentWarga } = state;
  if (!currentWarga) return null;

  const [pinLama, setPinLama]   = useState("");
  const [pinBaru, setPinBaru]   = useState("");
  const [pinBaru2, setPinBaru2] = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [showPin, setShowPin]   = useState(false);

  const handleGantiPin = async () => {
    setError(""); setSuccess(false);
    if (!pinLama)             { setError("PIN lama wajib diisi"); return; }
    if (!pinBaru)             { setError("PIN baru wajib diisi"); return; }
    if (pinBaru.length !== 6) { setError("PIN harus 6 digit"); return; }
    if (pinBaru !== pinBaru2) { setError("PIN baru tidak cocok"); return; }
    if (pinLama === pinBaru)  { setError("PIN baru harus berbeda"); return; }

    setLoading(true);
    try {
      const loginRes = await fetch(`${APPSCRIPT_URL}?action=login&id_warga=${currentWarga.id}&pin=${pinLama}`).then(r => r.json());
      if (!loginRes.ok) { setError("PIN lama salah"); return; }

      const updateRes = await fetch(APPSCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "updatePin", id_warga: currentWarga.id, pin_baru: pinBaru }),
      }).then(r => r.json());

      if (!updateRes.ok) setError("Gagal update PIN: " + updateRes.msg);
      else { setSuccess(true); setPinLama(""); setPinBaru(""); setPinBaru2(""); }
    } catch (e) {
      setError("Terjadi kesalahan: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Pengaturan</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-800">🔐 Ganti PIN</h2>
        {["PIN Lama", "PIN Baru (6 digit)", "Konfirmasi PIN Baru"].map((label, i) => {
          const vals = [pinLama, pinBaru, pinBaru2];
          const sets = [setPinLama, setPinBaru, setPinBaru2];
          return (
            <div key={i}>
              <label className="block text-sm font-semibold text-slate-600 mb-1">{label}</label>
              <input type={showPin ? "text" : "password"} maxLength={6}
                placeholder={`Masukkan ${label.toLowerCase()}`}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 tracking-widest"
                value={vals[i]}
                onChange={e => { sets[i](e.target.value.replace(/\D/g, "")); setError(""); }}
              />
            </div>
          );
        })}
        <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer">
          <input type="checkbox" checked={showPin} onChange={e => setShowPin(e.target.checked)} />
          Tampilkan PIN
        </label>
        {error   && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3"><p className="text-red-600 text-sm">⚠️ {error}</p></div>}
        {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"><p className="text-emerald-600 text-sm">✅ PIN berhasil diubah!</p></div>}
        <button onClick={handleGantiPin} disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl">
          {loading ? "Memproses…" : "Ganti PIN"}
        </button>
      </div>
    </div>
  );
}

// ─── ADMIN: DASHBOARD (FIX: Tambah tombol refresh) ───────────────────────────
function AdminDashboard({ state, onRefresh, refreshing }) {
  const { pembayaran, mutasi, tagihan, warga } = state;
  const totalTagihan        = tagihan.reduce((s, t) => s + t.nominal, 0);
  const totalBayarApproved  = pembayaran.filter(p => p.status === "APPROVED").reduce((s, p) => s + p.nominal, 0);
  const totalPending        = pembayaran.filter(p => p.status === "PENDING").length;
  const totalMatched        = pembayaran.filter(p => p.status === "MATCHED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard Admin</h1>
        {/* FIX: Tambah tombol refresh */}
        <button onClick={onRefresh} disabled={refreshing}
          className="flex items-center gap-2 text-sm border border-slate-300 hover:border-teal-400 hover:text-teal-600 text-slate-500 px-4 py-2 rounded-xl transition-colors disabled:opacity-50">
          <span className={refreshing ? "animate-spin" : ""}>🔄</span>
          {refreshing ? "Memuat..." : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard icon="👥" label="Total Warga"             value={warga.length}                    color="blue"    />
        <DashboardCard icon="📋" label="Total Tagihan"           value={fmt(totalTagihan)}               color="rose"    />
        <DashboardCard icon="✅" label="Pembayaran Disetujui"    value={fmt(totalBayarApproved)}         color="emerald" />
        <DashboardCard icon="⏳" label="Menunggu Review"         value={totalPending}                    color="amber"   />
        <DashboardCard icon="🔗" label="Sudah Match"             value={totalMatched}                    color="purple"  />
        <DashboardCard icon="🏦" label="Total Mutasi Bank"       value={mutasi.length}                   color="teal"    />
      </div>

      {totalPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">Ada {totalPending} pembayaran menunggu review</p>
            <p className="text-xs text-amber-600">Segera cek menu Konfirmasi untuk approve atau reject.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OCR: PARSE SCREENSHOT MUTASI VIA APPS SCRIPT (Google Drive OCR) ─────────
async function ocrMutasiScreenshot(imageBase64, imageMediaType) {
  const response = await fetch(APPSCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "ocrMutasi",
      imageBase64,
      mediaType: imageMediaType || "image/jpeg",
    }),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.msg || "OCR gagal");
  return data.data || [];
}

// ─── DEDUPLICATION: cek apakah baris mutasi sudah ada di sistem ──────────────
function isDuplikat(row, existingMutasi) {
  return existingMutasi.some(m => {
    const tglSama     = m.tanggal === row.tanggal;
    const nominalSama = Number(m.nominal) === Number(row.nominal);
    const pengirimSama = (m.pengirim || "").toLowerCase().trim() ===
                         (row.pengirim || "").toLowerCase().trim();
    return tglSama && nominalSama && pengirimSama;
  });
}

// ─── ADMIN: UPLOAD MUTASI (TAB CSV + SCREENSHOT) ──────────────────────────────
function AdminUploadMutasi({ state, dispatch }) {
  const { saving } = state;
  const [activeTab, setActiveTab] = useState("screenshot");

  // ── State Tab Screenshot ──
  const [imgFile, setImgFile]         = useState(null);
  const [imgPreview, setImgPreview]   = useState(null);
  const [ocring, setOcring]           = useState(false);
  const [ocrResult, setOcrResult]     = useState(null); // array hasil OCR sebelum filter
  const [newRows, setNewRows]         = useState([]);   // baris baru (belum duplikat)
  const [dupRows, setDupRows]         = useState([]);   // baris duplikat
  const [ocrError, setOcrError]       = useState("");
  const imgRef = useRef();

  // ── State Tab CSV ──
  const [drag, setDrag]         = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const fileRef = useRef();

  // Handle pilih gambar
  const handleImgSelect = (file) => {
    if (!file) return;
    setImgFile(file);
    setOcrResult(null);
    setNewRows([]);
    setDupRows([]);
    setOcrError("");
    const reader = new FileReader();
    reader.onload = e => setImgPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // Jalankan OCR
  const handleOcr = async () => {
    if (!imgFile) return;
    setOcring(true);
    setOcrError("");
    setOcrResult(null);
    setNewRows([]);
    setDupRows([]);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result.split(",")[1]);
        reader.onerror = () => rej(new Error("Gagal baca file"));
        reader.readAsDataURL(imgFile);
      });
      const mediaType = imgFile.type || "image/jpeg";
      const rows = await ocrMutasiScreenshot(base64, mediaType);
      setOcrResult(rows);

      // Pisahkan: duplikat vs baru
      const dup  = rows.filter(r => isDuplikat(r, state.mutasi));
      const baru = rows.filter(r => !isDuplikat(r, state.mutasi));
      setDupRows(dup);
      setNewRows(baru);
    } catch (e) {
      setOcrError("Gagal parse gambar: " + e.message);
    }
    setOcring(false);
  };

  // Edit baris hasil OCR
  const handleEditRow = (idx, field, value) => {
    setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  // Hapus baris dari preview
  const handleDeleteRow = (idx) => {
    setNewRows(prev => prev.filter((_, i) => i !== idx));
  };

  // Simpan hasil OCR ke sistem
  const handleSaveOcr = async () => {
    if (newRows.length === 0) return;
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      const res = await api.uploadMutasi(newRows);
      if (res.ok) {
        dispatch({ type: "ADD_MUTASI", payload: res.data || newRows });
        const matchRes = await api.autoMatch();
        if (matchRes.ok && matchRes.matched > 0) {
          dispatch({ type: "SET_NOTIFICATION", payload: { type: "success", msg: `🔗 ${matchRes.matched} pembayaran otomatis ter-match!` } });
        }
        // Reset state
        setImgFile(null);
        setImgPreview(null);
        setOcrResult(null);
        setNewRows([]);
        setDupRows([]);
      } else {
        dispatch({ type: "SET_NOTIFICATION", payload: { type: "error", msg: "Gagal simpan: " + res.msg } });
      }
    } catch (e) {
      dispatch({ type: "SET_NOTIFICATION", payload: { type: "error", msg: "Error: " + e.message } });
    }
    dispatch({ type: "SET_SAVING", payload: false });
  };

  // ── CSV handler ──
  const parseCSV = (text) =>
    text.trim().split("\n").slice(1)
      .map(l => {
        const [tanggal, keterangan, nominal, pengirim] = l.split(",").map(s => s.trim().replace(/"/g, ""));
        return { tanggal, keterangan, nominal: parseInt(nominal) || 0, pengirim };
      })
      .filter(r => r.nominal > 0 && r.tanggal);

  const handleCSV = async (file) => {
    if (!file) return;
    setCsvFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    // Filter duplikat juga untuk CSV
    const baru = rows.filter(r => !isDuplikat(r, state.mutasi));
    const dup  = rows.filter(r => isDuplikat(r, state.mutasi));

    dispatch({ type: "SET_SAVING", payload: true });
    try {
      if (baru.length === 0) {
        dispatch({ type: "SET_NOTIFICATION", payload: { type: "warning", msg: `⚠️ Semua ${rows.length} baris sudah ada di sistem (duplikat).` } });
      } else {
        const res = await api.uploadMutasi(baru);
        if (res.ok) {
          dispatch({ type: "ADD_MUTASI", payload: res.data || baru });
          const matchRes = await api.autoMatch();
          let msg = `✅ ${baru.length} baris berhasil diupload.`;
          if (dup.length > 0) msg += ` (${dup.length} duplikat dilewati)`;
          if (matchRes.ok && matchRes.matched > 0) msg += ` 🔗 ${matchRes.matched} ter-match!`;
          dispatch({ type: "SET_NOTIFICATION", payload: { type: "success", msg } });
        }
      }
    } catch (e) {
      dispatch({ type: "SET_NOTIFICATION", payload: { type: "error", msg: "Gagal upload: " + e.message } });
    }
    dispatch({ type: "SET_SAVING", payload: false });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Upload Mutasi Bank</h1>

      {/* Tab switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        {[["screenshot", "📸 Screenshot"], ["csv", "📄 CSV"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === id ? "bg-white shadow text-teal-700" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB SCREENSHOT ── */}
      {activeTab === "screenshot" && (
        <div className="space-y-4">
          {/* Upload area */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${imgPreview ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-teal-300"}`}
            onClick={() => imgRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleImgSelect(e.dataTransfer.files[0]); }}
          >
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleImgSelect(e.target.files[0])} />
            {imgPreview ? (
              <div className="space-y-3">
                <img src={imgPreview} alt="preview" className="max-h-64 mx-auto rounded-xl object-contain shadow" />
                <p className="text-sm text-teal-600 font-semibold">{imgFile?.name}</p>
                <p className="text-xs text-slate-400">Klik untuk ganti gambar</p>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📸</div>
                <p className="text-slate-600 font-semibold">Upload screenshot mutasi bank</p>
                <p className="text-slate-400 text-sm mt-1">Drag & drop atau klik untuk pilih gambar</p>
                <p className="text-xs text-slate-400 mt-2">Format: JPG, PNG, WEBP</p>
              </>
            )}
          </div>

          {/* Tombol analisa */}
          {imgPreview && !ocrResult && (
            <button onClick={handleOcr} disabled={ocring}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
              {ocring ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Menganalisa gambar...</>
              ) : "🔍 Analisa Screenshot"}
            </button>
          )}

          {/* Error */}
          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600 text-sm">❌ {ocrError}</p>
            </div>
          )}

          {/* Hasil OCR */}
          {ocrResult && (
            <div className="space-y-4">
              {/* Info duplikat */}
              {dupRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800">⚠️ {dupRows.length} baris dilewati (sudah ada di sistem):</p>
                  <ul className="mt-2 space-y-1">
                    {dupRows.map((r, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {r.tanggal} — {r.pengirim} — Rp {Number(r.nominal).toLocaleString("id-ID")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tabel preview baris baru */}
              {newRows.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <p className="text-slate-500 font-semibold">✅ Semua data sudah ada di sistem</p>
                  <p className="text-slate-400 text-sm mt-1">Tidak ada data baru yang perlu ditambahkan.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-700">
                      Preview Data Baru ({newRows.length} baris)
                      <span className="text-xs font-normal text-slate-400 ml-2">— bisa diedit sebelum disimpan</span>
                    </h3>
                    <button onClick={() => { setOcrResult(null); setNewRows([]); setDupRows([]); }}
                      className="text-xs text-slate-400 hover:text-slate-600">Reset</button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          {["Tanggal", "Pengirim", "Keterangan", "Nominal", ""].map(h => (
                            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {newRows.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-3 py-2">
                              <input type="date" value={r.tanggal} onChange={e => handleEditRow(i, "tanggal", e.target.value)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={r.pengirim} onChange={e => handleEditRow(i, "pengirim", e.target.value)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="text" value={r.keterangan} onChange={e => handleEditRow(i, "keterangan", e.target.value)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={r.nominal} onChange={e => handleEditRow(i, "nominal", parseInt(e.target.value) || 0)}
                                className="border border-slate-200 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => handleDeleteRow(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button onClick={() => { setOcrResult(null); setNewRows([]); setDupRows([]); setImgPreview(null); setImgFile(null); }}
                      className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50">
                      Batal
                    </button>
                    <button onClick={handleSaveOcr} disabled={saving || newRows.length === 0}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold">
                      {saving ? "⏳ Menyimpan..." : `✅ Simpan ${newRows.length} Data`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">💡 Tips upload screenshot:</p>
            <p>• Screenshot harus jelas dan tidak blur</p>
            <p>• Pastikan semua baris transaksi terlihat</p>
            <p>• Data yang sudah ada di sistem akan otomatis dilewati</p>
            <p>• Cek dan edit data sebelum menyimpan</p>
          </div>
        </div>
      )}

      {/* ── TAB CSV ── */}
      {activeTab === "csv" && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${drag ? "border-teal-400 bg-teal-50" : "border-slate-300 bg-slate-50 hover:border-teal-300"} ${saving ? "opacity-60 pointer-events-none" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handleCSV(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleCSV(e.target.files[0])} />
            <div className="text-4xl mb-3">{saving ? "⏳" : csvFileName ? "✅" : "📂"}</div>
            {saving
              ? <p className="text-teal-600 font-semibold">Mengupload…</p>
              : csvFileName
                ? <p className="text-teal-700 font-semibold">{csvFileName} berhasil dipilih</p>
                : <>
                    <p className="text-slate-600 font-semibold">Drag & drop file CSV mutasi bank</p>
                    <p className="text-slate-400 text-sm mt-1">atau klik untuk browse</p>
                  </>
            }
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-2">📋 Format CSV yang dibutuhkan:</p>
            <p className="font-mono text-xs bg-white rounded p-2">tanggal,keterangan,nominal,pengirim</p>
            <p className="text-xs mt-2">Data yang sudah ada di sistem akan otomatis dilewati (tidak duplikat).</p>
          </div>
        </div>
      )}

      {/* Tabel mutasi terbaru */}
      {state.mutasi.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h3 className="font-bold text-slate-700 mb-4">Mutasi Terbaru ({state.mutasi.length} total)</h3>
          <PaymentTable
            rows={[...state.mutasi].reverse().slice(0, 10)}
            columns={[
              { key: "tanggal",  label: "Tanggal",  render: r => fmtDate(r.tanggal) },
              { key: "pengirim", label: "Pengirim" },
              { key: "nominal",  label: "Nominal",  render: r => fmt(r.nominal) },
              { key: "matched",  label: "Status",   render: r => r.matched
                ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">✓ Matched</span>
                : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">Belum</span>
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: MATCHING (FIX: Tambah approve langsung dari matching) ─────────────
function AdminMatching({ state, dispatch }) {
  const { pembayaran, mutasi, warga } = state;
  const [assignModal, setAssignModal] = useState(null);
  const [saving, setSaving]           = useState(false);

  const getWarga     = (id) => warga.find(w => w.id === id);
  const unmatched    = mutasi.filter(m => !m.matched);
  const pendingList  = pembayaran.filter(p => p.status === "PENDING" || p.status === "MATCHED");

  const handleAssign = async (mutasiId) => {
    if (!assignModal) return;
    setSaving(true);
    try {
      const res = await api.assignMutasi({ pembayaranId: assignModal.id, mutasiId });
      if (res.ok) {
        dispatch({
          type: "UPDATE_PEMBAYARAN",
          payload: {
            id: assignModal.id,
            changes: { status: "MATCHED", mutasiId },
            mutasiId,
            msg: "✅ Mutasi berhasil di-assign! Status jadi MATCHED.",
            notifType: "success",
          },
        });
        setAssignModal(null);
      } else {
        alert("Gagal assign: " + res.msg);
      }
    } catch (e) {
      alert("Gagal assign: " + e.message);
    }
    setSaving(false);
  };

  // FIX: Tambah approve langsung dari halaman matching (tidak perlu pindah menu)
  const handleApprove = async (id) => {
    setSaving(true);
    try {
      const res = await api.approvePembayaran({ pembayaranId: id });
      if (res.ok) {
        dispatch({
          type: "UPDATE_PEMBAYARAN",
          payload: { id, changes: { status: "APPROVED" }, msg: "✅ Pembayaran disetujui!", notifType: "success" },
        });
      } else {
        alert("Gagal approve: " + res.msg);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  const cols = [
    { key: "warga",   label: "Warga",   render: r => {
      const w = getWarga(r.wargaId);
      return w ? `${w.nama} (${w.blok}${w.nomor || ""})` : "—";
    }},
    { key: "nominal", label: "Nominal", render: r => fmt(r.nominal) },
    { key: "tanggal", label: "Tanggal", render: r => fmtDate(r.tanggal) },
    { key: "status",  label: "Status",  render: r => <StatusBadge status={r.status} /> },
    { key: "catatan", label: "Catatan" },
    { key: "action",  label: "Aksi",    render: r => (
      <div className="flex gap-2">
        {r.status === "PENDING" && (
          <button onClick={() => setAssignModal(r)} disabled={saving}
            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg">
            Assign
          </button>
        )}
        {/* FIX: Tombol approve langsung tersedia di halaman matching */}
        {r.status === "MATCHED" && (
          <button onClick={() => handleApprove(r.id)} disabled={saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg">
            ✓ Approve
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Matching Pembayaran</h1>

      <div className="grid grid-cols-2 gap-4">
        <DashboardCard icon="⏳" label="Pending"        value={pembayaran.filter(p => p.status === "PENDING").length} color="amber" />
        <DashboardCard icon="🔗" label="Siap Approve"   value={pembayaran.filter(p => p.status === "MATCHED").length} color="blue"  />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-4">Pembayaran Pending & Matched</h3>
        {pendingList.length === 0
          ? <p className="text-center text-slate-400 py-8">Tidak ada pembayaran yang perlu diproses 🎉</p>
          : <PaymentTable rows={pendingList} columns={cols} />
        }
      </div>

      {/* Modal assign mutasi */}
      {assignModal && (
        <Modal title="Assign Mutasi ke Pembayaran" onClose={() => setAssignModal(null)}>
          <p className="text-sm text-slate-600 mb-3">
            Pilih mutasi untuk <strong>{getWarga(assignModal.wargaId)?.nama || "—"}</strong> — {fmt(assignModal.nominal)}:
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {unmatched.length === 0
              ? <p className="text-center text-slate-400 text-sm py-4">Tidak ada mutasi yang tersedia</p>
              : unmatched.map(m => (
                <button key={m.id} onClick={() => handleAssign(m.id)} disabled={saving}
                  className="w-full text-left p-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
                  <p className="font-semibold text-slate-700 text-sm">{m.pengirim}</p>
                  <p className="text-xs text-slate-400">{fmtDate(m.tanggal)} · {m.keterangan}</p>
                  <p className="text-sm font-bold text-teal-600 mt-1">{fmt(m.nominal)}</p>
                </button>
              ))
            }
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN: KONFIRMASI PEMBAYARAN ─────────────────────────────────────────────
function AdminKonfirmasi({ state, dispatch }) {
  const { pembayaran, warga } = state;
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectNote, setRejectNote]   = useState("");
  const [saving, setSaving]           = useState(false);

  const getWarga = (id) => warga.find(w => w.id === id);

  const handleApprove = async (id) => {
    setSaving(true);
    try {
      const res = await api.approvePembayaran({ pembayaranId: id });
      if (res.ok) {
        dispatch({ type: "UPDATE_PEMBAYARAN", payload: { id, changes: { status: "APPROVED" }, msg: "✅ Pembayaran disetujui!", notifType: "success" } });
      } else {
        alert("Gagal approve: " + res.msg);
      }
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    try {
      const res = await api.rejectPembayaran({ pembayaranId: rejectModal.id, note: rejectNote });
      if (res.ok) {
        dispatch({ type: "UPDATE_PEMBAYARAN", payload: { id: rejectModal.id, changes: { status: "REJECTED" }, msg: "Pembayaran ditolak", notifType: "warning" } });
        setRejectModal(null);
        setRejectNote("");
      } else {
        alert("Gagal reject: " + res.msg);
      }
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const cols = [
    { key: "warga",   label: "Warga",   render: r => { const w = getWarga(r.wargaId); return w ? `${w.nama} (${w.blok})` : "—"; } },
    { key: "nominal", label: "Nominal", render: r => fmt(r.nominal) },
    { key: "tanggal", label: "Tanggal", render: r => fmtDate(r.tanggal) },
    { key: "status",  label: "Status",  render: r => <StatusBadge status={r.status} /> },
    { key: "bukti",   label: "Bukti",   render: r => r.bukti
      ? <a href={r.bukti} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs">📎 Lihat</a>
      : "—"
    },
    { key: "action",  label: "Aksi",    render: r => (r.status === "PENDING" || r.status === "MATCHED")
      ? <div className="flex gap-2">
          <button onClick={() => handleApprove(r.id)} disabled={saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg">✓</button>
          <button onClick={() => setRejectModal(r)} disabled={saving}
            className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-2 py-1 rounded-lg">✕</button>
        </div>
      : "—"
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Konfirmasi Pembayaran</h1>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-4">Semua Pembayaran</h3>
        <div className="overflow-x-auto">
          <PaymentTable rows={[...pembayaran].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal))} columns={cols} />
        </div>
      </div>

      {rejectModal && (
        <Modal title="Tolak Pembayaran" onClose={() => setRejectModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Berikan alasan penolakan (opsional):</p>
            <textarea className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
              placeholder="Contoh: Nominal tidak sesuai, nama pengirim berbeda…" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50">Batal</button>
              <button onClick={handleReject} disabled={saving}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold">
                {saving ? "Memproses…" : "Tolak"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN: LAPORAN ───────────────────────────────────────────────────────────
function AdminLaporan({ state }) {
  const { pembayaran, warga } = state;
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterBulan, setFilterBulan]   = useState("");
  const [searchWarga, setSearchWarga]   = useState("");
  const [sortBy, setSortBy]             = useState("tanggal-desc");

  const getWarga = (id) => warga.find(w => w.id === id);

  let filtered = pembayaran;
  if (filterStatus !== "ALL") filtered = filtered.filter(p => p.status === filterStatus);
  if (filterBulan)            filtered = filtered.filter(p => p.tanggal?.startsWith(filterBulan));
  if (searchWarga) {
    const s = searchWarga.toLowerCase();
    filtered = filtered.filter(p => {
      const w = getWarga(p.wargaId);
      return w && (w.nama.toLowerCase().includes(s) || w.blok.toLowerCase().includes(s));
    });
  }
  if (sortBy === "tanggal-desc") filtered = [...filtered].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));
  if (sortBy === "tanggal-asc")  filtered = [...filtered].sort((a,b) => new Date(a.tanggal) - new Date(b.tanggal));
  if (sortBy === "nominal-desc") filtered = [...filtered].sort((a,b) => b.nominal - a.nominal);
  if (sortBy === "nominal-asc")  filtered = [...filtered].sort((a,b) => a.nominal - b.nominal);

  const stats = {
    total:           pembayaran.length,
    pending:         pembayaran.filter(p => p.status === "PENDING").length,
    matched:         pembayaran.filter(p => p.status === "MATCHED").length,
    approved:        pembayaran.filter(p => p.status === "APPROVED").length,
    rejected:        pembayaran.filter(p => p.status === "REJECTED").length,
    approvedNominal: pembayaran.filter(p => p.status === "APPROVED").reduce((s,p) => s + p.nominal, 0),
    filteredNominal: filtered.reduce((s,p) => s + p.nominal, 0),
  };

  const handleExport = () => {
    const headers = ["ID", "Warga", "Blok", "Nominal", "Tanggal", "Status", "Catatan"];
    const rows = filtered.map(p => {
      const w = getWarga(p.wargaId);
      return [p.id, w?.nama || "—", w?.blok || "—", p.nominal, p.tanggal, p.status, p.catatan || "—"];
    });
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `laporan-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const cols = [
    { key: "warga",   label: "Warga",   render: r => { const w = getWarga(r.wargaId); return w ? `${w.nama} (${w.blok})` : "—"; } },
    { key: "nominal", label: "Nominal", render: r => fmt(r.nominal) },
    { key: "tanggal", label: "Tanggal", render: r => fmtDate(r.tanggal) },
    { key: "status",  label: "Status",  render: r => <StatusBadge status={r.status} /> },
    { key: "bukti",   label: "Bukti",   render: r => r.bukti
      ? <a href={r.bukti} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline text-xs">📎 Lihat</a>
      : "—"
    },
    { key: "catatan", label: "Catatan", render: r => <span className="text-xs">{r.catatan || "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Laporan Pembayaran</h1>
        <button onClick={handleExport} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-xl flex items-center gap-2">
          📥 Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <DashboardCard icon="📊" label="Total"    value={stats.total}    color="blue"    />
        <DashboardCard icon="⏳" label="Pending"  value={stats.pending}  color="amber"   />
        <DashboardCard icon="🔗" label="Matched"  value={stats.matched}  color="purple"  />
        <DashboardCard icon="✅" label="Approved" value={stats.approved} color="emerald" />
        <DashboardCard icon="❌" label="Rejected" value={stats.rejected} color="rose"    />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Total Nominal Approved</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(stats.approvedNominal)}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.approved} transaksi</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Hasil Filter Saat Ini</p>
          <p className="text-2xl font-bold text-slate-800">{fmt(stats.filteredNominal)}</p>
          <p className="text-xs text-slate-400 mt-1">{filtered.length} transaksi</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
        <h3 className="font-bold text-slate-700">Filter & Cari</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="ALL">Semua</option>
              <option value="PENDING">PENDING</option>
              <option value="MATCHED">MATCHED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Bulan</label>
            <input type="month" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Cari Warga/Blok</label>
            <input type="text" placeholder="Nama atau blok..." value={searchWarga} onChange={e => setSearchWarga(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Urutkan</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="tanggal-desc">Tanggal (Terbaru)</option>
              <option value="tanggal-asc">Tanggal (Terlama)</option>
              <option value="nominal-desc">Nominal (Terbesar)</option>
              <option value="nominal-asc">Nominal (Terkecil)</option>
            </select>
          </div>
        </div>
        <button onClick={() => { setFilterStatus("ALL"); setFilterBulan(""); setSearchWarga(""); setSortBy("tanggal-desc"); }}
          className="text-sm text-slate-500 hover:text-slate-700 border border-slate-300 px-4 py-2 rounded-lg">
          🔄 Reset Filter
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-4">Detail ({filtered.length} data)</h3>
        <PaymentTable rows={filtered} columns={cols} />
      </div>
    </div>
  );
}


// ─── USER: SALDO DEPOSIT ──────────────────────────────────────────────────────
function UserDeposit({ state }) {
  const { currentWarga, deposit } = state;
  if (!currentWarga) return null;

  const myDeposit = deposit.filter(d => d.wargaId === currentWarga.id);
  const saldo = myDeposit.reduce((s, d) => d.tipe === "MASUK" ? s + d.nominal : s - d.nominal, 0);

  const cols = [
    { key: "tanggal",    label: "Tanggal",    render: r => fmtDate(r.tanggal) },
    { key: "keterangan", label: "Keterangan" },
    { key: "tipe",       label: "Tipe",       render: r => (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.tipe === "MASUK" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
        {r.tipe === "MASUK" ? "⬇️ Masuk" : "⬆️ Dipakai"}
      </span>
    )},
    { key: "nominal", label: "Nominal", render: r => (
      <span className={r.tipe === "MASUK" ? "text-emerald-600 font-semibold" : "text-blue-600 font-semibold"}>
        {r.tipe === "MASUK" ? "+" : "-"}{fmt(r.nominal)}
      </span>
    )},
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Saldo Deposit</h1>

      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 text-white">
        <p className="text-sm font-medium opacity-80">Saldo Deposit Kamu</p>
        <p className="text-4xl font-bold mt-1">{fmt(saldo)}</p>
        <p className="text-xs opacity-70 mt-2">Akan otomatis dipotong tagihan bulan berikutnya</p>
      </div>

      {saldo > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700">
          💡 Deposit kamu cukup untuk <strong>{Math.floor(saldo / (state.config.nominal_ipl || 40000))} bulan</strong> ke depan tanpa perlu transfer.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-700 mb-4">Riwayat Deposit</h3>
        <PaymentTable rows={[...myDeposit].reverse()} columns={cols} />
      </div>
    </div>
  );
}

// ─── ADMIN: KAS ───────────────────────────────────────────────────────────────
function AdminKas({ state, dispatch }) {
  const { kas, kasRingkasan, warga, pembayaran } = state;
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState({ tanggal: "", keterangan: "", kategori: "Kebersihan", nominal: "", tipe: "KELUAR" });
  const [saving, setSaving]       = useState(false);
  const [filterTipe, setFilterTipe] = useState("SEMUA");

  const KATEGORI = ["IPL","Kebersihan","Peralatan","Perbaikan","Administrasi","Lainnya"];
  const KATEGORI_ICON = { IPL:"🏘", Kebersihan:"🌿", Peralatan:"🔧", Perbaikan:"🔨", Administrasi:"📋", Lainnya:"📦" };

  const totalDeposit = state.deposit.reduce((s, d) => d.tipe === "MASUK" ? s + d.nominal : s - d.nominal, 0);
  // Hitung per warga
  const depositPerWarga = {};
  state.deposit.forEach(d => {
    if (!depositPerWarga[d.wargaId]) depositPerWarga[d.wargaId] = 0;
    depositPerWarga[d.wargaId] += d.tipe === "MASUK" ? d.nominal : -d.nominal;
  });
  const wargaDeposit = Object.values(depositPerWarga).filter(v => v > 0).length;

  const filtered = filterTipe === "SEMUA" ? kas : kas.filter(k => k.tipe === filterTipe);

  const handleSimpan = async () => {
    if (!form.keterangan || !form.nominal) { alert("Keterangan dan nominal wajib diisi"); return; }
    setSaving(true);
    try {
      const res = await api.addKas(form);
      if (res.ok) {
        dispatch({ type: "ADD_KAS", payload: res.data });
        setModal(null);
        setForm({ tanggal: "", keterangan: "", kategori: "Kebersihan", nominal: "", tipe: "KELUAR" });
      } else {
        alert("Gagal: " + res.msg);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  // Progress koleksi bulan ini
  const thisMonth = new Date().toISOString().slice(0, 7);
  const sudahBayar = new Set(
    pembayaran.filter(p => p.status === "APPROVED" && p.tanggal?.startsWith(thisMonth)).map(p => p.wargaId)
  );
  const pct = warga.length > 0 ? Math.round((sudahBayar.size / warga.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Kas & Keuangan</h1>
        <button onClick={() => setModal("tambah")}
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-xl text-sm">
          + Catat Transaksi
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-semibold uppercase">Total Masuk</p>
          <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(kasRingkasan.masuk)}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-xs text-rose-600 font-semibold uppercase">Total Keluar</p>
          <p className="text-lg font-bold text-rose-700 mt-1">{fmt(kasRingkasan.keluar)}</p>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs text-teal-600 font-semibold uppercase">Saldo Kas Real</p>
          <p className="text-lg font-bold text-teal-700 mt-1">{fmt(kasRingkasan.saldo - totalDeposit)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-semibold uppercase">Total Deposit</p>
          <p className="text-lg font-bold text-blue-700 mt-1">{fmt(totalDeposit)}</p>
          <p className="text-xs text-blue-500 mt-0.5">{wargaDeposit} warga</p>
        </div>
      </div>

      {/* Progress IPL bulan ini */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="font-bold text-slate-700">Koleksi IPL Bulan Ini</h3>
            <p className="text-xs text-slate-400 mt-0.5">{sudahBayar.size} dari {warga.length} warga</p>
          </div>
          <span className="text-xl font-bold text-teal-600">{pct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 mt-3">
          <div className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all" style={{width:`${pct}%`}} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>{fmt(sudahBayar.size * (state.config.nominal_ipl || 40000))} terkumpul</span>
          <span>Target {fmt(warga.length * (state.config.nominal_ipl || 40000))}</span>
        </div>
      </div>

      {/* Filter & riwayat */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-700">Riwayat Transaksi</h3>
          <div className="flex gap-1.5">
            {["SEMUA","MASUK","KELUAR"].map(t => (
              <button key={t} onClick={() => setFilterTipe(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filterTipe===t ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {filtered.length === 0
            ? <p className="text-center py-8 text-slate-400 text-sm">Tidak ada data</p>
            : [...filtered].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal)).map(k => (
              <div key={k.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${k.tipe==="MASUK" ? "bg-emerald-100" : "bg-rose-100"}`}>
                  {KATEGORI_ICON[k.kategori] || "📦"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{k.keterangan}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{k.kategori}</span>
                    <span className="text-xs text-slate-400">{fmtDate(k.tanggal)}</span>
                  </div>
                </div>
                <p className={`font-bold text-sm ${k.tipe==="MASUK" ? "text-emerald-600" : "text-rose-500"}`}>
                  {k.tipe==="MASUK" ? "+" : "-"}{fmt(k.nominal)}
                </p>
              </div>
            ))
          }
        </div>
      </div>

      {/* Modal tambah kas */}
      {modal === "tambah" && (
        <Modal title="Catat Transaksi Kas" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setForm(f => ({...f, tipe:"KELUAR"}))}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.tipe==="KELUAR" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-500"}`}>
                ⬆️ Pengeluaran
              </button>
              <button onClick={() => setForm(f => ({...f, tipe:"MASUK"}))}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.tipe==="MASUK" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
                ⬇️ Pemasukan
              </button>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Tanggal</label>
              <input type="date" value={form.tanggal} onChange={e => setForm(f => ({...f, tanggal:e.target.value}))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Keterangan</label>
              <input type="text" placeholder="Contoh: Bayar tukang kebun" value={form.keterangan}
                onChange={e => setForm(f => ({...f, keterangan:e.target.value}))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Kategori</label>
              <select value={form.kategori} onChange={e => setForm(f => ({...f, kategori:e.target.value}))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">Nominal</label>
              <input type="number" placeholder="Contoh: 150000" value={form.nominal}
                onChange={e => setForm(f => ({...f, nominal:e.target.value}))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-slate-300 text-slate-600 py-2 rounded-xl text-sm font-semibold">Batal</button>
              <button onClick={handleSimpan} disabled={saving}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold">
                {saving ? "⏳ Menyimpan..." : "✅ Simpan"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN: STATUS WARGA ──────────────────────────────────────────────────────
function AdminStatusWarga({ state }) {
  const { warga, pembayaran, deposit, tagihan } = state;
  const [filter, setFilter] = useState("SEMUA");
  const [search, setSearch] = useState("");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const sudahBayarIds = new Set(
    pembayaran.filter(p => p.status === "APPROVED" && p.tanggal?.startsWith(thisMonth)).map(p => p.wargaId)
  );

  // Hitung saldo deposit per warga
  const depositMap = {};
  deposit.forEach(d => {
    if (!depositMap[d.wargaId]) depositMap[d.wargaId] = 0;
    depositMap[d.wargaId] += d.tipe === "MASUK" ? d.nominal : -d.nominal;
  });

  const filtered = warga.filter(w => {
    const stOk = filter === "SEMUA" ? true : filter === "LUNAS" ? sudahBayarIds.has(w.id) : !sudahBayarIds.has(w.id);
    const srOk = !search || w.nama.toLowerCase().includes(search.toLowerCase()) || `${w.blok}${w.nomor}`.toLowerCase().includes(search.toLowerCase());
    return stOk && srOk;
  });

  const lunas = warga.filter(w => sudahBayarIds.has(w.id)).length;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Status Warga</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{lunas}</p>
          <p className="text-xs text-slate-500 mt-0.5">Sudah Bayar</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-rose-600">{warga.length - lunas}</p>
          <p className="text-xs text-slate-500 mt-0.5">Belum Bayar</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{warga.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Warga</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5">
          {[["SEMUA","Semua"],["LUNAS","✅ Lunas"],["BELUM","⏳ Belum"]].map(([val,label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter===val ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {label}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Cari nama atau blok..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50 grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase">
          <span className="col-span-2">Blok</span>
          <span className="col-span-5">Nama</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-3 text-right">Deposit</span>
        </div>
        <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
          {filtered.length === 0
            ? <p className="text-center py-8 text-slate-400 text-sm">Tidak ada data</p>
            : filtered.map(w => {
              const lunas = sudahBayarIds.has(w.id);
              const dep   = depositMap[w.id] || 0;
              return (
                <div key={w.id} className={`px-5 py-3 grid grid-cols-12 items-center hover:bg-slate-50 transition-colors ${!lunas ? "bg-rose-50/20" : ""}`}>
                  <span className="col-span-2 text-sm font-bold text-slate-600">{w.blok}{w.nomor}</span>
                  <span className="col-span-5 text-sm text-slate-700 truncate pr-2">{w.nama}</span>
                  <span className="col-span-2">
                    {lunas
                      ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">✓ Lunas</span>
                      : <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-semibold">⏳ Belum</span>
                    }
                  </span>
                  <span className="col-span-3 text-right text-xs font-semibold">
                    {dep > 0 ? <span className="text-teal-600">{fmt(dep)}</span> : <span className="text-slate-300">—</span>}
                  </span>
                </div>
              );
            })
          }
        </div>
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-between text-xs">
          <span className="text-slate-400">{filtered.length} dari {warga.length} warga</span>
          <span className="font-semibold text-teal-600">{fmt(lunas * (state.config.nominal_ipl || 40000))} / {fmt(warga.length * (state.config.nominal_ipl || 40000))}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: CATAT PEMBAYARAN MANUAL ──────────────────────────────────────────
function AdminCatatManual({ state, dispatch }) {
  const { warga, tagihan, pembayaran, mutasi } = state;
  const [form, setForm] = useState({ id_warga: "", id_tagihan: "", nominal: "", tanggal: "", catatan: "", mutasiId: "" });
  const [saving, setSaving] = useState(false);

  const getTagihanWarga = () => {
    if (!form.id_warga) return [];
    return tagihan.filter(t =>
      t.wargaId === form.id_warga &&
      !pembayaran.find(p => p.tagihanId === t.id && p.status === "APPROVED")
    );
  };

  const unmatchedMutasi = mutasi.filter(m => !m.matched);

  const handleSimpan = async () => {
    if (!form.id_warga || !form.id_tagihan || !form.nominal) {
      alert("Warga, tagihan, dan nominal wajib diisi"); return;
    }
    setSaving(true);
    try {
      const res = await api.approvePembayaranManual(form);
      if (res.ok) {
        dispatch({ type: "ADD_PEMBAYARAN_MANUAL", payload: res.data });
        setForm({ id_warga: "", id_tagihan: "", nominal: "", tanggal: "", catatan: "", mutasiId: "" });
      } else {
        alert("Gagal: " + res.msg);
      }
    } catch (e) {
      alert("Error: " + e.message);
    }
    setSaving(false);
  };

  const tagihanWarga = getTagihanWarga();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Catat Pembayaran Manual</h1>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        ⚠️ Gunakan fitur ini untuk menutup tagihan warga yang sudah bayar tapi tidak kirim konfirmasi lewat sistem.
        Pembayaran akan langsung berstatus <strong>APPROVED</strong>.
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1">Pilih Warga</label>
          <select value={form.id_warga} onChange={e => setForm(f => ({...f, id_warga:e.target.value, id_tagihan:""}))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">— Pilih warga —</option>
            {warga.map(w => <option key={w.id} value={w.id}>{w.nama} ({w.blok}{w.nomor})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1">Pilih Tagihan</label>
          <select value={form.id_tagihan} onChange={e => {
            const t = tagihan.find(t => t.id === e.target.value);
            setForm(f => ({...f, id_tagihan:e.target.value, nominal: t?.nominal || f.nominal}));
          }}
            disabled={!form.id_warga}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:opacity-50">
            <option value="">— Pilih tagihan —</option>
            {tagihanWarga.map(t => <option key={t.id} value={t.id}>{t.keterangan || t.bulan} — {fmt(t.nominal)}</option>)}
          </select>
          {form.id_warga && tagihanWarga.length === 0 && (
            <p className="text-xs text-emerald-600 mt-1">✅ Semua tagihan warga ini sudah lunas</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Nominal</label>
            <input type="number" value={form.nominal} onChange={e => setForm(f => ({...f, nominal:e.target.value}))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">Tanggal Bayar</label>
            <input type="date" value={form.tanggal} onChange={e => setForm(f => ({...f, tanggal:e.target.value}))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1">Link ke Mutasi (Opsional)</label>
          <select value={form.mutasiId} onChange={e => setForm(f => ({...f, mutasiId:e.target.value}))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">— Tidak ada / pilih mutasi —</option>
            {unmatchedMutasi.map(m => (
              <option key={m.id} value={m.id}>{m.pengirim} · {fmtDate(m.tanggal)} · {fmt(m.nominal)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-600 mb-1">Catatan</label>
          <input type="text" placeholder="Contoh: Bayar tunai ke ketua RT" value={form.catatan}
            onChange={e => setForm(f => ({...f, catatan:e.target.value}))}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        <button onClick={handleSimpan} disabled={saving || !form.id_warga || !form.id_tagihan || !form.nominal}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl">
          {saving ? "⏳ Menyimpan..." : "✅ Catat & Approve Pembayaran"}
        </button>
      </div>
    </div>
  );
}

// ─── NAV CONFIG ───────────────────────────────────────────────────────────────
const USER_MENU = [
  { id: "dashboard",  label: "Dashboard", icon: "🏠" },
  { id: "qris",       label: "Cara Bayar", icon: "🏦" },
  { id: "konfirmasi", label: "Konfirmasi", icon: "📤" },
  { id: "riwayat",    label: "Riwayat",   icon: "📜" },
  { id: "deposit",    label: "Deposit",   icon: "💎" },
  { id: "pengaturan", label: "Pengaturan", icon: "⚙️" },
];
const ADMIN_MENU = [
  { id: "admin-dashboard",  label: "Dashboard",    icon: "📊" },
  { id: "admin-status",     label: "Status Warga", icon: "👥" },
  { id: "admin-kas",        label: "Kas",          icon: "💰" },
  { id: "admin-mutasi",     label: "Mutasi Bank",  icon: "📁" },
  { id: "admin-matching",   label: "Matching",     icon: "🔗" },
  { id: "admin-konfirmasi", label: "Konfirmasi",   icon: "✅" },
  { id: "admin-manual",     label: "Catat Manual", icon: "✍️" },
  { id: "admin-laporan",    label: "Laporan",      icon: "📋" },
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch]     = useReducer(reducer, initialState);
  const [role, setRole]       = useState("user");
  const [page, setPage]       = useState("dashboard");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  // Auto-clear notification
  useEffect(() => {
    if (!state.notification) return;
    const t = setTimeout(() => dispatch({ type: "CLEAR_NOTIF" }), 4000);
    return () => clearTimeout(t);
  }, [state.notification]);

  // Load data awal
  const loadData = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const data = await api.fetchAll();
      dispatch({ type: "HYDRATE", payload: data });
    } catch (e) {
      dispatch({ type: "SET_ERROR", payload: e.message || "Koneksi ke AppScript gagal." });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem("ipl_session");
    if (saved) dispatch({ type: "LOGIN", payload: JSON.parse(saved) });
  }, []);

  // Deteksi isAdmin dari session
  useEffect(() => {
    if (state.session?.isAdmin === true) {
      setRole("admin");
      setPage("admin-dashboard");
    }
  }, [state.session?.isAdmin]);

  // FIX: Fungsi refresh data (bisa dipanggil dari admin dashboard)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await api.fetchAll();
      dispatch({ type: "REFRESH_DATA", payload: data });
      dispatch({ type: "SET_NOTIFICATION", payload: { type: "success", msg: "✅ Data berhasil diperbarui!" } });
    } catch (e) {
      dispatch({ type: "SET_NOTIFICATION", payload: { type: "error", msg: "Gagal refresh: " + e.message } });
    }
    setRefreshing(false);
  }, []);

  const handleRoleSwitch = (r) => {
    setRole(r);
    setPage(r === "admin" ? "admin-dashboard" : "dashboard");
  };

  if (state.loading) return <LoadingScreen />;
  if (state.error)   return <ErrorScreen error={state.error} onRetry={loadData} />;

  // FIX: Tampilkan halaman admin login jika dipilih
  if (!state.session) {
    if (showAdminLogin) return <AdminLoginPage state={state} dispatch={dispatch} onBack={() => setShowAdminLogin(false)} />;
    return <LoginPage state={state} dispatch={dispatch} onShowAdminLogin={() => setShowAdminLogin(true)} />;
  }

  const menu = role === "admin" ? ADMIN_MENU : USER_MENU;

  const renderPage = () => {
    if (role === "user") switch (page) {
      case "dashboard":  return <UserDashboard  state={state} />;
      case "qris":       return <QRISPage        state={state} />;
      case "konfirmasi": return <UserKonfirmasi  state={state} dispatch={dispatch} />;
      case "riwayat":    return <UserRiwayat     state={state} />;
      case "deposit":    return <UserDeposit     state={state} />;
      case "pengaturan": return <UserPengaturan  state={state} />;
      default:           return null;
    }
    switch (page) {
      case "admin-dashboard":  return <AdminDashboard  state={state} onRefresh={handleRefresh} refreshing={refreshing} />;
      case "admin-status":     return <AdminStatusWarga state={state} />;
      case "admin-kas":        return <AdminKas         state={state} dispatch={dispatch} />;
      case "admin-mutasi":     return <AdminUploadMutasi state={state} dispatch={dispatch} />;
      case "admin-matching":   return <AdminMatching    state={state} dispatch={dispatch} />;
      case "admin-konfirmasi": return <AdminKonfirmasi  state={state} dispatch={dispatch} />;
      case "admin-manual":     return <AdminCatatManual state={state} dispatch={dispatch} />;
      case "admin-laporan":    return <AdminLaporan     state={state} />;
      default:                 return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <Notification notif={state.notification} onClose={() => dispatch({ type: "CLEAR_NOTIF" })} />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-full px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">🏘</div>
            <div className="hidden sm:block min-w-0">
              <p className="font-bold text-slate-800 text-sm leading-tight">{state.config.nama_perumahan || "Mandalika Residence"}</p>
              <p className="text-xs text-slate-400 leading-tight">{state.config.nama_sistem || "Sistem Iuran IPL"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Toggle role admin/warga */}
            {state.session?.isAdmin && (
              <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-semibold">
                {[["user","👤 Warga"],["admin","🔑 Admin"]].map(([r, label]) => (
                  <button key={r} onClick={() => handleRoleSwitch(r)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${role === r ? "bg-white shadow text-teal-700" : "text-slate-500 hover:text-slate-700"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Info warga + tombol keluar */}
            {state.session && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-700">{state.session.nama || "Admin"}</p>
                  <p className="text-xs text-slate-400">{state.session.isAdmin ? "Administrator" : `Blok ${state.session.blok}${state.session.nomor || ""}`}</p>
                </div>
                <button
                  onClick={() => { dispatch({ type: "LOGOUT" }); setRole("user"); setPage("dashboard"); setShowAdminLogin(false); }}
                  className="text-xs border border-slate-300 text-slate-500 hover:text-red-500 hover:border-red-300 px-2 py-1.5 rounded-lg transition-colors">
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-full px-4 sm:px-6 py-6 flex flex-col sm:flex-row gap-6 pb-24 sm:pb-6">
        {/* Sidebar desktop */}
        <aside className="hidden sm:block w-full sm:w-52 flex-shrink-0">
          <nav className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sticky top-20">
            {menu.map(m => (
              <button key={m.id} onClick={() => setPage(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${page === m.id ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}>
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
            {/* Tombol keluar di sidebar */}
            <button
              onClick={() => { dispatch({ type: "LOGOUT" }); setRole("user"); setPage("dashboard"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 mt-2 transition-all">
              <span>🚪</span>
              <span>Keluar</span>
            </button>
          </nav>
        </aside>

        {/* Bottom nav mobile */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 z-30 flex justify-around">
          {menu.map(m => (
            <button key={m.id} onClick={() => setPage(m.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-xs transition-all ${page === m.id ? "text-teal-600 font-bold" : "text-slate-400"}`}>
              <span className="text-xl">{m.icon}</span>
              <span className="truncate max-w-[50px]">{m.label}</span>
            </button>
          ))}
          <button onClick={() => { dispatch({ type: "LOGOUT" }); setRole("user"); setPage("dashboard"); }}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-xs text-red-400">
            <span className="text-xl">🚪</span>
            <span>Keluar</span>
          </button>
        </div>

        <main className="flex-1 min-w-0 pb-20 sm:pb-0">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}