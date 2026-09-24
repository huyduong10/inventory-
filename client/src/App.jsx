import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, ClipboardList, FileDown, PackagePlus, Plus, Search, ShieldCheck, Warehouse, X } from 'lucide-react';
import { api } from './api/client';

const COMPANY_NAME = 'CÔNG TY TNHH TIẾN ANH';
const COMPANY_ADDRESS = 'Đường Lê Thái Tổ, Khu Khả Lễ, Phường Võ Cường, Tỉnh Bắc Ninh';
const departments = ['Kế toán', 'Nhân sự', 'Marketing', 'IT', 'Ban Giám đốc'];
const fallbackProducts = [
  { _id: 'p1', name: 'Bút bi Thiên Long', sku: 'BN-001', category: 'Bút', unit: 'Cái', quantity: 120, minThreshold: 25, location: 'Kệ A1', stockStatus: 'In Stock' },
  { _id: 'p2', name: 'Giấy Double A A4', sku: 'GI-001', category: 'Giấy', unit: 'Ram', quantity: 8, minThreshold: 10, location: 'Kệ B2', stockStatus: 'Low Stock' },
  { _id: 'p3', name: 'Kẹp ghim', sku: 'KG-001', category: 'Dụng cụ', unit: 'Hộp', quantity: 0, minThreshold: 8, location: 'Kệ C3', stockStatus: 'Out of Stock' },
  { _id: 'p4', name: 'Băng keo', sku: 'BK-001', category: 'Dán', unit: 'Cuộn', quantity: 28, minThreshold: 6, location: 'Kệ D1', stockStatus: 'In Stock' },
];

const initialPurchaseItems = [
  { id: Date.now(), content: 'Bút bi Thiên Long', unit: 'Cái', quantity: 20, unitPrice: 8500, note: 'Cần cho Phòng IT' },
];

const initialHandoverItems = [
  { id: Date.now(), product: 'Bút bi Thiên Long', productId: '', unit: 'Cái', quantity: 12, departmentUsage: 'IT: 12', note: 'Cấp công tác hàng ngày' },
];

const dashboardStats = [
  { title: 'Tổng sản phẩm', value: '1,248', icon: Boxes, tone: 'bg-blue-100 text-blue-700' },
  { title: 'Sắp hết hàng', value: '12', icon: AlertTriangle, tone: 'bg-amber-100 text-amber-700' },
  { title: 'Phiếu xuất hôm nay', value: '18', icon: ClipboardList, tone: 'bg-green-100 text-green-700' },
  { title: 'Đã hoàn tất', value: '94%', icon: ShieldCheck, tone: 'bg-violet-100 text-violet-700' },
];

const statusColors = {
  'In Stock': 'bg-emerald-100 text-emerald-700',
  'Low Stock': 'bg-amber-100 text-amber-700',
  'Out of Stock': 'bg-rose-100 text-rose-700',
};

const moneyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

const readUnderOneThousand = (value) => {
  if (value === 0) return '';
  const ones = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const tens = Math.floor(remainder / 10);
  const units = remainder % 10;

  let words = '';
  if (hundreds > 0) words += `${ones[hundreds]} trăm`;
  if (tens === 1) words += ' mười';
  else if (tens > 1) words += ` ${ones[tens]} mươi`;
  if (units > 0) {
    if (tens > 1 && units === 1) words += ' mốt';
    else if (units === 5 && tens > 0) words += ' lăm';
    else if (units === 4 && tens > 0) words += ' tư';
    else words += ` ${ones[units]}`;
  }
  return words.trim();
};

const numberToVietnameseWords = (value) => {
  const amount = Math.round(Number(value || 0));
  if (!Number.isFinite(amount) || amount < 0) return 'Số không hợp lệ';
  if (amount === 0) return 'không';

  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const groups = [];
  let remaining = Math.floor(amount);
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const chunks = groups.map((group, index) => {
    const text = readUnderOneThousand(group);
    if (!text) return '';
    const unitText = units[index] || '';
    return unitText ? `${text} ${unitText}` : text;
  });

  return chunks.reverse().join(' ').trim();
};

