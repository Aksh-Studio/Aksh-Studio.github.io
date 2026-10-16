// ============================================================================
// Aksh Office Suite Hub Controller (apps/office/office.js)
// ============================================================================

const RECENT_DOCS_KEY = "aksh_office_recent_docs_v1";

const SUB_APP_ROUTES = {
  documents: "./sub-apps/documents/index.html",
  docs: "./sub-apps/documents/index.html",
  spreadsheets: "./sub-apps/spreadsheets/index.html",
  sheets: "./sub-apps/spreadsheets/index.html",
  presentations: "./sub-apps/presentations/index.html",
  slides: "./sub-apps/presentations/index.html"
};

/**
 * Checks if a sub-app route exists before redirecting to prevent 404 errors
 */
export async function openOfficeSubApp(appType, docId = null) {
  const normalized = String(appType || "documents").toLowerCase().trim();
  const targetUrl = SUB_APP_ROUTES[normalized];

  if (!targetUrl) {
    showOfficeToast("Unknown Office application selected.", "warning");
    return;
  }

  const finalUrl = docId ? `${targetUrl}?id=${encodeURIComponent(docId)}` : targetUrl;

  // Aksh Docs is verified present in apps/office/sub-apps/documents/index.html
  if (normalized === "documents" || normalized === "docs") {
    window.location.href = finalUrl;
    return;
  }

  // For Sheets and Slides, verify the route exists before navigating
  try {
    const response = await fetch(targetUrl, { method: "HEAD" });
    if (response.ok) {
      window.location.href = finalUrl;
    } else {
      showOfficeToast(
        `Aksh ${normalized === "sheets" || normalized === "spreadsheets" ? "Sheets" : "Slides"} is currently in development! Opening Aksh Docs instead...`,
        "info"
      );
    }
  } catch (err) {
    showOfficeToast("Unable to load sub-application. Please try Aksh Docs.", "warning");
  }
}

/**
 * Displays a non-intrusive toast notification in the Office Hub
 */
export function showOfficeToast(message, type = "info") {
  let toastContainer = document.getElementById("aksh-office-toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "aksh-office-toast-container";
    Object.assign(toastContainer.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "9999",
      display: "flex",
      flexDirection: "column",
      gap: "10px"
    });
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  const bgColors = {
    info: "#1e293b",
    success: "#065f46",
    warning: "#92400e",
    error: "#991b1b"
  };

  Object.assign(toast.style, {
    background: bgColors[type] || bgColors.info,
    color: "#ffffff",
    padding: "14px 20px",
    borderRadius: "12px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    fontWeight: "500",
    maxWidth: "360px",
    transition: "opacity 0.3s ease, transform 0.3s ease",
    opacity: "0",
    transform: "translateY(10px)",
    border: "1px solid rgba(255,255,255,0.12)"
  });

  toast.textContent = message;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

/**
 * Loads recent documents from localStorage and renders them if a list container exists
 */
export function loadRecentOfficeFiles() {
  let files = [];
  try {
    const raw = localStorage.getItem(RECENT_DOCS_KEY) || localStorage.getItem("aksh_docs_list");
    files = raw ? JSON.parse(raw) : [];
  } catch (e) {
    files = [];
  }

  const container = document.getElementById("recent-files-list") || document.querySelector(".recent-files-grid");
  if (!container) return files;

  if (!Array.isArray(files) || files.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 32px; opacity: 0.7;">
        <p>No recent documents yet. Click <strong>Aksh Docs</strong> above to create your first document!</p>
      </div>
    `;
    return [];
  }

  container.innerHTML = files
    .slice(0, 12)
    .map(
      (file) => `
      <div class="recent-file-card" data-doc-id="${file.id || ""}" style="cursor:pointer; padding:16px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">
        <h4 style="margin:0 0 6px 0;">${escapeHtml(file.title || "Untitled Document")}</h4>
        <small style="opacity:0.65;">Last edited: ${file.updatedAt ? new Date(file.updatedAt).toLocaleDateString() : "Recently"}</small>
      </div>
    `
    )
    .join("");

  container.querySelectorAll(".recent-file-card").forEach((card) => {
    card.addEventListener("click", () => {
      const docId = card.getAttribute("data-doc-id");
      openOfficeSubApp("documents", docId);
    });
  });

  return files;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Auto-bind click handlers on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  loadRecentOfficeFiles();

  // Intercept any links or cards pointing to non-existent sub-apps
  document.querySelectorAll("[data-app], a[href*='sub-apps/']").forEach((el) => {
    el.addEventListener("click", (e) => {
      const dataApp = el.getAttribute("data-app");
      const href = el.getAttribute("href") || "";

      if (dataApp) {
        e.preventDefault();
        openOfficeSubApp(dataApp);
      } else if (href.includes("spreadsheets") || href.includes("sheets")) {
        e.preventDefault();
        openOfficeSubApp("spreadsheets");
      } else if (href.includes("presentations") || href.includes("slides")) {
        e.preventDefault();
        openOfficeSubApp("presentations");
      }
    });
  });
});

window.openOfficeSubApp = openOfficeSubApp;
window.showOfficeToast = showOfficeToast;
