require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const reportRoutes = require('./modules/claims/report.routes');
const logger = require("./middleware/logger.middleware");
const rateLimiter = require("./middleware/rateLimiter.middleware");
const security = require("./middleware/security.middleware");
const entraMiddleware = require("./middleware/entra.middleware");
const errorHandler = require("./middleware/error.middleware");
const escalationService = require("./modules/workflow/escalation.service");
const authorize = require("./middleware/authorize.middleware");
const { startEscalationScheduler, startDigestScheduler } = require("./middleware/escalation.scheduler");
const orgSync = require('./utils/orgSync')
const app = express();
const cron =
 require("node-cron");


cron.schedule(
 "0 * * * *",
 async () => {
   await escalationService.run();
 }
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  })
);

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

security.forEach((m) => app.use(m));

app.use(rateLimiter);
app.use(logger);
app.use(entraMiddleware);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "UP"
  });
});


app.use(
  "/api/users",
  require("./modules/users/user.routes")
);
app.use(
  "/api/user-roles",
  require(
    "./modules/userRoles/user-role.route"
  )
);
app.use(
  "/api/workflows",
  require(
    "./modules/claimWorkFlow/workflow-dashboard.routes"
  )
);
app.use('/report', authorize('CLAIM_VIEW'), reportRoutes);
app.use(
  "/api/roles",
  require("./modules/roles/role.routes")
);
app.use(
  "/api/claim-types",

  require("./modules/claim-types/claimType.routes")
);
app.use(
  "/api/permissions",
  require("./modules/permissions/permission.routes")
);

app.use(
  "/api/access",
  require("./modules/access/access.routes")
);

app.use(
  "/api/audit",
  require("./modules/audit/audit.routes")
);

app.use(
  "/api/claims",
  require("./modules/claims/claim.routes")
);

app.use(
  "/api/organization",
  require("./modules/organization/organization.routes")
);
app.use(
  "/api/departments",
  require(
    "./modules/departments/department.routes"
  )
);

app.use(
  "/api/designations",
  require(
    "./modules/designations/designation.routes"
  )
);

app.use(
  "/api/approval-matrix",
  require(
    "./modules/approvalMatrix/approval-matrix.routes"
  )
);
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);




app.get("/auth/me", async (req, res) => {
  const userEmail =
    req.headers["x-ms-client-principal-name"];

  if (!userEmail) {
    return res.json({
      displayName: "Employee",
      photoUrl: null
    });
  }

  try {
    const token = await orgSync.getGraphToken();

    const userRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}?$select=displayName`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const userData = await userRes.json();

    const photoRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/photo/$value`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    let photoUrl = null;

    if (photoRes.ok) {
      const photoBuffer =
        await photoRes.arrayBuffer();

      const base64 = Buffer.from(
        photoBuffer
      ).toString("base64");

      const contentType =
        photoRes.headers.get("content-type") ||
        "image/jpeg";

      photoUrl = `data:${contentType};base64,${base64}`;
    }

    res.json({
      displayName:
        userData.displayName || userEmail,
      photoUrl
    });
  } catch (err) {
    console.error(
      "Error fetching profile:",
      err.message
    );

    res.json({
      displayName: userEmail,
      photoUrl: null
    });
  }
});



app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route Not Found"
  });
});



app.use(errorHandler);
//startEscalationScheduler();
//startDigestScheduler();
const PORT = process.env.PORT || 3000;

app.listen(3000, '0.0.0.0', () => {
  console.log(
    `MMC backend running on port ${PORT}`
  );

  console.log("Ready.");
});

// ─── SYSTEM PROMPT FALLBACK ───────────────────────────────────────────────────
// const CB_SYSTEM = `You are the MMC Policy Assistant for Mega Motor Company (BYD Pakistan distributor).
// Your role is to help MMC employees quickly find and understand company policies, HR guidelines, and workplace rules.

// COMPANY OVERVIEW:
// - Mega Motor Company (MMC) is the official BYD electric vehicle distributor in Pakistan
// - Headquartered in Pakistan, operating nationwide dealership and service network
// - Part of a growing EV industry with a focus on professionalism and compliance

