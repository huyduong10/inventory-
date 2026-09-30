import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Package, RefreshCw, Search, Users } from 'lucide-react';
import { api } from '../api/client';

const DEPARTMENTS = [
  'Kế toán',
  'Hành chính nhân sự',
  'Thu mua',
  'IT',
  'Ban Giám đốc',
  'Quản lí dự án',
];

const DEPT_COLORS = {
  'Kế toán': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-600' },
  'Hành chính nhân sự': { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-600' },
  'Thu mua': { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700', icon: 'text-emerald-600' },
  'IT': { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', badge: 'bg-sky-100 text-sky-700', icon: 'text-sky-600' },
  'Ban Giám đốc': { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700', icon: 'text-amber-600' },
  'Quản lí dự án': { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', badge: 'bg-rose-100 text-rose-700', icon: 'text-rose-600' },
};

const fallbackColor = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', badge: 'bg-slate-100 text-slate-700', icon: 'text-slate-600' };

const formatDate = (value) => {
  if (!value) return '---';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function DepartmentTracking() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [expandedProducts, setExpandedProducts] = useState(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/department-usage');
      setData(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    let result = data;

    if (selectedDepartment !== 'all') {
      result = result.filter((dept) => dept.department === selectedDepartment);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.map((dept) => {
        const matchedProducts = dept.products.filter(
          (p) =>
            (p.productName || '').toLowerCase().includes(q) ||
            (p.productSku || '').toLowerCase().includes(q)
        );
        if (matchedProducts.length > 0) {
          return { ...dept, products: matchedProducts };
        }
        return null;
      }).filter(Boolean);
    }

    return result;
  }, [data, selectedDepartment, searchQuery]);

  const totalStats = useMemo(() => {
    const totalDepts = data.length;
    const totalProducts = data.reduce((s, d) => s + d.products.length, 0);
    const totalQuantity = data.reduce((s, d) => s + d.totalQuantity, 0);
    const totalNotes = data.reduce((s, d) => s + d.noteCount, 0);
    return { totalDepts, totalProducts, totalQuantity, totalNotes };
  }, [data]);

  const toggleDept = (dept) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const toggleProduct = (key) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Theo dõi phòng ban</h2>
          <p className="text-sm text-slate-500">Xem danh sách sản phẩm đã bàn giao cho từng phòng ban</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>

          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm sản phẩm..."
              className="rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 w-48"
            />
          </div>

          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              if (e.target.value !== 'all') {
                setExpandedDepts(new Set([e.target.value]));
              }
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50"
          >
            <option value="all">Tất cả phòng ban</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Phòng ban', value: totalStats.totalDepts, icon: Building2, tone: 'bg-blue-50 text-blue-600' },
          { label: 'Loại sản phẩm', value: totalStats.totalProducts, icon: Package, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'Tổng SL đã giao', value: totalStats.totalQuantity, icon: Users, tone: 'bg-violet-50 text-violet-600' },
          { label: 'Phiếu bàn giao', value: totalStats.totalNotes, icon: ChevronRight, tone: 'bg-amber-50 text-amber-600' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2.5 ${tone}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-slate-900">{value.toLocaleString('vi-VN')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Department cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">
          <RefreshCw size={16} className="mr-2 animate-spin" />
          Đang tải dữ liệu...
        </div>
      ) : filteredData.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
          {data.length === 0
            ? 'Chưa có dữ liệu bàn giao. Hãy tạo phiếu bàn giao để bắt đầu theo dõi.'
            : 'Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredData.map((dept) => {
            const colors = DEPT_COLORS[dept.department] || fallbackColor;
            const isExpanded = expandedDepts.has(dept.department);

            return (
              <div key={dept.department} className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}>
                {/* Department header */}
                <button
                  type="button"
                  onClick={() => toggleDept(dept.department)}
                  className={`flex w-full items-center justify-between px-5 py-4 text-left transition-colors ${colors.bg} hover:opacity-90`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-white/80 p-2 ${colors.icon}`}>
                      <Building2 size={18} />
                    </div>
                    <div>
                      <h3 className={`text-base font-semibold ${colors.text}`}>{dept.department}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dept.products.length} loại sản phẩm • {dept.totalQuantity.toLocaleString('vi-VN')} đơn vị • {dept.noteCount} phiếu
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors.badge}`}>
                      {dept.totalQuantity.toLocaleString('vi-VN')} SP
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Product table */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">STT</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Tên sản phẩm</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Mã SKU</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">ĐVT</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Tổng SL đã nhận</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Số lần giao</th>
                          <th className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {dept.products.map((product, idx) => {
                          const productExpandKey = `${dept.department}::${product.productId}`;
                          const isProductExpanded = expandedProducts.has(productExpandKey);

                          return (
                            <>
                              <tr key={product.productId} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-600">{idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-slate-800">{product.productName}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product.productSku || '---'}</td>
                                <td className="px-4 py-3 text-slate-600">{product.unit || '---'}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
                                    {product.totalQuantity.toLocaleString('vi-VN')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{product.handovers.length} lần</td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => toggleProduct(productExpandKey)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                  >
                                    {isProductExpanded ? 'Ẩn' : 'Chi tiết'}
                                    <ChevronDown size={12} className={`transition-transform ${isProductExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </td>
                              </tr>

                              {isProductExpanded && (
                                <tr key={`${product.productId}-detail`}>
                                  <td colSpan={7} className="px-4 py-0">
                                    <div className="mb-3 mt-1 ml-6 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                                      <table className="min-w-full text-left text-xs">
                                        <thead>
                                          <tr className="bg-slate-100">
                                            <th className="px-3 py-2 font-medium text-slate-500">Mã phiếu</th>
                                            <th className="px-3 py-2 font-medium text-slate-500">Ngày giao</th>
                                            <th className="px-3 py-2 font-medium text-slate-500">Số lượng</th>
                                            <th className="px-3 py-2 font-medium text-slate-500">Người nhận</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {product.handovers.map((h, hIdx) => (
                                            <tr key={`${h.noteId}-${hIdx}`} className="hover:bg-slate-50">
                                              <td className="px-3 py-2 font-medium text-slate-700">{h.noteCode || '---'}</td>
                                              <td className="px-3 py-2 text-slate-600">{formatDate(h.date)}</td>
                                              <td className="px-3 py-2 font-semibold text-slate-800">{h.quantity.toLocaleString('vi-VN')}</td>
                                              <td className="px-3 py-2 text-slate-600">{h.receiverName || '---'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
