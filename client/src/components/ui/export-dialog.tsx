import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, FileText, FileSpreadsheet, Calendar } from "lucide-react";

interface ExportDialogProps {
  trigger: React.ReactNode;
  data: any[];
  filename: string;
}

export function ExportDialog({ trigger, data, filename }: ExportDialogProps) {
  const [format, setFormat] = useState("csv");
  const [dateRange, setDateRange] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let filteredData = data;
      
      // Apply date filtering
      if (dateRange !== "all") {
        const days = parseInt(dateRange);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        filteredData = data.filter(item => 
          new Date(item.createdAt || item.timestamp) >= cutoffDate
        );
      }

      if (format === "csv") {
        exportToCSV(filteredData, filename);
      } else if (format === "json") {
        exportToJSON(filteredData, filename);
      } else if (format === "pdf") {
        exportToPDF(filteredData, filename);
      }
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === "string" && value.includes(",")) {
            return `"${value}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");
    
    downloadFile(csvContent, `${filename}.csv`, "text/csv");
  };

  const exportToJSON = (data: any[], filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, `${filename}.json`, "application/json");
  };

  const exportToPDF = (data: any[], filename: string) => {
    // Simple PDF export - in a real implementation, use a PDF library
    const content = data.map(item => 
      Object.entries(item).map(([key, value]) => `${key}: ${value}`).join("\n")
    ).join("\n\n");
    
    downloadFile(content, `${filename}.txt`, "text/plain");
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Data
          </DialogTitle>
          <DialogDescription>
            Choose format and date range for export
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Excel)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    JSON
                  </div>
                </SelectItem>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    PDF Report
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="dateRange">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    All Time
                  </div>
                </SelectItem>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              "Exporting..."
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {data.length} Records
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}