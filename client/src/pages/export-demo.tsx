import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  exportToClipboard, 
  exportToPDF, 
  exportToWord, 
  validateExportData,
  type ExportData 
} from "@/lib/export";
import { 
  Copy, 
  FileText, 
  Download,
  CheckCircle,
  AlertTriangle,
  Loader2
} from "lucide-react";

export default function ExportDemo() {
  const { toast } = useToast();
  const [exportingClipboard, setExportingClipboard] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  // Mock data for testing
  const mockExportData: ExportData = {
    project: {
      id: '1',
      title: 'Digital Equity Expansion Grant',
      funder: 'National Science Foundation',
      amount: '$250,000',
      deadline: '2024-12-31',
      status: 'draft',
      description: 'This project aims to expand digital equity in underserved communities by providing technology access, digital literacy training, and sustainable support systems. Our comprehensive approach includes hardware provisioning, educational programs, and community partnerships to ensure lasting impact.',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15')
    },
    questions: [
      {
        id: '1',
        projectId: '1',
        question: 'Describe the specific problem or need that your project addresses.',
        wordLimit: 500,
        priority: 'high',
        response: 'The digital divide continues to perpetuate educational and economic inequalities in rural and urban underserved communities. Our research indicates that 37% of households in our target area lack reliable broadband access, and 45% of students do not have access to devices capable of supporting modern educational applications. This gap has been exacerbated by the shift to remote learning and digital-first services across healthcare, employment, and civic engagement. Without intervention, these communities will fall further behind in an increasingly digital economy, limiting opportunities for residents and hindering overall community development.',
        responseStatus: 'complete',
        createdAt: new Date('2024-01-01')
      },
      {
        id: '2',
        projectId: '1',
        question: 'What are the specific goals and objectives of your project?',
        wordLimit: 400,
        priority: 'high',
        response: 'Our project has four primary objectives: 1) Establish sustainable broadband access for 500 households within 24 months through partnerships with local ISPs and infrastructure improvements. 2) Provide digital devices (tablets/laptops) to 1,200 students and 300 adults, ensuring each household has adequate technology for educational and professional needs. 3) Deliver comprehensive digital literacy training to 800 community members through workshops, one-on-one sessions, and peer mentorship programs. 4) Create a community technology center that will serve as an ongoing resource for technical support, advanced training, and innovation incubation, ensuring project sustainability beyond the grant period.',
        responseStatus: 'complete',
        createdAt: new Date('2024-01-01')
      },
      {
        id: '3',
        projectId: '1',
        question: 'How will you measure the success and impact of your project?',
        wordLimit: 350,
        priority: 'medium',
        response: 'Success will be measured through both quantitative and qualitative metrics. Quantitative measures include: broadband adoption rates (target: 75% of eligible households), device utilization statistics (target: 80% active daily usage), training completion rates (target: 90% completion for enrolled participants), and employment/educational outcome improvements (target: 25% increase in job applications, 40% increase in online course enrollment). Qualitative measures will be gathered through quarterly community surveys, focus groups with participants, and case studies highlighting individual transformation stories. We will also track long-term sustainability metrics including community center usage, peer-to-peer learning networks, and local business adoption of digital tools.',
        responseStatus: 'complete',
        createdAt: new Date('2024-01-01')
      }
    ],
    metadata: {
      exportDate: new Date(),
      organizationName: 'Community Tech Alliance'
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      setExportingClipboard(true);
      
      const validation = validateExportData(mockExportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      await exportToClipboard(mockExportData);
      
      toast({
        title: "Copied to clipboard",
        description: "Grant application has been copied with professional formatting.",
      });
    } catch (error: any) {
      toast({
        title: "Copy failed",
        description: error.message || "Failed to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingClipboard(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      
      const validation = validateExportData(mockExportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Export started",
        description: "Generating PDF... This may take a moment.",
      });

      await exportToPDF(mockExportData);
      
      toast({
        title: "PDF exported successfully",
        description: "Your grant application has been downloaded as a PDF.",
      });
    } catch (error: any) {
      toast({
        title: "PDF export failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    try {
      setExportingWord(true);
      
      const validation = validateExportData(mockExportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Export started",
        description: "Generating Word document... This may take a moment.",
      });

      await exportToWord(mockExportData);
      
      toast({
        title: "Word document exported successfully",
        description: "Your grant application has been downloaded as a DOCX file.",
      });
    } catch (error: any) {
      toast({
        title: "Word export failed",
        description: error.message || "Failed to generate Word document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingWord(false);
    }
  };

  const validation = validateExportData(mockExportData);

  return (
    <div className="space-y-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Export Functionality Demo</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Test the new export functionality with sample grant data. This demo shows how the export features 
          work with a complete grant application including project details and question responses.
        </p>
      </div>

      <Card className="shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
            Sample Grant Application Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-600">Project Title:</p>
                <p className="text-slate-900">{mockExportData.project.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Funder:</p>
                <p className="text-slate-900">{mockExportData.project.funder}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Amount:</p>
                <p className="text-slate-900">{mockExportData.project.amount}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Organization:</p>
                <p className="text-slate-900">{mockExportData.metadata.organizationName}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Completed Questions:</h3>
              <div className="space-y-2">
                {mockExportData.questions.map((q, index) => (
                  <div key={q.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                    <span className="text-sm text-green-800">
                      {index + 1}. {q.question.substring(0, 80)}...
                    </span>
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Complete
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            {validation.valid ? (
              <CheckCircle className="mr-2 h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
            )}
            Data Validation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validation.valid ? (
            <div className="flex items-center text-green-800 bg-green-50 p-3 rounded">
              <CheckCircle className="mr-2 h-4 w-4" />
              All data is valid and ready for export
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center text-red-800 bg-red-50 p-3 rounded">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Data validation failed
              </div>
              <ul className="list-disc list-inside text-sm text-red-700 ml-4">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={handleCopyToClipboard}
              disabled={!validation.valid || exportingClipboard}
              className="h-16 flex-col space-y-2"
            >
              {exportingClipboard ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
              <span>Copy to Clipboard</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleExportWord}
              disabled={!validation.valid || exportingWord}
              className="h-16 flex-col space-y-2"
            >
              {exportingWord ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              <span>Export Word (.docx)</span>
            </Button>

            <Button
              onClick={handleExportPDF}
              disabled={!validation.valid || exportingPDF}
              className="h-16 flex-col space-y-2 bg-primary-600 hover:bg-primary-700"
            >
              {exportingPDF ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              <span>Export PDF</span>
            </Button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-medium text-blue-900 mb-2">Testing Instructions:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Copy to Clipboard:</strong> Test by pasting the copied content into a text editor</li>
              <li>• <strong>Word Export:</strong> Check that the .docx file downloads and opens correctly</li>
              <li>• <strong>PDF Export:</strong> Verify the PDF downloads with proper formatting</li>
              <li>• Each export includes project details, questions, responses, and word counts</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}