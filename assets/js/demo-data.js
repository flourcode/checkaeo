/* Bundled example scans for demo mode. Generated with the real analyzer from fixture pages; scores include illustrative AI familiarity.
   These are illustrative: quotabird.example is a fictional example site; the others use .example domains. */
window.CHECKAEO_DEMOS = {
 "quotabird": {
  "ok": true,
  "url": "https://quotabird.example/",
  "finalUrl": "https://quotabird.example/",
  "domain": "quotabird.example",
  "scannedAt": "2026-09-30T09:00:00.000Z",
  "score": 82,
  "grade": "B",
  "status": "Strong",
  "categories": {
   "access": {
    "name": "Access",
    "question": "Can AI reach this page?",
    "checks": [
     {
      "id": "https",
      "title": "Served over HTTPS",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The page loads securely over HTTPS."
     },
     {
      "id": "status",
      "title": "Page responds successfully",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "The server returned 200 OK in 412 ms."
     },
     {
      "id": "redirects",
      "title": "Redirect chain is short",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "No redirects."
     },
     {
      "id": "robots",
      "title": "robots.txt is present and sane",
      "weight": 8,
      "points": 8,
      "status": "pass",
      "detail": "robots.txt exists and does not block this page for general crawlers."
     },
     {
      "id": "ai-bots",
      "title": "AI search crawlers are allowed",
      "weight": 12,
      "points": 12,
      "status": "pass",
      "detail": "None of the answer-engine crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot) are blocked."
     },
     {
      "id": "noindex",
      "title": "Page is indexable",
      "weight": 14,
      "points": 14,
      "status": "pass",
      "detail": "No noindex directive in meta tags or headers."
     },
     {
      "id": "sitemap",
      "title": "Sitemap is discoverable",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "A sitemap was found (via robots.txt or /sitemap.xml)."
     },
     {
      "id": "rendered",
      "title": "Meaningful text in the HTML",
      "weight": 14,
      "points": 7,
      "status": "warn",
      "detail": "Only about 149 words are in the raw HTML."
     },
     {
      "id": "speed",
      "title": "Responds quickly",
      "weight": 4,
      "points": 4,
      "status": "pass",
      "detail": "Time to fetch the HTML: 412 ms."
     },
     {
      "id": "canonical",
      "title": "Canonical URL is set",
      "weight": 6,
      "points": 3.9,
      "status": "warn",
      "detail": "No canonical link. Not required, but it removes ambiguity when the same page exists at several URLs."
     }
    ],
    "score": 91,
    "gate": null,
    "grade": "A",
    "label": "Reachable"
   },
   "clarity": {
    "name": "Clarity",
    "question": "Can a machine tell what this site does?",
    "checks": [
     {
      "id": "title",
      "title": "Descriptive page title",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Title: \"Quotabird – Free sales tools for reps and managers\"",
      "evidence": "Quotabird – Free sales tools for reps and managers"
     },
     {
      "id": "description",
      "title": "Meta description explains the page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Description: \"Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close fast…\"",
      "evidence": "Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
     },
     {
      "id": "h1",
      "title": "Clear main heading (H1)",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "H1: \"Free sales tools for sales reps and managers\"",
      "evidence": "Free sales tools for sales reps and managers"
     },
     {
      "id": "sitename",
      "title": "Site or brand name is identifiable",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The site name appears to be \"Quotabird\" (from og:site_name / structured data)."
     },
     {
      "id": "purpose",
      "title": "Plain-English statement of what the site does",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "Near the top, the page says: \"Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\"",
      "evidence": "Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
     },
     {
      "id": "audience",
      "title": "Audience is stated",
      "weight": 8,
      "points": 8,
      "status": "pass",
      "detail": "The page says who it is for: \"sales reps\"."
     },
     {
      "id": "headings",
      "title": "Headings outline the page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "3 headings, 2 of them H2s."
     },
     {
      "id": "semantic",
      "title": "Semantic HTML landmarks",
      "weight": 7,
      "points": 7,
      "status": "pass",
      "detail": "Uses main, nav, header and footer landmarks."
     },
     {
      "id": "nav",
      "title": "Descriptive navigation",
      "weight": 5,
      "points": 5,
      "status": "pass",
      "detail": "5 of 5 navigation links use descriptive labels."
     }
    ],
    "score": 100,
    "grade": "A",
    "label": "Clear"
   },
   "answers": {
    "name": "Answers",
    "question": "Does the page answer questions directly?",
    "checks": [
     {
      "id": "answer-first",
      "title": "Opens with a direct answer",
      "weight": 25,
      "points": 25,
      "status": "pass",
      "detail": "The first paragraph is a 25-word direct statement — easy to quote.",
      "evidence": "Quotabird is a collection of free tools that help sales reps and managers write better quotes, track follow-ups, and close deals faster without a CRM."
     },
     {
      "id": "chunks",
      "title": "Self-contained paragraphs",
      "weight": 25,
      "points": 15,
      "status": "warn",
      "detail": "Only 3 paragraphs of 25–120 words. Most text is either fragments or walls."
     },
     {
      "id": "depth",
      "title": "Enough substance to answer from",
      "weight": 15,
      "points": 3,
      "status": "fail",
      "detail": "About 149 words of visible text — thin. Engines need enough material to answer a question."
     },
     {
      "id": "concise",
      "title": "Concise sentences",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Average sentence length is 17 words."
     },
     {
      "id": "lists",
      "title": "Scannable lists",
      "weight": 10,
      "points": 3.5,
      "status": "fail",
      "detail": "No lists with three or more items. Not required; steps, options and features usually read best as lists."
     },
     {
      "id": "question-headings",
      "title": "Question-shaped headings",
      "weight": 6,
      "points": 4.5,
      "status": "warn",
      "detail": "1 heading phrased as a question, e.g. \"What is Quotabird?\"."
     },
     {
      "id": "faq",
      "title": "Q&A content",
      "weight": 5,
      "points": 3,
      "status": "warn",
      "detail": "No Q&A content found. Not inherently a problem. If customers commonly ask specific questions about this page’s topic, answering them directly can make the content easier to extract."
     },
     {
      "id": "definitions",
      "title": "Defines its key terms",
      "weight": 4,
      "points": 4,
      "status": "pass",
      "detail": "2 definition-style sentences (\"X is a…\")."
     }
    ],
    "score": 68,
    "grade": "D",
    "label": "Could answer more directly"
   },
   "trust": {
    "name": "Trust",
    "question": "Is there enough context to cite it?",
    "checks": [
     {
      "id": "about",
      "title": "About page is linked",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "An About page is linked."
     },
     {
      "id": "contact",
      "title": "Contact path exists",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "A contact link, email or phone number is present."
     },
     {
      "id": "identity",
      "title": "Organization identity is stated",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Structured data identifies \"Quotabird\" as the organization."
     },
     {
      "id": "schema",
      "title": "Structured data (JSON-LD)",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Found Organization, WebSite structured data."
     },
     {
      "id": "dates",
      "title": "Freshness signals",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "No visible date or dateModified. Optional for a homepage, important for articles."
     },
     {
      "id": "author",
      "title": "People behind the content",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "No author or byline. Optional for a business homepage, important for guides and articles."
     },
     {
      "id": "references",
      "title": "Links out to sources or profiles",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "2 outbound links."
     },
     {
      "id": "legal",
      "title": "Privacy or terms page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Privacy or terms page is linked."
     }
    ],
    "score": 90,
    "grade": "A",
    "label": "Well sourced"
   }
  },
  "whatAiSees": {
   "siteName": "Quotabird",
   "purpose": "Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.",
   "source": "meta description",
   "verbatim": true,
   "audience": "sales reps",
   "topics": [
    "What is Quotabird",
    "Pricing"
   ],
   "confidence": "high",
   "unclear": false,
   "summary": "Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
  },
  "fixes": [
   {
    "id": "chunks",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 2.5,
    "title": "Write self-contained paragraphs",
    "why": "Most of your text is either one-line fragments or long blocks. Paragraphs of 25–120 words that make sense on their own are what gets quoted.",
    "effort": "Medium",
    "evidence": "Moderate",
    "action": {
     "label": "How to do it",
     "kind": "text",
     "content": "For each section: one heading, then one paragraph that could stand alone if copied out. Name the subject in the first sentence instead of using \"it\" or \"this\"."
    }
   },
   {
    "id": "rendered",
    "category": "access",
    "categoryName": "Access",
    "impact": 2.1,
    "title": "Give the homepage real text",
    "why": "About 149 words are visible. There is very little for an AI system to read, let alone quote.",
    "effort": "Medium",
    "evidence": "Strong",
    "action": {
     "label": "What to add",
     "kind": "text",
     "content": "Add short sections that answer: what it is, who it is for, how it works, what it costs. Aim for 300–800 words of real information, in HTML paragraphs rather than images."
    }
   },
   {
    "id": "lists",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 1.6,
    "title": "Turn steps and options into lists",
    "why": "Where content is naturally a sequence or a set of options, a list is easier to extract and to scan.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Example",
     "kind": "code",
     "content": "<h2>How it works</h2>\n<ol>\n  <li>[Step one]</li>\n  <li>[Step two]</li>\n  <li>[Step three]</li>\n</ol>"
    }
   }
  ],
  "moreFixes": [
   {
    "id": "dates",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 1,
    "title": "Show when content was last updated",
    "why": "Engines prefer fresh sources. Optional for a homepage, important for articles and guides.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Example",
     "kind": "code",
     "content": "<p>Last updated <time datetime=\"2026-09-30\">September 30, 2026</time></p>"
    }
   },
   {
    "id": "author",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 1,
    "title": "Name the people behind the content",
    "why": "Bylines and author pages let engines judge expertise. Optional for a business homepage.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Example",
     "kind": "code",
     "content": "<p>By <a href=\"/about/\">[Name]</a>, [role] at Quotabird</p>"
    }
   },
   {
    "id": "faq",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 0.5,
    "title": "Answer common questions directly",
    "why": "Not required. If customers ask the same few questions about this page’s topic, three to six short, direct answers give engines ready-made quotes.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Show FAQ markup",
     "kind": "code",
     "content": "<section>\n  <h2>Questions people ask</h2>\n  <h3>What is Quotabird?</h3>\n  <p>[Two-sentence answer.]</p>\n  <h3>Who is it for?</h3>\n  <p>[Two-sentence answer.]</p>\n</section>\n\n<script type=\"application/ld+json\">\n{ \"@context\": \"https://schema.org\", \"@type\": \"FAQPage\", \"mainEntity\": [\n  { \"@type\": \"Question\", \"name\": \"What is Quotabird?\", \"acceptedAnswer\": { \"@type\": \"Answer\", \"text\": \"[answer]\" } }\n] }\n</script>"
    }
   },
   {
    "id": "question-headings",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 0.4,
    "title": "Consider phrasing a heading or two as questions",
    "why": "Only where a section genuinely answers a question people ask. \"What does it cost?\" followed by a direct answer is easy to extract; do not retrofit every heading.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Show example headings",
     "kind": "text",
     "content": "• What is Quotabird?\n• Who is it for?\n• How does it work?\n• What does it cost?\n• How is it different from [alternative]?"
    }
   }
  ],
  "extras": [
   {
    "id": "llms-txt",
    "title": "llms.txt",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "No /llms.txt. It is an emerging, optional convention — nice to have, not scored."
   },
   {
    "id": "lang",
    "title": "Language declared",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "<html lang=\"en\">"
   },
   {
    "id": "size",
    "title": "HTML size",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "2 KB of HTML."
   }
  ],
  "meta": {
   "title": "Quotabird – Free sales tools for reps and managers",
   "description": "Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.",
   "h1": [
    "Free sales tools for sales reps and managers"
   ],
   "wordCount": 149,
   "httpStatus": 200,
   "fetchMs": 412,
   "redirectCount": 0,
   "lang": "en",
   "ldTypes": [
    "Organization",
    "WebSite"
   ]
  },
  "demo": true,
  "readiness": 87,
  "familiarity": {
   "score": 65,
   "known": true,
   "level": "Known",
   "id": "Q0",
   "label": "Quotabird",
   "description": "sales software company (example)",
   "sitelinks": 9
  },
  "aiFiles": {
   "files": [
    {
     "id": "llms",
     "name": "llms.txt",
     "path": "/llms.txt",
     "status": "missing",
     "issues": [],
     "what": "A Markdown index of your site for AI tools: who you are in one line, and links to the pages that matter.",
     "install": "Save as llms.txt in your site's root folder so it loads at https://quotabird.example/llms.txt, served as text/plain.",
     "generated": "# Quotabird\n\n> Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\n\n## Pages\n\n- [Quota calculator](https://quotabird.example/quota-calculator)\n- [Deal checker](https://quotabird.example/deal-checker)\n- [Pricing](https://quotabird.example/pricing)\n- [About](https://quotabird.example/about)\n- [Contact](https://quotabird.example/contact)\n- [How to set sales quotas](https://quotabird.example/blog/how-to-set-sales-quotas)\n- [Commission plans explained](https://quotabird.example/blog/commission-plans-explained)\n\n## Optional\n\n- [Sitemap](https://quotabird.example/sitemap.xml)\n",
     "filename": "llms.txt",
     "lang": "markdown"
    },
    {
     "id": "jsonld",
     "name": "Structured data",
     "path": "<head>",
     "status": "ok",
     "issues": [],
     "notes": [
      "The Organization has no \"logo\".",
      "No \"sameAs\" links to official profiles (LinkedIn, Wikipedia, etc.).",
      "No WebSite entity."
     ],
     "hasOrg": true,
     "what": "Organization and WebSite JSON-LD: tells AI systems and search engines exactly who runs this site.",
     "install": "Paste into the <head> of your homepage, or your theme’s header template. Replace anything in [brackets].",
     "generated": "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@graph\": [\n    {\n      \"@type\": \"Organization\",\n      \"@id\": \"https://quotabird.example/#organization\",\n      \"name\": \"Quotabird\",\n      \"url\": \"https://quotabird.example/\",\n      \"description\": \"Quotabird is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\",\n      \"logo\": \"https://quotabird.example/[path-to-your-logo.png]\",\n      \"sameAs\": [\n        \"https://www.linkedin.com/company/quotabird\"\n      ]\n    },\n    {\n      \"@type\": \"WebSite\",\n      \"@id\": \"https://quotabird.example/#website\",\n      \"name\": \"Quotabird\",\n      \"url\": \"https://quotabird.example/\",\n      \"publisher\": {\n        \"@id\": \"https://quotabird.example/#organization\"\n      }\n    }\n  ]\n}\n</script>\n",
     "filename": "organization.jsonld.html",
     "lang": "html"
    },
    {
     "id": "robots",
     "name": "robots.txt rules",
     "path": "/robots.txt",
     "status": "ok",
     "issues": [],
     "notes": [
      "No explicit rules for AI crawlers. They fall back to your general rules; explicit rules make your choice clear and easy to change."
     ],
     "blockedSearch": [],
     "blockedTraining": [],
     "what": "Explicit rules for AI crawlers: answer engines allowed, training crawlers your choice.",
     "install": "Add this block to the end of your existing robots.txt. Don’t replace the file.",
     "generated": "# --- AI crawlers (added with Aeoden) ---\n# Answer and citation crawlers: keep these allowed to appear in AI answers.\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: Claude-SearchBot\nUser-agent: Claude-User\nUser-agent: PerplexityBot\nUser-agent: Perplexity-User\nAllow: /\n\n# Training crawlers: your choice. Currently allowed.\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: Google-Extended\nUser-agent: CCBot\nUser-agent: Applebot-Extended\nAllow: /\n\nSitemap: https://quotabird.example/sitemap.xml\n",
     "filename": "robots-ai.txt",
     "lang": "text"
    },
    {
     "id": "catalog",
     "name": "ai-catalog.json",
     "path": "/.well-known/ai-catalog.json",
     "status": "optional",
     "issues": [],
     "what": "Agentic Resource Discovery (ARD) catalog: lists the agent resources your domain offers (MCP servers, A2A agents, skills). A draft standard, announced June 2026.",
     "install": "Save as ai-catalog.json inside a .well-known folder at your site root, so it loads at https://quotabird.example/.well-known/ai-catalog.json, served as application/ai-catalog+json or application/json.",
     "generated": "{\n  \"specVersion\": \"1.0\",\n  \"host\": {\n    \"displayName\": \"Quotabird\",\n    \"identifier\": \"quotabird.example\"\n  },\n  \"entries\": []\n}\n",
     "template": "{\n  \"identifier\": \"urn:air:quotabird.example:mcp:[name]\",\n  \"type\": \"application/mcp-server-card+json\",\n  \"url\": \"https://quotabird.example/[path-to-your-mcp-server-card]\"\n}",
     "filename": "ai-catalog.json",
     "lang": "json",
     "optionalNote": "Optional. Only needed if you offer an API, MCP server, or AI agent. An empty catalog is valid and simply names you as the publisher."
    }
   ],
   "ready": 2,
   "total": 3
  }
 },
 "harborandoak": {
  "ok": true,
  "url": "https://harborandoak.example/",
  "finalUrl": "https://harborandoak.example/",
  "domain": "harborandoak.example",
  "scannedAt": "2026-09-30T09:00:00.000Z",
  "score": 47,
  "grade": "F",
  "status": "Hard to understand",
  "categories": {
   "access": {
    "name": "Access",
    "question": "Can AI reach this page?",
    "checks": [
     {
      "id": "https",
      "title": "Served over HTTPS",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The page loads securely over HTTPS."
     },
     {
      "id": "status",
      "title": "Page responds successfully",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "The server returned 200 OK in 1180 ms."
     },
     {
      "id": "redirects",
      "title": "Redirect chain is short",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "1 redirect before the final page."
     },
     {
      "id": "robots",
      "title": "robots.txt is present and sane",
      "weight": 8,
      "points": 5.2,
      "status": "warn",
      "detail": "No robots.txt was found. That is allowed, but a simple one signals intent and points to your sitemap."
     },
     {
      "id": "ai-bots",
      "title": "AI search crawlers are allowed",
      "weight": 12,
      "points": 12,
      "status": "pass",
      "detail": "None of the answer-engine crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot) are blocked."
     },
     {
      "id": "noindex",
      "title": "Page is indexable",
      "weight": 14,
      "points": 14,
      "status": "pass",
      "detail": "No noindex directive in meta tags or headers."
     },
     {
      "id": "sitemap",
      "title": "Sitemap is discoverable",
      "weight": 6,
      "points": 3,
      "status": "warn",
      "detail": "No sitemap was found in robots.txt or at /sitemap.xml. Sitemaps help crawlers find every page, not just the homepage."
     },
     {
      "id": "rendered",
      "title": "Meaningful text in the HTML",
      "weight": 14,
      "points": 7,
      "status": "warn",
      "detail": "Only about 88 words are in the raw HTML."
     },
     {
      "id": "speed",
      "title": "Responds quickly",
      "weight": 4,
      "points": 4,
      "status": "pass",
      "detail": "Time to fetch the HTML: 1180 ms."
     },
     {
      "id": "canonical",
      "title": "Canonical URL is set",
      "weight": 6,
      "points": 3.9,
      "status": "warn",
      "detail": "No canonical link. Not required, but it removes ambiguity when the same page exists at several URLs."
     }
    ],
    "score": 85,
    "gate": null,
    "grade": "B",
    "label": "Mostly reachable"
   },
   "clarity": {
    "name": "Clarity",
    "question": "Can a machine tell what this site does?",
    "checks": [
     {
      "id": "title",
      "title": "Descriptive page title",
      "weight": 15,
      "points": 7.5,
      "status": "warn",
      "detail": "The title \"Harbor & Oak\" is short. Include what the site is or does.",
      "evidence": "Harbor & Oak"
     },
     {
      "id": "description",
      "title": "Meta description explains the page",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "The meta description is very short.",
      "evidence": "Harbor & Oak. Est. 2014. Visit us in Portland."
     },
     {
      "id": "h1",
      "title": "Clear main heading (H1)",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "H1: \"Crafted with care, served with love\"",
      "evidence": "Crafted with care, served with love"
     },
     {
      "id": "sitename",
      "title": "Site or brand name is identifiable",
      "weight": 10,
      "points": 7,
      "status": "warn",
      "detail": "The site name appears to be \"Harbor & Oak\" (from the page title). Adding og:site_name or Organization structured data makes this explicit."
     },
     {
      "id": "purpose",
      "title": "Plain-English statement of what the site does",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "Near the top, the page says: \"We host private events and pop-up dinners throughout the year.\"",
      "evidence": "We host private events and pop-up dinners throughout the year."
     },
     {
      "id": "audience",
      "title": "Audience is stated",
      "weight": 8,
      "points": 2.8,
      "status": "fail",
      "detail": "The page does not clearly say who it is for. \"For X\" phrasing helps engines match you to the right questions."
     },
     {
      "id": "headings",
      "title": "Headings outline the page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "4 headings, 3 of them H2s."
     },
     {
      "id": "semantic",
      "title": "Semantic HTML landmarks",
      "weight": 7,
      "points": 0,
      "status": "fail",
      "detail": "Landmarks present: none. Landmarks tell parsers which part is the content."
     },
     {
      "id": "nav",
      "title": "Descriptive navigation",
      "weight": 5,
      "points": 2,
      "status": "fail",
      "detail": "No <nav> links found."
     }
    ],
    "score": 69,
    "grade": "D",
    "label": "Somewhat vague"
   },
   "answers": {
    "name": "Answers",
    "question": "Does the page answer questions directly?",
    "checks": [
     {
      "id": "answer-first",
      "title": "Opens with a direct answer",
      "weight": 25,
      "points": 10,
      "status": "fail",
      "detail": "The first paragraph is short or not a statement. Start with the answer to \"what is this?\"",
      "evidence": "A neighborhood favorite since 2014."
     },
     {
      "id": "chunks",
      "title": "Self-contained paragraphs",
      "weight": 25,
      "points": 8.75,
      "status": "fail",
      "detail": "Only 1 paragraph of 25–120 words. Most text is either fragments or walls."
     },
     {
      "id": "depth",
      "title": "Enough substance to answer from",
      "weight": 15,
      "points": 3,
      "status": "fail",
      "detail": "About 88 words of visible text — thin. Engines need enough material to answer a question."
     },
     {
      "id": "concise",
      "title": "Concise sentences",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Average sentence length is 11 words."
     },
     {
      "id": "lists",
      "title": "Scannable lists",
      "weight": 10,
      "points": 7,
      "status": "warn",
      "detail": "1 list with three or more items."
     },
     {
      "id": "question-headings",
      "title": "Question-shaped headings",
      "weight": 6,
      "points": 1.5,
      "status": "fail",
      "detail": "No headings phrased as questions. Optional: where a section answers a question people actually ask, a question heading makes the match explicit."
     },
     {
      "id": "faq",
      "title": "Q&A content",
      "weight": 5,
      "points": 1.5,
      "status": "fail",
      "detail": "No Q&A content found. Not inherently a problem. If customers commonly ask specific questions about this page’s topic, answering them directly can make the content easier to extract."
     },
     {
      "id": "definitions",
      "title": "Defines its key terms",
      "weight": 4,
      "points": 1.2,
      "status": "fail",
      "detail": "No definition-style sentences. Optional: one plain \"X is a …\" sentence for your product or key term is easy to quote, but do not force it."
     }
    ],
    "score": 43,
    "grade": "F",
    "label": "Few direct answers"
   },
   "trust": {
    "name": "Trust",
    "question": "Is there enough context to cite it?",
    "checks": [
     {
      "id": "about",
      "title": "About page is linked",
      "weight": 15,
      "points": 0,
      "status": "fail",
      "detail": "No link to an About page. Engines use it to establish who is behind the site."
     },
     {
      "id": "contact",
      "title": "Contact path exists",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "A contact link, email or phone number is present."
     },
     {
      "id": "identity",
      "title": "Organization identity is stated",
      "weight": 15,
      "points": 12,
      "status": "warn",
      "detail": "A copyright line names \"Harbor & Oak Instagram\" and an address is listed."
     },
     {
      "id": "schema",
      "title": "Structured data (JSON-LD)",
      "weight": 15,
      "points": 1.5,
      "status": "fail",
      "detail": "No JSON-LD structured data. Optional, but Organization or WebSite schema is a cheap, unambiguous way to state who you are."
     },
     {
      "id": "dates",
      "title": "Freshness signals",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "No visible date or dateModified. Optional for a homepage, important for articles."
     },
     {
      "id": "author",
      "title": "People behind the content",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "No author or byline. Optional for a business homepage, important for guides and articles."
     },
     {
      "id": "references",
      "title": "Links out to sources or profiles",
      "weight": 10,
      "points": 2,
      "status": "fail",
      "detail": "No outbound links or social profiles. Pages that exist in isolation are harder to corroborate."
     },
     {
      "id": "legal",
      "title": "Privacy or terms page",
      "weight": 10,
      "points": 3,
      "status": "fail",
      "detail": "No privacy or terms link. A small but consistent credibility signal."
     }
    ],
    "score": 44,
    "grade": "F",
    "label": "Little context"
   }
  },
  "whatAiSees": {
   "siteName": "Harbor & Oak",
   "purpose": "We host private events and pop-up dinners throughout the year.",
   "source": "opening text",
   "verbatim": true,
   "audience": null,
   "topics": [
    "Events",
    "Visit"
   ],
   "confidence": "medium",
   "unclear": false,
   "summary": "Appears to be about: We host private events and pop-up dinners throughout the year."
  },
  "fixes": [
   {
    "id": "chunks",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 4.1,
    "title": "Write self-contained paragraphs",
    "why": "Most of your text is either one-line fragments or long blocks. Paragraphs of 25–120 words that make sense on their own are what gets quoted.",
    "effort": "Medium",
    "evidence": "Moderate",
    "action": {
     "label": "How to do it",
     "kind": "text",
     "content": "For each section: one heading, then one paragraph that could stand alone if copied out. Name the subject in the first sentence instead of using \"it\" or \"this\"."
    }
   },
   {
    "id": "answer-first",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 3.8,
    "title": "Open with a direct answer",
    "why": "Answer engines quote the first clean, self-contained paragraph. Yours is missing, too short, or too long.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Draft an answer-first paragraph",
     "kind": "code",
     "content": "<p>Harbor & Oak is [a / an] [category] that [does what] for [who]. [One sentence on how it works or what makes it different.]</p>\n\n<!-- Your clearest existing sentence: \"We host private events and pop-up dinners throughout the year.\"\n     Rewrite it so it starts with Harbor & Oak and says what it is. -->"
    }
   },
   {
    "id": "about",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 3,
    "title": "Link to an About page",
    "why": "Engines look for who is behind a site before treating it as a source.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "What to include",
     "kind": "text",
     "content": "Create /about/ with: who runs Harbor & Oak, since when, where you are based, and how to reach you. Link it from the header or footer."
    }
   }
  ],
  "moreFixes": [
   {
    "id": "schema",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 2.7,
    "title": "Add Organization and WebSite structured data",
    "why": "Optional, but JSON-LD is an unambiguous way to state your name, logo and official links to engines that read it.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Show JSON-LD",
     "kind": "code",
     "content": "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@graph\": [\n    { \"@type\": \"Organization\", \"name\": \"Harbor & Oak\", \"url\": \"https://harborandoak.example/\", \"logo\": \"https://harborandoak.example/[logo.png]\",\n      \"sameAs\": [\"https://instagram.com/harborandoak\"] },\n    { \"@type\": \"WebSite\", \"name\": \"Harbor & Oak\", \"url\": \"https://harborandoak.example/\" }\n  ]\n}\n</script>"
    }
   },
   {
    "id": "rendered",
    "category": "access",
    "categoryName": "Access",
    "impact": 2.1,
    "title": "Give the homepage real text",
    "why": "About 88 words are visible. There is very little for an AI system to read, let alone quote.",
    "effort": "Medium",
    "evidence": "Strong",
    "action": {
     "label": "What to add",
     "kind": "text",
     "content": "Add short sections that answer: what it is, who it is for, how it works, what it costs. Aim for 300–800 words of real information, in HTML paragraphs rather than images."
    }
   },
   {
    "id": "title",
    "category": "clarity",
    "categoryName": "Clarity",
    "impact": 1.9,
    "title": "Rewrite the page title",
    "why": "The title is \"Harbor & Oak\". It should name the site and what it does.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Suggest a title",
     "kind": "code",
     "content": "<title>Harbor & Oak – We host private events and pop-up dinners th…</title>"
    }
   },
   {
    "id": "semantic",
    "category": "clarity",
    "categoryName": "Clarity",
    "impact": 1.8,
    "title": "Add semantic landmarks",
    "why": "main, nav, header and footer tell parsers which part is the content and which is chrome.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Show the structure",
     "kind": "code",
     "content": "<header>…logo and <nav>…</nav></header>\n<main>\n  <h1>…</h1>\n  …page content…\n</main>\n<footer>…</footer>"
    }
   },
   {
    "id": "references",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 1.6,
    "title": "Link to your profiles and sources",
    "why": "Pages with no outbound links are harder to corroborate. Social profiles and sources you cite both help.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "What to add",
     "kind": "text",
     "content": "Link your official profiles (LinkedIn, GitHub, X, etc.) in the footer and in Organization sameAs. When you state facts or numbers, link the source."
    }
   }
  ],
  "extras": [
   {
    "id": "llms-txt",
    "title": "llms.txt",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "No /llms.txt. It is an emerging, optional convention — nice to have, not scored."
   },
   {
    "id": "lang",
    "title": "Language declared",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "<html lang=\"en\">"
   },
   {
    "id": "size",
    "title": "HTML size",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "1 KB of HTML."
   }
  ],
  "meta": {
   "title": "Harbor & Oak",
   "description": "Harbor & Oak. Est. 2014. Visit us in Portland.",
   "h1": [
    "Crafted with care, served with love"
   ],
   "wordCount": 88,
   "httpStatus": 200,
   "fetchMs": 1180,
   "redirectCount": 1,
   "lang": "en",
   "ldTypes": []
  },
  "demo": true,
  "readiness": 62,
  "familiarity": {
   "score": 0,
   "known": false,
   "level": "Not yet a known entity"
  },
  "aiFiles": {
   "files": [
    {
     "id": "llms",
     "name": "llms.txt",
     "path": "/llms.txt",
     "status": "fix",
     "issues": [
      "/llms.txt answers with a web page (probably your 404 page), not a Markdown file."
     ],
     "what": "A Markdown index of your site for AI tools: who you are in one line, and links to the pages that matter.",
     "install": "Save as llms.txt in your site's root folder so it loads at https://harborandoak.example/llms.txt, served as text/plain.",
     "generated": "# Harbor & Oak\n\n> Harbor & Oak. Est. 2014. Visit us in Portland.\n\n## Pages\n\n- [Menu](https://harborandoak.example/menu)\n- [Events](https://harborandoak.example/events)\n- [Visit](https://harborandoak.example/visit)\n",
     "filename": "llms.txt",
     "lang": "markdown"
    },
    {
     "id": "jsonld",
     "name": "Structured data",
     "path": "<head>",
     "status": "missing",
     "issues": [],
     "notes": [],
     "what": "Organization and WebSite JSON-LD: tells AI systems and search engines exactly who runs this site.",
     "install": "Paste into the <head> of your homepage, or your theme’s header template. Replace anything in [brackets].",
     "generated": "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@graph\": [\n    {\n      \"@type\": \"Organization\",\n      \"@id\": \"https://harborandoak.example/#organization\",\n      \"name\": \"Harbor & Oak\",\n      \"url\": \"https://harborandoak.example/\",\n      \"description\": \"Harbor & Oak. Est. 2014. Visit us in Portland.\",\n      \"logo\": \"https://harborandoak.example/[path-to-your-logo.png]\",\n      \"sameAs\": [\n        \"https://www.instagram.com/harborandoak\"\n      ]\n    },\n    {\n      \"@type\": \"WebSite\",\n      \"@id\": \"https://harborandoak.example/#website\",\n      \"name\": \"Harbor & Oak\",\n      \"url\": \"https://harborandoak.example/\",\n      \"publisher\": {\n        \"@id\": \"https://harborandoak.example/#organization\"\n      }\n    }\n  ]\n}\n</script>\n",
     "filename": "organization.jsonld.html",
     "lang": "html"
    },
    {
     "id": "robots",
     "name": "robots.txt rules",
     "path": "/robots.txt",
     "status": "missing",
     "issues": [],
     "blockedSearch": [],
     "blockedTraining": [],
     "what": "Explicit rules for AI crawlers: answer engines allowed, training crawlers your choice.",
     "install": "Save as robots.txt in your site's root so it loads at https://harborandoak.example/robots.txt.",
     "generated": "# --- AI crawlers (added with Aeoden) ---\n# Answer and citation crawlers: keep these allowed to appear in AI answers.\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: Claude-SearchBot\nUser-agent: Claude-User\nUser-agent: PerplexityBot\nUser-agent: Perplexity-User\nAllow: /\n\n# Training crawlers: your choice. Currently allowed.\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: Google-Extended\nUser-agent: CCBot\nUser-agent: Applebot-Extended\nAllow: /\n",
     "filename": "robots-ai.txt",
     "lang": "text"
    },
    {
     "id": "catalog",
     "name": "ai-catalog.json",
     "path": "/.well-known/ai-catalog.json",
     "status": "optional",
     "issues": [],
     "what": "Agentic Resource Discovery (ARD) catalog: lists the agent resources your domain offers (MCP servers, A2A agents, skills). A draft standard, announced June 2026.",
     "install": "Save as ai-catalog.json inside a .well-known folder at your site root, so it loads at https://harborandoak.example/.well-known/ai-catalog.json, served as application/ai-catalog+json or application/json.",
     "generated": "{\n  \"specVersion\": \"1.0\",\n  \"host\": {\n    \"displayName\": \"Harbor & Oak\",\n    \"identifier\": \"harborandoak.example\"\n  },\n  \"entries\": []\n}\n",
     "template": "{\n  \"identifier\": \"urn:air:harborandoak.example:mcp:[name]\",\n  \"type\": \"application/mcp-server-card+json\",\n  \"url\": \"https://harborandoak.example/[path-to-your-mcp-server-card]\"\n}",
     "filename": "ai-catalog.json",
     "lang": "json",
     "optionalNote": "Optional. Only needed if you offer an API, MCP server, or AI agent. An empty catalog is valid and simply names you as the publisher."
    }
   ],
   "ready": 0,
   "total": 3
  }
 },
 "northwind": {
  "ok": true,
  "url": "https://northwind-tools.example/",
  "finalUrl": "https://northwind-tools.example/",
  "domain": "northwind-tools.example",
  "scannedAt": "2026-09-30T09:00:00.000Z",
  "score": 65,
  "grade": "D",
  "status": "Needs work",
  "categories": {
   "access": {
    "name": "Access",
    "question": "Can AI reach this page?",
    "checks": [
     {
      "id": "https",
      "title": "Served over HTTPS",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The page loads securely over HTTPS."
     },
     {
      "id": "status",
      "title": "Page responds successfully",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "The server returned 200 OK in 640 ms."
     },
     {
      "id": "redirects",
      "title": "Redirect chain is short",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "No redirects."
     },
     {
      "id": "robots",
      "title": "robots.txt is present and sane",
      "weight": 8,
      "points": 8,
      "status": "pass",
      "detail": "robots.txt exists and does not block this page for general crawlers."
     },
     {
      "id": "ai-bots",
      "title": "AI search crawlers are allowed",
      "weight": 12,
      "points": 0,
      "status": "fail",
      "detail": "robots.txt blocks OAI-SearchBot, PerplexityBot. These are the crawlers answer engines use to fetch pages for live answers.",
      "evidence": "Blocked: OAI-SearchBot, PerplexityBot"
     },
     {
      "id": "noindex",
      "title": "Page is indexable",
      "weight": 14,
      "points": 14,
      "status": "pass",
      "detail": "No noindex directive in meta tags or headers."
     },
     {
      "id": "sitemap",
      "title": "Sitemap is discoverable",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "A sitemap was found (via robots.txt or /sitemap.xml)."
     },
     {
      "id": "rendered",
      "title": "Meaningful text in the HTML",
      "weight": 14,
      "points": 14,
      "status": "pass",
      "detail": "The raw HTML contains about 263 words of visible text, so crawlers do not need to run JavaScript to read it."
     },
     {
      "id": "speed",
      "title": "Responds quickly",
      "weight": 4,
      "points": 4,
      "status": "pass",
      "detail": "Time to fetch the HTML: 640 ms."
     },
     {
      "id": "canonical",
      "title": "Canonical URL is set",
      "weight": 6,
      "points": 1.8,
      "status": "fail",
      "detail": "Canonical points to a different domain (quotabird.example). Engines may attribute this content there instead."
     }
    ],
    "score": 65,
    "gate": null,
    "grade": "D",
    "label": "Blocked"
   },
   "clarity": {
    "name": "Clarity",
    "question": "Can a machine tell what this site does?",
    "checks": [
     {
      "id": "title",
      "title": "Descriptive page title",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Title: \"Northwind Tools – Free sales tools for reps and managers\"",
      "evidence": "Northwind Tools – Free sales tools for reps and managers"
     },
     {
      "id": "description",
      "title": "Meta description explains the page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Description: \"Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and clos…\"",
      "evidence": "Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
     },
     {
      "id": "h1",
      "title": "Clear main heading (H1)",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "H1: \"Free sales tools for sales reps and managers\"",
      "evidence": "Free sales tools for sales reps and managers"
     },
     {
      "id": "sitename",
      "title": "Site or brand name is identifiable",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The site name appears to be \"Northwind Tools\" (from og:site_name / structured data)."
     },
     {
      "id": "purpose",
      "title": "Plain-English statement of what the site does",
      "weight": 20,
      "points": 20,
      "status": "pass",
      "detail": "Near the top, the page says: \"Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\"",
      "evidence": "Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
     },
     {
      "id": "audience",
      "title": "Audience is stated",
      "weight": 8,
      "points": 8,
      "status": "pass",
      "detail": "The page says who it is for: \"sales reps\"."
     },
     {
      "id": "headings",
      "title": "Headings outline the page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "7 headings, 5 of them H2s."
     },
     {
      "id": "semantic",
      "title": "Semantic HTML landmarks",
      "weight": 7,
      "points": 7,
      "status": "pass",
      "detail": "Uses main, nav, header and footer landmarks."
     },
     {
      "id": "nav",
      "title": "Descriptive navigation",
      "weight": 5,
      "points": 5,
      "status": "pass",
      "detail": "5 of 5 navigation links use descriptive labels."
     }
    ],
    "score": 100,
    "grade": "A",
    "label": "Clear"
   },
   "answers": {
    "name": "Answers",
    "question": "Does the page answer questions directly?",
    "checks": [
     {
      "id": "answer-first",
      "title": "Opens with a direct answer",
      "weight": 25,
      "points": 25,
      "status": "pass",
      "detail": "The first paragraph is a 26-word direct statement — easy to quote.",
      "evidence": "Northwind Tools is a collection of free tools that help sales reps and managers write better quotes, track follow-ups, and close deals faster without a CRM."
     },
     {
      "id": "chunks",
      "title": "Self-contained paragraphs",
      "weight": 25,
      "points": 25,
      "status": "pass",
      "detail": "5 paragraphs are the size (25–120 words) that answer engines lift cleanly."
     },
     {
      "id": "depth",
      "title": "Enough substance to answer from",
      "weight": 15,
      "points": 9,
      "status": "warn",
      "detail": "About 263 words of visible text — thin. Engines need enough material to answer a question."
     },
     {
      "id": "concise",
      "title": "Concise sentences",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Average sentence length is 19 words."
     },
     {
      "id": "lists",
      "title": "Scannable lists",
      "weight": 10,
      "points": 7,
      "status": "warn",
      "detail": "1 list with three or more items."
     },
     {
      "id": "question-headings",
      "title": "Question-shaped headings",
      "weight": 6,
      "points": 6,
      "status": "pass",
      "detail": "4 headings phrased as a question, e.g. \"What is Northwind Tools?\"."
     },
     {
      "id": "faq",
      "title": "Q&A content",
      "weight": 5,
      "points": 5,
      "status": "pass",
      "detail": "The page has Q&A content with FAQPage structured data."
     },
     {
      "id": "definitions",
      "title": "Defines its key terms",
      "weight": 4,
      "points": 4,
      "status": "pass",
      "detail": "2 definition-style sentences (\"X is a…\")."
     }
    ],
    "score": 91,
    "grade": "A",
    "label": "Answers directly"
   },
   "trust": {
    "name": "Trust",
    "question": "Is there enough context to cite it?",
    "checks": [
     {
      "id": "about",
      "title": "About page is linked",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "An About page is linked."
     },
     {
      "id": "contact",
      "title": "Contact path exists",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "A contact link, email or phone number is present."
     },
     {
      "id": "identity",
      "title": "Organization identity is stated",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Structured data identifies \"Northwind Tools\" as the organization."
     },
     {
      "id": "schema",
      "title": "Structured data (JSON-LD)",
      "weight": 15,
      "points": 15,
      "status": "pass",
      "detail": "Found Organization, WebSite, FAQPage structured data."
     },
     {
      "id": "dates",
      "title": "Freshness signals",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "The page carries a date (time element, \"updated\" text, or dateModified)."
     },
     {
      "id": "author",
      "title": "People behind the content",
      "weight": 10,
      "points": 5,
      "status": "warn",
      "detail": "No author or byline. Optional for a business homepage, important for guides and articles."
     },
     {
      "id": "references",
      "title": "Links out to sources or profiles",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "2 outbound links."
     },
     {
      "id": "legal",
      "title": "Privacy or terms page",
      "weight": 10,
      "points": 10,
      "status": "pass",
      "detail": "Privacy or terms page is linked."
     }
    ],
    "score": 95,
    "grade": "A",
    "label": "Well sourced"
   }
  },
  "whatAiSees": {
   "siteName": "Northwind Tools",
   "purpose": "Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.",
   "source": "meta description",
   "verbatim": true,
   "audience": "sales reps",
   "topics": [
    "What is Northwind Tools",
    "Who is it for",
    "How does it work",
    "Pricing"
   ],
   "confidence": "high",
   "unclear": false,
   "summary": "Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster."
  },
  "fixes": [
   {
    "id": "ai-bots",
    "category": "access",
    "categoryName": "Access",
    "impact": 3.6,
    "title": "Unblock OAI-SearchBot and PerplexityBot in robots.txt",
    "why": "These crawlers fetch pages for live answers. Blocking them means the answer engine cannot read your site, no matter how good the content is.",
    "effort": "Easy",
    "evidence": "Strong",
    "action": {
     "label": "Show robots.txt fix",
     "kind": "code",
     "content": "# robots.txt — allow answer-engine crawlers\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\n# Blocking training crawlers (GPTBot, ClaudeBot, Google-Extended) is a separate\n# decision and does not affect answer-engine access."
    }
   },
   {
    "id": "depth",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 1.5,
    "title": "Give the page more substance",
    "why": "About 263 words is thin. Engines cannot answer questions from content that is not there.",
    "effort": "Medium",
    "evidence": "Strong",
    "action": {
     "label": "What to add",
     "kind": "text",
     "content": "Add sections that answer: what it is, who it is for, how it works, what it costs, and how it compares. Aim for 300–800 words of real information on the homepage."
    }
   },
   {
    "id": "author",
    "category": "trust",
    "categoryName": "Trust",
    "impact": 1,
    "title": "Name the people behind the content",
    "why": "Bylines and author pages let engines judge expertise. Optional for a business homepage.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Example",
     "kind": "code",
     "content": "<p>By <a href=\"/about/\">[Name]</a>, [role] at Northwind Tools</p>"
    }
   }
  ],
  "moreFixes": [
   {
    "id": "lists",
    "category": "answers",
    "categoryName": "Answers",
    "impact": 0.8,
    "title": "Turn steps and options into lists",
    "why": "Where content is naturally a sequence or a set of options, a list is easier to extract and to scan.",
    "effort": "Easy",
    "evidence": "Moderate",
    "action": {
     "label": "Example",
     "kind": "code",
     "content": "<h2>How it works</h2>\n<ol>\n  <li>[Step one]</li>\n  <li>[Step two]</li>\n  <li>[Step three]</li>\n</ol>"
    }
   }
  ],
  "extras": [
   {
    "id": "llms-txt",
    "title": "llms.txt",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "No /llms.txt. It is an emerging, optional convention — nice to have, not scored."
   },
   {
    "id": "lang",
    "title": "Language declared",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "<html lang=\"en\">"
   },
   {
    "id": "training-bots",
    "title": "AI training crawlers",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "robots.txt blocks GPTBot. This opts out of model training and is not scored."
   },
   {
    "id": "size",
    "title": "HTML size",
    "weight": 0,
    "points": 0,
    "status": "info",
    "detail": "3 KB of HTML."
   }
  ],
  "meta": {
   "title": "Northwind Tools – Free sales tools for reps and managers",
   "description": "Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.",
   "h1": [
    "Free sales tools for sales reps and managers"
   ],
   "wordCount": 263,
   "httpStatus": 200,
   "fetchMs": 640,
   "redirectCount": 0,
   "lang": "en",
   "ldTypes": [
    "Organization",
    "WebSite",
    "FAQPage"
   ]
  },
  "demo": true,
  "readiness": 86,
  "familiarity": {
   "score": 0,
   "known": false,
   "level": "Not yet a known entity"
  },
  "aiFiles": {
   "files": [
    {
     "id": "llms",
     "name": "llms.txt",
     "path": "/llms.txt",
     "status": "ok",
     "issues": [],
     "notes": [],
     "links": 1,
     "what": "A Markdown index of your site for AI tools: who you are in one line, and links to the pages that matter.",
     "install": "Save as llms.txt in your site's root folder so it loads at https://northwind-tools.example/llms.txt, served as text/plain.",
     "generated": "# Northwind Tools\n\n> Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\n\n## Pages\n\n- [Products](https://northwind-tools.example/products)\n- [Quote builder](https://northwind-tools.example/quote-builder)\n- [Docs](https://northwind-tools.example/docs)\n- [Pricing](https://northwind-tools.example/pricing)\n- [Getting started](https://northwind-tools.example/docs/getting-started)\n- [Api](https://northwind-tools.example/docs/api)\n\n## Optional\n\n- [Sitemap](https://northwind-tools.example/sitemap.xml)\n",
     "filename": "llms.txt",
     "lang": "markdown"
    },
    {
     "id": "jsonld",
     "name": "Structured data",
     "path": "<head>",
     "status": "ok",
     "issues": [],
     "notes": [],
     "hasOrg": true,
     "what": "Organization and WebSite JSON-LD: tells AI systems and search engines exactly who runs this site.",
     "install": "Paste into the <head> of your homepage, or your theme’s header template. Replace anything in [brackets].",
     "generated": "<script type=\"application/ld+json\">\n{\n  \"@context\": \"https://schema.org\",\n  \"@graph\": [\n    {\n      \"@type\": \"Organization\",\n      \"@id\": \"https://northwind-tools.example/#organization\",\n      \"name\": \"Northwind Tools\",\n      \"url\": \"https://northwind-tools.example/\",\n      \"description\": \"Northwind Tools is a set of free sales tools that help sales reps and managers write quotes, track follow-ups, and close faster.\",\n      \"logo\": \"https://northwind-tools.example/[path-to-your-logo.png]\",\n      \"sameAs\": [\n        \"https://www.linkedin.com/company/northwind-tools\",\n        \"https://github.com/northwind-tools\"\n      ]\n    },\n    {\n      \"@type\": \"WebSite\",\n      \"@id\": \"https://northwind-tools.example/#website\",\n      \"name\": \"Northwind Tools\",\n      \"url\": \"https://northwind-tools.example/\",\n      \"publisher\": {\n        \"@id\": \"https://northwind-tools.example/#organization\"\n      }\n    }\n  ]\n}\n</script>\n",
     "filename": "organization.jsonld.html",
     "lang": "html"
    },
    {
     "id": "robots",
     "name": "robots.txt rules",
     "path": "/robots.txt",
     "status": "fix",
     "issues": [
      "Blocks AI answer crawlers: OAI-SearchBot, PerplexityBot. Those engines can't fetch your pages to answer or cite them."
     ],
     "notes": [
      "Add a \"Sitemap:\" line so crawlers find every page."
     ],
     "blockedSearch": [
      "OAI-SearchBot",
      "PerplexityBot"
     ],
     "blockedTraining": [],
     "what": "Explicit rules for AI crawlers: answer engines allowed, training crawlers your choice.",
     "install": "Add this block to the end of your existing robots.txt. Don’t replace the file.",
     "generated": "# --- AI crawlers (added with Aeoden) ---\n# Answer and citation crawlers: keep these allowed to appear in AI answers.\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: Claude-SearchBot\nUser-agent: Claude-User\nUser-agent: PerplexityBot\nUser-agent: Perplexity-User\nAllow: /\n\n# Training crawlers: your choice. Currently allowed.\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: Google-Extended\nUser-agent: CCBot\nUser-agent: Applebot-Extended\nAllow: /\n\nSitemap: https://northwind-tools.example/sitemap.xml\n",
     "filename": "robots-ai.txt",
     "lang": "text"
    },
    {
     "id": "catalog",
     "name": "ai-catalog.json",
     "path": "/.well-known/ai-catalog.json",
     "status": "fix",
     "issues": [],
     "notes": [
      "2 entries point to web pages (text/html). The catalog is for callable agent resources (MCP servers, A2A agents, skills); list web pages in llms.txt instead."
     ],
     "entryCount": 3,
     "htmlEntries": 2,
     "what": "Agentic Resource Discovery (ARD) catalog: lists the agent resources your domain offers (MCP servers, A2A agents, skills). A draft standard, announced June 2026.",
     "install": "Save as ai-catalog.json inside a .well-known folder at your site root, so it loads at https://northwind-tools.example/.well-known/ai-catalog.json, served as application/ai-catalog+json or application/json.",
     "generated": "{\n  \"specVersion\": \"1.0\",\n  \"host\": {\n    \"displayName\": \"Northwind Tools\",\n    \"identifier\": \"northwind-tools.example\"\n  },\n  \"entries\": [\n    {\n      \"identifier\": \"urn:air:northwind-tools.example:mcp:quotes\",\n      \"type\": \"application/mcp-server-card+json\",\n      \"url\": \"https://northwind-tools.example/mcp/server-card\"\n    }\n  ]\n}\n",
     "template": "{\n  \"identifier\": \"urn:air:northwind-tools.example:mcp:[name]\",\n  \"type\": \"application/mcp-server-card+json\",\n  \"url\": \"https://northwind-tools.example/[path-to-your-mcp-server-card]\"\n}",
     "filename": "ai-catalog.json",
     "lang": "json",
     "optionalNote": null
    }
   ],
   "ready": 2,
   "total": 3
  }
 }
};
