import { useMemo, useState } from 'react';
import { Download, Eye, PencilLine, Trash2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { buildDocumentPdfMarkup } from './PdfTemplates';

const documentTypeLabels = {
  purchase: 'Phiếu đề xuất mua sắm',
  handover: 'Phiếu bàn giao',
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

export default function DocumentList({ documents, onViewDocument, onEditDocument, onDeleteDocument, onRefreshDocuments }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState(null);

  const filteredDocuments = useMemo(() => {
    if (activeFilter === 'all') return documents;
    return documents.filter((document) => document.type === activeFilter);
  }, [documents, activeFilter]);

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
          <p className="text-sm text-slate-500">Quản lý, xem chi tiết, chỉnh sửa và xuất PDF</p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'purchase', label: 'Đề xuất mua sắm' },
            { key: 'handover', label: 'Phiếu bàn giao' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeFilter === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700">STT</th>
              <th className="px-4 py-3 font-medium text-slate-700">Mã phiếu</th>
              <th className="px-4 py-3 font-medium text-slate-700">Loại phiếu</th>
              <th className="px-4 py-3 font-medium text-slate-700">Người lập / Phòng ban</th>
              <th className="px-4 py-3 font-medium text-slate-700">Ngày tạo</th>
              <th className="px-4 py-3 font-medium text-slate-700">Tổng số mục / Tổng tiền</th>
              <th className="px-4 py-3 font-medium text-slate-700">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredDocuments.length ? (
              filteredDocuments.map((document, index) => {
                const summary = getDocumentSummary(document);
                const label = document.data?.code || document.name || `Phiếu ${index + 1}`;
                const responsible = document.type === 'purchase' ? document.data?.proposer || '---' : document.data?.receiverName || '---';
                const department = document.data?.department || '---';

                return (
                  <tr key={document.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{index + 1}</td>
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
                          onClick={() => onEditDocument(document)}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700"
                        >
                          <PencilLine size={12} />
                          Sửa
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
