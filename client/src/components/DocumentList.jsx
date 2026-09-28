import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, RefreshCw, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { buildDocumentPdfMarkup } from './PdfTemplates';

const documentTypeLabels = {
  purchase: 'Phiếu đề xuất mua sắm',
  handover: 'Phiếu bàn giao',
};

const DEPARTMENTS = [
  'Kế toán',
  'Hành chính nhân sự',
  'Thu mua',
  'IT',
  'Ban Giám đốc',
  'Quản lí dự án',
];

const ABBR_TO_DEPT = {
  KT: 'Kế toán',
  HCNS: 'Hành chính nhân sự',
  TM: 'Thu mua',
  IT: 'IT',
  BGĐ: 'Ban Giám đốc',
  QLDA: 'Quản lí dự án',
};

// Resolve department from stored field OR infer from code like "092026/ĐXMS-IT"
const resolveDepartment = (document) => {
  const stored = document?.data?.department;
  if (stored) return stored;
  const code = document?.data?.code || '';
  const match = code.match(/\/ĐXMS-([A-ZĐÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ]+)$/i);
  if (match) {
    const abbr = match[1].toUpperCase();
    return ABBR_TO_DEPT[abbr] || abbr;
  }
  return '';
};

const formatMoney = (value) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));


const getDocumentSummary = (document) => {
  const data = document?.data || {};
  const items = Array.isArray(data.items) ? data.items : [];

  if (document?.type === 'purchase') {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    const vatRate = Number(data.vatRate || 0);
    const total = subtotal * (1 + vatRate / 100);

    return {
      itemCount: items.length,
      total,
      resolveLabel: `${items.length} dòng • Tổng ${formatMoney(total)}`,
    };
  }

  const quantityTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return {
    itemCount: items.length,
    total: quantityTotal,
    resolveLabel: `${items.length} dòng • Tổng ${quantityTotal} sản phẩm`,
  };
};

const PAGE_SIZE = 5;

