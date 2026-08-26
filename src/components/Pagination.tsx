type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  label?: string;
};

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  label = 'عنصر',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
      <span className="text-slate-500">
        عرض الصفحة <strong className="text-slate-900 font-bold">{currentPage}</strong> من أصل{' '}
        <strong className="text-slate-900 font-bold">{totalPages}</strong> (إجمالي {totalItems} {label})
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
        >
          السابق
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={`h-8 min-w-[32px] rounded-xl px-2.5 text-xs font-bold transition cursor-pointer ${
              currentPage === pageNum
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
