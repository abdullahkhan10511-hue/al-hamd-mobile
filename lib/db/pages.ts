import { CustomPage, PageBlock, PageStatus, PageContent } from '@/types/admin';
import { getStoredData, setStoredData } from './storage';
import { logActivity } from './activity';

const STORAGE_KEY = 'static_pages';

export function compilePageContent(blocks: PageBlock[]): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `${b.headingLevel === 'h1' ? '# ' : b.headingLevel === 'h2' ? '## ' : '### '}${b.headingText || ''}`;
        case 'subheading':
          return `*${b.subheadingText || ''}*`;
        case 'paragraph':
          return b.paragraphText || '';
        case 'rich_text':
          return b.richTextHtml || '';
        case 'bullet_list':
        case 'numbered_list':
          return (b.listItems || []).map((item, idx) => (b.type === 'bullet_list' ? `• ${item}` : `${idx + 1}. ${item}`)).join('\n');
        case 'faq':
          return `Q: ${b.faqQuestion || ''}\nA: ${b.faqAnswer || ''}`;
        case 'contact_info':
          return [
            b.contactPhone && `Phone: ${b.contactPhone}`,
            b.contactEmail && `Email: ${b.contactEmail}`,
            b.contactAddress && `Address: ${b.contactAddress}`,
            b.contactHours && `Hours: ${b.contactHours}`,
            b.contactWhatsapp && `WhatsApp: ${b.contactWhatsapp}`,
          ]
            .filter(Boolean)
            .join('\n');
        case 'button':
          return `[${b.buttonText || 'Link'}](${b.buttonLink || '#'})`;
        case 'image':
          return `![${b.imageAlt || 'Image'}](${b.imageUrl || ''})`;
        case 'divider':
          return '---';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

