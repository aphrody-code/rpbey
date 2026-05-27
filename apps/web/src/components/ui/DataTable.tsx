'use client';

import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

type Order = 'asc' | 'desc';

export interface Column<T> {
  id: keyof T | string;
  label: string;
  numeric?: boolean;
  disablePadding?: boolean;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: number | string;
}

interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[];
  rows: T[];
  title?: string;
  selectable?: boolean;
  selected?: (string | number)[];
  onSelectionChange?: (selected: (string | number)[]) => void;
  defaultOrderBy?: keyof T | string;
  defaultOrder?: Order;
  rowsPerPageOptions?: number[];
  dense?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  actions?: ReactNode;
  selectedActions?: (selected: (string | number)[]) => ReactNode;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function descendingComparator<T>(
  a: T,
  b: T,
  orderBy: keyof T | string,
): number {
  const aValue = (a as Record<string, unknown>)[orderBy as string];
  const bValue = (b as Record<string, unknown>)[orderBy as string];

  if (bValue == null && aValue != null) return -1;
  if (aValue == null && bValue != null) return 1;
  if (aValue == null && bValue == null) return 0;

  if (typeof aValue === 'string' && typeof bValue === 'string') {
    return bValue.localeCompare(aValue);
  }

  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return bValue - aValue;
  }

  // Fallback for dates and other types
  if (String(bValue) < String(aValue)) return -1;
  if (String(bValue) > String(aValue)) return 1;
  return 0;
}

function getComparator<T>(order: Order, orderBy: keyof T | string) {
  return order === 'desc'
    ? (a: T, b: T) => descendingComparator(a, b, orderBy)
    : (a: T, b: T) => -descendingComparator(a, b, orderBy);
}

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  title,
  selectable = false,
  selected = [],
  onSelectionChange,
  defaultOrderBy,
  defaultOrder = 'asc',
  rowsPerPageOptions = [5, 10, 25],
  dense = false,
  stickyHeader = false,
  maxHeight,
  actions,
  selectedActions,
  onRowClick,
  emptyMessage = 'Aucune donnée',
}: DataTableProps<T>) {
  const [order, setOrder] = useState<Order>(defaultOrder);
  const [orderBy, setOrderBy] = useState<keyof T | string>(
    defaultOrderBy ?? columns[0]?.id ?? '',
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0] ?? 10);

  const handleRequestSort = useCallback(
    (property: keyof T | string) => {
      const isAsc = orderBy === property && order === 'asc';
      setOrder(isAsc ? 'desc' : 'asc');
      setOrderBy(property);
    },
    [order, orderBy],
  );

  const handleSelectAllClick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        onSelectionChange?.(rows.map((row) => row.id));
      } else {
        onSelectionChange?.([]);
      }
    },
    [rows, onSelectionChange],
  );

  const handleClick = useCallback(
    (id: string | number) => {
      const selectedIndex = selected.indexOf(id);
      let newSelected: (string | number)[] = [];

      if (selectedIndex === -1) {
        newSelected = [...selected, id];
      } else {
        newSelected = selected.filter((itemId) => itemId !== id);
      }

      onSelectionChange?.(newSelected);
    },
    [selected, onSelectionChange],
  );

  const handleChangePage = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(parseInt(event.target.value, 10));
      setPage(0);
    },
    [],
  );

  const sortedRows = useMemo(() => {
    return [...rows].sort(getComparator(order, orderBy));
  }, [rows, order, orderBy]);

  const paginatedRows = useMemo(() => {
    return sortedRows.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage,
    );
  }, [sortedRows, page, rowsPerPage]);

  const numSelected = selected.length;
  const rowCount = rows.length;

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {(title || actions || (numSelected > 0 && selectedActions)) && (
        <Toolbar
          sx={{
            pl: { sm: 2 },
            pr: { xs: 1, sm: 1 },
            ...(numSelected > 0 && {
              bgcolor: (theme) =>
                alpha(
                  theme.palette.primary.main,
                  theme.palette.action.activatedOpacity,
                ),
            }),
          }}
        >
          {numSelected > 0 ? (
            <Typography
              variant="subtitle1"
              component="div"
              sx={{
                color: 'inherit',
                flex: '1 1 100%',
              }}
            >
              {numSelected} sélectionné{numSelected > 1 ? 's' : ''}
            </Typography>
          ) : (
            <Typography sx={{ flex: '1 1 100%' }} variant="h6" component="div">
              {title}
            </Typography>
          )}
          {numSelected > 0 ? selectedActions?.(selected) : actions}
        </Toolbar>
      )}
      <TableContainer sx={{ maxHeight }}>
        <Table
          stickyHeader={stickyHeader}
          size={dense ? 'small' : 'medium'}
          aria-label={title ?? 'data table'}
        >
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    color="primary"
                    indeterminate={numSelected > 0 && numSelected < rowCount}
                    checked={rowCount > 0 && numSelected === rowCount}
                    onChange={handleSelectAllClick}
                    slotProps={{
                      input: { 'aria-label': 'sélectionner tout' },
                    }}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={String(column.id)}
                  align={column.numeric ? 'right' : 'left'}
                  padding={column.disablePadding ? 'none' : 'normal'}
                  sortDirection={orderBy === column.id ? order : false}
                  sx={{ width: column.width }}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  align="center"
                >
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      py: 4,
                    }}
                  >
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => {
                const isSelected = selected.includes(row.id);
                return (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() =>
                      selectable ? handleClick(row.id) : onRowClick?.(row)
                    }
                    role={selectable ? 'checkbox' : undefined}
                    aria-checked={selectable ? isSelected : undefined}
                    tabIndex={-1}
                    selected={isSelected}
                    sx={{
                      cursor: selectable || onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          color="primary"
                          checked={isSelected}
                          slotProps={{
                            input: {
                              'aria-labelledby': `table-row-${row.id}`,
                            },
                          }}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={String(column.id)}
                        align={column.numeric ? 'right' : 'left'}
                        padding={column.disablePadding ? 'none' : 'normal'}
                      >
                        {column.render
                          ? column.render(row)
                          : String(
                              (row as Record<string, unknown>)[
                                column.id as string
                              ] ?? '',
                            )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={rowCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Lignes par page :"
        labelDisplayedRows={({ from, to, count }) =>
          `${from}-${to} sur ${count !== -1 ? count : `plus de ${to}`}`
        }
      />
    </Paper>
  );
}
