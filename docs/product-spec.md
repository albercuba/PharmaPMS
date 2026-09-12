# PharmaPMS Product Specification

PharmaPMS is a self-hosted, multilingual pharmacy management web application.

## Deployment Model

- Self-hosted web application
- Must be deployable with Docker
- Prefer Docker Compose for local and small-production deployments
- Application configuration should be provided through environment variables
- Persistent data must use Docker volumes
- Production deployments must support HTTPS behind a reverse proxy
- Backups and restore procedures must be documented

## Product Principles

1. Pharmacy workflows come first.
2. Multilingual support must be built in from the beginning.
3. Country-specific regulation must not be hard-coded into the core domain.
4. Security and auditability are first-class requirements.
5. The system must remain usable by small independent pharmacies.
6. Architecture should allow future multi-branch support.
7. Clinical safety features must rely on trusted clinical data sources rather than invented or unverified data.
8. PharmaPMS should work without depending on a SaaS backend controlled by the project maintainer.

---

Pharmacy Management Software — Feature List

1. Medicine & Product Catalog

-   Medicine name, brand name, and generic name
-   Active ingredients
-   Strength and dosage form
-   Pack size
-   Manufacturer
-   Supplier information
-   Barcode / GTIN
-   Prescription vs. OTC classification
-   Controlled-drug classification
-   Purchase price and selling price
-   Tax / VAT category
-   Storage requirements
-   Generic and therapeutic alternatives

2. Inventory Management

-   Real-time stock quantities
-   Batch / lot tracking
-   Expiration date tracking
-   FEFO (First Expiring, First Out)
-   Low-stock alerts
-   Expiry warnings
-   Stock adjustments
-   Damaged and expired stock management
-   Stock transfers between branches
-   Cycle counts and full inventory counts
-   Inventory valuation
-   Automatic reorder suggestions

3. Purchasing & Supplier Management

-   Supplier database
-   Purchase orders
-   Goods receiving
-   Supplier invoices
-   Purchase returns
-   Backorders
-   Purchase cost history
-   Supplier price comparison
-   Outstanding supplier balances
-   Automatic purchase-order suggestions

4. Point of Sale (POS)

-   Barcode scanning
-   Fast product and medicine search
-   Cash, card, mobile, and other supported payment methods
-   Split payments
-   Discounts
-   Refunds and returns
-   Receipts and invoices
-   Cash register opening and closing
-   Employee shift management
-   Hold and resume transactions
-   Customer accounts / credit where legally permitted

5. Prescription & Dispensing Management

-   Create and receive prescriptions
-   Electronic prescription integration where available
-   Prescription scanning / document upload
-   Prescriber information
-   Patient information
-   Prescribed medicine, strength, dosage, and quantity
-   Dosage instructions
-   Refills / repeats
-   Partial dispensing
-   Prescription status tracking
-   Dispensing history
-   Prescription label printing
-   Pharmacist verification before dispensing

6. Clinical Safety

-   Drug-drug interaction alerts
-   Allergy warnings
-   Duplicate therapy warnings
-   Contraindication alerts
-   Dose-range checks
-   Age-related warnings
-   Pregnancy / breastfeeding warnings where appropriate
-   Patient medication history
-   Pharmacist intervention notes
-   Generic / substitution suggestions
-   Integration with a reputable clinical medication database

7. Patient Management

-   Patient profiles
-   Contact information
-   Medication history
-   Allergy information
-   Relevant clinical information
-   Prescription history
-   Insurance information
-   Preferred pharmacy / branch
-   Communication preferences
-   Consent and privacy records
-   Patient notes
-   Preferred language

8. Insurance & Third-Party Billing

-   Insurance information
-   Eligibility checks
-   Electronic claim submission
-   Claim status tracking
-   Rejected-claim handling
-   Copay calculation
-   Prior authorization workflows
-   Reimbursement tracking
-   Country-specific insurance integrations

9. Controlled Medicines

-   Controlled-drug inventory
-   Special dispensing permissions
-   Quantity tracking
-   Required registers and logbooks
-   Pharmacist authorization
-   Stock reconciliation
-   Suspicious transaction controls where required
-   Complete audit history
-   Country-specific compliance rules

10. Labels & Printing

-   Prescription labels
-   Patient medication instructions
-   Barcode labels
-   Price labels
-   Shelf labels
-   Receipts
-   Invoices
-   Purchase orders
-   Regulatory reports
-   Support for printing patient instructions in the patient’s preferred
    language

11. Returns, Recalls & Expiry

-   Customer returns
-   Supplier returns
-   Expired medicine workflow
-   Quarantine stock
-   Product recall management
-   Identification of affected batches
-   Disposal / destruction records

12. Reports & Analytics

