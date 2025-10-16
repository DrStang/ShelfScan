import React from 'react';
import { X, Globe, Star, FileText } from 'lucide-react';

// 1. DEFINE THE CUSTOM SVG COMPONENT
// This component renders the Amazon logo (you can copy your exact SVG code here)
const AmazonIcon = ({ className = "w-6 h-6" }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        version="1.1"
        width="256"
        height="256"
        viewBox="0 0 256 256"
        xmlSpace="preserve"
    >
        <g
            style={{
                stroke: "none",
                strokeWidth: 0,
                strokeDasharray: "none",
                strokeLinecap: "butt",
                strokeLinejoin: "miter",
                strokeMiterlimit: 10,
                fill: "none",
                fillRule: "nonzero",
                opacity: 1,
            }}
            transform="translate(76.40155642023348 76.40155642023345) scale(1.14 1.14)"
        >
            <path
                d="M 55.835 52.65 c -5.229 3.859 -12.81 5.911 -19.338 5.911 c -9.149 0 -17.388 -3.382 -23.623 -9.012 c -0.489 -0.442 -0.053 -1.046 0.535 -0.704 c 6.726 3.914 15.046 6.272 23.637 6.272 c 5.796 0 12.167 -1.203 18.029 -3.69 C 55.959 51.053 56.701 52.01 55.835 52.65 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 58.011 50.164 c -0.669 -0.856 -4.421 -0.406 -6.107 -0.204 c -0.511 0.062 -0.59 -0.385 -0.13 -0.708 c 2.993 -2.103 7.898 -1.496 8.468 -0.791 c 0.574 0.709 -0.152 5.627 -2.956 7.974 c -0.432 0.361 -0.843 0.168 -0.651 -0.308 C 57.268 54.551 58.681 51.022 58.011 50.164 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 52.023 34.401 v -2.043 c 0.002 -0.311 0.236 -0.518 0.518 -0.517 l 9.156 -0.001 c 0.293 0 0.528 0.212 0.528 0.515 v 1.752 c -0.003 0.294 -0.251 0.677 -0.689 1.286 l -4.743 6.772 c 1.76 -0.041 3.623 0.223 5.223 1.121 c 0.361 0.203 0.458 0.503 0.486 0.798 v 2.18 c 0 0.301 -0.329 0.648 -0.675 0.467 c -2.818 -1.477 -6.557 -1.638 -9.674 0.018 c -0.318 0.17 -0.651 -0.173 -0.651 -0.474 v -2.072 c 0 -0.331 0.006 -0.899 0.341 -1.404 l 5.494 -7.883 l -4.784 -0.001 C 52.26 34.915 52.025 34.707 52.023 34.401 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34, 34, 34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 18.624 47.16 h -2.786 c -0.265 -0.017 -0.477 -0.216 -0.499 -0.471 l 0.002 -14.297 c 0 -0.285 0.24 -0.514 0.538 -0.514 l 2.594 -0.001 c 0.271 0.014 0.489 0.219 0.506 0.48 v 1.866 h 0.053 c 0.676 -1.805 1.95 -2.648 3.666 -2.648 c 1.742 0 2.835 0.843 3.615 2.648 c 0.676 -1.805 2.21 -2.648 3.848 -2.648 c 1.17 0 2.444 0.482 3.224 1.565 c 0.884 1.204 0.703 2.948 0.703 4.483 l -0.003 9.022 c 0 0.285 -0.24 0.514 -0.537 0.514 h -2.782 c -0.281 -0.018 -0.5 -0.239 -0.5 -0.513 l -0.001 -7.579 c 0 -0.601 0.052 -2.105 -0.079 -2.677 c -0.208 -0.964 -0.831 -1.235 -1.637 -1.235 c -0.677 0 -1.379 0.451 -1.665 1.173 c -0.286 0.723 -0.26 1.926 -0.26 2.738 v 7.579 c 0 0.285 -0.24 0.514 -0.537 0.514 h -2.782 c -0.28 -0.018 -0.5 -0.239 -0.5 -0.513 l -0.003 -7.579 c 0 -1.594 0.261 -3.94 -1.715 -3.94 c -2.002 0 -1.924 2.285 -1.924 3.94 l -0.002 7.579 C 19.161 46.931 18.921 47.16 18.624 47.16 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 70.133 34.495 c -2.054 0 -2.184 2.797 -2.184 4.542 c 0 1.745 -0.026 5.476 2.159 5.476 c 2.158 0 2.262 -3.008 2.262 -4.843 c 0 -1.203 -0.053 -2.648 -0.417 -3.791 C 71.641 34.886 71.017 34.495 70.133 34.495 z M 70.108 31.576 c 4.134 0 6.37 3.551 6.37 8.064 c 0 4.361 -2.47 7.821 -6.37 7.821 c -4.057 0 -6.267 -3.55 -6.267 -7.972 C 63.841 35.036 66.076 31.576 70.108 31.576 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 81.839 47.16 h -2.776 c -0.278 -0.018 -0.499 -0.239 -0.499 -0.513 l -0.005 -14.302 c 0.024 -0.262 0.255 -0.467 0.535 -0.467 l 2.584 -0.001 c 0.244 0.013 0.444 0.178 0.495 0.4 v 2.187 h 0.052 c 0.781 -1.956 1.872 -2.888 3.796 -2.888 c 1.248 0 2.471 0.451 3.251 1.685 C 90 34.405 90 36.329 90 37.714 v 8.997 c -0.03 0.253 -0.258 0.45 -0.534 0.45 h -2.792 c -0.258 -0.016 -0.466 -0.206 -0.496 -0.45 v -7.762 c 0 -1.565 0.183 -3.852 -1.742 -3.852 c -0.676 0 -1.3 0.451 -1.612 1.143 c -0.39 0.873 -0.442 1.745 -0.442 2.709 v 7.698 C 82.377 46.931 82.136 47.16 81.839 47.16 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 13.168 44.54 c -0.509 -0.703 -1.052 -1.275 -1.052 -2.581 V 37.62 c 0 -1.84 0.131 -3.528 -1.224 -4.795 c -1.044 -1.001 -2.758 -1.369 -4.1 -1.386 H 6.586 c -2.622 0.027 -5.507 1.034 -6.119 4.264 c -0.066 0.348 0.188 0.531 0.416 0.583 l 2.7 0.293 c 0.253 -0.013 0.436 -0.262 0.484 -0.513 c 0.231 -1.128 1.176 -1.672 2.239 -1.672 c 0.572 0 1.224 0.211 1.563 0.724 c 0.391 0.573 0.338 1.356 0.338 2.02 v 0.362 C 6.593 37.68 4.482 37.8 2.971 38.464 C 1.224 39.217 0 40.755 0 43.016 c 0 2.894 1.824 4.342 4.169 4.342 c 1.981 0 3.063 -0.467 4.593 -2.025 c 0.505 0.733 0.671 1.088 1.597 1.857 c 0.208 0.111 0.474 0.1 0.658 -0.065 l 0.006 0.006 c 0.556 -0.495 1.567 -1.373 2.136 -1.85 C 13.386 45.095 13.345 44.794 13.168 44.54 z M 7.687 43.288 c -0.442 0.783 -1.146 1.266 -1.929 1.266 c -1.068 0 -1.693 -0.814 -1.693 -2.02 c 0 -2.373 2.128 -2.804 4.143 -2.804 v 0.604 C 8.208 41.419 8.234 42.323 7.687 43.288 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
            <path
                d="M 49.684 44.54 c -0.509 -0.703 -1.052 -1.275 -1.052 -2.581 V 37.62 c 0 -1.84 0.131 -3.528 -1.224 -4.795 c -1.044 -1.001 -2.758 -1.369 -4.1 -1.386 h -0.207 c -2.621 0.027 -5.506 1.034 -6.119 4.264 c -0.065 0.348 0.188 0.531 0.416 0.583 l 2.701 0.293 c 0.252 -0.013 0.434 -0.262 0.483 -0.513 c 0.233 -1.128 1.176 -1.672 2.239 -1.672 c 0.573 0 1.224 0.211 1.563 0.724 c 0.391 0.573 0.339 1.356 0.339 2.02 v 0.362 c -1.616 0.181 -3.727 0.301 -5.238 0.965 c -1.745 0.754 -2.971 2.291 -2.971 4.552 c 0 2.894 1.824 4.342 4.169 4.342 c 1.981 0 3.064 -0.467 4.593 -2.025 c 0.506 0.733 0.672 1.088 1.597 1.857 c 0.208 0.111 0.474 0.1 0.657 -0.065 l 0.008 0.006 c 0.556 -0.495 1.566 -1.373 2.136 -1.85 C 49.902 45.095 49.863 44.794 49.684 44.54 z M 44.203 43.288 c -0.443 0.783 -1.147 1.266 -1.929 1.266 c -1.068 0 -1.693 -0.814 -1.693 -2.02 c 0 -2.373 2.128 -2.804 4.143 -2.804 v 0.604 C 44.724 41.419 44.75 42.323 44.203 43.288 z"
                style={{
                    stroke: "none",
                    strokeWidth: 1,
                    strokeDasharray: "none",
                    strokeLinecap: "butt",
                    strokeLinejoin: "miter",
                    strokeMiterlimit: 10,
                    fill: "rgb(34,34,34)",
                    fillRule: "nonzero",
                    opacity: 1,
                }}
                transform=" matrix(1 0 0 1 0 0) "
                strokeLinecap="round"
            />
        </g>
    </svg>
);