export const seedPages: CustomPage[] = [
  {
    id: 'about',
    title: 'About AL·HAMD Mobile Accessories',
    slug: 'about',
    status: 'Published',
    showInHeader: true,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'about',
    seoTitle: 'About AL-HAMD | Premium Mobile Accessories Pakistan',
    seoDescription: 'Engineered mobile accessories, GaN fast chargers, Kevlar braided cables, and military-grade device protection across Pakistan.',
    targetKeywords: ['about al hamd', 'mobile accessories pakistan', 'fast chargers', 'device protection'],
    order: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'ab-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'center',
        headingText: 'Engineered Mobile Accessories for Modern Devices',
      },
      {
        id: 'ab-2',
        type: 'subheading',
        order: 2,
        subheadingAlign: 'center',
        subheadingText: 'Precision engineering, certified safe charging, and uncompromising durability.',
      },
      {
        id: 'ab-3',
        type: 'divider',
        order: 3,
        dividerStyle: 'solid',
        dividerSpacing: 'md',
      },
      {
        id: 'ab-4',
        type: 'heading',
        order: 4,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Our Heritage & Philosophy',
      },
      {
        id: 'ab-5',
        type: 'paragraph',
        order: 5,
        paragraphAlign: 'left',
        paragraphText:
          "Founded on precision engineering and uncompromising durability, AL·HAMD is Pakistan's premier destination for high-performance mobile accessories and device protection.\n\nWe curate and engineer everyday essentials—from GaN fast chargers, Kevlar-reinforced braided cables, and military-grade drop cases to studio-fidelity acoustic earbuds—tested to endure the rigorous demands of modern mobile life.",
      },
      {
        id: 'ab-6',
        type: 'heading',
        order: 6,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Global Safety & Rigorous Stress Testing',
      },
      {
        id: 'ab-7',
        type: 'bullet_list',
        order: 7,
        listItems: [
          'Certified CE, FCC, RoHS, and Qi2 international safety compliance standards.',
          'MultiProtect IC chips preventing overvoltage, short-circuits, and smartphone battery degradation.',
          '10,000+ bend fatigue tolerance on Kevlar braided charging cables.',
          'Drop-tested military-grade armor cases for maximum impact absorption.',
        ],
      },
      {
        id: 'ab-8',
        type: 'button',
        order: 8,
        buttonText: 'Shop All Accessories',
        buttonLink: '/shop',
        buttonVariant: 'primary',
        buttonAlign: 'center',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact Customer Concierge',
    slug: 'contact',
    status: 'Published',
    showInHeader: false,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'customer_service',
    seoTitle: 'Contact Us | AL-HAMD Mobile Accessories',
    seoDescription: 'Reach AL-HAMD Mobile Concierge for order tracking, compatibility assistance, and nationwide support across Pakistan.',
    targetKeywords: ['contact al hamd', 'mobile support pakistan', 'order tracking', 'customer service'],
    order: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'ct-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'center',
        headingText: 'Customer Concierge & Support',
      },
      {
        id: 'ct-2',
        type: 'paragraph',
        order: 2,
        paragraphAlign: 'center',
        paragraphText:
          'Our client advisors are at your service for model compatibility, order tracking, and product assistance across Pakistan.',
      },
      {
        id: 'ct-3',
        type: 'contact_info',
        order: 3,
        contactEmail: 'support@alhamd-mobile.com',
        contactPhone: '+92 343 2200995',
        contactAddress: 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan',
        contactHours: 'Monday – Saturday: 10:00 AM – 9:00 PM PKT',
        contactWhatsapp: '+92 343 2200995',
      },
      {
        id: 'ct-4',
        type: 'heading',
        order: 4,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Quick Assistance FAQ',
      },
      {
        id: 'ct-5',
        type: 'faq',
        order: 5,
        faqQuestion: 'How do I track my nationwide delivery?',
        faqAnswer:
          'As soon as your package is dispatched, an automated SMS containing your live courier tracking link (TCS, Trax, Leopards) is sent directly to your mobile number.',
      },
      {
        id: 'ct-6',
        type: 'faq',
        order: 6,
        faqQuestion: 'Is Cash on Delivery (COD) supported nationwide?',
        faqAnswer:
          'Yes! We offer convenient Cash on Delivery across all cities, towns, and postal areas in Pakistan with zero hidden payment surcharges.',
      },
    ],
  },
  {
    id: 'shipping-policy',
    title: 'Shipping Policy',
    slug: 'shipping-policy',
    status: 'Published',
    showInHeader: false,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'customer_service',
    seoTitle: 'Shipping & Delivery Policy | AL-HAMD Mobile Accessories',
    seoDescription: 'Nationwide express delivery across Pakistan with real-time SMS tracking and Cash on Delivery support.',
    targetKeywords: ['shipping policy', 'delivery time pakistan', 'cash on delivery shipping', 'express delivery'],
    order: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'sp-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'left',
        headingText: 'Nationwide Express Shipping Policy',
      },
      {
        id: 'sp-2',
        type: 'paragraph',
        order: 2,
        paragraphAlign: 'left',
        paragraphText:
          'We ship premium mobile accessories and device protection to every city, town, and district across Pakistan via vetted express courier partners with door-to-door tracking.',
      },
      {
        id: 'sp-3',
        type: 'heading',
        order: 3,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Shipping Rates & Free Delivery',
      },
      {
        id: 'sp-4',
        type: 'bullet_list',
        order: 4,
        listItems: [
          'FREE Nationwide Express Delivery on all orders exceeding Rs. 5,000.',
          'Flat standard delivery rate of Rs. 200 on orders under Rs. 5,000.',
          'Cash on Delivery (COD) available with no surcharge.',
        ],
      },
      {
        id: 'sp-5',
        type: 'heading',
        order: 5,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Transit Timelines',
      },
      {
        id: 'sp-6',
        type: 'numbered_list',
        order: 6,
        listItems: [
          'Major Metros (Lahore, Karachi, Islamabad, Rawalpindi): 2 to 3 business days.',
          'Regional Cities (Faisalabad, Multan, Peshawar, Sialkot, Gujranwala): 3 to 4 business days.',
          'Rest of Pakistan (KPK, Balochistan, Gilgit-Baltistan, AJK): 3 to 5 business days.',
        ],
      },
    ],
  },
  {
    id: 'refund-policy',
    title: 'Refund & Return Policy',
    slug: 'refund-policy',
    status: 'Published',
    showInHeader: false,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'customer_service',
    seoTitle: 'Refund & Return Policy | AL-HAMD Mobile Accessories',
    seoDescription: '7-day doorstep replacement and return warranty for genuine mobile accessories across Pakistan.',
    targetKeywords: ['return policy', 'refund guarantee', '7 day replacement', 'mobile warranty pakistan'],
    order: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'rf-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'left',
        headingText: '7-Day Return & Replacement Policy',
      },
      {
        id: 'rf-2',
        type: 'paragraph',
        order: 2,
        paragraphAlign: 'left',
        paragraphText:
          'We stand behind every accessory we ship. If an item arrives defective, damaged in transit, or incompatible with your smartphone, we provide a smooth 7-day doorstep return or replacement.',
      },
      {
        id: 'rf-3',
        type: 'heading',
        order: 3,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Return Eligibility Guidelines',
      },
      {
        id: 'rf-4',
        type: 'bullet_list',
        order: 4,
        listItems: [
          'Product must remain in original condition with packaging, tags, and accessories intact.',
          'Replacement requests must be initiated within 7 calendar days of delivery.',
          'Defective or damaged items receive complimentary doorstep pickup across Pakistan.',
        ],
      },
      {
        id: 'rf-5',
        type: 'heading',
        order: 5,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Simple 3-Step Return Process',
      },
      {
        id: 'rf-6',
        type: 'numbered_list',
        order: 6,
        listItems: [
          'Message our WhatsApp support at +92 343 2200995 with your Order Number and photo/video proof.',
          'Our logistics partner will collect the return parcel from your doorstep.',
          'Upon warehouse verification, your exchange is dispatched or refund credited within 3 business days.',
        ],
      },
    ],
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    slug: 'privacy-policy',
    status: 'Published',
    showInHeader: false,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'legal',
    seoTitle: 'Privacy Policy | AL-HAMD Mobile Accessories',
    seoDescription: 'Our commitment to data privacy, 256-bit encryption, and safeguarding customer information.',
    targetKeywords: ['privacy policy', 'data security', 'pci dss', 'al hamd privacy'],
    order: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'pp-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'left',
        headingText: 'Privacy & Data Protection Policy',
      },
      {
        id: 'pp-2',
        type: 'paragraph',
        order: 2,
        paragraphAlign: 'left',
        paragraphText:
          'At AL-HAMD Mobile Accessories, safeguarding your personal data and maintaining your trust is fundamental to our business. This policy explains how we collect, store, and protect your information.',
      },
      {
        id: 'pp-3',
        type: 'heading',
        order: 3,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: '1. Information We Collect',
      },
      {
        id: 'pp-4',
        type: 'bullet_list',
        order: 4,
        listItems: [
          'Customer identifiers: Full name, shipping address, contact phone number, and email address.',
          'Order history: Products ordered, quantities, and chosen delivery service.',
          'Encrypted payment references: Bank or wallet transfer identifiers for payment verification.',
        ],
      },
      {
        id: 'pp-5',
        type: 'heading',
        order: 5,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: '2. Strict Confidentiality & Zero Third-Party Selling',
      },
      {
        id: 'pp-6',
        type: 'paragraph',
        order: 6,
        paragraphAlign: 'left',
        paragraphText:
          'We never sell, rent, or lease customer data to third-party marketing companies or brokers. All information is exclusively used for order fulfillment and customer service.',
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms & Conditions',
    slug: 'terms',
    status: 'Published',
    showInHeader: false,
    showInFooter: true,
    showInMobile: true,
    footerCategory: 'legal',
    seoTitle: 'Terms & Conditions | AL-HAMD Mobile Accessories',
    seoDescription: 'Terms of service, warranty rules, and store policies for AL-HAMD Mobile Accessories.',
    targetKeywords: ['terms and conditions', 'terms of service', 'warranty policy'],
    order: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    enabled: true,
    blocks: [
      {
        id: 'tc-1',
        type: 'heading',
        order: 1,
        headingLevel: 'h1',
        headingAlign: 'left',
        headingText: 'Terms & Conditions of Service',
      },
      {
        id: 'tc-2',
        type: 'paragraph',
        order: 2,
        paragraphAlign: 'left',
        paragraphText:
          'By accessing and placing an order with AL-HAMD Mobile Accessories, you agree to comply with and be bound by the following terms and conditions.',
      },
      {
        id: 'tc-3',
        type: 'heading',
        order: 3,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Product Authenticity & Pricing',
      },
      {
        id: 'tc-4',
        type: 'bullet_list',
        order: 4,
        listItems: [
          'All branded products (Apple, Samsung, Anker, Baseus, UGREEN, Spigen) are guaranteed 100% genuine.',
          'Prices are listed in Pakistani Rupees (PKR) and include all applicable taxes.',
          'Orders are confirmed subject to item availability and payment verification.',
        ],
      },
      {
        id: 'tc-5',
        type: 'heading',
        order: 5,
        headingLevel: 'h2',
        headingAlign: 'left',
        headingText: 'Warranty & Replacement Policy',
      },
      {
        id: 'tc-6',
        type: 'paragraph',
        order: 6,
        paragraphAlign: 'left',
        paragraphText:
          'Products covered by manufacturer warranties are subject to official warranty policies. Physical damage, water ingress, or unauthorized alterations void warranty coverage.',
      },
    ],
  },
];

