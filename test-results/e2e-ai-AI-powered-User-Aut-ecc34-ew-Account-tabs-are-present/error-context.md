# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e-ai.spec.js >> AI-powered User Authentication and Navigation >> AI should confirm Sign In and New Account tabs are present
- Location: tests\e2e-ai.spec.js:48:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/auth?tab=login
Call log:
  - navigating to "http://localhost:3000/auth?tab=login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { GoogleGenerativeAI } from '@google/generative-ai';
  3  | 
  4  | // Gemini helper — reads page text and asks a yes/no question about the page content.
  5  | // Returns "yes" on quota errors so tests don't fail just because the API limit is hit.
  6  | async function askGemini(page, question) {
  7  |   const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  8  |   if (!apiKey) {
  9  |     console.warn('GOOGLE_GEMINI_API_KEY missing — skipping AI assertion');
  10 |     return 'yes (skipped: no api key)';
  11 |   }
  12 | 
  13 |   const pageText = await page.innerText('body');
  14 |   const genAI = new GoogleGenerativeAI(apiKey);
  15 |   const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  16 | 
  17 |   try {
  18 |     const result = await model.generateContent(
  19 |       `Here is the text content of a web page:\n\n${pageText}\n\nQuestion: ${question}\nAnswer with just "yes" or "no", then a brief reason.`
  20 |     );
  21 |     const answer = result.response.text();
  22 |     console.log(`[Gemini AI] ${answer.trim()}`);
  23 |     return answer.toLowerCase();
  24 |   } catch (err) {
  25 |     // Quota exhausted or rate-limited — log and continue with Playwright assertions
  26 |     console.warn(`[Gemini AI] Skipped (${err.status ?? err.message})`);
  27 |     return 'yes (skipped: quota exceeded)';
  28 |   }
  29 | }
  30 | 
  31 | test.describe('AI-powered User Authentication and Navigation', () => {
  32 |   test('AI should confirm login form is visible', async ({ page }) => {
  33 |     await page.goto('http://localhost:3000/auth?tab=login');
  34 | 
  35 |     // Gemini reads the page and confirms the login form exists
  36 |     const answer = await askGemini(page, 'Is there a login form with username and password input fields visible on this page?');
  37 |     expect(answer).toContain('yes');
  38 | 
  39 |     // Playwright also confirms the elements exist
  40 |     await expect(page.getByLabel('Username')).toBeVisible();
  41 |     await expect(page.getByLabel('Password')).toBeVisible();
  42 |     await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
  43 |     await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  44 | 
  45 |     console.log('AI verified the login form successfully!');
  46 |   });
  47 | 
  48 |   test('AI should confirm Sign In and New Account tabs are present', async ({ page }) => {
> 49 |     await page.goto('http://localhost:3000/auth?tab=login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/auth?tab=login
  50 | 
  51 |     // Gemini verifies both tabs are described in the page content
  52 |     const answer = await askGemini(page, 'Are there two navigation tabs — one for signing in and one for creating a new account?');
  53 |     expect(answer).toContain('yes');
  54 | 
  55 |     // Playwright confirms tab switching works
  56 |     await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
  57 |     await expect(page.getByRole('tab', { name: /new account/i })).toBeVisible();
  58 |     await page.getByRole('tab', { name: /new account/i }).click();
  59 |     await expect(page.getByLabel('Email Address')).toBeVisible();
  60 | 
  61 |     console.log('AI confirmed tabs and switching works!');
  62 |   });
  63 | 
  64 |   test('AI should confirm registration form has correct fields', async ({ page }) => {
  65 |     await page.goto('http://localhost:3000/auth?tab=register');
  66 | 
  67 |     // Gemini reads the registration page and confirms the fields
  68 |     const answer = await askGemini(page, 'Is there a registration or sign-up form with fields for username, email address, and password?');
  69 |     expect(answer).toContain('yes');
  70 | 
  71 |     // Playwright confirms each field is actually present
  72 |     await expect(page.getByLabel('Username')).toBeVisible();
  73 |     await expect(page.getByLabel('Email Address')).toBeVisible();
  74 |     await expect(page.getByLabel('Password')).toBeVisible();
  75 |     await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  76 | 
  77 |     console.log('AI confirmed the registration form fields!');
  78 |   });
  79 | });
  80 | 
```