// HR & WORKPLACE POLICIES:
// 1. LEAVE POLICY:
//    - Annual Leave: 14 days per year (pro-rated for new joiners)
//    - Sick Leave: 10 days per year with medical certificate required after 3 consecutive days
//    - Casual Leave: 5 days per year, max 2 consecutive days
//    - Maternity Leave: 12 weeks paid leave
//    - Paternity Leave: 3 days paid leave
//    - Leave requests must be submitted 3 days in advance (except emergencies)
//    - Leave approval is at line manager discretion

// 2. CODE OF CONDUCT:
//    - Professional behaviour expected at all times with colleagues, customers, and vendors
//    - Zero tolerance for harassment, discrimination, or bullying
//    - Confidential company information must not be shared externally
//    - Use of company assets (vehicles, equipment) is for official purposes only
//    - Social media posts about MMC or BYD must be pre-approved by communications team
//    - Conflicts of interest must be declared to HR immediately

// 3. PERFORMANCE & APPRAISAL:
//    - Annual performance reviews conducted every December
//    - Mid-year informal check-in in June
//    - KPIs set at start of year in agreement with line manager
//    - Performance Improvement Plans (PIPs) issued for sustained underperformance
//    - Increment and bonus decisions based on annual review scores

// 4. PROCUREMENT & EXPENSE POLICY:
//    - All purchases above PKR 50,000 require 3 competitive quotations
//    - Purchases above PKR 500,000 require formal tender process (PPRA guidelines apply)
//    - Expense claims must be submitted within 7 days with original receipts
//    - Travel advances require CFO approval
//    - No personal expenses on company credit cards

// 5. IT & DATA SECURITY:
//    - All devices must have approved antivirus installed
//    - Company data must not be stored on personal devices or personal cloud accounts
//    - Passwords must be changed every 90 days — minimum 8 characters
//    - Suspicious emails must be reported to IT immediately
//    - Use of MMC AI Suite tools is governed by the AI Usage Policy

// 6. AI USAGE POLICY:
//    - MMC AI Suite tools are approved for official use only
//    - Employees must not input customer personal data into AI tools
//    - AI-generated content must be reviewed by a human before sending externally
//    - API keys and system credentials must not be shared

// 7. VEHICLE & SHOWROOM POLICY:
//    - Test drive vehicles require customer to show valid driving licence
//    - Demo vehicles are for customer demonstrations only — not personal use
//    - Showroom dress code: formal attire, MMC-branded uniform where issued
//    - Customer complaints must be logged in CRM within 24 hours

// 8. GRIEVANCE & DISCIPLINARY:
//    - Raise grievances in writing to HR within 30 days of incident
//    - First written warning → Final written warning → Termination (progressive discipline)
//    - Serious misconduct (theft, fraud, violence) may result in immediate termination
//    - Appeals must be submitted within 5 working days of decision

// CONTACT DIRECTORY:
// - HR queries: hr@mmc.ai
// - IT support: it@mmc.ai
// - General support: support@mmc.ai
// - Procurement: procurement@mmc.ai

// RULES:
// - Only answer questions related to MMC company policies, HR matters, and workplace guidelines
// - If asked something outside policy scope, say: "That falls outside policy scope. Please contact support@mmc.ai or your line manager."
// - Be concise, clear, and employee-friendly
// - Always cite which policy section you are referencing
// - Never invent policies not listed above
// - Remind employees that policies may be updated — check with HR for the latest version`;

// // ─── AZURE DOCUMENT INTELLIGENCE — extract text from any file buffer ──────────
// async function extractTextWithAzure(buffer, filename) {
//   const { docIntelEndpoint, docIntelKey } = await getSecrets();

//   if (!docIntelEndpoint || !docIntelKey) {
//     console.warn('⚠️ Azure Doc Intelligence not configured, skipping OCR');
//     return '[Azure Document Intelligence not configured]';
//   }

//   try {
//     // Submit the document for analysis
//     const submitRes = await fetch(
//       `${docIntelEndpoint}/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview`,
//       {
//         method: 'POST',
//         headers: {
//           'Content-Type':       'application/octet-stream',
//           'Ocp-Apim-Subscription-Key': docIntelKey
//         },
//         body: buffer
//       }
//     );

//     if (!submitRes.ok) {
//       const err = await submitRes.text();
//       console.error(`Doc Intel submit failed for ${filename}:`, err);
//       return `[OCR failed: ${submitRes.status}]`;
//     }

