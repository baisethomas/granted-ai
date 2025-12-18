declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | number[] | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      letterRendering?: boolean;
      allowTaint?: boolean;
      dpi?: number;
      logging?: boolean;
      width?: number;
      height?: number;
    };
    jsPDF?: {
      unit?: string;
      format?: string | number[];
      orientation?: 'portrait' | 'landscape';
      compress?: boolean;
    };
    pagebreak?: {
      mode?: string | string[];
      before?: string | string[];
      after?: string | string[];
      avoid?: string | string[];
    };
  }

  interface Html2Pdf {
    set(options: Html2PdfOptions): Html2Pdf;
    from(element: HTMLElement): Html2Pdf;
    to(target: string): Html2Pdf;
    save(filename?: string): Promise<void>;
    output(type: string, options?: any): Promise<any>;
    outputPdf(type?: string): Promise<any>;
    outputImg(type?: string): Promise<any>;
    then(onFulfilled?: (value: any) => any, onRejected?: (reason: any) => any): Promise<any>;
  }

  function html2pdf(): Html2Pdf;

  export default html2pdf;
}