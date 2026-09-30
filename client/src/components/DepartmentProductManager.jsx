import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Package,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
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
  'Kế toán': {
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    border: '#bfdbfe',
    text: '#1e40af',
    badge: '#dbeafe',
    badgeText: '#1d4ed8',
    accent: '#3b82f6',
    icon: '#2563eb',
  },
  'Hành chính nhân sự': {
    bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
    border: '#ddd6fe',
    text: '#5b21b6',
    badge: '#ede9fe',
    badgeText: '#6d28d9',
    accent: '#8b5cf6',
    icon: '#7c3aed',
  },
  'Thu mua': {
    bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    border: '#a7f3d0',
    text: '#065f46',
    badge: '#d1fae5',
    badgeText: '#047857',
    accent: '#10b981',
    icon: '#059669',
  },
  IT: {
    bg: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    border: '#bae6fd',
    text: '#075985',
    badge: '#e0f2fe',
    badgeText: '#0369a1',
    accent: '#0ea5e9',
    icon: '#0284c7',
  },
  'Ban Giám đốc': {
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    border: '#fde68a',
    text: '#92400e',
    badge: '#fef3c7',
    badgeText: '#b45309',
    accent: '#f59e0b',
    icon: '#d97706',
  },
  'Quản lí dự án': {
    bg: 'linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%)',
    border: '#fda4af',
    text: '#9f1239',
    badge: '#fecdd3',
    badgeText: '#be123c',
    accent: '#f43f5e',
    icon: '#e11d48',
  },
};

const FALLBACK_COLOR = {
  bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  border: '#e2e8f0',
  text: '#334155',
  badge: '#f1f5f9',
  badgeText: '#475569',
  accent: '#64748b',
  icon: '#475569',
};

const PAGE_SIZES = [5, 10, 20, 50];