function PurchaseProposalPrint({ proposal }) {
  const subtotal = (proposal.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const vatRate = Number(proposal.vatRate || 10);
  const vatAmount = subtotal * (vatRate / 100);
  const totalPayment = subtotal + vatAmount;

  return (
    <section className="print-area a4-sheet hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mx-auto w-full max-w-[210mm]">
        <div className="border border-slate-300 p-4 text-center text-[13px] leading-5">
          <p className="font-bold uppercase">{COMPANY_NAME}</p>
          <p>{COMPANY_ADDRESS}</p>
          <p className="mt-3 text-[18px] font-bold uppercase">ĐỀ XUẤT MUA SẮM</p>
          <p className="italic">(Vật tư, công cụ dụng cụ, văn phòng phẩm, tài sản cố định, chi phí hành chính)</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p><span className="font-semibold">Người đề xuất:</span> {proposal.proposer || '---'}</p>
            <p><span className="font-semibold">Phòng/ban:</span> {proposal.department || '---'}</p>
          </div>
          <div>
            <p><span className="font-semibold">Lý do đề xuất:</span> {proposal.reason || '---'}</p>
            <p><span className="font-semibold">Ngày lập:</span> {proposal.date || new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden border border-slate-300">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-2 py-2">STT</th>
                <th className="border border-slate-300 px-2 py-2">Nội dung đề xuất</th>
                <th className="border border-slate-300 px-2 py-2">ĐVT</th>
                <th className="border border-slate-300 px-2 py-2">SL</th>
                <th className="border border-slate-300 px-2 py-2">Đơn giá</th>
                <th className="border border-slate-300 px-2 py-2">Thành tiền</th>
                <th className="border border-slate-300 px-2 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(proposal.items || []).map((item, index) => (
                <tr key={`${item.content}-${index}`}>
                  <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.content}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{item.unit}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{item.quantity}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right">{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto w-[40%] text-[12px]">
          <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2">
            <span className="font-semibold">Tổng cộng</span>
            <span className="text-right">{formatMoney(subtotal)}</span>
            <span className="font-semibold">VAT ({vatRate}%)</span>
            <span className="text-right">{formatMoney(vatAmount)}</span>
            <span className="font-semibold">Thanh toán</span>
            <span className="text-right">{formatMoney(totalPayment)}</span>
          </div>
          <p className="mt-3 text-[12px] italic">Số tiền bằng chữ: {numberToVietnameseWords(totalPayment)} đồng</p>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-4 text-center text-[12px]">
          {['Giám đốc', 'Kế toán trưởng', 'Trưởng bộ phận', 'Người đề nghị'].map((label) => (
            <div key={label}>
              <p className="font-semibold">{label}</p>
              <div className="mt-12 h-16 border-t border-slate-300"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HandoverPrint({ handover }) {
  return (
    <section className="print-area a4-sheet hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mx-auto w-full max-w-[210mm]">
        <div className="border border-slate-300 p-4 text-center text-[13px]">
          <p className="font-bold uppercase">{COMPANY_NAME}</p>
          <p>{COMPANY_ADDRESS}</p>
          <p className="mt-3 text-[18px] font-bold uppercase">PHIẾU BÀN GIAO VĂN PHÒNG PHẨM</p>
          <p className="italic">(Vật tư, công cụ dụng cụ, văn phòng phẩm)</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p><span className="font-semibold">Ngày:</span> {handover.exportDate || new Date().toISOString().slice(0, 10)}</p>
          </div>
          <div className="text-right">
            <p><span className="font-semibold">Số phiếu:</span> {handover.code || 'PBG-202609-001'}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden border border-slate-300">
          <table className="w-full border-collapse text-[12px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 px-2 py-2">STT</th>
                <th className="border border-slate-300 px-2 py-2">Ngày tháng</th>
                <th className="border border-slate-300 px-2 py-2">Tên, quy cách, chủng loại</th>
                <th className="border border-slate-300 px-2 py-2">ĐVT</th>
                <th className="border border-slate-300 px-2 py-2">SL</th>
                <th className="border border-slate-300 px-2 py-2">Bộ phận sử dụng</th>
                <th className="border border-slate-300 px-2 py-2">Ký nhận</th>
                <th className="border border-slate-300 px-2 py-2">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {(handover.items || []).map((item, index) => (
                <tr key={`${item.product}-${index}`}>
                  <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-2">{handover.exportDate || new Date().toISOString().slice(0, 10)}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.productName || item.product}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{item.unit}</td>
                  <td className="border border-slate-300 px-2 py-2 text-center">{item.quantity}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.departmentUsage}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.receiverSignature || handover.receiverName || '---'}</td>
                  <td className="border border-slate-300 px-2 py-2">{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid grid-cols-4 gap-4 text-center text-[12px]">
          {['Người lập', 'Thủ kho', 'Bộ phận nhận', 'Ký nhận'].map((label) => (
            <div key={label}>
              <p className="font-semibold">{label}</p>
              <div className="mt-12 h-16 border-t border-slate-300"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [products, setProducts] = useState(fallbackProducts);
  const [purchaseItems, setPurchaseItems] = useState(initialPurchaseItems);
  const [handoverItems, setHandoverItems] = useState(initialHandoverItems);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDocument, setPrintDocument] = useState(null);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', category: 'Bút', unit: 'Cái', quantity: 0, minThreshold: 5, location: 'Kệ Mới' });
  const [proposalForm, setProposalForm] = useState({
    proposer: 'Nguyễn Văn A',
    department: 'IT',
    reason: 'Cấp phát vật tư cho hoạt động hàng ngày của phòng IT.',
    date: new Date().toISOString().slice(0, 10),
    vatRate: 10,
  });
  const [handoverForm, setHandoverForm] = useState({
    code: 'PBG-202609-001',
    exportDate: new Date().toISOString().slice(0, 10),
    receiverName: 'Anh Hùng',
    department: 'IT',
  });

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      if (response?.data?.data?.length) {
        setProducts(response.data.data);
      }
    } catch (_error) {
      setProducts(fallbackProducts);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchTerm = search.toLowerCase();
      const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm) || product.sku.toLowerCase().includes(searchTerm);
      const matchesCategory = category === 'all' || product.category === category;
      const matchesStatus = statusFilter === 'all' || product.stockStatus === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, category, statusFilter]);

  const purchaseSummary = useMemo(() => {
    const subtotal = purchaseItems.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const vatAmount = subtotal * (Number(proposalForm.vatRate || 0) / 100);
    const totalPayment = subtotal + vatAmount;
    return { subtotal, vatAmount, totalPayment };
  }, [purchaseItems, proposalForm.vatRate]);

  const addToast = (message) => {
    setToast(message);
    window.clearTimeout(addToast.timeoutId);
    addToast.timeoutId = window.setTimeout(() => setToast(''), 2200);
  };

  const openPrintPreview = (documentType, documentData) => {
    setPrintDocument({ type: documentType, data: documentData });
    setShowPrintModal(true);
  };

  const handlePrintDocument = () => {
    if (!printDocument) return;
    window.print();
  };

  const handleEditProduct = (product) => {
    setEditingProduct({
      ...product,
      quantity: Number(product.quantity || 0),
      minThreshold: Number(product.minThreshold || 0),
    });
    setShowEditProduct(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct?._id) return;

    const payload = {
      name: editingProduct.name,
      sku: editingProduct.sku,
      category: editingProduct.category,
      unit: editingProduct.unit,
      quantity: Number(editingProduct.quantity || 0),
      minThreshold: Number(editingProduct.minThreshold || 0),
      location: editingProduct.location,
      description: editingProduct.description || '',
    };

    try {
      const response = await api.put(`/products/${editingProduct._id}`, payload);
      setProducts((current) => current.map((product) => (product._id === editingProduct._id ? response.data.data : product)));
      setShowEditProduct(false);
      setEditingProduct(null);
      addToast('Đã cập nhật sản phẩm');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Không thể cập nhật sản phẩm');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;

    try {
      await api.delete(`/products/${productId}`);
      setProducts((current) => current.filter((product) => product._id !== productId));
      addToast('Đã xóa sản phẩm');
    } catch (error) {
      addToast(error?.response?.data?.message || 'Không thể xóa sản phẩm');
    }
  };

  const updatePurchaseItem = (id, field, value) => {
    setPurchaseItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: field === 'quantity' || field === 'unitPrice' ? Number(value || 0) : value } : item
      )
    );
  };

  const addPurchaseItem = () => {
    setPurchaseItems((current) => [
      ...current,
      { id: Date.now(), content: '', unit: 'Cái', quantity: 1, unitPrice: 0, note: '' },
    ]);
  };

  const removePurchaseItem = (id) => {
    setPurchaseItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const updateHandoverItem = (id, field, value) => {
    setHandoverItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addHandoverItem = () => {
    setHandoverItems((current) => [
      ...current,
      { id: Date.now(), product: '', productId: '', unit: 'Cái', quantity: 1, departmentUsage: '', note: '' },
    ]);
  };

  const removeHandoverItem = (id) => {
    setHandoverItems((current) => (current.length === 1 ? current : current.filter((item) => item.id !== id)));
  };

  const handleAddProduct = () => {
    if (!newProduct.name.trim() || !newProduct.sku.trim()) {
      addToast('Vui lòng nhập tên và mã SKU');
      return;
    }

    const productPayload = {
      name: newProduct.name,
      sku: newProduct.sku,
      category: newProduct.category,
      unit: newProduct.unit,
      quantity: Number(newProduct.quantity || 0),
      minThreshold: Number(newProduct.minThreshold || 5),
      location: newProduct.location,
    };

    api
      .post('/products', productPayload)
      .then((response) => {
        setProducts((current) => [response.data.data, ...current]);
        setShowAddProduct(false);
        setNewProduct({ name: '', sku: '', category: 'Bút', unit: 'Cái', quantity: 0, minThreshold: 5, location: 'Kệ Mới' });
        addToast('Đã thêm sản phẩm mới');
      })
      .catch(() => {
        setProducts((current) => [
          {
            _id: `local-${Date.now()}`,
            ...productPayload,
            stockStatus: Number(productPayload.quantity) <= Number(productPayload.minThreshold) ? 'Low Stock' : 'In Stock',
          },
          ...current,
        ]);
        setShowAddProduct(false);
        setNewProduct({ name: '', sku: '', category: 'Bút', unit: 'Cái', quantity: 0, minThreshold: 5, location: 'Kệ Mới' });
        addToast('Đã thêm sản phẩm mới');
      });
  };

  const handleSavePurchaseProposal = async (status) => {
    const validItems = purchaseItems.filter((item) => item.content.trim() && Number(item.quantity || 0) > 0 && Number(item.unitPrice || 0) >= 0);
    if (!validItems.length) {
      addToast('Vui lòng nhập ít nhất một dòng đề xuất');
      return;
    }

    const payload = {
      code: `DXMS-${new Date().toISOString().slice(0, 7).replace(/-/g, '')}-${String(new Date().getDate()).padStart(2, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      proposer: proposalForm.proposer,
      department: proposalForm.department,
      reason: proposalForm.reason,
      date: proposalForm.date,
      vatRate: Number(proposalForm.vatRate || 0),
      status,
      items: validItems.map((item) => ({
        content: item.content,
        unit: item.unit,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        note: item.note,
      })),
    };

    try {
      const response = await api.post('/purchase-proposals', payload);
      addToast(`Đã lưu đề xuất ${response.data.data.code || 'mới'}`);
      setPurchaseItems(initialPurchaseItems);
      setProposalForm({
        proposer: 'Nguyễn Văn A',
        department: 'IT',
        reason: 'Cấp phát vật tư cho hoạt động hàng ngày của phòng IT.',
        date: new Date().toISOString().slice(0, 10),
        vatRate: 10,
      });
    } catch (error) {
      addToast(error?.response?.data?.message || 'Không thể lưu đề xuất');
    }
  };

  const handleSubmitHandover = async () => {
    const validItems = handoverItems.filter((item) => item.product && Number(item.quantity || 0) > 0);
    if (!validItems.length) {
      addToast('Vui lòng nhập ít nhất một dòng bàn giao');
      return;
    }

    const payload = {
      code: handoverForm.code || `PBG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      exportDate: handoverForm.exportDate,
      status: 'Completed',
      items: validItems.map((item) => {
        const matched = products.find((product) => product.name === item.product || product._id === item.productId || product.sku === item.product);
        return {
          product: matched?._id || item.productId || '',
          productName: matched?.name || item.product,
          unit: item.unit || matched?.unit || 'Cái',
          quantity: Number(item.quantity || 0),
          departmentUsage: item.departmentUsage,
          receiverSignature: handoverForm.receiverName,
          note: item.note,
        };
      }),
    };

    try {
      await api.post('/handover-notes', payload);
      addToast('Phiếu bàn giao đã được lưu');
      setHandoverItems(initialHandoverItems);
      setHandoverForm({ code: 'PBG-202609-001', exportDate: new Date().toISOString().slice(0, 10), receiverName: 'Anh Hùng', department: 'IT' });
    } catch (error) {
      addToast(error?.response?.data?.message || 'Không thể lưu phiếu bàn giao');
    }
  };

  return (
    <div className="min-h-screen p-6 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-8">
        {toast ? (
          <div className="fixed right-5 top-5 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        ) : null}

        <header className="no-print flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Warehouse Management</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Văn phòng phẩm & Xuất phiếu cấp phát</h1>
          </div>
          <button type="button" onClick={() => setShowAddProduct(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            <Plus size={16} />
            Thêm sản phẩm
          </button>
        </header>

        {showAddProduct ? (
          <div className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Thêm sản phẩm mới</h3>
              <button type="button" onClick={() => setShowAddProduct(false)} className="text-sm text-slate-500">Đóng</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Tên sản phẩm" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="SKU" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none">
                <option value="Bút">Bút</option>
                <option value="Giấy">Giấy</option>
                <option value="Dán">Dán</option>
                <option value="Dụng cụ">Dụng cụ</option>
              </select>
              <input value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="Đơn vị" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input type="number" value={newProduct.quantity} onChange={(e) => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })} placeholder="Số lượng" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input type="number" value={newProduct.minThreshold} onChange={(e) => setNewProduct({ ...newProduct, minThreshold: Number(e.target.value) })} placeholder="Ngưỡng cảnh báo" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={handleAddProduct} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                Lưu sản phẩm
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map(({ title, value, icon: Icon, tone }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{title}</p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
                </div>
                <div className={`rounded-xl p-3 ${tone}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Đề xuất mua sắm</h2>
                <p className="text-sm text-slate-500">Công ty Tiến Anh</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-600">
                Form A4
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Người đề xuất</label>
                <input value={proposalForm.proposer} onChange={(e) => setProposalForm({ ...proposalForm, proposer: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phòng/ban</label>
                <select value={proposalForm.department} onChange={(e) => setProposalForm({ ...proposalForm, department: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none">
                  {departments.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Lý do đề xuất</label>
                <textarea rows={3} value={proposalForm.reason} onChange={(e) => setProposalForm({ ...proposalForm, reason: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Ngày lập</label>
                <input type="date" value={proposalForm.date} onChange={(e) => setProposalForm({ ...proposalForm, date: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">VAT (%)</label>
                <input type="number" min="0" value={proposalForm.vatRate} onChange={(e) => setProposalForm({ ...proposalForm, vatRate: Number(e.target.value || 0) })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Bảng chi tiết</p>
                <button type="button" onClick={addPurchaseItem} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white">
                  <PackagePlus size={14} />
                  Thêm dòng
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2">STT</th>
                      <th className="px-2 py-2">Nội dung</th>
                      <th className="px-2 py-2">ĐVT</th>
                      <th className="px-2 py-2">SL</th>
                      <th className="px-2 py-2">Đơn giá</th>
                      <th className="px-2 py-2">Thành tiền</th>
                      <th className="px-2 py-2">Ghi chú</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.map((item, index) => (
                      <tr key={item.id}>
                        <td className="px-2 py-2 text-center">{index + 1}</td>
                        <td className="px-2 py-2"><input value={item.content} onChange={(e) => updatePurchaseItem(item.id, 'content', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none" /></td>
                        <td className="px-2 py-2"><input value={item.unit} onChange={(e) => updatePurchaseItem(item.id, 'unit', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none" /></td>
                        <td className="px-2 py-2"><input type="number" min="0" value={item.quantity} onChange={(e) => updatePurchaseItem(item.id, 'quantity', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none" /></td>
                        <td className="px-2 py-2"><input type="number" min="0" value={item.unitPrice} onChange={(e) => updatePurchaseItem(item.id, 'unitPrice', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none" /></td>
                        <td className="px-2 py-2 text-right font-medium">{formatMoney((Number(item.quantity || 0) * Number(item.unitPrice || 0)))}</td>
                        <td className="px-2 py-2"><input value={item.note} onChange={(e) => updatePurchaseItem(item.id, 'note', e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 outline-none" /></td>
                        <td className="px-2 py-2">
                          {purchaseItems.length > 1 ? (
                            <button type="button" onClick={() => removePurchaseItem(item.id)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={14} /></button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex justify-between text-sm"><span>Tổng cộng</span><span>{formatMoney(purchaseSummary.subtotal)}</span></div>
              <div className="mt-2 flex justify-between text-sm"><span>VAT</span><span>{formatMoney(purchaseSummary.vatAmount)}</span></div>
              <div className="mt-2 flex justify-between text-sm font-semibold"><span>Thanh toán</span><span>{formatMoney(purchaseSummary.totalPayment)}</span></div>
              <p className="mt-3 text-xs italic text-slate-600">Số tiền bằng chữ: {numberToVietnameseWords(purchaseSummary.totalPayment)} đồng</p>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => handleSavePurchaseProposal('Draft')} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">Lưu nháp</button>
              <button type="button" onClick={() => handleSavePurchaseProposal('Approved')} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">Phê duyệt</button>
            </div>

            <button type="button" onClick={() => openPrintPreview('purchase', {
              proposer: proposalForm.proposer,
              department: proposalForm.department,
              reason: proposalForm.reason,
              date: proposalForm.date,
              vatRate: proposalForm.vatRate,
              items: purchaseItems.map((item) => ({ ...item, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0) })),
            })} className="no-print mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <FileDown size={16} />
              Xuất bản A4 đề xuất mua sắm
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Phiếu bàn giao văn phòng phẩm</h2>
                <p className="text-sm text-slate-500">Xuất kho theo từng bộ phận</p>
              </div>
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-600">
                Form A4
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Số phiếu</label>
                <input value={handoverForm.code} onChange={(e) => setHandoverForm({ ...handoverForm, code: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Ngày xuất</label>
                <input type="date" value={handoverForm.exportDate} onChange={(e) => setHandoverForm({ ...handoverForm, exportDate: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Người nhận</label>
                <input value={handoverForm.receiverName} onChange={(e) => setHandoverForm({ ...handoverForm, receiverName: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phòng ban</label>
                <select value={handoverForm.department} onChange={(e) => setHandoverForm({ ...handoverForm, department: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none">
                  {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Danh sách giao hàng</p>
                <button type="button" onClick={addHandoverItem} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white">
                  <PackagePlus size={14} />
                  Thêm dòng
                </button>
              </div>

              {handoverItems.map((item, index) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Dòng #{index + 1}</span>
                    {handoverItems.length > 1 ? (
                      <button type="button" onClick={() => removeHandoverItem(item.id)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={14} /></button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select value={item.product} onChange={(e) => {
                      const selected = products.find((product) => product.name === e.target.value || product._id === e.target.value);
                      updateHandoverItem(item.id, 'product', selected?.name || e.target.value);
                      updateHandoverItem(item.id, 'productId', selected?._id || '');
                      updateHandoverItem(item.id, 'unit', selected?.unit || item.unit || 'Cái');
                    }} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none">
                      <option value="">Chọn sản phẩm</option>
                      {products.map((product) => <option key={product._id} value={product.name}>{product.name}</option>)}
                    </select>
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateHandoverItem(item.id, 'quantity', Number(e.target.value || 0))} placeholder="Số lượng" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none" />
                    <input value={item.unit} onChange={(e) => updateHandoverItem(item.id, 'unit', e.target.value)} placeholder="ĐVT" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none" />
                    <input value={item.departmentUsage} onChange={(e) => updateHandoverItem(item.id, 'departmentUsage', e.target.value)} placeholder="Ví dụ: HCNS, BQLDA: 10" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none" />
                    <input value={item.note} onChange={(e) => updateHandoverItem(item.id, 'note', e.target.value)} placeholder="Ghi chú" className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm outline-none md:col-span-2" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={handleSubmitHandover} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white">Hoàn tất bàn giao</button>
            </div>

            <button type="button" onClick={() => openPrintPreview('handover', {
              code: handoverForm.code,
              exportDate: handoverForm.exportDate,
              receiverName: handoverForm.receiverName,
              items: handoverItems.map((item) => ({
                product: item.product,
                productName: item.product,
                unit: item.unit,
                quantity: Number(item.quantity || 0),
                departmentUsage: item.departmentUsage,
                receiverSignature: handoverForm.receiverName,
                note: item.note,
              })),
            })} className="no-print mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <FileDown size={16} />
              Xuất bản A4 phiếu bàn giao
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Kho hàng</h2>
              <p className="text-sm text-slate-500">Quản lý tồn kho, cảnh báo mức tối thiểu</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={16} className="text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên/SKU" className="w-52 bg-transparent text-sm outline-none" />
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
              <option value="all">Tất cả danh mục</option>
              <option value="Bút">Bút</option>
              <option value="Giấy">Giấy</option>
              <option value="Dán">Dán</option>
              <option value="Dụng cụ">Dụng cụ</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none">
              <option value="all">Tất cả trạng thái</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Tồn kho</th>
                  <th className="px-4 py-3 font-medium">Kệ</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredProducts.map((product) => (
                  <tr key={product._id || product.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.sku}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{product.quantity} {product.unit}</td>
                    <td className="px-4 py-3 text-slate-500">{product.location}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[product.stockStatus] || 'bg-slate-200 text-slate-700'}`}>
                        {product.stockStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleEditProduct(product)} className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">Sửa</button>
                        <button type="button" onClick={() => handleDeleteProduct(product._id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {showEditProduct && editingProduct ? (
          <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Sửa sản phẩm</h3>
                <button type="button" onClick={() => setShowEditProduct(false)} className="text-sm text-slate-500">Đóng</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input value={editingProduct.name || ''} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} placeholder="Tên sản phẩm" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
                <input value={editingProduct.sku || ''} onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })} placeholder="SKU" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
                <select value={editingProduct.category || 'Bút'} onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none">
                  <option value="Bút">Bút</option>
                  <option value="Giấy">Giấy</option>
                  <option value="Dán">Dán</option>
                  <option value="Dụng cụ">Dụng cụ</option>
                </select>
                <input value={editingProduct.unit || ''} onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })} placeholder="Đơn vị" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
                <input type="number" value={editingProduct.quantity ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, quantity: Number(e.target.value || 0) })} placeholder="Số lượng" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
                <input type="number" value={editingProduct.minThreshold ?? 0} onChange={(e) => setEditingProduct({ ...editingProduct, minThreshold: Number(e.target.value || 0) })} placeholder="Ngưỡng cảnh báo" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
                <input value={editingProduct.location || ''} onChange={(e) => setEditingProduct({ ...editingProduct, location: e.target.value })} placeholder="Vị trí" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none md:col-span-2" />
                <textarea value={editingProduct.description || ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} placeholder="Ghi chú" rows={3} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none md:col-span-2" />
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEditProduct(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">Hủy</button>
                <button type="button" onClick={handleUpdateProduct} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Lưu thay đổi</button>
              </div>
            </div>
          </div>
        ) : null}

        {showPrintModal && printDocument ? (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="flex max-h-[90vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h3 className="text-lg font-semibold text-slate-900">Xem trước khi in</h3>
                <button type="button" onClick={() => setShowPrintModal(false)} className="text-sm text-slate-500">Đóng</button>
              </div>
              <div className="overflow-y-auto p-5">
                <div className="print-document-wrapper print-area rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  {printDocument.type === 'purchase' ? (
                    <div className="mx-auto w-full max-w-[210mm]">
                      <div className="border border-slate-300 p-4 text-center text-[13px] leading-5">
                        <p className="font-bold uppercase">{COMPANY_NAME}</p>
                        <p>{COMPANY_ADDRESS}</p>
                        <p className="mt-3 text-[18px] font-bold uppercase">ĐỀ XUẤT MUA SẮM</p>
                        <p className="italic">(Vật tư, công cụ dụng cụ, văn phòng phẩm, tài sản cố định, chi phí hành chính)</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                        <div>
                          <p><span className="font-semibold">Người đề xuất:</span> {printDocument.data.proposer || '---'}</p>
                          <p><span className="font-semibold">Phòng/ban:</span> {printDocument.data.department || '---'}</p>
                        </div>
                        <div>
                          <p><span className="font-semibold">Lý do đề xuất:</span> {printDocument.data.reason || '---'}</p>
                          <p><span className="font-semibold">Ngày lập:</span> {printDocument.data.date || new Date().toISOString().slice(0, 10)}</p>
                        </div>
                      </div>
                      <div className="mt-4 overflow-hidden border border-slate-300">
                        <table className="w-full border-collapse text-[12px]">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="border border-slate-300 px-2 py-2">STT</th>
                              <th className="border border-slate-300 px-2 py-2">Nội dung đề xuất</th>
                              <th className="border border-slate-300 px-2 py-2">ĐVT</th>
                              <th className="border border-slate-300 px-2 py-2">SL</th>
                              <th className="border border-slate-300 px-2 py-2">Đơn giá</th>
                              <th className="border border-slate-300 px-2 py-2">Thành tiền</th>
                              <th className="border border-slate-300 px-2 py-2">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(printDocument.data.items || []).map((item, index) => (
                              <tr key={`${item.content || item.note || 'row'}-${index}`}>
                                <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.content}</td>
                                <td className="border border-slate-300 px-2 py-2 text-center">{item.unit}</td>
                                <td className="border border-slate-300 px-2 py-2 text-center">{item.quantity}</td>
                                <td className="border border-slate-300 px-2 py-2 text-right">{formatMoney(item.unitPrice)}</td>
                                <td className="border border-slate-300 px-2 py-2 text-right">{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 ml-auto w-[40%] text-[12px]">
                        <div className="grid grid-cols-2 gap-2 border border-slate-300 p-2">
                          <span className="font-semibold">Tổng cộng</span>
                          <span className="text-right">{formatMoney((printDocument.data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0))}</span>
                          <span className="font-semibold">VAT ({Number(printDocument.data.vatRate || 0)}%)</span>
                          <span className="text-right">{formatMoney((printDocument.data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) * (Number(printDocument.data.vatRate || 0) / 100))}</span>
                          <span className="font-semibold">Thanh toán</span>
                          <span className="text-right">{formatMoney((printDocument.data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) * (1 + (Number(printDocument.data.vatRate || 0) / 100)))}</span>
                        </div>
                        <p className="mt-3 text-[12px] italic">Số tiền bằng chữ: {numberToVietnameseWords((printDocument.data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0) * (1 + (Number(printDocument.data.vatRate || 0) / 100)))} đồng</p>
                      </div>
                      <div className="mt-8 grid grid-cols-4 gap-4 text-center text-[12px]">
                        {['Giám đốc', 'Kế toán trưởng', 'Trưởng bộ phận', 'Người đề nghị'].map((label) => (
                          <div key={label}>
                            <p className="font-semibold">{label}</p>
                            <div className="mt-12 h-16 border-t border-slate-300"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-[210mm]">
                      <div className="border border-slate-300 p-4 text-center text-[13px]">
                        <p className="font-bold uppercase">{COMPANY_NAME}</p>
                        <p>{COMPANY_ADDRESS}</p>
                        <p className="mt-3 text-[18px] font-bold uppercase">PHIẾU BÀN GIAO VĂN PHÒNG PHẨM</p>
                        <p className="italic">(Vật tư, công cụ dụng cụ, văn phòng phẩm)</p>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                        <div>
                          <p><span className="font-semibold">Ngày:</span> {printDocument.data.exportDate || new Date().toISOString().slice(0, 10)}</p>
                        </div>
                        <div className="text-right">
                          <p><span className="font-semibold">Số phiếu:</span> {printDocument.data.code || 'PBG-202609-001'}</p>
                        </div>
                      </div>
                      <div className="mt-4 overflow-hidden border border-slate-300">
                        <table className="w-full border-collapse text-[12px]">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="border border-slate-300 px-2 py-2">STT</th>
                              <th className="border border-slate-300 px-2 py-2">Ngày tháng</th>
                              <th className="border border-slate-300 px-2 py-2">Tên, quy cách, chủng loại</th>
                              <th className="border border-slate-300 px-2 py-2">ĐVT</th>
                              <th className="border border-slate-300 px-2 py-2">SL</th>
                              <th className="border border-slate-300 px-2 py-2">Bộ phận sử dụng</th>
                              <th className="border border-slate-300 px-2 py-2">Ký nhận</th>
                              <th className="border border-slate-300 px-2 py-2">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(printDocument.data.items || []).map((item, index) => (
                              <tr key={`${item.product || item.productName || 'row'}-${index}`}>
                                <td className="border border-slate-300 px-2 py-2 text-center">{index + 1}</td>
                                <td className="border border-slate-300 px-2 py-2">{printDocument.data.exportDate || new Date().toISOString().slice(0, 10)}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.productName || item.product}</td>
                                <td className="border border-slate-300 px-2 py-2 text-center">{item.unit}</td>
                                <td className="border border-slate-300 px-2 py-2 text-center">{item.quantity}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.departmentUsage}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.receiverSignature || printDocument.data.receiverName || '---'}</td>
                                <td className="border border-slate-300 px-2 py-2">{item.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-8 grid grid-cols-4 gap-4 text-center text-[12px]">
                        {['Người lập', 'Thủ kho', 'Bộ phận nhận', 'Ký nhận'].map((label) => (
                          <div key={label}>
                            <p className="font-semibold">{label}</p>
                            <div className="mt-12 h-16 border-t border-slate-300"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="no-print flex justify-end gap-3 border-t border-slate-200 px-5 py-3">
                <button type="button" onClick={() => setShowPrintModal(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">Đóng</button>
                <button type="button" onClick={handlePrintDocument} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">In phiếu</button>
              </div>
            </div>
          </div>
        ) : null}

        <PurchaseProposalPrint proposal={{
          proposer: proposalForm.proposer,
          department: proposalForm.department,
          reason: proposalForm.reason,
          date: proposalForm.date,
          vatRate: proposalForm.vatRate,
          items: purchaseItems.map((item) => ({ ...item, quantity: Number(item.quantity || 0), unitPrice: Number(item.unitPrice || 0) })),
        }} />

        <HandoverPrint handover={{
          code: handoverForm.code,
          exportDate: handoverForm.exportDate,
          receiverName: handoverForm.receiverName,
          items: handoverItems.map((item) => ({
            product: item.product,
            productName: item.product,
            unit: item.unit,
            quantity: Number(item.quantity || 0),
            departmentUsage: item.departmentUsage,
            receiverSignature: handoverForm.receiverName,
            note: item.note,
          })),
        }} />
      </div>
    </div>
  );
}

export default App;
