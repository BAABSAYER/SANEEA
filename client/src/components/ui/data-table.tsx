import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";

interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  searchable?: boolean;
  searchBy?: (item: T, query: string) => boolean;
}

export function DataTable<T>({
  columns,
  data,
  searchable = false,
  searchBy,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc" | null>(
    null
  );

  // Filter data by search query
  const filteredData = React.useMemo(() => {
    if (!searchable || !searchQuery || !searchBy) return data;
    
    return data.filter((item) => searchBy(item, searchQuery.toLowerCase()));
  }, [data, searchQuery, searchable, searchBy]);

  // Sort data by column
  const sortedData = React.useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      // Handle comparing by accessing property safely with bracket notation
      // This assumes the column id matches the property name in the object
      // @ts-ignore - This is a bit of a hack to get around typing
      const aValue = a[sortColumn];
      // @ts-ignore
      const bValue = b[sortColumn];
      
      if (aValue === bValue) return 0;
      
      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filteredData, sortColumn, sortDirection]);

  // Handle column header click for sorting
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const renderSortIndicator = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    }
    
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-2 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4" />
    );
  };

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.id}>
                  {column.sortable ? (
                    <Button
                      variant="ghost"
                      className="p-0 font-medium"
                      onClick={() => handleSort(column.id)}
                    >
                      {column.header}
                      {renderSortIndicator(column.id)}
                    </Button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((item, i) => (
                <TableRow key={i}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      {column.cell(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