-   Daily, weekly, monthly, and yearly sales
-   Gross profit
-   Profit by product / category
-   Best-selling products
-   Slow-moving products
-   Stock-on-hand reports
-   Low-stock reports
-   Expiring-soon reports
-   Expired inventory
-   Purchase reports
-   Supplier performance
-   Prescription volume
-   Pharmacist activity
-   Cashier reports
-   Tax / VAT reports
-   Insurance receivables
-   Inventory valuation

13. Accounting & Finance

-   Sales and purchase accounting
-   Accounts payable
-   Accounts receivable
-   Expenses
-   Tax / VAT
-   Cash reconciliation
-   Credit notes
-   Accounting software integrations
-   Financial data exports

14. Users, Roles & Permissions

-   Owner / administrator
-   Pharmacist
-   Pharmacy technician
-   Cashier
-   Inventory / purchasing employee
-   Accountant
-   Custom roles
-   Fine-grained permissions
-   Pharmacist approval for sensitive actions

15. Security & Audit Trail

-   Record who performed each important action and when
-   Prescription change history
-   Price change history
-   Inventory adjustment history
-   Refund history
-   Deleted / cancelled transaction history
-   Controlled-drug action history
-   Login history
-   Multi-factor authentication
-   Session controls
-   Encryption
-   Automatic backups
-   Data export and recovery
-   Privacy and data-retention controls

16. Multilingual & Localization Support

-   Multilingual user interface
-   Per-user interface language preference
-   Per-patient preferred language
-   Separate employee UI language from patient label / instruction
    language
-   Translation keys instead of hard-coded interface text
-   Translation tables for localized database content
-   Standard locale codes such as en-US, de-DE, fr-FR, and ar-SA
-   Locale-aware dates, times, numbers, decimal separators, and
    currencies
-   Right-to-left (RTL) layout support for languages such as Arabic and
    Hebrew
-   Localized receipts, invoices, reports, labels, and patient
    instructions
-   Approved / validated translations for medical instructions and
    safety-critical content
-   Ability to retain official medicine names where regulations require
    them
-   Language fallback when a translation is unavailable
-   Country and language configured separately
-   Unicode support throughout the application and database
-   Translation management workflow for adding and reviewing languages
-   Support for country-specific terminology
-   Avoid relying on live machine translation for safety-critical
    clinical information

Example configuration: - UI language: English - Pharmacy country:
Germany - Currency: EUR - Tax rules: Germany - Prescription integration:
Germany - Patient preferred language: Turkish - Printed patient
instructions: Turkish

17. Multi-Branch & Central Management

-   Multiple pharmacy locations
-   Centralized product catalog
-   Centralized purchasing
-   Branch-specific stock
-   Inter-branch stock transfers
-   Branch-specific users and permissions
-   Consolidated reporting
-   Warehouse support
-   Central price management with optional branch overrides

18. Customer Communication & Services

-   SMS / email refill reminders
-   Prescription-ready notifications
-   Medication pickup notifications
-   Appointment booking
-   Vaccination / pharmacy service management
-   Medication synchronization
-   Loyalty program
-   Click-and-collect
-   Online ordering
-   Delivery management
-   Communication in the patient’s preferred language

19. Integrations

-   E-prescription systems
-   Medicine / clinical databases
-   Pharmacy wholesalers and suppliers
-   Payment terminals
-   Barcode scanners
-   Receipt and label printers
-   Accounting platforms
-   Insurance systems
-   E-commerce platforms
-   SMS / email providers
-   Automated dispensing machines
-   Government / regulatory systems where required
-   API for approved third-party integrations

20. Pharmacist Dashboard

A central dashboard should show items requiring attention, such as: -
Prescriptions awaiting verification - Low-stock medicines - Medicines
expiring soon - Product recalls - Controlled-drug discrepancies -
Pending purchase orders - Unresolved insurance claims - Patient / refill
tasks - Important system or compliance alerts

Recommended MVP

The first version should focus on: 1. Medicine and product catalog 2.
Inventory, batch, and expiry management 3. Suppliers and purchasing 4.
Point of Sale 5. Patient records 6. Prescription and dispensing
management 7. Label and receipt printing 8. Users, roles, and
permissions 9. Audit trail and security 10. Basic reports and analytics
11. Multilingual architecture from day one

Important Architecture Principle

Language, country, currency, tax rules, and regulatory configuration
should be separate concepts.

For example, a pharmacist may use the software in English while
operating in Germany and printing medication instructions in Turkish.
The architecture should support this without duplicating patient,
medicine, or transaction records.

Clinical, insurance, e-prescription, controlled-drug, privacy, tax, and
regulatory requirements vary by country. These components should
therefore be designed as configurable or country-specific modules rather
than being hard-coded into the core system.

