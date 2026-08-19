import React, { createContext, useContext, useState, useCallback, CSSProperties, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useSystemAuth } from "@/hooks/useSystemAuth";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, LogOut, Users, Building2, FileText,
  CalendarDays, BookOpen, Gift, Stethoscope, ClipboardList, UserCog,
  Shield, UserCircle, ShieldCheck, Wallet, Palmtree,
  CalendarCheck, ChevronRight, Settings, Bell, FileSpreadsheet, MapPin, Heart, Receipt, ArrowLeftRight, Sparkles,
  Eye, EyeOff
} from "lucide-react";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';

// Context para injetar conteúdo no bloco sticky da topbar
const StickyHeaderContext = createContext<{
  setStickyContent: (node: React.ReactNode) => void;
  clearStickyContent: () => void;
} | null>(null);

export function useStickyHeader() {
  return useContext(StickyHeaderContext);
}

const menuGroups = [
  {
    label: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Users, label: "Colaboradores", path: "/colaboradores" },
      { icon: Palmtree, label: "Férias", path: "/ferias" },
      { icon: CalendarCheck, label: "Calendário", path: "/calendario" },
    ]
  },
  {
    label: "Relações",
    items: [
      { icon: BookOpen, label: "Relação de Férias", path: "/relacao-ferias" },
      { icon: Gift, label: "Relação de Abonos", path: "/relacao-abonos" },
      { icon: Stethoscope, label: "Relação de Atestados", path: "/relacao-atestados" },
    ]
  },
  {
    label: "Saúde & Proteção",
    items: [
      { icon: Heart, label: "Plano de Saúde", path: "/plano-saude" },
      { icon: ShieldCheck, label: "Seguro de Vida", path: "/seguro-vida" },
      { icon: ClipboardList, label: "Exames Periódicos", path: "/exames-periodicos" },
    ]
  },
  {
    label: "Benefícios",
    items: [
      { icon: FileSpreadsheet, label: "Planilha VR/VT", path: "/planilha-vrvt" },
      { icon: Wallet, label: "Benefícios", path: "/relacao-beneficios" },
    ]
  },
  {
    label: "Financeiro",
    items: [
      { icon: Receipt, label: "Folha do Mês", path: "/folha-mes" },
      { icon: ArrowLeftRight, label: "Movimentação do Mês", path: "/movimentacao-mes" },
      { icon: Sparkles, label: "Auxílios & Bônus", path: "/auxilios-bonus" },
    ]
  },
  {
    label: "Gestão",
    items: [
      { icon: Building2, label: "Setores", path: "/setores" },
      { icon: FileText, label: "Relatórios", path: "/relatorio" },
      { icon: MapPin, label: "Feriados", path: "/feriados" },
      { icon: UserCircle, label: "Meu Perfil", path: "/meu-perfil" },
    ]
  },
];

const adminItem = { icon: UserCog, label: "Cadastros", path: "/cadastros" };

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 252;
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;

// Rotas que não devem ter padding (usam layout full-width próprio)
const NO_PADDING_ROUTES = ["/planilha-vrvt", "/auxilios-bonus"];

