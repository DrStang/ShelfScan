import React, { useState } from 'react';
import { X, Download, Star, BookOpen, FileText, Table, ChevronRight, Loader2 } from 'lucide-react';


function ScanDetailModal({ isOpen, onClose, scan, onViewBook }) {
    const [exporting, setExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState(null);

    if (!isOpen || !scan) return null;

    const books = scan.books || [];
    const scanDate = new Date(scan.created_at);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Generate CSV content
    const generateCSV = () => {
        const headers = ['Title', 'Author', 'Rating', 'Ratings Count', 'ISBN', 'Publish Year', 'On Reading List', 'Goodreads URL', 'Amazon URL'];
        const rows = books.map(book => [
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

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    };

    // Generate plain text content
    const generateText = () => {
        let content = `Shelf Scan Export\n`;
        content += `${'='.repeat(50)}\n\n`;
        content += `Scan Date: ${formatDate(scanDate)} at ${formatTime(scanDate)}\n`;
        content += `Total Books: ${books.length}\n\n`;
        content += `${'='.repeat(50)}\n\n`;

        books.forEach((book, index) => {
            content += `${index + 1}. ${book.title}\n`;
            content += `   Author: ${book.author || 'Unknown'}\n`;
            content += `   Rating: ${book.rating ? book.rating.toFixed(1) : 'N/A'}`;
            if (book.ratingsCount) {
                content += ` (${book.ratingsCount.toLocaleString()} reviews)`;
            }
            content += '\n';
            if (book.isbn) content += `   ISBN: ${book.isbn}\n`;
            if (book.inReadingList) content += `   📚 On your reading list\n`;
            content += `   Goodreads: ${book.goodreadsUrl || 'N/A'}\n`;
            content += '\n';
        });

        content += `\n${'='.repeat(50)}\n`;
        content += `Exported from Shelf Scan - https://shelfscan.xyz\n`;

        return content;
    };

    // Generate HTML for PDF-like export
    const generateHTML = () => {
        const avgRating = books.filter(b => b.rating > 0).reduce((sum, b, _, arr) =>
            sum + b.rating / arr.length, 0);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Shelf Scan Export - ${formatDate(scanDate)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #4f46e5;
        }
        .header h1 { color: #4f46e5; font-size: 28px; margin-bottom: 10px; }
        .header .date { color: #666; font-size: 14px; }
        .stats {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin: 20px 0;
            padding: 20px;
            background: #f3f4f6;
            border-radius: 8px;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #4f46e5; }
        .stat-label { font-size: 12px; color: #666; }
        .book {
            display: flex;
            gap: 20px;
            padding: 20px;
            margin: 15px 0;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
        }
        .book-rank {
            width: 40px;
            height: 40px;
            background: #4f46e5;
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            flex-shrink: 0;
        }
        .book-info { flex: 1; }
        .book-title { font-size: 18px; font-weight: bold; color: #111; }
        .book-author { color: #666; margin-top: 4px; }
        .book-rating {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 8px;
            padding: 4px 12px;
            background: #fef3c7;
            border-radius: 20px;
            font-size: 14px;
        }
        .book-rating .star { color: #f59e0b; }
        .reading-list-badge {
            display: inline-block;
            margin-top: 8px;
            margin-left: 8px;
            padding: 4px 12px;
            background: #d1fae5;
            color: #065f46;
            border-radius: 20px;
            font-size: 12px;
        }
        .book-links { margin-top: 10px; font-size: 12px; }
        .book-links a { color: #4f46e5; margin-right: 15px; }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #999;
            font-size: 12px;
        }
        @media print {
            body { padding: 20px; }
            .book { break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 Shelf Scan Export</h1>
        <div class="date">${formatDate(scanDate)} at ${formatTime(scanDate)}</div>
    </div>
    
    <div class="stats">
        <div class="stat">
            <div class="stat-value">${books.length}</div>
            <div class="stat-label">Books Found</div>
        </div>
        <div class="stat">
            <div class="stat-value">${avgRating > 0 ? avgRating.toFixed(1) : 'N/A'}</div>
            <div class="stat-label">Avg Rating</div>
        </div>
        <div class="stat">
            <div class="stat-value">${books.filter(b => b.inReadingList).length}</div>
            <div class="stat-label">On Reading List</div>
        </div>
    </div>
    
    ${books.map((book, index) => `
        <div class="book">
            <div class="book-rank">#${index + 1}</div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">by ${book.author || 'Unknown Author'}</div>
                <div>
                    <span class="book-rating">
                        <span class="star">★</span>
                        ${book.rating ? book.rating.toFixed(1) : 'N/A'}
                        ${book.ratingsCount ? `(${book.ratingsCount.toLocaleString()} reviews)` : ''}
                    </span>
                    ${book.inReadingList ? '<span class="reading-list-badge">📚 On Your List</span>' : ''}
                </div>
                <div class="book-links">
                    ${book.goodreadsUrl ? `<a href="${book.goodreadsUrl}" target="_blank">Goodreads</a>` : ''}
                    ${book.amazonUrl ? `<a href="${book.amazonUrl}" target="_blank">Amazon</a>` : ''}
                    ${book.isbn ? `<span>ISBN: ${book.isbn}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('')}
    
    <div class="footer">
        Exported from Shelf Scan • https://shelfscan.xyz
    </div>
</body>
</html>`;
    };

    const handleExport = async (format) => {

        setExporting(true);
        setExportFormat(format);

        try {
            let content, mimeType, filename;

            switch (format) {
                case 'csv':
                    content = generateCSV();
                    mimeType = 'text/csv';
                    filename = `shelf-scan-${scanDate.toISOString().split('T')[0]}.csv`;
                    break;
                case 'txt':
                    content = generateText();
                    mimeType = 'text/plain';
                    filename = `shelf-scan-${scanDate.toISOString().split('T')[0]}.txt`;
                    break;
                case 'html':
                    content = generateHTML();
                    mimeType = 'text/html';
                    filename = `shelf-scan-${scanDate.toISOString().split('T')[0]}.html`;
                    break;
                default:
                    throw new Error('Unknown format');
            }
                // For web, trigger download
                const blob = new Blob([content], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            

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
            className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 relative transform transition-all flex flex-col max-h-[90dvh]"                onClick={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
                >
                {/* Header */}
                    <div className="flex-shrink-0 sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Scan Details
                        </h2>
                        <p className="text-sm text-gray-500">
                            {formatDate(scanDate)} • {formatTime(scanDate)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {/* Stats Bar */}
                    <div className="bg-indigo-50 px-6 py-4 flex justify-around">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{books.length}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Books Found</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {books.filter(b => b.rating > 0).length > 0
                                    ? (books.filter(b => b.rating > 0).reduce((sum, b) => sum + b.rating, 0) / books.filter(b => b.rating > 0).length).toFixed(1)
                                    : 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Average Rating</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {books.filter(b => b.inReadingList).length}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">On List</div>
                        </div>
                    </div>
    
                    {/* Export Buttons */}
                    <div className="px-6 py-4 border-b border-gray-200 ">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">Export As:</span>
                           
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => handleExport('csv')}
                                disabled={exporting}
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
                                disabled={exporting}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                            >
                                {exporting && exportFormat === 'html' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <FileText className="w-5 h-5" />
                                )}
                                HTML/PDF
                            </button>
                            <button
                                onClick={() => handleExport('txt')}
                                disabled={exporting}
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                            Open HTML in browser → Print → Save as PDF
                        </p>
                    </div>
    
                    {/* Book List */}
                    <div className="px-6 py-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">
                            All Books ({books.length})
                        </h3>
                        <div className="space-y-3">
                            {books.map((book, index) => (
                                <button
                                    key={index}
                                    onClick={() => onViewBook && onViewBook(book)}
                                    className={`w-full text-left flex items-center gap-4 p-4 rounded-xl transition-all active:scale-98 ${
                                        book.inReadingList
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700'
                                            : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {/* Rank */}
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 ${
                                        index === 0 ? 'bg-amber-500' :
                                            index === 1 ? 'bg-gray-400' :
                                                index === 2 ? 'bg-orange-400' : 'bg-indigo-500'
                                    }`}>
                                        #{index + 1}
                                    </div>
    
                                    {/* Book Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                                    {book.title}
                                                </h4>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                    {book.author || 'Unknown Author'}
                                                </p>
                                            </div>
                                            {book.inReadingList && (
                                                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {book.rating ? book.rating.toFixed(1) : 'N/A'}
                                                </span>
                                            </div>
                                            {book.ratingsCount > 0 && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    ({book.ratingsCount.toLocaleString()})
                                                </span>
                                            )}
                                        </div>
                                    </div>
    
                                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>  

                {/* Footer */}
                <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">                    
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ScanDetailModal;