// Normalize page: converts legacy text pages to CustomPage with blocks
function normalizePage(raw: any, index: number): CustomPage {
  const seed = seedPages.find((s) => s.id === raw.id || s.slug === raw.slug);

  // Check if raw page has legacy clothing/demo content
  const rawContent = typeof raw.content === 'string' ? raw.content : '';
  const isGarbage =
    rawContent.includes('French Terry') ||
    rawContent.includes('clothing') ||
    rawContent.includes('garments') ||
    rawContent.includes('Portugal') ||
    rawContent.includes('$50') ||
    rawContent.includes('worldwide') ||
    rawContent.includes('DHL') ||
    rawContent.includes('New York') ||
    rawContent.includes('+1 (800)');

  // If garbage detected and we have a clean seed, reset to clean seed
  if (isGarbage && seed) {
    return {
      ...seed,
      content: compilePageContent(seed.blocks),
      enabled: seed.status === 'Published',
    };
  }

  // If blocks exist, use them
  let blocks: PageBlock[] = Array.isArray(raw.blocks) && raw.blocks.length > 0 ? raw.blocks : [];

  // If no blocks but content exists, convert content into heading and paragraphs
  if (blocks.length === 0) {
    if (seed && seed.blocks.length > 0 && (!rawContent || rawContent.length < 20)) {
      blocks = [...seed.blocks];
    } else if (rawContent) {
      const paragraphs = rawContent.split('\n\n').map((p: string) => p.trim()).filter(Boolean);
      blocks = [
        {
          id: `b-${raw.id || index}-title`,
          type: 'heading',
          order: 1,
          headingLevel: 'h1',
          headingAlign: 'left',
          headingText: raw.title || 'Page Title',
        },
        ...paragraphs.map((para: string, pIdx: number) => ({
          id: `b-${raw.id || index}-p-${pIdx}`,
          type: 'paragraph' as const,
          order: pIdx + 2,
          paragraphAlign: 'left' as const,
          paragraphText: para,
        })),
      ];
    } else if (seed) {
      blocks = [...seed.blocks];
    }
  }

  // Ensure blocks are ordered
  blocks.sort((a, b) => a.order - b.order);

  // Sanitize legacy placeholder info in blocks
  blocks = blocks.map((b) => {
    if (b.type === 'contact_info') {
      return {
        ...b,
        contactEmail: b.contactEmail || 'support@alhamd-mobile.com',
        contactPhone: (!b.contactPhone || b.contactPhone.includes('1234567')) ? '+92 343 2200995' : b.contactPhone,
        contactAddress: (!b.contactAddress || b.contactAddress.includes('Lahore') || b.contactAddress.includes('MM Alam'))
          ? 'Mobile Street, Opposite Habib Bank, Katchery Road, Mandi Bahauddin, Pakistan'
          : b.contactAddress,
        contactWhatsapp: (!b.contactWhatsapp || b.contactWhatsapp.includes('1234567')) ? '+92 343 2200995' : b.contactWhatsapp,
      };
    }
    if (b.type === 'numbered_list' || b.type === 'bullet_list') {
      if (Array.isArray(b.listItems)) {
        return {
          ...b,
          listItems: b.listItems.map((item) =>
            typeof item === 'string'
              ? item.replace(/\+92\s*300\s*1234567/g, '+92 343 2200995')
              : item
          ),
        };
      }
    }
    return b;
  });

  // Resolve status
  let status: PageStatus = 'Published';
  if (raw.status === 'Draft' || raw.status === 'Hidden' || raw.status === 'Published') {
    status = raw.status;
  } else if (raw.enabled === false) {
    status = 'Draft';
  }

  const category =
    raw.footerCategory ||
    seed?.footerCategory ||
    (raw.slug?.includes('policy') || raw.slug === 'terms' ? 'legal' : 'customer_service');

  return {
    id: raw.id || `page-${Date.now()}-${index}`,
    title: raw.title || seed?.title || 'Untitled Page',
    slug: (raw.slug || seed?.slug || `page-${index}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
    status,
    showInHeader: raw.showInHeader !== undefined ? Boolean(raw.showInHeader) : seed?.showInHeader ?? false,
    showInFooter: raw.showInFooter !== undefined ? Boolean(raw.showInFooter) : seed?.showInFooter ?? true,
    showInMobile: raw.showInMobile !== undefined ? Boolean(raw.showInMobile) : seed?.showInMobile ?? true,
    footerCategory: category,
    seoTitle: raw.seoTitle || seed?.seoTitle || `${raw.title || 'Page'} | AL-HAMD Mobile`,
    seoDescription: raw.seoDescription || seed?.seoDescription || '',
    targetKeywords: Array.isArray(raw.targetKeywords) ? raw.targetKeywords : seed?.targetKeywords || [],
    seoImage: raw.seoImage || seed?.seoImage || '',
    blocks,
    order: raw.order !== undefined ? Number(raw.order) : index + 1,
    content: compilePageContent(blocks),
    enabled: status === 'Published',
    createdAt: raw.createdAt || seed?.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export async function getPages(): Promise<CustomPage[]> {
  const rawList = await getStoredData<any[]>(STORAGE_KEY, seedPages);
  const normalized = rawList.map((item, idx) => normalizePage(item, idx));
  return normalized.sort((a, b) => a.order - b.order);
}

export async function getPublishedPages(): Promise<CustomPage[]> {
  const all = await getPages();
  return all.filter((p) => p.status === 'Published');
}

export async function getPageById(idOrSlug: string): Promise<CustomPage | null> {
  const pages = await getPages();
  const cleanKey = idOrSlug.trim().toLowerCase().replace(/^\//, '');
  return (
    pages.find(
      (p) =>
        p.id.toLowerCase() === cleanKey ||
        p.slug.toLowerCase() === cleanKey ||
        p.slug.toLowerCase() === `/${cleanKey}`
    ) || null
  );
}

export async function isSlugUnique(slug: string, currentId?: string): Promise<boolean> {
  const pages = await getPages();
  const clean = slug.trim().toLowerCase().replace(/^\//, '');
  return !pages.some((p) => p.slug.toLowerCase() === clean && p.id !== currentId);
}

export async function savePage(
  page: CustomPage,
  adminEmail: string = 'admin@alhamd.com'
): Promise<CustomPage> {
  const pages = await getPages();
  const existingIndex = pages.findIndex((p) => p.id === page.id);

  // Normalize slug
  const cleanSlug = page.slug
    .trim()
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Verify slug uniqueness
  const isTaken = pages.some((p) => p.slug === cleanSlug && p.id !== page.id);
  if (isTaken) {
    throw new Error(`The URL slug "/${cleanSlug}" is already in use by another page.`);
  }

  // Ensure blocks are ordered
  const sortedBlocks = (page.blocks || []).map((b, idx) => ({
    ...b,
    order: idx + 1,
  }));

  const compiledContent = compilePageContent(sortedBlocks);

  const updatedPage: CustomPage = {
    ...page,
    slug: cleanSlug,
    blocks: sortedBlocks,
    content: compiledContent,
    enabled: page.status === 'Published',
    updatedAt: new Date().toISOString(),
  };

  let updatedList: CustomPage[];
  if (existingIndex >= 0) {
    updatedList = [...pages];
    updatedList[existingIndex] = updatedPage;
    await logActivity({
      adminEmail,
      action: 'UPDATE_PAGE',
      target: updatedPage.title,
      details: `Updated page "${updatedPage.title}" (Status: ${updatedPage.status}, Blocks: ${sortedBlocks.length})`,
    });
  } else {
    updatedPage.order = updatedPage.order || pages.length + 1;
    updatedList = [...pages, updatedPage];
    await logActivity({
      adminEmail,
      action: 'CREATE_PAGE',
      target: updatedPage.title,
      details: `Created page "${updatedPage.title}" with slug "/${cleanSlug}"`,
    });
  }

  await setStoredData(STORAGE_KEY, updatedList);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
  }

  return updatedPage;
}

export async function duplicatePage(
  id: string,
  adminEmail: string = 'admin@alhamd.com'
): Promise<CustomPage> {
  const pages = await getPages();
  const target = pages.find((p) => p.id === id);
  if (!target) throw new Error('Page not found');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newSlug = `${target.slug}-copy-${randomSuffix}`;

  const duplicatedBlocks: PageBlock[] = (target.blocks || []).map((b, idx) => ({
    ...b,
    id: `blk-${Date.now()}-${idx}`,
    order: idx + 1,
  }));

  const newPage: CustomPage = {
    ...target,
    id: `page-${Date.now()}`,
    title: `${target.title} (Copy)`,
    slug: newSlug,
    status: 'Draft',
    showInHeader: false,
    showInFooter: false,
    showInMobile: false,
    blocks: duplicatedBlocks,
    order: pages.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    enabled: false,
  };

  return await savePage(newPage, adminEmail);
}

export async function deletePage(
  id: string,
  adminEmail: string = 'admin@alhamd.com'
): Promise<boolean> {
  const pages = await getPages();
  const target = pages.find((p) => p.id === id);
  if (!target) return false;

  const filtered = pages.filter((p) => p.id !== id);
  // Re-index orders
  const reordered = filtered.map((p, idx) => ({ ...p, order: idx + 1 }));

  await setStoredData(STORAGE_KEY, reordered);

  await logActivity({
    adminEmail,
    action: 'DELETE_PAGE',
    target: target.title,
    details: `Permanently removed page "${target.title}" (slug: /${target.slug})`,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
  }

  return true;
}

export async function reorderPages(
  orderedIds: string[],
  adminEmail: string = 'admin@alhamd.com'
): Promise<CustomPage[]> {
  const pages = await getPages();
  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const updated: CustomPage[] = [];
  orderedIds.forEach((id, idx) => {
    const p = pageMap.get(id);
    if (p) {
      updated.push({
        ...p,
        order: idx + 1,
        updatedAt: new Date().toISOString(),
      });
      pageMap.delete(id);
    }
  });

  // Append any remaining pages not in orderedIds
  pageMap.forEach((p) => {
    updated.push({
      ...p,
      order: updated.length + 1,
    });
  });

  await setStoredData(STORAGE_KEY, updated);

  await logActivity({
    adminEmail,
    action: 'REORDER_PAGES',
    target: 'Pages & Legal',
    details: 'Reordered page sequence',
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('alhamd:data-updated'));
  }

  return updated;
}