//     // Get the operation URL from response header
//     const operationUrl = submitRes.headers.get('Operation-Location');
//     if (!operationUrl) {
//       return '[OCR failed: no operation URL returned]';
//     }

//     // Poll until complete (max 30 seconds)
//     for (let i = 0; i < 15; i++) {
//       await new Promise(r => setTimeout(r, 2000)); // wait 2s between polls

//       const pollRes = await fetch(operationUrl, {
//         headers: { 'Ocp-Apim-Subscription-Key': docIntelKey }
//       });
//       const pollData = await pollRes.json();

//       if (pollData.status === 'succeeded') {
//         return pollData.analyzeResult?.content || '[No text extracted]';
//       }

//       if (pollData.status === 'failed') {
//         console.error(`Doc Intel failed for ${filename}:`, pollData.error);
//         return `[OCR failed: ${pollData.error?.message}]`;
//       }
//       // status === 'running' — keep polling
//     }

//     return '[OCR timed out after 30 seconds]';

//   } catch (err) {
//     console.error(`extractTextWithAzure error for ${filename}:`, err.message);
//     return `[OCR error: ${err.message}]`;
//   }
// }

// // ─── SHAREPOINT DOC FETCHING ──────────────────────────────────────────────────
// let cachedDocs      = null;
// let cacheLoadedAt   = null;
// const CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

// async function fetchSharePointDocs() {
//   // Return cache if still fresh
//   if (cachedDocs && cacheLoadedAt && (Date.now() - cacheLoadedAt < CACHE_TTL_MS)) {
//     console.log('✅ Returning cached SharePoint docs');
//     return cachedDocs;
//   }

//   console.log('🔄 Fetching fresh SharePoint docs...');

//   try {
//     const access_token = await getGraphToken();

//     const hostname = "bydmega.sharepoint.com";
//     const sitePath  = "/sites/AI";

//     const siteRes  = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
//       headers: { Authorization: 'Bearer ' + access_token }
//     });
//     const siteData = await siteRes.json();

//     if (!siteData.id) {
//       console.error('❌ Could not get SharePoint site ID:', siteData);
//       return [];
//     }

//     const internalSiteId = siteData.id;
//     const folderName     = "Project team 1";
//     const endpoint       = `https://graph.microsoft.com/v1.0/sites/${internalSiteId}/drive/root:/${encodeURIComponent(folderName)}:/children`;

//     const listRes  = await fetch(endpoint, { headers: { Authorization: 'Bearer ' + access_token } });
//     const listData = await listRes.json();

//     if (!listData.value) {
//       console.error('❌ No files found in SharePoint folder:', listData);
//       return [];
//     }

//     const allowedExtensions = ['.pdf', '.docx', '.txt', '.md', '.xlsx', '.rtf'];
//     const policyFiles = listData.value.filter(f =>
//       f.file && allowedExtensions.some(ext => f.name.toLowerCase().endsWith(ext))
//     );

//     if (policyFiles.length === 0) {
//       console.warn("⚠️ No matching files found inside 'Project team 1'");
//       return [];
//     }

//     const docs = await Promise.all(policyFiles.map(async f => {
//       try {
//         console.log(`📄 Processing: ${f.name}`);

//         const downloadUrl = f['@microsoft.graph.downloadUrl'] || f['@content.downloadUrl'];
//         if (!downloadUrl) return { name: f.name, text: '[No download URL]' };

//         const dr     = await fetch(downloadUrl, { headers: { Authorization: 'Bearer ' + access_token } });
//         const buffer = Buffer.from(await dr.arrayBuffer());

//         const ext = f.name.toLowerCase().split('.').pop();

//         let text = '';
//         if (['txt', 'md', 'rtf'].includes(ext)) {
//           // Plain text — read directly
//           text = buffer.toString('utf-8');
//         } else {
//           // PDF, DOCX, XLSX, or anything else — use Azure Doc Intelligence (handles OCR too)
//           text = await extractTextWithAzure(buffer, f.name);
//         }

//         console.log(`✅ Extracted ${text.length} chars from ${f.name}`);
//         return { name: f.name, text: text.substring(0, 20000) };

