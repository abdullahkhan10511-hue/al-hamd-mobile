'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageBlock, CustomPage } from '@/types/admin';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
  ChevronDown,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface PageRendererProps {
  page: CustomPage;
  isPreview?: boolean;
}

export default function PageRenderer({ page, isPreview = false }: PageRendererProps) {
  const blocks = page.blocks && page.blocks.length > 0 ? page.blocks : [];

  // Fallback for pages that only have raw text content
  if (blocks.length === 0 && page.content) {
    return (
      <div className="prose prose-neutral max-w-none text-neutral-700 leading-relaxed text-sm sm:text-base whitespace-pre-line">
        {page.content}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {blocks.map((block) => (
        <BlockItem key={block.id} block={block} />
      ))}
    </div>
  );
}

function BlockItem({ block }: { block: PageBlock }) {
  const [faqOpen, setFaqOpen] = useState(false);

  switch (block.type) {
    case 'heading': {
      const alignClass =
        block.headingAlign === 'center'
          ? 'text-center'
          : block.headingAlign === 'right'
          ? 'text-right'
          : 'text-left';

      if (block.headingLevel === 'h1') {
        return (
          <h1
            className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-950 pt-2 ${alignClass}`}
          >
            {block.headingText}
          </h1>
        );
      }
      if (block.headingLevel === 'h3') {
        return (
          <h3
            className={`text-lg sm:text-xl font-bold tracking-tight text-neutral-900 pt-2 ${alignClass}`}
          >
            {block.headingText}
          </h3>
        );
      }
      return (
        <h2
          className={`text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 pt-3 border-b border-neutral-100 pb-2 ${alignClass}`}
        >
          {block.headingText}
        </h2>
      );
    }

    case 'subheading': {
      const alignClass =
        block.subheadingAlign === 'center'
          ? 'text-center'
          : block.subheadingAlign === 'right'
          ? 'text-right'
          : 'text-left';
      return (
        <p className={`text-base sm:text-lg text-neutral-500 font-medium ${alignClass}`}>
          {block.subheadingText}
        </p>
      );
    }

    case 'paragraph': {
      const alignClass =
        block.paragraphAlign === 'center'
          ? 'text-center'
          : block.paragraphAlign === 'right'
          ? 'text-right'
          : 'text-left';
      return (
        <div
          className={`text-sm sm:text-base text-neutral-700 leading-relaxed whitespace-pre-line ${alignClass}`}
        >
          {block.paragraphText}
        </div>
      );
    }

    case 'rich_text': {
      return (
        <div
          className="prose prose-neutral max-w-none text-neutral-700 text-sm sm:text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: block.richTextHtml || '' }}
        />
      );
    }

    case 'image': {
      if (!block.imageUrl) return null;
      const alignClass =
        block.imageAlign === 'center'
          ? 'mx-auto'
          : block.imageAlign === 'right'
          ? 'ml-auto'
          : 'mr-auto';
      return (
        <figure className={`my-4 max-w-3xl ${alignClass}`}>
          <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm bg-neutral-50">
            <img
              src={block.imageUrl}
              alt={block.imageAlt || 'Page media'}
              className="w-full h-auto object-cover max-h-[500px]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          {block.imageCaption && (
            <figcaption className="text-xs text-neutral-500 mt-2 text-center italic">
              {block.imageCaption}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'button': {
      if (!block.buttonText) return null;
      const alignClass =
        block.buttonAlign === 'center'
          ? 'text-center'
          : block.buttonAlign === 'right'
          ? 'text-right'
          : 'text-left';

      const variantClasses =
        block.buttonVariant === 'secondary'
          ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-900'
          : block.buttonVariant === 'outline'
          ? 'border-2 border-neutral-900 hover:bg-neutral-900 hover:text-white text-neutral-900'
          : 'bg-neutral-950 hover:bg-neutral-800 text-white shadow-sm';

      const link = block.buttonLink || '#';
      const isExternal = link.startsWith('http') || link.startsWith('wa.me');

      return (
        <div className={`pt-2 ${alignClass}`}>
          {isExternal ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${variantClasses}`}
            >
              <span>{block.buttonText}</span>
              <ExternalLink className="w-4 h-4 opacity-70" />
            </a>
          ) : (
            <Link
              href={link}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${variantClasses}`}
            >
              <span>{block.buttonText}</span>
            </Link>
          )}
        </div>
      );
    }

    case 'bullet_list': {
      const items = block.listItems || [];
      if (items.length === 0) return null;
      return (
        <ul className="space-y-2.5 my-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-neutral-700">
              <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    }

    case 'numbered_list': {
      const items = block.listItems || [];
      if (items.length === 0) return null;
      return (
        <ol className="space-y-2.5 my-3">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-neutral-700">
              <span className="w-6 h-6 rounded-lg bg-neutral-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed pt-0.5">{item}</span>
            </li>
          ))}
        </ol>
      );
    }

    case 'divider': {
      const spacingClass =
        block.dividerSpacing === 'lg' ? 'py-8' : block.dividerSpacing === 'sm' ? 'py-3' : 'py-5';
      const borderClass = block.dividerStyle === 'dashed' ? 'border-dashed' : 'border-solid';
      return (
        <div className={spacingClass}>
          <hr className={`border-t border-neutral-200 ${borderClass}`} />
        </div>
      );
    }

    case 'faq': {
      return (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 overflow-hidden transition-colors">
          <button
            type="button"
            onClick={() => setFaqOpen(!faqOpen)}
            className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 font-semibold text-neutral-900 hover:text-neutral-950 text-sm sm:text-base cursor-pointer"
          >
            <span>{block.faqQuestion || 'Question'}</span>
            <ChevronDown
              className={`w-4 h-4 text-neutral-500 transition-transform duration-200 shrink-0 ${
                faqOpen ? 'rotate-180 text-neutral-900' : ''
              }`}
            />
          </button>
          {faqOpen && (
            <div className="px-5 pb-5 pt-1 text-sm text-neutral-600 leading-relaxed border-t border-neutral-200/50 bg-white">
              {block.faqAnswer}
            </div>
          )}
        </div>
      );
    }

    case 'contact_info': {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
          {block.contactPhone && (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Telephone Support
                </span>
                <a
                  href={`tel:${block.contactPhone}`}
                  className="text-sm font-bold text-neutral-900 hover:text-amber-600 transition-colors"
                >
                  {block.contactPhone}
                </a>
              </div>
            </div>
          )}

          {block.contactEmail && (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Email Concierge
                </span>
                <a
                  href={`mailto:${block.contactEmail}`}
                  className="text-sm font-bold text-neutral-900 hover:text-blue-600 transition-colors truncate block"
                >
                  {block.contactEmail}
                </a>
              </div>
            </div>
          )}

          {block.contactAddress && (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Studio Address
                </span>
                <p className="text-xs font-semibold text-neutral-800 leading-snug">
                  {block.contactAddress}
                </p>
              </div>
            </div>
          )}

          {block.contactHours && (
            <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Operating Hours
                </span>
                <p className="text-xs font-semibold text-neutral-800 leading-snug">
                  {block.contactHours}
                </p>
              </div>
            </div>
          )}

          {block.contactWhatsapp && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-start gap-3 sm:col-span-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Instant WhatsApp Support
                  </span>
                  <p className="text-xs font-medium text-emerald-900">
                    Live chat for order updates, model advice, and tracking queries.
                  </p>
                </div>
                <a
                  href={`https://wa.me/${block.contactWhatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                >
                  Chat Now
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
