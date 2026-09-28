import { useEffect, useMemo, useState, useCallback } from 'react';
import { recordFinanceTransaction } from '@/utils/sharedFinance';

type Product = {
  id: string;
  branch_id?: string;
  branch: string;
  name: string;
  cost: number;
  sell: number;
  qty: number;
  minStock: number;
  min_stock?: number;
  created_at?: string;
};

type Sale = {
  id?: string;
  productId?: string;
  product_id?: string;
  branch_id?: string;
  branch: string;
  name: string;
  cost: number;
  sell: number;
  qty: number;
  profit: number;
  date: string;
  created_at?: string;
};

type Branch = {
  id?: string;
  name?: string;
  location?: string;
  manager?: string;
};

type StoreForm = {
  branch: string;
  name: string;
  costPrice: string;
  sellPrice: string;
  qty: string;
  minStock: string;
};

type SaleForm = {
  branch: string;
  productId: string;
  qty: string;
};

type EditProductForm = {
  id: string;
  branch: string;
  name: string;
  costPrice: string;
  sellPrice: string;
  qty: string;
  minStock: string;
};

type EditSaleForm = {
  id?: string;
  index: number;
  productId?: string;
  qty: string;
  price: string;
  branch: string;
};

const initialProductForm: StoreForm = {
  branch: '',
  name: '',
  costPrice: '',
  sellPrice: '',
  qty: '',
  minStock: '5',
};

const initialSaleForm: SaleForm = {
  branch: '',
  productId: '',
  qty: '',
};

