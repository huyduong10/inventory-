const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
};

const getVietnameseAmountText = (value) => {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount < 0) return 'Số không hợp lệ';
  if (amount === 0) return 'không';

  const readUnderOneThousand = (number) => {
    if (number === 0) return '';

    const ones = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const hundreds = Math.floor(number / 100);
    const remainder = number % 100;
    const tens = Math.floor(remainder / 10);
    const units = remainder % 10;

    let words = '';

    if (hundreds > 0) words += `${ones[hundreds]} trăm`;
    if (tens === 1) words += ' mười';
    else if (tens > 1) words += ` ${ones[tens]} mươi`;

    if (units > 0) {
      if (tens > 1 && units === 1) {
        words += ' mốt';
      } else if (tens > 1 && units === 5) {
        words += ' lăm';
      } else if (tens > 1 && units === 4) {
        words += ' tư';
      } else {
        words += ` ${ones[units]}`;
      }
    }

    return words.trim();
  };

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const groups = [];
  let remaining = Math.floor(amount);

  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const chunks = groups.map((group, index) => {
    const text = readUnderOneThousand(group);
    return text ? `${text} ${units[index] || ''}`.trim() : '';
  });

  return chunks.reverse().join(' ').trim();
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const renderPurchaseRows = (doc) => {
  const items = Array.isArray(doc?.data?.items) ? doc.data.items : [];

  return items
    .map((item, index) => {
      const amount = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return `
        <tr>
          <td class="cell text-center">${index + 1}</td>
          <td class="cell">${escapeHtml(item.content || '')}</td>
          <td class="cell text-center">${escapeHtml(item.unit || '')}</td>
          <td class="cell text-center">${escapeHtml(item.quantity || 0)}</td>
          <td class="cell text-right">${escapeHtml(formatMoney(item.unitPrice || 0))}</td>
          <td class="cell text-right">${escapeHtml(formatMoney(amount))}</td>
          <td class="cell">${escapeHtml(item.note || '')}</td>
        </tr>
      `;
    })
    .join('');
};

const renderHandoverRows = (doc) => {
  const items = Array.isArray(doc?.data?.items) ? doc.data.items : [];

  return items
    .map((item, index) => {
      const dateValue = doc?.data?.exportDate || item.date || '';
      const productName = item.productName || item.product || '';
      const departmentUsage = item.departmentUsage || '';
      return `
        <tr>
          <td class="cell text-center">${index + 1}</td>
          <td class="cell text-center">${escapeHtml(formatDate(dateValue))}</td>
          <td class="cell">${escapeHtml(productName)}</td>
          <td class="cell text-center">${escapeHtml(item.unit || '')}</td>
          <td class="cell text-center">${escapeHtml(item.quantity || 0)}</td>
          <td class="cell multiline">${escapeHtml(departmentUsage)}</td>
          <td class="cell">&nbsp;</td>
          <td class="cell">${escapeHtml(item.note || '')}</td>
        </tr>
      `;
    })
    .join('');
};

