/* ============================================================
   CheckAEO configuration
   Edit these two values after deploying:
   1. SCAN_API_URL  — your deployed scanner URL (AWS Lambda Function URL or Cloudflare Worker).
                      Leave empty ('') to run the site in demo mode only.
   2. GA4_MEASUREMENT_ID — your Google Analytics 4 ID (e.g. 'G-XXXXXXXXXX').
                      Leave empty ('') to disable analytics entirely (no script is loaded).
   ============================================================ */
window.CHECKAEO_CONFIG = {
  SCAN_API_URL: 'https://6cu5wlvx2mylhy7xzdefy5bsya0ccmxb.lambda-url.us-east-1.on.aws',   // AWS Lambda Function URL (checkaeo-scan)
  GA4_MEASUREMENT_ID: '',                   // e.g. 'G-XXXXXXXXXX'
  SITE_URL: 'https://checkaeo.com',
  CALENDLY_URL: 'https://calendly.com/markflournoy/chat-with-mark',
  LINKEDIN_URL: 'https://www.linkedin.com/in/markflournoy/',
  SCAN_TIMEOUT_MS: 25000
};