export default function DocumentList({ documents, onViewDocument, onDeleteDocument, onRefreshDocuments }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (activeFilter !== 'all') result = result.filter((document) => document.type === activeFilter);
    if (departmentFilter !== 'all') result = result.filter((document) => resolveDepartment(document) === departmentFilter);
    return result;
  }, [documents, activeFilter, departmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleDocuments = filteredDocuments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleActiveFilterChange = (key) => {
    setActiveFilter(key);
    setCurrentPage(1);
  };

  const handleDepartmentFilterChange = (dept) => {
    setDepartmentFilter(dept);
    setCurrentPage(1);
  };

  const handleExportPdf = (docItem) => {
    const element = window.document.createElement('div');
    element.innerHTML = buildDocumentPdfMarkup(docItem);

    const opt = {
      margin: 10,
      filename: `${(docItem?.data?.code || docItem?.name || 'phieu')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleDelete = async (docItem) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu này?')) return;
    await onDeleteDocument(docItem.id);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Danh sách phiếu đã lưu</h2>
          <p className="text-sm text-slate-500">Quản lý, xem chi tiết và xuất PDF</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefreshDocuments ? (
            <button
              type="button"
              onClick={onRefreshDocuments}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Làm mới dữ liệu từ máy chủ"
            >
              <RefreshCw size={15} />
              Làm mới
            </button>
          ) : null}

          <select
            value={departmentFilter}
            onChange={(e) => handleDepartmentFilterChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:bg-slate-50"
          >
            <option value="all">Tất cả phòng ban</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'purchase', label: 'Đề xuất mua sắm' },
              { key: 'handover', label: 'Phiếu bàn giao' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleActiveFilterChange(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  activeFilter === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">STT</th>
              <th className="px-4 py-3 font-medium text-slate-700">Mã phiếu</th>
              <th className="px-4 py-3 font-medium text-slate-700">Loại phiếu</th>
              <th className="px-4 py-3 font-medium text-slate-700">Người/Phòng ban</th>
              <th className="px-4 py-3 font-medium text-slate-700">Ngày tạo</th>
              <th className="px-4 py-3 font-medium text-slate-700">Tổng số mục / Tổng tiền</th>
              <th className="px-4 py-3 font-medium text-slate-700">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {visibleDocuments.length ? (
              visibleDocuments.map((document, index) => {
                const summary = getDocumentSummary(document);
                const label = document.data?.code || document.name || `Phiếu ${index + 1}`;
                const responsible = document.type === 'purchase' ? document.data?.proposer || '---' : document.data?.receiverName || '---';
                const department = document.data?.department || resolveDepartment(document) || '---';
                const itemIndex = (safePage - 1) * PAGE_SIZE + index + 1;

                return (
                  <tr key={document.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{itemIndex}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{label}</td>
                    <td className="px-4 py-3 text-slate-600">{documentTypeLabels[document.type] || document.type}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800">{responsible}</p>
                        <p className="text-xs text-slate-500">{department}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(document.updatedAt || document.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{summary.itemCount}</p>
                      <p className="text-xs text-slate-500">{summary.resolveLabel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDocument(document)}
                          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
                        >
                          <Eye size={12} />
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportPdf(document)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        >
                          <Download size={12} />
                          Tải file PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(document)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                        >
                          <Trash2 size={12} />
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  Chưa có phiếu nào được lưu. Hãy tạo phiếu mới để bắt đầu quản lý.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredDocuments.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Trang {safePage} / {totalPages} (Tổng {filteredDocuments.length} phiếu • Hiển thị 5 phiếu/trang)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage === 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className={`h-9 min-w-9 rounded-lg px-2 text-sm font-medium transition ${
                    isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sau
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {selectedDocument ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">Chi tiết phiếu</h3>
              <button type="button" onClick={() => setSelectedDocument(null)} className="text-sm text-slate-500">
                Đóng
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{documentTypeLabels[selectedDocument.type] || selectedDocument.type}</p>
                  <h4 className="mt-2 text-xl font-bold text-slate-900">{selectedDocument.name || selectedDocument.data?.code || 'Phiếu'}</h4>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {selectedDocument.type === 'purchase' ? (
                        <>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Nội dung</th>
                          <th className="px-3 py-2">ĐVT</th>
                          <th className="px-3 py-2">SL</th>
                          <th className="px-3 py-2">Đơn giá</th>
                          <th className="px-3 py-2">Thành tiền</th>
                          <th className="px-3 py-2">Ghi chú</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-2">STT</th>
                          <th className="px-3 py-2">Ngày</th>
                          <th className="px-3 py-2">Tên SP</th>
                          <th className="px-3 py-2">ĐVT</th>
                          <th className="px-3 py-2">SL</th>
                          <th className="px-3 py-2">Bộ phận</th>
                          <th className="px-3 py-2">Ký nhận</th>
                          <th className="px-3 py-2">Ghi chú</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(selectedDocument.data?.items || []).map((item, index) => (
                      <tr key={`${selectedDocument.id}-${index}`}>
                        {selectedDocument.type === 'purchase' ? (
                          <>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{item.content || ''}</td>
                            <td className="px-3 py-2">{item.unit || ''}</td>
                            <td className="px-3 py-2">{item.quantity || 0}</td>
                            <td className="px-3 py-2">{formatMoney(item.unitPrice || 0)}</td>
                            <td className="px-3 py-2">{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0))}</td>
                            <td className="px-3 py-2">{item.note || ''}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{selectedDocument.data?.exportDate || ''}</td>
                            <td className="px-3 py-2">{item.productName || item.product || ''}</td>
                            <td className="px-3 py-2">{item.unit || ''}</td>
                            <td className="px-3 py-2">{item.quantity || 0}</td>
                            <td className="px-3 py-2">{item.departmentUsage || ''}</td>
                            <td className="px-3 py-2">{selectedDocument.data?.receiverName || ''}</td>
                            <td className="px-3 py-2">{item.note || ''}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
