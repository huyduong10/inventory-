import { useEffect, useState } from 'react';
import { Boxes, FileText, FolderOpen, Warehouse } from 'lucide-react';
import { api } from './api/client';
import ProductManagement from './components/ProductManagement';
import DocumentCreation from './components/DocumentCreation';
import DocumentList from './components/DocumentList';
import { filterProductsAfterDelete } from './lib/productDelete';
import { getDocumentIdentity, mergeDocuments, removeDocumentByIdentity } from './lib/documentIdentity';
import { deleteSavedFormat, getSavedFormats, upsertSavedFormat } from './lib/savedFormats';

const fallbackProducts = [
  { _id: 'p1', name: 'B�t bi Thi�n Long', sku: 'BN-001', category: 'B�t', unit: 'C�i', quantity: 120, minThreshold: 25, location: 'K? A1', stockStatus: 'In Stock' },
  { _id: 'p2', name: 'Gi?y Double A A4', sku: 'GI-001', category: 'Gi?y', unit: 'Ram', quantity: 8, minThreshold: 10, location: 'K? B2', stockStatus: 'Low Stock' },
  { _id: 'p3', name: 'K?p ghim', sku: 'KG-001', category: 'D?ng c?', unit: 'H?p', quantity: 0, minThreshold: 8, location: 'K? C3', stockStatus: 'Out of Stock' },
  { _id: 'p4', name: 'Bang keo', sku: 'BK-001', category: 'D�n', unit: 'Cu?n', quantity: 28, minThreshold: 6, location: 'K? D1', stockStatus: 'In Stock' },
];

const getStockStatus = (product) => {
  const quantity = Number(product.quantity || 0);
  const minThreshold = Number(product.minThreshold || 0);

  if (quantity === 0) return 'Out of Stock';
  if (quantity <= minThreshold) return 'Low Stock';
  return 'In Stock';
};

const documentTabs = [
  { key: 'warehouse', label: 'Kho hàng', icon: Warehouse },
  { key: 'create', label: 'Tạo phiếu mới', icon: FileText },
  { key: 'documents', label: 'Danh sách phiếu lưu trữ', icon: FolderOpen },
];

const normalizeServerDocument = (record, type) => ({
  id: record?._id || record?.id || record?.code || record?.noteCode || record?.proposalCode || `${type}-${Date.now()}`,
  type,
  name: record?.name || record?.code || record?.noteCode || record?.proposalCode || 'Phiếu lưu trữ',
  data: record,
  createdAt: record?.createdAt || record?.updatedAt || new Date().toISOString(),
  updatedAt: record?.updatedAt || record?.createdAt || new Date().toISOString(),
});

