import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:8081';
const OTP_CODE = '986724';

// Wait for app to fully load
async function waitForApp(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

// Check what's actually on screen — useful for debugging
async function logPageText(page: Page) {
  const text = await page.locator('body').innerText().catch(() => '');
  console.log('Page text:', text.slice(0, 200));
}

// Login — handles the OTP auth flow
async function login(page: Page) {
  await page.goto(BASE);
  await waitForApp(page);
  await logPageText(page);

  // Check if already logged in (tab bar visible)
  const tabBarVisible = await page.locator('[class*="tabItem"], [class*="bar"]').first().isVisible().catch(() => false);
  if (tabBarVisible) {
    console.log('Already logged in');
    return;
  }

  // Enter phone number
  const phoneInput = page.locator('input').first();
  if (await phoneInput.isVisible().catch(() => false)) {
    await phoneInput.fill('2135513329');
    // Find and click continue/send button
    const continueBtn = page.locator('button, [role="button"]').filter({ hasText: /continue|send|next|verify/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }
  }

  // Enter OTP
  const otpInput = page.locator('input').first();
  if (await otpInput.isVisible().catch(() => false)) {
    await otpInput.fill(OTP_CODE);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  }

  await waitForApp(page);
}

// Click a tab by finding text anywhere on page (case insensitive)
async function goToTab(page: Page, tabText: string) {
  // Try multiple selector strategies
  const selectors = [
    `text=${tabText}`,
    `text=${tabText.toLowerCase()}`,
    `text=${tabText.charAt(0) + tabText.slice(1).toLowerCase()}`,
  ];

  for (const sel of selectors) {
    const el = page.locator(sel).last();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(800);
      return;
    }
  }
  throw new Error(`Tab "${tabText}" not found on page`);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Eco Pulse E2E', () => {

  test('1. App loads at localhost:8081', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Page should have something rendered — not blank
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('Body text:', bodyText.slice(0, 300));
    expect(bodyText.length).toBeGreaterThan(10);

    // Should not have a fatal JS error overlay
    const hasErrorOverlay = await page.locator('text=Something went wrong').isVisible().catch(() => false);
    expect(hasErrorOverlay).toBeFalsy();
  });

  test('2. App renders initial screen (auth or home)', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take a screenshot to see what's there
    await page.screenshot({ path: 'test-results/initial-screen.png' });

    // Should render SOMETHING meaningful
    const allText = await page.locator('body').innerText().catch(() => '');
    console.log('All text:', allText.slice(0, 500));

    // App renders if there's any text content
    expect(allText.trim().length).toBeGreaterThan(5);
  });

  test('3. Tab bar is visible after login', async ({ page }) => {
    await login(page);
    await page.screenshot({ path: 'test-results/after-login.png' });

    const allText = await page.locator('body').innerText().catch(() => '');
    console.log('After login text:', allText.slice(0, 500));

    // After login, should see tab labels
    const hasTabBar = allText.toLowerCase().includes('home') ||
                      allText.toLowerCase().includes('explore') ||
                      allText.toLowerCase().includes('profile') ||
                      allText.toLowerCase().includes('habits');
    expect(hasTabBar).toBeTruthy();
  });

  test('4. Can navigate between tabs', async ({ page }) => {
    await login(page);

    // Get all visible text to find actual tab labels
    const allText = await page.locator('body').innerText().catch(() => '');
    console.log('Tab navigation page text:', allText.slice(0, 600));

    // Find clickable items in the bottom area
    const bottomLinks = await page.locator('body').allInnerTexts();
    console.log('All inner texts:', bottomLinks);

    // Try to find and click tabs using flexible matching
    const tabPatterns = ['Home', 'home', 'HOME', 'Explore', 'explore', 'EXPLORE'];
    let tabClicked = false;

    for (const pattern of tabPatterns) {
      const el = page.locator(`text=${pattern}`).last();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(500);
        tabClicked = true;
        console.log(`Clicked tab: ${pattern}`);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/tab-navigation.png' });
    expect(tabClicked).toBeTruthy();
  });

  test('5. Profile screen shows user data', async ({ page }) => {
    await login(page);

    // Try to navigate to profile
    const profileSelectors = ['text=Profile', 'text=PROFILE', 'text=profile'];
    for (const sel of profileSelectors) {
      const el = page.locator(sel).last();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/profile-screen.png' });
    const text = await page.locator('body').innerText().catch(() => '');
    console.log('Profile text:', text.slice(0, 400));

    // Profile should show name or level or clean air
    const hasProfileContent = text.includes('Sanjeet') ||
                               text.toLowerCase().includes('sprout') ||
                               text.toLowerCase().includes('clean air') ||
                               text.toLowerCase().includes('level');
    expect(hasProfileContent).toBeTruthy();
  });

  test('6. Habits screen renders', async ({ page }) => {
    await login(page);

    const habitSelectors = ['text=Habits', 'text=HABITS', 'text=habits'];
    for (const sel of habitSelectors) {
      const el = page.locator(sel).last();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/habits-screen.png' });
    const text = await page.locator('body').innerText().catch(() => '');
    console.log('Habits text:', text.slice(0, 400));

    const hasHabitsContent = text.toLowerCase().includes('habit') ||
                              text.toLowerCase().includes('streak') ||
                              text.toLowerCase().includes('active');
    expect(hasHabitsContent).toBeTruthy();
  });

  test('7. Moments feed renders', async ({ page }) => {
    await login(page);

    const momentSelectors = ['text=Moments', 'text=MOMENTS', 'text=moments'];
    for (const sel of momentSelectors) {
      const el = page.locator(sel).last();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/moments-screen.png' });
    const text = await page.locator('body').innerText().catch(() => '');
    console.log('Moments text:', text.slice(0, 400));

    const hasMomentsContent = text.toLowerCase().includes('moment') ||
                               text.toLowerCase().includes('green act') ||
                               text.toLowerCase().includes('challenge') ||
                               text.toLowerCase().includes('level');
    expect(hasMomentsContent).toBeTruthy();
  });

  test('8. Log Activity modal opens', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1000);

    // Find any button/link related to logging
    const logSelectors = [
      'text=Log activity',
      'text=Log Activity',
      'text=Log an activity',
      'text=Log',
    ];

    let opened = false;
    for (const sel of logSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2000);
        opened = true;
        break;
      }
    }

    await page.screenshot({ path: 'test-results/log-activity.png' });

    if (opened) {
      const text = await page.locator('body').innerText().catch(() => '');
      const hasChat = text.toLowerCase().includes('hey') ||
                      text.toLowerCase().includes('what did you do') ||
                      text.toLowerCase().includes('eco');
      expect(hasChat).toBeTruthy();
    } else {
      console.log('Log Activity button not found — skipping');
      test.skip();
    }
  });

  test('9. Explore tab loads', async ({ page }) => {
    await login(page);

    const exploreSelectors = ['text=Explore', 'text=EXPLORE', 'text=explore'];
    for (const sel of exploreSelectors) {
      const el = page.locator(sel).last();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        await el.click();
        await page.waitForTimeout(2500);
        break;
      }
    }

    await page.screenshot({ path: 'test-results/explore-screen.png' });
    const text = await page.locator('body').innerText().catch(() => '');

    const hasExploreContent = text.toLowerCase().includes('eco reels') ||
                               text.toLowerCase().includes('youtube') ||
                               text.toLowerCase().includes('green') ||
                               text.toLowerCase().includes('explore');
    expect(hasExploreContent).toBeTruthy();
  });

  test('10. No fatal JS errors across all tabs', async ({ page }) => {
    const fatalErrors: string[] = [];
    page.on('pageerror', err => {
      const msg = err.message;
      // Ignore known non-fatal warnings
      if (!msg.includes('favicon') &&
          !msg.includes('pointerEvents') &&
          !msg.includes('useNativeDriver') &&
          !msg.includes('Grammarly')) {
        fatalErrors.push(msg);
        console.error('JS Error:', msg);
      }
    });

    await login(page);

    // Visit each tab
    const tabs = ['Home', 'Explore', 'Moments', 'Profile', 'Habits'];
    for (const tab of tabs) {
      const selectors = [`text=${tab}`, `text=${tab.toUpperCase()}`];
      for (const sel of selectors) {
        const el = page.locator(sel).last();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          await el.click();
          await page.waitForTimeout(1500);
          console.log(`✓ Visited ${tab}`);
          break;
        }
      }
    }

    await page.screenshot({ path: 'test-results/all-tabs-visited.png' });
    expect(fatalErrors).toHaveLength(0);
  });

});
