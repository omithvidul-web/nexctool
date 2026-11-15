import { useMemo, useState } from 'react';
import { Download, ImagePlus, Plus, Trash2 } from 'lucide-react';
import {
  buildInvoicePdfBytes,
  computeInvoiceTotals,
  formatMoney,
  type InvoiceLineItem,
} from '../../utils/invoicePdfBuilder';

function getTodayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

async function normalizeLogoToPngOrJpg(
  file: File
): Promise<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg'; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);
  if (file.type === 'image/png') {
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: 'image/png',
      previewUrl,
    };
  }
  if (file.type === 'image/jpeg') {
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: 'image/jpeg',
      previewUrl,
    };
  }
  // Convert SVG/WebP/GIF to PNG bytes via canvas so pdf-lib can embed it cleanly
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode logo image.'));
    el.src = previewUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 256;
  canvas.height = img.naturalHeight || 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode logo PNG.'))), 'image/png');
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: 'image/png',
    previewUrl,
  };
}

export function InvoicePdfTool() {
  const [docType, setDocType] = useState<'INVOICE' | 'RECEIPT' | 'QUOTE'>('INVOICE');
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-001');
  const [issueDate, setIssueDate] = useState(() => getTodayIso(0));
  const [dueDate, setDueDate] = useState(() => getTodayIso(14));
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [accentHex, setAccentHex] = useState('#4F46E5');

  const [fromName, setFromName] = useState('Studio Horizon');
  const [fromDetails, setFromDetails] = useState('142 Galle Road, Colombo 03\nhello@studiohorizon.lk\n+94 77 123 4567');
  const [toName, setToName] = useState('Acme Solutions Pvt Ltd');
  const [toDetails, setToDetails] = useState('Level 4, Park Street\naccounts@acmesolutions.com');

  const [items, setItems] = useState<InvoiceLineItem[]>([
    { id: 'item-1', description: 'Website UI Design & Prototype', quantity: 1, unitPrice: 450 },
    { id: 'item-2', description: 'Frontend Development & Optimization', quantity: 10, unitPrice: 45 },
  ]);

  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('Payment is due within 14 days via bank transfer.\nThank you for your business.');

  const [logoBytes, setLogoBytes] = useState<Uint8Array | undefined>(undefined);
  const [logoMime, setLogoMime] = useState<'image/png' | 'image/jpeg' | undefined>(undefined);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () => computeInvoiceTotals(items, discountPercent, taxPercent),
    [items, discountPercent, taxPercent]
  );

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const normalized = await normalizeLogoToPngOrJpg(file);
      setLogoBytes(normalized.bytes);
      setLogoMime(normalized.mime);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return normalized.previewUrl;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to attach logo.');
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleUpdateItem = (id: string, patch: Partial<InvoiceLineItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  };

  const handleDownloadPdf = async () => {
    setBusy(true);
    setError(null);
    try {
      const pdfBytes = await buildInvoicePdfBytes({
        docType,
        invoiceNumber,
        issueDate,
        dueDate,
        currencySymbol,
        accentHex,
        fromName,
        fromDetails,
        toName,
        toDetails,
        items,
        discountPercent,
        taxPercent,
        notes,
        logoBytes,
        logoMime,
      });
      const clean = new Uint8Array(pdfBytes.byteLength);
      clean.set(pdfBytes);
      const blob = new Blob([clean.buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeNum = (invoiceNumber || 'document').replace(/[^a-zA-Z0-9_-]+/g, '-');
      a.download = `${docType.toLowerCase()}-${safeNum}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Editor Form */}
      <div className="lg:col-span-7 space-y-5">
        {/* Top Meta Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="inv-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Type
            </label>
            <select
              id="inv-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as 'INVOICE' | 'RECEIPT' | 'QUOTE')}
              className="w-full h-9 px-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="INVOICE">Invoice</option>
              <option value="RECEIPT">Receipt</option>
              <option value="QUOTE">Quote</option>
            </select>
          </div>

          <div>
            <label htmlFor="inv-num" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Number #
            </label>
            <input
              id="inv-num"
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="inv-curr" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Currency
            </label>
            <select
              id="inv-curr"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            >
              <option value="$">$ USD</option>
              <option value="Rs ">Rs LKR</option>
              <option value="EUR ">EUR</option>
              <option value="GBP ">GBP</option>
              <option value="A$ ">A$ AUD</option>
              <option value="INR ">INR</option>
            </select>
          </div>

          <div>
            <label htmlFor="inv-accent" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Accent
            </label>
            <input
              id="inv-accent"
              type="color"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              className="w-full h-9 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white cursor-pointer"
            />
          </div>
        </div>

        {/* Dates & Logo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="inv-issue" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Issue Date
            </label>
            <input
              id="inv-issue"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="inv-due" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {docType === 'RECEIPT' ? 'Paid Date' : 'Due Date'}
            </label>
            <input
              id="inv-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 px-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 px-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap">
              <ImagePlus className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" aria-hidden="true" />
              <span>{logoPreviewUrl ? 'Change Logo' : 'Add Logo'}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void handleLogoUpload(e.target.files?.[0])}
              />
            </label>
            {logoPreviewUrl && (
              <button
                type="button"
                aria-label="Remove logo"
                onClick={() => {
                  URL.revokeObjectURL(logoPreviewUrl);
                  setLogoPreviewUrl(null);
                  setLogoBytes(undefined);
                  setLogoMime(undefined);
                }}
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sender & Client */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="inv-from" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              From (Your Business)
            </label>
            <input
              id="inv-from"
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Business Name"
              className="w-full h-9 px-3 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
            <textarea
              rows={3}
              aria-label="Sender address and contact details"
              value={fromDetails}
              onChange={(e) => setFromDetails(e.target.value)}
              placeholder="Address, email, phone..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="inv-to" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Bill To (Client)
            </label>
            <input
              id="inv-to"
              type="text"
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Client Name"
              className="w-full h-9 px-3 text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
            <textarea
              rows={3}
              aria-label="Client address and contact details"
              value={toDetails}
              onChange={(e) => setToDetails(e.target.value)}
              placeholder="Client address or email..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Line Items</span>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  aria-label="Item description"
                  value={item.description}
                  onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                  placeholder="Service or product description"
                  className="col-span-6 h-9 px-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  aria-label="Quantity"
                  min={0}
                  step="any"
                  value={item.quantity}
                  onChange={(e) => handleUpdateItem(item.id, { quantity: Number(e.target.value) })}
                  className="col-span-2 h-9 px-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
                <input
                  type="number"
                  aria-label="Unit price"
                  min={0}
                  step="any"
                  value={item.unitPrice}
                  onChange={(e) => handleUpdateItem(item.id, { unitPrice: Number(e.target.value) })}
                  className="col-span-3 h-9 px-2 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  aria-label="Remove line item"
                  disabled={items.length <= 1}
                  onClick={() => handleRemoveItem(item.id)}
                  className="col-span-1 flex justify-center p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Discount, Tax & Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inv-disc" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Discount (%)
            </label>
            <input
              id="inv-disc"
              type="number"
              min={0}
              max={100}
              step="any"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="inv-tax" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tax / VAT (%)
            </label>
            <input
              id="inv-tax"
              type="number"
              min={0}
              max={100}
              step="any"
              value={taxPercent}
              onChange={(e) => setTaxPercent(Number(e.target.value))}
              className="w-full h-9 px-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label htmlFor="inv-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes / Payment Terms
          </label>
          <textarea
            id="inv-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
          />
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* Right Live Paper Preview & Download */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="h-2 w-full" style={{ backgroundColor: accentHex }} />
          <div className="p-5 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {logoPreviewUrl && (
                  <img src={logoPreviewUrl} alt="Company logo" className="w-10 h-10 object-contain rounded" />
                )}
                <div>
                  <div className="text-sm font-extrabold text-slate-900">{fromName || 'Your Business'}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500 whitespace-pre-line leading-snug">
                    {fromDetails}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-extrabold tracking-tight" style={{ color: accentHex }}>
                  {docType}
                </div>
                <div className="font-mono text-[11px] text-slate-500"># {invoiceNumber}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accentHex }}>
                  Bill To
                </div>
                <div className="font-bold text-slate-900 mt-0.5">{toName || 'Client'}</div>
                <div className="text-[11px] text-slate-500 whitespace-pre-line">{toDetails}</div>
              </div>
              <div className="text-right font-mono tabular-nums text-[11px] text-slate-600 shrink-0">
                <div>Issued: {issueDate || '-'}</div>
                {dueDate && <div>{docType === 'RECEIPT' ? 'Paid' : 'Due'}: {dueDate}</div>}
              </div>
            </div>

            <div className="border-t border-b border-slate-200 py-2 space-y-1.5">
              <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400">
                <span className="col-span-6">ITEM</span>
                <span className="col-span-2 text-right">QTY</span>
                <span className="col-span-4 text-right">AMOUNT</span>
              </div>
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 items-center text-[11px]">
                  <span className="col-span-6 truncate text-slate-800">{it.description || 'Item'}</span>
                  <span className="col-span-2 text-right font-mono tabular-nums text-slate-600">
                    {it.quantity}
                  </span>
                  <span className="col-span-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {formatMoney(Math.max(0, it.quantity) * Math.max(0, it.unitPrice), currencySymbol)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px] font-mono tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotal, currencySymbol)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-{formatMoney(totals.discountAmount, currencySymbol)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({taxPercent}%)</span>
                  <span>{formatMoney(totals.taxAmount, currencySymbol)}</span>
                </div>
              )}
              <div
                className="flex justify-between text-sm font-extrabold pt-1.5 border-t"
                style={{ borderColor: accentHex, color: accentHex }}
              >
                <span>Total</span>
                <span>{formatMoney(totals.grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={handleDownloadPdf}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-full shadow-md cursor-pointer disabled:opacity-60"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{busy ? 'Generating PDF...' : `Download ${docType.charAt(0) + docType.slice(1).toLowerCase()} PDF`}</span>
        </button>
      </div>
    </div>
  );
}
