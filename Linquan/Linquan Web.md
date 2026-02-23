## Start up

### 1. Backend (Terminal A)

```cmd
cd D:\Code\NJU\Linquan\linquan-website\backend

# First time only: 
create .env if (!(Test-Path .env)) { Copy-Item ..\.env.example .env } 
npm install 
# First time only (or when resetting DB) npm run db:
init 

# Daily start 
npm run dev 
```

Backend URL: http://localhost:4000

------

### 2. Frontend (Terminal B)

```cmd
cd D:\Code\NJU\Linquan\linquan-website\frontend

# Optional: create frontend .env (uses /api by default)
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# First time only
npm install

# Daily start
npm run serve
```

Frontend URL: usually http://localhost:8080 (or next free port shown in terminal)

------

### 3. Quick verification

```cmd
Invoke-RestMethod http://localhost:4000/api/health 
```

Expected: status = ok

Then open frontend URL in browser.

---

## Website Design Prompt

I want to design a **website for a university piano club**. The system should support member management, piano room scheduling, and concert organization, with clear role separation and practical usability.

------

### 1. Development Environment

- **Code Editor**: Visual Studio Code
- Please keep align with my configure(specified at the end of the text):
  - Recommended **VS Code extensions**
  - Necessary **environment setup** (frameworks, runtimes, package managers, etc.)
  - Suggested **project structure and settings**

------

### 2. Core Functionalities

#### 2.1 User Authentication

- Users can **register and log in**
- Required credential:
  - **Student number** (mandatory)
- Optional credential:
  - **Email address** (used as a supplement)
- Authentication should be based on a **personal secret code / password**

#### 2.2 Activity Information

- Display up-to-date information about:
  - Club activities
  - Events
  - Announcements

#### 2.3 Piano Room Scheduling *(Core Feature)*

- A full scheduling system for piano room usage
- Detailed requirements are specified in Section 4

#### 2.4 Concert Management

- Support concert announcements, applications, auditions, and feedback
- Detailed requirements are specified in Section 5

#### 2.5 Member Profiles

- Members can upload and edit personal information, including:
  - Photos
  - Self-introduction
  - Other optional details
- Club members can **view other members’ profiles**

#### 2.6 Notification System

- The system should be able to **send notices via email**
- Used for:
  - Scheduling results
  - Concert updates
  - Important announcements

------

### 3. User Roles and Permissions

The website should support **two user perspectives**:

#### 3.1 Club Members

- Can freely register and log in
- Can:
  - View activity information
  - Participate in piano room scheduling
  - Apply for concerts
  - Manage personal profiles
  - Receive notifications

#### 3.2 Administrators

- Administrator accounts are **not publicly registerable**
- Privileges are **granted by the developer**
- Administrator functionality can be implemented **after the member mode is completed**
- Administrators will have elevated permissions for:
  - Scheduling management
  - Concert auditing
  - Information publishing

------

### 4. Detailed Requirements: Piano Room Scheduling

- Each semester, the club provides **two piano rooms**
- Availability:
  - **Daily from 8:00 to 22:00**
  - **7 days per week**
- Each room provides **14 one-hour time slots per day**

#### 4.1 Preference Submission

- At the beginning of each semester:
  - Members submit their **preferred practice time slots**
  - Members are encouraged to select **multiple time slots**
- Final assignment:
  - Each member will be assigned **1–2 hours per week**

#### 4.2 Multi-choice Selection Interface

- A **weekly calendar view** that allows members to:
  - See the **number of members who have already selected each time slot**
  - Select **any number of preferred time slots** (no upper limit)

#### 4.3 Scheduling Algorithm

The algorithm must satisfy two priorities:

1. **Fairness-first principle**
   - Maximize the number of members who receive **at least one hour** of practice time
2. **Efficiency optimization**
   - After basic fairness is achieved, allocate remaining slots to:
     - Maximize total room utilization
     - Reduce idle time
     - The administrator should check it before releasing and may modify it.

------

### 5. Detailed Requirements: Piano Concert Arrangement

During each concert cycle, the website should support:

- **Publishing announcements** and notifying club members
- **Performance application submission**
- **Uploading piano scores**, supporting multiple file formats
- **Displaying audition schedules**
- **Providing audition results and feedback**
- Publishing any **additional relevant information** related to the concert

## Development Environment (VS Code)

### 1.1 Core Runtime & Tools (Before VS Code)

You should prepare these **before** opening the project in VS Code:

- **Node.js (LTS)**
   Required for frontend frameworks, tooling, and package management.
- **npm / pnpm / yarn**
   Any one is acceptable; `npm` is sufficient for beginners.
- **Git**
   Version control and collaboration.
- **Database (choose one early)**
  - SQLite (simple, good for early stage)
  - PostgreSQL / MySQL (better for long-term, multi-user systems)

------

### 1.2 Required VS Code Extensions

These are **strongly recommended** and cover frontend, backend, database, and workflow.

#### A. General Productivity

- **ESLint**
   Enforces code quality and consistency.
- **Prettier – Code Formatter**
   Automatic formatting for JS/TS/HTML/CSS/JSON.
- **EditorConfig for VS Code**
   Keeps indentation and line endings consistent across machines.

#### B. Frontend Development

(Assuming modern web stack: HTML + CSS + JS / TypeScript)

- **HTML CSS Support**
- **CSS Peek**
- **Live Server**
   For quick frontend preview during early development.

I will use a framework (Vue):
@vue/cli 5.0.9

#### C. Backend Development

(Assuming Node.js backend, e.g., Express / NestJS)

- **REST Client**
   Test API endpoints directly inside VS Code.
- **dotenv**
   Syntax highlighting for `.env` files.

#### D. Database & Data Inspection

- **SQLite Viewer**

Useful for inspecting:

- User accounts
- Scheduling results
- Concert applications

#### E. Version Control

- **GitLens**
   Advanced Git history, blame, and change tracking.

------

### 1.3 Recommended VS Code Settings

Add the following to your **`settings.json`** for stability and consistency:

```
{
  "editor.formatOnSave": true,
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.autoSave": "onFocusChange",
  "eslint.validate": ["javascript", "typescript"],
  "prettier.singleQuote": true,
  "prettier.semi": true
}
```

**Why these matter:**

- Prevent inconsistent formatting in team projects
- Reduce trivial diffs in Git
- Keep code readable and maintainable

------

### 1.4 Suggested Project Structure (Initial)

You should adopt a clear separation early(Under the file of D:\Code\NJU\Linquan):

```
linquan-website/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── src/
│   ├── routes/
│   ├── models/
│   ├── services/
│   └── package.json
│
├── database/
│   └── schema.sql
│
├── .env
├── .gitignore
└── README.md
```

This structure will scale cleanly when you later add:

- Role-based permissions (admin vs member)
- Scheduling algorithms
- Email services

------