function App() {
  const [activeTab, setActiveTab] = useState('warehouse');
  const [products, setProducts] = useState(() =>
    fallbackProducts.map((product) => ({ ...product, stockStatus: getStockStatus(product) }))
  );
  const [documents, setDocuments] = useState(() => getSavedFormats());
  const [toast, setToast] = useState('');
  const [editingDocument, setEditingDocument] = useState(null);

  const addToast = (message) => {
    setToast(message);
    window.clearTimeout(addToast.timeoutId);
    addToast.timeoutId = window.setTimeout(() => setToast(''), 2200);
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      const productList = Array.isArray(response?.data?.data) ? response.data.data : [];

      setProducts(
        productList.length ? productList.map((product) => ({ ...product, stockStatus: getStockStatus(product) })) : fallbackProducts
      );
    } catch (_error) {
      setProducts(fallbackProducts.map((product) => ({ ...product, stockStatus: getStockStatus(product) })));
    }
  };

  const fetchExistingDocuments = async () => {
    try {
      const [purchaseResponse, handoverResponse] = await Promise.all([
        api.get('/purchase-proposals?limit=100'),
        api.get('/handover-notes?limit=100'),
      ]);

      const serverDocuments = [
        ...(Array.isArray(purchaseResponse?.data?.data) ? purchaseResponse.data.data.map((record) => normalizeServerDocument(record, 'purchase')) : []),
        ...(Array.isArray(handoverResponse?.data?.data) ? handoverResponse.data.data.map((record) => normalizeServerDocument(record, 'handover')) : []),
      ];

      const mergedDocuments = mergeDocuments([...serverDocuments, ...getSavedFormats()]);
      setDocuments(mergedDocuments);
      return mergedDocuments;
    } catch (_error) {
      const fallbackDocuments = mergeDocuments(getSavedFormats());
      setDocuments(fallbackDocuments);
      return fallbackDocuments;
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchExistingDocuments();
  }, []);

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchExistingDocuments();
    }
  }, [activeTab]);

  const persistSavedDocuments = (nextDocuments) => {
    const mergedDocuments = mergeDocuments([...nextDocuments, ...documents]);
    setDocuments(mergedDocuments);
    return nextDocuments;
  };

  const removeDocumentFromList = (documentId) => {
    const targetDocument = documents.find((document) => document.id === documentId);
    const targetIdentity = getDocumentIdentity(targetDocument);

    setDocuments((current) => {
      if (!targetIdentity) {
        return mergeDocuments(current.filter((document) => document.id !== documentId));
      }

      return mergeDocuments(removeDocumentByIdentity(current, targetIdentity));
    });

    const savedLocalDocuments = getSavedFormats();
    const remainingSavedLocalDocuments = targetIdentity ? removeDocumentByIdentity(savedLocalDocuments, targetIdentity) : savedLocalDocuments.filter((document) => document.id !== documentId);

    if (remainingSavedLocalDocuments.length !== savedLocalDocuments.length) {
      window.localStorage.setItem('inventory_saved_formats', JSON.stringify(remainingSavedLocalDocuments));
    }
  };

  const saveDocumentToList = (documentType, formData, documentId) => {
    const safeName = (formData.name || '').trim();
    const fallbackName =
      documentType === 'purchase'
        ? `Đề xuất mua sắm ${new Date().toLocaleDateString('vi-VN')}`
        : `Phiếu bàn giao ${new Date().toLocaleDateString('vi-VN')}`;

    const payload = { ...formData, name: safeName || fallbackName };
    const nextDocuments = upsertSavedFormat({
      id: documentId || payload?._id || payload?.id || `${documentType}:${payload.code || payload?.name || 'saved'}`,
      type: documentType,
      name: payload.name,
      data: payload,
    });

    persistSavedDocuments(nextDocuments);
    setEditingDocument(null);
    setActiveTab('documents');
    return nextDocuments;
  };

  const handleAddProduct = async (payload) => {
    try {
      const response = await api.post('/products', payload);
      const nextProduct = { ...response.data.data, stockStatus: getStockStatus(response.data.data) };
      setProducts((current) => [nextProduct, ...current]);
      addToast('�� th�m s?n ph?m m?i');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể thêm sản phẩm mới.';
      addToast(message);
      return false;
    }
  };

  const handleUpdateProduct = async (productId, payload) => {
    try {
      const response = await api.put(`/products/${productId}`, payload);
      const updatedProduct = { ...response.data.data, stockStatus: getStockStatus(response.data.data) };
      setProducts((current) => current.map((product) => (product._id === productId ? updatedProduct : product)));
      addToast('�� c?p nh?t s?n ph?m');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể cập nhật sản phẩm.';
      addToast(message);
      return false;
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await api.delete(`/products/${productId}`);
      setProducts((current) => filterProductsAfterDelete(current, productId, true));
      addToast('Đã xóa sản phẩm');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể xóa sản phẩm.';
      addToast(message);
      return false;
    }
  };

  const handleSavePurchaseDocument = async (payload, documentId) => {
    const sanitizedItems = payload.items.map((item) => ({
      content: item.content || '',
      unit: item.unit || 'C�i',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      note: item.note || '',
    }));

    const requestBody = {
      code: `DXMS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      proposer: payload.proposer,
      department: payload.department,
      reason: payload.reason,
      date: payload.date,
      vatRate: Number(payload.vatRate || 0),
      status: 'Pending',
      items: sanitizedItems,
    };

    try {
      const response = await api.post('/purchase-proposals', requestBody);
      const savedDocument = response?.data?.data || { ...payload, items: sanitizedItems, code: requestBody.code };
      saveDocumentToList('purchase', { ...payload, items: sanitizedItems, code: savedDocument.code || requestBody.code }, documentId);
      addToast('�� luu phi?u d? xu?t mua s?m');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể lưu phiếu đề xuất mua sắm.';
      addToast(message);
      return false;
    }
  };

  const handleSaveHandoverDocument = async (payload, documentId) => {
    const requestItems = payload.items.map((item) => ({
      product: item.productId || item.product || '',
      productId: item.productId || item.product || '',
      productName: item.productName || item.product || '',
      unit: item.unit || 'C�i',
      quantity: Number(item.quantity || 0),
      departmentUsage: item.departmentUsage || '',
      receiverSignature: payload.receiverName,
      note: item.note || '',
    }));

    const requestBody = {
      code: payload.code || `PBG-${Date.now().toString(36).toUpperCase()}`,
      exportDate: payload.exportDate,
      receiverName: payload.receiverName,
      department: payload.department,
      status: 'Completed',
      items: requestItems,
    };

    try {
      const response = await api.post('/handover-notes', requestBody);

      if (response?.status === 201 || response?.data?.success) {
        await fetchProducts();
      }

      const savedDocument = response?.data?.data || { ...payload, items: requestItems, code: requestBody.code };
      saveDocumentToList('handover', { ...payload, items: requestItems, code: savedDocument.code || requestBody.code }, documentId);
      addToast('�� luu phi?u b�n giao');
      return true;
    } catch (error) {
      const message = error?.response?.data?.message || 'Không thể lưu phiếu bàn giao.';
      addToast(message);
      return false;
    }
  };

  const handleDeleteDocument = async (documentId) => {
    const targetDocument = documents.find((document) => document.id === documentId);
    const serverId = targetDocument?.data?._id || targetDocument?.data?.id;
    const targetIdentity = getDocumentIdentity(targetDocument);

    if (targetDocument?.type === 'purchase' && serverId) {
      try {
        await api.delete(`/purchase-proposals/${serverId}`);
      } catch (error) {
        if (error?.response?.status !== 404) {
          const message = error?.response?.data?.message || 'Không thể xóa phiếu đề xuất mua sắm.';
          addToast(message);
          return;
        }
      }
    }

    if (targetDocument?.type === 'handover' && serverId) {
      try {
        await api.delete(`/handover-notes/${serverId}`);
      } catch (error) {
        if (error?.response?.status !== 404) {
          const message = error?.response?.data?.message || 'Không thể xóa phiếu bàn giao.';
          addToast(message);
          return;
        }
      }
    }

    const matchingLocalDocuments = getSavedFormats().filter((document) => getDocumentIdentity(document) === targetIdentity);

    if (matchingLocalDocuments.length) {
      const nextDocuments = removeDocumentByIdentity(getSavedFormats(), targetIdentity);
      persistSavedDocuments(nextDocuments);
    } else {
      removeDocumentFromList(documentId);
    }

    addToast('Đã xóa phiếu');
  };

  const handleEditDocument = (document) => {
    setEditingDocument(document);
    setActiveTab('create');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-7xl space-y-6">
        {toast ? (
          <div className="fixed right-5 top-5 z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        ) : null}

        <header className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Warehouse Management</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">TAG</h1>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {documentTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                    activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {activeTab === 'warehouse' ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: 'Tổng sản phẩm', value: products.length.toLocaleString('vi-VN'), icon: Boxes, tone: 'bg-blue-100 text-blue-700' },
                { title: 'Sắp hết hàng', value: products.filter((product) => product.stockStatus === 'Low Stock').length.toLocaleString('vi-VN'), icon: Warehouse, tone: 'bg-amber-100 text-amber-700' },
                { title: 'Phiếu lưu trữ', value: documents.length.toLocaleString('vi-VN'), icon: FolderOpen, tone: 'bg-green-100 text-green-700' },
                // { title: '�� ho�n t?t', value: '94%', icon: FileText, tone: 'bg-violet-100 text-violet-700' },
              ].map(({ title, value, icon: Icon, tone }) => (
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

            <ProductManagement
              products={products}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          </div>
        ) : null}

        {activeTab === 'create' ? (
          <DocumentCreation
            products={products}
            editingDocument={editingDocument}
            onSavePurchaseDocument={handleSavePurchaseDocument}
            onSaveHandoverDocument={handleSaveHandoverDocument}
          />
        ) : null}

        {activeTab === 'documents' ? (
          <DocumentList
            documents={documents}
            onViewDocument={(document) => setEditingDocument(document)}
            onEditDocument={handleEditDocument}
            onDeleteDocument={handleDeleteDocument}
            onRefreshDocuments={fetchExistingDocuments}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;
