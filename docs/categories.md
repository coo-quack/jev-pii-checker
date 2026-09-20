# Categories & Sensitivity

## The 12 PII Categories

jev-pii-checker screens for 12 categories of personally identifiable information. Each is checked by Jev during the gate phase.

### person_name

**Does the text mention the name of a specific individual person?**

Examples: "John Smith", "田中太郎", "Alice Johnson"

Not included: Generic titles ("Manager", "Dr."), fictional names, historical figures (context-dependent).

### email_or_phone

**Does the text contain an email address or phone number of a specific person?**

Examples: "john@example.com", "555-0123", "090-1234-5678"

The regex layer extracts these; Jev judges whether they are personal.

### postal_address

**Does the text contain a postal address associated with a specific person?**

Examples: "123 Main Street, Springfield, IL 62701", "東京都渋谷区"

Not included: Addresses without a person context (e.g., a building or landmark).

### date_of_birth

**Does the text contain the date of birth of a specific person?**

Examples: "born 1985-03-15", "January 10, 1990"

Context matters: "March 15" alone is ambiguous; "his birthday is March 15" with a named person is included.

### government_id

**Does the text contain a government-issued identifier of a person?**

Examples: マイナンバー (My Number), passport number, driver's license number, national ID, SSN

These are high-sensitivity: a single number can identify a person uniquely.

### financial_account

**Does the text contain a credit card number or bank account number of a person?**

Examples: Credit card numbers, bank account numbers, SWIFT codes

The regex layer extracts digit strings; Jev judges whether they are financial. (Luhn checksums are not verified.)

### health_info

**Does the text contain medical information, diagnosis, or treatment details of an identifiable person?**

Examples: "Diabetes type 2", "prescribed Lisinopril", "underwent knee surgery"

Context matters: "blood type O" alone is low-specificity; "his blood type is O" with a named person is included.

### biometric

**Does the text contain biometric data (fingerprint, facial recognition, iris scan) of a specific person?**

Examples: Fingerprint records, facial recognition data, iris scans

Rare in plain text but can appear in reports or logs.

### ip_address_of_a_person

**Does the text contain the IP address of a specific person's device or network?**

Examples: "192.168.1.100", "2001:db8::1"

The regex layer extracts IPs; Jev judges context (personal device vs. server). Filtering rejects known corporate ranges and server IPs.

### sns_handle

**Does the text contain a social media handle or username of a specific person?**

Examples: "@username", "user123", "Discord handle: alice#1234"

Context matters: "alice" alone is a name; "twitter: alice" with context is a handle.

### employment_info

**Does the text contain employment information (workplace, job title, role) of a specific person?**

Examples: "Alice works at Acme Corp", "John is VP of Engineering", "title: Product Manager"

Not included: Job titles without a person context.

### race_or_religion

**Does the text contain information about the race, ethnicity, or religious beliefs of a specific person?**

Examples: "He is Catholic", "She is of Indian descent", "Buddhist temple attendee"

Context matters: "Buddhism" alone is a religion; "he practices Buddhism" with a named person is included.

## Sensitivity Levels

The gate also produces a sensitivity score using the **IBM taxonomy**. This reflects the harm potential if the PII were leaked.

### hr_or_criminal_record

A disciplinary action, performance evaluation, dismissal or termination decision, harassment or misconduct complaint, or criminal or arrest record concerning an identifiable person. Employment facts alone (workplace, title, a list of staff) belong to `employment_info`, not here. Together with a named person this category escalates the sensitivity to `high` (see the policy below): such records reveal an adverse fact about the person even when the model's own rubric answer sits near the low/high boundary.

### none

**No information about an identifiable individual.**

Examples:

- "The weather today is sunny."
- "Best practices for password hygiene" (no person named)

Probability: Jev returns a score near 0.

### low

**Identifies or gives contact/basic details of a person (name, phone, email, address, birthday, job) but a leak would cause little direct harm.**

Examples:

- "John Smith, 555-0123, jsmith@example.com, works at Acme"
- A phonebook or company directory
- Public LinkedIn profiles

These details are often already public or can be reconstituted from public sources. A leak is awkward but not catastrophic.

Probability: Jev returns a score near 1.

### high

**Contains a government ID number, financial account, health or biometric information of a person, or a list that reveals a sensitive fact about named people.**

Examples:

- "SSN: 123-45-6789"
- "Credit card 4532 1234 5678 9010"
- "diagnosed with cancer"
- "list of employees with mental health leaves approved" (sensitive fact about a group)

A leak directly enables identity theft, fraud, or privacy violation. These should never be scanned unless necessary, and results should be treated carefully.

Probability: Jev returns a score near 2.

## Digit String Categories

The regex layer extracts digit strings (10–16 characters). Jev judges their type. Common types:

- **credit_card**: 13–19 digits (Visa, Mastercard, Amex, Discover)
- **my_number**: Japanese government ID (12 digits)
- **national_id**: Social security number or other national identification number (e.g., US SSN 3-2-4 format)
- **driver_licence_or_passport**: Driver's license or passport number
- **bank_account**: Bank account number
- **phone**: Phone number (when extracted as a pure digit string, not matched by phone regex)
- **order_or_tracking_number**: E-commerce or parcel tracking (less sensitive)
- **product_serial**: Product or equipment ID (not sensitive)
- **date**: Date-related number (not sensitive)
- **other**: Unknown or unlabelled number (not sensitive)

These distinctions help filter noise and set appropriate confidence thresholds.

### Sensitivity Policy for Special Categories

The code-side sensitivity policy treats the following as **special categories** that trigger escalation to high sensitivity when a named person co-occurs with them:

- **health_info**: Medical information, diagnosis, treatment details
- **biometric**: Biometric data (fingerprint, facial recognition, iris scan)
- **government_id**: Government-issued identifiers (マイナンバー, passport, driver's license, etc.)
- **financial_account**: Credit card, bank account, financial information
- **race_or_religion**: Race, ethnicity, or religious beliefs
- **hr_or_criminal_record**: Disciplinary, evaluation, dismissal, complaint or criminal record

Similarly, these number types trigger escalation on their own:

- **my_number**: Japanese My Number
- **credit_card**: Credit card number
- **bank_account**: Bank account number
- **driver_licence_or_passport**: Driver's license or passport number
- **national_id**: National ID number (e.g., SSN)

This policy implements Japanese law (個人情報保護法): 要配慮個人情報 (sensitive personal information requiring care) includes these categories when linked to a named individual.

## Sensitivity Distribution

In typical corpora:

- **none**: ~40% of documents (no PII)
- **low**: ~50% of documents (contact info, employment, basic details)
- **high**: ~10% of documents (IDs, financial, health)

---

See [Limitations](./limitations) for caveats on accuracy and scope.