function DesktopTopBar({ activeItem }: { activeItem: { label: string } | undefined }) {
  const { hidden, toggle } = usePrivacy();
  return (
    <div className="h-[64px] border-b border-border/60 flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm" style={{ minWidth: 0 }}>
      <div className="flex items-center gap-3 overflow-hidden" style={{ flex: '1 1 0', minWidth: 0 }}>
        <SidebarTrigger className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0" />
        {activeItem && (
          <div className="flex items-center gap-1.5 text-sm overflow-hidden">
            <span className="text-muted-foreground/60 shrink-0 hidden sm:inline">Gestão de RH</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
            <span className="font-semibold text-foreground truncate" style={{ fontFamily: "var(--font-display)" }}>
              {activeItem.label}
            </span>
          </div>
        )}
      </div>
      <div className="shrink-0 ml-4 flex items-center gap-2">
        {/* Botão global de privacidade */}
        <button
          type="button"
          onClick={toggle}
          title={hidden ? "Mostrar todos os valores" : "Ocultar todos os valores"}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            hidden
              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              : "bg-muted/40 border-border/50 text-muted-foreground/80 hover:bg-muted hover:text-foreground"
          }`}
        >
          {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline whitespace-nowrap">{hidden ? "Valores ocultos" : "Ocultar valores"}</span>
        </button>
        {/* Indicador online */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" style={{ boxShadow: '0 0 6px oklch(0.52 0.145 148 / 0.6)' }} />
          <span className="text-xs font-medium text-muted-foreground/80 whitespace-nowrap">Online</span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children, noPadding, stickyHeader }: { children: React.ReactNode; noPadding?: boolean; stickyHeader?: React.ReactNode }) {
  const [location] = useLocation();
  const dynamicNoPadding = noPadding ?? NO_PADDING_ROUTES.some(r => location.startsWith(r));
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} noPadding={dynamicNoPadding} stickyHeader={stickyHeader}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth, noPadding, stickyHeader }: { children: React.ReactNode; setSidebarWidth: (w: number) => void; noPadding?: boolean; stickyHeader?: React.ReactNode }) {
  const [injectedStickyContent, setInjectedStickyContent] = useState<React.ReactNode>(null);
  const setStickyContent = useCallback((node: React.ReactNode) => setInjectedStickyContent(node), []);
  const clearStickyContent = useCallback(() => setInjectedStickyContent(null), []);

  const { user: systemUser, isAdmin, isLoading } = useSystemAuth();
  const utils = trpc.useUtils();
  const logoutMutation = trpc.systemUsers.logout.useMutation({
    onSuccess: async () => {
      // Limpa o token do localStorage ao fazer logout
      try { localStorage.removeItem("gf_sys_token"); } catch {}
      await utils.systemUsers.me.invalidate();
    },
  });

  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  if (isLoading) return <DashboardLayoutSkeleton />;

  const allGroups = isAdmin
    ? [...menuGroups.slice(0, 5), { label: "Gestão", items: [...menuGroups[5].items, adminItem] }]
    : menuGroups;

  const activeItem = allGroups.flatMap(g => g.items).find(item =>
    item.path === "/" ? location === "/" : location.startsWith(item.path)
  );

  const initials = systemUser?.nome
    ? systemUser.nome.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>

          {/* ── Header / Logo ── */}
          <SidebarHeader className="h-[64px] border-b border-sidebar-border/60 flex-row items-center px-3 gap-0">
            {isCollapsed ? (
              <div className="flex items-center justify-center w-full">
                <img
                  src="/manus-storage/logo-gestao-rh_c85a262f.png"
                  alt="Gestão de RH"
                  className="w-8 h-8 rounded-lg object-contain"
                  style={{ background: "oklch(0.18 0.06 252)" }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full overflow-hidden">
                <img
                  src="/manus-storage/logo-gestao-rh_c85a262f.png"
                  alt="Gestão de RH"
                  className="w-9 h-9 rounded-xl object-contain shrink-0 shadow-sm"
                  style={{ background: "oklch(0.18 0.06 252)" }}
                />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-sm font-bold text-sidebar-foreground leading-none tracking-tight truncate"
                    style={{ fontFamily: "var(--font-display)" }}>
                    Gestão de RH
                  </p>
                  <p className="text-[11px] text-sidebar-foreground/45 mt-0.5 font-medium tracking-wide uppercase truncate">
                    Sistema de RH
                  </p>
                </div>
              </div>
            )}
          </SidebarHeader>

          {/* ── Nav ── */}
          <SidebarContent className="gap-0 py-3 overflow-y-auto overflow-x-hidden">
            {allGroups.map((group) => (
              <div key={group.label} className="mb-1">
                {!isCollapsed && (
                  <p className="text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-widest px-4 py-2 leading-none">
                    {group.label}
                  </p>
                )}
                <SidebarMenu className="px-2 gap-0.5">
                  {group.items.map(item => {
                    const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          onClick={() => setLocation(item.path)}
                          isActive={isActive}
                          tooltip={item.label}
                          className={`
                            h-9 rounded-lg text-sm font-medium
                            transition-all duration-150 relative
                            ${isActive
                              ? "text-sidebar-foreground"
                              : "text-sidebar-foreground/60 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent/60"
                            }
                          `}
                          style={isActive ? {
                            background: "oklch(0.22 0.015 240 / 0.9)",
                            boxShadow: "inset 0 0 0 1px oklch(0.30 0.012 240 / 0.6)"
                          } : {}}
                        >
                          {/* Indicador ativo */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                              style={{ background: "oklch(0.60 0.18 210)" }} />
                          )}
                          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sky-300" : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70"}`} />
                          <span className="truncate">{item.label}</span>
                          {isActive && (
                            <ChevronRight className="w-3 h-3 text-sidebar-foreground/40 shrink-0 ml-auto" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          {/* ── Footer / Usuário ── */}
          <SidebarFooter className="p-3 border-t border-sidebar-border/60">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`
                  flex items-center gap-3 rounded-xl px-2.5 py-2.5 w-full text-left
                  hover:bg-sidebar-accent/70 transition-all duration-150 focus:outline-none
                  overflow-hidden
                  ${isCollapsed ? "justify-center" : ""}
                `}>
                  <Avatar className="h-8 w-8 shrink-0 ring-2 ring-sidebar-border/60">
                    <AvatarFallback className="text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, oklch(0.25 0.018 240), oklch(0.35 0.015 240))", color: "white" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-xs font-semibold text-sidebar-foreground truncate leading-none">
                        {systemUser?.nome || "Usuário"}
                      </p>
                      <p className="text-[11px] text-sidebar-foreground/45 truncate mt-0.5 flex items-center gap-1">
                        {systemUser?.role === "admin" ? (
                          <><Shield className="w-2.5 h-2.5 text-sky-300 shrink-0" /><span className="truncate">Administrador</span></>
                        ) : "Usuário"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
                <div className="px-3 py-2 border-b border-border/60">
                  <p className="text-sm font-semibold text-foreground truncate">{systemUser?.nome || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground truncate">{systemUser?.email || ""}</p>
                </div>
                <DropdownMenuItem onClick={() => setLocation("/meu-perfil")} className="cursor-pointer mt-1">
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Meu Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logoutMutation.mutate()}
                  className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair do sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <StickyHeaderContext.Provider value={{ setStickyContent, clearStickyContent }}>
      <SidebarInset className="bg-background flex flex-col overflow-y-auto" style={{ minHeight: 0, height: '100svh' }}>
        {/* Bloco sticky unificado: topbar + stickyHeader (quando presente) */}
        <div className="sticky top-0 z-30">
          {/* Mobile header */}
          {isMobile && (
            <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-9 w-9 rounded-lg" />
                <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-display)" }}>
                  {activeItem?.label ?? "Gestão de RH"}
                </span>
              </div>
            </div>
          )}

          {/* Desktop top bar */}
          {!isMobile && (
            <DesktopTopBar activeItem={activeItem} />
          )}

          {/* Barra extra colada à topbar (ex: controles da Planilha VR/VT) */}
          <div id="sticky-header-slot">{stickyHeader ?? injectedStickyContent}</div>
        </div>

        <main className={`flex-1 animate-fade-in flex flex-col ${noPadding ? 'bg-[#080d15]' : ''}`}>
          <div className={`flex-1 flex flex-col ${noPadding ? '' : 'p-6 lg:p-8'}`}>{children}</div>
        </main>

        {/* Marca d'água */}
        <div className="fixed bottom-4 right-5 pointer-events-none select-none z-50">
          <span className="text-[12px] font-bold uppercase"
            style={{ color: "oklch(0.50 0.16 252)", opacity: 0.22, letterSpacing: "0.30em" }}>
            Gestão de RH
          </span>
        </div>
      </SidebarInset>
      </StickyHeaderContext.Provider>
    </>
  );
}
