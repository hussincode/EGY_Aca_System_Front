import { useEffect, useMemo, useState } from 'react';
import { recordFinanceTransaction } from '@/utils/sharedFinance';

type Product = {
  id: string;
  branch: string;
  name: string;
  cost: number;
  sell: number;
  qty: number;
  minStock: number;
};

type Sale = {
  branch: string;
  name: string;
  cost: number;
  sell: number;
  qty: number;
  profit: number;
  date: string;
  productId?: string;
};

type Branch = {
  id?: string;
  name?: string;
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
  name: string;
  costPrice: string;
  sellPrice: string;
  qty: string;
  minStock: string;
};

type EditSaleForm = {
  qty: string;
  price: string;
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
  return `${value.toLocaleString('en-US')} ج.م`;
}

function getFinanceWindow(): typeof window & { sharedFinance?: { addFinance: (type: 'income' | 'expense', amount: number, category: string, branch: string, description: string, date: string) => void } } {
  return window as typeof window & { sharedFinance?: { addFinance: (type: 'income' | 'expense', amount: number, category: string, branch: string, description: string, date: string) => void } };
}

function createStableId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function StoreSynced() {
  const [products, setProducts] = useState<Product[]>(() => readStoredData('storeProducts', []));
  const [sales, setSales] = useState<Sale[]>(() => readStoredData('storeSales', []));
  const [branches] = useState<Branch[]>(() => {
    const storedBranches = readStoredData<Branch[]>('branches', []);
    return storedBranches.length ? storedBranches : [{ name: 'الفرع الرئيسي' }];
  });
  const [productForm, setProductForm] = useState<StoreForm>(initialProductForm);
  const [saleForm, setSaleForm] = useState<SaleForm>(initialSaleForm);
  const [editProductForm, setEditProductForm] = useState<EditProductForm | null>(null);
  const [editSaleForm, setEditSaleForm] = useState<EditSaleForm | null>(null);
  const [editingSaleIndex, setEditingSaleIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredProducts = useMemo(() => products, [products]);
  const totalProfit = useMemo(() => sales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0), [sales]);

  const persistStoreData = (nextProducts: Product[], nextSales: Sale[]) => {
    setProducts(nextProducts);
    setSales(nextSales);
    window.localStorage.setItem('storeProducts', JSON.stringify(nextProducts));
    window.localStorage.setItem('storeSales', JSON.stringify(nextSales));
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const addNewProduct = () => {
    const branch = productForm.branch.trim();
    const name = productForm.name.trim();
    const cost = Number(productForm.costPrice);
    const sell = Number(productForm.sellPrice);
    const qty = Number(productForm.qty);
    const minStock = Number(productForm.minStock) || 5;

    if (!branch || !name || Number.isNaN(cost) || Number.isNaN(sell) || Number.isNaN(qty)) {
      showToast('يرجى إكمال كافة البيانات الموضحة', 'error');
      return;
    }

    const totalCost = cost * qty;
    const nextProducts: Product[] = [
      ...products,
      {
        id: createStableId('product'),
        branch,
        name,
        cost,
        sell,
        qty,
        minStock,
      },
    ];

    const nextSales = [...sales];
    persistStoreData(nextProducts, nextSales);

    recordFinanceTransaction({
      type: 'expense',
      amount: totalCost,
      category: 'مشتريات متجر',
      branch,
      description: `شراء ${qty} من ${name}`,
      date: new Date().toISOString().split('T')[0],
    });

    setProductForm(initialProductForm);
    showToast('تمت إضافة المنتج للمخزون وتسجيل التكلفة كمصروفات بالماليات', 'success');
  };

  const sellProduct = () => {
    const branch = saleForm.branch.trim();
    const productId = saleForm.productId;
    const qtyToSell = Number(saleForm.qty);
    const product = products.find((item) => item.id === productId);

    if (!branch || !productId || Number.isNaN(qtyToSell) || qtyToSell <= 0 || !product) {
      showToast('اختر المنتج والكمية بشكل صحيح', 'error');
      return;
    }

    if (qtyToSell > product.qty) {
      showToast('الكمية المتاحة غير كافية!', 'error');
      return;
    }

    const revenue = product.sell * qtyToSell;
    const profit = (product.sell - product.cost) * qtyToSell;
    const today = new Date().toISOString().split('T')[0];

    const nextProducts = products.map((item) => (item.id === product.id ? { ...item, qty: item.qty - qtyToSell } : item));
    const nextSales = [
      ...sales,
      {
        branch,
        name: product.name,
        cost: product.cost,
        sell: product.sell,
        qty: qtyToSell,
        profit,
        date: today,
        productId: product.id,
      },
    ];

    persistStoreData(nextProducts, nextSales);

    recordFinanceTransaction({
      type: 'income',
      amount: revenue,
      category: 'مبيعات متجر',
      branch,
      description: `بيع ${qtyToSell} من ${product.name}`,
      date: today,
    });

    setSaleForm(initialSaleForm);
    showToast(`تم البيع وتسجيل الإيراد (${revenue} ج.م) بالماليات بنجاح`, 'success');
  };

  const deleteProduct = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return;
    const nextProducts = products.filter((product) => product.id !== id);
    persistStoreData(nextProducts, sales);
    showToast('تم حذف المنتج', 'success');
  };

  const openEditProductModal = (product: Product) => {
    setEditProductForm({
      id: product.id,
      name: product.name,
      costPrice: String(product.cost),
      sellPrice: String(product.sell),
      qty: String(product.qty),
      minStock: String(product.minStock),
    });
  };

    const saveEditedProduct = () => {
      if (!editProductForm) return;
      const oldProduct = products.find((product) => product.id === editProductForm.id);
      const newQty = Number(editProductForm.qty);
      const costPrice = Number(editProductForm.costPrice);
      const addedQty = newQty - (oldProduct?.qty || 0);

      const nextProducts = products.map((product) =>
        product.id === editProductForm.id
          ? {
              ...product,
              name: editProductForm.name,
              cost: costPrice,
              sell: Number(editProductForm.sellPrice),
              qty: newQty,
              minStock: Number(editProductForm.minStock),
            }
          : product,
      );
      persistStoreData(nextProducts, sales);

      if (addedQty > 0 && costPrice > 0) {
        recordFinanceTransaction({
          type: 'expense',
          amount: addedQty * costPrice,
          category: 'مشتريات متجر',
          branch: oldProduct?.branch || '',
          description: `شراء كمية إضافية (${addedQty}) من ${editProductForm.name}`,
        });
      }

      setEditProductForm(null);
      showToast('تم تعديل المنتج وتسجيل تكلفة الزيادة بالماليات', 'success');
    };

    const deleteSale = (index: number) => {
      if (!window.confirm('هل أنت متأكد من حذف عملية البيع؟ سيتم استرجاع الكمية للمخزون.')) return;
      const sale = sales[index];
      const nextProducts = products.map((product) =>
        product.id === sale.productId ? { ...product, qty: Number(product.qty) + Number(sale.qty) } : product,
      );
      const nextSales = sales.filter((_, itemIndex) => itemIndex !== index);
      persistStoreData(nextProducts, nextSales);

      recordFinanceTransaction({
        type: 'expense',
        amount: Number(sale.sell) * Number(sale.qty),
        category: 'استرجاع بيع',
        branch: sale.branch,
        description: `إلغاء بيع ${sale.qty} من ${sale.name}`,
        date: new Date().toISOString().split('T')[0],
      });

      showToast('تم حذف عملية البيع واسترجاع الكمية وتسجيل الاسترجاع بالماليات', 'success');
    };

  const openEditSaleModal = (index: number) => {
    const sale = sales[index];
    setEditingSaleIndex(index);
    setEditSaleForm({ qty: String(sale.qty), price: String(sale.sell) });
  };

  const saveEditedSale = () => {
    if (editingSaleIndex === null || !editSaleForm) return;

    const newQty = Number(editSaleForm.qty);
    const newPrice = Number(editSaleForm.price);
    if (Number.isNaN(newQty) || newQty <= 0 || Number.isNaN(newPrice)) {
      showToast('بيانات غير صحيحة', 'error');
      return;
    }

    const sale = sales[editingSaleIndex];
    const oldRevenue = Number(sale.sell) * Number(sale.qty);
    const newRevenue = newPrice * newQty;
    const diff = newRevenue - oldRevenue;

    const qtyDiff = Number(sale.qty) - newQty;
    const nextProducts = products.map((product) => {
      if (product.id !== sale.productId) return product;
      const availableQty = Number(product.qty) + qtyDiff;
      if (qtyDiff < 0 && availableQty < 0) {
        showToast('الكمية المتاحة في المخزون لا تكفي للزيادة المطلوبة', 'error');
        return product;
      }
      return { ...product, qty: availableQty };
    });

    const nextSales = sales.map((item, index) =>
      index === editingSaleIndex
        ? {
            ...item,
            qty: newQty,
            sell: newPrice,
            profit: (newPrice - Number(item.cost)) * newQty,
          }
        : item,
    );

    persistStoreData(nextProducts, nextSales);

    if (diff > 0) {
      recordFinanceTransaction({
        type: 'income',
        amount: diff,
        category: 'مبيعات متجر',
        branch: sale.branch,
        description: `تعديل بيع (مبلغ إضافي): ${sale.name}`,
      });
    } else if (diff < 0) {
      recordFinanceTransaction({
        type: 'expense',
        amount: Math.abs(diff),
        category: 'استرجاع بيع',
        branch: sale.branch,
        description: `تعديل بيع (خصم مبلغ): ${sale.name}`,
      });
    }

    setEditingSaleIndex(null);
    setEditSaleForm(null);
    showToast('تم تعديل عملية البيع ومزامنتها مع الماليات', 'success');
  };

  const availableProducts = useMemo(() => {
    const branch = saleForm.branch;
    return products.filter((product) => !branch || product.branch === branch);
  }, [products, saleForm.branch]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">المتجر</p>
            <h1 className="text-3xl font-semibold text-slate-900">متجر الأكاديمية</h1>
            <p className="mt-2 text-sm text-slate-600">إدارة المخزون والمبيعات ومزامنة كل حركة مع النظام المالي في نفس الواجهة.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            مخزون ومبيعات متزامنة
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">المتجر بشكل أوضح وأسهل للإدارة اليومية</h2>
          <p className="mt-2 text-sm text-slate-600">أضف المنتجات، نفذ عمليات البيع، وتابع صافي الربح مع مزامنة الشراء والبيع مباشرة مع الحسابات المالية.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">عدد المنتجات</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{products.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">إجمالي المبيعات</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{sales.length}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">صافي الربح</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(totalProfit)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">إضافة منتج جديد</h3>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">مزامنة مشتريات</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select value={productForm.branch} onChange={(event) => setProductForm((prev) => ({ ...prev, branch: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none">
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id || branch.name} value={branch.name || ''}>{branch.name}</option>
              ))}
            </select>
            <input value={productForm.name} onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="اسم المنتج" />
            <input type="number" value={productForm.costPrice} onChange={(event) => setProductForm((prev) => ({ ...prev, costPrice: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="سعر الجملة" />
            <input type="number" value={productForm.sellPrice} onChange={(event) => setProductForm((prev) => ({ ...prev, sellPrice: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="سعر البيع" />
            <input type="number" value={productForm.qty} onChange={(event) => setProductForm((prev) => ({ ...prev, qty: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="الكمية" />
            <input type="number" value={productForm.minStock} onChange={(event) => setProductForm((prev) => ({ ...prev, minStock: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="الحد الأدنى" />
          </div>
          <button type="button" onClick={addNewProduct} className="mt-4 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">إضافة للمخزون</button>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">تنفيذ عملية بيع</h3>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">مزامنة مبيعات</span>
          </div>
          <div className="grid gap-4">
            <select value={saleForm.branch} onChange={(event) => setSaleForm((prev) => ({ ...prev, branch: event.target.value, productId: '' }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none">
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id || branch.name} value={branch.name || ''}>{branch.name}</option>
              ))}
            </select>
            <select value={saleForm.productId} onChange={(event) => setSaleForm((prev) => ({ ...prev, productId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none">
              <option value="">اختر المنتج</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>{product.name} (المتوفر: {product.qty})</option>
              ))}
            </select>
            <input type="number" value={saleForm.qty} onChange={(event) => setSaleForm((prev) => ({ ...prev, qty: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none" placeholder="الكمية المراد بيعها" />
          </div>
          <button type="button" onClick={sellProduct} className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white">بيع المنتج</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-semibold text-slate-900">المخزون الحالي</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">الجملة</th>
                <th className="px-4 py-3">البيع</th>
                <th className="px-4 py-3">الكمية</th>
                <th className="px-4 py-3">الحد الأدنى</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100 text-sm text-slate-700">
                    <td className="px-4 py-3">{product.branch}</td>
                    <td className="px-4 py-3">{product.name}</td>
                    <td className="px-4 py-3">{product.cost}</td>
                    <td className="px-4 py-3">{product.sell}</td>
                    <td className={`px-4 py-3 ${product.qty <= product.minStock ? 'font-semibold text-rose-600' : ''}`}>{product.qty}</td>
                    <td className="px-4 py-3">{product.minStock}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEditProductModal(product)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm">تعديل</button>
                        <button type="button" onClick={() => deleteProduct(product.id)} className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm text-rose-600">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">لا يوجد مخزون متاح</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">سجل المبيعات</h3>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">{sales.length} عملية بيع</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">المنتج</th>
                <th className="px-4 py-3">الجملة</th>
                <th className="px-4 py-3">البيع</th>
                <th className="px-4 py-3">الكمية</th>
                <th className="px-4 py-3">الربح</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {sales.length ? (
                sales.map((sale, index) => (
                  <tr key={`${sale.productId || sale.name}-${index}`} className="border-t border-slate-100 text-sm text-slate-700">
                    <td className="px-4 py-3">{sale.branch}</td>
                    <td className="px-4 py-3">{sale.name}</td>
                    <td className="px-4 py-3">{sale.cost}</td>
                    <td className="px-4 py-3">{sale.sell}</td>
                    <td className="px-4 py-3">{sale.qty}</td>
                    <td className="px-4 py-3">{sale.profit}</td>
                    <td className="px-4 py-3">{sale.date}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEditSaleModal(index)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm">تعديل</button>
                        <button type="button" onClick={() => deleteSale(index)} className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm text-rose-600">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">لا توجد مبيعات بعد</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl bg-emerald-600 p-6 text-center text-white shadow-sm">
        <div className="text-2xl font-semibold">صافي ربح المتجر: {formatMoney(totalProfit)}</div>
      </div>

      {editProductForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">تعديل منتج</h3>
              <button type="button" onClick={() => setEditProductForm(null)} className="text-slate-500">✕</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input value={editProductForm.name} onChange={(event) => setEditProductForm((prev) => prev ? { ...prev, name: event.target.value } : prev)} className="rounded-2xl border border-slate-200 px-3 py-2 outline-none" placeholder="اسم المنتج" />
              <input type="number" value={editProductForm.costPrice} onChange={(event) => setEditProductForm((prev) => prev ? { ...prev, costPrice: event.target.value } : prev)} className="rounded-2xl border border-slate-200 px-3 py-2 outline-none" placeholder="سعر الجملة" />
              <input type="number" value={editProductForm.sellPrice} onChange={(event) => setEditProductForm((prev) => prev ? { ...prev, sellPrice: event.target.value } : prev)} className="rounded-2xl border border-slate-200 px-3 py-2 outline-none" placeholder="سعر البيع" />
              <input type="number" value={editProductForm.qty} onChange={(event) => setEditProductForm((prev) => prev ? { ...prev, qty: event.target.value } : prev)} className="rounded-2xl border border-slate-200 px-3 py-2 outline-none" placeholder="الكمية الحالية" />
              <input type="number" value={editProductForm.minStock} onChange={(event) => setEditProductForm((prev) => prev ? { ...prev, minStock: event.target.value } : prev)} className="rounded-2xl border border-slate-200 px-3 py-2 outline-none" placeholder="الحد الأدنى" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditProductForm(null)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">إلغاء</button>
              <button type="button" onClick={saveEditedProduct} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">حفظ التعديلات</button>
            </div>
          </div>
        </div>
      ) : null}

      {editingSaleIndex !== null && editSaleForm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">تعديل عملية بيع</h3>
              <button type="button" onClick={() => { setEditingSaleIndex(null); setEditSaleForm(null); }} className="text-slate-500">✕</button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm text-slate-700">
                الكمية المباعة
                <input type="number" value={editSaleForm.qty} onChange={(event) => setEditSaleForm((prev) => prev ? { ...prev, qty: event.target.value } : prev)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none" />
              </label>
              <label className="block text-sm text-slate-700">
                سعر البيع (للقطعة)
                <input type="number" value={editSaleForm.price} onChange={(event) => setEditSaleForm((prev) => prev ? { ...prev, price: event.target.value } : prev)} className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setEditingSaleIndex(null); setEditSaleForm(null); }} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">إلغاء</button>
              <button type="button" onClick={saveEditedSale} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">حفظ</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed left-1/2 top-6 z-[80] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-medium text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
