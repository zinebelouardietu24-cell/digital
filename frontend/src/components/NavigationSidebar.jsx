import React, { useEffect } from "react";
import { Activity, Wrench, Cpu, ChevronRight, ChevronLeft, Share2, Boxes } from "lucide-react";

/**
 * ISA-101 High Performance HMI Navigation Sidebar.
 * Restrained dark slate palette with smooth micro-interactions.
 */
export default function NavigationSidebar({ isOpen, onClose, onOpen, activeTab, setActiveTab }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (id) => {
    setActiveTab(id);
    onClose();
  };

  const menuItems = [
    {
      id: "flowsheet",
      label: "Process Flowsheet & Knowledge Graph",
      sublabel: "Dual View: Interactive P&ID overview and live system topology network",
      Icon: Activity,
    },
    {
      id: "3d",
      label: "3D Digital Twin",
      sublabel: "Realistic 3D circuit view with live equipment telemetry",
      Icon: Boxes,
    },
    {
      id: "maintenance",
      label: "Maintenance & Reliability",
      sublabel: "Asset health monitoring, overdue alerts, and work order history",
      Icon: Wrench,
    },
  ];

  return (
    <>
      <style>{`
        .left-hover-trigger {
          position: fixed;
          top: 0;
          left: 0;
          width: 42px;
          height: 100vh;
          z-index: 9998;
          pointer-events: auto;
        }

        .round-pull-handle {
          position: fixed;
          top: 50%;
          left: 12px;
          z-index: 9999;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #161f30;
          border: 1px solid #475569;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transform: translate3d(-60px, -50%, 0);
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, box-shadow 0.2s ease, background 0.2s ease;
          will-change: transform, opacity;
          outline: none;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
        }

        .left-hover-trigger:hover + .round-pull-handle,
        .round-pull-handle:hover {
          opacity: 1 !important;
          pointer-events: auto !important;
          transform: translate3d(0, -50%, 0) !important;
          box-shadow: 0 0 18px rgba(0, 0, 0, 0.6) !important;
        }

        .round-pull-handle:hover {
          background: #1e293e !important;
          color: #ffffff !important;
          transform: translate3d(0, -50%, 0) scale(1.08) !important;
        }

        .round-push-handle {
          position: absolute;
          top: 50%;
          right: -20px;
          transform: translateY(-50%);
          z-index: 10001;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #161f30;
          border: 1px solid #475569;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 1;
          pointer-events: auto;
          outline: none;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
          transition: all 0.15s ease;
        }

        .round-push-handle:hover {
          background: #1e293e !important;
          color: #ffffff !important;
          transform: translateY(-50%) scale(1.08) !important;
        }
      `}</style>

      {!isOpen && (
        <>
          <div className="left-hover-trigger" />
          <button
            onClick={onOpen}
            className="round-pull-handle"
            title="Open Navigation Menu"
            aria-label="Open Navigation"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999,
          pointerEvents: isOpen ? "auto" : "none",
          display: "flex",
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.65)",
            cursor: "pointer",
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transition: "opacity 0.28s ease",
          }}
        />

        <div
          className="sidebar-panel"
          style={{
            position: "relative",
            width: "360px",
            height: "100%",
            background: "#0e1420",
            borderRight: "1px solid #2a384e",
            boxShadow: "12px 0 40px rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            padding: "1.5rem",
            boxSizing: "border-box",
            zIndex: 10000,
            pointerEvents: isOpen ? "auto" : "none",
            transform: isOpen ? "translate3d(0, 0, 0)" : "translate3d(-100%, 0, 0)",
            transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
            willChange: "transform",
          }}
        >
          {isOpen && (
            <button
              onClick={onClose}
              className="round-push-handle"
              title="Close Navigation Menu"
              aria-label="Close Navigation"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
              paddingBottom: "1.25rem",
              borderBottom: "1px solid #2a384e",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "#161f30",
                border: "1px solid #475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e2e8f0",
              }}
            >
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ color: "#f8fafc", fontSize: "1.1rem", fontWeight: "800", letterSpacing: "0.8px" }}>
                NEXUS <span style={{ color: "#94a3b8", fontWeight: "300" }}>TWIN</span>
              </div>
              <div style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: "600", marginTop: "0.1rem" }}>
                Phosphate Industrial Intelligence
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
            <div style={{ color: "#64748b", fontSize: "0.72rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.15rem" }}>
              Navigation
            </div>

            {menuItems.map((item) => {
              const isSelected = activeTab === item.id;
              const ItemIcon = item.Icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  style={{
                    minHeight: "90px",
                    boxSizing: "border-box",
                    background: isSelected ? "#1e293e" : "#161f30",
                    border: `1.5px solid ${isSelected ? "#94a3b8" : "#2a384e"}`,
                    borderRadius: "12px",
                    padding: "1rem 1.2rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: isSelected ? "#2a384e" : "#0e1420",
                      border: `1px solid ${isSelected ? "#94a3b8" : "#334155"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isSelected ? "#ffffff" : "#94a3b8",
                      flexShrink: 0,
                    }}
                  >
                    <ItemIcon size={20} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: isSelected ? "#ffffff" : "#e2e8f0", fontWeight: "800", fontSize: "0.95rem", lineHeight: "1.2" }}>
                      {item.label}
                    </div>
                    <div style={{ color: isSelected ? "#cbd5e1" : "#64748b", fontSize: "0.74rem", marginTop: "0.25rem", lineHeight: "1.3" }}>
                      {item.sublabel}
                    </div>
                  </div>

                  <div style={{ width: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected ? (
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#94a3b8",
                        }}
                      />
                    ) : (
                      <ChevronRight size={18} style={{ color: "#475569" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              paddingTop: "1.25rem",
              borderTop: "1px solid #2a384e",
              fontSize: "0.75rem",
              color: "#64748b",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>ISA-101 HMI Engine</span>
            <span style={{ color: "#10b981", fontWeight: "700" }}>● ONLINE</span>
          </div>
        </div>
      </div>
    </>
  );
}