const formatDate = (value) => {
  if (!value) return '---';
  return new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const removeVietnameseTones = (str = '') =>
  String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

export default function DepartmentProductManager() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortField, setSortField] = useState('totalQuantity');
  const [sortDirection, setSortDirection] = useState('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/department-usage');
      setData(Array.isArray(response?.data?.data) ? response.data.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Flatten: build a product-centric list from department data
  const allProducts = useMemo(() => {
    const productMap = new Map();

    for (const dept of data) {
      for (const product of dept.products || []) {
        const key = `${dept.department}::${product.productId}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            key,
            department: dept.department,
            productId: product.productId,
            productName: product.productName,
            productSku: product.productSku,
            unit: product.unit,
            totalQuantity: product.totalQuantity,
            handoverCount: product.handovers?.length || 0,
            handovers: product.handovers || [],
          });
        }
      }
    }

    return Array.from(productMap.values());
  }, [data]);

  // Filter + search
  const filteredProducts = useMemo(() => {
    let result = allProducts;

    if (selectedDepartment !== 'all') {
      result = result.filter((p) => p.department === selectedDepartment);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const qNorm = removeVietnameseTones(q);
      result = result.filter((p) => {
        const name = (p.productName || '').toLowerCase();
        const sku = (p.productSku || '').toLowerCase();
        return (
          name.includes(q) ||
          sku.includes(q) ||
          removeVietnameseTones(name).includes(qNorm) ||
          removeVietnameseTones(sku).includes(qNorm)
        );
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'productName') {
        cmp = (a.productName || '').localeCompare(b.productName || '', 'vi');
      } else if (sortField === 'department') {
        cmp = (a.department || '').localeCompare(b.department || '', 'vi');
      } else if (sortField === 'totalQuantity') {
        cmp = a.totalQuantity - b.totalQuantity;
      } else if (sortField === 'handoverCount') {
        cmp = a.handoverCount - b.handoverCount;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allProducts, selectedDepartment, searchQuery, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const deptSet = new Set(filteredProducts.map((p) => p.department));
    const totalProducts = filteredProducts.length;
    const totalQuantity = filteredProducts.reduce((s, p) => s + p.totalQuantity, 0);
    const totalHandovers = filteredProducts.reduce((s, p) => s + p.handoverCount, 0);
    return { departments: deptSet.size, totalProducts, totalQuantity, totalHandovers };
  }, [filteredProducts]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const visibleProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleRow = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const getColor = (dept) => DEPT_COLORS[dept] || FALLBACK_COLOR;

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />;
    return (
      <ChevronDown
        size={12}
        style={{
          transform: sortDirection === 'asc' ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}
      />
    );
  };

  return (
    <section
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-40px',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '30%',
            width: '120px',
            height: '120px',
            background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  borderRadius: '12px',
                  padding: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClipboardList size={22} color="#fff" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                Quản lý CCDC theo phòng ban
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, paddingLeft: '54px' }}>
              Danh sách công cụ dụng cụ đã bàn giao cho từng phòng ban • Lọc theo phòng ban để xem chi tiết
            </p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: '#e2e8f0',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ padding: '20px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        {[
          { label: 'Phòng ban', value: stats.departments, icon: Building2, gradient: 'linear-gradient(135deg, #eff6ff, #dbeafe)', iconColor: '#3b82f6' },
          { label: 'Loại sản phẩm', value: stats.totalProducts, icon: Package, gradient: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', iconColor: '#10b981' },
          { label: 'Tổng SL đã giao', value: stats.totalQuantity, icon: Users, gradient: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', iconColor: '#8b5cf6' },
          { label: 'Lần bàn giao', value: stats.totalHandovers, icon: ClipboardList, gradient: 'linear-gradient(135deg, #fffbeb, #fef3c7)', iconColor: '#f59e0b' },
        ].map(({ label, value, icon: Icon, gradient, iconColor }) => (
          <div
            key={label}
            style={{
              background: gradient,
              borderRadius: '14px',
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: '10px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              <Icon size={18} color={iconColor} />
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: 500 }}>{label}</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {value.toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          padding: '20px 28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
          <Filter size={14} />
          Bộ lọc
        </div>

        {/* Department filter */}
        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: '8px 32px 8px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: selectedDepartment !== 'all'
              ? (getColor(selectedDepartment).badge || '#f1f5f9')
              : '#fff',
            color: selectedDepartment !== 'all'
              ? (getColor(selectedDepartment).text || '#334155')
              : '#334155',
            fontSize: '13px',
            fontWeight: 500,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            transition: 'all 0.2s',
          }}
        >
          <option value="all">Tất cả phòng ban</option>
          {DEPARTMENTS.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>

        {selectedDepartment !== 'all' && (
          <button
            type="button"
            onClick={() => { setSelectedDepartment('all'); setCurrentPage(1); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <X size={12} />
            Bỏ lọc
          </button>
        )}

        <div style={{ flex: 1, minWidth: '200px' }} />

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            minWidth: '240px',
            transition: 'border-color 0.2s',
          }}
        >
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Tìm tên sản phẩm hoặc SKU..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '13px',
              color: '#334155',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={14} color="#94a3b8" />
            </button>
          )}
        </div>

        {/* Page size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{
              padding: '8px 28px 8px 12px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Active filter indicator */}
      {selectedDepartment !== 'all' && (
        <div style={{ padding: '0 28px 16px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 18px',
              borderRadius: '12px',
              background: getColor(selectedDepartment).bg,
              border: `1px solid ${getColor(selectedDepartment).border}`,
            }}
          >
            <Building2 size={16} color={getColor(selectedDepartment).icon} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: getColor(selectedDepartment).text }}>
              {selectedDepartment}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              — {filteredProducts.length} sản phẩm • Tổng {stats.totalQuantity.toLocaleString('vi-VN')} đơn vị đã nhận
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '0 28px 24px' }}>
        {loading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              color: '#64748b',
              fontSize: '14px',
              gap: '10px',
            }}
          >
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Đang tải dữ liệu...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              borderRadius: '14px',
              border: '2px dashed #e2e8f0',
              padding: '60px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px',
            }}
          >
            <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>
              {data.length === 0
                ? 'Chưa có dữ liệu bàn giao. Hãy tạo phiếu bàn giao để bắt đầu theo dõi.'
                : 'Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          <>
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ ...thStyle, width: '50px' }}>STT</th>
                    <th
                      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('productName')}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Tên sản phẩm <SortIcon field="productName" />
                      </span>
                    </th>
                    <th style={thStyle}>Mã SKU</th>
                    <th style={thStyle}>ĐVT</th>
                    <th
                      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('department')}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Phòng ban <SortIcon field="department" />
                      </span>
                    </th>
                    <th
                      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}
                      onClick={() => handleSort('totalQuantity')}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Tổng SL đã nhận <SortIcon field="totalQuantity" />
                      </span>
                    </th>
                    <th
                      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}
                      onClick={() => handleSort('handoverCount')}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        Số lần giao <SortIcon field="handoverCount" />
                      </span>
                    </th>
                    <th style={{ ...thStyle, width: '80px' }} />
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product, idx) => {
                    const isExpanded = expandedRows.has(product.key);
                    const color = getColor(product.department);
                    const globalIdx = (safePage - 1) * pageSize + idx + 1;

                    return (
                      <ProductRow
                        key={product.key}
                        product={product}
                        index={globalIdx}
                        isExpanded={isExpanded}
                        color={color}
                        onToggle={() => toggleRow(product.key)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '16px',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Trang {safePage} / {totalPages} (Tổng {filteredProducts.length} sản phẩm)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PaginationButton
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft size={14} />
                  Trước
                </PaginationButton>

                {buildPageNumbers(safePage, totalPages).map((pageNum, i) =>
                  pageNum === '...' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '13px' }}>…</span>
                  ) : (
                    <PaginationButton
                      key={pageNum}
                      active={pageNum === safePage}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </PaginationButton>
                  )
                )}

                <PaginationButton
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  Sau
                  <ChevronRight size={14} />
                </PaginationButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}

/* ---- Sub-components ---- */

function ProductRow({ product, index, isExpanded, color, onToggle }) {
  return (
    <>
      <tr
        style={{
          borderTop: '1px solid #f1f5f9',
          transition: 'background 0.15s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fafbfc'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        onClick={onToggle}
      >
        <td style={tdStyle}>{index}</td>
        <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a' }}>{product.productName}</td>
        <td style={tdStyle}>
          <code
            style={{
              fontSize: '11px',
              background: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: '6px',
              color: '#475569',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            {product.productSku || '---'}
          </code>
        </td>
        <td style={{ ...tdStyle, color: '#64748b' }}>{product.unit || '---'}</td>
        <td style={tdStyle}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '8px',
              background: color.badge,
              color: color.badgeText,
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Building2 size={12} />
            {product.department}
          </span>
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              color: '#1d4ed8',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {product.totalQuantity.toLocaleString('vi-VN')}
          </span>
        </td>
        <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>
          {product.handoverCount} lần
        </td>
        <td style={{ ...tdStyle, textAlign: 'center' }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#64748b',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            {isExpanded ? 'Ẩn' : 'Chi tiết'}
            <ChevronDown
              size={12}
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr>
          <td colSpan={8} style={{ padding: '0 16px 12px 16px', background: '#fafbfc' }}>
            <div
              style={{
                marginLeft: '28px',
                marginTop: '4px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <ClipboardList size={14} color={color.accent} />
                Lịch sử bàn giao — {product.productName}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ ...subThStyle, width: '50px' }}>#</th>
                    <th style={subThStyle}>Mã phiếu</th>
                    <th style={subThStyle}>Ngày giao</th>
                    <th style={{ ...subThStyle, textAlign: 'right' }}>Số lượng</th>
                    <th style={subThStyle}>Người nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {(product.handovers || []).map((h, hIdx) => (
                    <tr
                      key={`${h.noteId}-${hIdx}`}
                      style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fafbfc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={subTdStyle}>{hIdx + 1}</td>
                      <td style={{ ...subTdStyle, fontWeight: 600, color: '#334155' }}>
                        {h.noteCode || '---'}
                      </td>
                      <td style={subTdStyle}>{formatDate(h.date)}</td>
                      <td style={{ ...subTdStyle, textAlign: 'right', fontWeight: 700, color: color.text }}>
                        {h.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td style={subTdStyle}>{h.receiverName || '---'}</td>
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
}

function PaginationButton({ children, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: active ? 'none' : '1px solid #e2e8f0',
        background: active
          ? 'linear-gradient(135deg, #0f172a, #334155)'
          : '#fff',
        color: active ? '#fff' : '#475569',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
        minWidth: active ? '36px' : undefined,
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function buildPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, 2, current - 1, current, current + 1, total - 1, total]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('...');
    }
    result.push(sorted[i]);
  }
  return result;
}

/* ---- Shared styles ---- */

const thStyle = {
  padding: '12px 14px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px 14px',
  color: '#475569',
  whiteSpace: 'nowrap',
};

const subThStyle = {
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  textAlign: 'left',
};

const subTdStyle = {
  padding: '8px 12px',
  color: '#64748b',
};
