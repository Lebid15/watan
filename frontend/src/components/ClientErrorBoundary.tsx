'use client';
import React from 'react';

// Lightweight client-side error boundary to surface real messages for minified React errors.
export class ClientErrorBoundary extends React.Component<{
  children: React.ReactNode;
}, { error: Error | null }>{
  constructor(props: any){
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error){
    return { error };
  }
  componentDidCatch(error: Error, info: any){
    try {
      // Structured log for easier scraping in prod logs
      console.error('[ClientErrorBoundary]', { message: error.message, stack: error.stack, info });
    } catch {}
  }
  render(){
    if(this.state.error){
      return (
        <div style={{ direction:'rtl' }} className="p-4 m-4 rounded border border-red-500 bg-red-50 text-red-800 text-sm">
          <div className="font-bold mb-1">⚠️ حدث خطأ في الواجهة</div>
          <div className="mb-2 break-all">{this.state.error.message}</div>
          <button onClick={()=>{ this.setState({ error: null }); location.reload(); }} className="px-3 py-1 rounded bg-red-600 text-white text-xs">إعادة التحميل</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ClientErrorBoundary;
