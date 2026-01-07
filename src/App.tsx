import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { DocumentProvider } from '@/contexts/DocumentContext';
import { Header } from '@/components/layout';
import { RoleSelector, DocumentList, UploadArea, AnalysisResult } from '@/components/documents';
import { Upload, FileCheck, ListChecks } from 'lucide-react';

// Mobile tab type
type MobileTab = 'docs' | 'upload' | 'result';

const AppContent: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<MobileTab>('upload');

  return (
    <div className="min-h-screen flex flex-col bg-pr-charcoal relative overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="fixed inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="fixed inset-0 bg-noise pointer-events-none" style={{ opacity: 0.015 }} />
      
      {/* Animated Gradient Orbs */}
      <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-gradient-to-br from-pr-amber/20 via-pr-amber/10 to-transparent rounded-full blur-[100px] pointer-events-none animate-float" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-gradient-to-tl from-pr-amber/15 via-orange-500/10 to-transparent rounded-full blur-[100px] pointer-events-none" style={{ animationDelay: '1s' }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-pr-amber/5 to-transparent rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <Header />

      {/* Main Content - Tablet (md-lg) */}
      <main className="flex-1 w-full px-4 py-4 relative z-10 hidden md:block lg:hidden">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Top row: Role selector */}
          <RoleSelector />
          
          {/* Two column layout */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <DocumentList />
            </div>
            <div className="space-y-4">
              <UploadArea />
              <AnalysisResult />
            </div>
          </div>
        </div>
      </main>

      {/* Main Content - Desktop (lg+) */}
      <main className="flex-1 w-full px-4 xl:px-6 2xl:px-8 py-4 xl:py-6 relative z-10 hidden lg:block">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto h-full">
          <div className="grid grid-cols-12 gap-4 xl:gap-5 2xl:gap-6 h-full">
            {/* Left Sidebar: Role Selector & Document List */}
            <aside className="col-span-3 xl:col-span-3 2xl:col-span-2 flex flex-col gap-4 min-w-0">
              <RoleSelector />
              <DocumentList />
            </aside>

            {/* Center: Upload Area */}
            <section className="col-span-5 xl:col-span-5 2xl:col-span-6 min-w-0">
              <UploadArea />
            </section>

            {/* Right: Analysis Results */}
            <section className="col-span-4 xl:col-span-4 2xl:col-span-4 min-w-0">
              <AnalysisResult />
            </section>
          </div>
        </div>
      </main>

      {/* Main Content - Mobile (Tabbed Interface) */}
      <main className="flex-1 relative z-10 md:hidden flex flex-col">
        {/* Mobile Content Area */}
        <div className="flex-1 p-3 pb-24 overflow-y-auto">
          {mobileTab === 'docs' && (
            <div className="space-y-4 animate-fade-in">
              <RoleSelector />
              <DocumentList />
            </div>
          )}
          
          {mobileTab === 'upload' && (
            <div className="h-full min-h-[calc(100vh-220px)] animate-fade-in">
              <UploadArea />
            </div>
          )}
          
          {mobileTab === 'result' && (
            <div className="h-full min-h-[calc(100vh-220px)] animate-fade-in">
              <AnalysisResult />
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
          <div className="mx-3 mb-3">
            <div className="glass-strong rounded-2xl p-1.5 flex justify-around items-center gap-1 shadow-2xl">
              <MobileNavButton 
                active={mobileTab === 'docs'} 
                onClick={() => setMobileTab('docs')}
                icon={<ListChecks size={20} />}
                label="Docs"
              />
              <MobileNavButton 
                active={mobileTab === 'upload'} 
                onClick={() => setMobileTab('upload')}
                icon={<Upload size={20} />}
                label="Subir"
                primary
              />
              <MobileNavButton 
                active={mobileTab === 'result'} 
                onClick={() => setMobileTab('result')}
                icon={<FileCheck size={20} />}
                label="Resultado"
              />
            </div>
          </div>
        </nav>
      </main>

      {/* Footer - Desktop & Tablet */}
      <footer className="hidden md:block border-t border-white/5 py-3 xl:py-4 mt-auto relative z-10">
        <div className="max-w-[1600px] 2xl:max-w-[1800px] mx-auto px-4 xl:px-6 2xl:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3">
            <img 
              src="/doc_demo/logo-icon.svg" 
              alt="PartRunner" 
              className="w-6 h-6 xl:w-7 xl:h-7"
            />
            <span className="font-display font-bold text-pr-white text-sm xl:text-base">PartRunner</span>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-pr-muted font-medium text-xs xl:text-sm">DocVal AI</span>
          </div>
          <div className="flex items-center gap-4 text-pr-muted text-xs xl:text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
              <span>Powered by</span>
              <span className="font-semibold text-gradient">GPT-4o Vision</span>
            </span>
            <span className="text-white/10">|</span>
            <a 
              href="https://products.partrunner.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-pr-amber transition-colors font-medium"
            >
              partrunner.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Mobile Navigation Button Component
const MobileNavButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}> = ({ active, onClick, icon, label, primary }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center py-2 px-4 rounded-xl transition-all duration-200 min-w-[72px]
      ${primary 
        ? active 
          ? 'bg-gradient-to-br from-pr-amber to-orange-500 text-pr-charcoal shadow-lg shadow-pr-amber/40 scale-105' 
          : 'bg-pr-amber/20 text-pr-amber hover:bg-pr-amber/30'
        : active 
          ? 'bg-white/10 text-pr-white' 
          : 'text-pr-muted hover:text-pr-white hover:bg-white/5'
      }
    `}
  >
    <span className={primary && active ? 'drop-shadow-lg' : ''}>{icon}</span>
    <span className={`text-[10px] font-bold mt-0.5 ${primary && active ? 'text-pr-charcoal' : ''}`}>
      {label}
    </span>
  </button>
);

const App: React.FC = () => {
  return (
    <DocumentProvider>
      <AppContent />
      <Toaster
        position="top-center"
        containerStyle={{
          top: 60,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'linear-gradient(145deg, #1F1F1F 0%, #171717 100%)',
            color: '#F9FAFB',
            borderRadius: '16px',
            padding: '12px 16px',
            border: '1px solid rgba(245, 179, 1, 0.2)',
            boxShadow: '0 8px 32px -4px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
            fontSize: '13px',
            fontWeight: 500,
            maxWidth: '90vw',
          },
          success: {
            iconTheme: {
              primary: '#22C55E',
              secondary: '#F9FAFB',
            },
            style: {
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#F9FAFB',
            },
            style: {
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }
          },
        }}
      />
    </DocumentProvider>
  );
};

export default App;
