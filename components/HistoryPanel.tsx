import React, { useState, useEffect, useCallback } from 'react';
import { historyAPI } from '../api.ts';
import { HistoryRecord, ScriptFormat } from '../types.ts';

interface HistoryPanelProps {
    onLoadScript: (record: HistoryRecord) => void;
}

const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onLoadScript }) => {
    const [histories, setHistories] = useState<HistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [clearingAll, setClearingAll] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [fullRecord, setFullRecord] = useState<HistoryRecord | null>(null);
    const [loadingFull, setLoadingFull] = useState(false);

    const fetchHistory = useCallback(async (p = 1) => {
        setLoading(true);
        setError(null);
        try {
            const res = await historyAPI.list(p, 10);
            setHistories(res.histories);
            setTotalPages(res.pages);
            setTotal(res.total);
            setPage(p);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHistory(1); }, [fetchHistory]);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this history record?')) return;
        setDeletingId(id);
        try {
            await historyAPI.delete(id);
            setHistories(h => h.filter(r => r._id !== id));
            setTotal(t => t - 1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Clear ALL history? This cannot be undone.')) return;
        setClearingAll(true);
        try {
            await historyAPI.clearAll();
            setHistories([]);
            setTotal(0);
            setTotalPages(1);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setClearingAll(false);
        }
    };

    const handleExpand = async (record: HistoryRecord) => {
        if (expandedId === record._id) {
            setExpandedId(null);
            setFullRecord(null);
            return;
        }
        setExpandedId(record._id);
        setLoadingFull(true);
        try {
            const res = await historyAPI.get(record._id);
            setFullRecord(res.history);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingFull(false);
        }
    };

    const handleLoadToEditor = (record: HistoryRecord) => {
        if (fullRecord && fullRecord._id === record._id) {
            onLoadScript(fullRecord);
        } else {
            onLoadScript(record);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-slate-400 text-sm">Loading history...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-white">Script History</h2>
                    <p className="text-slate-400 text-sm mt-0.5">{total} script{total !== 1 ? 's' : ''} generated</p>
                </div>
                {histories.length > 0 && (
                    <button
                        onClick={handleClearAll}
                        disabled={clearingAll}
                        className="text-xs font-bold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-400/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    >
                        {clearingAll ? 'Clearing...' : 'Clear All'}
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex-shrink-0">
                    {error}
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                {histories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm italic">No scripts generated yet.</p>
                        <p className="text-xs mt-1">Generate a script to see it here.</p>
                    </div>
                ) : (
                    histories.map(record => (
                        <div key={record._id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden transition-all hover:border-indigo-500/30">
                            {/* Record header */}
                            <div className="p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-white text-sm truncate">{record.videoName}</p>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs text-slate-400">{formatDate(record.createdAt)}</span>
                                        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium">{record.totalLines} lines</span>
                                        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{record.format}</span>
                                        {record.videoSize > 0 && <span className="text-xs text-slate-500">{formatBytes(record.videoSize)}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleLoadToEditor(record)}
                                        title="Load to editor"
                                        className="text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg transition-all"
                                    >
                                        Load
                                    </button>
                                    <button
                                        onClick={() => handleExpand(record)}
                                        title="Preview script"
                                        className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700"
                                    >
                                        <svg className={`w-4 h-4 transition-transform ${expandedId === record._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(record._id)}
                                        disabled={deletingId === record._id}
                                        title="Delete"
                                        className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Expanded preview */}
                            {expandedId === record._id && (
                                <div className="border-t border-slate-700/50 bg-slate-900/50 p-4 max-h-64 overflow-y-auto custom-scrollbar">
                                    {loadingFull ? (
                                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Loading script...
                                        </div>
                                    ) : fullRecord?.script && fullRecord.script.length > 0 ? (
                                        <div className="space-y-2">
                                            {fullRecord.script.slice(0, 5).map((line, i) => (
                                                <div key={i} className="text-xs border-l-2 border-indigo-500/40 pl-3">
                                                    <span className="text-slate-500">[{line.startTime} – {line.endTime}] </span>
                                                    <span className="text-indigo-300 font-medium">{line.person}: </span>
                                                    <span className="text-slate-300">{line.versions?.spoken || line.dialogue}</span>
                                                </div>
                                            ))}
                                            {fullRecord.script.length > 5 && (
                                                <p className="text-xs text-slate-500 pl-3">...and {fullRecord.script.length - 5} more lines</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-xs italic">No script data available.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 flex-shrink-0 pt-2">
                    <button
                        onClick={() => fetchHistory(page - 1)}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        ← Prev
                    </button>
                    <span className="text-slate-400 text-sm">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => fetchHistory(page + 1)}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
};

export default HistoryPanel;
