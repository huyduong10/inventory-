import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Trash2 } from 'lucide-react';

const COMPANY_NAME = 'CÔNG TY TNHH TIẾN ANH';

const generateHandoverCode = () => `PBG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const initialPurchaseItems = [
  { id: Date.now(), content: '', unit: 'Cái', quantity: 1, unitPrice: 0, note: '' },
];

const initialHandoverItems = [
  { id: Date.now(), product: '', productId: '', unit: 'Cái', quantity: 1, departmentUsage: '', note: '' },
];

const numberToVietnameseWords = (value) => {
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
      if (tens > 1 && units === 1) words += ' mốt';
      else if (tens > 1 && units === 5) words += ' lăm';
      else if (tens > 1 && units === 4) words += ' tư';
      else words += ` ${ones[units]}`;
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

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));

export default function DocumentCreation({
  products,
  editingDocument,
  onSavePurchaseDocument,
  onSaveHandoverDocument,
}) {
  const [activeTab, setActiveTab] = useState('purchase');
  const [purchaseForm, setPurchaseForm] = useState({
    name: `Đề xuất mua sắm ${new Date().toLocaleDateString('vi-VN')}`,
    proposer: 'Nguyễn Văn A',
    department: 'IT',
    reason: 'Cấp phát vật tư cho hoạt động hàng ngày của phòng IT.',
    date: new Date().toISOString().slice(0, 10),
    vatRate: 10,
    items: initialPurchaseItems,
  });
  const [handoverForm, setHandoverForm] = useState({
    name: `Phiếu bàn giao ${new Date().toLocaleDateString('vi-VN')}`,
    code: generateHandoverCode(),
    exportDate: new Date().toISOString().slice(0, 10),
    receiverName: 'Anh Hùng',
    department: 'IT',
    items: initialHandoverItems,
  });

  useEffect(() => {
    if (!editingDocument) return;

    const documentData = editingDocument.data || {};

    if (editingDocument.type === 'purchase') {
      setActiveTab('purchase');
      setPurchaseForm({
        name: documentData.name || `Đề xuất mua sắm ${new Date().toLocaleDateString('vi-VN')}`,
        proposer: documentData.proposer || 'Nguyễn Văn A',
        department: documentData.department || 'IT',
        reason: documentData.reason || '',
        date: documentData.date || new Date().toISOString().slice(0, 10),
        vatRate: Number(documentData.vatRate || 10),
        items: Array.isArray(documentData.items) && documentData.items.length
          ? documentData.items.map((item, index) => ({
              id: item.id || `${Date.now()}-${index}`,
              content: item.content || '',
              unit: item.unit || 'Cái',
              quantity: Number(item.quantity || 0),
              unitPrice: Number(item.unitPrice || 0),
              note: item.note || '',
            }))
          : [{ id: Date.now(), content: '', unit: 'Cái', quantity: 1, unitPrice: 0, note: '' }],
      });
      return;
    }

    setActiveTab('handover');
    setHandoverForm({
      name: documentData.name || `Phiếu bàn giao ${new Date().toLocaleDateString('vi-VN')}`,
      code: documentData.code || generateHandoverCode(),
      exportDate: documentData.exportDate || new Date().toISOString().slice(0, 10),
      receiverName: documentData.receiverName || 'Anh Hùng',
      department: documentData.department || 'IT',
      items: Array.isArray(documentData.items) && documentData.items.length
        ? documentData.items.map((item, index) => ({
            id: item.id || `${Date.now()}-${index}`,
            product: item.productName || item.product || '',
            productId: item.productId || '',
            unit: item.unit || 'Cái',
            quantity: Number(item.quantity || 0),
            departmentUsage: item.departmentUsage || '',
            note: item.note || '',
          }))
        : [{ id: Date.now(), product: '', productId: '', unit: 'Cái', quantity: 1, departmentUsage: '', note: '' }],
    });
  }, [editingDocument]);

  const purchaseSummary = useMemo(() => {
    const subtotal = purchaseForm.items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0
    );
    const vatAmount = subtotal * (Number(purchaseForm.vatRate || 0) / 100);
    const totalPayment = subtotal + vatAmount;
    return { subtotal, vatAmount, totalPayment };
  }, [purchaseForm.items, purchaseForm.vatRate]);

  const updatePurchaseItem = (id, field, value) => {
    setPurchaseForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: field === 'quantity' || field === 'unitPrice' ? Number(value || 0) : value,
            }
          : item
      ),
    }));
  };

  const addPurchaseItem = () => {
    setPurchaseForm((current) => ({
      ...current,
      items: [...current.items, { id: Date.now(), content: '', unit: 'Cái', quantity: 1, unitPrice: 0, note: '' }],
    }));
  };

  const removePurchaseItem = (id) => {
    setPurchaseForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  };

  const addHandoverItem = () => {
    setHandoverForm((current) => ({
      ...current,
      items: [...current.items, { id: Date.now(), product: '', productId: '', unit: 'Cái', quantity: 1, departmentUsage: '', note: '' }],
    }));
  };

  const removeHandoverItem = (id) => {
    setHandoverForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  };

  const updateHandoverItem = (id, field, value) => {
    setHandoverForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;

        if (field === 'product') {
          const selectedProduct = products.find((product) => product._id === value || product.name === value);
          return {
            ...item,
            product: selectedProduct?._id || value,
            productId: selectedProduct?._id || value,
            productName: selectedProduct?.name || item.productName || '',
            unit: selectedProduct?.unit || item.unit || 'Cái',
          };
        }

        return { ...item, [field]: value };
      }),
    }));
  };

  const handleSavePurchase = () => {
    const validItems = purchaseForm.items.filter((item) => item.content?.trim() && Number(item.quantity || 0) > 0);
    if (!validItems.length) {
      return;
    }

    const payload = {
      name: purchaseForm.name.trim() || `Đề xuất mua sắm ${new Date().toLocaleDateString('vi-VN')}`,
      proposer: purchaseForm.proposer,
      department: purchaseForm.department,
      reason: purchaseForm.reason,
      date: purchaseForm.date,
      vatRate: Number(purchaseForm.vatRate || 0),
      items: purchaseForm.items.map((item) => ({
        id: item.id,
        content: item.content,
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        note: item.note,
      })),
    };

    onSavePurchaseDocument(payload, editingDocument?.id);
    setPurchaseForm({
      name: `Đề xuất mua sắm ${new Date().toLocaleDateString('vi-VN')}`,
      proposer: 'Nguyễn Văn A',
      department: 'IT',
      reason: 'Cấp phát vật tư cho hoạt động hàng ngày của phòng IT.',
      date: new Date().toISOString().slice(0, 10),
      vatRate: 10,
      items: [{ id: Date.now(), content: '', unit: 'Cái', quantity: 1, unitPrice: 0, note: '' }],
    });
  };

  const handleSaveHandover = () => {
    const validItems = handoverForm.items.filter((item) => item.product && Number(item.quantity || 0) > 0);
    if (!validItems.length) {
      return;
    }

    const payload = {
      name: handoverForm.name.trim() || `Phiếu bàn giao ${new Date().toLocaleDateString('vi-VN')}`,
      code: handoverForm.code,
      exportDate: handoverForm.exportDate,
      receiverName: handoverForm.receiverName,
      department: handoverForm.department,
      items: handoverForm.items.map((item) => ({
        id: item.id,
        product: item.productId || item.product || '',
        productId: item.productId || item.product || '',
        productName: products.find((product) => product._id === (item.productId || item.product))?.name || item.productName || item.product || '',
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        departmentUsage: item.departmentUsage,
        note: item.note,
      })),
    };

    onSaveHandoverDocument(payload, editingDocument?.id);
    setHandoverForm({
      name: `Phiếu bàn giao ${new Date().toLocaleDateString('vi-VN')}`,
      code: generateHandoverCode(),
      exportDate: new Date().toISOString().slice(0, 10),
      receiverName: 'Anh Hùng',
      department: 'IT',
      items: [{ id: Date.now(), product: '', productId: '', unit: 'Cái', quantity: 1, departmentUsage: '', note: '' }],
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tạo phiếu mới</h2>
          <p className="text-sm text-slate-500">Nhập và lưu các loại bảng biểu trong hệ thống quản lý</p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('purchase')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'purchase' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Đề xuất mua sắm
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('handover')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'handover' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Phiếu bàn giao
          </button>
        </div>
      </div>

      {activeTab === 'purchase' ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CÔNG TY TNHH TIẾN ANH</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">ĐỀ XUẤT MUA SẮM</h3>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-600">
                A4
              </div>
            </div>

            <p className="text-sm text-slate-600">(Vật tư, công cụ dụng cụ, văn phòng phẩm, tài sản cố định, chi phí hành chính)</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Tên phiếu</label>
              <input
                value={purchaseForm.name}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Ngày lập</label>
              <input
                type="date"
                value={purchaseForm.date}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, date: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Người đề xuất</label>
              <input
                value={purchaseForm.proposer}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, proposer: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phòng/ban</label>
              <select
                value={purchaseForm.department}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, department: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              >
                {['Kế toán', 'Nhân sự', 'Marketing', 'IT', 'Ban Giám đốc'].map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Lý do đề xuất</label>
              <textarea
                rows={3}
                value={purchaseForm.reason}
                onChange={(event) => setPurchaseForm({ ...purchaseForm, reason: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Bảng chi tiết</p>
              <button
                type="button"
                onClick={addPurchaseItem}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <PackagePlus size={14} />
                Thêm dòng
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-2">STT</th>
                    <th className="px-2 py-2">Nội dung đề xuất</th>
                    <th className="px-2 py-2">ĐVT</th>
                    <th className="px-2 py-2">SL</th>
                    <th className="px-2 py-2">Đơn giá</th>
                    <th className="px-2 py-2">Thành tiền</th>
                    <th className="px-2 py-2">Ghi chú</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {purchaseForm.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2 text-center">{index + 1}</td>
                      <td className="px-2 py-2">
                        <input
                          value={item.content}
                          onChange={(event) => updatePurchaseItem(item.id, 'content', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.unit}
                          onChange={(event) => updatePurchaseItem(item.id, 'unit', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(event) => updatePurchaseItem(item.id, 'quantity', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(event) => updatePurchaseItem(item.id, 'unitPrice', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        {formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={item.note}
                          onChange={(event) => updatePurchaseItem(item.id, 'note', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none"
                        />
                      </td>
                      <td className="px-2 py-2">
                        {purchaseForm.items.length > 1 ? (
                          <button type="button" onClick={() => removePurchaseItem(item.id)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-sm"><span>Tổng cộng</span><span>{formatMoney(purchaseSummary.subtotal)}</span></div>
            <div className="mt-2 flex justify-between text-sm"><span>VAT ({purchaseForm.vatRate}%)</span><span>{formatMoney(purchaseSummary.vatAmount)}</span></div>
            <div className="mt-2 flex justify-between text-sm font-semibold"><span>Tổng thanh toán</span><span>{formatMoney(purchaseSummary.totalPayment)}</span></div>
            <p className="mt-3 text-xs italic text-slate-600">Số tiền bằng chữ: {numberToVietnameseWords(purchaseSummary.totalPayment)} đồng</p>
          </div>

          <button type="button" onClick={handleSavePurchase} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
            Lưu phiếu
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{COMPANY_NAME}</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">PHIẾU BÀN GIAO VĂN PHÒNG PHẨM</h3>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-600">
                A4
              </div>
            </div>

            <p className="text-sm text-slate-600">(Vật tư, công cụ dụng cụ, văn phòng phẩm)</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Tên phiếu</label>
              <input
                value={handoverForm.name}
                onChange={(event) => setHandoverForm({ ...handoverForm, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Số phiếu</label>
              <input
                value={handoverForm.code}
                onChange={(event) => setHandoverForm({ ...handoverForm, code: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Ngày xuất</label>
              <input
                type="date"
                value={handoverForm.exportDate}
                onChange={(event) => setHandoverForm({ ...handoverForm, exportDate: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phòng ban</label>
              <select
                value={handoverForm.department}
                onChange={(event) => setHandoverForm({ ...handoverForm, department: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              >
                {['Kế toán', 'Nhân sự', 'Marketing', 'IT', 'Ban Giám đốc'].map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Người nhận</label>
              <input
                value={handoverForm.receiverName}
                onChange={(event) => setHandoverForm({ ...handoverForm, receiverName: event.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Danh sách giao hàng</p>
              <button
                type="button"
                onClick={addHandoverItem}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <Plus size={14} />
                Thêm dòng
              </button>
            </div>

            {handoverForm.items.map((item, index) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Dòng {index + 1}</span>
                  {handoverForm.items.length > 1 ? (
                    <button type="button" onClick={() => removeHandoverItem(item.id)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={item.productId || item.product || ''}
                    onChange={(event) => updateHandoverItem(item.id, 'product', event.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none"
                  >
                    <option value="">Chọn sản phẩm</option>
                    {products.map((product) => (
                      <option key={product._id || product.name} value={product._id}>{product.name}</option>
                    ))}
                  </select>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
                    {item.productId || item.product ? (
                      <span className="text-slate-600">
                        Tồn kho hiện tại: {products.find((product) => product._id === (item.productId || item.product))?.quantity ?? 0}
                      </span>
                    ) : (
                      <span className="text-slate-400">Chưa chọn sản phẩm</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateHandoverItem(item.id, 'quantity', Number(event.target.value || 0))}
                    placeholder="Số lượng"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none"
                  />
                  <input
                    value={item.unit}
                    onChange={(event) => updateHandoverItem(item.id, 'unit', event.target.value)}
                    placeholder="ĐVT"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none"
                  />
                  <input
                    value={item.departmentUsage}
                    onChange={(event) => updateHandoverItem(item.id, 'departmentUsage', event.target.value)}
                    placeholder="Ví dụ: BQLDA: 10, HCNS: 15"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none md:col-span-2"
                  />
                  <input
                    value={item.note}
                    onChange={(event) => updateHandoverItem(item.id, 'note', event.target.value)}
                    placeholder="Ghi chú"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none md:col-span-2"
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleSaveHandover} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white">
            Lưu phiếu
          </button>
        </div>
      )}
    </section>
  );
}
