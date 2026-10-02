'use client';

/**
 * Utility for isolated document printing.
 * Creates a clean hidden iframe containing ONLY the printable bill content,
 * guaranteeing that zero admin UI, tables, or buttons bleed into the print output.
 */

interface PrintBillOptions {
  title?: string;
  format?: 'a4' | 'thermal';
  styles?: string;
}

export function printBillElement(elementId: string, options: PrintBillOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    const sourceElement = document.getElementById(elementId);
    if (!sourceElement) {
      console.warn(`printBillElement: Element with id "${elementId}" not found. Falling back to window.print()`);
      window.print();
      resolve();
      return;
    }

    const format = options.format || 'a4';
    const title = options.title || 'Bill';

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      resolve();
      return;
    }

    // Determine target page CSS based on format
    const pageCss =
      format === 'thermal'
        ? `
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        html, body {
          width: 76mm !important;
          max-width: 76mm !important;
          margin: 0 auto !important;
          padding: 2mm !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: monospace, "Courier New", Courier, ui-monospace, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `
        : `
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        html, body {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `;

    // Clone source element HTML
    const contentHtml = sourceElement.outerHTML;

    // Collect all existing stylesheets from the host document
    const headNodes: string[] = [];
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      headNodes.push(node.outerHTML);
    });

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title}</title>
          ${headNodes.join('\n')}
          <style>
            ${pageCss}
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            body {
              font-size: ${format === 'thermal' ? '11px' : '13px'};
              line-height: ${format === 'thermal' ? '1.3' : '1.4'};
            }
            .no-print, [data-no-print] {
              display: none !important;
            }
            ${options.styles || ''}
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `;

    doc.open();
    doc.write(fullHtml);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back:', err);
        window.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
          resolve();
        }, 1000);
      }
    };

    // Wait for images to load before opening print dialog
    const images = Array.from(doc.images);
    if (images.length === 0) {
      setTimeout(triggerPrint, 150);
    } else {
      let loadedCount = 0;
      const onImageFinish = () => {
        loadedCount++;
        if (loadedCount >= images.length) {
          setTimeout(triggerPrint, 150);
        }
      };
      images.forEach((img) => {
        if (img.complete) {
          onImageFinish();
        } else {
          img.onload = onImageFinish;
          img.onerror = onImageFinish;
        }
      });
      // Safety timeout in case images hang
      setTimeout(triggerPrint, 1200);
    }
  });
}
