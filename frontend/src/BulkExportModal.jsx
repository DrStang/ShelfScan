import React, { useState, useMemo } from 'react';
import { X, Download, FileText, Table, CheckSquare, Square, Loader2, Calendar, Book } from 'lucide-react';


function BulkExportModal({ isOpen, onClose, scanHistory }) {
    const [selectedScans, setSelectedScans] = useState(new Set());
    const [exporting, setExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);

    // Reset selection when modal opens
    React.useEffect(() => {
        if (isOpen && scanHistory && scanHistory.length > 0) {
            // Select all by default
            setSelectedScans(new Set(scanHistory.map(scan => scan.id)));
        }
    }, [isOpen, scanHistory]);

    // Get selected scans data - must be before early return
    const selectedScansData = useMemo(() => {
        if (!scanHistory) return [];
        return scanHistory.filter(scan => selectedScans.has(scan.id));
    }, [scanHistory, selectedScans]);

    // Calculate totals for selected scans - must be before early return
    const totals = useMemo(() => {
        const allBooks = selectedScansData.flatMap(scan => scan.books || []);
        const uniqueBooks = new Map();
        allBooks.forEach(book => {
            const key = `${book.title}-${book.author}`.toLowerCase();
            if (!uniqueBooks.has(key)) {
                uniqueBooks.set(key, book);
            }
        });
        return {
            scans: selectedScansData.length,
            totalBooks: allBooks.length,
            uniqueBooks: uniqueBooks.size,
        };
    }, [selectedScansData]);

    // Early return AFTER all hooks
    if (!isOpen || !scanHistory || scanHistory.length === 0) return null;

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatDateShort = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (date) => {
        return new Date(date).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const toggleScan = async (scanId) => {

        setSelectedScans(prev => {
            const newSet = new Set(prev);
            if (newSet.has(scanId)) {
                newSet.delete(scanId);
            } else {
                newSet.add(scanId);
            }
            return newSet;
        });
    };

    const selectAll = async () => {
        setSelectedScans(new Set(scanHistory.map(scan => scan.id)));
    };

    const selectNone = async () => {
        setSelectedScans(new Set());
    };

    // Generate CSV content for multiple scans
    const generateCSV = () => {
        const headers = ['Scan Date', 'Scan Time', 'Title', 'Author', 'Rating', 'Ratings Count', 'ISBN', 'Publish Year', 'On Reading List', 'Goodreads URL', 'Amazon URL'];

        const rows = [];
        selectedScansData.forEach(scan => {
            const scanDate = formatDateShort(scan.created_at);
            const scanTime = formatTime(scan.created_at);

            (scan.books || []).forEach(book => {
                rows.push([
                    `"${scanDate}"`,
                    `"${scanTime}"`,
                    `"${(book.title || '').replace(/"/g, '""')}"`,
                    `"${(book.author || '').replace(/"/g, '""')}"`,
                    book.rating || '',
                    book.ratingsCount || '',
                    book.isbn || '',
                    book.publishYear || '',
                    book.inReadingList ? 'Yes' : 'No',
                    book.goodreadsUrl || '',
                    book.amazonUrl || ''
                ]);
            });
        });

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    };

    // Generate plain text content for multiple scans
    const generateText = () => {
        let content = `Shelf Scan - Complete Export\n`;
        content += `${'='.repeat(60)}\n\n`;
        content += `Export Date: ${formatDate(new Date())}\n`;
        content += `Total Scans: ${totals.scans}\n`;
        content += `Total Books: ${totals.totalBooks}\n`;
        content += `Unique Books: ${totals.uniqueBooks}\n\n`;
        content += `${'='.repeat(60)}\n\n`;

        selectedScansData.forEach((scan, scanIndex) => {
            const books = scan.books || [];
            content += `\n${'─'.repeat(60)}\n`;
            content += `SCAN ${scanIndex + 1}: ${formatDate(scan.created_at)} at ${formatTime(scan.created_at)}\n`;
            content += `Books Found: ${books.length}\n`;
            content += `${'─'.repeat(60)}\n\n`;

            books.forEach((book, index) => {
                content += `  ${index + 1}. ${book.title}\n`;
                content += `     Author: ${book.author || 'Unknown'}\n`;
                content += `     Rating: ${book.rating ? book.rating.toFixed(1) : 'N/A'}`;
                if (book.ratingsCount) {
                    content += ` (${book.ratingsCount.toLocaleString()} reviews)`;
                }
                content += '\n';
                if (book.isbn) content += `     ISBN: ${book.isbn}\n`;
                if (book.inReadingList) content += `     📚 On your reading list\n`;
                content += '\n';
            });
        });

        content += `\n${'='.repeat(60)}\n`;
        content += `Exported from Shelf Scan - https://shelfscan.xyz\n`;

        return content;
    };

    // Generate HTML for multiple scans
    const generateHTML = () => {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Shelf Scan - Complete Export</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
            color: #333;
            background: #f9fafb;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 30px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .header h1 { color: #4f46e5; font-size: 32px; margin-bottom: 10px; }
        .header .subtitle { color: #666; font-size: 14px; }
        .summary {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin: 20px 0;
            padding: 20px;
            background: #eef2ff;
            border-radius: 12px;
        }
        .summary-stat { text-align: center; }
        .summary-stat .value { font-size: 28px; font-weight: bold; color: #4f46e5; }
        .summary-stat .label { font-size: 12px; color: #666; margin-top: 4px; }
        .scan-section {
            background: white;
            border-radius: 16px;
            margin: 20px 0;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .scan-header {
            background: #4f46e5;
            color: white;
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .scan-header h2 { font-size: 18px; font-weight: 600; }
        .scan-header .meta { font-size: 14px; opacity: 0.9; }
        .scan-stats {
            display: flex;
            gap: 20px;
            padding: 12px 24px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
            color: #666;
        }
        .book {
            display: flex;
            gap: 16px;
            padding: 16px 24px;
            border-bottom: 1px solid #f1f5f9;
        }
        .book:last-child { border-bottom: none; }
        .book-rank {
            width: 36px;
            height: 36px;
            background: #4f46e5;
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
        }
        .book-rank.gold { background: #f59e0b; }
        .book-rank.silver { background: #9ca3af; }
        .book-rank.bronze { background: #f97316; }
        .book-info { flex: 1; }
        .book-title { font-size: 16px; font-weight: 600; color: #111; }
        .book-author { color: #666; font-size: 14px; margin-top: 2px; }
        .book-meta { display: flex; gap: 12px; margin-top: 8px; align-items: center; flex-wrap: wrap; }
        .book-rating {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            background: #fef3c7;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 500;
        }
        .book-rating .star { color: #f59e0b; }
        .reading-list-badge {
            padding: 4px 10px;
            background: #d1fae5;
            color: #065f46;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .book-links { font-size: 12px; }
        .book-links a { color: #4f46e5; margin-right: 12px; text-decoration: none; }
        .book-links a:hover { text-decoration: underline; }
        .footer {
            margin-top: 40px;
            padding: 20px;
            text-align: center;
            color: #999;
            font-size: 12px;
        }
        @media print {
            body { padding: 20px; background: white; }
            .scan-section { break-inside: avoid; box-shadow: none; border: 1px solid #e5e7eb; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 Shelf Scan Export</h1>
        <div class="subtitle">Exported on ${formatDate(new Date())}</div>
        <div class="summary">
            <div class="summary-stat">
                <div class="value">${totals.scans}</div>
                <div class="label">Scans</div>
            </div>
            <div class="summary-stat">
                <div class="value">${totals.totalBooks}</div>
                <div class="label">Total Books</div>
            </div>
            <div class="summary-stat">
                <div class="value">${totals.uniqueBooks}</div>
                <div class="label">Unique Titles</div>
            </div>
        </div>
    </div>
    
    ${selectedScansData.map((scan, scanIndex) => {
            const books = scan.books || [];
            const avgRating = books.filter(b => b.rating > 0).reduce((sum, b, _, arr) =>
                sum + b.rating / arr.length, 0);

            return `
        <div class="scan-section">
            <div class="scan-header">
                <h2>Scan ${scanIndex + 1}</h2>
                <div class="meta">${formatDate(scan.created_at)} at ${formatTime(scan.created_at)}</div>
            </div>
            <div class="scan-stats">
                <span><strong>${books.length}</strong> books found</span>
                <span>Avg rating: <strong>${avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}</strong></span>
                <span>On reading list: <strong>${books.filter(b => b.inReadingList).length}</strong></span>
            </div>
            ${books.map((book, index) => `
                <div class="book">
                    <div class="book-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}">#${index + 1}</div>
                    <div class="book-info">
                        <div class="book-title">${book.title}</div>
                        <div class="book-author">by ${book.author || 'Unknown Author'}</div>
                        <div class="book-meta">
                            <span class="book-rating">
                                <span class="star">★</span>
                                ${book.rating ? book.rating.toFixed(1) : 'N/A'}
                                ${book.ratingsCount ? `(${book.ratingsCount.toLocaleString()})` : ''}
                            </span>
                            ${book.inReadingList ? '<span class="reading-list-badge">📚 On Your List</span>' : ''}
                        </div>
                        <div class="book-links">
                            ${book.goodreadsUrl ? `<a href="${book.goodreadsUrl}" target="_blank">Goodreads</a>` : ''}
                            ${book.amazonUrl ? `<a href="${book.amazonUrl}" target="_blank">Amazon</a>` : ''}
                            ${book.isbn ? `<span style="color: #999;">ISBN: ${book.isbn}</span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        `;
        }).join('')}
    
    <div class="footer">
        Exported from Shelf Scan • https://shelfscan.xyz
    </div>
</body>
</html>`;
    };

    const handleExport = async (format) => {
        if (selectedScans.size === 0) {
            alert('Please select at least one scan to export.');
            return;
        }

        
        setExporting(true);
        setExportFormat(format);

        try {
            let content, mimeType, filename;
            const dateStr = new Date().toISOString().split('T')[0];

            switch (format) {
                case 'csv':
                    content = generateCSV();
                    mimeType = 'text/csv';
                    filename = `shelf-scan-history-${dateStr}.csv`;
                    break;
                case 'txt':
                    content = generateText();
                    mimeType = 'text/plain';
                    filename = `shelf-scan-history-${dateStr}.txt`;
                    break;
                case 'html':
                    content = generateHTML();
                    mimeType = 'text/html';
                    filename = `shelf-scan-history-${dateStr}.html`;
                    break;
                default:
                    throw new Error('Unknown format');
            }

        
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            

            onClose();
        } catch (err) {
            console.error('Export error:', err);

            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
            setExportFormat(null);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 my-8 overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]"
                style={{ marginTop: 'max(2rem, calc(env(safe-area-inset-top) + 1rem))' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                            Export History
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Select scans to include
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Selection Summary */}
                <div className="bg-indigo-50 dark:bg-indigo-900/30 px-5 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{totals.scans}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Scans</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.totalBooks}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Books</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={selectAll}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
                        >
                            All
                        </button>
                        <button
                            onClick={selectNone}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            None
                        </button>
                    </div>
                </div>

                {/* Scan List */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                    <div className="space-y-2">
                        {scanHistory.map((scan) => {
                            const isSelected = selectedScans.has(scan.id);
                            const books = scan.books || [];

                            return (
                                <button
                                    key={scan.id}
                                    onClick={() => toggleScan(scan.id)}
                                    className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all ${
                                        isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-300 dark:border-indigo-600'
                                            : 'bg-gray-50 dark:bg-gray-700 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <div className={`flex-shrink-0 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                                        {isSelected ? (
                                            <CheckSquare className="w-6 h-6" />
                                        ) : (
                                            <Square className="w-6 h-6" />
                                        )}
                                    </div>

                                    {/* Scan Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                {formatDateShort(scan.created_at)}
                                            </span>
                                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                                                {formatTime(scan.created_at)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Book className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {books.length} {books.length === 1 ? 'book' : 'books'}
                                            </span>
                                            {books.length > 0 && (
                                                <span className="text-xs text-gray-400 truncate">
                                                    • {books[0].title}
                                                    {books.length > 1 && `, +${books.length - 1} more`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Export Buttons */}
                <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 text-center">
                        Choose export format
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleExport('csv')}
                            disabled={exporting || selectedScans.size === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {exporting && exportFormat === 'csv' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Table className="w-5 h-5" />
                            )}
                            CSV
                        </button>
                        <button
                            onClick={() => handleExport('html')}
                            disabled={exporting || selectedScans.size === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {exporting && exportFormat === 'html' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <FileText className="w-5 h-5" />
                            )}
                            HTML
                        </button>
                        <button
                            onClick={() => handleExport('txt')}
                            disabled={exporting || selectedScans.size === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            {exporting && exportFormat === 'txt' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                            TXT
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BulkExportModal;