//       } catch (e) {
//         console.error(`❌ Error processing ${f.name}:`, e.message);
//         return { name: f.name, text: `[Error: ${e.message}]` };
//       }
//     }));

//     // Store in cache
//     cachedDocs    = docs;
//     cacheLoadedAt = Date.now();
//     console.log(`✅ Cached ${docs.length} docs from SharePoint`);
//     return docs;

//   } catch (err) {
//     console.error('❌ fetchSharePointDocs error:', err.message);
//     return [];
//   }
// }

// // ─── ROUTES ───────────────────────────────────────────────────────────────────
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'public', 'mmc-ai-suite-final.html'));
// });

// app.get('/api/sp-docs', async (req, res) => {
//   try {
//     const docs = await fetchSharePointDocs();
//     res.json({ docs });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Manual cache refresh endpoint (call this after updating docs on SharePoint)
// app.post('/api/refresh-docs', async (req, res) => {
//   cachedDocs    = null;
//   cacheLoadedAt = null;
//   try {
//     const docs = await fetchSharePointDocs();
//     res.json({ success: true, docsLoaded: docs.length });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });



// app.post('/api/send-report', upload.single('file'), async (req, res) => {
//   try {
//     const token = await getGraphToken();
//     const { email, subject, body } = req.body;

//     const graphBody = {
//       message: {
//         subject: subject || 'MMC Bid Analysis Report',
//         body: {
//           contentType: 'HTML',
//           content: body || 'Please find attached the bid analysis report.'
//         },
//         toRecipients: [{ emailAddress: { address: email } }],
//         attachments: [{
//           '@odata.type':  '#microsoft.graph.fileAttachment',
//           name:           req.file.originalname,
//           contentType:    'application/pdf',
//           contentBytes:   req.file.buffer.toString('base64')
//         }]
//       },
//       saveToSentItems: true
//     };

//     const response = await fetch(
//       `https://graph.microsoft.com/v1.0/users/${process.env.MAIL_SENDER}/sendMail`,
//       {
//         method:  'POST',
//         headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//         body:    JSON.stringify(graphBody)
//       }
//     );

//     if (!response.ok) {
//       const error = await response.text();
//       console.error(error);
//       return res.status(500).json({ success: false, error });
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// app.post('/api/chat', async (req, res) => {
//   try {
//     const { messages } = req.body;
//     const { anthropicKey, anthropicUrl } = await getSecrets();

//     // Uses cache — no network call if already loaded
//     const docs = await fetchSharePointDocs();
//     console.log('SharePoint Docs in use:', docs.length);

//     let dynamicSystemPrompt;

//     if (docs.length > 0) {
//       const docsText = docs.map(d => `\n\n=== POLICY DOCUMENT: ${d.name} ===\n${d.text}`).join('');
//       dynamicSystemPrompt = `You are the MMC Policy Assistant for Mega Motor Company (BYD Pakistan distributor).
// Answer employee HR and policy questions using ONLY the documents below.
// Always cite the document name and section. Be concise and employee-friendly.
// Outside scope: "Please contact hr@byd-mega.com or your line manager."
// Never invent policies not in the documents.

// LOADED POLICY DOCUMENTS (${docs.length} file(s) from SharePoint):${docsText}

// If a question isn't covered by these documents, say the policy may need clarification from HR.`;
//     } else {
//       // Fallback to hardcoded policies if SharePoint returned nothing
//       dynamicSystemPrompt = CB_SYSTEM;
//     }

//     const response = await fetch(anthropicUrl, {
//       method:  'POST',
//       headers: {
//         'Content-Type':      'application/json',
//         'x-api-key':         anthropicKey,
//         'anthropic-version': '2023-06-01'
//       },
//       body: JSON.stringify({
//         model:      'deepseek-v4-flash',
//         max_tokens: 1000,
//         system:     dynamicSystemPrompt,   // top-level system — correct for Anthropic API
//         messages:   messages.slice(-10)    // no system role in messages array
//       })
//     });

//     const data = await response.json();

//     if (data.error) {
//       console.error('API Error:', data.error);
//       return res.status(500).json({ error: data.error.message });
//     }

//     res.json(data);

//   } catch (err) {
//     console.error('/api/chat error:', err.message);
//     res.status(500).json({ error: err.message });
//   }
// });
