# Contacts Workspace Integration for LibreChat

## Overview

This feature extends LibreChat with a **Contacts Workspace**, allowing users to store contacts and ask the AI assistant questions about them during normal chat conversations. The system supports bulk CSV import, full-text search with relevance scoring, and smart context-aware retrieval so the assistant only receives contacts relevant to each query.

---

## Setup Instructions
Follow these steps to run the Contacts Workspace in your local environment:

### 0. Clone the Repository
First, clone this repository to your local machine:
```bash
git clone https://github.com/Harsh-gitaccount/LibreChat.git
cd LibreChat
```

### 1. Prerequisites
- **Node.js**: Version 20 or higher is required.
- **MongoDB**: Ensure MongoDB is running locally on the default port (27017) or provide a connection string in the `.env`.

### 2. Installation
Install all dependencies for both the API and the Client:
```bash
# From the root directory
npm install
```

### 3. Configuration
The system uses the standard LibreChat `.env` configuration. You **must** provide a Google API key for the contact retrieval and AI chat features to function:

1. Create a `.env` file in the root directory (you can copy `.env.example`).
2. Add your Google API key:
   ```env
   GOOGLE_KEY=your_actual_google_api_key_here
   ```
3. (Optional) If your MongoDB is not on `localhost:27017`, set the `MONGO_URI`.

### 4. Running the Application (Development Mode)
For the best evaluation experience, we recommend running the development servers separately to allow for hot-reloading:

**Step A: Start the Backend API**
Open a new terminal and run:
```bash
npm run backend:dev
```
*The API will start on **http://localhost:3080***

**Step B: Start the Frontend UI**
Open a second terminal and run:
```bash
npm run frontend:dev
```
*The UI will start on **http://localhost:3090***

### 5. Using the Feature
Once both servers are running:
1. Open **http://localhost:3090** in your browser.
2. Log in (or create a local account).
3. **IMPORTANT**: Ensure the **Google** model (e.g., Gemini 1.5 Pro) is selected in the model dropdown.
4. Click the **Contacts** icon (person silhouette) in the left-hand sidebar to access the workspace.
5. Use the **Import** button to upload a CSV (we support files with 1,000,000+ rows).

---

## Project Structure

All contacts-related code is organized within the existing LibreChat codebase structure:

```
api/
├── models/
│   └── Contact.js                         # Mongoose schema + text indexes
└── server/
    ├── middleware/
    │   └── upload.js                      # Multer CSV upload configuration
    ├── routes/
    │   ├── index.js                       # (modified) Registers contacts router
    │   └── contacts.js                    # REST API endpoints + CSV import
    └── services/
        ├── contactRetrieval.js            # Smart retrieval for chat integration
        └── contactRetrieval.test.js       # Unit tests for retrieval logic

client/src/
├── components/
│   └── Contacts/
│       ├── index.ts                       # Barrel exports
│       ├── ContactsPanel.tsx              # Main panel (view navigation)
│       ├── ContactList.tsx                # Paginated list with search
│       ├── ContactDetail.tsx              # Full contact detail view
│       ├── ContactForm.tsx                # Create / edit form
│       └── ContactImport.tsx              # CSV drag-and-drop import
└── hooks/
    └── Contacts/
        ├── index.ts                       # Barrel exports
        └── useContacts.ts                 # React hooks for API calls

Modified files:
├── api/app/clients/BaseClient.js          # Contact context injection into chat
├── api/server/controllers/agents/client.js  # Agent context injection support
├── api/server/index.js                    # Mounts /api/contacts route
├── api/package.json                       # Added csv-parser dependency
├── client/src/hooks/Nav/useSideNavLinks.ts  # Adds Contacts icon to sidebar
└── client/src/locales/en/translation.json   # Adds "Contacts" translation key
```

---

## Architecture

### 1. Data Model (`api/models/Contact.js`)

Contacts use a **hybrid schema** design:

- **Core fields** (`name`, `company`, `role`, `email`, `notes`) — typed Mongoose fields with individual indexes for fast filtering.
- **Arbitrary attributes** — stored as a MongoDB `Map<String, String>`, allowing unlimited custom key-value pairs (Industry, Location, Funding Stage, etc.) without schema migrations.
- **Tags** — a `[String]` array for categorical filtering.
- **User scoping** — every contact is tied to the authenticated user via a `user` field.
- **Weighted text index** — a compound text index across `name` (weight 10), `company` (5), `role` (5), `email` (3), and `notes` (1) enables full-text search with relevance scoring.
- **`toPromptString()`** — an instance method that formats a contact into a structured string for AI prompt injection, including all core fields, tags, and arbitrary attributes.

### 2. REST API (`api/server/routes/contacts.js`)

All endpoints are protected by `requireJwtAuth` and scoped to the authenticated user:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/contacts` | Paginated list with text search, company/role/tag filters |
| GET | `/api/contacts/:id` | Single contact by ID |
| POST | `/api/contacts` | Create contact (validates name, email format) |
| PUT | `/api/contacts/:id` | Update contact (merges attributes, `null` deletes keys) |
| DELETE | `/api/contacts/:id` | Delete contact |
| POST | `/api/contacts/import` | CSV import (streaming + batch processing) |
| GET | `/api/contacts/search/query?q=` | Smart search with keyword extraction |
| GET | `/api/contacts/companies` | Distinct company list for filter dropdowns |

**CSV Import design:**
- Uses Node.js **streams** (`fs.createReadStream().pipe(csv())`) — never loads the full file into memory.
- Processes in **batches of 500 rows** via `Contact.bulkWrite()` with `ordered: false` for fault tolerance.
- Implements **stream backpressure** — pauses the read stream during batch writes to prevent memory buildup.
- **Schema-agnostic column mapping** — the importer adapts to any CSV format via three mechanisms:
  - **Name assembly**: If the CSV has `first_name`, `middle_name`, `last_name` columns instead of a single `name`, they are automatically combined (e.g., `"Parth" + "" + "Dixit"` → `"Parth Dixit"`).
  - **Field aliases**: Common column name variants are resolved to core fields (`company_name` → `company`, `designation` / `job_title` → `role`, `organization` → `company`).
  - **ID safety**: A CSV `id` column is stored as `original_id` in attributes to avoid collision with MongoDB's auto-generated `_id`.
  - **Everything else → attributes**: Any unrecognized column is preserved as an arbitrary key-value attribute (e.g., `pincode`, `pan`, `application_status`, `latitude`, `gender`, `dob`). Zero data loss.
- **Tags** — a `tags` column is comma-split into an array.
- **Cleanup** — temp files are deleted after processing regardless of success/failure.

### 3. Chat Integration

The chat integration uses **smart retrieval + prompt context injection**, split across two files:

**`api/server/services/contactRetrieval.js`** — The retrieval engine:
1. **Conversational Continuity** — The engine analyzes the last 3 user messages to maintain conversational context. This allows follow-up questions (e.g. "where does Bob work?" → "what is his designation?") to flawlessly retain the contact without needing to repeat the name.
2. **Signal detection** (`isContactRelated()`) — checks the user's message history for contact-related keywords (e.g., "who", "works", "company", "CTO", "email") to avoid unnecessary DB queries for unrelated messages.
3. **Keyword extraction** (`extractKeywords()`) — removes stop words, extracts meaningful search terms.
4. **Company detection** (`extractCompany()`) — regex patterns detect "at [Company]", "from [Company]" patterns.
5. **Role detection** (`extractRole()`) — matches known role keywords (CTO, engineer, director, etc.).
6. **MongoDB query** — combines `$text` search + company filter + role filter using `$or`, scored by text relevance.
7. **Context generation** — matching contacts (max 20) are formatted into a `[CONTACTS CONTEXT]` block.

**`api/app/clients/BaseClient.js`** & **`api/server/controllers/agents/client.js`** (modified) — The injection point:
- Inside `BaseClient.sendMessage()` (for all standard chat models) and `AgentClient.buildMessages()` (for the Agents workspace), the retrieval service is called with the conversation context.
- **Conversational Awareness**: The system combines the last 3 user messages to maintain context for follow-up questions (e.g., asking "Who is Indrajit?" and then "What is his status?" works seamlessly because the system remembers the previous context).
- If relevant contacts are found, a system instruction block containing the formatted contacts is seamlessly injected into the LLM prompt. This ensures the prompt behaves exactly like LibreChat's native file-upload context injection.
- **Fault-tolerant**: the entire retrieval is wrapped in `try/catch` — if anything fails, chat proceeds normally without context.

**Why this approach over alternatives:**
- **vs. Sending all contacts**: Doesn't scale past a few hundred contacts; wastes tokens and money.
- **vs. LLM function/tool calling**: More complex to implement with similar results for structured data queries. Would add latency (extra LLM round-trip).
- **vs. Vector embeddings**: Overkill for structured contact data with discrete, searchable fields. Would require embedding infrastructure (e.g., pgvector, Pinecone) that adds operational complexity.

### 4. Frontend (`client/src/components/Contacts/`)

The UI integrates into LibreChat's existing sidebar system:

- **Authentication Client**: All frontend hooks use LibreChat's internal `request` wrapper from `librechat-data-provider`. This ensures proper JWT injection and seamless compatibility with the backend `requireJwtAuth` middleware, securely preventing `401 Unauthorized` errors.
- **ContactsPanel** — main panel managing view navigation (list → detail → form → import). Includes an "Ask assistant" action that programmatically injects a question about the selected contact into the chat textarea.
- **ContactList** — paginated (50/page) with debounced search (300ms). The UI search uses robust `$regex` partial-matching to instantly find contacts even if only a few letters are typed (typeahead), preventing "StrictMode" flash bugs and input unmounting.
- **ContactDetail** — displays all fields, tags as pills, arbitrary attributes as a key-value table. Actions: "Ask assistant", "Edit", "Delete" (with confirmation step).
- **ContactForm** — create/edit mode. Tag input (Enter to add, × to remove). Dynamic custom field pairs ("Add field" button). Client-side validation.
- **ContactImport** — drag-and-drop CSV upload zone. Shows file info, import progress, results summary with error list, and a sample CSV download.

---

## Extra Credit Features

### ✅ Smart Retrieval (Extra Credit Challenge)

The system does **not** send all contacts to the AI. Instead:
1. The user's message is analyzed for keywords, company names, and role terms.
2. Only contacts matching the extracted criteria are retrieved (max 20).
3. These are injected as a system message with clear boundaries (`[CONTACTS CONTEXT]` / `[END CONTACTS CONTEXT]`).

For example, "Who works at Acme Corp?" only sends contacts where `company` matches "Acme Corp" — not the other 999,000 contacts.

### ✅ Contact Search
Full-text search via MongoDB text index with relevance scoring. Available both in the UI and via the API.

### ✅ Contact Editing and Deletion
Full PUT/DELETE endpoints with UI support. Edit mode pre-fills all fields including tags and custom attributes. Delete requires confirmation click.

### ✅ Contact Tagging
Tags are stored as arrays, editable in the form (Enter to add, × to remove), displayed as pills in the detail view.

### ✅ Click Contact → Ask Assistant
The "Ask assistant" button on the detail view composes a question like "What do we know about John Doe from Acme Corp?" and injects it into the chat textarea, ready to send.

### ✅ Improved UI for Large Lists
Pagination (50 per page), "Load more" progressive loading, debounced search to prevent excessive API calls, loading skeletons during fetch.

---

## Design Questions

### 1. If the system needed to support 1,000,000 contacts, how would you redesign it?

The current CSV import already handles 1M-row files via streaming + batching. For ongoing operation at that scale:

- **Search**: Replace MongoDB's built-in text search with **MongoDB Atlas Search** or **Elasticsearch**. MongoDB text indexes work well up to ~100K documents, but relevance ranking and query latency degrade at 1M+. Atlas Search uses Lucene internally and provides sub-100ms latency at any scale.

- **Import pipeline**: Move CSV processing to a **background job queue** (e.g., BullMQ + Redis). The current synchronous HTTP request works for 10K rows but would time out for very large files. A job queue enables progress tracking, retry logic, and doesn't block the API server.
  - *Index Optimization:* To prevent the 15-20 minute bottleneck caused by real-time text indexing during a 1M row import, the background worker would dynamically drop the text index before the import, perform a pure `bulkWrite` (which finishes in ~60 seconds), and then trigger a background index rebuild.

- **Pagination**: Switch from offset-based (`skip/limit`) to **cursor-based pagination** using `_id` or `created_at` as the cursor. Offset pagination becomes O(n) at high page numbers because MongoDB must scan and discard skipped documents.

- **Caching**: Add **Redis caching** for frequently accessed data like company lists and recent search results.

- **Indexing**: Add compound indexes on `{ user: 1, company: 1 }` and `{ user: 1, role: 1 }` for filtered queries. Consider partial indexes on `email` for non-empty values.

### 2. How would you ensure the assistant retrieves the most relevant contacts for a query?

The current system uses keyword extraction + text search, which handles exact and partial matches well. To further improve relevance:

- **Semantic search**: Embed each contact's `toPromptString()` representation using a small embedding model (e.g., `text-embedding-3-small`), store vectors in a vector database. At query time, embed the user's message and do cosine similarity search. This catches semantic relationships: "interested in ML" would match "AI infrastructure".

- **Two-stage retrieval**: Retrieve ~50 candidates via broad text search, then **rerank** with a cross-encoder model that scores `(query, contact)` pairs for fine-grained relevance. Take the top 20 after reranking.

- **Query understanding**: Before searching, use a lightweight LLM call to extract structured intent from natural language. "Who should I talk to about payments?" → `{role: "payments", industry: "fintech"}`.

- **Feedback loop**: If the user corrects the assistant ("I meant Sarah at Stripe, not Sarah at Google"), log that signal to improve future retrieval.

### 3. What are the limitations of your current implementation?

- **Keyword matching only**: The system relies on MongoDB text search (stemming + exact token matching). "Who handles business development?" won't match a contact with role "VP Sales" — there's no semantic synonym understanding.

- **Context window cap (Top 20 Limit)**: To prevent exceeding LLM token limits and crashing the AI, our retrieval engine strictly limits context injection to the **top 20** most relevant contacts. If a user asks "Which contacts have status REJECT?" and there are 500 rejected contacts, the AI only sees the first 20. This is an intended architectural safety constraint. If a specific contact is "missed", the user simply needs to narrow their query (e.g. "Which rejected contacts live in Hyderabad?") to bring that person into the top 20.

- **Synchronous CSV Imports**: While the CSV streaming mechanism prevents RAM exhaustion, the HTTP request itself is synchronous. Importing 1,000,000 rows typically takes **15-20 minutes** on standard hardware (averaging ~1,000 inserts per second). This time is dominated by MongoDB actively tokenizing and building the massive Full-Text Search index for every single word in the dataset in real-time. Standard browsers or reverse proxies (like Nginx) often time out HTTP requests after 60-120 seconds. If a timeout occurs, the UI will report an error even though the backend continues successfully importing in the background. In production, this must be decoupled into a background worker queue (like BullMQ) that reports progress via WebSockets.

- **No deduplication on import**: Re-importing the same CSV creates duplicate contacts. A production system would upsert based on email or implement fuzzy name+company dedup.

- **Single-user contact count cache**: The `hasContacts` cache uses an in-process variable. In a multi-instance deployment, this would need to move to Redis and be keyed per user.

---

## Testing

### Unit Tests

```bash
cd api
npx jest contactRetrieval
```

Tests cover:
- `extractKeywords()` — stop word removal, special character handling
- `extractCompany()` — company name extraction from natural language
- `extractRole()` — role keyword detection
- `isContactRelated()` — signal detection accuracy

### Manual Testing

1. Start the app and navigate to the Contacts sidebar panel
2. Import a CSV file (download links below)
3. Verify contacts appear in the list
4. Click a contact to view details
5. Edit and delete contacts
6. In chat, ask: "Who works at [Company]?" — the assistant should answer using stored contacts

