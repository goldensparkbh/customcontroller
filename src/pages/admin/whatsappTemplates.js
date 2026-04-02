import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getOrderNumber, padNumericString } from './recordNumbers';

const WHATSAPP_TEMPLATES_DOC = ['admin_settings', 'whatsapp_templates'];

const getCustomerName = (order) => {
    const customer = order?.customer || {};
    return [customer.first_name || customer.firstName, customer.last_name || customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() || 'N/A';
};

const getOrderNumberLabel = (order) => `#${padNumericString(getOrderNumber(order), 6)}`;

const getFirstPreviewLinks = (order, origin) => {
    const baseUrl = String(origin || '').replace(/\/$/, '');
    if (!baseUrl) return null;
    const items = Array.isArray(order?.items) ? order.items : [];
    const itemIndex = items.findIndex((item) => item?.previewFront || item?.previewBack);
    if (itemIndex < 0) return null;

    const selectedItem = items[itemIndex];
    return {
        front: selectedItem?.previewFront
            ? `${baseUrl}/api/orderPreview?orderId=${encodeURIComponent(order.id)}&itemIndex=${itemIndex}&side=front`
            : '',
        back: selectedItem?.previewBack
            ? `${baseUrl}/api/orderPreview?orderId=${encodeURIComponent(order.id)}&itemIndex=${itemIndex}&side=back`
            : ''
    };
};

/** Shown in admin UI — Arabic + English hints */
export const WHATSAPP_TEMPLATE_TAGS = [
    { tag: '{{customerName}}', en: 'Customer full name', ar: 'الاسم الكامل للعميل' },
    { tag: '{{orderNumber}}', en: 'Order number (e.g. #500001)', ar: 'رقم الطلب' },
    { tag: '{{trackingNumber}}', en: 'Tracking # or “Pending assignment”', ar: 'رقم التتبع أو نص الانتظار' },
    { tag: '{{trackingLine}}', en: 'Full line: “Shipping tracking number: …”', ar: 'سطر التتبع الكامل' },
    { tag: '{{previewBlock}}', en: 'Block with front/back preview image URLs', ar: 'قسم روابط صور التصميم' },
    { tag: '{{previewFrontUrl}}', en: 'Front preview URL only', ar: 'رابط صورة الأمام فقط' },
    { tag: '{{previewBackUrl}}', en: 'Back preview URL only', ar: 'رابط صورة الخلف فقط' }
];

export const DEFAULT_WHATSAPP_TEMPLATES = [
    {
        id: 'order_confirmed',
        label: 'Order Confirmed',
        body: [
            'Hello {{customerName}},',
            '',
            'Your order {{orderNumber}} has been received successfully.',
            'We will update you once your customized controller is ready.',
            'Thank you.'
        ].join('\n')
    },
    {
        id: 'controller_ready',
        label: 'Controller Ready',
        body: [
            'Hello {{customerName}},',
            '',
            'Your customized controller for order {{orderNumber}} is ready.',
            '{{trackingLine}}',
            '{{previewBlock}}',
            'Thank you.'
        ].join('\n')
    },
    {
        id: 'order_shipped',
        label: 'Order Shipped',
        body: [
            'Hello {{customerName}},',
            '',
            'Your order {{orderNumber}} has been shipped.',
            '{{trackingLine}}',
            'Thank you.'
        ].join('\n')
    }
];

function normalizeTemplateEntry(raw) {
    const id = String(raw?.id || raw?.key || '').trim();
    const label = String(raw?.label || '').trim() || 'Untitled';
    const body = String(raw?.body ?? raw?.message ?? '').trim();
    if (!id) return null;
    return { id, label, body };
}

export function normalizeWhatsAppTemplatesList(templates) {
    if (!Array.isArray(templates)) return [];
    return templates.map(normalizeTemplateEntry).filter(Boolean);
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @returns {Promise<{ id: string, label: string, body: string }[]>}
 */
export async function loadWhatsAppTemplates(db) {
    const ref = doc(db, ...WHATSAPP_TEMPLATES_DOC);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    let list = normalizeWhatsAppTemplatesList(data.templates);

    if (!list.length) {
        list = DEFAULT_WHATSAPP_TEMPLATES.map((t) => ({ ...t }));
        await setDoc(
            ref,
            {
                templates: list,
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );
    }

    return list;
}

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {{ id: string, label: string, body: string }[]} templates
 */
export async function saveWhatsAppTemplates(db, templates) {
    const ref = doc(db, ...WHATSAPP_TEMPLATES_DOC);
    const cleaned = normalizeWhatsAppTemplatesList(templates);
    await setDoc(
        ref,
        {
            templates: cleaned,
            updatedAt: serverTimestamp()
        },
        { merge: true }
    );
    return cleaned;
}

export function buildWhatsAppTemplateContext(order, trackingNumber, origin) {
    if (!order) return null;
    const customerName = getCustomerName(order);
    const orderNumber = getOrderNumberLabel(order);
    const tn = String(trackingNumber || '').trim();
    const trackingLine = tn
        ? `Shipping tracking number: ${tn}`
        : 'Shipping tracking number: Pending assignment';
    const previewLinks = getFirstPreviewLinks(order, origin);
    let previewBlock = '';
    if (previewLinks && (previewLinks.front || previewLinks.back)) {
        const lines = ['Customized controller images:'];
        if (previewLinks.front) lines.push(`Front: ${previewLinks.front}`);
        if (previewLinks.back) lines.push(`Back: ${previewLinks.back}`);
        previewBlock = lines.join('\n');
    }
    return {
        customerName,
        orderNumber,
        trackingNumber: tn || 'Pending assignment',
        trackingLine,
        previewBlock,
        previewFrontUrl: previewLinks?.front || '',
        previewBackUrl: previewLinks?.back || ''
    };
}

export function applyWhatsAppTemplateBody(body, ctx) {
    if (!ctx || body == null) return '';
    let out = String(body);
    const map = {
        '{{customerName}}': ctx.customerName,
        '{{orderNumber}}': ctx.orderNumber,
        '{{trackingNumber}}': ctx.trackingNumber,
        '{{trackingLine}}': ctx.trackingLine,
        '{{previewBlock}}': ctx.previewBlock,
        '{{previewFrontUrl}}': ctx.previewFrontUrl,
        '{{previewBackUrl}}': ctx.previewBackUrl
    };
    Object.entries(map).forEach(([key, val]) => {
        out = out.split(key).join(val == null ? '' : String(val));
    });
    return out
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