export const buildDocumentPdfMarkup = (doc) => {
  const data = doc?.data || {};
  const docType = doc?.type || 'purchase';
  const isPurchase = docType === 'purchase';

  const subtotal = (Array.isArray(data.items) ? data.items : []).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );
  const vatRate = Number(data.vatRate || 0);
  const vatAmount = subtotal * (vatRate / 100);
  const totalPayment = subtotal + vatAmount;
  const amountText = getVietnameseAmountText(totalPayment);

  if (isPurchase) {
    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: 'Times New Roman', Arial, sans-serif; }
            body { width: 210mm; min-height: 297mm; padding: 12mm 10mm 8mm; }
            .page { width: 100%; min-height: 270mm; }
            .header-block { display: block; width: 100%; }
            .company-name { font-weight: 700; font-size: 17px; letter-spacing: 0.03em; }
            .company-address { font-size: 12px; margin-top: 2px; }
            .title { margin-top: 14px; text-align: center; font-size: 22px; font-weight: 700; text-transform: uppercase; }
            .subtitle { margin-top: 4px; text-align: center; font-size: 10px; font-style: italic; }
            .meta { margin-top: 12px; font-size: 12px; line-height: 1.7; }
            .meta-row { display: flex; justify-content: space-between; gap: 14px; }
            .meta-label { font-weight: 700; }
            .summary-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            .cell { border: 1px solid #000; padding: 4px 5px; vertical-align: top; background: #fff; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .caption { font-weight: 700; background: #f3f4f6; }
            .summary-box { margin-top: 12px; margin-left: auto; width: 48%; font-size: 12px; }
            .summary-row { display: flex; justify-content: space-between; width: 100%; padding: 4px 0; border-bottom: 1px solid #000; }
            .amount-words { margin-top: 10px; font-size: 12px; font-style: italic; }
            .date-line { margin-top: 18px; text-align: right; font-size: 12px; }
            .signature-row { margin-top: 24px; display: flex; justify-content: space-between; width: 100%; gap: 10px; font-size: 12px; }
            .signature-cell { width: 25%; text-align: center; }
            .signature-name { display: block; font-weight: 700; margin-bottom: 42px; }
            .signature-line { border-top: 1px solid #000; width: 100%; height: 1px; }
            .multiline { white-space: pre-line; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header-block">
              <div class="company-name">CÔNG TY TNHH TIẾN ANH</div>
              <div class="company-address">Đường Lê Thái Tổ, Khu Khả Lễ, Phường Võ Cường, Tỉnh Bắc Ninh</div>
            </div>

            <div class="title">ĐỀ XUẤT MUA SẮM</div>
            <div class="subtitle">(Vật tư, công cụ dụng cụ, văn phòng phẩm, tài sản cố định, chi phí hành chính)</div>

            <div class="meta">
              <div class="meta-row"><span><span class="meta-label">Người đề xuất:</span> ${escapeHtml(data.proposer || '')}</span></div>
              <div class="meta-row"><span><span class="meta-label">Phòng/ban:</span> ${escapeHtml(data.department || '')}</span></div>
              <div class="meta-row"><span><span class="meta-label">Lý do đề xuất:</span> ${escapeHtml(data.reason || '')}</span></div>
            </div>

            <table class="summary-table">
              <thead>
                <tr>
                  <th class="cell caption text-center" style="width: 6%;">STT</th>
                  <th class="cell caption" style="width: 30%;">Nội dung đề xuất</th>
                  <th class="cell caption text-center" style="width: 7%;">ĐVT</th>
                  <th class="cell caption text-center" style="width: 7%;">SL</th>
                  <th class="cell caption text-right" style="width: 16%;">Đơn giá</th>
                  <th class="cell caption text-right" style="width: 18%;">Thành tiền</th>
                  <th class="cell caption" style="width: 16%;">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                ${renderPurchaseRows(doc)}
              </tbody>
            </table>

            <div class="summary-box">
              <div class="summary-row"><span><strong>Tổng cộng</strong></span><span>${escapeHtml(formatMoney(subtotal))}</span></div>
              <div class="summary-row"><span><strong>VAT (${escapeHtml(Number(data.vatRate || 0))}%)</strong></span><span>${escapeHtml(formatMoney(vatAmount))}</span></div>
              <div class="summary-row"><span><strong>Thanh toán</strong></span><span>${escapeHtml(formatMoney(totalPayment))}</span></div>
            </div>
            <div class="amount-words">Số tiền bằng chữ: ${escapeHtml(amountText)} đồng</div>
            <div class="date-line">Ngày ... tháng ... năm ...</div>

            <div class="signature-row">
              <div class="signature-cell"><span class="signature-name">Giám đốc</span><div class="signature-line"></div></div>
              <div class="signature-cell"><span class="signature-name">Kế toán trưởng</span><div class="signature-line"></div></div>
              <div class="signature-cell"><span class="signature-name">Trưởng bộ phận</span><div class="signature-line"></div></div>
              <div class="signature-cell"><span class="signature-name">Người đề nghị</span><div class="signature-line"></div></div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; color: #111827; font-family: 'Times New Roman', Arial, sans-serif; }
          body { width: 210mm; min-height: 297mm; padding: 12mm 10mm 8mm; }
          .page { width: 100%; min-height: 270mm; }
          .company-name { font-weight: 700; font-size: 17px; }
          .company-address { font-size: 12px; margin-top: 2px; }
          .title { margin-top: 14px; text-align: center; font-size: 22px; font-weight: 700; text-transform: uppercase; }
          .subtitle { margin-top: 4px; text-align: center; font-size: 10px; font-style: italic; }
          .summary-table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 11px; }
          .cell { border: 1px solid #000; padding: 4px 5px; vertical-align: top; background: #fff; }
          .caption { background: #f3f4f6; font-weight: 700; text-align: center; }
          .text-center { text-align: center; }
          .multiline { white-space: pre-line; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="company-name">CÔNG TY TNHH TIẾN ANH</div>
          <div class="company-address">Đường Lê Thái Tổ, Khu Khả Lễ, Phường Võ Cường, Tỉnh Bắc Ninh</div>

          <div class="title">PHIẾU BÀN GIAO VĂN PHÒNG PHẨM</div>
          <div class="subtitle">(Vật tư, công cụ dụng cụ, văn phòng phẩm)</div>

          <table class="summary-table">
            <thead>
              <tr>
                <th class="cell caption" style="width: 6%;">STT</th>
                <th class="cell caption" style="width: 11%;">Ngày tháng</th>
                <th class="cell caption" style="width: 24%;">Tên, quy cách, chủng loại</th>
                <th class="cell caption" style="width: 8%;">ĐVT</th>
                <th class="cell caption" style="width: 7%;">SL</th>
                <th class="cell caption" style="width: 18%;">Bộ phận sử dụng</th>
                <th class="cell caption" style="width: 12%;">Ký nhận</th>
                <th class="cell caption" style="width: 14%;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${renderHandoverRows(doc)}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
};

export const DocumentPdfTemplate = ({ doc }) => (
  <div
    dangerouslySetInnerHTML={{
      __html: buildDocumentPdfMarkup(doc),
    }}
  />
);

export default DocumentPdfTemplate;
