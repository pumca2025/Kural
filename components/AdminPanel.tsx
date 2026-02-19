import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api.ts';

interface AdminPanelProps {
    currentUserId: string;
}

type AdminView = 'dashboard' | 'users' | 'history';

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUserId }) => {
    const [view, setView] = useState<AdminView>('dashboard');
    const [dashData, setDashData] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [allHistory, setAllHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [userTotal, setUserTotal] = useState(0);
    const [histPage, setHistPage] = useState(1);
    const [histTotalPages, setHistTotalPages] = useState(1);
    const [histTotal, setHistTotal] = useState(0);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editLoading, setEditLoading] = useState(false);

    // ─── Dashboard ────────────────────────────────────────────────────────────
    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminAPI.dashboard();
            setDashData(res);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ─── Users ────────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async (p = 1) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminAPI.users({ page: p, limit: 15, search, role: roleFilter, status: statusFilter });
            setUsers(res.users);
            setUserTotalPages(res.pages);
            setUserTotal(res.total);
            setUserPage(p);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [search, roleFilter, statusFilter]);

    // ─── History ──────────────────────────────────────────────────────────────
    const fetchAllHistory = useCallback(async (p = 1) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminAPI.allHistory({ page: p, limit: 15 });
            setAllHistory(res.histories);
            setHistTotalPages(res.pages);
            setHistTotal(res.total);
            setHistPage(p);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'dashboard') fetchDashboard();
        else if (view === 'users') fetchUsers(1);
        else if (view === 'history') fetchAllHistory(1);
    }, [view]);

    const handleToggleStatus = async (id: string) => {
        setTogglingId(id);
        try {
            const res = await adminAPI.toggleStatus(id);
            setUsers(u => u.map(user => user._id === id ? { ...user, isActive: res.isActive } : user));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setTogglingId(null);
        }
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (!confirm(`Delete user "${name}" and all their data? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            await adminAPI.deleteUser(id);
            setUsers(u => u.filter(user => user._id !== id));
            setUserTotal(t => t - 1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteHistory = async (id: string) => {
        if (!confirm('Delete this history record?')) return;
        setDeletingId(id);
        try {
            await adminAPI.deleteHistory(id);
            setAllHistory(h => h.filter(r => r._id !== id));
            setHistTotal(t => t - 1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const openEdit = (user: any) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditRole(user.role);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        setEditLoading(true);
        try {
            const res = await adminAPI.updateUser(editingUser._id, { name: editName, role: editRole });
            setUsers(u => u.map(user => user._id === editingUser._id ? { ...user, name: editName, role: editRole } : user));
            setEditingUser(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    // ─── Stat Card ────────────────────────────────────────────────────────────
    const StatCard = ({ label, value, icon, color }: any) => (
        <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-black text-white">{value ?? '—'}</p>
                <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Admin nav */}
            <div className="flex items-center gap-1 px-6 pt-6 pb-4 border-b border-slate-700/50 flex-shrink-0">
                <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                    {(['dashboard', 'users', 'history'] as AdminView[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view === v ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
                        🛡 Admin Panel
                    </span>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex-shrink-0">
                    {error}
                    <button onClick={() => setError(null)} className="ml-2 text-red-300 hover:text-white">✕</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {/* ── DASHBOARD ── */}
                {view === 'dashboard' && (
                    loading ? (
                        <div className="flex items-center justify-center h-48">
                            <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    ) : dashData ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard label="Total Users" value={dashData.stats.totalUsers} color="bg-indigo-500/20" icon={<svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
                                <StatCard label="Active Users" value={dashData.stats.activeUsers} color="bg-green-500/20" icon={<svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                                <StatCard label="Total Scripts" value={dashData.stats.totalScripts} color="bg-purple-500/20" icon={<svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
                                <StatCard label="Scripts Today" value={dashData.stats.scriptsToday} color="bg-amber-500/20" icon={<svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Recent Users */}
                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                                        Recent Users
                                    </h3>
                                    <div className="space-y-3">
                                        {dashData.recentUsers?.map((u: any) => (
                                            <div key={u._id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-300 font-bold text-sm">
                                                    {u.name[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{u.name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                                                    {u.role}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Scripts */}
                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5">
                                    <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-purple-400 rounded-full" />
                                        Recent Scripts
                                    </h3>
                                    <div className="space-y-3">
                                        {dashData.recentScripts?.map((h: any) => (
                                            <div key={h._id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{h.videoName}</p>
                                                    <p className="text-xs text-slate-400">{h.user?.name} · {h.totalLines} lines</p>
                                                </div>
                                                <span className="text-xs text-slate-500">{formatDate(h.createdAt)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null
                )}

                {/* ── USERS ── */}
                {view === 'users' && (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-3">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchUsers(1)}
                                placeholder="Search name or email..."
                                className="flex-1 min-w-48 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                                <option value="">All Roles</option>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                                <option value="">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <button onClick={() => fetchUsers(1)} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
                                Search
                            </button>
                        </div>

                        <p className="text-slate-400 text-sm">{userTotal} user{userTotal !== 1 ? 's' : ''} found</p>

                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {users.map(user => (
                                    <div key={user._id} className={`bg-slate-800/50 border rounded-2xl p-4 flex items-center gap-4 transition-all ${!user.isActive ? 'border-red-500/20 opacity-60' : 'border-slate-700/50'}`}>
                                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                                            {user.name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-white text-sm">{user.name}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.role === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700 text-slate-300'}`}>
                                                    {user.role}
                                                </span>
                                                {!user.isActive && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">Inactive</span>}
                                                {user._id === currentUserId && <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">You</span>}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Joined {formatDate(user.createdAt)} · {user.scriptsGenerated} scripts</p>
                                        </div>
                                        {user._id !== currentUserId && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => openEdit(user)}
                                                    className="text-xs font-bold text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(user._id)}
                                                    disabled={togglingId === user._id}
                                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${user.isActive
                                                            ? 'text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/30'
                                                            : 'text-green-400 hover:text-white bg-green-500/10 hover:bg-green-500/30'
                                                        }`}
                                                >
                                                    {togglingId === user._id ? '...' : user.isActive ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user._id, user.name)}
                                                    disabled={deletingId === user._id}
                                                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {userTotalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button onClick={() => fetchUsers(userPage - 1)} disabled={userPage <= 1} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all">← Prev</button>
                                <span className="text-slate-400 text-sm">Page {userPage} of {userTotalPages}</span>
                                <button onClick={() => fetchUsers(userPage + 1)} disabled={userPage >= userTotalPages} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all">Next →</button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── HISTORY ── */}
                {view === 'history' && (
                    <div className="space-y-4">
                        <p className="text-slate-400 text-sm">{histTotal} total script{histTotal !== 1 ? 's' : ''} across all users</p>

                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <svg className="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {allHistory.map(h => (
                                    <div key={h._id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-white text-sm truncate">{h.videoName}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-xs text-slate-400">by {h.user?.name || 'Unknown'}</span>
                                                <span className="text-xs text-slate-500">·</span>
                                                <span className="text-xs text-slate-400">{h.totalLines} lines</span>
                                                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{h.format}</span>
                                                <span className="text-xs text-slate-500">{formatDate(h.createdAt)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteHistory(h._id)}
                                            disabled={deletingId === h._id}
                                            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50 flex-shrink-0"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {histTotalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <button onClick={() => fetchAllHistory(histPage - 1)} disabled={histPage <= 1} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all">← Prev</button>
                                <span className="text-slate-400 text-sm">Page {histPage} of {histTotalPages}</span>
                                <button onClick={() => fetchAllHistory(histPage + 1)} disabled={histPage >= histTotalPages} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all">Next →</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-6">Edit User</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Role</label>
                                <select
                                    value={editRole}
                                    onChange={e => setEditRole(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl font-bold transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={editLoading}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-3 rounded-xl font-bold transition-all"
                            >
                                {editLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
