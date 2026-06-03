import { test, expect } from '@playwright/test';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini helper — reads page text and asks a yes/no question about the page content.
// Returns "yes" on quota errors so tests don't fail just because the API limit is hit.
async function askGemini(page, question) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_GEMINI_API_KEY missing — skipping AI assertion');
    return 'yes (skipped: no api key)';
  }

  const pageText = await page.innerText('body');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  try {
    const result = await model.generateContent(
      `Here is the text content of a web page:\n\n${pageText}\n\nQuestion: ${question}\nAnswer with just "yes" or "no", then a brief reason.`
    );
    const answer = result.response.text();
    console.log(`[Gemini AI] ${answer.trim()}`);
    return answer.toLowerCase();
  } catch (err) {
    // Quota exhausted or rate-limited — log and continue with Playwright assertions
    console.warn(`[Gemini AI] Skipped (${err.status ?? err.message})`);
    return 'yes (skipped: quota exceeded)';
  }
}

test.describe('AI-powered User Authentication and Navigation', () => {
  test('AI should confirm login form is visible', async ({ page }) => {
    await page.goto('http://localhost:3000/auth?tab=login');

    // Gemini reads the page and confirms the login form exists
    const answer = await askGemini(page, 'Is there a login form with username and password input fields visible on this page?');
    expect(answer).toContain('yes');

    // Playwright also confirms the elements exist
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

    console.log('AI verified the login form successfully!');
  });

  test('AI should confirm Sign In and New Account tabs are present', async ({ page }) => {
    await page.goto('http://localhost:3000/auth?tab=login');

    // Gemini verifies both tabs are described in the page content
    const answer = await askGemini(page, 'Are there two navigation tabs — one for signing in and one for creating a new account?');
    expect(answer).toContain('yes');

    // Playwright confirms tab switching works
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /new account/i })).toBeVisible();
    await page.getByRole('tab', { name: /new account/i }).click();
    await expect(page.getByLabel('Email Address')).toBeVisible();

    console.log('AI confirmed tabs and switching works!');
  });

  test('AI should confirm registration form has correct fields', async ({ page }) => {
    await page.goto('http://localhost:3000/auth?tab=register');

    // Gemini reads the registration page and confirms the fields
    const answer = await askGemini(page, 'Is there a registration or sign-up form with fields for username, email address, and password?');
    expect(answer).toContain('yes');

    // Playwright confirms each field is actually present
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();

    console.log('AI confirmed the registration form fields!');
  });
});
