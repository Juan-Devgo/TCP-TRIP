import { Fragment, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type RowData,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The only feature this table opts into. TanStack v9 tree-shakes whatever is
 * not registered here, so sorting and filtering cost nothing while no screen
 * asks for them — add the feature *and* its row model here when one does.
 */
export const dataTableFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;

/**
 * Column helper bound to this table's feature set. Call it once per row type,
 * at module scope, and keep the resulting columns stable across renders.
 */
export function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

export const DEFAULT_PAGE_SIZE = 10;

type DataTableProps<TData extends RowData> = {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  /** Ignored when `pagination` is supplied — the caller's state wins. */
  pageSize?: number;
  /**
   * Lift the page state out when something else on the screen has to follow
   * the same page (a detail list under the table, say). Leave both out and the
   * table keeps its own.
   */
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  /**
   * Page sizes offered next to the pager. Leave it out and the size is fixed.
   * Powers of two read as such to a networking student — 8, 16, 32.
   */
  pageSizeOptions?: number[];
  /**
   * Turns every row into a disclosure: the row gets a chevron and clicking it
   * opens this content in a full-width row underneath. The detail keeps the
   * summary columns short instead of widening the table.
   */
  expandedContent?: (row: TData) => React.ReactNode;
  /** Shown in place of the rows when `data` is empty. */
  emptyMessage?: string;
  /** Layout only — the bordered container around the table. */
  className?: string;
  /** Classes for a row, by row index: brand ink for a highlighted subnet. */
  rowClassName?: (row: TData, index: number) => string | undefined;
};

/**
 * A table with pagination and nothing else: no sorting, no filtering, no
 * selection. Feed it `columns` from `dataTableColumns()` and an array of rows.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  pageSize = DEFAULT_PAGE_SIZE,
  pagination,
  onPaginationChange,
  pageSizeOptions,
  expandedContent,
  emptyMessage,
  className,
  rowClassName,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const rowsPerPageId = useId();
  /** Which rows are open, by TanStack row id — never persisted. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    initialState: { pagination: { pageIndex: 0, pageSize } },
    // `exactOptionalPropertyTypes`: an explicit `undefined` is not the same as
    // an absent key, so the controlled pair is spread in or left out entirely.
    ...(pagination !== undefined && { state: { pagination } }),
    ...(onPaginationChange !== undefined && {
      onPaginationChange: (updater) =>
        onPaginationChange(
          typeof updater === "function"
            ? updater(pagination ?? { pageIndex: 0, pageSize })
            : updater,
        ),
    }),
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageIndex = table.state.pagination.pageIndex;
  const currentPageSize = table.state.pagination.pageSize;

  const sizeItems = useMemo(
    () =>
      (pageSizeOptions ?? []).map((size) => ({
        label: String(size),
        value: String(size),
      })),
    [pageSizeOptions],
  );

  /**
   * Written in one shot rather than through `setPageSize` + `setPageIndex`:
   * with a controlled `pagination` the second updater would still read the
   * stale prop and undo the first.
   */
  function changePageSize(size: number) {
    const next: PaginationState = { pageIndex: 0, pageSize: size };
    if (onPaginationChange) onPaginationChange(next);
    else table.setPagination(next);
  }

  function toggleRow(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const columnCount = columns.length + (expandedContent ? 1 : 0);

  return (
    <div className="flex flex-col gap-2">
      <div className={cn("overflow-hidden rounded-lg border", className)}>
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-3">
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
                {expandedContent && <TableHead className="w-10 px-3" />}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => {
                const isOpen = expanded.has(row.id);
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      className={cn(
                        expandedContent && "cursor-pointer",
                        rowClassName?.(row.original, row.index),
                      )}
                      {...(expandedContent && {
                        onClick: () => toggleRow(row.id),
                      })}
                    >
                      {row.getAllCells().map((cell) => (
                        <TableCell key={cell.id} className="px-3">
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                      {expandedContent && (
                        <TableCell className="w-10 px-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-expanded={isOpen}
                            aria-label={t(
                              isOpen
                                ? "dataTable.collapseRow"
                                : "dataTable.expandRow",
                            )}
                            onClick={(event) => {
                              // The row handles the click already.
                              event.stopPropagation();
                              toggleRow(row.id);
                            }}
                          >
                            <ChevronDown
                              className={cn(
                                "transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                    {expandedContent && isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={columnCount}
                          className="bg-muted/30 p-0 whitespace-normal"
                        >
                          {expandedContent(row.original)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="h-20 text-center text-muted-foreground"
                >
                  {emptyMessage ?? t("dataTable.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {(pageCount > 1 || sizeItems.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            {sizeItems.length > 0 && (
              <div className="flex items-center gap-2">
                <span id={rowsPerPageId} className="text-xs text-muted-foreground">
                  {t("dataTable.rowsPerPage")}
                </span>
                <Select
                  items={sizeItems}
                  value={String(currentPageSize)}
                  onValueChange={(next) => changePageSize(Number(next))}
                >
                  <SelectTrigger
                    size="sm"
                    aria-labelledby={rowsPerPageId}
                    className="w-20 font-mono"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                        className="font-mono"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {pageCount > 1 && (
              <p className="flex text-sm text-muted-foreground m-0">
                {t("dataTable.page", { page: pageIndex + 1, total: pageCount })}
              </p>
            )}
          </div>

          {pageCount > 1 && (
            <div className="flex gap-1">
              <PageButton
                label={t("dataTable.first")}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.firstPage()}
              >
                <ChevronsLeft />
              </PageButton>
              <PageButton
                label={t("dataTable.previous")}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft />
              </PageButton>
              <PageButton
                label={t("dataTable.next")}
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight />
              </PageButton>
              <PageButton
                label={t("dataTable.last")}
                disabled={!table.getCanNextPage()}
                onClick={() => table.lastPage()}
              >
                <ChevronsRight />
              </PageButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
