import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, PencilLine, ChevronLeft, ChevronRight } from 'lucide-react';

const statusColors = {
  'In Stock': 'bg-emerald-100 text-emerald-700',
  'Low Stock': 'bg-amber-100 text-amber-700',
  'Out of Stock': 'bg-rose-100 text-rose-700',
  'Còn': 'bg-emerald-100 text-emerald-700',
  'Sắp hết': 'bg-amber-100 text-amber-700',
  'Hết': 'bg-rose-100 text-rose-700',
};

const statusLabels = {
  'In Stock': 'Còn',
  'Low Stock': 'Sắp hết',
  'Out of Stock': 'Hết',
  'Còn': 'Còn',
  'Sắp hết': 'Sắp hết',
  'Hết': 'Hết',
};

const pageSizes = [5, 10, 20];

export default function ProductManagement({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'Cái',
    quantity: 0,
    minThreshold: 0,
    location: 'Kệ mới',
  });

  const uniqueCategories = useMemo(() => {
    const categoryMap = new Map();
    products.forEach((p) => {
      const raw = p.category?.trim();
      if (raw) {
        const lower = raw.toLowerCase();
        if (!categoryMap.has(lower)) {
          const display = raw.charAt(0).toUpperCase() + raw.slice(1);
          categoryMap.set(lower, display);
        }
      }
    });
    return Array.from(categoryMap.values()).sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' })
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedCategory = category.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name?.toLowerCase().includes(normalizedSearch) ||
        product.sku?.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        category === 'all' ||
        product.category?.trim().toLowerCase() === normalizedCategory;
      const matchesStatus =
        statusFilter === 'all' ||
        product.stockStatus === statusFilter ||
        statusLabels[product.stockStatus] === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, category, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetForm = () => {
    setForm({
      name: '',
      sku: '',
      category: '',
      unit: 'Cái',
      quantity: 0,
      minThreshold: 0,
      location: 'Kệ mới',
    });
  };

  const openAddForm = () => {
    resetForm();
    setShowEditForm(false);
    setShowAddForm(true);
  };

  const openEditForm = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      unit: product.unit || 'Cái',
      quantity: Number(product.quantity || 0),
      minThreshold: Number(product.minThreshold || 0),
      location: product.location || 'Kệ mới',
    });
    setShowAddForm(false);
    setShowEditForm(true);
  };

  const submitAdd = async () => {
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || 'Khác',
      unit: form.unit.trim() || 'Cái',
      quantity: Number(form.quantity || 0),
      minThreshold: Number(form.minThreshold || 0),
      location: form.location.trim() || 'Kệ mới',
    };

    if (!payload.name || !payload.sku) {
      return;
    }

    const success = await onAddProduct(payload);
    if (success !== false) {
      setShowAddForm(false);
      resetForm();
    }
  };

  const submitEdit = async () => {
    if (!editingProduct?._id) return;

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      category: form.category.trim() || 'Khác',
      unit: form.unit.trim() || 'Cái',
      quantity: Number(form.quantity || 0),
      minThreshold: Number(form.minThreshold || 0),
      location: form.location.trim() || 'Kệ mới',
    };

    const success = await onUpdateProduct(editingProduct._id, payload);
    if (success !== false) {
      setShowEditForm(false);
      setEditingProduct(null);
      resetForm();
    }
  };

  const handleDeleteClick = async (product) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${product.name}?`)) {
      return;
    }

    await onDeleteProduct(product._id);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Kho hàng</h2>
          <p className="text-sm text-slate-500">Quản lý tồn kho và ngưỡng cảnh báo</p>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus size={16} />
          Thêm sản phẩm
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search size={16} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => {
                setCurrentPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Tìm theo tên hoặc SKU"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <select
            value={category}
            onChange={(event) => {
              setCurrentPage(1);
              setCategory(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
          >
            <option value="all">Tất cả danh mục</option>
            {uniqueCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setCurrentPage(1);
              setStatusFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="In Stock">Còn</option>
            <option value="Low Stock">Sắp hết</option>
            <option value="Out of Stock">Hết</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Hiển thị</label>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">Mã SKU</th>
              <th className="px-4 py-3 font-medium text-slate-700">Tên quy cách chủng loại</th>
              <th className="px-4 py-3 font-medium text-slate-700">ĐVT</th>
              <th className="px-4 py-3 font-medium text-slate-700">Tồn kho</th>
              <th className="px-4 py-3 font-medium text-slate-700">Trạng thái</th>
              <th className="px-4 py-3 font-medium text-slate-700">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {visibleProducts.length ? (
              visibleProducts.map((product) => (
                <tr key={product._id || product.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{product.sku}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{product.unit}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{product.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[product.stockStatus] || 'bg-slate-200 text-slate-700'}`}>
                      {statusLabels[product.stockStatus] || product.stockStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                      >
                        <PencilLine size={12} />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(product)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                      >
                        <Trash2 size={12} />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  Không có sản phẩm nào phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-slate-600">
          Trang {safePage} / {totalPages} (Tổng {filteredProducts.length} sản phẩm)
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={safePage === 1}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={14} />
            Trước
          </button>

          {[...Array(totalPages)].map((_, index) => {
            const pageNumber = index + 1;
            const isActive = pageNumber === safePage;

            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setCurrentPage(pageNumber)}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
                  }`}
              >
                {pageNumber}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={safePage === totalPages}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sau
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {showAddForm ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Thêm sản phẩm mới</h3>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-sm text-slate-500">
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên sản phẩm" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Mã SKU" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Loại sản phẩm (VD: Bút, Giấy, Dán,...)" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="ĐVT" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value || 0) })} placeholder="Tồn kho" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Vị trí" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddForm(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                Hủy
              </button>
              <button type="button" onClick={submitAdd} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                Lưu sản phẩm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditForm && editingProduct ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Sửa sản phẩm</h3>
              <button type="button" onClick={() => setShowEditForm(false)} className="text-sm text-slate-500">
                Đóng
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên sản phẩm" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Mã SKU" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Loại sản phẩm (VD: Bút, Giấy, Dán,...)" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="ĐVT" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value || 0) })} placeholder="Tồn kho" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Vị trí" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 outline-none" />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowEditForm(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                Hủy
              </button>
              <button type="button" onClick={submitEdit} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
