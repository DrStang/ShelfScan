import React from 'react';
import { X, Globe, Star, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
const PrivacyModal = ({ isOpen, onClose}) => {
    if (!isOpen) return null;

    const markdownText= `# Privacy Policy for Shelf Scan

**Last Updated: October 31, 2025**

## Introduction

Shelf Scan ("we," "our," or "the App") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.

By using Shelf Scan, you agree to the collection and use of information in accordance with this policy.

---

## Information We Collect

### 1. Account Information (Optional)
When you create an account, we collect:
- Email address
- Password (encrypted and stored securely)
- User ID (automatically generated)

**Note:** The App can be used without creating an account. Guest users can scan books without providing any personal information.

### 2. Images You Upload
- Photos of book spines that you take or upload
- These images are temporarily processed by our servers and third-party AI services
- Images are **not permanently stored** on our servers after processing
- Logged-in users may choose to save scan results, which store book metadata (titles, authors, ISBNs) but **not the original images**

### 3. Book Data
When you use the App, we collect and store:
- Book titles, authors, and ISBNs identified from your scans
- Book ratings from Goodreads
- Your personal reading list (if you import from Goodreads)
- Scan history (for logged-in users only)
- Timestamps of when scans were performed

### 4. Technical Information
We automatically collect:
- Device type and operating system
- App version
- Error logs and crash reports (for debugging purposes)
- API request metadata (timestamps, request types)

### 5. Usage Data
- Number of scans performed
- Features used within the App
- App performance metrics

---

## How We Use Your Information

We use the collected information for:

1. **Core Functionality**
   - Processing book spine images to identify titles and authors
   - Retrieving book ratings and information
   - Saving your scan history (logged-in users)
   - Managing your reading list

2. **Service Improvement**
   - Analyzing usage patterns to improve the App
   - Debugging and fixing technical issues
   - Developing new features

3. **Account Management**
   - Creating and maintaining your account
   - Authenticating your identity
   - Sending important service notifications

4. **Security**
   - Preventing fraud and abuse
   - Protecting against unauthorized access
   - Rate limiting to prevent service abuse

---

## Third-Party Services

### We Use the Following Third-Party Services:

#### 1. **OpenAI (ChatGPT Vision API)**
- **Purpose:** Processing book spine images to identify titles and authors
- **Data Shared:** Images you upload or photograph
- **Data Retention:** OpenAI stores images for 30 days for abuse monitoring, then deletes them
- **Privacy Policy:** https://openai.com/policies/privacy-policy

#### 2. **Supabase**
- **Purpose:** User authentication and database storage
- **Data Shared:** Email, encrypted password, scan history, reading list
- **Data Location:** Hosted on secure cloud infrastructure
- **Privacy Policy:** https://supabase.com/privacy

#### 3. **Railway**
- **Purpose:** Backend server hosting
- **Data Shared:** Images (temporarily during processing), API requests
- **Data Retention:** Images are not stored; only processed in memory
- **Privacy Policy:** https://railway.app/legal/privacy

#### 4. **Google Books and OpenLibrary**
- **Purpose:** Retrieving public book ratings
- **Data Shared:** Book titles and ISBNs only
- **Note:** We access publicly available data; no personal data is transmitted

---

## Data Storage and Security

### Security Measures
- All data transmission is encrypted using HTTPS/TLS
- Passwords are hashed and encrypted before storage
- Database access is protected by authentication tokens
- Row-level security ensures users can only access their own data

### Data Retention
- **Account Data:** Retained until you delete your account
- **Scan History:** Retained until you manually delete scans or delete your account
- **Images:** Temporarily processed in memory; **not stored permanently**
- **Guest User Data:** Not stored (scans are not saved)

### Data Location
- Primary database: Supabase (cloud-hosted)
- Backend processing: Railway (cloud-hosted)
- All services comply with industry-standard security practices

---

## Your Rights and Choices

### You Have the Right To:

1. **Access Your Data**
   - View your scan history and reading list within the App

2. **Delete Your Data**
   - Delete individual scans from your history
   - Clear your entire reading list
   - Delete your account and all associated data

3. **Export Your Data**
   - Request a copy of your data by contacting us

4. **Use Without an Account**
   - Use the App as a guest without creating an account
   - Guest scans are not saved and no personal data is collected

5. **Opt-Out**
   - Stop using the App at any time
   - Delete your account to remove all stored data

---

## Children's Privacy

Shelf Scan is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us, and we will delete such information.

---

## International Users

The App is operated from the United States. If you are located outside the U.S., please be aware that information we collect will be transferred to and processed in the United States. By using the App, you consent to the transfer and processing of your information in the U.S.

---

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by:
- Posting the new Privacy Policy in the App
- Updating the "Last Updated" date at the top of this policy
- Sending an email notification (for significant changes)

Your continued use of the App after changes constitutes acceptance of the updated policy.

---

## Data Deletion Instructions

### To Delete Your Data:

1. **Delete Individual Scans:**
   - Open the App → My Library → Swipe left on any scan → Delete

2. **Clear Reading List:**
   - Open the App → Profile → Clear Reading List

3. **Delete Your Account:**
   - Open the App → Profile → Delete Account
   - All your data (scan history, reading list, account info) will be permanently deleted within 30 days

4. **Request Data Deletion via Email:**
   - Email us at: [YOUR_SUPPORT_EMAIL@example.com]
   - Include your account email address
   - We will delete your data within 30 days

---

## Contact Us

If you have questions about this Privacy Policy or our data practices, please contact us:

**Email:** admin@shelfscan.xyz
**App Name:** Shelf Scan  
**Developer:** Daniel Dolewski

For data deletion requests, security concerns, or privacy inquiries, please use the email above.

---

## Compliance

This Privacy Policy complies with:
- Apple App Store Review Guidelines
- Google Play Store Developer Policy
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles

---

## Summary (TL;DR)

- ✅ **Guest mode available** - use without an account
- ✅ **Images not stored** - processed temporarily, then deleted
- ✅ **You control your data** - delete scans, reading list, or account anytime
- ✅ **Secure storage** - encrypted transmission and storage
- ✅ **Third-party AI** - OpenAI processes images (auto-deleted after 30 days)
- ✅ **No ads or tracking** - we don't sell your data
- ✅ **Transparent** - this policy explains everything we do

---

**Thank you for using Shelf Scan!** 📚`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto pt-safe pb-safe">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative">

                <ReactMarkdown>{markdownText}</ReactMarkdown>

                {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
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

export default PrivacyModal;