function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('en-US')} ج.م`;
}

export default function StoreSynced() {
  const [products, setProducts] = useState<Product[]>(() => readStoredData('storeProducts', []));
  const [sales, setSales] = useState<Sale[]>(() => readStoredData('storeSales', []));
  const [branches, setBranches] = useState<Branch[]>(() => {
    const storedBranches = readStoredData<Branch[]>('branches', []);
    return storedBranches.length ? storedBranches : [{ name: 'الفرع الرئيسي' }];
  });

  const [productForm, setProductForm] = useState<StoreForm>(initialProductForm);
  const [saleForm, setSaleForm] = useState<SaleForm>(initialSaleForm);
  const [editProductForm, setEditProductForm] = useState<EditProductForm | null>(null);
  const [editSaleForm, setEditSaleForm] = useState<EditSaleForm | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  // Sync / Load data from Backend Server
  const fetchStoreData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    const api = window.api;

    try {
      // 1. Fetch Branches
      if (api?.getBranches && api?.getToken?.()) {
        const bRes = await api.getBranches();
        const serverBranches = Array.isArray(bRes?.data) ? bRes.data : [];
        if (serverBranches.length > 0) {
          const mappedBranches: Branch[] = serverBranches.map((b: any) => ({
            id: String(b.id || ''),
            name: String(b.name || ''),
            location: String(b.location || b.address || ''),
            manager: String(b.manager || b.contact || ''),
          }));
          setBranches(mappedBranches);
          window.localStorage.setItem('branches', JSON.stringify(mappedBranches));
        }
      }

      // 2. Fetch Products
      if (api?.getStoreProducts && api?.getToken?.()) {
        const pRes = await api.getStoreProducts();
        if (Array.isArray(pRes?.data)) {
          const mappedProducts: Product[] = pRes.data.map((item: any) => ({
            id: String(item.id),
            branch_id: item.branch_id ? String(item.branch_id) : undefined,
            branch: String(item.branch || 'الفرع الرئيسي'),
            name: String(item.name || ''),
            cost: Number(item.cost || 0),
            sell: Number(item.sell || 0),
            qty: Number(item.qty || 0),
            minStock: Number(item.minStock ?? item.min_stock ?? 5),
            created_at: item.created_at,
          }));
          setProducts(mappedProducts);
          window.localStorage.setItem('storeProducts', JSON.stringify(mappedProducts));
        }
      }

      // 3. Fetch Sales
      if (api?.getStoreSales && api?.getToken?.()) {
        const sRes = await api.getStoreSales();
        if (Array.isArray(sRes?.data)) {
          const mappedSales: Sale[] = sRes.data.map((item: any) => ({
            id: String(item.id),
            productId: item.productId ? String(item.productId) : item.product_id ? String(item.product_id) : undefined,
            branch_id: item.branch_id ? String(item.branch_id) : undefined,
            branch: String(item.branch || 'الفرع الرئيسي'),
            name: String(item.name || ''),
            cost: Number(item.cost || 0),
            sell: Number(item.sell || 0),
            qty: Number(item.qty || 0),
            profit: Number(item.profit || 0),
            date: String(item.date || new Date().toISOString().split('T')[0]),
            created_at: item.created_at,
          }));
          setSales(mappedSales);
          window.localStorage.setItem('storeSales', JSON.stringify(mappedSales));
        }
      }
    } catch (err: any) {
      console.error('Failed to sync store data with server:', err);
    } finally {
      if (showIndicator) setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  // Initial load and periodic sync (every 15s)
  useEffect(() => {
    setIsLoading(true);
    void fetchStoreData(false);

    const interval = window.setInterval(() => {
      void fetchStoreData(false);
    }, 15000);

    const handleFocus = () => {
      void fetchStoreData(false);
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchStoreData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const getBranchDetails = useCallback(
    (branchNameOrId: string) => {
      const clean = (branchNameOrId || '').trim().toLowerCase();
      const match = branches.find(
        (b) =>
          (b.id && b.id.toLowerCase() === clean) ||
          (b.name && b.name.trim().toLowerCase() === clean)
      );
      return {
        branchName: match?.name || branchNameOrId || 'الفرع الرئيسي',
        branchId: match?.id || '',
      };
    },
    [branches]
  );

  // Filtered Products and Sales
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchBranch = !filterBranch || p.branch === filterBranch;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.branch.toLowerCase().includes(searchQuery.toLowerCase());
      return matchBranch && matchSearch;
    });
  }, [products, filterBranch, searchQuery]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchBranch = !filterBranch || s.branch === filterBranch;
      const matchSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.branch.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.date.includes(searchQuery);
      return matchBranch && matchSearch;
    });
  }, [sales, filterBranch, searchQuery]);

  const totalProfit = useMemo(() => sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0), [sales]);
  const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + Number(p.cost || 0) * Number(p.qty || 0), 0), [products]);

  // ADD NEW PRODUCT
  const addNewProduct = async () => {
    const branchInput = productForm.branch.trim() || (branches[0]?.name || 'الفرع الرئيسي');
    const { branchName, branchId } = getBranchDetails(branchInput);
    const name = productForm.name.trim();
    const cost = Number(productForm.costPrice);
    const sell = Number(productForm.sellPrice);
    const qty = Number(productForm.qty);
    const minStock = Number(productForm.minStock) || 5;

    if (!name || Number.isNaN(cost) || Number.isNaN(sell) || Number.isNaN(qty)) {
      showToast('يرجى إكمال كافة بيانات المنتج المطلوبة', 'error');
      return;
    }

    const totalCost = cost * qty;
    const api = window.api;

    try {
      let createdProduct: Product = {
        id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        branch: branchName,
        branch_id: branchId,
        name,
        cost,
        sell,
        qty,
        minStock,
      };

      if (api?.createStoreProduct && api?.getToken?.()) {
        const res = await api.createStoreProduct({
          name,
          cost,
          sell,
          qty,
          minStock,
          branch: branchName,
          branchId,
        });
        if (res?.data && typeof res.data === 'object') {
          const d: any = res.data;
          createdProduct = {
            id: String(d.id),
            branch_id: d.branch_id ? String(d.branch_id) : branchId,
            branch: String(d.branch || branchName),
            name: String(d.name || name),
            cost: Number(d.cost ?? cost),
            sell: Number(d.sell ?? sell),
            qty: Number(d.qty ?? qty),
            minStock: Number(d.minStock ?? d.min_stock ?? minStock),
            created_at: d.created_at,
          };
        }
      }

      const nextProducts = [createdProduct, ...products];
      setProducts(nextProducts);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));

      // Record in finance as expense
      if (totalCost > 0) {
        recordFinanceTransaction({
          type: 'expense',
          amount: totalCost,
          category: 'مشتريات متجر',
          branch: branchName,
          branchId,
          branchName,
          relatedTo: `${name} (${branchName})`,
          description: `شراء ${qty} من ${name} - فرع: ${branchName}`,
          date: new Date().toISOString().split('T')[0],
        });
      }

      setProductForm(initialProductForm);
      showToast('تمت إضافة المنتج للمخزون ومزامنته مع السيرفر والماليات', 'success');
    } catch (err: any) {
      console.error('Error adding product:', err);
      showToast(err.message || 'حدث خطأ أثناء حفظ المنتج', 'error');
    }
  };

  // SELL PRODUCT
  const sellProduct = async () => {
    const productId = saleForm.productId;
    const product = products.find((item) => item.id === productId);
    const rawBranch = (saleForm.branch || product?.branch || branches[0]?.name || 'الفرع الرئيسي').trim();
    const { branchName, branchId } = getBranchDetails(rawBranch);
    const qtyToSell = Number(saleForm.qty);

    if (!productId || Number.isNaN(qtyToSell) || qtyToSell <= 0 || !product) {
      showToast('اختر المنتج والكمية بشكل صحيح', 'error');
      return;
    }

    if (qtyToSell > product.qty) {
      showToast('الكمية المتاحة في المخزون غير كافية!', 'error');
      return;
    }

    const revenue = product.sell * qtyToSell;
    const profit = (product.sell - product.cost) * qtyToSell;
    const today = new Date().toISOString().split('T')[0];
    const newQty = product.qty - qtyToSell;
    const api = window.api;

    try {
      let createdSale: Sale = {
        id: `sale_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        branch: branchName,
        branch_id: branchId,
        name: product.name,
        cost: product.cost,
        sell: product.sell,
        qty: qtyToSell,
        profit,
        date: today,
      };

      if (api?.createStoreSale && api?.getToken?.()) {
        const res = await api.createStoreSale({
          productId: product.id,
          product_id: product.id,
          branch: branchName,
          branchId,
          name: product.name,
          cost: product.cost,
          sell: product.sell,
          qty: qtyToSell,
          profit,
          date: today,
        });

        if (res?.data && typeof res.data === 'object') {
          const d: any = res.data;
          createdSale = {
            id: String(d.id),
            productId: d.productId ? String(d.productId) : product.id,
            branch_id: d.branch_id ? String(d.branch_id) : branchId,
            branch: String(d.branch || branchName),
            name: String(d.name || product.name),
            cost: Number(d.cost ?? product.cost),
            sell: Number(d.sell ?? product.sell),
            qty: Number(d.qty ?? qtyToSell),
            profit: Number(d.profit ?? profit),
            date: String(d.date || today),
            created_at: d.created_at,
          };
        }
      }

      // Also ensure product qty in API is updated if not auto-deducted
      if (api?.updateStoreProduct && api?.getToken?.()) {
        void api.updateStoreProduct(product.id, { qty: newQty });
      }

      const nextProducts = products.map((item) => (item.id === product.id ? { ...item, qty: newQty } : item));
      const nextSales = [createdSale, ...sales];

      setProducts(nextProducts);
      setSales(nextSales);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));
      window.localStorage.setItem('storeSales', JSON.stringify(nextSales));

      // Record in finance as income
      recordFinanceTransaction({
        type: 'income',
        amount: revenue,
        category: 'مبيعات متجر',
        branch: branchName,
        branchId,
        branchName,
        relatedTo: `${product.name} (${branchName})`,
        description: `بيع ${qtyToSell} من ${product.name} - فرع: ${branchName}`,
        date: today,
      });

      setSaleForm(initialSaleForm);
      showToast(`تم تنفيذ البيع وتسجيل الإيراد (${formatMoney(revenue)}) ومزامنته مع السيرفر والماليات`, 'success');
    } catch (err: any) {
      console.error('Error selling product:', err);
      showToast(err.message || 'حدث خطأ أثناء تنفيذ عملية البيع', 'error');
    }
  };

  // DELETE PRODUCT
  const deleteProduct = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج نهائياً من السيرفر والمخزون؟')) return;
    const api = window.api;

    try {
      if (api?.deleteStoreProduct && api?.getToken?.()) {
        await api.deleteStoreProduct(id);
      }
      const nextProducts = products.filter((product) => product.id !== id);
      setProducts(nextProducts);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));
      showToast('تم حذف المنتج من السيرفر بنجاح', 'success');
    } catch (err: any) {
      console.error('Error deleting product:', err);
      showToast(err.message || 'حدث خطأ أثناء حذف المنتج', 'error');
    }
  };

  // EDIT PRODUCT MODAL
  const openEditProductModal = (product: Product) => {
    setEditProductForm({
      id: product.id,
      branch: product.branch || '',
      name: product.name,
      costPrice: String(product.cost),
      sellPrice: String(product.sell),
      qty: String(product.qty),
      minStock: String(product.minStock ?? product.min_stock ?? 5),
    });
  };

  const saveEditedProduct = async () => {
    if (!editProductForm) return;
    const oldProduct = products.find((product) => product.id === editProductForm.id);
    const newQty = Number(editProductForm.qty);
    const costPrice = Number(editProductForm.costPrice);
    const sellPrice = Number(editProductForm.sellPrice);
    const minStock = Number(editProductForm.minStock) || 5;
    const addedQty = newQty - (oldProduct?.qty || 0);
    const targetBranch = editProductForm.branch || oldProduct?.branch || '';
    const { branchName, branchId } = getBranchDetails(targetBranch);
    const api = window.api;

    try {
      if (api?.updateStoreProduct && api?.getToken?.()) {
        await api.updateStoreProduct(editProductForm.id, {
          name: editProductForm.name,
          cost: costPrice,
          sell: sellPrice,
          qty: newQty,
          minStock,
          branch: branchName,
          branchId,
        });
      }

      const nextProducts = products.map((product) =>
        product.id === editProductForm.id
          ? {
            ...product,
            branch: branchName,
            branch_id: branchId,
            name: editProductForm.name,
            cost: costPrice,
            sell: sellPrice,
            qty: newQty,
            minStock,
          }
          : product
      );
      setProducts(nextProducts);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));

      if (addedQty > 0 && costPrice > 0) {
        recordFinanceTransaction({
          type: 'expense',
          amount: addedQty * costPrice,
          category: 'مشتريات متجر',
          branch: branchName,
          branchId,
          branchName,
          relatedTo: `${editProductForm.name} (${branchName})`,
          description: `شراء كمية إضافية (${addedQty}) من ${editProductForm.name} - فرع: ${branchName}`,
          date: new Date().toISOString().split('T')[0],
        });
      }

      setEditProductForm(null);
      showToast('تم تعديل المنتج ومزامنة التغييرات مع السيرفر والماليات', 'success');
    } catch (err: any) {
      console.error('Error saving edited product:', err);
      showToast(err.message || 'حدث خطأ أثناء تعديل المنتج', 'error');
    }
  };

  // DELETE SALE
  const deleteSale = async (index: number) => {
    if (!window.confirm('هل أنت متأكد من حذف عملية البيع؟ سيتم استرجاع الكمية للمخزون وإلغاء الإيراد بالماليات.')) return;
    const sale = sales[index];
    const { branchName, branchId } = getBranchDetails(sale.branch);
    const api = window.api;

    try {
      if (sale.id && api?.deleteStoreSale && api?.getToken?.()) {
        await api.deleteStoreSale(sale.id);
      }

      // Restore product stock
      const targetProd = products.find((p) => p.id === sale.productId || p.name === sale.name);
      if (targetProd) {
        const restoredQty = Number(targetProd.qty) + Number(sale.qty);
        if (api?.updateStoreProduct && api?.getToken?.()) {
          void api.updateStoreProduct(targetProd.id, { qty: restoredQty });
        }
      }

      const nextProducts = products.map((product) =>
        product.id === sale.productId || product.name === sale.name
          ? { ...product, qty: Number(product.qty) + Number(sale.qty) }
          : product
      );
      const nextSales = sales.filter((_, itemIndex) => itemIndex !== index);

      setProducts(nextProducts);
      setSales(nextSales);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));
      window.localStorage.setItem('storeSales', JSON.stringify(nextSales));

      recordFinanceTransaction({
        type: 'expense',
        amount: Number(sale.sell) * Number(sale.qty),
        category: 'استرجاع بيع',
        branch: branchName,
        branchId,
        branchName,
        relatedTo: `${sale.name} (${branchName})`,
        description: `إلغاء بيع ${sale.qty} من ${sale.name} - فرع: ${branchName}`,
        date: new Date().toISOString().split('T')[0],
      });

      showToast('تم حذف عملية البيع واسترجاع المخزون ومزامنته مع السيرفر', 'success');
    } catch (err: any) {
      console.error('Error deleting sale:', err);
      showToast(err.message || 'حدث خطأ أثناء حذف عملية البيع', 'error');
    }
  };

  // EDIT SALE MODAL
  const openEditSaleModal = (index: number) => {
    const sale = sales[index];
    setEditSaleForm({
      id: sale.id,
      index,
      productId: sale.productId,
      qty: String(sale.qty),
      price: String(sale.sell),
      branch: sale.branch,
    });
  };

  const saveEditedSale = async () => {
    if (!editSaleForm) return;

    const newQty = Number(editSaleForm.qty);
    const newPrice = Number(editSaleForm.price);
    if (Number.isNaN(newQty) || newQty <= 0 || Number.isNaN(newPrice)) {
      showToast('بيانات غير صحيحة', 'error');
      return;
    }

    const sale = sales[editSaleForm.index];
    const { branchName, branchId } = getBranchDetails(editSaleForm.branch || sale.branch);
    const oldRevenue = Number(sale.sell) * Number(sale.qty);
    const newRevenue = newPrice * newQty;
    const diff = newRevenue - oldRevenue;
    const qtyDiff = Number(sale.qty) - newQty;
    const api = window.api;

    try {
      if (sale.id && api?.updateStoreSale && api?.getToken?.()) {
        await api.updateStoreSale(sale.id, {
          qty: newQty,
          sell: newPrice,
          price: newPrice,
          cost: sale.cost,
          profit: (newPrice - Number(sale.cost)) * newQty,
          branch: branchName,
          branchId,
        });
      }

      // Update product inventory if linked
      const targetProd = products.find((p) => p.id === sale.productId || p.name === sale.name);
      if (targetProd) {
        const availableQty = Number(targetProd.qty) + qtyDiff;
        if (qtyDiff < 0 && availableQty < 0) {
          showToast('الكمية المتاحة في المخزون لا تكفي للزيادة المطلوبة', 'error');
          return;
        }
        if (api?.updateStoreProduct && api?.getToken?.()) {
          void api.updateStoreProduct(targetProd.id, { qty: availableQty });
        }
      }

      const nextProducts = products.map((product) => {
        if (product.id !== sale.productId && product.name !== sale.name) return product;
        const availableQty = Number(product.qty) + qtyDiff;
        return { ...product, qty: Math.max(0, availableQty) };
      });

      const nextSales = sales.map((item, index) =>
        index === editSaleForm.index
          ? {
            ...item,
            branch: branchName,
            branch_id: branchId,
            qty: newQty,
            sell: newPrice,
            profit: (newPrice - Number(item.cost)) * newQty,
          }
          : item
      );

      setProducts(nextProducts);
      setSales(nextSales);
      window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));
      window.localStorage.setItem('storeSales', JSON.stringify(nextSales));

      if (diff > 0) {
        recordFinanceTransaction({
          type: 'income',
          amount: diff,
          category: 'مبيعات متجر',
          branch: branchName,
          branchId,
          branchName,
          relatedTo: `${sale.name} (${branchName})`,
          description: `تعديل بيع (مبلغ إضافي): ${sale.name} - فرع: ${branchName}`,
        });
      } else if (diff < 0) {
        recordFinanceTransaction({
          type: 'expense',
          amount: Math.abs(diff),
          category: 'استرجاع بيع',
          branch: branchName,
          branchId,
          branchName,
          relatedTo: `${sale.name} (${branchName})`,
          description: `تعديل بيع (خصم مبلغ): ${sale.name} - فرع: ${branchName}`,
        });
      }

      setEditSaleForm(null);
      showToast('تم تعديل عملية البيع ومزامنتها مع السيرفر والماليات', 'success');
    } catch (err: any) {
      console.error('Error saving edited sale:', err);
      showToast(err.message || 'حدث خطأ أثناء تعديل عملية البيع', 'error');
    }
  };

  const availableProductsForSale = useMemo(() => {
    const branch = saleForm.branch;
    return products.filter((product) => !branch || product.branch === branch);
  }, [products, saleForm.branch]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">متجر الأكاديمية المركزي</h1>

            </div>
            <p className="mt-2 text-sm text-slate-600">
              إدارة المخزون والمبيعات السحابية.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchStoreData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              <svg
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-sky-600' : 'text-slate-600'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {isRefreshing ? 'جارِ التحديث...' : 'تحديث البيانات الآن'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.4fr_1.6fr]">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            مخزون ومبيعات مشتركة بين الفروع
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">إدارة متكاملة للسلع والأدوات الرياضية</h2>
          <p className="mt-2 text-sm text-slate-600">
            أضف المنتجات بالفرع المناسب، نفذ المبيعات وراقب المخزون، مع تسجيل تلقائي في قيود الإيرادات والمصروفات بالماليات.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-sky-50/70 border border-sky-100 p-4">
            <div className="text-xs font-semibold text-sky-800">عدد المنتجات بالمخزن</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{products.length}</div>
            <div className="text-xs text-slate-500 mt-1">منتج متوفر</div>
          </div>
          <div className="rounded-2xl bg-amber-50/70 border border-amber-100 p-4">
            <div className="text-xs font-semibold text-amber-800">إجمالي المبيعات المنفذة</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{sales.length}</div>
            <div className="text-xs text-slate-500 mt-1">عملية بيع</div>
          </div>
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4">
            <div className="text-xs font-semibold text-emerald-800">إجمالي صافي الربح</div>
            <div className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(totalProfit)}</div>
            <div className="text-xs text-slate-500 mt-1">من كافة المبيعات</div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو الفرع..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-right outline-none focus:border-sky-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-right outline-none focus:border-sky-500 focus:bg-white min-w-[160px]"
          >
            <option value="">جميع الفروع</option>
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name || ''}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {(filterBranch || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setFilterBranch('');
              setSearchQuery('');
            }}
            className="text-xs font-medium text-rose-600 hover:underline"
          >
            إعادة تعيين الفلاتر
          </button>
        )}
      </div>

      {/* Action Forms: Add Product + Sell Product */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* ADD PRODUCT FORM */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">إضافة منتج جديد للمخزن</h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              تسجيل شراء ومصروفات
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={productForm.branch}
              onChange={(event) => setProductForm((prev) => ({ ...prev, branch: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
            >
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id || branch.name} value={branch.name || ''}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input
              value={productForm.name}
              onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="اسم المنتج (مثال: تيشرت النادي، كورة..)"
            />
            <input
              type="number"
              value={productForm.costPrice}
              onChange={(event) => setProductForm((prev) => ({ ...prev, costPrice: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="سعر الشراء / الجملة"
            />
            <input
              type="number"
              value={productForm.sellPrice}
              onChange={(event) => setProductForm((prev) => ({ ...prev, sellPrice: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="سعر البيع للعميل"
            />
            <input
              type="number"
              value={productForm.qty}
              onChange={(event) => setProductForm((prev) => ({ ...prev, qty: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="الكمية المشتراة"
            />
            <input
              type="number"
              value={productForm.minStock}
              onChange={(event) => setProductForm((prev) => ({ ...prev, minStock: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="حد التنبيه لنقص المخزون"
            />
          </div>
          <button
            type="button"
            onClick={addNewProduct}
            className="mt-4 w-full md:w-auto rounded-2xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
          >
            إضافة للمخزون وحفظ بالسيرفر
          </button>
        </div>

        {/* SELL PRODUCT FORM */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">تنفيذ عملية بيع</h3>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              تسجيل إيراد بالماليات
            </span>
          </div>
          <div className="grid gap-4">
            <select
              value={saleForm.branch}
              onChange={(event) => setSaleForm((prev) => ({ ...prev, branch: event.target.value, productId: '' }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
            >
              <option value="">اختر الفرع أو ابحث في كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id || branch.name} value={branch.name || ''}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              value={saleForm.productId}
              onChange={(event) => {
                const pId = event.target.value;
                const selectedProd = products.find((p) => p.id === pId);
                setSaleForm((prev) => ({
                  ...prev,
                  productId: pId,
                  branch: prev.branch || selectedProd?.branch || '',
                }));
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
            >
              <option value="">اختر المنتج المراد بيعه</option>
              {availableProductsForSale.map((product) => (
                <option key={product.id} value={product.id} disabled={product.qty <= 0}>
                  {product.name} {product.branch ? `(${product.branch})` : ''} - سعر: {product.sell} ج - (المتوفر:{' '}
                  {product.qty}) {product.qty <= 0 ? ' [نفذت الكمية]' : ''}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={saleForm.qty}
              onChange={(event) => setSaleForm((prev) => ({ ...prev, qty: event.target.value }))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none focus:border-sky-500"
              placeholder="الكمية المراد بيعها"
            />
          </div>
          <button
            type="button"
            onClick={sellProduct}
            className="mt-4 w-full md:w-auto rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            تأكيد البيع وتسجيل الإيراد
          </button>
        </div>
      </div>

      {/* Current Products Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-slate-900">المخزون </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {filteredProducts.length} منتج
            </span>
          </div>
          <div className="text-xs text-slate-500">
            قيمة المخزون الإجمالية: <span className="font-bold text-slate-800">{formatMoney(totalStockValue)}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">سعر الشراء</th>
                <th className="px-4 py-3">سعر البيع</th>
                <th className="px-4 py-3">الكمية المتوفرة</th>
                <th className="px-4 py-3">الحد الأدنى</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredProducts.length ? (
                filteredProducts.map((product) => {
                  const isLow = product.qty <= product.minStock;
                  const isOutOfStock = product.qty <= 0;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 border border-sky-100">
                          {product.branch || 'الفرع الرئيسي'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{product.name}</td>
                      <td className="px-4 py-3 text-slate-600">{product.cost} ج.م</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{product.sell} ج.م</td>
                      <td className={`px-4 py-3 font-bold ${isOutOfStock ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                        {product.qty}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{product.minStock}</td>
                      <td className="px-4 py-3">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            نفذ المخزون
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            منخفض
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            متوفر
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProductModal(product)}
                            className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(product.id)}
                            className="rounded-xl border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {isLoading ? 'جارِ تحميل المنتجات من السيرفر...' : 'لا يوجد منتجات مسجلة تطابق البحث.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Log Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold text-slate-900">سجل المبيعات</h3>
              <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                {filteredSales.length} عملية بيع
              </span>
            </div>
            <div className="text-xs text-slate-500">
              إجمالي ربح المبيعات المعروضة:{' '}
              <span className="font-bold text-emerald-600">
                {formatMoney(filteredSales.reduce((acc, s) => acc + (s.profit || 0), 0))}
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">سعر الشراء</th>
                <th className="px-4 py-3">سعر البيع</th>
                <th className="px-4 py-3">الكمية</th>
                <th className="px-4 py-3">صافي الربح</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredSales.length ? (
                filteredSales.map((sale, index) => (
                  <tr key={sale.id || `${sale.productId || sale.name}-${index}`} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 border border-sky-100">
                        {sale.branch || 'الفرع الرئيسي'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{sale.name}</td>
                    <td className="px-4 py-3 text-slate-500">{sale.cost} ج</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{sale.sell} ج</td>
                    <td className="px-4 py-3 font-semibold">{sale.qty}</td>
                    <td className="px-4 py-3 font-bold text-sky-700">{sale.profit} ج</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{sale.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditSaleModal(index)}
                          className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSale(index)}
                          className="rounded-xl border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    لا توجد عمليات بيع مسجلة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-center text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xl font-bold">إجمالي صافي أرباح المتجر لجميع الفروع: {formatMoney(totalProfit)}</div>
          <p className="text-xs text-emerald-100 mt-1">تتم المزامنة تلقائياً مع السيرفر كل 15 ثانية وعند فتح النافذة</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchStoreData(true)}
          className="rounded-2xl bg-white/20 hover:bg-white/30 px-5 py-2 text-sm font-semibold transition backdrop-blur-sm self-center"
        >
          مزامنة فورية
        </button>
      </div>

      {/* MODAL: EDIT PRODUCT */}
      {editProductForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">تعديل بيانات المنتج بالسيرفر</h3>
              <button
                type="button"
                onClick={() => setEditProductForm(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={editProductForm.branch}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, branch: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500 md:col-span-2 text-right"
              >
                <option value="">اختر الفرع</option>
                {branches.map((b) => (
                  <option key={b.id || b.name} value={b.name || ''}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                value={editProductForm.name}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="اسم المنتج"
              />
              <input
                type="number"
                value={editProductForm.costPrice}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, costPrice: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="سعر الجملة"
              />
              <input
                type="number"
                value={editProductForm.sellPrice}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, sellPrice: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="سعر البيع"
              />
              <input
                type="number"
                value={editProductForm.qty}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, qty: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="الكمية الحالية بالمخزن"
              />
              <input
                type="number"
                value={editProductForm.minStock}
                onChange={(event) =>
                  setEditProductForm((prev) => (prev ? { ...prev, minStock: event.target.value } : prev))
                }
                className="rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                placeholder="الحد الأدنى"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditProductForm(null)}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveEditedProduct}
                className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                حفظ التعديلات بالسيرفر
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* MODAL: EDIT SALE */}
      {editSaleForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">تعديل عملية بيع</h3>
              <button
                type="button"
                onClick={() => setEditSaleForm(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-slate-700">
                الفرع
                <select
                  value={editSaleForm.branch}
                  onChange={(event) =>
                    setEditSaleForm((prev) => (prev ? { ...prev, branch: event.target.value } : prev))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-right outline-none focus:border-sky-500"
                >
                  {branches.map((b) => (
                    <option key={b.id || b.name} value={b.name || ''}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                الكمية المباعة
                <input
                  type="number"
                  value={editSaleForm.qty}
                  onChange={(event) =>
                    setEditSaleForm((prev) => (prev ? { ...prev, qty: event.target.value } : prev))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-sm text-slate-700">
                سعر البيع (للقطعة)
                <input
                  type="number"
                  value={editSaleForm.price}
                  onChange={(event) =>
                    setEditSaleForm((prev) => (prev ? { ...prev, price: event.target.value } : prev))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditSaleForm(null)}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveEditedSale}
                className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                حفظ ومزامنة
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast Notification */}
      {toast ? (
        <div
          className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
