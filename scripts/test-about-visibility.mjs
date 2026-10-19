// Test script for AL-HAMD SHOP header About menu visibility logic
import { getNavigation } from '../lib/db/navigation.ts';
import { seedPages } from '../lib/db/pages.ts';

console.log('--- Testing AL-HAMD SHOP Header About Visibility Logic ---');

function computeHeaderNav(mockNavItems, mockPages) {
  const rawNav = mockNavItems;
  const allPages = mockPages;
  const aboutPage = allPages.find((p) => p.id === 'about' || p.slug === 'about');
  const aboutNavItem = rawNav.find((n) => n.href === '/about' || n.label.toLowerCase() === 'about');

  const isAboutNavVisible = aboutNavItem ? Boolean(aboutNavItem.visible) : true;
  const isAboutPageVisible = aboutPage
    ? aboutPage.status === 'Published' && aboutPage.showInHeader !== false
    : true;
  const isAboutEnabled = isAboutNavVisible && isAboutPageVisible;

  const baseNav = rawNav.filter((n) => {
    const isAbout = n.href === '/about' || n.label.toLowerCase() === 'about';
    if (isAbout) {
      return isAboutEnabled;
    }
    return n.visible;
  });

  const headerPages = allPages.filter((p) => p.status === 'Published' && p.showInHeader);
  const pageNavItems = headerPages
    .filter((p) => {
      if (rawNav.some((b) => b.href === `/${p.slug}` || b.href === p.slug)) {
        return false;
      }
      if (p.slug === 'about' || p.id === 'about') {
        return false;
      }
      return true;
    })
    .map((p) => ({
      id: `page-nav-${p.id}`,
      label:
        p.title
          .replace(/AL[·\-\s]HAMD/gi, '')
          .replace(/Mobile Accessories/gi, '')
          .replace(/\bSHOP\b/gi, '')
          .trim() || p.title,
      href: `/${p.slug}`,
      displayOrder: 50 + p.order,
      visible: true,
    }));

  const finalNavItems = [...baseNav, ...pageNavItems].sort((a, b) => a.displayOrder - b.displayOrder);

  const mobilePages = allPages.filter((p) => {
    if (p.status !== 'Published' || !p.showInMobile) return false;
    const isAbout = p.slug === 'about' || p.id === 'about';
    if (isAbout) {
      if (!isAboutEnabled) return false;
      if (finalNavItems.some((n) => n.href === '/about')) return false;
    }
    return true;
  });

  return { finalNavItems, mobilePages, isAboutEnabled };
}

// 1. Default State (About Enabled)
{
  const defaultNav = getNavigation();
  const { finalNavItems, mobilePages, isAboutEnabled } = computeHeaderNav(defaultNav, seedPages);

  const aboutItem = finalNavItems.find((n) => n.href === '/about');
  if (!aboutItem) throw new Error('Test 1 Failed: About link should be visible when enabled');
  if (aboutItem.label !== 'About') throw new Error(`Test 1 Failed: Expected label "About", got "${aboutItem.label}"`);
  if (!isAboutEnabled) throw new Error('Test 1 Failed: isAboutEnabled should be true');
  console.log('✓ Test 1 Passed: When About is enabled, About menu renders correctly with label "About"');
}

// 2. About Disabled in Navigation Menu (visible: false)
{
  const navWithDisabledAbout = getNavigation().map((n) =>
    n.href === '/about' ? { ...n, visible: false } : n
  );
  // Also simulate custom page with title "About AL·HAMD SHOP"
  const pagesWithShopTitle = seedPages.map((p) =>
    p.slug === 'about' ? { ...p, title: 'About AL·HAMD SHOP', showInHeader: true } : p
  );

  const { finalNavItems, mobilePages, isAboutEnabled } = computeHeaderNav(navWithDisabledAbout, pagesWithShopTitle);

  const aboutItem = finalNavItems.find((n) => n.href === '/about');
  const aboutShopItem = finalNavItems.find((n) => n.label.includes('SHOP') || n.label.toLowerCase().includes('about'));
  if (aboutItem || aboutShopItem) {
    throw new Error(`Test 2 Failed: About item still found in navItems: ${JSON.stringify(aboutItem || aboutShopItem)}`);
  }
  const aboutInMobile = mobilePages.find((p) => p.slug === 'about');
  if (aboutInMobile) {
    throw new Error('Test 2 Failed: About should not be in mobilePages when disabled');
  }
  if (isAboutEnabled) throw new Error('Test 2 Failed: isAboutEnabled should be false');
  console.log('✓ Test 2 Passed: When About is disabled in navigation, it is completely hidden on desktop and mobile. No "About SHOP" fallback!');
}

// 3. About Disabled in Pages (showInHeader: false)
{
  const defaultNav = getNavigation();
  const pagesWithHiddenHeader = seedPages.map((p) =>
    p.slug === 'about' ? { ...p, showInHeader: false } : p
  );

  const { finalNavItems, mobilePages, isAboutEnabled } = computeHeaderNav(defaultNav, pagesWithHiddenHeader);

  const aboutItem = finalNavItems.find((n) => n.href === '/about');
  if (aboutItem) {
    throw new Error(`Test 3 Failed: About item should be hidden when showInHeader is false`);
  }
  if (isAboutEnabled) throw new Error('Test 3 Failed: isAboutEnabled should be false');
  console.log('✓ Test 3 Passed: When About has showInHeader: false in pages, it is completely hidden from header navigation');
}

// 4. Custom Non-About Page Added in Pages (showInHeader: true)
{
  const defaultNav = getNavigation();
  const customPage = {
    id: 'warranty-policy',
    title: 'AL·HAMD Warranty Policy Mobile Accessories',
    slug: 'warranty-policy',
    status: 'Published',
    showInHeader: true,
    showInMobile: true,
    order: 10,
    blocks: [],
  };
  const pagesWithCustom = [...seedPages, customPage];

  const { finalNavItems, mobilePages } = computeHeaderNav(defaultNav, pagesWithCustom);

  const customItem = finalNavItems.find((n) => n.href === '/warranty-policy');
  if (!customItem) throw new Error('Test 4 Failed: Custom page should be included in header navigation');
  if (customItem.label !== 'Warranty Policy') {
    throw new Error(`Test 4 Failed: Expected cleaned label "Warranty Policy", got "${customItem.label}"`);
  }
  console.log('✓ Test 4 Passed: Custom pages without existing nav items are properly added with cleaned labels');
}

// 5. Preserves All Other Navigation Items
{
  const defaultNav = getNavigation();
  const { finalNavItems } = computeHeaderNav(defaultNav, seedPages);
  const labels = finalNavItems.map((n) => n.label);
  const requiredLabels = ['Home', 'Shop', 'New Arrivals', 'Best Sellers', 'Categories', 'About', 'Contact', 'Deals'];
  for (const req of requiredLabels) {
    if (!labels.includes(req)) throw new Error(`Test 5 Failed: Missing required nav label "${req}"`);
  }
  console.log('✓ Test 5 Passed: All standard navigation items (Home, Shop, New Arrivals, Best Sellers, Categories, About, Contact, Deals) are preserved');
}

console.log('\nAll 5 Header About Visibility tests PASSED successfully!');