const LinkModal = ({ show, onClose, book }) => {
    if (!show || !book) {
        return null;
    }

    // 2. UPDATE LINKS ARRAY to include Amazon
    const links = [
        {
            name: 'Amazon Product Page',
            icon: AmazonIcon, // Use the custom component here
            url: book.amazonUrl, // Assume your book object has amazonUrl
            color: 'text-orange-600 hover:text-orange-800', // Amazon-like color
        },
        {
            name: 'Goodreads Page',
            icon: Star,
            url: book.goodreadsUrl,
            color: 'text-amber-700 hover:text-amber-900',
        },
        {
            name: 'Google Books Details',
            icon: Globe,
            url: book.infoLink,
            color: 'text-blue-600 hover:text-blue-800',
        },
    ];

    return (
        <div
            className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Close modal"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header: Book Info */}
                <h2 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-2">
                    External Links for:
                </h2>
                <p className="text-xl font-semibold text-indigo-700">
                    {book.title}
                </p>
                <p className="text-md text-gray-500 mb-6">
                    by {book.author || 'Unknown Author'}
                </p>

                {/* Link List */}
                <div className="space-y-4">
                    {links.map((link, index) => (
                        // Only render the link component if the URL is present and valid
                        link.url ? (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-4 p-4 border border-gray-200 rounded-lg transition-all group ${link.color} hover:bg-gray-100`}
                            >
                                {/* 3. Use the dynamic Icon component and apply Tailwind classes */}
                                <link.icon className={`w-6 h-6 flex-shrink-0 ${link.color}`} />
                                <span className="text-lg font-medium">
                  {link.name}
                </span>
                            </a>
                        ) : (
                            // Show a disabled version if the URL is missing
                            <div
                                key={index}
                                className="flex items-center gap-4 p-4 border border-gray-100 rounded-lg text-gray-400 cursor-not-allowed"
                            >
                                <link.icon className="w-6 h-6 flex-shrink-0" />
                                <span className="text-lg font-medium">
                  {link.name} (Not Available)
                </span>
                            </div>
                        )
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t text-right">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LinkModal;
